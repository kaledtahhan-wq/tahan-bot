import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import {
  BRANCHES, CATEGORIES, QUESTIONS, MAJORS,
  MAJORS_2026, RELEASED_2026,
  EF_QUESTIONS, CEFR, EF_CATS, EF_SET_URL,
  FAQ, CONTACT
} from './data.js';

const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) {
  console.error('مفقود BOT_TOKEN. أنشئ ملف .env وضع فيه التوكن من @BotFather ثم أعد التشغيل.');
  process.exit(1);
}

const WHATSAPP = process.env.WHATSAPP_NUMBER || CONTACT.whatsapp;

// وضع التشغيل: webhook على السحابة (Render)، polling محلياً
const RENDER_URL = process.env.RENDER_EXTERNAL_URL;
const bot = new TelegramBot(TOKEN, { polling: !RENDER_URL });
const WEBHOOK_PATH = '/webhook/' + TOKEN;

// حالة الاختبار لكل مستخدم
const sessions = new Map();

function getSession(chatId) {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, { step: 'idle', section: null, avg: null, answers: [], efAnswers: [] });
  }
  return sessions.get(chatId);
}

function esc(text) {
  return String(text).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

function catIcon(catIdx) {
  return CATEGORIES[catIdx] ? CATEGORIES[catIdx].icon : '🎓';
}

// ---------- أزرار ----------
function mainKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🧭 اختبار البوصلة', callback_data: 'start_quiz' }],
        [{ text: '📊 حاسبة المفاضلة', callback_data: 'start_muf' }],
        [{ text: '🔤 تقدير الإنكليزية (CEFR)', callback_data: 'start_ef' }],
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
      inline_keyboard: q.opts.map((o, i) => [{ text: ['A', 'B', 'C', 'D'][i] + ') ' + o, callback_data: 'eopt:' + i }])
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

// ---------- أقسام الموقع (تواكب محتوى الموقع) ----------
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
  if (!s) return;
  const text = `${s.icon} **${s.title}**\n\n${s.desc}\n\nالموقع: ${s.url}`;
  const opt = { parse_mode: 'Markdown', ...sectionKeyboard(s.url) };
  if (msgId) {
    bot.editMessageText(text, { chat_id: chatId, message_id: msgId, ...opt });
  } else {
    bot.sendMessage(chatId, text, opt);
  }
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

// ---------- إرسال أسئلة البوصلة ----------
function askQuestion(chatId, msgId) {
  const s = getSession(chatId);
  const idx = s.answers.length;
  if (idx >= QUESTIONS.length) {
    return sendResult(chatId, msgId);
  }
  const q = QUESTIONS[idx];
  const text = `🧭 **سؤال ${idx + 1} من ${QUESTIONS.length}**\n\n${q.text}`;
  if (msgId) {
    bot.editMessageText(text, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...optionKeyboard(q) });
  } else {
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...optionKeyboard(q) });
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

  // التخصصات المتاحة حسب الفرع والمعدل
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

  text += `\n_هذه نتيجة استرشادية لا تغني عن الاستشارة. أرصدة التخصصات المذكورة قيم تقريبية مبنية على مفاضلة ${year} وتتغير سنوياً حسب النتيجة الرسمية._`;

  const opt = {
    parse_mode: 'Markdown',
    ...resultKeyboard()
  };
  if (msgId) {
    bot.editMessageText(text, { chat_id: chatId, message_id: msgId, ...opt });
  } else {
    bot.sendMessage(chatId, text, opt);
  }

  s.step = 'idle';
}

// ---------- حاسبة المفاضلة (نفس منطق الموقع: متاح + قريب من الحد) ----------
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
    bot.editMessageText(text, { chat_id: chatId, message_id: msgId, ...opt });
  } else {
    bot.sendMessage(chatId, text, opt);
  }
}

function startMufadala(chatId, msgId) {
  const s = getSession(chatId);
  if (mufadalaYear() === 2026) {
    s.section = null; s.avg = null; s.step = 'muf_section';
    const text = `📊 **حاسبة المفاضلة 2026**\n\nاختر فرعك الدراسي:`;
    if (msgId) {
      bot.editMessageText(text, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...branchKeyboard('mbranch') });
    } else {
      bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...branchKeyboard('mbranch') });
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
    bot.editMessageText(text, { chat_id: chatId, message_id: msgId, ...opt });
  } else {
    bot.sendMessage(chatId, text, opt);
  }
  s.step = 'idle';
}

