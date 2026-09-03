import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import {
  BRANCHES, CATEGORIES, QUESTIONS, MAJORS,
  MAJORS_2026, RELEASED_2026,
  EF_QUESTIONS, CEFR, EF_CATS, EF_SET_URL,
  FAQ, CONTACT
} from './data.js';

// ═══════════════════════════════════════════════════════════
// 1)amelioration handles & crash protection
// ═══════════════════════════════════════════════════════════
process.on('unhandledRejection', (err) => {
  console.error('⚠️ Unhandled rejection:', err?.message || err);
});
process.on('uncaughtException', (err) => {
  console.error('⚠️ Uncaught exception:', err?.message || err);
});

// ═══════════════════════════════════════════════════════════
// 2) Bot setup
// ═══════════════════════════════════════════════════════════
const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) {
  console.error('مفقود BOT_TOKEN. أنشئ ملف .env وضع فيه التوكن من @BotFather ثم أعد التشغيل.');
  process.exit(1);
}

const WHATSAPP = process.env.WHATSAPP_NUMBER || CONTACT.whatsapp;
const RENDER_URL = process.env.RENDER_EXTERNAL_URL;
const bot = new TelegramBot(TOKEN, { polling: !RENDER_URL });
const WEBHOOK_PATH = '/webhook/' + TOKEN;

// ═══════════════════════════════════════════════════════════
// 3) Graceful shutdown
// ═══════════════════════════════════════════════════════════
function shutdown(signal) {
  console.log(`🛑 Received ${signal}, shutting down gracefully...`);
  try { bot.stopPolling(); } catch (_) {}
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ═══════════════════════════════════════════════════════════
// 4) Session management with TTL & auto-cleanup
// ═══════════════════════════════════════════════════════════
const SESSION_TTL = 30 * 60 * 1000; // 30 minutes
const sessions = new Map();

function getSession(chatId) {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, {
      step: 'idle', section: null, avg: null,
      answers: [], efAnswers: [],
      ts: Date.now()
    });
  }
  const s = sessions.get(chatId);
  s.ts = Date.now();
  return s;
}

// Clean expired sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.ts > SESSION_TTL) sessions.delete(id);
  }
}, 5 * 60 * 1000);

// ═══════════════════════════════════════════════════════════
// 5) Debounce lock (prevents double-click on buttons)
// ═══════════════════════════════════════════════════════════
const locks = new Map();
function acquireLock(chatId) {
  if (locks.get(chatId)) return false;
  locks.set(chatId, true);
  setTimeout(() => locks.delete(chatId), 800);
  return true;
}

// ═══════════════════════════════════════════════════════════
// 6) Safe API helpers (catch unhandled rejections)
// ═══════════════════════════════════════════════════════════
function safeSend(chatId, text, opt) {
  return bot.sendMessage(chatId, text, opt).catch((err) => {
    console.error('sendMessage failed:', err?.message);
  });
}

function safeEdit(chatId, msgId, text, opt) {
  return bot.editMessageText(text, { chat_id: chatId, message_id: msgId, ...opt }).catch((err) => {
    console.error('editMessageText failed:', err?.message);
  });
}

// ═══════════════════════════════════════════════════════════
// 7) Text helpers
// ═══════════════════════════════════════════════════════════
// Markdown v1 escaping: only _ * ` [ have special meaning
function esc(text) {
  return String(text).replace(/([_*`\[])/g, '\\$1');
}

function md(s) {
  return String(s).replace(/([_*`\[])/g, '\\$1');
}

function catIcon(catIdx) {
  return CATEGORIES[catIdx] ? CATEGORIES[catIdx].icon : '🎓';
}

// Truncate text to stay under Telegram's 4096 char limit
function truncate(text, maxLen) {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

// Handle Arabic comma (،) and Latin comma for number parsing
function parseNum(text) {
  const cleaned = text.replace(/،/g, '.').replace(/,/g, '.');
  return parseFloat(cleaned);
}

// ═══════════════════════════════════════════════════════════
// 8) Keyboards
// ═══════════════════════════════════════════════════════════
function mainKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🧭 اختبار البوصلة', callback_data: 'start_quiz' }],
        [{ text: '📊 حاسبة المفاضلة', callback_data: 'start_muf' }],
        [{ text: '🔤 اختبار اللغة الإنكليزية (CEFR)', callback_data: 'start_ef' }],
        [{ text: '🎓 الجامعة الافتراضية', callback_data: 'sec:vu' }, { text: '📚 التعليم المفتوح', callback_data: 'sec:oedu' }],
        [{ text: '🆓 الدورات المجانية', callback_data: 'sec:fc' }, { text: '📘 منهاج البكلوريا', callback_data: 'sec:bac' }],
        [{ text: '❓ الأسئلة الشائعة', callback_data: 'faq' }],
        [{ text: '📞 تواصل واستشارة', callback_data: 'contact' }, { text: 'ℹ️ عن المركز', callback_data: 'about' }]
      ]
    }
  };
}

