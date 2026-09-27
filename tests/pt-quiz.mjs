// لعبة النماذج الثلاثة كاملة (156 سؤالاً) — كل نموذج 100% ثم 0%
//   npm run test:pt
//
// تشغيل:  node --import ./tests/register.mjs tests/pt-quiz.mjs

process.env.BOT_TOKEN = process.env.BOT_TOKEN || '123:FAKE';
process.env.ANNOUNCE_POLL_MS = '3600000';
delete process.env.AI_API_KEY;
const { sent, kbProblems } = await import('./mock-tg.mjs');
const { bot } = await import('../bot.js');
const { PT_QUIZZES, PT_KEYS, ptLevelFor } = await import('../data.js');
const H = bot.__handlers();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clear = () => { sent.length = 0; };
const runCb = async (d) => {
  await sleep(810); clear();
  for (const h of H.callback_query) await h({ id: 'q' + Math.random(), data: d, message: { message_id: 77, chat: { id: 555 } } });
  return sent[sent.length - 1];
};
const kbOf = (m) => (m && m.opt && (m.opt.reply_markup?.inline_keyboard || m.opt.inline_keyboard)) || [];

let fails = 0;
const ok = (c, label, extra) => { console.log(`${c ? '✔' : '✘'} ${label}${extra ? '  ' + extra : ''}`); if (!c) fails++; };

// ---------- 1) لعب كل نموذج بإجابات صحيحة بالكامل ----------
for (let m = 0; m < PT_KEYS.length; m++) {
  const model = PT_QUIZZES[PT_KEYS[m]];
  const total = model.data.length;
  await runCb('pt:s' + m);

  for (let i = 0; i < total; i++) {
    const q = model.data[i];
    const res = await runCb(`pt:a${m}_${i}_${q[2]}`);          // نجيب الصحيح دائماً
    const scoreLine = (res.text.match(/نتيجتك: (\d+)\/(\d+)/) || [])[1];
    if (scoreLine !== String(i + 1)) {
      ok(false, `${PT_KEYS[m]} سؤال ${i + 1}: النتيجة ${scoreLine} متوقع ${i + 1}`);
      break;
    }
    if (!/إجابة صحيحة/.test(res.text)) { ok(false, `${PT_KEYS[m]}#${i + 1}: لم يُعلَن صحيح`); break; }
    const next = kbOf(res).flat().find((b) => (b.callback_data || '').startsWith('pt:n'));
    if (!next) { ok(false, `${PT_KEYS[m]}#${i + 1}: لا زر التالي`); break; }
    await runCb(next.callback_data);
  }
  // شاشة النتيجة
  const last = await runCb(`pt:n${m}_${total}`);
  ok(new RegExp(`\\*\\*${total} / ${total}\\*\\*  \\(100%\\)`).test(last.text), `${PT_KEYS[m]}: النتيجة 100%`, last.text.split('\n').find((l) => l.includes('/')) || '');
  ok(/مستوى متقدم/.test(last.text), `${PT_KEYS[m]}: المستوى متقدم`);
}

// ---------- 2) لعب النموذج 2全是 خطأ → 0% ----------
{
  const m = 1, model = PT_QUIZZES[PT_KEYS[m]], total = model.data.length;
  await runCb('pt:s' + m);
  for (let i = 0; i < total; i++) {
    const q = model.data[i];
    const wrong = (q[2] + 1) % q[1].length;                    // نختار خياراً خاطئاً
    const res = await runCb(`pt:a${m}_${i}_${wrong}`);
    if (!/إجابة غير دقيقة/.test(res.text)) { ok(false, `سؤال ${i + 1}: لم يُعلَن خطأ`); break; }
    if (!res.text.includes('✅ الصحيحة')) { ok(false, `سؤال ${i + 1}: لا تُعرض الصحيحة`); break; }
    await runCb(`pt:n${m}_${i + 1}`);
  }
  const last = await runCb(`pt:n${m}_${total}`);
  ok(/\*\*0 \/ 23\*\*  \(0%\)/.test(last.text), 'tenses: النتيجة 0%');
  ok(/مستوى تأسيسي/.test(last.text), 'tenses: المستوى تأسيسي');
}

