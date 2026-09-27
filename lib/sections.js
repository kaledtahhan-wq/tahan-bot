// ═══════════════════════════════════════════════════════════════
// واجهات الأقسام: مقارنة التخصصين · الدورات المجانية ·
// الجامعة الافتراضية · التعليم المفتوح
//
// كل معالج يتسلّم io = { chatId, msgId, s, say(text, keyboard) }
// ويُعيد true إذا تعامل مع الطلب و false ليمرّره لغيره.
// ═══════════════════════════════════════════════════════════════

import {
  CONTACT,
  COURSE_CATS, COURSE_COUNT, COURSE_CAT_COUNT, COURSE_PRICE, coursesByCat,
  SVU_LEVELS, SVU_PROGRAMS, SVU_CENTERS_SYRIA, SVU_CENTERS_ABROAD, SVU_CENTER_COUNT, SVU_SITE,
  OPEN_EDU, OPEN_EDU_FEE, OPEN_EDU_PROGRAMS, OPEN_EDU_CONDITIONS, OPEN_EDU_UNIVERSITIES, OPEN_EDU_FAQ,
  SPECS, SPEC_CATS, SPEC_TYPES, SPEC_TYPE_LABEL, specsByCat, specsByType
} from '../data.js';

const PER_PAGE = 5;
const MAX_MSG = 4000;
const homeRow = [{ text: '🏠 الرئيسية', callback_data: 'home' }];
function listRows(rows) {
  return rows.filter((r) => r.length);
}

// صفحات قائمة المقارنة
const cmpNav = (list, page) => {
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  if (pages <= 1) return null;
  const nav = [];
  if (page > 1) nav.push({ text: '▶️ السابق', callback_data: 'cmp:n' + (page - 1) });
  if (page < pages) nav.push({ text: `التالي ◀️ (${page}/${pages})`, callback_data: 'cmp:n' + (page + 1) });
  return nav.length ? nav : null;
};

// ═══════════════ مقارنة التخصصين ═══════════════
const CMP_MENU_TEXT = [
  '⚖️ **مقارنة التخصصين**',
  '',
  `الدليل فيه ${SPECS.length} تخصصاً. اختر تخصصين لتظهر المقارنة جنباً إلى جنب.`,
  '',
  '**كيف تبدأ؟**',
  '• 🔍 بحث بالاسم — أرسل اسم التخصص كنص عادي',
  '• 🗂️ تصفح حسب المجال',
  '• 🏛️ تصفح حسب المؤسسة'
].join('\n');