function branchKeyboard(prefix) {
  return {
    reply_markup: {
      inline_keyboard: BRANCHES.map((b) => [{ text: b.name, callback_data: prefix + ':' + b.id }])
    }
  };
}

function avgKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [[{ text: 'تخطي — لست متأكداً من معدلي', callback_data: 'avg_skip' }]]
    }
  };
}

function optionKeyboard(q) {
  return {
    reply_markup: {
      inline_keyboard: q.options.map((o, i) => [{ text: o.t, callback_data: 'opt:' + i }])
    }
  };
}

function efOptionKeyboard(q) {
  return {
    reply_markup: {
      inline_keyboard: q.opts.map((o, i) => [{ text: ['A', 'B', 'C', 'D'][i] + ') ' + md(o), callback_data: 'eopt:' + i }])
    }
  };
}

function resultKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🟢 استشارة واتساب مجانية', url: `https://wa.me/${WHATSAPP}` }],
        [{ text: '📊 مفاضلة مفصّلة', callback_data: 'start_muf' }, { text: '🔁 إعادة الاختبار', callback_data: 'start_quiz' }],
        [{ text: '🏠 الرئيسية', callback_data: 'home' }]
      ]
    }
  };
}

function contactKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🟢 استشارة مجانية عبر واتساب', url: `https://wa.me/${WHATSAPP}?text=${encodeURIComponent('مرحباً، بدي استشارة مجانية عن التخصص الجامعي المناسب لي.')}` }],
        [{ text: '📰 قناة أخبار مفاضلة 2026', url: CONTACT.newsChannel }, { text: '🎓 قناة المنح', url: CONTACT.grantsChannel }],
        [{ text: '✈️ تيليغرام', url: CONTACT.telegram }, { text: '📸 إنستغرام', url: CONTACT.instagram }],
        [{ text: '🏠 الرئيسية', callback_data: 'home' }]
      ]
    }
  };
}

function faqKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: FAQ.map((f, i) => [{ text: f.q, callback_data: 'faq:' + (i + 1) }])
    }
  };
}

function homeBtn() {
  return {
    reply_markup: {
      inline_keyboard: [[{ text: '🏠 الرئيسية', callback_data: 'home' }]]
    }
  };
}

// ═══════════════════════════════════════════════════════════
// 9) Website sections
// ═══════════════════════════════════════════════════════════
const SECTIONS = {
  vu: {
    icon: '🎓',
    title: 'الجامعة الافتراضية السورية',
    desc: 'دليل شامل ومرجعي لبرامج الجامعة الافتراضية السورية (SVU): شروط القبول، المقررات، الرسوم الدراسية، ومراكز التسجيل المعتمدة — وتعرّف على التخصصات المتاحة وكيف تسجّل خطوة بخطوة.',
    url: CONTACT.site + '/virtual-u.html'
  },
  oedu: {
    icon: '📚',
    title: 'التعليم المفتوح في سوريا',
    desc: 'كل ما تحتاج معرفته عن نظام التعليم المفتوح: شروط القبول، التخصصات المتاحة، الرسوم، الجامعات المشاركة، والأسئلة الشائعة — بأسلوب مرجعي مبسّط.',
    url: CONTACT.site + '/open-education.html'
  },
  fc: {
    icon: '🆓',
    title: 'الدورات المجانية',
    desc: 'مجموعة دورات مجانية معتمدة في مجالات متنوعة (تنمية الذات، مهارات، لغات وتقنية) مع شهادات وودجت تسجيل عبر واتساب — ابدأ بأي دورة مجاناً.',
    url: CONTACT.site + '/free-courses.html'
  },
  bac: {
    icon: '📘',
    title: 'منهاج البكلوريا التفاعلي',
    desc: 'منهاج تفاعلي يساعد طلاب البكلوريا على تنظيم مذاكرتهم ومتابعة تقدّمهم أسبوعياً. (قريباً على الموقع)',
    url: CONTACT.site
  }
};

function sectionKeyboard(url) {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🌐 افتح الصفحة', url }],
        [{ text: '🏠 الرئيسية', callback_data: 'home' }]
      ]
    }
  };
}

