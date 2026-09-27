// ═══════════════════════════════════════════════════════════════
// المساعد الذكي — يعمل داخل البوت بلا أي اعتماد على الموقع
//
// له مساران:
//  1) مزوّد LLM متوافق مع واجهة OpenAI (إن ضُبط AI_API_KEY).
//  2) محرك نوايا محلي (fallback) يجيب فوراً وبلا إنترنت،
//     مبني على نفس بيانات الموقع.
// ═══════════════════════════════════════════════════════════════

import {
  BRANCHES, CATEGORIES, QUESTIONS, MAJORS, RELEASED_2026,
  EF_QUESTIONS, CEFR, efBand, FAQ, CONTACT, PARTNER_SERVICES, waLink,
  COURSE_CATS, COURSE_COUNT, coursesByCat,
  SVU_LEVELS, SVU_PROGRAMS, SVU_CENTER_COUNT, findProgram, SVU_SITE,
  OPEN_EDU, OPEN_EDU_FEE, OPEN_EDU_PROGRAMS, OPEN_EDU_CONDITIONS, OPEN_EDU_UNIVERSITIES,
  SPECS, searchSpecs, SPEC_TYPE_LABEL
} from '../data.js';

const KEY = process.env.AI_API_KEY || '';
const BASE = (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
const MODEL = process.env.AI_MODEL || 'gpt-4o-mini';
const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 20_000;
const HISTORY = 6;

export const AI_READY = Boolean(KEY);
const YEAR = RELEASED_2026 ? 2026 : 2025;

// ═══════════ تسوية النص العربي ═══════════
// ملاحظة: تحويل الأرقام العربية-الهندية يأتي أولاً، لأن نطاق
// التشكيل U+0610–U+065F يشمل موضع الأرقام U+0660–U+0669.
const norm = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/[ىي]/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[.,،؟?!]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const has = (t, words) => words.some((w) => t.includes(w));

// ═══════════ السياق المرجعي المرسل للمزوّد ═══════════
function knowledge() {
  const majors = Object.entries(MAJORS)
    .map(([br, list]) => `${br}: ${list.map((m) => `${m.name} [${CATEGORIES[m.cat]?.name || ''} ${m.cutoff}%]`).join('، ')}`)
    .join('\n');

  return [
    'أنت مساعد مركز الطحان، مركز سوري متخصص في التوجيه الجامعي.',
    'أجب بالعربية الفصحى المبسّطة وباختصار. لا تخترع معلومات غير موجودة في هذا النص.',
    'إن لم تعرف فقل ذلك واعرض على المستخدم التواصل معنا.',
    '',
    '## البوصلة',
    `الأقطاب الخمسة: ${CATEGORIES.map((c) => `${c.name} — ${c.why[0]}`).join(' | ')}`,
    `الاختبار ${QUESTIONS.length} أسئلة، وكل إجابة تعطي وزناً لخمسة أقطاب.`,
    '',
    `## المفاضلة ${YEAR}`,
    majors,
    '',
    '## الإنكليزية',
    `${EF_QUESTIONS.length} سؤالاً. نطاقات CEFR: ${CEFR.map((c) => `${c.band} ${c.min}-${c.max}`).join('، ')}`,
    'المستوى 4 يعني TOEFL 72-94 و IELTS 5.5 و CEFR B2، وهو شرط إعفاء اللغة في عدة برامج.',
    '',
    '## الجامعة الافتراضية السورية',
    `${SVU_PROGRAMS.length} برنامجاً: ${SVU_PROGRAMS.map((p) => `${p.code}=${p.name}`).join('، ')}`,
    `المستويات: ${SVU_LEVELS.map((l) => l.name).join('، ')}. عدد مراكز التسجيل: ${SVU_CENTER_COUNT}. الموقع: ${SVU_SITE}`,
    '',
    '## التعليم المفتوح',
    `${OPEN_EDU.legal} مدة الدراسة 4 سنوات، لقاءات الجمعة والسبت، وامتحانات حضورية في شباط وتموز.`,
    `الرسوم: ${OPEN_EDU_FEE.amount} ${OPEN_EDU_FEE.unit}.`,
    `التخصصات: ${OPEN_EDU_PROGRAMS.map((p) => `${p.name} (${p.desc})`).join('، ')}`,
    `الجامعات: ${OPEN_EDU_UNIVERSITIES.map((u) => u.name).join('، ')}`,
    `شروط القبول: ${OPEN_EDU_CONDITIONS[0].items.join(' ')}`,
    '',
    '## الدورات المجانية',
    `${COURSE_COUNT} دورة بتكلفة صفر، موزعة على: ${COURSE_CATS.map((c) => `${c.name} (${coursesByCat(c.id).length})`).join('، ')}`,
    '',
    '## مقارنة التخصصات',
    `${SPECS.length} تخصصاً في الدليل مع المجال ونوع المؤسسة ومدة الدراسة.`,
    '',
    '## التواصل',
    `واتساب: ${CONTACT.waBase} · هاتف: ${CONTACT.phonesDisplay.join(' / ')} · أوقات الرد: ${CONTACT.hours}`,
    `الموقع: ${CONTACT.site}`,
    'الخدمات الشريكية: حجز جواز السفر وتركيب كاميرات المراقبة عبر واتساب.',
    ''
  ].join('\n');
}

// ═══════════ استدعاء المزوّد ═══════════
async function callProvider(messages) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(BASE + '/chat/completions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.3,
        max_tokens: 700,
        messages: [{ role: 'system', content: knowledge() }, ...messages]
      })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content;
    if (!text) throw new Error('empty response');
    return String(text).trim();
  } finally {
    clearTimeout(timer);
  }
}