const cmpKeyboard = () => ({
  inline_keyboard: listRows([
    [[{ text: '🔍 بحث بالاسم', callback_data: 'cmp:find' }]],
    ...chunk(SPEC_CATS.map((c, i) => ({ text: clip(c, 22), callback_data: 'cmp:c' + i })), 2),
    [[{ text: '🏛️ حسب المؤسسة', callback_data: 'cmp:t' }]],
    [homeRow]
  ])
});

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function clip(text, max) {
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

function specRows(list, prefix) {
  return list.map((s, i) => [{ text: `${i + 1}. ${clip(s.n, 34)}`, callback_data: prefix + i }]);
}

const listKeyboard = (list, prefix, nav) => ({
  inline_keyboard: listRows([...specRows(list, prefix), nav ? [nav] : [], [homeRow]])
});
const listText = (list, title) =>
  [`🗂️ **${title}**`, '', `${list.length} تخصص.`, '', list.map((s, i) => `${i + 1}. ${s.n}`).join('\n'), '', 'اضغط على اسم التخصص لاختياره.'].join('\n');

const specDetail = (s) =>
  [
    `🎓 **${s.n}**`,
    '',
    `🏛️ المؤسسة: ${SPEC_TYPE_LABEL[s.t] || s.t}`,
    `🗂️ المجال: ${s.c}`,
    `⏱️ المدة: ${s.d}`,
    '',
    `💡 **يناسبك إذا:** ${s.f}`
  ].join('\n');

const pairText = (a, b) => {
  const rows = [
    ['المؤسسة', SPEC_TYPE_LABEL[a.t] || a.t, SPEC_TYPE_LABEL[b.t] || b.t],
    ['المجال', a.c, b.c],
    ['المدة', a.d, b.d],
    ['يناسبك إذا', a.f, b.f]
  ];
  const out = [`⚖️ **${a.n}**  ✕  **${b.n}**`, ''];
  for (const [k, x, y] of rows) out.push(`**${k}**`, `• الأول: ${x}`, `• الثاني: ${y}`, '');
  out.push('للمزيد افتح دليل التخصصات على موقع المركز.');
  return out.join('\n');
};

const pairKeyboard = () => ({
  inline_keyboard: [
    [
      { text: '🔄 تبديل الترتيب', callback_data: 'cmp:swap' },
      { text: '🆕 مقارنة جديدة', callback_data: 'cmp:reset' }
    ],
    [{ text: '🌐 دليل التخصصات', url: CONTACT.site + '/guides.html' }],
    [homeRow]
  ]
});

export function cmpMenu(io) {
  io.s.step = 'idle';
  io.say(CMP_MENU_TEXT, cmpKeyboard());
}

export function cmpFindPrompt(io) {
  io.s.step = 'cmp_search';
  io.say('🔍 **ابحث عن تخصص**\n\nأرسل اسم التخصص كنص عادي، مثال: «هندسة مدنية».', { inline_keyboard: [homeRow] });
}

export function cmpShowList(io, list, title, page = 1, notice = '') {
  const s = io.s;
  s.cmpList = list;
  s.cmpTitle = title;
  s.step = 'idle';
  if (!list.length) {
    io.say(`🔍 ما لقيت «${s.cmpQuery || ''}» 🤔\n\nجرّب كلمة أقصر، أو تصفّح الدليل حسب المجال.`, cmpKeyboard());
    return;
  }
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const p = Math.min(Math.max(1, page), pages);
  s.cmpPage = p;
  const slice = list.slice((p - 1) * PER_PAGE, p * PER_PAGE);
  const text = [
    ...(notice ? [notice, ''] : []),
    `🗂️ **${title}**`,
    '',
    `${list.length} تخصص${pages > 1 ? ` · صفحة ${p} من ${pages}` : ''}.`,
    '',
    slice.map((sp, i) => `${(p - 1) * PER_PAGE + i + 1}. ${sp.n}`).join('\n'),
    '',
    'اضغط على اسم التخصص لاختياره.'
  ].join('\n');
  const nav = cmpNav(list, p);
  const rows = slice.map((sp, i) => [{ text: `${(p - 1) * PER_PAGE + i + 1}. ${clip(sp.n, 34)}`, callback_data: 'cmp:s' + ((p - 1) * PER_PAGE + i) }]);
  io.say(text, { inline_keyboard: listRows([...rows, nav ? [nav] : [], [homeRow]]) });
}

// عند اختيار التخصص الأول نعيد عرض القائمة نفسها لاختيار الثاني
function cmpContinueList(io, firstName) {
  const s = io.s;
  const list = s.cmpList && s.cmpList.length ? s.cmpList : SPECS;
  cmpShowList(io, list, s.cmpTitle || 'الاختصاصات', s.cmpPage || 1, `✅ اخترت: **${firstName}**\n👉 اختر الآن التخصص الثاني لإظهار المقارنة.`);
}

export function cmpShowSpec(io, name) {
  const s = io.s;
  const found = SPECS.find((x) => x.n === name);
  if (!found) return;
  if (!s.cmpPick) {
    s.cmpPick = name;
    io.say(
      `✅ اخترت: **${name}**\n\n${specDetail(found)}\n\n👉 اختر الآن التخصص الثاني من القائمة لأسألك المقارنة.`,
      { inline_keyboard: listRows([[{ text: '🆕 إلغاء الاختيار', callback_data: 'cmp:reset' }], [homeRow]]) }
    );
    return;
  }
  if (s.cmpPick === name) {
    io.say(`ℹ️ اخترت **${name}** مرتين.\n\nاختر تخصصاً مختلفاً من القائمة.`, {
      inline_keyboard: listRows([[{ text: '🆕 إلغاء الاختيار', callback_data: 'cmp:reset' }], [homeRow]])
    });
    return;
  }
  const other = SPECS.find((x) => x.n === s.cmpPick);
  s.cmpA = other.n;
  s.cmpB = found.n;
  io.say(pairText(other, found), pairKeyboard());
}

export function cmpReset(io) {
  io.s.cmpPick = null;
  io.s.cmpA = null;
  io.s.cmpB = null;
  io.say('🆕 **مقارنة جديدة**\n\nكيف تبدأ؟', cmpKeyboard());
}

export function cmpSwap(io) {
  const s = io.s;
  const a = SPECS.find((x) => x.n === s.cmpA);
  const b = SPECS.find((x) => x.n === s.cmpB);
  if (!a || !b) {
    io.say('ℹ️ ما في مقارنة محفوظة. ابدأ مقارنة جديدة.', cmpKeyboard());
    return;
  }
  s.cmpA = b.n;
  s.cmpB = a.n;
  io.say(pairText(b, a), pairKeyboard());
}

// ═══════════════ الدورات المجانية ═══════════════
const coursesMenuText = () =>
  [
    '🆓 **الدورات المجانية**',
    '',
    `${COURSE_COUNT} دورة مجانية بالكامل، بتكلفة ${COURSE_PRICE}.`,
    `موزعة على ${COURSE_CAT_COUNT} مجالات:`,
    '',
    COURSE_CATS.map((c) => `${c.icon} **${c.name}** — ${coursesByCat(c.id).length} دورة`).join('\n'),
    '',
    'اضغط أي مجال لعرض دوراته وروابطها.'
  ].join('\n');

const coursesMenuKeyboard = () => ({
  inline_keyboard: listRows([...chunk(COURSE_CATS.map((c, i) => ({ text: `${c.icon} ${c.name} (${coursesByCat(c.id).length})`, callback_data: 'crs:c' + i })), 2), [homeRow]])
});

function coursesPage(cat, page) {
  const all = coursesByCat(cat.id);
  const pages = Math.max(1, Math.ceil(all.length / PER_PAGE));
  const p = Math.min(Math.max(1, page), pages);
  const slice = all.slice((p - 1) * PER_PAGE, p * PER_PAGE);
  const text = [
    `🆓 **${cat.icon} ${cat.name}** — ${all.length} دورة`,
    '',
    `صفحة ${p} من ${pages}`,
    '',
    slice
      .map((c, i) => `${(p - 1) * PER_PAGE + i + 1}. **${c.name}**\n    المنصة: ${c.plat}\n    ${c.desc}`)
      .join('\n\n')
  ].join('\n');
  return { text, slice, p, pages, idx: COURSE_CATS.indexOf(cat) };
}

function coursesKeyboard(v) {
  const rows = v.slice.map((c, i) => [{ text: `🔗 ${(v.p - 1) * PER_PAGE + i + 1}. ${clip(c.name, 32)}`, url: c.url }]);
  const nav = [];
  if (v.p > 1) nav.push({ text: '▶️ السابق', callback_data: `crs:p${v.idx}_${v.p - 1}` });
  if (v.p < v.pages) nav.push({ text: 'التالي ◀️', callback_data: `crs:p${v.idx}_${v.p + 1}` });
  return {
    inline_keyboard: listRows([...rows, nav.length ? [nav] : [], [{ text: '🗂️ كل المجالات', callback_data: 'crs:menu' }], [homeRow]])
  };
}

// ═══════════════ الجامعة الافتراضية ═══════════════
const vuMenuText = () =>
  [
    '🎓 **الجامعة الافتراضية السورية**',
    '',
    `${SVU_PROGRAMS.length} برنامجاً دراسياً، و${SVU_CENTER_COUNT} مركز تسجيل معتمد.`,
    '',
    ...SVU_LEVELS.map((l) => `${l.icon} **${l.name}** — ${SVU_PROGRAMS.filter((p) => p.level === l.id).length} برنامج`),
    '',
    `الموقع الرسمي: ${SVU_SITE}`
  ].join('\n');

const vuMenuKeyboard = () => ({
  inline_keyboard: listRows([
    ...SVU_LEVELS.map((l) => [{ text: `${l.icon} ${l.name}`, callback_data: 'vu:l' + SVU_LEVELS.indexOf(l) }]),
    [{ text: '📍 مراكز التسجيل', callback_data: 'vu:ctr' }],
    [homeRow]
  ])
});

function vuPage(level, page) {
  const all = SVU_PROGRAMS.filter((p) => p.level === level.id);
  const pages = Math.max(1, Math.ceil(all.length / PER_PAGE));
  const p = Math.min(Math.max(1, page), pages);
  const slice = all.slice((p - 1) * PER_PAGE, p * PER_PAGE);
  const text = [
    `${level.icon} **${level.name}** — ${all.length} برنامج`,
    '',
    `صفحة ${p} من ${pages}`,
    '',
    slice.map((c, i) => `${(p - 1) * PER_PAGE + i + 1}. **${c.name}** \`${c.code}\`\n    ${c.specs}\n    ${c.duration} · ${c.feeCourse}`).join('\n\n')
  ].join('\n');
  return { text, slice, p, pages, base: 'vu:l' + SVU_LEVELS.indexOf(level) };
}

const vuPageKeyboard = (v) => {
  const rows = v.slice.map((c, i) => [{ text: `${(v.p - 1) * PER_PAGE + i + 1}. ${clip(c.name, 32)}`, callback_data: `vu:pr${(v.p - 1) * PER_PAGE + i}` }]);
  const nav = [];
  if (v.p > 1) nav.push({ text: '▶️ السابق', callback_data: `${v.base}_${v.p - 1}` });
  if (v.p < v.pages) nav.push({ text: 'التالي ◀️', callback_data: `${v.base}_${v.p + 1}` });
  return { inline_keyboard: listRows([...rows, nav.length ? [nav] : [], [{ text: '🎓 القائمة', callback_data: 'vu:menu' }], [homeRow]]) };
};

const vuProgramText = (p) =>
  [
    `🎓 **${p.name}**`,
    '',
    `🔖 الرمز: \`${p.code}\``,
    `📚 التخصص: ${p.specs}`,
    `⏱️ المدة: ${p.duration} · ${p.totalCourses}`,
    `🗣️ اللغة: ${p.lang} · ${p.engLevels}`,
    '',
    `💰 رسوم المقرر: ${p.feeCourse}`,
    `💰 رسوم الإنكليزية: ${p.feeEng}`,
    '',
    '📝 **شروط القبول:**',
    p.admission,
    '',
    `الموقع الرسمي: ${SVU_SITE}`
  ].join('\n');

function centersText() {
  const line = (c, i) => `${i + 1}. **${c.name}**\n    📍 ${c.addr}\n    ✉️ ${c.mail}${c.phone ? `\n    ☎️ ${c.phone}` : ''}`;
  return [
    '📍 **مراكز التسجيل المعتمدة**',
    '',
    `🇸🇾 **داخل سوريا (${SVU_CENTERS_SYRIA.length})**`,
    '',
    SVU_CENTERS_SYRIA.map(line).join('\n\n'),
    '',
    `🌍 **خارج سوريا (${SVU_CENTERS_ABROAD.length})**`,
    '',
    SVU_CENTERS_ABROAD.map(line).join('\n\n')
  ].join('\n');
}

// ═══════════════ التعليم المفتوح ═══════════════
const OE_MENU = {
  inline_keyboard: [
    [
      { text: '📌 نظرة عامة', callback_data: 'oe:ov' },
      { text: '📚 التخصصات', callback_data: 'oe:pr' }
    ],
    [
      { text: '📝 شروط القبول', callback_data: 'oe:ad' },
      { text: '💰 الرسوم', callback_data: 'oe:fe' }
    ],
    [
      { text: '🏛️ الجامعات', callback_data: 'oe:un' },
      { text: '❓ أسئلة شائعة', callback_data: 'oe:fq' }
    ],
    [homeRow]
  ]
};

const OE_TABS = {
  ov: ['📌 نظرة عامة', '📚 التخصصات', '📝 شروط القبول', '💰 الرسوم', '🏛️ الجامعات', '❓ أسئلة شائعة'],
  pr: ['📚 التخصصات', '📝 شروط القبول', '💰 الرسوم', '🏛️ الجامعات', '❓ أسئلة شائعة', '📌 نظرة عامة'],
  ad: ['📝 شروط القبول', '💰 الرسوم', '🏛️ الجامعات', '❓ أسئلة شائعة', '📌 نظرة عامة', '📚 التخصصات'],
  fe: ['💰 الرسوم', '🏛️ الجامعات', '❓ أسئلة شائعة', '📌 نظرة عامة', '📚 التخصصات', '📝 شروط القبول'],
  un: ['🏛️ الجامعات', '❓ أسئلة شائعة', '📌 نظرة عامة', '📚 التخصصات', '📝 شروط القبول', '💰 الرسوم'],
  fq: ['❓ أسئلة شائعة', '📌 نظرة عامة', '📚 التخصصات', '📝 شروط القبول', '💰 الرسوم', '🏛️ الجامعات']
};

const OE_PAGES = {
  ov: () =>
    [
      '📌 **نظام التعليم المفتوح**',
      '',
      OPEN_EDU.legal,
      '',
      OPEN_EDU.intro,
      '',
      '**لمحة سريعة:**',
      OPEN_EDU.quick.map((q) => `• ${q.k}: ${q.v}`).join('\n'),
      '',
      '**أهداف النظام:**',
      OPEN_EDU.goals.map((g) => '• ' + g).join('\n')
    ].join('\n'),
  pr: () =>
    [
      `📚 **التخصصات المتاحة (${OPEN_EDU_PROGRAMS.length})**`,
      '',
      'تختلف التخصصات من جامعة لأخرى، لكن أبرزها:',
      '',
      OPEN_EDU_PROGRAMS.map((p) => `${p.icon} **${p.name}** — ${p.desc}`).join('\n')
    ].join('\n'),
  ad: () =>
    [
      '📝 **شروط القبول والتسجيل**',
      '',
      OPEN_EDU_CONDITIONS.map((c) => `**${c.title}**\n${c.items.map((i) => '• ' + i).join('\n')}`).join('\n\n')
    ].join('\n'),
  fe: () =>
    ['💰 **الرسوم الدراسية**', '', 'النظام نظام رسومي، وتُحدد الرسوم بناءً على عدد المواد المسجلة.', '', `**${OPEN_EDU_FEE.amount}** — ${OPEN_EDU_FEE.unit}`, '', `⚠️ ${OPEN_EDU_FEE.note}`].join('\n'),
  un: () =>
    [
      `🏛️ **الجامعات المشاركة (${OPEN_EDU_UNIVERSITIES.length})**`,
      '',
      'تُقدّم معظم الجامعات الحكومية السورية نظام التعليم المفتوح:',
      '',
      OPEN_EDU_UNIVERSITIES.map((u) => `${u.icon} ${u.name}`).join('\n')
    ].join('\n'),
  fq: () => ['❓ **الأسئلة الشائعة**', '', ...OPEN_EDU_FAQ.map((f, i) => `**${i + 1}. ${f.q}**\n${f.a}`)].join('\n\n')
};

const oeKeyboard = (active) => {
  const order = OE_TABS[active];
  const rows = [];
  for (let i = 0; i < order.length; i += 2) {
    rows.push(order.slice(i, i + 2).map((label) => ({ text: label, callback_data: 'oe:' + order.indexOf(label) })));
  }
  return { inline_keyboard: [...rows, [homeRow]] };
};

// ═══════════════════════════════════════════════════════════════
// المُوجِّه الموحّد
// ═══════════════════════════════════════════════════════════════
export function routeSection(io, data) {
  const s = io.s;
  const [cmd, arg] = data.split(':');
  const txt = (t, kb) => io.say(t.length > MAX_MSG ? t.slice(0, MAX_MSG - 3) + '…' : t, kb);

  // ---------- مقارنة التخصصين ----------
  if (cmd === 'cmp') {
    if (!arg) {
      cmpMenu(io);
      return true;
    }
    if (arg === 'find') {
      cmpFindPrompt(io);
      return true;
    }
    if (arg === 'reset') {
      cmpReset(io);
      return true;
    }
    if (arg === 'swap') {
      cmpSwap(io);
      return true;
    }
    if (arg === 't') {
      txt('🏛️ **تصفح حسب المؤسسة**', {
        inline_keyboard: listRows([
          ...SPEC_TYPES.map((t, i) => [{ text: `${SPEC_TYPE_LABEL[t]} (${specsByType(t).length})`, callback_data: 'cmp:y' + i }]),
          [homeRow]
        ])
      });
      return true;
    }
    if (arg[0] === 'y') {
      const t = SPEC_TYPES[+arg.slice(1)];
      if (t) cmpShowList(io, specsByType(t), SPEC_TYPE_LABEL[t] || t, 1);
      return true;
    }
    if (arg[0] === 'c') {
      const c = SPEC_CATS[+arg.slice(1)];
      if (c) cmpShowList(io, specsByCat(c), c, 1);
      return true;
    }
    if (arg[0] === 'n') {
      if (s.cmpList) cmpShowList(io, s.cmpList, s.cmpTitle || 'الاختصاصات', +arg.slice(1));
      else cmpMenu(io);
      return true;
    }
    if (arg[0] === 's') {
      const item = (s.cmpList || SPECS)[+arg.slice(1)];
      if (!item) return true;
      const before = s.cmpPick;
      cmpShowSpec(io, item.n || item);
      // بعد اختيار الأول نُبقي القائمة ظاهرة ليكمل اختيار الثاني
      if (!before && s.cmpPick) cmpContinueList(io, s.cmpPick);
      return true;
    }
    return false;
  }

  // ---------- الدورات ----------
  if (cmd === 'crs') {
    if (!arg || arg === 'menu') {
      txt(coursesMenuText(), coursesMenuKeyboard());
      return true;
    }
    if (arg[0] === 'c') {
      const cat = COURSE_CATS[+arg.slice(1)];
      if (cat) {
        const v = coursesPage(cat, 1);
        txt(v.text, coursesKeyboard(v));
      }
      return true;
    }
    if (arg[0] === 'p') {
      // الشكل: crs:p<فهرس المجال>_<رقم الصفحة>
      const [idx, page] = arg.slice(1).split('_');
      const cat = COURSE_CATS[+idx];
      if (cat && +page >= 1) {
        const v = coursesPage(cat, +page);
        txt(v.text, coursesKeyboard(v));
      }
      return true;
    }
    return false;
  }

  // ---------- الجامعة الافتراضية ----------
  if (cmd === 'vu') {
    if (!arg || arg === 'menu') {
      txt(vuMenuText(), vuMenuKeyboard());
      return true;
    }
    if (arg === 'ctr') {
      txt(centersText(), { inline_keyboard: [[{ text: '🎓 القائمة', callback_data: 'vu:menu' }], [homeRow]] });
      return true;
    }
    if (arg[0] === 'l') {
      // الشكل: vu:l<فهرس المستوى>_<رقم الصفحة>
      const [idx, page] = arg.slice(1).split('_');
      const level = SVU_LEVELS[+idx];
      if (level) {
        const v = vuPage(level, page ? +page : 1);
        txt(v.text, vuPageKeyboard(v));
      }
      return true;
    }
    if (arg.startsWith('pr')) {
      const p = SVU_PROGRAMS[+arg.slice(2)];
      if (p) {
        txt(vuProgramText(p), {
          inline_keyboard: [
            [{ text: '🌐 الموقع الرسمي', url: SVU_SITE }],
            [{ text: '📍 مراكز التسجيل', callback_data: 'vu:ctr' }],
            [{ text: '🎓 القائمة', callback_data: 'vu:menu' }],
            [homeRow]
          ]
        });
      }
      return true;
    }
    return false;
  }

  // ---------- التعليم المفتوح ----------
  if (cmd === 'oe') {
    if (!OE_PAGES[arg]) {
      txt('📚 **نظام التعليم المفتوح**', OE_MENU);
      return true;
    }
    txt(OE_PAGES[arg](), oeKeyboard(arg));
    return true;
  }

  return false;
}

export { CMP_MENU_TEXT, cmpKeyboard, coursesMenuText, coursesMenuKeyboard, vuMenuText, vuMenuKeyboard, OE_MENU, oeKeyboard, PER_PAGE };
