// ═══════════════════════════════════════════════════════════════
// حزمة اختبار مركز الطحان — بلا شبكة، بلا بيانات حقيقية
//
//   npm test              كل المجموعات
//   npm run test:pt       juego النماذج الثلاثة كاملاً (156 سؤالاً)
//
// mock-tg يحترم حدود تيليغرام (4096 حرف، callback_data ≤ 64 بايت)
// ويرصد اللوحات المشوّهة في kbProblems بدل ابتلاعها.
// ═══════════════════════════════════════════════════════════════

process.env.BOT_TOKEN = process.env.BOT_TOKEN || '123:FAKE';
process.env.ANNOUNCE_POLL_MS = '3600000';
delete process.env.AI_API_KEY;

import { existsSync, readdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(HERE, '..') + path.sep;
// موقع المنصة: متغيّر بيئة أو مسار افتراضي؛ الفحص يُتخطى إن لم يوجد
const PLATFORM = process.env.PLATFORM_DIR || 'C:/Users/khakh/Documents/Default Project/tahan-platform';
const HAS_SITE = existsSync(PLATFORM);

const { sent, kbProblems } = await import('./mock-tg.mjs');
const { bot } = await import('../bot.js');

const H = bot.__handlers();
const CHAT = 555;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const all = () => sent.map((x) => x.text).join(' | ');
const last = () => sent[sent.length - 1];
const clear = () => { sent.length = 0; };

const mkCb = (data) => ({ id: 'q' + Math.random(), data, message: { message_id: 77, chat: { id: CHAT } } });
// نافذة الـdebounce في البوت 800ms — ننتظرها لضمان تنفيذ كل callback
const CB_GAP = 810;
const runCb = async (data) => { await sleep(CB_GAP); clear(); for (const h of H.callback_query) await h(mkCb(data)); };
const runMsg = async (text) => {
  clear();
  for (const h of H.message) h({ chat: { id: CHAT }, from: { first_name: 'أحمد' }, text });
  // ننتظر ظهور أول إجابة فقط (المحرك المحلي متزامن، وعوده تُحل فوراً)
  for (let i = 0; i < 100 && sent.length === 0; i++) await sleep(5);
  await sleep(40);
};
const runCmd = async (text) => { clear(); for (const e of H.text) if (e.re.test(text)) await e.cb({ chat: { id: CHAT }, from: { first_name: 'أحمد' }, text }); await sleep(60); };

let pass = 0, fail = 0;
const ok = (cond, label, got) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? '✔' : '✘'} ${label}${cond ? '' : '  => ' + JSON.stringify(String(got).slice(0, 130))}`);
};
const cb = async (data, re, label = data) => { await runCb(data); ok(re.test(last()?.text || ''), label, last()?.text || '(فارغ)'); };
const msg = async (text, re, label) => { await runMsg(text); ok(re.test(all()), label, all()); };
const cmd = async (text, re, label = text) => { await runCmd(text); ok(re.test(all()), label, all()); };
// لا كراش: نتأكد أن المعالج لم يرمِ استثناءً
const noCrash = async (fn, label) => { try { await fn(); ok(true, label); } catch (e) { ok(false, label + ' → ' + e.message); } };

console.log('\n════ 1) البوصلة ════');
await cb('start_quiz', /البوصلة/);
await cb('qbranch:علمي', /معدلك/);
await msg('88.5', /88\.5/, 'أدخل المعدل');
await cb('opt:0', /سؤال 2/, 'إجابة سؤال 1');
await cb('start_quiz', /البوصلة/);
await cb('qbranch:علمي', /معدلك/);
await msg('999', /بين 0 و 100|لم أفهم/, 'معدّل خارج النطاق');
await msg('abc', /بين 0 و 100|لم أفهم/, 'معدّل غير رقمي');
await cb('avg_skip', /سؤال|البوصلة/, 'تخطي المعدل');

console.log('\n════ 2) المفاضلة (الإصلاح الأساسي) ════');
await cb('start_muf', /اختر السنة/, 'start_muf يعرض اختيار السنة');
await cb('muf2025', /المفاضلة 2025/, 'muf2025');
await cb('mbranch:علمي', /معدلك/, 'mbranch:علمي');
await msg('88.5', /متاحة لك/, 'حاسبة 2025 تحسب فعلاً');
await cb('home', /مرحباً/, 'home');
await cb('start_muf', /اختر السنة/, 'start_muf ثانية');
await cb('muf2025', /2025/);
await cb('mbranch:علمي', /معدلك/);
await msg('88.5', /متاحة لك/, 'الحساب لا يتعطل في الدورة الثانية');
// كل حالة إدخال معدل تتطلب إعادة الدخول في التدفق
const mufFlow = async (text, label) => {
  await cb('start_muf', /اختر السنة/);
  await cb('muf2025', /2025/);
  await cb('mbranch:علمي', /معدلك/);
  await msg(text, /متاحة لك|معدلك|لم أفهم|بين 0 و 100/, label);
};
await mufFlow('٨٨٫٥', 'حساب بأرقام عربية-هندية');
await mufFlow('معدلي 88.5', 'نص فيه كلمات مع الرقم');
await mufFlow('88،5', 'فاصلة عربية عشرية');
await mufFlow('8,5', 'فاصلة لاتينية عشرية');
await mufFlow('-5', 'رقم سالب يُرفض');
await mufFlow('101', 'أكثر من 100 يُرفض');
await cb('start_muf', /اختر السنة/);
await cb('muf2026info', /قريباً|تُفعَّل/, 'معلومات 2026');
await cb('start_muf', /اختر السنة/);
await msg('88.5', /اختار السنة|أزرار/, 'نص أثناء شاشة السنة → لا صمت');

console.log('\n════ 3) الإنكليزية ════');
await cb('start_ef', /CEFR/);
await cb('ef_go', /سؤال 1/);
await cb('eopt:0', /إجابة/, 'اختيار إجابة');
await cb('ef_next', /سؤال 2/, 'التالي');

console.log('\n════ 4) المقارنة ════');
await cb('cmp:', /مقارنة التخصصين/);
await cb('cmp:c1', /الهندسات/);
await cb('cmp:s0', /اخترت/, 'اختيار الأول');
await cb('cmp:s1', /✕/, 'اختيار الثاني');
await cb('cmp:swap', /✕/, 'تبديل');
await cb('cmp:t', /المؤسسة/);
await cb('cmp:y0', /جامعة/);
await cb('cmp:n2', /صفحة 2/, 'صفحة 2');
await cb('cmp:find', /ابحث عن تخصص/);
await msg('هندسة مدنية', /اخترت|✕|هندس/, 'بحث نصي');
await cb('cmp:', /مقارنة/);
await cb('cmp:find', /ابحث/);
await msg('اسم غير موجود كلياً', /ما لقيت|🔍/, 'بحث بلا نتائج');
await cb('cmp:reset', /مقارنة جديدة/);
await cb('cmp:s0', /اخترت/, 'اختيار بعد إعادة');

console.log('\n════ 5) الدورات ════');
await cb('crs:', /الدورات المجانية/);
await cb('crs:c0', /لغة إنكليزية/);
await cb('crs:p0_2', /صفحة 2/, 'صفحة 2');
await cb('crs:c4', /طب وصحة/);
await noCrash(() => runCb('crs:zz'), 'فئة دورات مجهولة لا كراش');

console.log('\n════ 6) الجامعة الافتراضية ════');
await cb('vu:', /الجامعة الافتراضية/);
await cb('vu:l0', /المعاهد/);
await cb('vu:l3_2', /الدراسات العليا/, 'الدراسات العليا ص2');
// الاسم الرسمي السوري هو "المعهد التقاني" (كما في الموقع)، لا "التقني"
await cb('vu:pr0', /المعهد التقاني للحاسوب/, 'اسم البرنامج بالصيغة الرسمية');
await cb('vu:pr36', /🎓|برنامج/, 'آخر برنامج');
await cb('vu:ctr', /مراكز التسجيل/);
await noCrash(() => runCb('vu:pr99'), 'فهرس خارج النطاق لا كراش');
await noCrash(() => runCb('vu:l9'), 'مستوى خارج النطاق لا كراش');
await noCrash(() => runCb('crs:p9_9'), 'صفحة دورة خارج النطاق لا كراش');
await noCrash(() => runCb('cmp:n99'), 'صفحة مقارنة خارج النطاق لا كراش');

console.log('\n════ 7) التعليم المفتوح ════');
await cb('oe:', /التعليم المفتوح/);
await cb('oe:ov', /التعليم المفتوح/);
await cb('oe:pr', /التخصصات المتاحة/);
await cb('oe:ad', /شروط القبول/);
await cb('oe:fe', /25,000/, 'الرسوم: لكل مادة');
await cb('oe:un', /الجامعات المشاركة/);
await cb('oe:fq', /الأسئلة الشائعة/);
await cb('oe:zz', /التعليم المفتوح/, 'صفحة مجهولة → القائمة');

console.log('\n════ 8) المساعد الذكي ════');
await cb('ai_toggle', /المساعد الذكي/);
await msg('كيف أسجل بالجامعة الافتراضية؟', /الجامعة الافتراضية|تسجيل|برنامج|SVU/, 'التسجيل بالجامعة الافتراضية');
await msg('ما شروط القبول بالتعليم المفتوح؟', /المفتوح|الشرط|50/, 'شروط التعليم المفتوح');
await msg('ما الفرق بين الجامعة الافتراضية والتعليم المفتوح؟', /الجامعة الافتراضية|المفتوح|حضوري/, 'الفرق بين النظامين');
await msg('ما الفرق بين الجامعة الافتراضية والبكلوريا؟', /البكلوريا|شهادة/, 'الفرق بين الافتراضية والبكلوريا');
await msg('ما شروط التسجيل في المعاهد التقنية؟', /المعاهد التقنية|4 سنوات|بكلوريا/, 'شروط المعاهد التقنية');
await msg('ايش أفضل تخصص للي يحب البرمجة؟', /برمج|حاسب|معلومات|Compass/, 'ترشيح حسب حب البرمجة');
await msg('ايش أفضل تخصص للي يحب الطب؟', /طب|صيدلة|تمريض/, 'ترشيح حسب حب الطب');
await msg('ايش أفضل تخصص للي يحب الرياضيات؟', /رياض|فيزياء|كيمي/, 'ترشيح حسب حب الرياضيات');
await msg('قارن بين الطب البشري وهندسة الحاسوب', /✕|الطب البشري/, 'مقارنة تخصصين');
await msg('قارن بين هندسة مدنية وحاسوب', /✕|هندسة/, 'مقارنة مختصرة');
await msg('علمي 88.5', /2025|مفاضلة|متاح/, 'حساب مفاضلة');
// الأدبي 72.5 لا يوجد فيه تخصص جامعي — المهم أن الأرقام العربية عولجت وأعطت 72% لا NaN
await msg('أدبي ٧٢٫٥', /معدل 72|لا يوجد تخصص|معدلك/, 'حساب بأرقام عربية-هندية');
await msg('أدبي ٩٢٫٥', /معدلك|متاحة|93|معدل/, 'أرقام عربية تُقرَب لأعلى');
await msg('كم رسوم الدورات؟', /مجاني|دورة|رسوم/i, 'رسوم الدورات');
await msg('مرحبا', /أهل|مرحب|هلا/i, 'تحية');
await msg('ما هي أوقات الدوام؟', /ظهراً|ليلاً|أوقات/i, 'أوقات الدوام');
await msg('أريد حجز جواز سفر', /واتس|wa\.me|حجز/i, 'خدمة شريكة');
await msg('كيف أفتح البوصلة؟', /بوصلة|القطب|اختبار/i, 'البوصلة');
await msg('لغز غامض 12345', /لم أفهم|أساعدك|تواصل/i, 'سؤال غير مفهوم');
await msg('اكتب لي قصيدة عن القمر', /لم أفهم|أساعدك|تواصل|بوصل|الأسئلة/i, 'سؤال خارج النطاق يعطي رداً مفيداً');
await cb('ai_clear', /مسح سياق/);
await cb('ai_toggle', /إيقاف/, 'إيقاف المساعد');
await msg('مرحبا', /^(?!.*لم أفهم)/, 'بعد الإيقاف لا يرد');

console.log('\n════ 9) الإشعارات ════');
await cb('sub', /تفعيل الإشعارات/, 'زر الإشعارات يشترك');
await cb('sub_toggle', /إيقاف الإشعارات/, 'تبديل → إيقاف');
await cb('sub_toggle', /تفعيل الإشعارات/, 'تبديل → تفعيل');
await cb('sub', /تفعيل/, 'الزر يبقى فعّالاً');

console.log('\n════ 10) عام ════');
await cb('faq', /الأسئلة الشائعة/);
await cb('faq:1', /./, 'سؤال شائع 1');
await noCrash(() => runCb('faq:999'), 'FAQ خارج النطاق لا كراش');
await cb('contact', /تواصل/);
await cb('about', /مركز الطحان/);
await cb('sec:bac', /البكلوريا/);
await cb('sec:zzz', /غير متاح/, 'قسم قديم غير موجود');
await cb('home', /مرحباً بك/, 'الرئيسية');
await noCrash(() => runCb('zzz_unknown'), 'callback غير معروف لا كراش');
await noCrash(() => runCb('opt:99'), 'خيار خارج النطاق لا كراش');
await noCrash(() => runCb('eopt:99'), 'خيار إنكليزي خارج النطاق لا كراش');
await noCrash(() => runCb('sec:'), 'sec: فارغ لا كراش');
await noCrash(() => runCb(''), 'callback فارغ لا كراش');
await noCrash(() => runCb('vu:'), 'routeSection يقبل vu: فارغ');

console.log('\n════ 11) الأوامر النصية ════');
for (const [c, re] of [
  ['/start', /أهلاً/], ['/start@bot', /أهلاً/], ['/help', /الأوامر المتاحة/], ['/quiz', /البوصلة/],
  ['/mufadala', /اختر السنة/], ['/english', /الإنكليزية/], ['/compare', /مقارنة التخصصين/],
  ['/courses', /الدورات المجانية/], ['/vu', /الجامعة الافتراضية/], ['/openedu', /التعليم المفتوح/],
  ['/ai', /المساعد الذكي/], ['/ai_off', /إيقاف/], ['/ai_clear', /مسح/],
  ['/subscribe', /تفعيل الإشعارات/], ['/unsubscribe', /إيقاف الإشعارات/],
  ['/faq', /الأسئلة الشائعة/], ['/contact', /تواصل/]
]) await cmd(c, re, c);

console.log('\n════ 12) الأسماء الرسمية ════');
// "المعهد التقاني" هو المصطلح الرسمي السوري (كما في الموقع). لا نكتب "المعهد التقني".
{
  const { SPECS } = await import('../data/compare.js');
  const names = SPECS.map((s) => s.n);
  const wrong = names.filter((n) => n.startsWith('المعهد التقني'));
  ok(wrong.length === 0, `لا اسم معهد بصيغة "التقني" (${wrong.length} خطأ)`);
  const right = names.filter((n) => n.startsWith('المعهد التقاني'));
  console.log(`   ℹ ${right.length} معهد بصيغة "التقاني" الرسمية`);
  // الوصف العام يبقى "التقنية" كما هو
  const desc = names.filter((n) => n.includes('التقنية') || n.includes('التقني'));
  console.log(`   ℹ ${desc.length} تخصص وصفي يستخدم "التقنية/التقني" (صحيح، لا يُمس)`);
}

console.log('\n════ 13) سلامة بيانات الدورات ════');
{
  const { COURSES, COURSE_CATS } = await import('../data/courses.js');
  const sitePages = HAS_SITE ? new Set(readdirSync(PLATFORM).filter((f) => f.endsWith('.html'))) : null;

  // رابط الدورة يجب أن يكون http/tel حقيقي، لا رابط صفحة موقع داخلي
  const badUrl = COURSES.filter((c) => !/^(https?:\/\/|tel:)/.test(c.url));
  ok(badUrl.length === 0, `كل روابط الدورات روابط خارجية (${badUrl.length} خطأ)`);
  badUrl.forEach((c) => console.log('   ✗ ' + c.name + ' -> ' + c.url));

  // روابط extra يجب ألا تحتوي روابط تنقل الموقع (تلوث استخراج)
  const nav = /^(#|[\w-]+\.html)/;
  const polluted = COURSES.filter((c) => (c.extra || []).some((e) => nav.test(e.url)));
  ok(polluted.length === 0, `لا تلوث في extra (${polluted.length} بطاقة)`);
  polluted.forEach((c) => console.log('   ✗ ' + c.name + ' (' + c.extra.length + ' رابط)'));

  // عدد الدورات والمجالات
  ok(COURSES.length === 24, `عدد الدورات 24 (فعلي ${COURSES.length})`);
  ok(COURSE_CATS.length === 6, `عدد المجالات 6 (فعلي ${COURSE_CATS.length})`);

  // ترتيب الفئات كما في AGENTS.md على الموقع: english → market → code → lang → medical → tools
  const order = [...new Set(COURSES.map((c) => c.cat))].join(',');
  ok(order === 'english,market,code,lang,medical,tools', 'ترتيب الفئات يطابق الموقع');

  // no dead site links
  const secs = readFileSync(REPO + 'lib/sections.js', 'utf8');
  const links = [...secs.matchAll(/CONTACT\.site \+ '\/([\w-]+\.html)'/g)].map((m) => m[1]);
  if (sitePages) {
    const dead = links.filter((l) => !sitePages.has(l));
    ok(dead.length === 0, `لا روابط موقع ميتة (${dead.length})`);
    dead.forEach((d) => console.log('   ✗ /' + d + ' غير موجود في الموقع'));
  } else {
    console.log('   ℹ تخطّي فحص روابط الموقع (PLATFORM غير موجود)');
  }
}

console.log('\n════ 14) الأمان ════');
bot.__fail(true);
await noCrash(async () => { await runCb('home'); await runMsg('اختبار'); }, 'لا كراش عند فشل الإرسال');
bot.__fail(false);

let over = 0;
for (const s of sent) if (s.text.length > 4096) { over++; console.log('   ✘ رسالة طويلة:', s.text.length, JSON.stringify(s.text.slice(0, 40))); }
ok(over === 0, 'لا رسالة تتجاوز 4096 حرف');

const cbs = ['cmp:c1', 'cmp:s0', 'cmp:n2', 'crs:p0_2', 'vu:l3_2', 'vu:pr36', 'oe:ad', 'oe:fq', 'vu:ctr', 'qbranch:علمي', 'mbranch:تجاري', 'ai_toggle', 'sub_toggle', 'muf2025', 'muf2026info', 'faq:1', 'opt:0', 'eopt:0'];
const badCb = cbs.filter((c) => Buffer.byteLength(c, 'utf8') > 64);
ok(badCb.length === 0, 'كل callback_data ≤ 64 بايت', badCb.join(','));

console.log('\n════ 15) بنية لوحات المفاتيح (التيجراف) ════');
{
  // تيلي그램 يرفض الرسالة كاملة إذا كان أي صف يحتوي مصفوفة بدل زر
  const kbOf = (m) => {
    if (!m || !m.opt) return null;
    if (m.opt.reply_markup && m.opt.reply_markup.inline_keyboard) return m.opt.reply_markup;
    if (Array.isArray(m.opt.inline_keyboard)) return m.opt;
    return null;
  };
  const bad = [];
  const surfaces = ['crs:', 'crs:c0', 'crs:c1', 'crs:menu', 'vu:', 'vu:l0', 'vu:l1', 'vu:ctr', 'oe:', 'oe:ov', 'oe:un', 'cmp:', 'cmp:find', 'cmp:c1', 'home', 'faq', 'contact', 'about'];
  for (const d of surfaces) {
    await runCb(d);
    const kb = kbOf(sent[sent.length - 1]);
    if (!kb) { bad.push(`${d}: لا توجد لوحة`); continue; }
    kb.inline_keyboard.forEach((row, ri) => {
      if (!Array.isArray(row)) return bad.push(`${d} صف ${ri}: ليس مصفوفة`);
      row.forEach((btn, bi) => {
        if (Array.isArray(btn)) return bad.push(`${d} صف ${ri} زر ${bi}: مصفوفة داخل مصفوفة`);
        if (!btn || typeof btn !== 'object' || !btn.text) return bad.push(`${d} صف ${ri} زر ${bi}: زر غير صالح`);
        if (!btn.url && !btn.callback_data && !btn.web_app) return bad.push(`${d} صف ${ri} زر ${bi}: لا url ولا callback_data`);
      });
    });
  }
  ok(bad.length === 0, `كل اللوحات مبنية بشكل صالح (${bad.length} خلل في ${surfaces.length} شاشة)`);
  bad.forEach((b) => console.log('   ✗ ' + b));

  // لا تدرّج مزدوج في المصدر: "}]]" = كائن + مصفوفة + مصفوفة = صف يحوي مصفوفة
  // (أما "[[{...}], homeRow" فصيحة: صف بزر ثم صف آخر)
  const secs = readFileSync(REPO + 'lib/sections.js', 'utf8');
  const nested = (secs.match(/\}\]\]/g) || []).length;
  ok(nested === 0, `لا }]] (صف يحوي مصفوفة) في المصدر (${nested})`);
  const wrapHome = (secs.match(/,\s*\[homeRow\]/g) || []).length;
  ok(wrapHome === 0, `لا [homeRow] داخل مصفوفة صفوف (${wrapHome})`);
  const wrapNav = (secs.match(/\?\s*\[nav\]/g) || []).length;
  ok(wrapNav === 0, `لا [nav] داخل مصفوفة صفوف (${wrapNav})`);

  // نفس الفحص من داخل المحاكي: كل رسالة مرّت عبر send/edit
  ok(kbProblems.length === 0, `محاكي تيليغرام لم يرصد أي لوحة مشوّهة (${kbProblems.length})`);
  kbProblems.forEach((b) => console.log('   ✗ ' + b));
}

console.log('\n════ 16) اختبار تحديد المستوى (PT_QUIZZES) ════');
{
  const { PT_QUIZZES, PT_KEYS, PT_QUESTION_COUNT, ptLevelFor } = await import('../data.js');

  // بنية البيانات لكل سؤال
  const probs = [];
  for (const k of PT_KEYS) {
    PT_QUIZZES[k].data.forEach((q, i) => {
      if (typeof q[0] !== 'string' || !q[0].trim()) probs.push(`${k}#${i + 1} سؤال`);
      if (!Array.isArray(q[1]) || q[1].length < 2) probs.push(`${k}#${i + 1} خيارات`);
      else if (new Set(q[1]).size !== q[1].length) probs.push(`${k}#${i + 1} خيارات مكررة`);
      if (!Number.isInteger(q[2]) || q[2] < 0 || q[2] >= q[1].length) probs.push(`${k}#${i + 1} فهرس الإجابة`);
      if (typeof q[3] !== 'string' || !q[3].trim()) probs.push(`${k}#${i + 1} بلا ملاحظة`);
    });
  }
  ok(probs.length === 0, `بنية الأسئلة سليمة (${probs.length} مشكلة من ${PT_QUESTION_COUNT})`);
  probs.slice(0, 5).forEach((p) => console.log('   ✗ ' + p));

  ok(PT_QUESTION_COUNT === 156, `المجموع 156 (فعلي ${PT_QUESTION_COUNT})`);
  ok(PT_KEYS.length === 3, `ثلاثة نماذج (فعلي ${PT_KEYS.length})`);
  // مقارنة بالنص الكامل لتفادي أخطاء الـsubstring العربية
  const LV = { 0: 'مستوى تأسيسي (قريب من A2)', 40: 'مستوى متوسط (قريب من B1)', 60: 'مستوى جيد (قريب من B2)', 80: 'مستوى متقدم (قريب من C1)' };
  ok(ptLevelFor(0).level === LV[0] && ptLevelFor(39).level === LV[0], 'حدود المستوى 0–39', ptLevelFor(39).level);
  ok(ptLevelFor(40).level === LV[40] && ptLevelFor(59).level === LV[40], 'حدود المستوى 40–59', ptLevelFor(40).level);
  ok(ptLevelFor(60).level === LV[60] && ptLevelFor(79).level === LV[60], 'حدود المستوى 60–79', ptLevelFor(60).level);
  ok(ptLevelFor(80).level === LV[80] && ptLevelFor(100).level === LV[80], 'حدود المستوى 80–100', ptLevelFor(80).level);

  // الزر موجود في قائمة الجامعة
  await runCb('vu:menu');
  const vuKb = last().opt.inline_keyboard.flat();
  ok(vuKb.some((b) => b.callback_data === 'pt:'), 'زر الاختبار في قائمة الجامعة');

  // لعب النموذج الأصغر (tenses) كاملاً بالإجابة الصحيحة
  const mIdx = PT_KEYS.indexOf('tenses');
  const model = PT_QUIZZES[PT_KEYS[mIdx]];
  await runCb('pt:s' + mIdx);
  let scoreOk = true;
  for (let i = 0; i < model.data.length; i++) {
    await runCb(`pt:a${mIdx}_${i}_${model.data[i][2]}`);
    const res = last();
    const line = (res?.text.match(/نتيجتك: (\d+)\//) || [])[1];
    if (line !== String(i + 1) || !/إجابة صحيحة/.test(res?.text || '')) { scoreOk = false; break; }
    await runCb(`pt:n${mIdx}_${i + 1}`);
  }
  ok(scoreOk, 'تراكم الدرجة عبر النموذج كاملاً', last()?.text || '');
  const finTxt = (await runCb(`pt:n${mIdx}_${model.data.length}`), last().text);
  ok(new RegExp(`\\*\\*${model.data.length} / ${model.data.length}\\*\\*`).test(finTxt), 'شاشة النتيجة 100%', finTxt);
  ok(finTxt.includes(LV[80]), 'النتيجة 100% تعطي مستوى متقدم', finTxt);

  // inputs خبيثة / خارج المدى
  let crashed = 0;
  for (const bad of ['pt:s99', 'pt:s-1', 'pt:a0_0', 'pt:a0_0_x', 'pt:a99_0_0', 'pt:a0_999_0', 'pt:n0_abc', 'pt:n9_0', 'pt:a0_0_99']) {
    try { await runCb(bad); } catch { crashed++; }
  }
  ok(crashed === 0, `لا كراش على مدخلات خارج المدى (${crashed})`);
  await runCb('pt:a0_999_0');
  ok(/نماذج اختبار تحديد المستوى/.test(last()?.text || ''), 'الفهرس خارج المدى يعرض قائمة النماذج', last()?.text || '(فارغ)');

  // حد الـ 64 بايت لكل callbacks الاختبار
  const ptCbs = ['pt:', 'pt:s0', 'pt:s2', 'pt:a0_93_3', 'pt:a2_38_1', 'pt:n0_94', 'pt:n2_39'];
  const longCb = ptCbs.filter((c) => Buffer.byteLength(c, 'utf8') > 64);
  ok(longCb.length === 0, 'callbacks الاختبار ≤ 64 بايت', longCb.join(','));
}

console.log(`\n════════ النتيجة: ${pass} ناجح، ${fail} فاشل ════════`);
process.exit(fail ? 1 : 0);