// ═══════════════════════════════════════════════════════════════
// محرك النوايا المحلي
//
// يعمل بنمطين مرتبين:
//  1) أنماط regex دقيقة (فرع + معدل، نتيجتان، عبارات الخدمات، …)
//  2) كلمات مفتاحية احتياطية
// ═══════════════════════════════════════════════════════════════
const branchLine = () => BRANCHES.map((b) => b.name).join(' · ');

function findBranch(t) {
  return BRANCHES.find((b) => t.includes(norm(b.name))) || null;
}

// استخراج عدة تخصصات من جملة نصية.
//
// الطريقة: نجرّب كل عبارة من الجملة (من 5 كلمات إلى كلمة) ونجمع
// المرشحين، ثم نرتّبهم بعدد كلمات اسم التخصص الموجودة في الجملة كلها.
// بهذا تفوز «الهندسة المدنية» على «الهندسة المعلوماتية» عند كتابة
// «هندسة مدنية»، لأن اثنتين من كلماتها وردتا في الجملة.
function specTokens(t) {
  return norm(t)
    .split(' ')
    .map((w) => w.replace(/^(?:و|ب|ل|ك|ف)(?=.{2,})/, ''))
    .filter((w) => w.length > 2);
}

function extractSpecs(t) {
  const words = specTokens(t);
  if (!words.length) return [];
  const pool = new Map();
  for (let size = Math.min(5, words.length); size >= 1; size--) {
    for (let i = 0; i + size <= words.length; i++) {
      for (const s of searchSpecs(words.slice(i, i + size).join(' '), 10)) pool.set(s.n, s);
    }
  }
  const phrase = words.join(' ');
  const scored = [...pool.values()].map((s) => {
    const sWords = norm(s.n).split(' ').filter((w) => w.length > 2);
    const overlap = sWords.filter((w) => words.some((t) => w.includes(t) || t.includes(w))).length;
    const whole = sWords.length > 0 && phrase.includes(sWords.join(' '));
    // تطابق كلمات أكثر > مطابقة الاسم كاملاً > اسم أقصر (أدق)
    return { spec: s, score: overlap * 1000 + (whole ? 500 : 0) + (100 - Math.min(99, sWords.length)) };
  });
  return scored.sort((a, b) => b.score - a.score).map((x) => x.spec);
}