// ---------- 3) مستوى الجوار عند الحدود ----------
{
  await runCb('pt:s0');
  // نضبط الدرجة يدوياً عبر الحالة غير ممكن؛ نتحقق من ptLevelFor وحدوده
  ok(ptLevelFor(0).level.includes('تأسيسي'), 'ptLevelFor(0) تأسيسي');
  ok(ptLevelFor(39).level.includes('تأسيسي'), 'ptLevelFor(39) تأسيسي');
  ok(ptLevelFor(40).level.includes('متوسط'), 'ptLevelFor(40) متوسط');
  ok(ptLevelFor(59).level.includes('متوسط'), 'ptLevelFor(59) متوسط');
  ok(ptLevelFor(60).level.includes('جيد'), 'ptLevelFor(60) جيد');
  ok(ptLevelFor(79).level.includes('جيد'), 'ptLevelFor(79) جيد');
  ok(ptLevelFor(80).level.includes('متقدم'), 'ptLevelFor(80) متقدم');
  ok(ptLevelFor(100).level.includes('متقدم'), 'ptLevelFor(100) متقدم');
}

// ---------- 4) تبديل النموذج يصفّر الدرجة ----------
{
  await runCb('pt:s0');
  await runCb('pt:a0_0_2');               // صحيحة → 1
  const m1 = await runCb('pt:s1');       // تبديل
  ok(/نتيجتك: 0\/23/.test(m1.text), 'تبديل النموذج يصفّر الدرجة', (m1.text.match(/نتيجتك: \d+\/\d+/) || [])[0] || '');
  const back = await runCb('pt:s0');
  ok(/نتيجتك: 0\/94/.test(back.text), 'العودة للنموذج الأول تصفّر أيضاً');
}

// ---------- 5) حماية من المدخلات الخبيثة ----------
{
  for (const bad of ['pt:s99', 'pt:s-1', 'pt:a0_0', 'pt:a0_0_x', 'pt:a99_0_0', 'pt:a0_999_0', 'pt:n0_abc', 'pt:n9_0', 'pt:a0_0_99']) {
    let res = null;
    try { res = await runCb(bad); } catch (e) { ok(false, `${bad} رمى استثناء: ${e.message}`); continue; }
    ok(!!res, `${bad}: تعامل بدون كراش`);
  }
  // مؤشرات خارج المدى تعرض القائمة لا سؤالاً
  const oob = await runCb('pt:a0_999_0');
  ok(/نماذج اختبار تحديد المستوى/.test(oob.text), 'سؤال خارج المدى يعرض قائمة النماذج');
  const oobM = await runCb('pt:s99');
  ok(/نماذج اختبار تحديد المستوى/.test(oobM.text), 'نموذج خارج المدى يعرض قائمة النماذج');
}

// ---------- 6) حدود callback_data ----------
{
  const cbs = ['pt:', 'pt:s0', 'pt:s2', 'pt:a0_93_3', 'pt:a2_38_1', 'pt:n0_94', 'pt:n2_39'];
  const bad = cbs.filter((c) => Buffer.byteLength(c, 'utf8') > 64);
  ok(bad.length === 0, 'كل callback_data في الاختبار ≤ 64 بايت', bad.join(','));
}

// ---------- 7) لوحات المفاتيح全程 ----------
// كل رسالة في هذه المجموعة مرّت عبر المحاكي، وهو يرصد الصفوف غير المسطّحة
ok(kbProblems.length === 0, `محاكي تيليغرام: 0 لوحة مشوّهة خلال 156 سؤالاً (${kbProblems.length})`);
kbProblems.slice(0, 8).forEach((b) => console.log('   ✗ ' + b));

console.log(fails ? `\n✘ فشل ${fails}` : '\n✔ كل فحوص PT نجحت');
process.exit(fails ? 1 : 0);