function sendSection(chatId, msgId, key) {
  const s = SECTIONS[key];
  if (!s) {
    const text = '⚠️ هذا القسم غير متاح حالياً.';
    if (msgId) {
      safeEdit(chatId, msgId, text, homeBtn());
    } else {
      safeSend(chatId, text, homeBtn());
    }
    return;
  }
  const text = `${s.icon} **${s.title}**\n\n${s.desc}\n\nالموقع: ${s.url}`;
  const opt = { parse_mode: 'Markdown', ...sectionKeyboard(s.url) };
  if (msgId) {
    safeEdit(chatId, msgId, text, opt);
  } else {
    safeSend(chatId, text, opt);
  }
}

// ═══════════════════════════════════════════════════════════
// 10) Quiz engine
// ═══════════════════════════════════════════════════════════
function computeResult(answers) {
  const totals = [0, 0, 0, 0, 0];
  answers.forEach((w) => w.forEach((v, j) => { totals[j] += v; }));
  const sum = totals.reduce((a, b) => a + b, 0) || 1;
  const pcts = totals.map((t) => Math.round((t / sum) * 100));
  // Stable sort: preserve original index for equal percentages
  const order = [0, 1, 2, 3, 4].sort((a, b) => pcts[b] - pcts[a] || a - b);
  return { totals, pcts, top: order[0], second: order[1] };
}

function askQuestion(chatId, msgId) {
  const s = getSession(chatId);
  const idx = s.answers.length;
  if (idx >= QUESTIONS.length) {
    return sendResult(chatId, msgId);
  }
  const q = QUESTIONS[idx];
  const text = `🧭 **سؤال ${idx + 1} من ${QUESTIONS.length}**\n\n${q.text}`;
  if (msgId) {
    safeEdit(chatId, msgId, text, { parse_mode: 'Markdown', ...optionKeyboard(q) });
  } else {
    safeSend(chatId, text, { parse_mode: 'Markdown', ...optionKeyboard(q) });
  }
}

function sendResult(chatId, msgId) {
  const s = getSession(chatId);
  const r = computeResult(s.answers);
  const topCat = CATEGORIES[r.top];
  const secondCat = CATEGORIES[r.second];

  let text = '';
  text += `🎉 **نتيجة اختبار البوصلة**\n\n`;
  text += `✦ قطبك المهيمن: ${topCat.icon} **${topCat.name}** — ${r.pcts[r.top]}%\n`;
  text += `✦ قريب منه: ${secondCat.icon} ${secondCat.name} — ${r.pcts[r.second]}%\n\n`;
  text += `**لماذا هذا القطب؟**\n`;
  topCat.why.forEach((x, i) => { text += `${i + 1}. ${x}\n`; });

  const majorsList = (MAJORS[s.section] || []).filter((m) => m.cat === r.top || m.cat === r.second);
  if (majorsList.length) {
    if (s.avg !== null) {
      const got = majorsList.filter((m) => m.cutoff <= s.avg).sort((a, b) => b.cutoff - a.cutoff).slice(0, 6);
      text += `\n**تخصصات متاحة لك (${s.section} · معدل ${s.avg})**\n`;
      if (got.length) {
        got.forEach((m) => { text += `✅ ${catIcon(m.cat)} ${m.name} — ${m.cutoff}%\n`; });
      } else {
        text += `لا توجد تخصصات من هذين القطبين ضمن معدلك الحالي — راجع حاسبة المفاضلة أو استشرنا مجاناً.\n`;
      }
    } else {
      text += `\n**تخصصات مرشحة (${s.section})**\n`;
      majorsList.sort((a, b) => b.cutoff - a.cutoff).slice(0, 6).forEach((m) => { text += `🔹 ${catIcon(m.cat)} ${m.name} — ${m.cutoff}%\n`; });
    }
  }

  text += `\n_هذه نتيجة استرشادية لا تغني عن الاستشارة. أرصدة التخصصات المذكورة قيم تقريبية مبنية على مفاضلة ${mufadalaYear()} وتتغير سنوياً حسب النتيجة الرسمية._`;

  const opt = { parse_mode: 'Markdown', ...resultKeyboard() };
  if (msgId) {
    safeEdit(chatId, msgId, truncate(text, 4096), opt);
  } else {
    safeSend(chatId, truncate(text, 4096), opt);
  }

  s.step = 'idle';
  s.answers = [];
}

// ═══════════════════════════════════════════════════════════
// 11) Calculator
// ═══════════════════════════════════════════════════════════
function mufadalaYear() {
  return (RELEASED_2026 && Object.keys(MAJORS_2026).length > 0) ? 2026 : 2025;
}

