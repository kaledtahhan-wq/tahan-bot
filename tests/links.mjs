// فحص الروابط: كل رابط داخلي في البوت يجب أن يقابل صفحة حقيقية في موقع المنصة.
//   node --import ./tests/register.mjs tests/links.mjs
// يتخطّى فحص الموقع تلقائياً إن لم يكن موجوداً (PLATFORM_DIR).
import { existsSync, readdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(HERE, '..') + path.sep;
const PLATFORM = process.env.PLATFORM_DIR || 'C:/Users/khakh/Documents/Default Project/tahan-platform';

const { CONTACT } = await import('../data.js');

let fails = 0;
const ok = (c, label, got) => {
  if (!c) fails++;
  console.log(`${c ? '✔' : '✘'} ${label}${c ? '' : '  => ' + JSON.stringify(String(got).slice(0, 160))}`);
};

const jsFiles = ['bot.js', 'data.js', ...['data', 'lib'].flatMap((d) => readdirSync(REPO + d).map((f) => `${d}/${f}`))]
  .filter((f) => f.endsWith('.js'));
const sources = jsFiles.map((f) => [f, readFileSync(REPO + f, 'utf8')]);

// ── 1) روابطCONTACT.site + مسار ──
console.log('\n=== 1) روابط الموقع الداخلي ===');
const site = String(CONTACT.site || '').replace(/\/+$/, '');
ok(site.startsWith('https://'), 'CONTACT.site رابط https', CONTACT.site);
const internal = [];
for (const [f, t] of sources) {
  for (const m of t.matchAll(/CONTACT\.site\s*\+\s*'\/([\w./#-]+)'/g)) internal.push([f, m[1]]);
}
if (!internal.length) console.log('   ℹ لا روابط موقع داخلية');
for (const [f, p] of internal) console.log(`   → ${f} : /${p}`);

if (existsSync(PLATFORM)) {
  const pages = new Set(readdirSync(PLATFORM).filter((f) => f.endsWith('.html')));
  for (const [f, p] of internal) {
    const base = p.split('#')[0].split('?')[0];
    if (base && !base.includes('/') === false) continue;
    ok(pages.has(base), `/${p} موجود في الموقع (${f})`, [...pages].join(', '));
  }
} else {
  console.log('   ℹ تخطّي: PLATFORM غير موجود — عيّن PLATFORM_DIR لتشغيل هذا الفحص');
}

// ── 2) أي رابط .html مكتوب يدوياً ──
console.log('\n=== 2) روابط .html المذكورة كنص ===');
const literals = [];
for (const [f, t] of sources) {
  for (const m of t.matchAll(/['"]((?:\/|[A-Za-z0-9_-]+\.html)[^'"]*)['"]/g)) {
    if (/\.html($|[?#])/.test(m[1]) && !m[1].startsWith('http')) literals.push([f, m[1]]);
  }
}
const uniqLit = [...new Map(literals.map(([f, u]) => [f + '|' + u, [f, u]])).values()];
if (!uniqLit.length) console.log('   ✔ لا روابط .html حرفية');
for (const [f, u] of uniqLit) {
  if (u.startsWith('/')) continue; // التقطها الفحص الأول
  console.log(`   → ${f} : ${u}`);
  if (existsSync(PLATFORM)) {
    const base = u.split('#')[0].split('?')[0];
    ok(existsSync(PLATFORM + '/' + base), `${u} موجود في الموقع (${f})`);
  }
}

// ── 3) روابط tel: — يجب ألا تختلط ببطاقات المحتوى ──
console.log('\n=== 3) روابط tel: ===');
const tels = [];
for (const [f, t] of sources) {
  for (const m of t.matchAll(/['"]tel:([^'"]+)['"]/g)) tels.push([f, m[0]]);
}
ok(tels.length === 0, `لا روابط tel: في الكود (${tels.length})`, tels.map((x) => x.join(' → ')).join(', '));

// ── 4) روابط الدورات: خارجية فقط، و extra غير ملوّث ──
console.log('\n=== 4) روابط بطاقات الدورات ===');
const { COURSES } = await import('../data/courses.js');
const badUrl = COURSES.filter((c) => !/^(https?:\/\/|tel:)/.test(c.url || ''));
ok(badUrl.length === 0, `كل url خارجي (${badUrl.length} خطأ)`, badUrl.map((c) => `${c.name}→${c.url}`).join(', '));
const navRe = /^(#|[\w-]+\.html)/;
const polluted = COURSES.filter((c) => (c.extra || []).some((e) => navRe.test(e.url)));
ok(polluted.length === 0, `extra غير ملوّث بروابط التنقّل (${polluted.length} بطاقة)`, polluted.map((c) => c.name).join(', '));
const dupExtra = COURSES.filter((c) => {
  const ex = c.extra || [];
  return ex.length !== new Set(ex.map((e) => e.url)).size;
});
ok(dupExtra.length === 0, `لا روابط extra مكررة (${dupExtra.length} بطاقة)`, dupExtra.map((c) => c.name).join(', '));

// ── 5) روابط تيليغرام sociale / الموقع الرسمي ──
console.log('\n=== 5) روابط التواصل ===');
const social = [];
for (const [f, t] of sources) for (const m of t.matchAll(/https:\/\/(?:t\.me|wa\.me|www\.(?:instagram|facebook)\.com)\/[\w.]+/g)) social.push(m[0]);
ok(social.length > 0, `روابط التواصل موجودة (${new Set(social).size} رابط فريد)`);

console.log(fails ? `\n✘ فشل ${fails}` : '\n✔ كل فحوص الروابط نجحت');
process.exit(fails ? 1 : 0);
