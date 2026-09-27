// مركز الطحان — يجمع كل وحدات البيانات في مكان واحد
// كل وحدة مستقلة حتى لا يتضخّم ملف واحد؛ هذا الملف مجرد إعادة تصدير
// للحفاظ على توافق أي استيراد قديم لـ './data.js'.

export { BRANCHES, CATEGORIES, QUESTIONS, MAJORS, MAJORS_2026, RELEASED_2026, CONTACT, PARTNER_SERVICES, waLink } from './data/core.js';

export { EF_QUESTIONS, CEFR, EF_CATS, EF_SET_URL, efBand, SVU_LANG_TABLE } from './data/english.js';

export { FAQ } from './data/faq.js';

export { COURSE_CATS, COURSES, COURSE_COUNT, COURSE_CAT_COUNT, COURSE_PRICE, coursesByCat } from './data/courses.js';

export {
  SVU_LEVELS,
  SVU_PROGRAMS,
  SVU_CENTERS_SYRIA,
  SVU_CENTERS_ABROAD,
  SVU_CENTER_COUNT,
  programsByLevel,
  findProgram,
  SVU_SITE,
  PT_QUIZZES,
  PT_KEYS,
  PT_QUESTION_COUNT,
  ptLevelFor
} from './data/virtual-u.js';

export {
  SPECS,
  SPEC_CATS,
  SPEC_TYPES,
  SPEC_TYPE_LABEL,
  SPEC_COUNT,
  specsByCat,
  specsByType,
  searchSpecs,
  findSpec,
  normSpec
} from './data/compare.js';

export {
  OPEN_EDU,
  OPEN_EDU_FEE,
  OPEN_EDU_PROGRAMS,
  OPEN_EDU_CONDITIONS,
  OPEN_EDU_UNIVERSITIES,
  OPEN_EDU_FAQ
} from './data/open-edu.js';
