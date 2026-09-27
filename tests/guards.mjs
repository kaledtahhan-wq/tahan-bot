// negative test: proves the guards actually catch the two bug classes we fixed
// (double-wrapped rows, oversized callback_data) instead of silently passing.
import { sent, kbProblems, default as MockBot } from './mock-tg.mjs';

let fails = 0;
const ok = (c, label) => { if (!c) fails++; console.log(`${c ? '✔' : '✘'} ${label}`); };
const reset = () => { sent.length = 0; kbProblems.length = 0; };

const bot = new MockBot('1:x', {});

// 1) الصف المزدوج — وهو الخلل الذي أفسد 20 زراً سابقاً
reset();
await bot.sendMessage(1, 'اختبار', { inline_keyboard: [[{ text: 'أ', callback_data: 'a' }], [[{ text: 'ب', callback_data: 'b' }]]] });
ok(kbProblems.length === 1, `يرصد الصف المزدوج (${kbProblems.length})`);
ok(/مصفوفة داخل مصفوفة/.test(kbProblems[0] || ''), `السبب صحيح: ${kbProblems[0] || '(فارغ)'}`);

// 2) homeRow مُغلَّفة — [homeRow] بدل homeRow
reset();
const homeRow = [{ text: '🏠', callback_data: 'home' }];
await bot.editMessageText('اختبار', { inline_keyboard: [homeRow, [homeRow]] });
ok(kbProblems.length === 1, `يرصد [homeRow] داخل مصفوفة (${kbProblems.length})`);

// 3) الصيغة السليمة يجب أن تمر بلا ملاحظات
//    صف بزر واحد = [btn]، وصف بزرين = [btn, btn] — لا [ [btn] ]
reset();
await bot.sendMessage(1, 'سليم', { inline_keyboard: [homeRow, [{ text: 'أ', callback_data: 'a' }, { text: 'ب', callback_data: 'b' }]] });
ok(kbProblems.length === 0, `لا إنذار على الصيغة السليمة (${kbProblems.length}) ${kbProblems[0] || ''}`);

// 4) الصيغة التي أصلحناها يدوياً: [[{...}], homeRow] صالحة
reset();
await bot.sendMessage(1, 'صالح', { inline_keyboard: [[{ text: '🎓 القائمة', callback_data: 'vu:menu' }], homeRow] });
ok(kbProblems.length === 0, `[[{...}], homeRow] صالحة (${kbProblems.length})`);

// 5) reply_markup صيغة تيليغرام الرسمية
reset();
await bot.sendMessage(1, 'صالح', { reply_markup: { inline_keyboard: [homeRow] } });
ok(kbProblems.length === 0, `reply_markup صالحة (${kbProblems.length})`);

// 6) callback_data أكبر من 64 بايت
reset();
await bot.sendMessage(1, 'كبير', { inline_keyboard: [[{ text: 'طويل', callback_data: 'x'.repeat(65) }]] });
ok(kbProblems.some((p) => /callback_data 65 بايت/.test(p)), `يرصد callback_data = 65 بايت`);

// 7) 64 بايت بالضبط يجب أن يمر
reset();
await bot.sendMessage(1, 'حدي', { inline_keyboard: [[{ text: 'حدي', callback_data: 'x'.repeat(64) }]] });
ok(kbProblems.length === 0, `64 بايت بالضبط يمر (${kbProblems.length})`);

// 8) زر بلا نص أو بلا وجهة
reset();
await bot.sendMessage(1, 'ناقص', { inline_keyboard: [[{ callback_data: 'x' }], [{ text: 'بلا وجهة' }]] });
ok(kbProblems.length === 2, `يرصد الزر بلا نص/بلا وجهة (${kbProblems.length})`);

// 9) inline_keyboard ليس مصفوفة
reset();
await bot.sendMessage(1, 'خطأ', { inline_keyboard: { '0': [] } });
ok(kbProblems.length === 1, `يرصد inline_keyboard غير مصفوفة (${kbProblems.length})`);

// 10) حد 4096 حرف
reset();
const sentBefore = sent.length;
await bot.sendMessage(1, 'ط'.repeat(4096), {});
ok(sent.length === sentBefore + 1, 'رسالة 4096 حرف تُرسل');
reset();
await bot.sendMessage(1, 'ط'.repeat(4097), {});
ok(sent.length === 1, 'رسالة 4097 حرف تُرصد ولا تُرسل');

console.log(fails ? `\n✘ فشل ${fails}` : '\n✔ حُرّاس المحاكي تعمل');
process.exit(fails ? 1 : 0);