// اقتراح أقرب النتائج عندما لا يطابق أي اسم نصاً:
// نقيس كم كلمة من اسم التخصص موجودة في جملة المستخدم.
function fuzzySpecs(t, limit = 6) {
  const tokens = specTokens(t);
  if (!tokens.length) return [];
  const scored = [];
  for (const s of SPECS) {
    const sWords = norm(s.n).split(' ').filter((w) => w.length > 2);
    if (!sWords.length) continue;
    const hit = sWords.filter((w) => tokens.some((t) => w.includes(t) || t.includes(w)));
    if (!hit.length) continue;
    scored.push({ spec: s, ratio: hit.length / sWords.length });
  }
  return scored
    .filter((x) => x.ratio >= 0.5)
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, limit)
    .map((x) => x.spec);
}

function specBlock(s) {
  return [
    `⚖️ **${s.n}** · ${SPEC_TYPE_LABEL[s.t] || s.t}`,
    `المجال: ${s.c}`,
    `المدة: ${s.d}`,
    `يناسبك إذا: ${s.f}`
  ].join('\n');
}

// ─────────── المفاضلة ───────────
function mufadalaReply(t, raw) {
  const branch = findBranch(t);
  // الرقم يُقرأ من النص الأصلي لأن التطبيع يحوّل النقطة إلى مسافة
  const digits = String(raw ?? t).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  const m = digits.match(/(\d{2}(?:[.,]\d+)?)/);
  const avg = m ? parseFloat(m[1].replace(',', '.')) : null;

  if (branch && avg !== null) {
    if (avg < 40 || avg > 100) {
      return `معدل ${avg}% غير منطقي 🤔\nالمعدل لازم يكون بين 40 و 100. اكتبه مثل: 88.5`;
    }
    const list = (MAJORS[branch.name] || []).slice().sort((a, b) => b.cutoff - a.cutoff);
    const ok = list.filter((x) => x.cutoff <= avg).slice(0, 6);
    const near = list.filter((x) => x.cutoff > avg && x.cutoff <= avg + 2).slice(0, 4);
    const out = [`📊 **${branch.name} · معدل ${avg}%**`, ''];
    out.push(
      ok.length
        ? `✅ **متاح لك:**\n${ok.map((x) => `• ${x.name} — ${x.cutoff}%`).join('\n')}`
        : '💪 لا يوجد تخصص جامعي في هذا الفرع بمعدلك، لكن تبقى المعاهد التقنية والتعليم المفتوح والجامعة الافتراضية خيارات حقيقية.'
    );
    if (near.length) out.push('', `🔥 **قريبة منك:**\n${near.map((x) => `• ${x.name} — ${x.cutoff}%`).join('\n')}`);
    out.push('', '_تقديرية — افتح «حاسبة المفاضلة» في البوت للتفصيل الكامل._');
    return out.join('\n');
  }
  if (branch) {
    return `📊 فرعك: **${branch.name}** 👌\n\nاكتب المعدل فقط، مثال: 88.5`;
  }
  if (avg !== null) {
    return [
      `📊 المعدل: **${avg}%**`,
      '',
      'بس حدد الفرع لأعطيك التخصصات المتاحة لك.',
      `الفروع: ${branchLine()}`,
      '',
      'مثال: `علمي 88.5`'
    ].join('\n');
  }
  return [
    `📊 **حاسبة المفاضلة ${YEAR}**`,
    '',
    'أرسل لي فرعك ومعدلك هكذا:',
    '`علمي 88.5`',
    '',
    `الفروع المتاحة: ${branchLine()}`
  ].join('\n');
}

// ─────────── مقارنة التخصصين ───────────
function compareReply(t) {
  const hits = extractSpecs(t);
  if (hits.length >= 2) {
    return [specBlock(hits[0]), '───────────', specBlock(hits[1]), '', 'افتح «مقارنة التخصصين» في القائمة للجدول الكامل جنباً إلى جنب.'].join('\n');
  }
  if (hits.length === 1) {
    return [
      `🔎 وجدت: ${hits[0].n}`,
      '',
      'اذكر تخصصاً ثانياً لأقارن بينهما، أو افتح «مقارنة التخصصين» من القائمة.'
    ].join('\n');
  }
  const near = fuzzySpecs(t);
  if (near.length) {
    return [
      '⚖️ ما فهمت اسمي التخصصين بدقة 🤔',
      '',
      'أقرب ما يوجد في الدليل:',
      near.map((s) => `• ${s.n} — ${s.c}`).join('\n'),
      '',
      'افتح «مقارنة التخصصين» في القائمة لتصفح الدليل كاملاً ومقارنة أي تخصصين.'
    ].join('\n');
  }
  return [
    '⚖️ **مقارنة التخصصين**',
    '',
    'اكتب اسم تخصصين، مثال: «قارن بين الطب البشري والهندسة المعلوماتية».',
    `الدليل يحتوي ${SPECS.length} تخصصاً.`
  ].join('\n');
}

