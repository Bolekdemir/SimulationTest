#!/usr/bin/env node
// Runs many island simulations in parallel and scores them with
// tools/critic.js.
//
//   node tools/train.js eval  [--sims 8] [--days 3]          baseline report
//   node tools/train.js train [--gens 10] [--pop 8] [--days 3] [--seeds 2]
//
// Training is a small evolutionary search over IS.Tune (js/tune.js): every
// candidate faces the same seeded islands, the best survive and mutate.
// Results go to tools/out/. Needs Playwright with a Chromium build.
const path = require('path');
const fs = require('fs');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const args = process.argv.slice(2);
const mode = args[0] || 'eval';
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? +args[i + 1] : d; };
const WORKERS = opt('workers', 4);

// Search space: [min, max, log-scale?]
const SPACE = {
  chatRate: [0.03, 0.25, 1], chatEventMult: [1, 5, 0], chatTravelMult: [0.1, 0.8, 0], noticeRate: [0.005, 0.06, 1], noticeMin: [0.05, 0.6, 0],
  passByChance: [0.2, 1, 0], secondBase: [0, 0.5, 0], secondSoc: [0, 0.8, 0], inviteBase: [0, 0.25, 0], inviteSoc: [0, 0.6, 0],
  planWeight: [0.2, 2, 1], planSocialRate: [0.01, 0.1, 1], lonelyAt: [5, 30, 0],
};
const TOPICS = ['activity', 'plans', 'question', 'catchphrase', 'gossipGood', 'gossipBad', 'joke', 'roast', 'compliment', 'complaint', 'deep', 'flirt', 'tease', 'rumor', 'myNews', 'sharedLove', 'observe', 'eventSoon', 'food', 'weather', 'island', 'cat', 'brag', 'cocky', 'hungry', 'argue'];
for (const t of TOPICS) SPACE['topic.' + t] = [0.25, 3, 1];

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const toTune = flat => { const t = { topic: {} }; for (const [k, v] of Object.entries(flat)) { if (k.startsWith('topic.')) t.topic[k.slice(6)] = v; else t[k] = v; } return t; };
const mutate = (flat, sigma) => {
  const out = { ...flat };
  for (const [k, [lo, hi, log]] of Object.entries(SPACE)) {
    if (Math.random() > 0.35) continue;
    const v = out[k] ?? (k.startsWith('topic.') ? 1 : (lo + hi) / 2);
    out[k] = clamp(log ? v * Math.exp(gauss() * sigma) : v + gauss() * sigma * (hi - lo) * 0.5, lo, hi);
  }
  return out;
};
const cross = (a, b) => { const o = {}; for (const k of Object.keys(SPACE)) o[k] = Math.random() < 0.5 ? (a[k] ?? b[k]) : (b[k] ?? a[k]); return o; };

async function runSim(page, { seed, days, tune }) {
  await page.goto('file://' + path.join(ROOT, 'index.html') + '?seed=' + seed);
  await page.waitForFunction(() => window.sim && window.sim.menu, null, { timeout: 60000 });
  await page.addScriptTag({ path: path.join(__dirname, 'critic.js') });
  return page.evaluate(({ days, tune }) => {
    if (tune) { const { topic, ...rest } = tune; Object.assign(IS.Tune, rest); IS.Tune.topic = Object.assign({}, topic || {}); }
    sim.renderer.draw = () => {}; sim.ui.frame = () => {}; IS.Save.save = () => true;
    sim.menu.start(); sim.setSpeed(0);
    Critic.install(sim);
    const dt = 0.5;
    const total = days * 1440;
    for (let m = 0, k = 0; m < total; m += dt, k++) {
      sim.clock.abs += dt; sim.updateClock(); sim.events.update(dt);
      for (const p of sim.people) p.update(dt, 0.016, sim.ctx());
      sim.cat.update(dt);
      for (const cv of sim.conversations.slice()) cv.update(dt);
      IS.Social.update(sim, dt); IS.Mind.tick(sim, dt); sim.cropGrowth(dt);
      if (k % 20 === 0) Critic.sample(10);
    }
    return Critic.report();
  }, { days, tune });
}

async function pool(tasks) {
  const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const pages = await Promise.all(Array.from({ length: Math.min(WORKERS, tasks.length) }, async () => {
    const page = await browser.newPage();
    // Seeded randomness so every candidate faces the same islands
    await page.addInitScript(() => {
      // Every run starts a brand-new island: no autosave or settings from the last run
      try { localStorage.clear(); sessionStorage.clear(); } catch (e) { /* file:// */ }
      const m = location.search.match(/seed=(\d+)/);
      if (!m) return;
      let s = +m[1] * 2654435761 >>> 0;
      Math.random = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    });
    page.on('pageerror', e => console.error('PAGE ERROR', e.message));
    return page;
  }));
  const results = new Array(tasks.length);
  let next = 0;
  await Promise.all(pages.map(async page => {
    while (next < tasks.length) {
      const i = next++;
      try { results[i] = await runSim(page, tasks[i]); } catch (e) { console.error('sim failed', e.message); results[i] = null; }
    }
  }));
  await browser.close();
  return results;
}