function mufadalaComingSoon(chatId, msgId) {
  const text = `📊 **حاسبة المفاضلة 2026**\n\n`
    + `⏳ **ستُفعَّل عند صدور المفاضلة الرسمية**\n\n`
    + `حاسبة مفاضلة 2026 ستتفعّل تلقائياً فور إعلان وزارة التعليم العالي النتائج الرسمية ومعدلات القبول النهائية لجميع الجامعات.\n\n`
    + `حالياً يمكنك استخدام حاسبة مفاضلة **2025** للاسترشاد بتخصصاتك المحتملة.`;
  const opt = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '📊 استخدم حاسبة 2025', callback_data: 'muf2025' }],
        [{ text: '📰 قناة أخبار مفاضلة 2026', url: CONTACT.newsChannel }],
        [{ text: '🏠 الرئيسية', callback_data: 'home' }]
      ]
    }
  };
  if (msgId) {
    safeEdit(chatId, msgId, text, opt);
  } else {
    safeSend(chatId, text, opt);
  }
}

function startMufadala(chatId, msgId) {
  const s = getSession(chatId);
  if (mufadalaYear() === 2026) {
    s.section = null; s.avg = null; s.step = 'muf_section';
    const text = `📊 **حاسبة المفاضلة 2026**\n\nاختر فرعك الدراسي:`;
    if (msgId) {
      safeEdit(chatId, msgId, text, { parse_mode: 'Markdown', ...branchKeyboard('mbranch') });
    } else {
      safeSend(chatId, text, { parse_mode: 'Markdown', ...branchKeyboard('mbranch') });
    }
  } else {
    mufadalaComingSoon(chatId, msgId);
  }
}

function mufadalaResult(chatId, msgId) {
  const s = getSession(chatId);
  const year = mufadalaYear();
  const src = year === 2026 ? MAJORS_2026 : MAJORS;
  const all = (src[s.section] || []).slice().sort((a, b) => b.cutoff - a.cutoff);
  const avail = all.filter((m) => m.cutoff <= s.avg);
  const near = all.filter((m) => m.cutoff > s.avg && m.cutoff <= s.avg + 2);

  let text = '';
  text += `📊 **حاسبة المفاضلة ${year}**\n\n`;
  text += `الفرع: **${esc(s.section)}** · معدلك: **${s.avg.toFixed(2)}%**\n\n`;

  if (avail.length === 0) {
    text += `💪 لا تتوفر تخصصات جامعية ضمن هذا الفرع بمعدلك الحالي، لكن لا تقلق: تبقى خيارات المعاهد التقانية والتخصصات المفتوحة متاحة. تواصل معنا لاستشارة مجانية.\n`;
  } else {
    text += `✅ **تخصصات متاحة لك (${avail.length}):**\n`;
    avail.forEach((m) => {
      const gap = s.avg - m.cutoff;
      text += `🟢 ${catIcon(m.cat)} ${m.name} — ${m.cutoff.toFixed(1)}٪ (−${gap.toFixed(1)})\n`;
    });
  }

  if (near.length) {
    text += `\n🔥 **قريبة من حدودك (+2٪):**\n`;
    near.forEach((m) => {
      const gap = m.cutoff - s.avg;
      text += `🟡 ${catIcon(m.cat)} ${m.name} — ${m.cutoff.toFixed(1)}٪ (+${gap.toFixed(1)})\n`;
    });
  }

  text += `\n_الأرصدة تقديرية استرشادية مبنية على مفاضلة ${year} وتتغير سنوياً حسب النتيجة الرسمية._`;

  const opt = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🟢 استشارة واتساب مجانية', url: `https://wa.me/${WHATSAPP}` }],
        [{ text: '📰 قناة أخبار مفاضلة 2026', url: CONTACT.newsChannel }],
        [{ text: '🔁 إعادة الحساب', callback_data: 'start_muf' }, { text: '🏠 الرئيسية', callback_data: 'home' }]
      ]
    }
  };
  if (msgId) {
    safeEdit(chatId, msgId, truncate(text, 4096), opt);
  } else {
    safeSend(chatId, truncate(text, 4096), opt);
  }
  s.step = 'idle';
}

// ═══════════════════════════════════════════════════════════
// 12) English quiz
// ═══════════════════════════════════════════════════════════
function efCat(q) {
  return EF_CATS.find((c) => c.id === q.cat) || EF_CATS[0];
}

function renderEFQuestion(chatId, msgId) {
  const s = getSession(chatId);
  const idx = s.efAnswers.length;
  if (idx >= EF_QUESTIONS.length) {
    return efResult(chatId, msgId);
  }
  const q = EF_QUESTIONS[idx];
  const c = efCat(q);
  const text = `🔤 **اختبار اللغة الإنكليزية**\n\n**السؤال ${idx + 1} / ${EF_QUESTIONS.length}** · ${c.icon} ${c.name}\n\n${md(q.q)}`;
  if (msgId) {
    safeEdit(chatId, msgId, text, { parse_mode: 'Markdown', ...efOptionKeyboard(q) });
  } else {
    safeSend(chatId, text, { parse_mode: 'Markdown', ...efOptionKeyboard(q) });
  }
  s.step = 'ef_q';
}