// ─────────── الفرق بين النظامين ───────────
const SYS_SVU = /افتراضي|عن بعد|svu/;
const SYS_OE = /مفتوح/;
const SYS_BAC = /بكلوريا|بكالوريا/;

function systemsDiffReply(t) {
  if (SYS_SVU.test(t) && SYS_OE.test(t)) {
    return [
      '⚖️ **الجامعة الافتراضية ← التعليم المفتوح**',
      '',
      '**الجامعة الافتراضية (SVU)**',
      `• ${SVU_PROGRAMS.length} برنامجاً دراسياً بمقررات ومدة ورسوم`,
      '• الدراسة عن بُعد عبر الإنترنت، ومعها مراكز تسجيل معتمدة داخل وخارج سوريا',
      '• تحتاج شراء المقرر (رسوم لكل مادة) + رسوم إنكليزية',
      '',
      '**التعليم المفتوح**',
      `• ${OPEN_EDU_PROGRAMS.length} تخصصات على مستوى الجامعة`,
      '• محاضرات حضورية + امتحانات حضورية (شباط وتموز)',
      `• ${OPEN_EDU_FEE.amount} ${OPEN_EDU_FEE.unit} — ${OPEN_EDU_FEE.note}`,
      '',
      '**باختصار:**',
      '• الافتراضية: مرونة أكبر في المكان والزمن، والتكلفة أعلى لأنك تدفع عن كل مادة.',
      '• المفتوح: تكلفة أقل بكثير، لكنه يطلب حضوراً وامتحانات حضورية.'
    ].join('\n');
  }
  if (SYS_SVU.test(t) && SYS_BAC.test(t)) {
    return [
      '⚖️ **الجامعة الافتراضية ← البكلوريا**',
      '',
      '• الافتراضية = برنامج جامعي معتمد بعد الشهادة الثانوية، يعطي شهادة.',
      '• البكلوريا = شهادة ثانوية فقط، وهي شرط للتسجيل في الاثنتين.'
    ].join('\n');
  }
  if (SYS_OE.test(t) && SYS_BAC.test(t)) {
    return [
      '⚖️ **التعليم المفتوح ← البكلوريا**',
      '',
      `• التعليم المفتوح برنامج جامعي، ويتطلب شهادة ثانوية بمجموع 50% فأكثر.`,
      '• أي شهادة بكتوريا تفتح نظام التعليم المفتوح؛ لا يُنظر إلى عام التخرج.'
    ].join('\n');
  }
  return null;
}

// ─────────── ترشيح تخصص حسب الاهتمام ───────────
const INTEREST_MAP = [
  [/(برمج|كود|حاسب|تقنيه المعلومات|ذكي|تطبيق)/, ['هندسة الحاسوب والأتمتة', 'الهندسة المعلوماتية', 'الذكاء الاصطناعي', 'أمن المعلومات']],
  [/(طب|جراح|دكتور|صحه|تمريض|صيدله|اسنان|مختبر)/, ['الطب البشري', 'طب الأسنان', 'الصيدلة', 'التمريض', 'المختبرات الطبية']],
  [/(رياض|فيزياء|كيمياء|احصاء|علوم)/, ['الرياضيات', 'الفيزياء', 'الكيمياء', 'الإحصاء والبحوث']],
  [/(محاسبه|اقتصاد|تجاره|اداره|مالي|بنوك|تسويق)/, ['المحاسبة', 'الاقتصاد', 'الإدارة الأعمال', 'التجارة الدولية', 'البنوك']],
  [/(قانون|شرعه|احكام)/, ['الحقوق', 'الدراسات الإسلامية']],
  [/(هندسه|بناء|معمار|تصميم|مدني|ميكانيك|كهرباء)/, ['الهندسة المدنية', 'الهندسة المعمارية', 'الهندسة الكهربائية', 'الهندسة الميكانيكية']],
  [/(لغه|ترجم|ادبي|عربي|انكليز|نحو)/, ['اللغة العربية', 'الترجمة', 'اللغة الإنجليزية']],
  [/(سياح|فندق|مtypography)/, ['السياحة والفندقة']],
  [/(سياح|فندق)/, ['السياحة والفندقة']],
  [/(زراع|بيطر|حيوان|نبات)/, ['الزراعة', 'الطب البيطري']],
  [/(اعلام|صحف|تلفزيون|اذاعه)/, ['الإعلام']],
  [/(نفط|طاقه|معادن|بتروكيما)/, ['الهندسة البترولية', 'هندسة النفط والغاز']]
];

