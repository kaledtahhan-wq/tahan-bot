import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import { BRANCHES, CATEGORIES, QUESTIONS, MAJORS } from './data.js';

const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) {
  console.error('مفقود BOT_TOKEN. أنشئ ملف .env وضع فيه التوكن من @BotFather ثم أعد التشغيل.');
  process.exit(1);
}

const WHATSAPP = process.env.WHATSAPP_NUMBER || '963999278956';

const bot = new TelegramBot(TOKEN, { polling: true });

// حالة الاختبار لكل مستخدم
const sessions = new Map();

function getSession(chatId) {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, { step: 'idle', section: null, avg: null, answers: [] });
  }
  return sessions.get(chatId);
}

function esc(text) {
  return String(text).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

// ---------- أزرار ----------
function mainKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🧭 ابدأ اختبار البوصلة', callback_data: 'start_quiz' }],
        [{ text: '📞 استشارة مجانية', callback_data: 'consult' }, { text: 'ℹ️ عن المركز', callback_data: 'about' }]
      ]
    }
  };
}

function branchKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: BRANCHES.map((b) => [{ text: b.name, callback_data: 'branch:' + b.id }])
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

function optionKeyboard(q, lang = 'ar') {
  return {
    reply_markup: {
      inline_keyboard: q.options.map((o, i) => [{ text: o.t, callback_data: 'opt:' + i }])
    }
  };
}

function resultKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🟢 استشارة واتساب مجانية', url: `https://wa.me/${WHATSAPP}` }],
        [{ text: '🔁 إعادة الاختبار', callback_data: 'start_quiz' }, { text: '📋 الرئيسية', callback_data: 'home' }]
      ]
    }
  };
}

// ---------- حساب النتيجة (نفس منطق الموقع) ----------
function computeResult(answers) {
  const totals = [0, 0, 0, 0, 0];
  answers.forEach((w) => w.forEach((v, j) => { totals[j] += v; }));
  const sum = totals.reduce((a, b) => a + b, 0) || 1;
  const pcts = totals.map((t2) => Math.round((t2 / sum) * 100));
  const order = [0, 1, 2, 3, 4].sort((a, b) => pcts[b] - pcts[a]);
  return { totals, pcts, top: order[0], second: order[1] };
}

// ---------- إرسال الأسئلة ----------
function askQuestion(chatId, msgId) {
  const s = getSession(chatId);
  const idx = s.answers.length;
  if (idx >= QUESTIONS.length) {
    return sendResult(chatId, msgId);
  }
  const q = QUESTIONS[idx];
  const text = `سؤال ${idx + 1} من ${QUESTIONS.length}\n\n${q.text}`;
  if (msgId) {
    bot.editMessageText(text, { chat_id: chatId, message_id: msgId, ...optionKeyboard(q) });
  } else {
    bot.sendMessage(chatId, text, optionKeyboard(q));
  }
}

function sendResult(chatId, msgId) {
  const s = getSession(chatId);
  const r = computeResult(s.answers);
  const topCat = CATEGORIES[r.top];
  const secondCat = CATEGORIES[r.second];

  let text = '';
  text += `🎉 نتيجة اختبار البوصلة\n\n`;
  text += `✦ قطبك المهيمن: **${topCat.icon} ${topCat.name}** — ${r.pcts[r.top]}%\n`;
  text += `✦ قريب منه: ${secondCat.icon} ${secondCat.name} — ${r.pcts[r.second]}%\n\n`;
  text += `**لماذا هذا القطب؟**\n`;
  topCat.why.forEach((x, i) => { text += `${i + 1}. ${x}\n`; });

  // التخصصات المتاحة حسب الفرع والمعدل
  const majorsList = (MAJORS[s.section] || []).filter((m) => m.cat === r.top || m.cat === r.second);
  if (majorsList.length) {
    if (s.avg !== null) {
      const got = majorsList.filter((m) => m.cutoff <= s.avg).sort((a, b) => b.cutoff - a.cutoff).slice(0, 6);
      text += `\n**تخصصات متاحة لك (${s.section} · معدل ${s.avg})**\n`;
      if (got.length) {
        got.forEach((m) => { text += `✅ ${m.name} — ${m.cutoff}%\n`; });
      } else {
        text += `لا توجد تخصصات من هذين القطبين ضمن معدلك الحالي — راجع حاسبة المفاضلة على الموقع أو استشرنا مجاناً.\n`;
      }
    } else {
      text += `\n**تخصصات مرشحة (${s.section})**\n`;
      majorsList.sort((a, b) => b.cutoff - a.cutoff).slice(0, 6).forEach((m) => { text += `🔹 ${m.name} — ${m.cutoff}%\n`; });
    }
  }

  text += `\n_نتيجة استرشادية لا تغني عن الاستشارة. أرصدة التخصصات قيم تقريبية مبنية على مفاضلة 2025 وتتغير سنوياً._`;

  const opt = {
    parse_mode: 'Markdown',
    ...resultKeyboard()
  };
  if (msgId) {
    bot.editMessageText(text, { chat_id: chatId, message_id: msgId, ...opt });
  } else {
    bot.sendMessage(chatId, text, opt);
  }

  s.step = 'done';
}

