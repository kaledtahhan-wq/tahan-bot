// ═══════════════════════════════════════════════════════════════
// نظام البث والإشعارات — مشتركو تيليغرام + سحب إعلانات الموقع
//
// المشتركون: مجموعة Redis (SADD/SREM/SMEMBERS) عبر Upstash REST.
// إن لم تُضبط بيانات Upstash يعمل النظام بذاكرة العملية فقط
// (مناسب للتشغيل المحلي، ويفقد المشتركون عند إعادة التشغيل).
// ═══════════════════════════════════════════════════════════════

import { CONTACT } from '../data.js';

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const SUB_KEY = process.env.TG_SUBS_KEY || 'tahan:telegram:subs';
const SENT_KEY = process.env.TG_SENT_KEY || 'tahan:telegram:last_announcement';

const ANNOUNCE_URL = process.env.ANNOUNCEMENT_URL || CONTACT.site + '/api/announcement';
const POLL_MS = Math.max(60_000, Number(process.env.ANNOUNCE_POLL_MS) || 5 * 60 * 1000);

export const REDIS_READY = Boolean(REDIS_URL && REDIS_TOKEN);

// ─────────── Upstash REST ───────────
async function redis(command, args = []) {
  if (!REDIS_READY) throw new Error('redis not configured');
  const res = await fetch(REDIS_URL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + REDIS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify([command, ...args])
  });
  const json = await res.json().catch(() => null);
  if (!json || json.error) throw new Error(json?.error || 'redis error');
  return json.result;
}

// ─────────── المشتركون ───────────
const memSubs = new Set();

export async function addSubscriber(chatId) {
  const id = String(chatId);
  memSubs.add(id);
  if (REDIS_READY) {
    try { await redis('SADD', [SUB_KEY, id]); } catch (e) { console.error('SADD failed:', e.message); }
  }
  return true;
}

export async function removeSubscriber(chatId) {
  const id = String(chatId);
  memSubs.delete(id);
  if (REDIS_READY) {
    try { await redis('SREM', [SUB_KEY, id]); } catch (e) { console.error('SREM failed:', e.message); }
  }
  return true;
}

export async function listSubscribers() {
  if (REDIS_READY) {
    try {
      const r = await redis('SMEMBERS', [SUB_KEY]);
      return (r || []).map(String);
    } catch (e) {
      console.error('SMEMBERS failed:', e.message);
    }
  }
  return [...memSubs];
}

export async function subscriberCount() {
  return (await listSubscribers()).length;
}

export async function isSubscriber(chatId) {
  const id = String(chatId);
  if (REDIS_READY) {
    try { return Number(await redis('SISMEMBER', [SUB_KEY, id])) === 1; } catch (e) { /* fall through */ }
  }
  return memSubs.has(id);
}

// ─────────── منع التكرار ───────────
const fingerprint = (a) => {
  const str = [a.title, a.body, a.url, a.image].join('|');
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
  return h.toString(36);
};

async function alreadySent(fp) {
  if (REDIS_READY) {
    try { return (await redis('GET', [SENT_KEY])) === fp; } catch (e) { /* ignore */ }
  }
  return memSent === fp;
}

let memSent = null;

async function markSent(fp) {
  memSent = fp;
  if (REDIS_READY) {
    try { await redis('SET', [SENT_KEY, fp, 'EX', String(60 * 60 * 24 * 30)]); } catch (e) { /* ignore */ }
  }
}

// ─────────── تنسيق الإعلان ───────────
export function formatAnnouncement(a) {
  const lines = [`📢 **${a.title || 'مركز الطحان'}**`];
  if (a.body) lines.push('', a.body);
  const kb = [];
  if (a.url) {
    const abs = /^https?:\/\//i.test(a.url) ? a.url : CONTACT.site.replace(/\/$/, '') + (a.url.startsWith('/') ? a.url : '/' + a.url);
    kb.push([{ text: '🌐 افتح التفاصيل', url: abs }]);
  }
  kb.push([{ text: '🔕 إلغاء الاشتراك', callback_data: 'sub_off' }]);
  if (a.image) {
    return { caption: lines.join('\n'), media: a.image, keyboard: { inline_keyboard: kb } };
  }
  return { caption: lines.join('\n'), keyboard: { inline_keyboard: kb } };
}

// ─────────── الإرسال ───────────
async function deliver(bot, ids, a) {
  const { caption, media, keyboard } = formatAnnouncement(a);
  const CHUNK = 20;
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    await Promise.all(
      chunk.map(async (id) => {
        try {
          if (media) await bot.sendPhoto(id, media, { caption, parse_mode: 'Markdown', ...keyboard });
          else await bot.sendMessage(id, caption, { parse_mode: 'Markdown', ...keyboard });
          sent++;
        } catch (err) {
          failed++;
          // 403/400 = المستخدم حجب البوت ⇒ احذفه من القائمة
          if (err?.response?.body?.error_code === 403) {
            await removeSubscriber(id).catch(() => {});
          }
        }
      })
    );
    if (i + CHUNK < ids.length) await new Promise((r) => setTimeout(r, 1200));
  }
  return { sent, failed };
}

// ─────────── الحلقة ───────────
export async function checkAnnouncement(bot) {
  if (!bot) return { skipped: true };
  let payload;
  try {
    const res = await fetch(ANNOUNCE_URL, { headers: { accept: 'application/json' } });
    if (!res.ok) return { skipped: true };
    const json = await res.json();
    payload = json?.announcement;
  } catch (err) {
    console.error('announcement fetch failed:', err.message);
    return { skipped: true };
  }
  if (!payload || (!payload.title && !payload.body)) return { skipped: true };

  const fp = fingerprint(payload);
  if (await alreadySent(fp)) return { skipped: true, duplicate: true };

  const ids = await listSubscribers();
  if (!ids.length) {
    await markSent(fp);
    return { skipped: true, noSubs: true };
  }
  const out = await deliver(bot, ids, payload);
  await markSent(fp);
  console.log(`📢 تم بث «${payload.title}» إلى ${out.sent} مشترك${out.failed ? ` (فشل ${out.failed})` : ''}`);
  return out;
}

let timer = null;

export function startBroadcast(bot) {
  const tick = () => checkAnnouncement(bot).catch((e) => console.error('broadcast error:', e.message));
  tick();
  timer = setInterval(tick, POLL_MS);
  if (timer.unref) timer.unref();
  console.log(`📡 مراقبة الإعلانات مفعّلة كل ${Math.round(POLL_MS / 60000)} دقيقة — ${REDIS_READY ? 'المشتركون محفوظون في Redis' : 'وضع الذاكرة المحلية (تُفقد الاشتراكات عند إعادة التشغيل)'}`);
  return timer;
}

export function stopBroadcast() {
  if (timer) clearInterval(timer);
  timer = null;
}

export const BROADCAST_INFO = {
  redisReady: REDIS_READY,
  pollMinutes: Math.round(POLL_MS / 60000),
  url: ANNOUNCE_URL
};