function suggestSpecsReply(t) {
  const rows = [];
  for (const [re, names] of INTEREST_MAP) {
    if (!re.test(t)) continue;
    for (const n of names) {
      const s = SPECS.find((x) => x.n === n || x.n.includes(n) || n.includes(x.n));
      if (s && !rows.some((r) => r.n === s.n)) rows.push(s);
    }
    if (rows.length) break;
  }
  if (!rows.length) return null;
  return [
    '🎯 **حسب اهتمامك، هذه أقرب التخصصات:**',
    '',
    ...rows.slice(0, 5).map((s) => `• **${s.n}** — ${s.c} · ${s.d}\n  ${s.f}`),
    '',
    'للتأكد: افتح «اختبار البوصلة» (10 أسئلة تعطيك القطب الأدق)، أو «مقارنة التخصصين» لرؤية التفاصيل جنباً إلى جنب.'
  ].join('\n');
}

// ─────────── شروط المعاهد التقنية ───────────
function instituteReply() {
  const count = SVU_PROGRAMS.filter((p) => p.level === 'معهد').length;
  return [
    '🏛️ **المعاهد التقنية**',
    '',
    '• المعهد التقني برنامج **4 سنوات** بعد شهادة البكلوريا.',
    '• تحتاج شهادة ثانوية، ثم أربع سنوات دراسة، وتخرج بشهادة تُعدّ معادلة للشهادة الجامعية الأولى في نفس التخصص.',
    '• الدليل الحالي يضم ' + count + ' معهداً تقنياً: تقنية حاسوب، إدارة أعمال، علوم سياحية وفندقية، إدارة هندسية وتقنية رقمية.',
    '',
    '📌 **الفرق مهم:** حد القبول في المعاهد التقنية عادة **أقل بكثير** من الحد الجامعي، لأن المدة أقصر والتكلفة أقل.',
    '',
    '💡 لمعرفة المعدل المطلوب لكل تخصص: افتح **حاسبة المفاضلة** وأرسل الفرع ثم معدلك.',
    '',
    '⚠️ راجع إعلان وزارة التعليم العالي ودليل الكتل المعتمد، لأن أرقام القبول تتغير كل سنة.'
  ].join('\n');
}

// ─────────── البوصلة ───────────
function compassReply() {
  return [
    '🧭 **بوصلة اختيار التخصص**',
    '',
    'الأقطاب الخمسة:',
    CATEGORIES.map((c) => `${c.icon} **${c.name}** — ${c.why[0]}`).join('\n'),
    '',
    `اضغط «اختبار البوصلة» لتوزيع النسب على ${QUESTIONS.length} أسئلة.`
  ].join('\n');
}

// ─────────── الإنكليزية ───────────
function englishReply(t) {
  const m = t.match(/(\d{1,2})\s*(?:من|\/)\s*(\d{1,2})/);
  if (m && Number(m[2]) > 0) {
    const score = Math.min(Math.floor((Number(m[1]) / Number(m[2])) * EF_QUESTIONS.length), EF_QUESTIONS.length);
    const band = efBand(score);
    return [
      `🔤 لو أجبت **${m[1]} من ${m[2]}** ⇒ تقريباً **${score} من ${EF_QUESTIONS.length}**`,
      '',
      `مستواك التقريبي: **${band.band}**`,
      band.desc
    ].join('\n');
  }
  return [
    `🔤 **اختبار الإنكليزية** — ${EF_QUESTIONS.length} سؤالاً`,
    '',
    `النطاقات: ${CEFR.map((c) => `${c.band} (${c.min}-${c.max})`).join(' · ')}`,
    '',
    'اضغط «اختبار اللغة الإنكليزية» في القائمة للبدء.'
  ].join('\n');
}