const avg = rs => {
  const ok = rs.filter(Boolean);
  const m = {};
  for (const k of Object.keys(ok[0].m)) m[k] = +(ok.reduce((s, r) => s + r.m[k], 0) / ok.length).toFixed(3);
  const v = {}, ex = {};
  for (const r of ok) for (const [k, n] of Object.entries(r.v)) { v[k] = (v[k] || 0) + n; ex[k] = ex[k] || r.ex[k]; }
  return { m, v, ex };
};

(async () => {
  const t0 = Date.now();
  if (mode === 'eval') {
    const sims = opt('sims', 8), days = opt('days', 3), seed0 = opt('seed', 1000);
    const tune = fs.existsSync(path.join(OUT, 'best.json')) && args.includes('--best') ? toTune(JSON.parse(fs.readFileSync(path.join(OUT, 'best.json'))).flat) : null;
    const rs = await pool(Array.from({ length: sims }, (_, i) => ({ seed: seed0 + i, days, tune })));
    const a = avg(rs);
    console.log(JSON.stringify(a.m, null, 1));
    console.log('violations', JSON.stringify(a.v));
    for (const [k, list] of Object.entries(a.ex)) console.log('  ' + k + ':\n    ' + list.join('\n    '));
    const why = {}; for (const r of rs.filter(Boolean)) for (const [k, v] of Object.entries(r.why || {})) why[k] = (why[k] || 0) + v;
    console.log('why (minutes):', Object.entries(why).sort((a, b) => b[1] - a[1]).slice(0, 18).map(([k, v]) => k + '=' + v).join('  '));
    const rep = {}; for (const r of rs.filter(Boolean)) for (const [k, v] of Object.entries(r.rep || {})) rep[k] = (rep[k] || 0) + v;
    console.log('top repeats:\n  ' + Object.entries(rep).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => v + 'x ' + k).join('\n  '));
    const th = {}; for (const r of rs.filter(Boolean)) for (const [k, v] of Object.entries(r.threads || {})) th[k] = (th[k] || 0) + v;
    console.log('threads:', Object.entries(th).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + '=' + v).join(' '));
    console.log('scores', rs.filter(Boolean).map(r => r.m.score).join(' '), `(${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    fs.writeFileSync(path.join(OUT, `eval-${Date.now()}.json`), JSON.stringify(a, null, 1));
    return;
  }
  if (mode === 'train') {
    const gens = opt('gens', 10), popN = opt('pop', 8), days = opt('days', 3), nSeeds = opt('seeds', 2);
    const base = {};
    let popl = [base, ...Array.from({ length: popN - 1 }, () => mutate(base, 0.5))];
    let best = null;
    const history = [];
    for (let g = 0; g < gens; g++) {
      const seeds = Array.from({ length: nSeeds }, (_, i) => 5000 + g * 37 + i);
      const tasks = [];
      popl.forEach((flat, ci) => seeds.forEach(seed => tasks.push({ ci, seed, days, tune: toTune(flat) })));
      const rs = await pool(tasks);
      const scored = popl.map((flat, ci) => {
        const mine = rs.filter((r, i) => tasks[i].ci === ci && r);
        return { flat, score: mine.reduce((s, r) => s + r.m.score, 0) / Math.max(1, mine.length), m: mine.length ? avg(mine).m : null };
      }).sort((a, b) => b.score - a.score);
      if (!best || scored[0].score > best.score) best = scored[0];
      history.push({ gen: g, best: +scored[0].score.toFixed(2), mean: +(scored.reduce((s, x) => s + x.score, 0) / scored.length).toFixed(2), baseline: g === 0 ? +scored.find(x => x.flat === base).score.toFixed(2) : undefined });
      console.log(`gen ${g}: best ${scored[0].score.toFixed(2)}  mean ${history[g].mean}  (${((Date.now() - t0) / 60000).toFixed(1)} min)`);
      fs.writeFileSync(path.join(OUT, 'best.json'), JSON.stringify({ score: best.score, flat: best.flat, m: best.m, history }, null, 1));
      // Next generation: keep the top two, breed and mutate the rest
      const elite = scored.slice(0, 2).map(x => x.flat);
      const sigma = 0.45 * (1 - g / gens) + 0.12;
      popl = [...elite, ...Array.from({ length: popN - 2 }, () => mutate(Math.random() < 0.4 ? cross(elite[0], elite[1]) : elite[Math.random() < 0.7 ? 0 : 1], sigma))];
    }
    console.log('best', JSON.stringify(best.flat, null, 1));
  }
})();