function efFeedback(chatId, msgId, chosen) {
  const s = getSession(chatId);
  const idx = s.efAnswers.length - 1;
  if (idx < 0 || idx >= EF_QUESTIONS.length) return;
  const q = EF_QUESTIONS[idx];
  if (typeof chosen !== 'number' || chosen < 0 || chosen >= q.opts.length) return;
  const correct = chosen === q.a;
  const label = correct ? '✅ **إجابة صحيحة!**' : '❌ **إجابة خاطئة**';
  const text = `${label}\n\nالإجابة الصحيحة: **${md(q.opts[q.a])}**\n📝 ${md(q.expl)}`;
  const isLast = s.efAnswers.length >= EF_QUESTIONS.length;
  const kb = {
    reply_markup: {
      inline_keyboard: isLast
        ? [[{ text: '📊 عرض النتيجة', callback_data: 'ef_result' }]]
        : [[{ text: '▶️ التالي', callback_data: 'ef_next' }]]
    }
  };
  safeEdit(chatId, msgId, text, { parse_mode: 'Markdown', ...kb });
}

function efResult(chatId, msgId) {
  const s = getSession(chatId);
  const score = EF_QUESTIONS.reduce((acc, q, i) => acc + (s.efAnswers[i] === q.a ? 1 : 0), 0);
  const level = CEFR.find((c) => score >= c.min && score <= c.max) || CEFR[0];

  let text = '';
  text += `🎉 **نتيجتك في اختبار اللغة الإنكليزية**\n\n`;
  text += `مستواك التقريبي: **${level.band}**\n`;
  text += `✅ أجبت صحيحاً عن **${score} من ${EF_QUESTIONS.length}**\n\n`;
  text += `${md(level.desc)}\n\n`;

  EF_CATS.forEach((c) => {
    const group = EF_QUESTIONS.filter((q) => q.cat === c.id);
    let ok = 0;
    group.forEach((q) => { const i = EF_QUESTIONS.indexOf(q); if (s.efAnswers[i] === q.a) ok++; });
    const pct = Math.round((ok / group.length) * 100);
    text += `${c.icon} ${c.name}: ${ok}/${group.length} · ${pct}%\n`;
  });

  text += `\n_نتيجتك تقريبية ولا تغني عن اختبار EF SET الرسمي للحصول على شهادة معتمدة._`;

  const opt = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎓 اختبار EF SET الرسمي', url: EF_SET_URL }],
        [{ text: '🔁 إعادة الاختبار', callback_data: 'ef_go' }, { text: '🏠 الرئيسية', callback_data: 'home' }]
      ]
    }
  };
  if (msgId) {
    safeEdit(chatId, msgId, text, opt);
  } else {
    safeSend(chatId, text, opt);
  }
  s.step = 'idle';
  s.efAnswers = [];
}

// ═══════════════════════════════════════════════════════════
// 13) Command handlers (wrapped with try/catch)
// ═══════════════════════════════════════════════════════════
bot.onText(/\/start/, (msg) => {
  try {
    const chatId = msg.chat.id;
    const s = getSession(chatId);
    s.step = 'idle';
    const name = (msg.from?.first_name) || 'صديقي';
    safeSend(
      chatId,
      `أهلاً ${esc(name)} 👋\n\nمرحباً بك في **بوت مركز الطحان** — النسخة الكاملة للموقع داخل تيليغرام:\n\n`
      + `🧭 اختبار البوصلة لاكتشاف تخصصك الجامعي\n`
      + `📊 حاسبة المفاضلة حسب فرعك ومعدلك\n`
      + `🔤 اختبار اللغة الإنكليزية (مقياس CEFR)\n`
      + `🎓 الجامعة الافتراضية — دليل البرامج والقبول\n`
      + `📚 التعليم المفتوح — شروطه وتخصصاته ورسومه\n`
      + `🆓 الدورات المجانية — دورات معتمدة مجاناً\n`
      + `📘 منهاج البكلوريا التفاعلي\n`
      + `❓ الأسئلة الشائعة والاستشارة المجانية\n\nاختر ما يناسبك 👇`,
      { parse_mode: 'Markdown', ...mainKeyboard() }
    );
  } catch (err) {
    console.error('/start error:', err.message);
  }
});