// ---------- تقدير الإنكليزية ----------
function efCat(q) {
  return EF_CATS.find((c) => c.id === q.cat) || EF_CATS[0];
}

function renderEFQuestion(chatId, msgId) {
  const s = getSession(chatId);
  const idx = s.efAnswers.length;
  const q = EF_QUESTIONS[idx];
  const c = efCat(q);
  const text = `🔤 **تقدير الإنكليزية**\n\n**السؤال ${idx + 1} / ${EF_QUESTIONS.length}** · ${c.icon} ${c.name}\n\n${q.q}`;
  if (msgId) {
    bot.editMessageText(text, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...efOptionKeyboard(q) });
  } else {
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...efOptionKeyboard(q) });
  }
  s.step = 'ef_q';
}

function efFeedback(chatId, msgId, chosen) {
  const s = getSession(chatId);
  const q = EF_QUESTIONS[s.efAnswers.length - 1];
  const correct = chosen === q.a;
  const label = correct ? '✅ **إجابة صحيحة!**' : '❌ **إجابة خاطئة**';
  const text = `${label}\n\nالإجابة الصحيحة: **${q.opts[q.a]}**\n📝 ${q.expl}`;
  const isLast = s.efAnswers.length >= EF_QUESTIONS.length;
  const kb = {
    reply_markup: {
      inline_keyboard: isLast
        ? [[{ text: '📊 عرض النتيجة', callback_data: 'ef_result' }]]
        : [[{ text: '▶️ التالي', callback_data: 'ef_next' }]]
    }
  };
  bot.editMessageText(text, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...kb });
}

function efResult(chatId, msgId) {
  const s = getSession(chatId);
  const score = EF_QUESTIONS.reduce((acc, q, i) => acc + (s.efAnswers[i] === q.a ? 1 : 0), 0);
  const level = CEFR.find((c) => score >= c.min && score <= c.max);

  let text = '';
  text += `🎉 **نتيجتك في التقدير السريع**\n\n`;
  text += `مستواك التقريبي: **${level.band}**\n`;
  text += `✅ أجبت صحيحاً عن **${score} من ${EF_QUESTIONS.length}**\n\n`;
  text += `${level.desc}\n\n`;

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
        [{ text: '🔁 إعادة التقدير', callback_data: 'ef_go' }, { text: '🏠 الرئيسية', callback_data: 'home' }]
      ]
    }
  };
  if (msgId) {
    bot.editMessageText(text, { chat_id: chatId, message_id: msgId, ...opt });
  } else {
    bot.sendMessage(chatId, text, opt);
  }
  s.step = 'idle';
}

// ---------- الأوامر ----------
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const s = getSession(chatId);
  s.step = 'idle';
  const name = msg.from.first_name || 'صديقي';
  bot.sendMessage(
    chatId,
    `أهلاً ${esc(name)} 👋\n\nمرحباً بك في **بوت مركز الطحان** — النسخة الكاملة للموقع داخل تيليغرام:\n\n`
    + `🧭 اختبار البوصلة لاكتشاف تخصصك الجامعي\n`
    + `📊 حاسبة المفاضلة حسب فرعك ومعدلك\n`
    + `🔤 تقدير مستوى الإنكليزية (مقياس CEFR)\n`
    + `🎓 الجامعة الافتراضية — دليل البرامج والقبول\n`
    + `📚 التعليم المفتوح — شروطه وتخصصاته ورسومه\n`
    + `🆓 الدورات المجانية — دورات معتمدة مجاناً\n`
    + `📘 منهاج البكلوريا التفاعلي\n`
    + `❓ الأسئلة الشائعة والاستشارة المجانية\n\nاختر ما يناسبك 👇`,
    { parse_mode: 'Markdown', ...mainKeyboard() }
  );
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `**الأوامر المتاحة:**\n/start — الصفحة الرئيسية\n/quiz — اختبار البوصلة\n/mufadala — حاسبة المفاضلة\n/english — تقدير الإنكليزية\n/faq — الأسئلة الشائعة\n/contact — التواصل والاستشارة`,
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/quiz/, (msg) => {
  const chatId = msg.chat.id;
  const s = getSession(chatId);
  s.section = null; s.avg = null; s.answers = []; s.step = 'quiz_section';
  bot.sendMessage(
    chatId,
    `🧭 **اختبار البوصلة**\n\nقبل أن نبدأ، أخبرني: ما فرعك في الثانوية؟`,
    { parse_mode: 'Markdown', ...branchKeyboard('qbranch') }
  );
});

