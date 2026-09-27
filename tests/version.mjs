//GET /version — verifies which build is actually deployed on Render.
//   node --import ./tests/register.mjs tests/version.mjs
//
// RENDER_GIT_COMMIT is set by Render automatically, so hitting
// /version on the live service proves the running commit instead of
// guessing from the dashboard.
process.env.BOT_TOKEN ||= '123:FAKE';
process.env.RENDER_EXTERNAL_URL ||= 'https://tahan-bot.onrender.com';
process.env.ANNOUNCE_POLL_MS ||= '3600000';
process.env.PORT ||= '45999';
process.env.RENDER_GIT_COMMIT ||= 'deadbeefcafe1234';
process.env.RENDER_GIT_BRANCH ||= 'main';
delete process.env.AI_API_KEY;

const BASE = 'http://127.0.0.1:' + process.env.PORT;

await import('../bot.js');
await new Promise((r) => setTimeout(r, 1200));

let fails = 0;
const ok = (cond, label, got) => {
  if (!cond) fails++;
  console.log(`${cond ? '✔' : '✘'} ${label}${cond ? '' : '  => ' + JSON.stringify(String(got).slice(0, 200))}`);
};

const root = await fetch(BASE + '/');
ok(root.status === 200 && (await root.text()).trim() === 'OK', 'GET / يرجع 200 OK', root.status);

const res = await fetch(BASE + '/version');
ok(res.status === 200, 'GET /version يرجع 200', res.status);
const body = await res.json();
console.log('  ↑ ' + JSON.stringify(body));

ok(body.ok === true, 'الحقل ok موجود');
ok(body.commit === process.env.RENDER_GIT_COMMIT, 'commit مقروء من RENDER_GIT_COMMIT', body.commit);
ok(body.branch === 'main', 'branch مقروء من RENDER_GIT_BRANCH', body.branch);

const f = body.features || {};
ok(f.placementQuiz === 156, 'اختبار المستوى 156 سؤالاً', f.placementQuiz);
ok(f.courses === 24, 'الدورات 24', f.courses);
ok(f.specs === 108, 'التخصصات 108', f.specs);
ok(f.programs === 37, 'برامج الجامعة الافتراضية 37', f.programs);

const raw = JSON.stringify(body);
ok(!/gh[pousr]_|github_pat_|\d{8,10}:[A-Za-z0-9_-]{30}/.test(raw), 'لا أسرار في رد /version', raw);

console.log(fails ? `\n✘ فشل ${fails}` : '\n✔ نقطة /version سليمة');
process.exit(fails ? 1 : 0);