// ─────────── الجامعة الافتراضية ───────────
function svuReply(t) {
  const code = norm(t).match(/\b([a-z]{2,4}\d{1,2})\b/);
  if (code) {
    const p = findProgram(code[1]);
    if (p) {
      return [
        `🎓 **${p.name}** · ${p.code}`,
        '',
        `المستوى: ${p.level}`,
        `التخصص: ${p.specs}`,
        `المدة: ${p.duration} · ${p.totalCourses}`,
        `اللغة: ${p.lang} · ${p.engLevels}`,
        `رسوم المقرر: ${p.feeCourse} · رسوم الإنكليزية: ${p.feeEng}`,
        '',
        `القبول: ${p.admission}`
      ].join('\n');
    }
  }
  return [
    '🎓 **الجامعة الافتراضية السورية**',
    '',
    `${SVU_PROGRAMS.length} برنامجاً موزعة على: ${SVU_LEVELS.map((l) => l.name).join('، ')}.`,
    `${SVU_CENTER_COUNT} مركز تسجيل داخل سوريا وخارجها.`,
    '',
    'افتح «الجامعة الافتراضية» في القائمة لعرض كل البرامج والرسوم والمراكز.'
  ].join('\n');
}

// ─────────── التعليم المفتوح ───────────
function openEduReply() {
  return [
    '📚 **نظام التعليم المفتوح**',
    '',
    OPEN_EDU.legal,
    'المدة: 4 سنوات · اللقاءات الجمعة والسبت · الامتحانات حضورية في شباط وتموز.',
    '',
    `الرسوم: **${OPEN_EDU_FEE.amount}** ${OPEN_EDU_FEE.unit}.`,
    '',
    `التخصصات: ${OPEN_EDU_PROGRAMS.map((p) => p.name).join('، ')}`,
    `الجامعات: ${OPEN_EDU_UNIVERSITIES.length} جامعة حكومية.`,
    '',
    'الشرط الأساسي: شهادة ثانوية بمجموع 50% فأكثر، ولا يُنظر إلى عام التخرج.',
    '',
    'افتح «التعليم المفتوح» في القائمة للتفاصيل الكاملة.'
  ].join('\n');
}

// ─────────── الدورات ───────────
function coursesReply(t) {
  const cat = COURSE_CATS.find((c) => t.includes(c.id) || t.includes(norm(c.name)));
  if (cat) {
    const list = coursesByCat(cat.id);
    return [
      `🆓 **${cat.name}** — ${list.length} دورة مجانية`,
      '',
      list.slice(0, 8).map((c) => `• ${c.name} — ${c.plat}`).join('\n'),
      list.length > 8 ? `… و${list.length - 8} دورة أخرى` : '',
      '',
      'افتح «الدورات المجانية» في القائمة للروابط المباشرة.'
    ]
      .filter(Boolean)
      .join('\n');
  }
  return [
    `🆓 **الدورات المجانية** — ${COURSE_COUNT} دورة بتكلفة صفر`,
    '',
    COURSE_CATS.map((c) => `${c.icon} ${c.name} (${coursesByCat(c.id).length})`).join('\n'),
    '',
    'افتح «الدورات المجانية» في القائمة.'
  ].join('\n');
}

// ─────────── التواصل والخدمات ───────────
function contactReply(t) {
  if (has(t, ['جواز', 'حجز', 'سفر'])) {
    const s = PARTNER_SERVICES[0];
    return [`🛂 **${s.name}**`, '', `رابط مباشر: ${waLink(s.phone, s.text)}`].join('\n');
  }
  if (has(t, ['كامير', 'مراقب', 'تركيب'])) {
    const s = PARTNER_SERVICES[1];
    return [`🎥 **${s.name}**`, '', `رابط مباشر: ${waLink(s.phone, s.text)}`].join('\n');
  }
  return [
    '📞 **تواصل مع مركز الطحان**',
    '',
    `واتساب واتصال: ${CONTACT.phonesDisplay.join(' · ')}`,
    `أوقات الرد: ${CONTACT.hours}`,
    '',
    `الموقع: ${CONTACT.site}`,
    `قناة أخبار المفاضلة: ${CONTACT.newsChannel}`,
    `قناة المنح الدراسية: ${CONTACT.grantsChannel}`
  ].join('\n');
}

