// ═══════════════════════════════════════════════════════════════
// الدورات المجانية — 24 دورة في 6 مجالات
// المصدر: tahan-platform/free-courses.html
// مولّد آلياً — عدّل المصدر لا الملف
// ═══════════════════════════════════════════════════════════════

// ترتيب الفئات ثابت ولا يتغيّر: english → code → lang → market → medical → tools
export const COURSE_CATS = [
  { id: "english", name: "لغة إنكليزية", icon: "💬" },
  { id: "code", name: "برمجة وتصميم", icon: "💻" },
  { id: "lang", name: "لغات أخرى", icon: "🏛️" },
  { id: "market", name: "مهارات وتسويق رقمي", icon: "🛡️" },
  { id: "medical", name: "طب وصحة", icon: "🩺" },
  { id: "tools", name: "خدمات مهمة", icon: "🔐" }
];

export const COURSES = [
  {
    cat: "english",
    name: "دورة المحادثة بالإنكليزية للمبتدئين",
    plat: "منصّة فرصة",
    desc: "تعلّم أساسيات المحادثة اليومية بالإنكليزية مع تمارين عملية لتحسين النطق والطلاقة والثقة في الحديث.",
    url: "https://www.for9a.com/courses/دورة-مجانية-في-تعلم-المحادثة-في-اللغة-الإنجليزية-للمبتدئين-english-for-life"
  },
  {
    cat: "english",
    name: "تحضير لامتحان IELTS",
    plat: "منصّة edX",
    desc: "تحضير متكامل لامتحان IELTS: الاستماع، القراءة، الكتابة والتحدّث، مع نماذج وتقنيات لأعلى علامة.",
    url: "https://www.edx.org/learn/test-prep/the-university-of-queensland-ielts-academic-test-preparation?index=product&queryID=1354e7a545801e9478021694c22e10b2&position=4&results_level=second-level-results&term=English&objectID=course-d61d7a1f-3333-4169-a786-92e2bf690c6f&campaign=IELTS+Academic+Test+Preparation&source=edX&product_category=course&placement_url=https%3A%2F%2Fwww.edx.org%2Fsearch"
  },
  {
    cat: "english",
    name: "اختبار TOEFL التجريبي",
    plat: "BestMyTest",
    desc: "اختبارات تجريبية تفاعلية لتحضير TOEFL، مع تقييم فوري لمهارات الاستماع والقراءة والتحدّث والكتابة.",
    url: "https://www.bestmytest.com/toefl/practice-test"
  },
  {
    cat: "english",
    name: "اختبار اللغة الإنجليزية دوولينجو | تجربة شخصية",
    plat: "تجربة شخصية",
    desc: "تجربة شاملة للتحضير لاختبار Duolingo English Test من الصفر: شرح مكوّنات الاختبار، ملفات تدريب ومصادر دراسية، ومخطط تنظيمي للاجتياز.",
    url: "https://academy.syrian-youth.org/blog/sdetc/",
    note: "مجاني ويغطي مصاريف الامتحان المقدرة بـ 59 دولار أمريكي.",
    extra: [{"url":"https://docs.google.com/forms/d/e/1FAIpQLSeIKW00VmIl5XUzrCa2LGgHeueC7-05BZAHn5O5kCV9Qs7W2g/viewform","cta":"زر اختبار Duolingo English Test"}]
  },
  {
    cat: "english",
    name: "دبلوم إعداد مدرّسي اللغة الإنجليزية",
    plat: "أكاديمية تجمع الشباب السوري",
    desc: "دبلوم مكثّف لخريجي اللغة الإنجليزية ليصبحوا مدرّسين محترفين: شهادة TESOL من جامعة ولاية أريزونا مع منهجيات التدريس وتكنولوجيا التعليم.",
    url: "https://academy.syrian-youth.org/blog/dent/"
  },
  {
    cat: "english",
    name: "مسار تعلم اللغة الإنكليزية لإدارة الأعمال",
    plat: "أكاديمية تجمع الشباب السوري",
    desc: "مسار متكامل لتطوير الإنكليزية في بيئة العمل: الكتابة الاحترافية، الاجتماعات، التفاوض، التواصل بين الثقافات، ومشاريع عملية نهائية.",
    url: "https://academy.syrian-youth.org/blog/4english-for-business-path/"
  },
  {
    cat: "english",
    name: "مسار تعليم اللغة الإنكليزية",
    plat: "أكاديمية تجمع الشباب السوري",
    desc: "مسار TESOL لتعليم الإنكليزية كلغة ثانية: نظريات اكتساب اللغة، تصميم الدروس وتقييمها، إدارة الصف، وتكنولوجيا التعليم.",
    url: "https://academy.syrian-youth.org/blog/3-english-teaching-path/"
  },
  {
    cat: "english",
    name: "مسار المبتدئين للغة الإنكليزية",
    plat: "أكاديمية تجمع الشباب السوري",
    desc: "مسار من 16 كورساً لرفع مستواك من A2 إلى B1: القواعد الأساسية، المحادثة اليومية، النطق الأميركي، والتواصل في العمل والحياة.",
    url: "https://academy.syrian-youth.org/blog/english-a2-b1-path/"
  },
  {
    cat: "market",
    name: "شهادة جوجل الاحترافية للأمن السيبراني",
    plat: "Skillshop",
    desc: "مجموعة دورات مجانية في التسويق الرقمي وأدوات Google (البحث، الإعلان، التحليلات) مع شهادات معتمدة.",
    url: "https://skillshop.exceedlms.com/student/collection/1830706"
  },
  {
    cat: "code",
    name: "عشر دورات لتصميم وتطوير المواقع",
    plat: "منصّة الراعي",
    desc: "عشر دورات مجانية لتعلّم تصميم وتطوير المواقع من الصفر، من واجهات المستخدم إلى البرمجة والنشر.",
    url: "https://www.al-raaei.com/content/%D8%B9%D8%B4%D8%B1-%D8%AF%D9%88%D8%B1%D8%A7%D8%AA-%D9%84%D8%AA%D8%B5%D9%85%D9%8A%D9%85-%D9%88%D8%AA%D8%B7%D9%88%D9%8A%D8%B1-%D8%A7%D9%84%D9%85%D9%88%D8%A7%D9%82%D8%B9"
  },
  {
    cat: "code",
    name: "البرمجة للجميع: البدء باستخدام Python",
    plat: "منصّة الراعي",
    desc: "دورة للمبتدئين لتعلّم أساسيات البرمجة واستخدام لغة Python خطوة بخطوة، بدون أي خبرة سابقة.",
    url: "https://www.al-raaei.com/content/%D8%A7%D9%84%D8%A8%D8%B1%D9%85%D8%AC%D8%A9-%D9%84%D9%84%D8%AC%D9%85%D9%8A%D8%B9-%D8%A7%D9%84%D8%A8%D8%AF%D8%A1-%D8%A8%D8%A7%D8%B3%D8%AA%D8%AE%D8%AF%D8%A7%D9%85-python"
  },
  {
    cat: "code",
    name: "شهادة IBM في الأمن السيبراني",
    plat: "أكاديمية تجمع الشباب السوري",
    desc: "مسار مهني مجاني من 8 دورات: أمان الشبكات، اختبار الاختراق، الاستجابة للحوادث وذكاء التهديدات، مع مختبرات عملية وشهادة معتمدة.",
    url: "https://academy.syrian-youth.org/blog/cyber-security-ibm-professional-certificate/"
  },
  {
    cat: "lang",
    name: "أفضل دورات اللغة اليابانية",
    plat: "Class Central",
    desc: "تجميعة لأفضل الدورات المجانية لتعلّم اليابانية للمبتدئين، من الحروف والأبجدية إلى المحادثة الأساسية.",
    url: "https://www.classcentral.com/report/best-japanese-courses/"
  },
  {
    cat: "market",
    name: "شهادة التسويق الرقمي والتجارة الإلكترونية",
    plat: "Google",
    desc: "برامج مجانية من Google لتعلّم مهارات مطلوبة في سوق العمل، من تحليل البيانات إلى التسويق الرقمي.",
    url: "https://grow.google/intl/mena/#?modal_active=none"
  },
  {
    cat: "code",
    name: "برمجة هياكل البيانات والخوارزميات",
    plat: "أكاديمية تجمع الشباب السوري",
    desc: "مسار من 5 تخصصات للمبتدئين: مقدمة في علوم الكمبيوتر والبرمجة، Python وC++، وهياكل البيانات والخوارزميات مع نحو 100 تحدٍ برمجي.",
    url: "https://academy.syrian-youth.org/blog/programming-data-structures-and-algorithms/"
  },
  {
    cat: "code",
    name: "منصة كانفا للمعلمين والطلاب",
    plat: "أكاديمية تجمع الشباب السوري",
    desc: "مسار من 4 مشاريع لتعلّم التصميم عبر Canva: محتوى تعليمي جذاب للمدرّسين، وسيرة ذاتية احترافية جاهزة لسوق العمل.",
    url: "https://academy.syrian-youth.org/blog/canva-for-teacher-and-students/"
  },
  {
    cat: "code",
    name: "تصميم الأزياء",
    plat: "أكاديمية تجمع الشباب السوري",
    desc: "مساران لتعلّم أساسيات تصميم الأزياء: تاريخ الموضة والخامات والرسم والتفصيل بالعربية على إدراك، ودبلومة أكاديمية متقدمة من أليسون.",
    url: "https://academy.syrian-youth.org/blog/fashion-design/"
  },
  {
    cat: "market",
    name: "مسار مهارات العروض التقديمية",
    plat: "أكاديمية تجمع الشباب السوري",
    desc: "مسار من 3 كورسات ومشروع نهائي لإتقان تقديم العروض: التغلّب على الخوف، التحدث أمام الجمهور، واستخدام PowerPoint باحترافية.",
    url: "https://academy.syrian-youth.org/blog/presentation-skills-path/"
  },
  {
    cat: "market",
    name: "مسار كانفا للتسويق والأعمال",
    plat: "أكاديمية تجمع الشباب السوري",
    desc: "مسار من كورسين و8 مشاريع لإنشاء مواد تسويقية احترافية بـ Canva: المنتجات الرقمية، الفيديوهات الترويجية، والرسوم البيانية.",
    url: "https://academy.syrian-youth.org/blog/canva-for-business-marketing-path/"
  },
  {
    cat: "market",
    name: "التصوير والتعديل",
    plat: "أكاديمية تجمع الشباب السوري",
    desc: "مسار شامل للتصوير من الهاتف إلى DSLR: أساسيات الكاميرا والإضاءة، تعديل الصور والفوتوشوب، والموشن غرافيك والمونتاج.",
    url: "https://academy.syrian-youth.org/blog/photography-and-editing/"
  },
  {
    cat: "market",
    name: "مسار أساسيات صناعة وإخراج الأفلام",
    plat: "أكاديمية تجمع الشباب السوري",
    desc: "مسار من 9 كورسات لتعلّم صناعة الأفلام: كتابة السيناريو، التحكم بالكاميرا، التصوير والإضاءة، وتمويل الأفلام وتسويقها.",
    url: "https://academy.syrian-youth.org/blog/film-making-and-production-basic-path/"
  },
  {
    cat: "market",
    name: "إدارة الموارد البشرية",
    plat: "أكاديمية تجمع الشباب السوري",
    desc: "مسار من دورات كورسيرا وأليسون لتعلّم التوظيف، التحليلات، وتحفيز الموظفين، مع دورات اختيارية في القيادة وتطوير المهارات.",
    url: "https://academy.syrian-youth.org/blog/human-resources-management/"
  },
  {
    cat: "medical",
    name: "التجارب السريرية من الألف إلى الياء",
    plat: "أكاديمية تجمع الشباب السوري",
    desc: "مسار من 9 مساقات لتصميم وإدارة الدراسات السريرية: الأخلاقيات، إدارة البيانات، التحليل الإحصائي ونشر النتائج، لطلاب الطب والباحثين.",
    url: "https://academy.syrian-youth.org/blog/clinical-trials-from-a-to-z/"
  },
  {
    cat: "tools",
    name: "توثيق حساب كورسيرا",
    plat: "أكاديمية تجمع الشباب السوري",
    desc: "خدمة مهمة لتوثيق هوية حسابك على منصة كورسيرا والحصول على شهاداتها المعتمدة مجاناً، للسوريين والسودانيين واللاجئين الذين لا يستطيعون التوثيق بشكل فردي.",
    url: "https://academy.syrian-youth.org/blog/coursera-id-verification/",
    note: "ليست دورة — خدمة توثيق مجانية لطلاب منحة كورسيرا. تصل مدتها إلى 3 أسابيع كحد أقصى.",
    extra: [
      { url: "https://docs.google.com/forms/d/e/1FAIpQLSfrKYLaFjhijaPE6V4A9E168oKpJhPuSfS0h8eEAOVIaw45eA/viewform", cta: "توثيق ID Verification - Coursera" }
    ]
  }
];

export const COURSE_COUNT = 24;
export const COURSE_CAT_COUNT = 6;
export const COURSE_PRICE = 0;

export const coursesByCat = (cat) => COURSES.filter((c) => c.cat === cat);