bot.onText(/\/help/, (msg) => {
  try {
    safeSend(
      msg.chat.id,
      `**الأوامر المتاحة:**\n/start — الصفحة الرئيسية\n/quiz — اختبار البوصلة\n/mufadala — حاسبة المفاضلة\n/english — اختبار اللغة الإنكليزية\n/faq — الأسئلة الشائعة\n/contact — التواصل والاستشارة`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error('/help error:', err.message);
  }
});

bot.onText(/\/quiz/, (msg) => {
  try {
    const chatId = msg.chat.id;
    const s = getSession(chatId);
    s.section = null; s.avg = null; s.answers = []; s.step = 'quiz_section';
    safeSend(
      chatId,
      `🧭 **اختبار البوصلة**\n\nقبل أن نبدأ، أخبرني: ما فرعك في الثانوية؟`,
      { parse_mode: 'Markdown', ...branchKeyboard('qbranch') }
    );
  } catch (err) {
    console.error('/quiz error:', err.message);
  }
});

bot.onText(/\/mufadala/, (msg) => {
  try {
    startMufadala(msg.chat.id);
  } catch (err) {
    console.error('/mufadala error:', err.message);
  }
});

bot.onText(/\/english/, (msg) => {
  try {
    const chatId = msg.chat.id;
    const s = getSession(chatId);
    s.efAnswers = []; s.step = 'idle';
    safeSend(
      chatId,
      `🔤 **اختبار اللغة الإنكليزية — مجاناً**\n\nأجب عن ${EF_QUESTIONS.length} أسئلة بتغذية راجعة فورية لتعرف مستواك التقريبي على مقياس CEFR من A1 إلى C2، ثم أكمل اختبار EF SET الرسمي المجاني للحصول على شهادة معتمدة دولياً.\n\nابدأ الآن 👇`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '🚀 ابدأ الاختبار', callback_data: 'ef_go' }], [{ text: '🏠 الرئيسية', callback_data: 'home' }]] }
      }
    );
  } catch (err) {
    console.error('/english error:', err.message);
  }
});

bot.onText(/\/faq/, (msg) => {
  try {
    safeSend(
      msg.chat.id,
      `❓ **الأسئلة الشائعة**\n\nاختر سؤالاً:`,
      { parse_mode: 'Markdown', ...faqKeyboard() }
    );
  } catch (err) {
    console.error('/faq error:', err.message);
  }
});

bot.onText(/\/contact/, (msg) => {
  try {
    safeSend(
      msg.chat.id,
      `📞 **تواصل معنا**\n\nفريق مركز الطحان جاهز يجاوب عن أسئلتك ويأخذ معك استشارة مجانية — واتساب أو اتصال.\n\n`
      + `📱 ${CONTACT.phonesDisplay[0]} — ${CONTACT.phonesDisplay[1]}`,
      { parse_mode: 'Markdown', ...contactKeyboard() }
    );
  } catch (err) {
    console.error('/contact error:', err.message);
  }
});