function hoursReply() {
  return [`⏰ **أوقات الرد: ${CONTACT.hours}**`, '', 'خارج هذا الوقت أرسل سؤالك، وسنجيبك عند أقرب فرصة.'].join('\n');
}

function notifyReply() {
  return [
    '📡 **إشعارات البوت**',
    '',
    'اضغط «🔔 اشتراك في الإشعارات» في القائمة لتصلك تحديثات المفاضلة والأخبار أولاً بأول.',
    'للإلغاء في أي وقت: /unsubscribe'
  ].join('\n');
}

function faqReply(t) {
  const hit = FAQ.find((f) => t.includes(norm(f.q).slice(0, 10)));
  if (hit) return `❓ ${hit.q}\n\n${hit.a}`;
  return ['❓ **الأسئلة الشائعة**', '', FAQ.map((f) => `• ${f.q}`).join('\n'), '', 'افتح «الأسئلة الشائعة» في القائمة للتفاصيل.'].join('\n');
}

function helloReply() {
  return [
    'أهلاً وسهلاً! 🌿 أنا مساعد **مركز الطحان**.',
    '',
    'أقدر أساعدك في:',
    '• المفاضلة — أرسل `الفرع والمعدل` مثل `علمي 88.5`',
    '• مقارنة تخصصين',
    '• البوصلة واختبار الإنكليزية',
    '• الجامعة الافتراضية والتعليم المفتوح',
    '• الدورات المجانية',
    '• التواصل والخدمات الشريكة',
    '',
    'اسألني بأي شيء وأنا أرد عليك.'
  ].join('\n');
}

function thanksReply() {
  return [
    'العفو! 🌿 سعيد أني ساعدت.',
    '',
    'لو عندك سؤال ثاني عن التخصص أو المفاضلة أنا هون.'
  ].join('\n');
}

// ═══════════ الأنماط الدقيقة (بالترتيب) ═══════════
const PATTERNS = [
  // نظامان معاً ⇒ الفرق بينهما (قبل مقارنة التخصصين، وإلا التقط «الجامعة» كتخصص)
  { id: 'sysdiff', re: /فرق بين|الفروق بين|الفرق بين|ايهما الافضل|ما الافضل بين|وش الافضل بين/, reply: systemsDiffReply },
  { id: 'compare', re: /قارن|مقارنه|الافضل بين|افضل بين|ايهما|مقابله/, reply: compareReply },
  { id: 'mufadala', re: /مفاضله|ارصده|معدلي|نسبه القبول|اقبلني|ما تخصصي|انسب|قيد القبول/, reply: mufadalaReply },
  { id: 'institute', re: /معهد|معاهد|تقني/, reply: () => instituteReply() },
  { id: 'openedu', re: /مفتوح/, reply: () => openEduReply() },
  { id: 'svu', re: /افتراضيه|svu|عن بعد|مراكز التسجيل/, reply: svuReply },
  { id: 'english', re: /انكليز|انكليزي|انجليزي|cefr|ielts|toefl|لغتي|اللغه الانكليزيه/, reply: englishReply },
  { id: 'courses', re: /دوره|دورات|كورس|مجاني|شهاده مجانيه/, reply: coursesReply },
  // ترشيح حسب الاهتمام: «ايش أفضل تخصص للي يحب البرمجة»
  { id: 'suggest', re: /افضل تخصص|انسب تخصص|ما انسب|يحب|يميل|يعشق|مهتم ب|مهتم بـ|يبد|يحب ال|يناسبني|يناسبني/, reply: suggestSpecsReply },
  { id: 'contact', re: /تواصل|اتصال|واتساب|رقم|هاتفي|استشاره|خدمه|دعم|جواز|حجز|كامير|مراقب|تركيب/, reply: contactReply },
  { id: 'hours', re: /متي |اوقات|ساعات|يعمل|مفتوح|دوام/, reply: () => hoursReply() },
  { id: 'notify', re: /اشتراك|اشترك|تنبيه|تنبيهات|نشره/, reply: () => notifyReply() },
  { id: 'compass', re: /بوصله|قطب|ميول|شخصيه|شخصياتي|مهاراتي/, reply: () => compassReply() },
  { id: 'faq', re: /سؤال|استفسار|هل يمكن|ما هي|ما هو/, reply: faqReply },
  { id: 'thanks', re: /شكرا|شكر|يعطيك|بارك الله|جزاك/, reply: () => thanksReply() },
  { id: 'hello', re: /^(مرحبا|السلام|هلا|اهلا|هاي|صباح|مساء|hi|hello)/, reply: () => helloReply() }
];