// ---------- الأوامر ----------
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  getSession(chatId);
  const name = msg.from.first_name || 'صديقي';
  bot.sendMessage(
    chatId,
    `أهلاً ${esc(name)} 👋\n\nمرحباً بك في **بوت مركز الطحان** للتوجيه الجامعي.\n\nأجب عن 10 أسئلة ذكية لنتعرّف على قطبك الجامعي المثالي، ونجد لك التخصصات المناسبة لفرعك ومعدلك — مجاناً.`,
    { parse_mode: 'Markdown', ...mainKeyboard() }
  );
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `**الأوامر المتاحة:**\n/start — الصفحة الرئيسية\n/quiz — بدء اختبار البوصلة\n/help — هذه المساعدة`,
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/quiz/, (msg) => {
  startQuiz(msg.chat.id);
});

function startQuiz(chatId) {
  const s = getSession(chatId);
  s.section = null; s.avg = null; s.answers = [];
  bot.sendMessage(
    chatId,
    `🧭 **اختبار البوصلة**\n\nقبل أن نبدأ، أخبرني: ما فرعك في الثانوية؟`,
    { parse_mode: 'Markdown', ...branchKeyboard() }
  );
}

// ---------- المعالجات ----------
bot.on('callback_query', async (cb) => {
  const chatId = cb.message.chat.id;
  const msgId = cb.message.message_id;
  const data = cb.data || '';
  const s = getSession(chatId);

  try {
    if (data === 'start_quiz') {
      await bot.editMessageText('🧭 **اختبار البوصلة**\n\nما فرعك في الثانوية؟', { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...branchKeyboard() });
      return;
    }
    if (data === 'home') {
      await bot.editMessageText(`مرحباً بك في **بوت مركز الطحان** 👋\n\nماذا تريد أن تفعل؟`, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...mainKeyboard() });
      return;
    }
    if (data === 'consult') {
      await bot.sendMessage(chatId, `يسعدنا التواصل معك 😊\n\nاضغط الزر أدناه لفتح واتساب مباشرة:`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🟢 تواصل معنا على واتساب', url: `https://wa.me/${WHATSAPP}` }]] } });
      return;
    }
    if (data === 'about') {
      await bot.sendMessage(chatId, `**مركز الطحان**\n\nمركز متخصص في التوجيه الجامعي واستشارات ما بعد الشهادة الثانوية: اختبار البوصلة لتحديد القطب المناسب، حاسبة مفاضلة 2025، ومسار شهادة إنكليزية معتمدة (EF SET).\n\nاستشارة مجانية عبر واتساب: https://wa.me/${WHATSAPP}`);
      return;
    }
    if (data.startsWith('branch:')) {
      s.section = data.split(':')[1];
      await bot.editMessageText(`فرعك: **${s.section}**\n\nإذا كنت تعرف معدلك، اكتبه رقماً (مثال: 88.5) — أو اضغط تخطي إذا لم تكن متأكداً.`, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...avgKeyboard() });
      return;
    }
    if (data === 'avg_skip') {
      s.avg = null;
      await bot.editMessageText(`تمام، نبدأ! 🔥\n\nأجب بصدق دون تفكير طويل — اختر ما يصفك فعلاً، لا ما يتوقعه المجتمع.`, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown' });
      askQuestion(chatId);
      return;
    }
    if (data.startsWith('opt:')) {
      const idx = s.answers.length;
      const optIdx = parseInt(data.split(':')[1], 10);
      const q = QUESTIONS[idx];
      if (q) s.answers.push(q.options[optIdx].w);
      askQuestion(chatId, msgId);
      return;
    }
  } catch (err) {
    console.error('callback error:', err.message);
  } finally {
    bot.answerCallbackQuery(cb.id).catch(() => {});
  }
});

// قبول المعدل كنص (يأتي بعد اختيار الفرع)
bot.on('message', (msg) => {
  if (!msg.text) return;
  if (msg.text.startsWith('/')) return;
  const s = getSession(msg.chat.id);
  if (s.step === 'idle') return;

  const num = parseFloat(msg.text.replace(',', '.'));
  if (!isNaN(num) && num >= 0 && num <= 100) {
    s.avg = Math.round(num * 100) / 100;
    s.answers = [];
    bot.sendMessage(msg.chat.id, `معدلك: **${s.avg}%** 🎯\n\nأجب بصدق على الأسئلة التالية:`, { parse_mode: 'Markdown' });
    askQuestion(msg.chat.id);
  } else {
    bot.sendMessage(msg.chat.id, 'لم أفهم هذا الرقم 🤔\nاكتب معدلك رقماً بين 0 و 100 (مثال: 88.5)، أو اضغط «تخطي».');
  }
});

console.log('🤖 بوت مركز الطحان يعمل...');