bot.onText(/\/mufadala/, (msg) => {
  startMufadala(msg.chat.id);
});

bot.onText(/\/english/, (msg) => {
  const chatId = msg.chat.id;
  const s = getSession(chatId);
  s.efAnswers = []; s.step = 'idle';
  bot.sendMessage(
    chatId,
    `🔤 **تقدير الإنكليزية — مجاناً**\n\nأجب عن ${EF_QUESTIONS.length} أسئلة بتغذية راجعة فورية لتعرف مستواك التقريبي على مقياس CEFR من A1 إلى C2، ثم أكمل اختبار EF SET الرسمي المجاني للحصول على شهادة معتمدة دولياً.\n\nابدأ الآن 👇`,
    {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '🚀 ابدأ التقدير', callback_data: 'ef_go' }], [{ text: '🏠 الرئيسية', callback_data: 'home' }]] }
    }
  );
});

bot.onText(/\/faq/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `❓ **الأسئلة الشائعة**\n\nاختر سؤالاً:`,
    { parse_mode: 'Markdown', ...faqKeyboard() }
  );
});

bot.onText(/\/contact/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `📞 **تواصل معنا**\n\nفريق مركز الطحان جاهز يجاوب عن أسئلتك ويأخذ معك استشارة مجانية — واتساب أو اتصال.\n\n`
    + `📱 ${CONTACT.phonesDisplay[0]} — ${CONTACT.phonesDisplay[1]}`,
    { parse_mode: 'Markdown', ...contactKeyboard() }
  );
});