// ═══════════ أنماط تُفحص أولاً (أقوى من الكلمات) ═══════════
const GUARDS = [
  { id: 'mufadala', test: (t) => findBranch(t) !== null && /\d/.test(t), reply: mufadalaReply },
  { id: 'english', test: (t) => /\d{1,2}\s*(?:من|\/)\s*\d{1,2}/.test(t) && /انكليز|انكليزي|cefr|اختبار|لغتي/.test(t), reply: englishReply }
];


// ═══════════ الواجهة العامة ═══════════
export function localAnswer(text) {
  const t = norm(text);
  if (!t) return 'اكتب سؤالك وسأحاول أفيدك 🙂';

  for (const g of GUARDS) {
    if (g.test(t)) {
      const out = g.reply(t, text);
      if (out) return out;
    }
  }
  for (const p of PATTERNS) {
    if (p.re.test(t)) {
      const out = p.reply(t, text);
      if (out) return out;
    }
  }
  return [
    'لم أفهم سؤالك تماماً 🤔',
    '',
    'أقدر أساعدك في:',
    '• المفاضلة — أرسل الفرع والمعدل مثل `علمي 88.5`',
    '• مقارنة تخصصين',
    '• البوصلة واختبار الإنكليزية',
    '• الجامعة الافتراضية والتعليم المفتوح',
    '• الدورات المجانية',
    '• التواصل والخدمات',
    '',
    `أو تواصل معنا: ${CONTACT.waBase}`
  ].join('\n');
}

export async function answer(text, history = []) {
  if (!AI_READY) return { text: localAnswer(text), source: 'local' };
  const messages = [
    ...history.slice(-HISTORY).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: text }
  ];
  try {
    return { text: await callProvider(messages), source: 'llm' };
  } catch (err) {
    console.error('AI provider failed — تم التحويل للمحرك المحلي:', err.message);
    return { text: localAnswer(text), source: 'local' };
  }
}

export const AI_INFO = {
  ready: AI_READY,
  model: AI_READY ? MODEL : 'محرك النوايا المحلي',
  patterns: PATTERNS.length,
  guards: GUARDS.length
};

// ═══════════ معالج الجلسة (يستدعيه البوت) ═══════════
// send(chatId, text) — دالة إرسال يحمّلها البوت
// s.aiHistory — سياق الجلسات، و s.aiTyping لعرض «يكتب…»
export async function handleAi(chatId, s, text, send) {
  const q = String(text || '').trim();
  if (!q) return;

  // أوامر داخل المحادثة
  if (/^(أوقف|إيقاف|stop|off)$/i.test(q)) {
    s.aiOn = false;
    return send(chatId, '🔴 تم إيقاف المساعد الذكي.\n\nلإعادة تشغيله: /ai');
  }
  if (/^(امسح|clear)$/i.test(q)) {
    s.aiHistory = [];
    return send(chatId, '🗑️ تم مسح سياق المحادثة. ابدأ من جديد!');
  }

  if (!s.aiTyping) {
    s.aiTyping = true;
    send(chatId, '🤖 …').catch(() => {});
  }

  const out = await answer(q, s.aiHistory);
  s.aiTyping = false;

  s.aiHistory.push({ role: 'user', content: q });
  s.aiHistory.push({ role: 'assistant', content: out.text });
  if (s.aiHistory.length > HISTORY * 2) s.aiHistory = s.aiHistory.slice(-HISTORY * 2);

  return send(chatId, out.text);
}