// ═══════════════════════════════════════════════════════════
// 14) Callback query handler
// ═══════════════════════════════════════════════════════════
bot.on('callback_query', async (cb) => {
  const chatId = cb.message?.chat?.id;
  const msgId = cb.message?.message_id;
  const data = cb.data || '';
  if (!chatId || !msgId) return;

  // Debounce: prevent double-click
  if (!acquireLock(chatId)) {
    bot.answerCallbackQuery(cb.id).catch(() => {});
    return;
  }

  const s = getSession(chatId);

  try {
    // ---------- الرئيسية ----------
    if (data === 'home') {
      s.step = 'idle';
      await safeEdit(chatId, msgId, 'مرحباً بك في **بوت مركز الطحان** 👋\n\nماذا تريد أن تفعل؟', { parse_mode: 'Markdown', ...mainKeyboard() });
      return;
    }

    // ---------- أقسام الموقع ----------
    if (data.startsWith('sec:')) {
      sendSection(chatId, msgId, data.split(':')[1]);
      return;
    }

    // ---------- البوصلة ----------
    if (data === 'start_quiz') {
      s.section = null; s.avg = null; s.answers = []; s.step = 'quiz_section';
      await safeEdit(chatId, msgId, '🧭 **اختبار البوصلة**\n\nما فرعك في الثانوية؟', { parse_mode: 'Markdown', ...branchKeyboard('qbranch') });
      return;
    }
    if (data.startsWith('qbranch:')) {
      s.section = data.split(':')[1];
      s.step = 'quiz_avg';
      await safeEdit(chatId, msgId, `فرعك: **${esc(s.section)}**\n\nإذا كنت تعرف معدلك، اكتبه رقماً (مثال: 88.5) — أو اضغط تخطي إذا لم تكن متأكداً.`, { parse_mode: 'Markdown', ...avgKeyboard() });
      return;
    }
    if (data === 'avg_skip') {
      s.avg = null;
      s.step = 'quiz_q';
      await safeEdit(chatId, msgId, 'تمام، نبدأ! 🔥\n\nأجب بصدق دون تفكير طويل — اختر ما يصفك فعلاً، لا ما يتوقعه المجتمع.', { parse_mode: 'Markdown' });
      askQuestion(chatId);
      return;
    }
    if (data.startsWith('opt:')) {
      const idx = s.answers.length;
      if (idx >= QUESTIONS.length) return;
      const optIdx = parseInt(data.split(':')[1], 10);
      if (isNaN(optIdx) || optIdx < 0 || optIdx >= QUESTIONS[idx].options.length) return;
      s.answers.push(QUESTIONS[idx].options[optIdx].w);
      askQuestion(chatId, msgId);
      return;
    }

    // ---------- المفاضلة ----------
    if (data === 'start_muf') {
      startMufadala(chatId, msgId);
      return;
    }
    if (data === 'muf2025') {
      s.section = null; s.avg = null; s.step = 'muf_section';
      await safeEdit(chatId, msgId, '📊 **حاسبة المفاضلة 2025**\n\nاختر فرعك الدراسي:', { parse_mode: 'Markdown', ...branchKeyboard('mbranch') });
      return;
    }
    if (data.startsWith('mbranch:')) {
      s.section = data.split(':')[1];
      s.step = 'muf_avg';
      await safeEdit(chatId, msgId, `فرعك: **${esc(s.section)}**\n\nاكتب معدلك رقماً من 0 إلى 100 (مثال: 88.5):`, { parse_mode: 'Markdown' });
      return;
    }

    // ---------- الإنكليزية ----------
    if (data === 'start_ef') {
      s.efAnswers = [];
      s.step = 'idle';
      await safeEdit(
        chatId, msgId,
        `🔤 **اختبار اللغة الإنكليزية — مجاناً**\n\nأجب عن ${EF_QUESTIONS.length} أسئلة بتغذية راجعة فورية لتعرف مستواك التقريبي على مقياس CEFR من A1 إلى C2، ثم أكمل اختبار EF SET الرسمي المجاني للحصول على شهادة معتمدة دولياً.\n\nابدأ الآن 👇`,
        { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🚀 ابدأ الاختبار', callback_data: 'ef_go' }], [{ text: '🏠 الرئيسية', callback_data: 'home' }]] } }
      );
      return;
    }
    if (data === 'ef_go') {
      s.efAnswers = [];
      s.step = 'ef_q';
      renderEFQuestion(chatId, msgId);
      return;
    }
    if (data.startsWith('eopt:')) {
      const chosen = parseInt(data.split(':')[1], 10);
      if (isNaN(chosen) || chosen < 0 || chosen > 3) return;
      const idx = s.efAnswers.length;
      if (idx >= EF_QUESTIONS.length) return;
      s.efAnswers.push(chosen);
      efFeedback(chatId, msgId, chosen);
      return;
    }
    if (data === 'ef_next') {
      renderEFQuestion(chatId, msgId);
      return;
    }
    if (data === 'ef_result') {
      efResult(chatId, msgId);
      return;
    }

    // ---------- الأسئلة الشائعة ----------
    if (data === 'faq') {
      await safeEdit(chatId, msgId, '❓ **الأسئلة الشائعة**\n\nاختر سؤالاً:', { parse_mode: 'Markdown', ...faqKeyboard() });
      return;
    }
    if (data.startsWith('faq:')) {
      const n = parseInt(data.split(':')[1], 10);
      if (isNaN(n) || n < 1 || n > FAQ.length) return;
      const f = FAQ[n - 1];
      await safeEdit(chatId, msgId, `❓ ${f.q}\n\n${f.a}`, { parse_mode: 'Markdown', ...homeBtn() });
      return;
    }

    // ---------- تواصل / عن المركز ----------
    if (data === 'contact') {
      await safeEdit(
        chatId, msgId,
        `📞 **تواصل معنا**\n\nفريق مركز الطحان جاهز يجاوب عن أسئلتك ويأخذ معك استشارة مجانية — واتساب أو اتصال.\n\n`
        + `📱 ${CONTACT.phonesDisplay[0]} — ${CONTACT.phonesDisplay[1]}`,
        { parse_mode: 'Markdown', ...contactKeyboard() }
      );
      return;
    }
    if (data === 'about') {
      await safeEdit(
        chatId, msgId,
        `ℹ️ **مركز الطحان**\n\nمركز متخصص في التوجيه الجامعي واستشارات ما بعد الشهادة الثانوية:\n\n`
        + `🧭 اختبار البوصلة لتحديد قطبك المناسب\n`
        + `📊 حاسبة مفاضلة 2025 (و2026 فور صدورها)\n`
        + `🔤 اختبار اللغة الإنكليزية + شهادة EF SET معتمدة\n`
        + `🎓 الجامعة الافتراضية — دليل شامل لبرامج SVU والقبول\n`
        + `📚 التعليم المفتوح — شروطه وتخصصاته ورسومه\n`
        + `🆓 الدورات المجانية — دورات معتمدة مجاناً\n`
        + `📘 منهاج البكلوريا التفاعلي لتنظيم المذاكرة\n\n`
        + `كل الخدمات مجانية — صدقة جارية. 🌿\n\n`
        + `الموقع: ${CONTACT.site}`,
        { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🌐 افتح الموقع', url: CONTACT.site }], [{ text: '🏠 الرئيسية', callback_data: 'home' }]] } }
      );
      return;
    }
  } catch (err) {
    console.error('callback error:', err.message);
    bot.answerCallbackQuery(cb.id, { text: 'حدث خطأ، حاول مرة أخرى.', show_alert: false }).catch(() => {});
  } finally {
    bot.answerCallbackQuery(cb.id).catch(() => {});
  }
});

// ═══════════════════════════════════════════════════════════
// 15) Message handler (average input)
// ═══════════════════════════════════════════════════════════
bot.on('message', (msg) => {
  try {
    if (!msg.text) return;
    if (msg.text.startsWith('/')) return;
    const s = getSession(msg.chat.id);
    const num = parseNum(msg.text);

    if (s.step === 'quiz_avg') {
      if (!isNaN(num) && num >= 0 && num <= 100) {
        s.avg = Math.round(num * 100) / 100;
        s.answers = [];
        s.step = 'quiz_q';
        safeSend(msg.chat.id, `معدلك: **${s.avg}%** 🎯\n\nأجب بصدق على الأسئلة التالية:`, { parse_mode: 'Markdown' });
        askQuestion(msg.chat.id);
      } else {
        safeSend(msg.chat.id, 'لم أفهم هذا الرقم 🤔\nاكتب معدلك رقماً بين 0 و 100 (مثال: 88.5)، أو اضغط «تخطي».');
      }
      return;
    }

    if (s.step === 'muf_avg') {
      if (mufadalaYear() !== 2026) {
        s.step = 'idle';
        mufadalaComingSoon(msg.chat.id);
        return;
      }
      if (!isNaN(num) && num >= 0 && num <= 100) {
        s.avg = Math.round(num * 100) / 100;
        mufadalaResult(msg.chat.id);
      } else {
        safeSend(msg.chat.id, 'لم أفهم هذا الرقم 🤔\nاكتب معدلك رقماً بين 0 و 100 (مثال: 88.5).');
      }
    }
  } catch (err) {
    console.error('message handler error:', err.message);
  }
});

// ═══════════════════════════════════════════════════════════
// 16) Polling error listener
// ═══════════════════════════════════════════════════════════
if (!RENDER_URL) {
  bot.on('polling_error', (err) => {
    console.error('Polling error:', err?.code, err?.message);
  });
}

// ═══════════════════════════════════════════════════════════
// 17) Webhook / Express server
// ═══════════════════════════════════════════════════════════
if (RENDER_URL) {
  const app = express();
  app.use(express.json({ limit: '10kb' }));
  app.get('/', (req, res) => res.send('OK'));
  app.post(WEBHOOK_PATH, (req, res) => {
    try { bot.processUpdate(req.body); } catch (err) { console.error('webhook error:', err.message); }
    res.sendStatus(200);
  });
  const PORT = process.env.PORT || 10000;
  app.listen(PORT, () => {
    const full = RENDER_URL.replace(/\/$/, '') + WEBHOOK_PATH;
    // Retry setWebHook up to 3 times with backoff
    let attempts = 0;
    function trySetWebHook() {
      attempts++;
      bot.setWebHook(full).then(() => {
        console.log(`🤖 بوت مركز الطحان يعمل عبر webhook على Render (attempt ${attempts})...`);
      }).catch((err) => {
        console.error(`webhook set failed (attempt ${attempts}):`, err.message);
        if (attempts < 3) setTimeout(trySetWebHook, attempts * 5000);
      });
    }
    trySetWebHook();
  });
} else {
  console.log('🤖 بوت مركز الطحان يعمل محلياً عبر polling...');
}

export { bot };