// ---------- المعالجات ----------
bot.on('callback_query', async (cb) => {
  const chatId = cb.message.chat.id;
  const msgId = cb.message.message_id;
  const data = cb.data || '';
  const s = getSession(chatId);

  try {
    if (data === 'home') {
      s.step = 'idle';
      await bot.editMessageText('مرحباً بك في **بوت مركز الطحان** 👋\n\nماذا تريد أن تفعل؟', { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...mainKeyboard() });
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
      await bot.editMessageText('🧭 **اختبار البوصلة**\n\nما فرعك في الثانوية؟', { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...branchKeyboard('qbranch') });
      return;
    }
    if (data.startsWith('qbranch:')) {
      s.section = data.split(':')[1];
      s.step = 'quiz_avg';
      await bot.editMessageText(`فرعك: **${esc(s.section)}**\n\nإذا كنت تعرف معدلك، اكتبه رقماً (مثال: 88.5) — أو اضغط تخطي إذا لم تكن متأكداً.`, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...avgKeyboard() });
      return;
    }
    if (data === 'avg_skip') {
      s.avg = null;
      s.step = 'quiz_q';
      await bot.editMessageText('تمام، نبدأ! 🔥\n\nأجب بصدق دون تفكير طويل — اختر ما يصفك فعلاً، لا ما يتوقعه المجتمع.', { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown' });
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

    // ---------- المفاضلة ----------
    if (data === 'start_muf') {
      startMufadala(chatId, msgId);
      return;
    }
    if (data === 'muf2025') {
      s.section = null; s.avg = null; s.step = 'muf_section';
      await bot.editMessageText('📊 **حاسبة المفاضلة 2025**\n\nاختر فرعك الدراسي:', { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...branchKeyboard('mbranch') });
      return;
    }
    if (data.startsWith('mbranch:')) {
      s.section = data.split(':')[1];
      s.step = 'muf_avg';
      await bot.editMessageText(`فرعك: **${esc(s.section)}**\n\nاكتب معدلك رقماً من 0 إلى 100 (مثال: 88.5):`, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown' });
      return;
    }

    // ---------- الإنكليزية ----------
    if (data === 'start_ef') {
      s.efAnswers = [];
      s.step = 'idle';
      await bot.editMessageText(
        `🔤 **تقدير الإنكليزية — مجاناً**\n\nأجب عن ${EF_QUESTIONS.length} أسئلة بتغذية راجعة فورية لتعرف مستواك التقريبي على مقياس CEFR من A1 إلى C2، ثم أكمل اختبار EF SET الرسمي المجاني للحصول على شهادة معتمدة دولياً.\n\nابدأ الآن 👇`,
        { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🚀 ابدأ التقدير', callback_data: 'ef_go' }], [{ text: '🏠 الرئيسية', callback_data: 'home' }]] } }
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
      const idx = s.efAnswers.length;
      const q = EF_QUESTIONS[idx];
      if (q) s.efAnswers.push(chosen);
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
      await bot.editMessageText('❓ **الأسئلة الشائعة**\n\nاختر سؤالاً:', { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...faqKeyboard() });
      return;
    }
    if (data.startsWith('faq:')) {
      const n = parseInt(data.split(':')[1], 10);
      const f = FAQ[n - 1];
      if (f) {
        await bot.editMessageText(`❓ ${f.q}\n\n${f.a}`, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...homeBtn() });
      }
      return;
    }

    // ---------- تواصل / عن المركز ----------
    if (data === 'contact') {
      await bot.editMessageText(
        `📞 **تواصل معنا**\n\nفريق مركز الطحان جاهز يجاوب عن أسئلتك ويأخذ معك استشارة مجانية — واتساب أو اتصال.\n\n`
        + `📱 ${CONTACT.phonesDisplay[0]} — ${CONTACT.phonesDisplay[1]}`,
        { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...contactKeyboard() }
      );
      return;
    }
    if (data === 'about') {
      await bot.editMessageText(
        `ℹ️ **مركز الطحان**\n\nمركز متخصص في التوجيه الجامعي واستشارات ما بعد الشهادة الثانوية:\n\n`
        + `🧭 اختبار البوصلة لتحديد قطبك المناسب\n`
        + `📊 حاسبة مفاضلة 2025 (و2026 فور صدورها)\n`
        + `🔤 مسار شهادة إنكليزية معتمدة (EF SET)\n`
        + `🎓 الجامعة الافتراضية — دليل شامل لبرامج SVU والقبول\n`
        + `📚 التعليم المفتوح — شروطه وتخصصاته ورسومه\n`
        + `🆓 الدورات المجانية — دورات معتمدة مجاناً\n`
        + `📘 منهاج البكلوريا التفاعلي لتنظيم المذاكرة\n\n`
        + `كل الخدمات مجانية — صدقة جارية. 🌿\n\n`
        + `الموقع: ${CONTACT.site}`,
        { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🌐 افتح الموقع', url: CONTACT.site }], [{ text: '🏠 الرئيسية', callback_data: 'home' }]] } }
      );
      return;
    }
  } catch (err) {
    console.error('callback error:', err.message);
  } finally {
    bot.answerCallbackQuery(cb.id).catch(() => {});
  }
});

// قبول المعدل كنص (يأتي بعد اختيار الفرع في البوصلة أو المفاضلة)
bot.on('message', (msg) => {
  if (!msg.text) return;
  if (msg.text.startsWith('/')) return;
  const s = getSession(msg.chat.id);
  const num = parseFloat(msg.text.replace(',', '.'));

  if (s.step === 'quiz_avg') {
    if (!isNaN(num) && num >= 0 && num <= 100) {
      s.avg = Math.round(num * 100) / 100;
      s.answers = [];
      s.step = 'quiz_q';
      bot.sendMessage(msg.chat.id, `معدلك: **${s.avg}%** 🎯\n\nأجب بصدق على الأسئلة التالية:`, { parse_mode: 'Markdown' });
      askQuestion(msg.chat.id);
    } else {
      bot.sendMessage(msg.chat.id, 'لم أفهم هذا الرقم 🤔\nاكتب معدلك رقماً بين 0 و 100 (مثال: 88.5)، أو اضغط «تخطي».');
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
      bot.sendMessage(msg.chat.id, 'لم أفهم هذا الرقم 🤔\nاكتب معدلك رقماً بين 0 و 100 (مثال: 88.5).');
    }
  }
});

if (RENDER_URL) {
  // وضع السحابة: webhook — تيليغرام يرسل التحديثات إلى هذا العنوان
  const app = express();
  app.use(express.json());
  app.get('/', (req, res) => res.send('OK'));
  app.post(WEBHOOK_PATH, (req, res) => {
    try { bot.processUpdate(req.body); } catch (err) { console.error('webhook error:', err.message); }
    res.sendStatus(200);
  });
  const PORT = process.env.PORT || 10000;
  app.listen(PORT, () => {
    const full = RENDER_URL.replace(/\/$/, '') + WEBHOOK_PATH;
    bot.setWebHook(full).then(() => {
      console.log('🤖 بوت مركز الطحان يعمل عبر webhook على Render...');
    }).catch((err) => console.error('webhook set failed:', err.message));
  });
} else {
  console.log('🤖 بوت مركز الطحان يعمل محلياً عبر polling...');
}

export { bot };
