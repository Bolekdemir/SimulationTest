// God powers: smite, meteor, fire, bless, revive.
// Also everything about dying: bodies, blood, ghosts, graves, grief, and
// coming back. The dead leave sim.people (so nothing else has to check for
// them) and their bonds are stashed until a revive puts everything back.
IS.Gods = (() => {
  const G = {};
  const TL = () => IS.TILE;

  G.POWERS = [
    { id: 'hand', name: 'Hand', key: 'z', hint: 'Grab people and throw them. Throw REALLY hard and they won\'t get up.' },
    { id: 'smite', name: 'Smite', key: 'x', hint: 'Click someone to strike them down with lightning.' },
    { id: 'meteor', name: 'Meteor', key: 'c', hint: 'Click anywhere to drop a meteor on it.' },
    { id: 'fire', name: 'Fire', key: 'v', hint: 'Click someone to set them on fire. Water saves them.' },
    { id: 'bless', name: 'Bless', key: 'b', hint: 'Click someone, or a crowd, to heal them and lift their spirits.' },
    { id: 'revive', name: 'Revive', key: 'g', hint: 'Click a grave or a body to bring them back.' },
  ];

  G.init = sim => {
    sim.power = 'hand';
    sim.graves = [];
    sim.decals = [];
    sim.godFx = [];
    sim.shake = 0;
    sim.deaths = 0;
    sim.lastDeathAt = -1e9;
  };

  G.setPower = (sim, id) => {
    const pw = G.POWERS.find(p => p.id === id);
    if (!pw) return;
    sim.power = id;
    if (sim.ui) { sim.ui.syncToggles(); if (id !== 'hand') sim.ui.toast(`${pw.name}: ${pw.hint}`); }
  };

  const live = (sim, rdt) => (sim.speedIdx === 0 ? 0 : rdt);
  const awake = o => o.pose !== 'sleep' && (o.mode === 'normal' || o.mode === 'recover' || o.mode === 'panic');
  const sameSpace = (o, x, y, b) => (o.building || null) === (b || null);
  const P = p => (p.cfg.pronoun === 'she' ? ['she', 'her'] : p.cfg.pronoun === 'they' ? ['they', 'them'] : ['he', 'him']);

  // ------------------------------------------------------------ targeting
  G.targetAt = (sim, iso) => {
    const p = sim.input.personAt(iso.x, iso.y);
    if (p) return p;
    const w = IS.Iso.s2w(iso.x, iso.y);
    let best = null, bd = TL() * 1.3;
    for (const o of sim.people) {
      if (o.mode === 'carried' || (o.building && o.building.cut < 0.3)) continue;
      const d = IS.dist(o.x, o.y, w.x, w.y);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  };
  G.graveAt = (sim, iso, r = 1.6) => {
    const w = IS.Iso.s2w(iso.x, iso.y);
    let best = null, bd = TL() * r;
    for (const g of sim.graves) {
      const d = IS.dist(g.x, g.y, w.x, w.y);
      if (d < bd) { bd = d; best = g; }
    }
    return best;
  };

  G.cast = (sim, iso) => {
    const w = IS.Iso.s2w(iso.x, iso.y);
    if (sim.power === 'revive') {
      const g = G.graveAt(sim, iso);
      if (g) G.revive(sim, g); else sim.toast(sim.graves.length ? 'Click right on a grave or a body.' : 'Nobody has died. Yet.');
      return;
    }
    const p = G.targetAt(sim, iso);
    if (sim.power === 'smite') G.smite(sim, p, w);
    else if (sim.power === 'meteor') G.meteor(sim, w);
    else if (sim.power === 'fire') { if (p) G.ignite(sim, p, true); else G.groundFire(sim, w.x, w.y); }
    else if (sim.power === 'bless') G.bless(sim, p, w);
  };

  // ------------------------------------------------------------ smite
  G.boltPath = (sim, x, y) => {
    const top = (sim.renderer ? sim.renderer.oy : y - 300) - 20;
    const pts = [];
    let cx = x + IS.rand(-40, 40);
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const yy = top + (y - top) * u;
      cx += IS.rand(-9, 9);
      pts.push({ x: i === n ? x : IS.lerp(cx, x, u * u), y: yy });
    }
    const k = IS.randi(4, 8), branch = [pts[k]];
    let bx = pts[k].x, by = pts[k].y;
    for (let i = 0; i < 5; i++) { bx += IS.rand(-14, 14) + (Math.random() < 0.5 ? -6 : 6); by += IS.rand(10, 22); branch.push({ x: bx, y: by }); }
    return [pts, branch];
  };

  G.smite = (sim, p, w) => {
    const x = p ? p.x : w.x, y = p ? p.y : w.y;
    const s = IS.Iso.w2s(x, y);
    const h = p ? p.z : 0;
    sim.godFx.push({ kind: 'bolt', x: s.x, y: s.y - h, t: 0, max: 0.5, paths: G.boltPath(sim, s.x, s.y - h) });
    if (sim.renderer) sim.renderer.flash = 1;
    sim.shake = Math.max(sim.shake, 6);
    for (let i = 0; i < 22; i++) sim.fx.add({ x: s.x, y: s.y - h - 4, vx: IS.rand(-110, 110), vy: IS.rand(-170, -40), g: 420, max: IS.rand(0.4, 0.9), color: IS.pick(['#fff6c8', '#ffe07a', '#9fd8ff', '#ffffff']), size: 1 });
    const tx = Math.floor(x / TL()), ty = Math.floor((y - 6) / TL());
    if (sim.world.isWater(tx, ty)) sim.fx.splash(x, y, 18);
    else G.decal(sim, 'scorch', x, y, 11);
    if (p) G.kill(sim, p, 'smite');
    let close = null;
    for (const o of sim.people.slice()) {
      const d = IS.dist(o.x, o.y, x, y);
      if (d < TL() * 1.7 && (o.mode === 'normal' || o.mode === 'recover')) { G.fling(sim, o, x, y, 140, 230); if (!close) close = o; }
      else if (!close && d < TL() * 4) close = o;
    }
    G.scare(sim, x, y, 9);
    if (close && !p) IS.Mind.news(sim, 'nearMiss', close);
  };

  // ------------------------------------------------------------ meteor
  G.meteor = (sim, w) => {
    const s = IS.Iso.w2s(w.x, w.y);
    sim.godFx.push({ kind: 'meteor', tx: s.x, ty: s.y, wx: w.x, wy: w.y, t: 0, max: 1.15, fx: s.x + 230, fy: s.y - 360 });
    for (const o of sim.people) {
      if (!awake(o) || o.building || IS.dist(o.x, o.y, w.x, w.y) > TL() * 12 || Math.random() < 0.4) continue;
      o.emote('exclaim', 1.4);
      o.say(IS.pick(['Is that... a shooting star?', 'Why is the sky ON FIRE?!', 'Uh. Guys? GUYS?!', 'That\'s getting bigger...', 'RUN!']), 1.6);
    }
  };

  G.explode = (sim, x, y) => {
    const s = IS.Iso.w2s(x, y);
    if (sim.renderer) sim.renderer.flash = 1;
    sim.shake = Math.max(sim.shake, 14);
    sim.godFx.push({ kind: 'boom', x: s.x, y: s.y, t: 0, max: 0.7 });
    const tx = Math.floor(x / TL()), ty = Math.floor((y - 6) / TL());
    const water = sim.world.isWater(tx, ty);
    if (water) { sim.fx.splash(x, y, 40); sim.fx.splash(x + 12, y + 6, 20); }
    else {
      G.decal(sim, 'crater', x, y, 30);
      G.decal(sim, 'scorch', x, y, 46);
      for (let i = 0; i < 5; i++) { const a = Math.random() * Math.PI * 2, r = IS.rand(20, 44); G.groundFire(sim, x + Math.cos(a) * r, y + Math.sin(a) * r, IS.rand(4, 8)); }
    }
    for (let i = 0; i < 70; i++) {
      const fire = i < 40;
      sim.fx.add({ x: s.x + IS.rand(-6, 6), y: s.y - 4, vx: IS.rand(-170, 170), vy: IS.rand(-260, -60), g: fire ? 120 : 480, max: IS.rand(0.5, 1.3), color: fire ? IS.pick(['#fff4c8', '#ffd56a', '#ff8a3a', '#e8343f']) : IS.pick(['#6b4a2e', '#8f6540', '#4a3426', '#9aa0a8']), size: fire ? IS.randi(2, 4) : 2, fade: fire, grow: fire && Math.random() < 0.3 });
    }
    for (let i = 0; i < 14; i++) sim.fx.add({ x: s.x + IS.rand(-20, 20), y: s.y - IS.rand(0, 20), vx: IS.rand(-20, 20), vy: IS.rand(-30, -10), g: 0, max: IS.rand(2, 3.5), color: '#5a5060', size: 5, fade: true, grow: true });
    for (const o of sim.people.slice()) {
      const d = IS.dist(o.x, o.y, x, y);
      if (d < TL() * 1.9) { G.kill(sim, o, 'meteor'); continue; }
      if (d < TL() * 5.5 && !o.building && o.mode !== 'dead') {
        const k = (d / TL() - 1.9) / 3.6; // 0 at the crater edge, 1 at the blast edge
        G.fling(sim, o, x, y, 320 - k * 200, 660 - k * 420);
      }
    }
    G.scare(sim, x, y, 15);
    // Survivors get talked about
    const flung = sim.people.filter(o => o.mode === 'air' && IS.dist(o.x, o.y, x, y) < TL() * 7);
    if (flung.length) for (const o of flung.slice(0, 2)) IS.Mind.rally(sim, o, 'flung');
    else { const near = sim.people.slice().sort((a, b) => IS.dist(a.x, a.y, x, y) - IS.dist(b.x, b.y, x, y))[0]; if (near && IS.dist(near.x, near.y, x, y) < TL() * 12) IS.Mind.news(sim, 'meteor', near); }
  };

  // A few onlookers say something about what just happened
  G.witness = (sim, about, lines, radius, skip = []) => {
    let n = 0;
    const now = performance.now();
    for (const o of sim.people) {
      if (o === about || skip.includes(o) || !awake(o) || o.burning || IS.dist(o.x, o.y, about.x, about.y) > TL() * radius || !sameSpace(o, about.x, about.y, about.building)) continue;
      if (o.bubble && o.bubble.until > now) continue;
      if (n++ > 2 || Math.random() < 0.3) continue;
      setTimeout(() => { if (!o.chat) { o.say(IS.pick(lines), 2.4); o.emote('exclaim', 1.4); } }, 400 + Math.random() * 900);
    }
  };

  // Send someone flying away from a point
  G.fling = (sim, o, x, y, sp, vz) => {
    if (o.dead || o.mode === 'carried') return;
    if (o.chat) o.chat.abort(o);
    o.cancelAction();
    const a = Math.atan2(o.y - y, o.x - x) + IS.rand(-0.25, 0.25);
    o.mode = 'air';
    o.vx = Math.cos(a) * sp; o.vy = Math.sin(a) * sp; o.vz = vz;
    o.z = Math.max(o.z, 2);
    o.bounces = 0; o.hardLanding = true; o.thrown = true;
    o.pose = 'carry';
    o.swing = IS.rand(-0.7, 0.7);
    o.say(IS.pick(['AAAAAAAAH!', 'NOOOOOO!', 'WHAT WAS THAT?!', 'I\'M FLYIIIING!', 'MOMMY!']), 1.8);
  };

  // ------------------------------------------------------------ fire
  G.ignite = (sim, p, direct) => {
    if (p.burning || p.dead) return;
    if (p.isWaterHere()) { if (direct) { p.say('Nice try. I\'m literally IN the water.'); p.emote('sweat'); } return; }
    p.burning = IS.rand(6, 7.5);
    p.rainTime = 0;
    if (p.chat) p.chat.abort(p);
    if (p.mode === 'normal' || p.mode === 'recover') { p.cancelAction(); G.panicRun(sim, p); }
    p.emote('exclaim', 2);
    p.say(IS.pick(['AAAH! FIRE! FIRE!', 'I\'M ON FIRE!', 'HOT HOT HOT HOT!', 'WATER! WHERE\'S THE WATER?!']), 2);
    p.skyOpinion = IS.clamp(p.skyOpinion - 20, -100, 100);
    sim.log(`${p.name} burst into flames!`, 'death', [p]);
    for (const o of sim.people) {
      if (o === p || !awake(o) || IS.dist(o.x, o.y, p.x, p.y) > TL() * 9 || !sameSpace(o, p.x, p.y, p.building)) continue;
      if (Math.random() < 0.6) { o.emote('exclaim', 1.6); o.say(IS.pick([`${p.name} is ON FIRE!`, 'Stop, drop and ROLL!', `Get to the water, ${p.name}!`, 'Somebody DO something!']), 2); }
    }
  };

  G.groundFire = (sim, x, y, secs = 6) => {
    if (sim.world.isWater(Math.floor(x / TL()), Math.floor((y - 6) / TL()))) return;
    sim.decals.push({ kind: 'flame', x, y, burn: secs, t: sim.clock.abs });
    G.decal(sim, 'scorch', x, y, 9);
  };

  const nearWater = (w, x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => w.isWater(x + dx, y + dy));

  G.burnTick = (p, rdt, c) => {
    const sim = p.sim, w = sim.world;
    const r = live(sim, rdt);
    if (!r) return;
    if (p.isWaterHere() || (p.mode !== 'air' && nearWater(w, p.tx, p.ty) && Math.random() < r * 6)) { G.extinguish(sim, p, 'water'); return; }
    if (c.weather === 'rain' || c.weather === 'storm') { p.rainTime += r; if (p.rainTime > 2.5) { G.extinguish(sim, p, 'rain'); return; } }
    p.burning -= r;
    const s = IS.Iso.w2s(p.x, p.y);
    if (Math.random() < r * 30) sim.fx.spark(s.x, s.y - p.z - 26);
    if (Math.random() < r * 8) sim.fx.smoke(s.x + IS.rand(-3, 3), s.y - p.z - 34);
    if (Math.random() < r * 0.9) p.say(IS.pick(['AAAAAAAAAH!', 'IT BURNS!', 'HELP ME!', 'WHY?!', 'AAAAH! AAAAAH!']), 1.2);
    for (const o of sim.people) {
      if (o === p || o.burning || IS.dist(o.x, o.y, p.x, p.y) > TL() * 0.8) continue;
      if (Math.random() < r * 1.2) G.ignite(sim, o);
    }
    if (p.burning <= 0) G.kill(sim, p, 'fire');
  };

  G.extinguish = (sim, p, how) => {
    p.burning = 0;
    const s = IS.Iso.w2s(p.x, p.y);
    for (let i = 0; i < 10; i++) sim.fx.add({ x: s.x + IS.rand(-6, 6), y: s.y - 20, vx: IS.rand(-10, 10), vy: IS.rand(-30, -14), g: 0, max: IS.rand(1, 2), color: '#e8e8f0', size: 4, fade: true, grow: true });
    if (how === 'water') sim.fx.splash(p.x, p.y, 16);
    p.wetUntil = sim.clock.abs + 90;
    p.say(IS.pick(how === 'water' ? ['*SPLASH* ...tssssss.', 'I LIVE! I LIVE!', 'Water. Sweet, sweet water.'] : ['The rain! Thank you, rain!', '*tsss* ...I\'m okay. I\'m okay.']), 2.4);
    p.emote('sweat', 2);
    p.addMood('Nearly burned alive', -18, 720);
    p.remember('Got set on fire by the Sky. Survived. Barely.', { tag: 'burned', news: true });
    sim.log(`${p.name} put the fire out. Singed, but alive.`, 'sky', [p]);
    IS.Mind.rally(sim, p, 'burned');
    G.witness(sim, p, ['Phew! They made it!', `${p.name}! Are you okay?!`, 'That was close...'], 9);
    if (p.mode === 'panic') { p.path = []; p.mode = 'recover'; p.recoverUntil = sim.clock.abs + 4; p.pose = 'stand'; }
  };

  // ------------------------------------------------------------ panic
  G.panicRun = (sim, p, fx, fy) => {
    if (!['normal', 'recover', 'panic'].includes(p.mode)) return false;
    const w = sim.world;
    const ok = (x, y) => w.walkable(x, y) && w.reach[w.idx(x, y)] === 1;
    let goal = null;
    if (p.burning && Math.random() < 0.75) goal = w.findNear(p.tx, p.ty, (x, y) => ok(x, y) && nearWater(w, x, y), 12);
    for (let k = 0; !goal && k < 12; k++) {
      const ang = fx !== undefined ? Math.atan2(p.y - fy, p.x - fx) + IS.rand(-0.9, 0.9) : Math.random() * Math.PI * 2;
      const d = IS.rand(5, 9);
      const tx = Math.round(p.tx + Math.cos(ang) * d), ty = Math.round(p.ty + Math.sin(ang) * d);
      if (ok(tx, ty)) goal = { x: tx, y: ty };
    }
    if (!goal) return false;
    const path = w.findPath(p.tx, p.ty, goal.x, goal.y);
    if (!path || !path.length) return false;
    if (p.chat) p.chat.abort(p);
    p.cancelAction();
    p.path = path;
    p.mode = 'panic';
    return true;
  };

  G.updatePanic = (p, rdt, c) => {
    const r = live(p.sim, rdt);
    if (p.path.length) { if (r) p.moveAlong(r * (p.burning ? 2.4 : 2)); return; }
    if (p.burning && G.panicRun(p.sim, p)) return;
    p.mode = 'recover';
    p.recoverUntil = c.abs + IS.rand(4, 9);
    p.pose = 'stand';
    p.emote('sweat', 2);
    p.thought = IS.pick(['Is it over? Is it safe?', 'Don\'t look up. Don\'t look up.', 'What did we DO to deserve this?']);
  };

  // Everyone nearby panics and runs from a point
  G.scare = (sim, x, y, radius) => {
    const now = performance.now();
    for (const o of sim.people.slice()) {
      if (!awake(o) || o.burning || o.mode === 'panic') continue;
      if (o.mourning && Object.values(o.mourning).some(e => e.aware && e.how === 'saw' && sim.clock.abs - e.t < 3 && (e.partner || e.f > 40))) continue;
      const d = IS.dist(o.x, o.y, x, y);
      if (d > TL() * radius || o.building) continue;
      o.skyOpinion = IS.clamp(o.skyOpinion - 4, -100, 100);
      o.emote('exclaim', 1.6);
      if (!o.bubble || o.bubble.until < now) o.say(IS.pick(['RUN!', 'What was THAT?!', 'The sky is angry!', 'Everybody inside!', 'AAAAH!', 'Not today, not today!']), 1.8);
      if (o.traits.brave < 0.85 || d < TL() * radius * 0.4) G.panicRun(sim, o, x, y);
    }
  };

  // ------------------------------------------------------------ bless
  G.bless = (sim, p, w) => {
    const x = p ? p.x : w.x, y = p ? p.y : w.y;
    if (!p && IS.Build.siteAt(sim, x, y)) { const s0 = IS.Iso.w2s(x, y); sim.godFx.push({ kind: 'beam', color: [255, 226, 138], x: s0.x, y: s0.y, t: 0, max: 1.4, w: 40 }); IS.Build.onBless(sim, x, y); return; }
    const s = IS.Iso.w2s(x, y);
    sim.godFx.push({ kind: 'beam', color: [255, 226, 138], x: s.x, y: s.y, t: 0, max: 1.4, w: p ? 18 : 40 });
    for (let i = 0; i < 26; i++) sim.fx.add({ x: s.x + IS.rand(-16, 16), y: s.y - IS.rand(0, 30), vx: IS.rand(-6, 6), vy: IS.rand(-40, -15), g: 0, max: IS.rand(0.8, 1.6), color: IS.pick(['#fff6c8', '#ffe07a', '#ffffff']), size: 1, fade: true });
    const targets = p ? [p] : sim.people.filter(o => IS.dist(o.x, o.y, x, y) < TL() * 2.5);
    let grew = 0;
    for (const cr of sim.world.crops) if (IS.dist(cr.x * TL() + 12, cr.y * TL() + 18, x, y) < TL() * 3 && cr.growth < 1) { cr.growth = 1; grew++; }
    if (grew) sim.log(`Golden light washed over the garden. ${grew} crop${grew > 1 ? 's' : ''} ripened at once.`, 'sky');
    if (!targets.length) { if (!grew) sim.toast('The light finds nobody there.'); return; }
    for (const o of targets) {
      const n = o.needs;
      n.hunger = Math.max(n.hunger, 92); n.energy = Math.max(n.energy, 92); n.fun = Math.max(n.fun, 88); n.social = Math.min(100, n.social + 30);
      if (o.sick) { o.sick = false; o.say('My cold... it\'s GONE!'); }
      if (o.burning) G.extinguish(sim, o, 'rain');
      o.addMood('Blessed by the Sky', 18, 720);
      o.skyOpinion = IS.clamp(o.skyOpinion + 14, -100, 100);
      o.emote('sparkle', 2.5);
      if (!o.sick) o.say(IS.pick(o.skyOpinion < -40 ? ['...why are you being nice now?', 'Is this a trick?', 'I don\'t trust this. But I feel AMAZING.'] : ['I feel... AMAZING!', 'Warm. So warm.', 'Thank you, Sky!', 'Is this what heaven feels like?', 'I could run a marathon. I won\'t. But I could.']), 2.6);
      o.remember('Was blessed by the Sky. Felt incredible.', { tag: 'blessed', news: true });
    }
    IS.Mind.news(sim, 'blessed', targets[0]);
    IS.Love.onBless(sim, targets);
    G.witness(sim, targets[0], ['Did you SEE that light?!', 'Whoa... it\'s glowing!', 'Why does nobody bless ME?', 'Is that... a good sign?'], 10, targets);
    sim.log(targets.length === 1 ? `The Sky blessed ${targets[0].name}.` : `The Sky blessed ${targets.map(o => o.name).join(', ')}.`, 'sky', targets);
  };

  // ------------------------------------------------------------ gore
  const BLOOD = ['#5e0a10', '#7a0c12', '#9a1219', '#b3141e', '#c42a2a'];
  G.blood = (sim, x, y, h, n, spread = 1) => {
    const s = IS.Iso.w2s(x, y);
    for (let i = 0; i < n; i++) {
      sim.fx.add({ x: s.x + IS.rand(-3, 3), y: s.y - h, vx: IS.rand(-90, 90) * spread, vy: IS.rand(-170, -30) * spread, g: 460, max: IS.rand(3, 6), color: IS.pick(BLOOD), size: Math.random() < 0.3 ? 2 : 1, gy: s.y + IS.rand(-5, 6), stick: true });
    }
  };
  G.gibs = (sim, p) => {
    const s = IS.Iso.w2s(p.x, p.y);
    const look = p.cfg.look || {};
    const cols = [...BLOOD, ...BLOOD, '#e9e1d0', '#e9e1d0', look.skin || '#e8b48a', look.shirt || '#6a8fd0', look.hair || '#4a3020'];
    for (let i = 0; i < 70; i++) {
      sim.fx.add({ x: s.x + IS.rand(-4, 4), y: s.y - IS.rand(4, 20), vx: IS.rand(-200, 200), vy: IS.rand(-300, -60), g: 520, max: IS.rand(4, 7), color: IS.pick(cols), size: IS.randi(1, 3), gy: s.y + IS.rand(-24, 24), stick: true });
    }
    for (let i = 0; i < 6; i++) { const a = Math.random() * Math.PI * 2, r = IS.rand(8, 50); G.decal(sim, 'blood', p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * 0.8, IS.rand(5, 11)); }
  };

  // Ground marks drawn under everything (blood, scorch, craters)
  G.decal = (sim, kind, x, y, r) => {
    if (kind !== 'flame' && sim.world.isWater(Math.floor(x / TL()), Math.floor((y - 6) / TL()))) return;
    const life = 1440; // everything washes away in about a day
    sim.decals.push({ kind, x, y, r, t: sim.clock.abs, life, img: decalImage(kind, r), born: performance.now() });
    if (sim.decals.length > 120) sim.decals.splice(sim.decals.findIndex(d => d.kind !== 'flame'), 1);
  };
  const decalImage = (kind, r) => {
    const W = Math.ceil(r * 2.4) + 6, H = Math.ceil(r * 1.3) + 6;
    const { c, g } = IS.makeCanvas(W, H);
    const cx = W / 2, cy = H / 2;
    const blob = (bx, by, br, col, rough = 0.25) => {
      for (let yy = Math.floor(by - br); yy <= by + br; yy++) for (let xx = Math.floor(bx - br * 2); xx <= bx + br * 2; xx++) {
        const dx = (xx - bx) / (br * 2), dy = (yy - by) / br;
        if (dx * dx + dy * dy < 1 - Math.random() * rough) { g.fillStyle = col; g.fillRect(xx, yy, 1, 1); }
      }
    };
    if (kind === 'blood') {
      blob(cx, cy, r * 0.5, BLOOD[1]);
      for (let i = 0; i < 4 + r / 3; i++) blob(cx + IS.rand(-r, r) * 0.8, cy + IS.rand(-r, r) * 0.3, IS.rand(r * 0.12, r * 0.32), IS.pick(BLOOD.slice(0, 4)));
      blob(cx - r * 0.2, cy - r * 0.1, r * 0.18, BLOOD[3], 0.5);
      for (let i = 0; i < r * 1.5; i++) { g.fillStyle = IS.pick(BLOOD); g.fillRect(Math.round(cx + IS.rand(-r * 1.15, r * 1.15)), Math.round(cy + IS.rand(-r * 0.6, r * 0.6)), 1, 1); }
    } else if (kind === 'scorch') {
      blob(cx, cy, r * 0.5, 'rgba(26, 18, 20, 0.55)', 0.4);
      blob(cx, cy, r * 0.32, 'rgba(18, 12, 14, 0.7)', 0.3);
      for (let i = 0; i < r; i++) { g.fillStyle = IS.pick(['#3a3036', '#5a5058', '#26201f']); g.fillRect(Math.round(cx + IS.rand(-r, r)), Math.round(cy + IS.rand(-r / 2, r / 2)), 1, 1); }
    } else if (kind === 'crater') {
      blob(cx, cy, r * 0.5, '#6b4a2e', 0.15);
      blob(cx, cy + 1, r * 0.4, '#4a3426', 0.15);
      blob(cx, cy + 2, r * 0.28, '#2a1c14', 0.2);
      for (let i = 0; i < r / 2; i++) { g.fillStyle = IS.pick(['#ff7a2a', '#ffb03a', '#e8343f']); g.fillRect(Math.round(cx + IS.rand(-r * 0.45, r * 0.45)), Math.round(cy + 2 + IS.rand(-r * 0.15, r * 0.15)), 1, 1); }
    }
    return c;
  };

  // ------------------------------------------------------------ death
  const CAUSE = {
    smite: { log: n => `${n} was struck down by lightning.`, word: 'Struck by lightning' },
    meteor: { log: n => `A meteor hit ${n}. There wasn't much left.`, word: 'Hit by a meteor' },
    fire: { log: n => `${n} burned to death.`, word: 'Burned' },
    fall: { log: n => `${n} was thrown too hard and hit the ground. Splat.`, word: 'Thrown too hard' },
  };
  G.causeWord = c => (CAUSE[c] || { word: 'Died' }).word;

  G.kill = (sim, p, cause) => {
    if (p.dead) return;
    const pr = sim.input && sim.input.press;
    if (pr && pr.person === p) sim.input.press = null;
    if (p.chat) p.chat.abort(p);
    p.cancelAction();
    const w = sim.world;
    const inWater = p.isWaterHere();
    const building = p.building;
    p.dead = true; p.burning = 0; p.mode = 'dead'; p.bubble = null; p.emoteData = null; p.path = [];
    const i = sim.people.indexOf(p);
    if (i >= 0) sim.people.splice(i, 1);

    // Where the body lies, and where the grave will go (outside, on land)
    const outdoorOk = (x, y) => w.walkable(x, y) && w.reach[w.idx(x, y)] === 1 && !w.buildingAt(x, y) && !sim.graves.some(g => g.stage === 'grave' && Math.floor(g.x / TL()) === x && Math.floor((g.y - 6) / TL()) === y);
    const gt = w.findNear(p.tx, p.ty, outdoorOk, 30) || { x: p.tx, y: p.ty };
    const onLand = !inWater && w.walkable(p.tx, p.ty);
    const g = {
      name: p.name, p, cause, day: sim.clock.day, season: sim.clock.season, t: sim.clock.abs, born: performance.now(),
      x: onLand ? p.x : gt.x * TL() + 12, y: onLand ? p.y : gt.y * TL() + 18,
      gx: gt.x * TL() + 12, gy: gt.y * TL() + 18,
      stage: !onLand ? 'lost' : cause === 'meteor' ? 'remains' : 'body',
      building: onLand ? building : null, flowers: 0, flip: Math.random() < 0.5,
    };
    sim.graves.push(g);

    // Gore
    const s = IS.Iso.w2s(p.x, p.y);
    if (cause === 'meteor') G.gibs(sim, p);
    else if (cause === 'fall') { G.blood(sim, p.x, p.y, 4, 45, 1.2); G.decal(sim, 'blood', p.x, p.y, 15); }
    else if (cause === 'smite') { G.blood(sim, p.x, p.y, 14, 10, 0.6); G.decal(sim, 'scorch', p.x, p.y, 12); }
    else if (cause === 'fire') { for (let k = 0; k < 16; k++) sim.fx.add({ x: s.x + IS.rand(-6, 6), y: s.y - IS.rand(4, 24), vx: IS.rand(-20, 20), vy: IS.rand(-40, -10), g: 0, max: IS.rand(1.5, 3), color: IS.pick(['#3a3036', '#5a5058', '#8a8088']), size: 2, fade: true }); G.decal(sim, 'scorch', p.x, p.y, 12); }
    if (onLand && cause !== 'meteor') setTimeout(() => { if (g.stage === 'body') G.decal(sim, 'blood', g.x + 4, g.y + 2, cause === 'fall' ? 12 : 8); }, 600);
    if (inWater) { sim.fx.splash(p.x, p.y, 20); }
    sim.godFx.push({ kind: 'ghost', p, x: s.x, y: s.y - p.z, t: 0, max: 3.4 });

    G.grieve(sim, p, g, building);
    G.forget(sim, p);
    sim.deaths++; sim.lastDeathAt = sim.clock.abs;
    sim.log(CAUSE[cause] ? CAUSE[cause].log(p.name) : `${p.name} died.`, 'death', [p]);
    sim.toast(`${p.name} is dead.`);
    if (sim.selected === p) sim.select(null);
    if (sim.hover === p) sim.hover = null;
    if (sim.ui) { sim.ui.forget(p); sim.ui.panels(); }
    if (!sim.people.length) { sim.log('The island is silent. Nobody is left.', 'death'); sim.toast('Everyone is gone. Revive can still bring them back.'); }
  };

  const SEEN = {
    smite: n => [`${n} just got FRIED!`, 'The sky just KILLED them!', `${n}?! ${n}!!`, 'I can smell it. Oh no, I can SMELL it.'],
    meteor: n => ['THEY EXPLODED!', `${n} is... everywhere.`, 'There\'s nothing LEFT of them!', 'Is that a... is that an ARM?!'],
    fire: n => [`${n}... no...`, 'I can still hear the screaming.', 'Oh no oh no oh no.', 'Somebody should have gotten WATER!'],
    fall: n => [`${n} hit the ground SO hard.`, 'I heard the crunch...', 'Is... is that blood?', `${n} isn't getting up. Why isn't ${n} getting up?`],
  };
  const VOICE = {
    Iroh: { sad: ['Okay. That is NOT funny. Not even I can joke about that.'], cold: ['Respectfully... skill issue.', 'Tragic. Anyway.'] },
    Beach: { sad: ['No. No no no. Not like this.'], cold: ['Ew. Is that on my shoes?!', 'Somebody clean that up. Not me.'] },
    Egg: { sad: ['Biscuit, don\'t look.', 'I... I need to lie down.'], cold: ['...I was napping.'] },
    Jude: { sad: ['Yo... YO. What the hell?!', 'Nah. Nah, man. Get up.'], cold: ['Can\'t say I\'ll miss them.'] },
    Forest: { sad: ['Get up. GET UP. You\'re stronger than this!', 'No... I should have been faster.'], cold: ['Weak.'] },
    Lynn: { sad: ['I— I can help! Can I help?! ...oh.', 'Please, please be okay...'], cold: ['...I don\'t know what to feel.'] },
  };

  // At the moment of death only the witnesses know. Everyone else finds out
  // later: by finding the body, being told, or hearing it around the island.
  G.grieve = (sim, dead, g, building) => {
    const M = IS.Mind, N = dead.name;
    dead.stash = {};
    for (const o of sim.people) {
      const r = o.rel[N] || { friendship: 0, romance: 0, partner: false };
      const f = r.friendship, rom = r.romance;
      o.mourning = o.mourning || {};
      o.mourning[N] = { f: Math.max(f, rom), partner: !!r.partner, cause: g.cause, died: sim.clock.abs, aware: false, t: 0, stage: 'unaware', visited: f < 15 && !r.partner };
      const seen = awake(o) && IS.dist(o.x, o.y, dead.x, dead.y) < TL() * 13 && sameSpace(o, dead.x, dead.y, building);
      if (seen) {
        const close = r.partner || f > 40;
        const cold = f < -30;
        const v = VOICE[o.name];
        let pool;
        if (v && Math.random() < 0.45) pool = close || f > 5 ? v.sad : cold ? v.cold : v.sad;
        else if (close) pool = [`${N}!!! NO!!!`, `NO NO NO. ${N}!`, `${N}... no... no...`, `Not ${N}. Please, not ${N}.`];
        else if (cold) pool = ['Huh. Called it.', 'Well. That happened.', 'Not my problem.'];
        else pool = (SEEN[g.cause] || SEEN.fall)(N);
        o.say(IS.pick(pool), 3);
        o.emote(close ? 'sad' : 'exclaim', 2.4);
        G.learnDeath(sim, o, N, 'saw');
      }
      // Move the bond aside so nothing talks to (or about) them like they're alive
      if (o.rel[N]) { dead.stash[o.name] = o.rel[N]; delete o.rel[N]; }
      if (o.pending) delete o.pending[N];
      if (o.avoid) delete o.avoid[N];
      for (const pl of o.plans || []) if (!pl.done && (pl.who === N || pl.with === N)) { pl.done = true; pl.gaveUp = true; }
      if (o.emotion && o.emotion.about === N && !['heartbroken', 'shocked'].includes(o.emotion.type)) M.clearFeeling(o);
      if (o.action && (o.action.follow === dead || o.action.with === N)) o.cancelAction();
    }
    // The dead also let go of anyone already dead
    for (const g2 of sim.graves) if (g2.p !== dead && dead.rel[g2.name]) { g2.p.stash[N] = dead.rel[g2.name]; delete dead.rel[g2.name]; }
  };

  // Someone finds out. how: saw | found | told | heard
  G.learnDeath = (sim, o, N, how, from) => {
    const e = o.mourning && o.mourning[N];
    if (!e || e.aware) return false;
    if (sim.byName(N)) { delete o.mourning[N]; return false; } // they're alive again: old news
    e.aware = true; e.t = sim.clock.abs; e.how = how;
    e.sawBody = how === 'saw' || how === 'found';
    const g = sim.graves.find(x => x.name === N);
    if (g && !g.foundAt) g.foundAt = sim.clock.abs;
    const f = e.f, close = e.partner || f > 40;
    const how2 = { saw: `Watched ${N} die.`, found: `Found ${N}'s body.`, told: `${from ? from.name : 'Someone'} told me ${N} is dead.`, heard: `Heard that ${N} died.` }[how];
    if (e.partner) o.remember(`${how2} The love of my life.`, { tag: 'death', about: N, mood: -30, moodDuration: 2880 });
    else if (close) o.remember(`${how2} I can't believe it.`, { tag: 'death', about: N, mood: -18, moodDuration: 1440 });
    else if (f > 5) o.remember(how2, { tag: 'death', about: N, mood: -8, moodDuration: 720 });
    else if (f < -30 && o.traits.kind < 0.55) o.remember(`${how2} Can't say I'm crying.`, { tag: 'death', about: N, mood: 3, moodDuration: 360 });
    else o.remember(how2, { tag: 'death', about: N, mood: -4, moodDuration: 360 });
    o.skyOpinion = IS.clamp(o.skyOpinion - ({ saw: 22, found: 16 }[how] || 10) - (close ? 12 : 0), -100, 100);
    G.setStage(sim, o, N, e, G.stageFor(e, sim.clock.abs));
    // People who cared drop everything and go to the body
    if ((how === 'saw' || how === 'found') && (close || f > 10) && o.mode === 'normal') { if (o.chat) o.chat.abort(o); o.cancelAction(); }
    else if (how !== 'saw' && close) sim.nudge(o, 0.9);
    return true;
  };

  // Shock, then (for the people closest) anger at the Sky, then sadness, then acceptance
  G.stageFor = (e, now) => {
    if (!e.aware) return 'unaware';
    const h = (now - e.t) / 60;
    const close = e.partner || e.f > 40, mid = e.f > 5;
    if (!close && !mid) return h < 1 ? 'shock' : 'done';
    if (h < (close ? 3 : 2)) return 'shock';
    if (close && h < 8) return 'anger';
    if (h < (close ? 48 : 24)) return 'sadness';
    if (h < (close ? 96 : 48)) return 'acceptance';
    return 'done';
  };
  G.setStage = (sim, o, N, e, st) => {
    const M = IS.Mind;
    e.stage = st;
    if (o.emotion && o.emotion.about === N) M.clearFeeling(o);
    const close = e.partner || e.f > 40;
    if (st === 'shock' && e.f > -30) { M.feel(o, 'shocked', N, close ? 3 : 2); o.thought = IS.pick([`${N} can't be gone. They were just here.`, 'This isn\'t real. This isn\'t happening.', `Wait. ${N}? No...`]); }
    else if (st === 'anger') { M.feel(o, 'furious', N, 5); o.thought = IS.pick([`The Sky took ${N}. Why?!`, 'I hate it. I hate whatever is up there.', `${N} didn't deserve this.`]); }
    else if (st === 'sadness' && e.f > 5) M.feel(o, close ? 'heartbroken' : 'grieving', N, close ? 40 : 22);
    else if (st === 'acceptance') { o.addMood(`Making peace with losing ${N}`, -3, 1440); o.thought = IS.pick([`I think ${N} would want us to be okay.`, `I still miss ${N}. But it hurts a little less.`]); }
  };

  // Grief ticks along once per game minute
  const griefTick = sim => {
    const now = sim.clock.abs;
    for (const o of sim.people) {
      if (!o.mourning) continue;
      for (const [N, e] of Object.entries(o.mourning)) {
        if (!e.aware) {
          // Word gets around eventually, even if nobody tells you directly
          if (now - e.died > 480 && awake(o) && Math.random() < 0.02) G.learnDeath(sim, o, N, 'heard');
          continue;
        }
        const st = G.stageFor(e, now);
        if (st !== e.stage) G.setStage(sim, o, N, e, st);
        // Go find someone who hasn't heard yet, the people who loved them first
        if ((st === 'shock' || st === 'anger' || st === 'sadness') && now - e.t > 5 && IS.Social.isFree(o) && !o.chat && awake(o) && Math.random() < 0.04) {
          const who = sim.people.filter(x => x !== o && x.mourning && x.mourning[N] && !x.mourning[N].aware && x.pose !== 'sleep' && x.mode === 'normal' && x.canBeVisited(o))
            .sort((a, b) => b.mourning[N].f - a.mourning[N].f)[0];
          if (who) { IS.Social.approach(sim, o, who, 'breakNews', true, { dead: N, cause: e.cause }); o.thought = `${who.name} doesn't know about ${N} yet. I have to tell them.`; }
        }
        if (st === 'anger' && awake(o) && !o.chat && Math.random() < 0.012) {
          o.say(IS.pick([`WHY, SKY?! WHY ${N.toUpperCase()}?!`, `You hear me up there?! Give ${N} BACK!`, 'I hope you\'re happy, Sky!', `${N} never hurt anyone!`]), 3);
          o.emote('anger', 2.4);
          o.skyOpinion = IS.clamp(o.skyOpinion - 2, -100, 100);
        }
      }
    }
    // Spreading good news: the revived person looks for the people they love,
    // and anyone who knows tells whoever is still grieving
    for (const o of sim.people) {
      if (!awake(o) || o.chat || !IS.Social.isFree(o) || o.mode !== 'normal' || Math.random() > 0.05) continue;
      const fresh = o.revivedAt && now - o.revivedAt > 30 && now - o.revivedAt < 1440;
      const pairs = [];
      if (fresh) for (const x of sim.people) if (x !== o && x.revived && x.revived[o.name] && !x.revived[o.name].aware && !x.revived[o.name].never) pairs.push({ to: x, topic: 'imBack', w: x.relTo(o.name).friendship + 30 });
      for (const [N, e] of Object.entries(o.revived || {})) {
        if (!e.aware || e.never || now - e.t > 1440) continue;
        for (const x of sim.people) if (x !== o && x.name !== N && x.revived && x.revived[N] && !x.revived[N].aware && !x.revived[N].never) pairs.push({ to: x, topic: 'reviveNews', dead: N, w: x.relTo(N).friendship });
      }
      const pick = pairs.filter(q => q.to.pose !== 'sleep' && q.to.mode === 'normal' && q.to.canBeVisited(o)).sort((a, b) => b.w - a.w)[0];
      if (pick) { IS.Social.approach(sim, o, pick.to, pick.topic, true, pick.dead ? { dead: pick.dead } : {}); o.thought = pick.topic === 'imBack' ? `${pick.to.name} still thinks I'm dead. I have to find them.` : `${pick.to.name} doesn't know ${pick.dead} is back!`; }
    }
    // Running into someone you thought was dead
    for (const o of sim.people) {
      for (const [N, e] of Object.entries(o.revived || {})) {
        if (e.aware) continue;
        const p = sim.byName(N);
        if (!p) continue;
        if (awake(o) && awake(p) && sameSpace(o, p.x, p.y, p.building) && IS.dist(o.x, o.y, p.x, p.y) < TL() * 5) G.learnRevive(sim, o, N, 'met');
        else if (now - e.t > 360 && awake(o) && Math.random() < 0.02) G.learnRevive(sim, o, N, 'heard');
      }
    }
    // Stumbling on a body
    for (const g of sim.graves.slice()) {
      // Nobody ever dealt with it: someone quietly takes care of it
      if (g.stage !== 'grave' && now - g.t > 1440 && !g.burier) { bury(sim, g, null); continue; }
      if (g.stage !== 'body' && g.stage !== 'remains') continue;
      for (const o of sim.people) {
        const e = o.mourning && o.mourning[g.name];
        if (!e || !awake(o) || o.mode === 'panic' || !sameSpace(o, g.x, g.y, g.building) || IS.dist(o.x, o.y, g.x, g.y) > TL() * 6) continue;
        if (!e.aware) {
          const close = e.partner || e.f > 40;
          o.say(IS.pick(close ? [`${g.name}?! ${g.name}!! NO!`, `No no no no. Not ${g.name}.`, `${g.name}... wake up. Please.`] : g.stage === 'remains' ? ['What IS that? Is that... oh no.', 'Is that a person? Was that a PERSON?!'] : [`Is that... ${g.name}?!`, 'Oh no. Oh no no no.', `Somebody help! It's ${g.name}!`]), 3);
          o.emote(close ? 'sad' : 'exclaim', 2.4);
          G.learnDeath(sim, o, g.name, 'found');
        } else if (!e.sawBody) {
          e.sawBody = true;
          if (e.f > 10) { o.say(IS.pick([`So it's true... ${g.name}.`, `Oh, ${g.name}...`, 'I didn\'t want to believe it.']), 2.6); o.emote('sad', 2); }
        }
      }
    }
  };

  // Who still needs to see the body, who digs, who comes to the funeral
  G.bodyToSee = p => {
    for (const [N, e] of Object.entries(p.mourning || {})) {
      if (!e.aware || e.atBody || !(e.partner || e.f > 10) || !['shock', 'anger', 'sadness'].includes(e.stage)) continue;
      const g = p.sim.graves.find(x => x.name === N && (x.stage === 'body' || x.stage === 'remains'));
      if (g) return { name: N, entry: e, grave: g };
    }
    return null;
  };
  G.bodyToBury = p => {
    const now = p.sim.clock.abs;
    for (const g of p.sim.graves) {
      if (g.stage === 'grave' || g.burier || !g.foundAt || now - g.foundAt < 45) continue;
      const e = p.mourning && p.mourning[g.name];
      if (!e || !e.aware || e.stage === 'shock') continue;
      return { name: g.name, entry: e, grave: g };
    }
    return null;
  };
  G.funeralFor = p => {
    for (const g of p.sim.graves) {
      if (!g.burier || g.burier === p.name) continue;
      const e = p.mourning && p.mourning[g.name];
      if (e && e.aware && !e.funeral && e.f > 0) return { name: g.name, entry: e, grave: g };
    }
    return null;
  };
  G.startBurial = (sim, g, p) => {
    g.burier = p.name;
    if (!g.digLogged) { g.digLogged = true; sim.log(`${p.name} started digging a grave for ${g.name}.`, 'event', [p]); }
    for (const o of sim.people) if (o !== p && G.funeralFor(o) && o.mode === 'normal') sim.nudge(o, 0.85);
  };
  G.stopBurial = g => { g.burier = null; };

  G.forget = (sim, dead) => {
    const N = dead.name;
    sim.news = (sim.news || []).filter(n => n.a !== N && n.b !== N);
    for (const ev of sim.events.list) {
      if (ev.attendees) ev.attendees.delete(N);
      if (ev.state === 'upcoming' && ev.birthday === N) {
        ev.state = 'done';
        sim.log(`${ev.name} won't be happening.`, 'warn');
      }
    }
  };

  const bury = (sim, g, by) => {
    g.stage = 'grave';
    g.x = g.gx; g.y = g.gy; g.building = null; g.burier = null;
    const came = sim.people.filter(o => o !== by && o.action && o.action.def.id === 'funeral' && o.action.grave === g);
    for (const o of came) { o.mourning[g.name].funeral = true; }
    if (by) sim.log(`${by.name} buried ${g.name}.${came.length ? ` ${came.map(o => o.name).join(', ')} came to say goodbye.` : ''}`, 'event', [by]);
    else sim.log(`Someone quietly buried ${g.name}.`, 'event');
  };
  G.bury = bury;
  G.forget = (sim, dead) => {
    const N = dead.name;
    sim.news = (sim.news || []).filter(n => n.a !== N && n.b !== N);
    for (const ev of sim.events.list) {
      if (ev.attendees) ev.attendees.delete(N);
      if (ev.state === 'upcoming' && ev.birthday === N) {
        ev.state = 'done';
        sim.log(`${ev.name} won't be happening.`, 'warn');
      }
    }
  };


  // ------------------------------------------------------------ revive
  G.revive = (sim, g) => {
    if (g.rising) return;
    g.rising = true;
    const s = IS.Iso.w2s(g.x, g.y);
    sim.godFx.push({ kind: 'beam', color: [232, 251, 255], x: s.x, y: s.y, t: 0, max: 2, w: 24, grave: g });
    sim.shake = Math.max(sim.shake, 3);
    for (const o of sim.people) if (awake(o) && IS.dist(o.x, o.y, g.x, g.y) < TL() * 12 && Math.random() < 0.6) { o.emote('exclaim', 1.6); o.say(IS.pick(['What\'s happening at the grave?!', 'The light... it\'s so bright!', 'Is that... coming from the ground?']), 1.8); }
  };

  G.rise = (sim, g) => {
    const p = g.p, N = p.name, w = sim.world;
    const gi = sim.graves.indexOf(g);
    if (gi >= 0) sim.graves.splice(gi, 1);
    for (const o of sim.people) if (o.action && o.action.grave === g) o.cancelAction();
    const tx = Math.floor(g.x / TL()), ty = Math.floor((g.y - 6) / TL());
    const spot = w.walkable(tx, ty) ? { x: tx, y: ty } : w.nearestWalkable(tx, ty);
    p.setTile(spot.x, spot.y);
    p.dead = false; p.mode = 'recover'; p.recoverUntil = sim.clock.abs + 6; p.pose = 'stand'; p.z = 0;
    p.action = null; p.chat = null; p.path = []; p.burning = 0; p.sick = false;
    Object.assign(p.needs, { hunger: 60, energy: 70, social: 35, fun: 50 });
    sim.people.push(p);
    sim.people.sort((a, b) => a.id - b.id);
    // Bonds come back (unless someone moved on). Only people who saw it know yet:
    // everyone else keeps grieving until they meet them, get told, or hear it.
    for (const o of sim.people) {
      if (o === p) continue;
      const r = (p.stash && p.stash[o.name]) || { friendship: 0, romance: 0, label: '', partner: false };
      o.rel[N] = r;
      if (r.partner) {
        const now = o.partner();
        if (now && now !== p) { r.partner = false; p.relTo(o.name).partner = false; }
      }
      o.revived = o.revived || {};
      o.revived[N] = { aware: false, t: sim.clock.abs, f: r.friendship, partner: !!r.partner };
      // Never even heard they died: nothing to find out
      if (!(o.mourning && o.mourning[N] && o.mourning[N].aware)) { if (o.mourning) delete o.mourning[N]; o.revived[N].aware = true; o.revived[N].never = true; continue; }
      const seen = awake(o) && IS.dist(o.x, o.y, p.x, p.y) < TL() * 13 && !o.building;
      if (seen) G.learnRevive(sim, o, N, 'saw');
    }
    p.stash = {};
    p.revivedAt = sim.clock.abs;
    p.deathCause = g.cause;
    p.skyOpinion = IS.clamp(-30 + p.traits.brave * 70, -100, 100);
    p.remember(`Died (${G.causeWord(g.cause).toLowerCase()}). Then the Sky brought me back.`, { tag: 'revived', news: true, mood: 8, moodDuration: 720 });
    p.emote('sparkle', 3);
    const lines = ({
      smite: ['...did I just get hit by LIGHTNING?', 'My hair is standing up. Why is my hair standing up?'],
      meteor: ['I was in SO many pieces.', 'I can feel all my bits again. Weird.'],
      fire: ['Why do I smell like barbecue?', 'Never. Again.'],
      fall: ['My everything hurts. Like, everything.', 'The ground was... very hard.'],
    }[g.cause] || ['Was I... dead?']).concat(['I saw a light. Then a hand.', 'Being dead was very quiet. Would not recommend.']);
    p.say(IS.pick(lines), 3);
    IS.Mind.feel(p, 'dazed', null, 1.5);
    p.thought = IS.pick(['Where... am I? Why is there dirt in my hair?', 'I was dead. I was DEAD.', 'Everything is so bright.']);
    const loved = sim.people.filter(o => o !== p && (p.relTo(o.name).partner || p.relTo(o.name).friendship > 35)).sort((a, b) => p.relTo(b.name).friendship - p.relTo(a.name).friendship);
    for (const o of loved.slice(0, 3)) IS.Mind.addPlan(p, { kind: 'talk', who: o.name, topic: 'imBack', text: `Find ${o.name} and tell them I'm alive` });
    const s = IS.Iso.w2s(p.x, p.y);
    for (let i = 0; i < 30; i++) sim.fx.add({ x: s.x + IS.rand(-10, 10), y: s.y - IS.rand(0, 30), vx: IS.rand(-20, 20), vy: IS.rand(-60, -20), g: 0, max: IS.rand(0.8, 1.6), color: IS.pick(['#ffffff', '#e8fbff', '#bff6ff']), size: 1, fade: true });
    sim.log(`${N} rose from the grave!`, 'sky', [p]);
    sim.toast(`${N} is back!`);
    if (sim.ui) { sim.ui.panels(); }
  };

  // Someone finds out a dead friend is back. how: saw | met | told | heard
  G.learnRevive = (sim, o, N, how, from) => {
    const e = o.revived && o.revived[N];
    if (!e || e.aware) return false;
    const p = sim.byName(N);
    if (!p) return false;
    e.aware = true; e.t = sim.clock.abs; e.how = how;
    const r = o.relTo(N), f = r.friendship, close = r.partner || f > 40;
    const grieved = o.mourning && o.mourning[N] && o.mourning[N].aware;
    if (o.mourning) delete o.mourning[N];
    if (IS.Mind.feeling(o) && o.emotion.about === N) IS.Mind.clearFeeling(o);
    o.memories = o.memories.filter(m => !(m.tag === 'death' && m.about === N));
    o.moodMods = o.moodMods.filter(m => !(m.label.includes(N) && /died|Lost|dead|goodbye|Buried|peace/i.test(m.label)));
    const how2 = { saw: `Watched ${N} rise from the grave!`, met: `Ran into ${N}. ALIVE.`, told: `${from ? from.name : 'Someone'} told me ${N} is alive again!`, heard: `Heard ${N} came back from the dead.` }[how];
    o.remember(how2, { tag: 'miracle', about: N, news: true, mood: close ? 22 : f > 10 ? 8 : f < -30 ? -3 : 2, moodDuration: close ? 1440 : 600 });
    o.skyOpinion = IS.clamp(o.skyOpinion + (close ? 18 : f > 10 ? 8 : 2), -100, 100);
    if (close) IS.Mind.feel(o, 'overjoyed', N, 8);
    if (how === 'saw' || how === 'met') {
      o.emote(close ? 'heart' : f < -30 ? 'anger' : 'exclaim', 2.6);
      o.say(IS.pick(close ? [`${N}?! ${N}!!! You're ALIVE!`, grieved ? 'I buried you! I BURIED you!' : `${N}! I thought I lost you!`, 'IT\'S A MIRACLE!', `Come here, you idiot!`]
        : f < -30 ? ['Oh great. They\'re back.', 'Of course. Of COURSE.', 'Can\'t even stay dead properly.']
        : o.traits.brave < 0.45 ? ['GHOST! GHOOOST!', 'Stay back! Are you a zombie?!', 'That\'s not natural!'] : [`${N}? You're... walking?`, 'Wait. WAIT. You were dead!', 'Okay, I need to sit down.']), 3);
      if (f < 15 && o.traits.brave < 0.45 && how === 'saw') G.panicRun(sim, o, p.x, p.y);
    }
    // The people who loved them go and see for themselves
    if (close && o !== p && !o.chat && IS.Social.isFree(o) && o.mode === 'normal') IS.Social.approach(sim, o, p, 'backFromDead', true);
    else if (close) IS.Mind.addPlan(o, { kind: 'talk', who: N, topic: 'backFromDead', text: `See ${N} with my own eyes` });
    if (close && (how === 'told' || how === 'heard')) sim.log(`${o.name} heard ${N} is alive and ran to find them.`, 'good', [o]);
    return true;
  };
  G.reviveToBreak = (sim, sp, li) => {
    for (const [N, e] of Object.entries(sp.revived || {})) {
      const le = li.revived && li.revived[N];
      if (e.aware && le && !le.aware && li.name !== N && sim.byName(N)) return { name: N };
    }
    return null;
  };
  G.miracleTopic = (sim, sp, li) => {
    for (const [N, e] of Object.entries(sp.revived || {})) {
      const le = li.revived && li.revived[N];
      if (e.aware && le && le.aware && li.name !== N && sim.clock.abs - e.t < 2880 && !(e.talked || {})[li.name]) return { name: N, e };
    }
    return null;
  };

  // ------------------------------------------------------------ queries used by actions and talk
  G.graveToVisit = p => {
    if (!p.mourning) return null;
    for (const [name, e] of Object.entries(p.mourning)) {
      if (e.visited || !['sadness', 'acceptance'].includes(e.stage)) continue;
      const g = p.sim.graves.find(x => x.name === name && x.stage === 'grave');
      if (g) return { name, entry: e, grave: g, f: e.f, partner: e.partner };
    }
    return null;
  };
  // Fresh grief: no chirpy hellos
  G.inMourning = p => (p.action && ['atBody', 'bury', 'funeral', 'mourn'].includes(p.action.def.id)) ||
    Object.values(p.mourning || {}).some(e => e.aware && e.f > 5 && (e.stage === 'shock' || e.stage === 'anger' || (e.stage === 'sadness' && (e.partner || e.f > 40))));
  G.newsToBreak = (sim, sp, li) => {
    for (const [N, e] of Object.entries(sp.mourning || {})) {
      const le = li.mourning && li.mourning[N];
      if (e.aware && le && !le.aware) return { name: N, cause: e.cause };
    }
    return null;
  };
  G.shockTopic = (sim, sp, li) => {
    for (const [N, e] of Object.entries(sp.mourning || {})) {
      const le = li.mourning && li.mourning[N];
      if (e.aware && e.stage === 'shock' && e.f > 5 && le && le.aware) return { name: N, cause: e.cause };
    }
    return null;
  };
  G.fearful = p => p.sim.deaths > 0 && p.sim.clock.abs - p.sim.lastDeathAt < 2880 && p.skyOpinion < -30;
  G.mournTopic = (sim, sp) => {
    if (!sp.mourning) return null;
    let best = null;
    for (const [name, e] of Object.entries(sp.mourning)) {
      if (!e.aware || !['anger', 'sadness', 'acceptance'].includes(e.stage) || e.f < 5) continue;
      if (!best || e.f > best.f) best = { name, ...e };
    }
    return best;
  };

  // ------------------------------------------------------------ per frame
  G.update = (sim, rdt) => {
    const r = live(sim, rdt);
    if (sim.shake > 0) sim.shake = Math.max(0, sim.shake - rdt * 30);
    for (const f of sim.godFx) {
      f.t += rdt;
      if (f.kind === 'meteor') {
        const u = Math.min(1, f.t / f.max);
        const e = u * u;
        const x = IS.lerp(f.fx, f.tx, e), y = IS.lerp(f.fy, f.ty, e);
        for (let i = 0; i < 3; i++) sim.fx.add({ x: x + IS.rand(-3, 3), y: y + IS.rand(-3, 3), vx: IS.rand(10, 40), vy: IS.rand(-50, -10), g: 0, max: IS.rand(0.3, 0.7), color: IS.pick(['#fff4c8', '#ffd56a', '#ff8a3a', '#e8343f', '#5a5060']), size: IS.randi(2, 4), fade: true });
        if (u >= 1 && !f.hit) { f.hit = true; G.explode(sim, f.wx, f.wy); }
      }
      if (f.kind === 'beam' && f.grave && f.t > 1 && !f.risen) { f.risen = true; G.rise(sim, f.grave); }
    }
    sim.godFx = sim.godFx.filter(f => f.t < f.max);
    const minute = Math.floor(sim.clock.abs);
    if (minute !== sim.griefMinute) { sim.griefMinute = minute; griefTick(sim); }
    for (const d of sim.decals) {
      if (d.kind !== 'flame') continue;
      d.burn -= r;
      if (d.burn <= 0) continue;
      const s = IS.Iso.w2s(d.x, d.y);
      if (Math.random() < r * 12) sim.fx.spark(s.x, s.y - 8);
      for (const o of sim.people) if (!o.burning && o.mode !== 'air' && o.mode !== 'carried' && IS.dist(o.x, o.y, d.x, d.y) < TL() * 0.6) G.ignite(sim, o);
    }
    sim.decals = sim.decals.filter(d => (d.kind === 'flame' ? d.burn > 0 : sim.clock.abs - d.t < d.life));
    for (const g of sim.graves) {
      if (g.stage === 'body' && (g.cause === 'smite' || g.cause === 'fire') && performance.now() - g.born < 9000 && Math.random() < rdt * 4) {
        const s = IS.Iso.w2s(g.x, g.y);
        sim.fx.smoke(s.x + IS.rand(-8, 8), s.y - 6);
      }
    }
  };

  // ------------------------------------------------------------ drawing
  const tintCache = new WeakMap();
  const tinted = (img, color) => {
    let m = tintCache.get(img);
    if (!m) { m = {}; tintCache.set(img, m); }
    if (!m[color]) {
      const { c, g } = IS.makeCanvas(img.width, img.height, false);
      g.drawImage(img, 0, 0);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = color; g.fillRect(0, 0, img.width, img.height);
      m[color] = c;
    }
    return m[color];
  };

  G.drawDecals = (R, ctx, ox, oy, t) => {
    const sim = R.sim;
    for (const d of sim.decals) {
      const s = IS.Iso.w2s(d.x, d.y);
      if (d.kind === 'flame') { if (d.burn > 0) R.drawFire(ctx, s.x - ox, s.y - oy - 2, t + d.x); continue; }
      const age = (sim.clock.abs - d.t) / d.life;
      const grow = d.kind === 'blood' ? Math.min(1, 0.35 + (performance.now() - d.born) / 3000) : 1;
      ctx.globalAlpha = IS.clamp((1 - age) / 0.45, 0, 1); // full for ~13 hours, then fades out
      const w = d.img.width * grow, h = d.img.height * grow;
      ctx.drawImage(d.img, Math.round(s.x - w / 2 - ox), Math.round(s.y - h / 2 - oy), Math.round(w), Math.round(h));
    }
    ctx.globalAlpha = 1;
  };

  G.drawGrave = (R, ctx, g, ox, oy, t) => {
    const s = IS.Iso.w2s(g.x, g.y);
    const sx = Math.round(s.x - ox), sy = Math.round(s.y - oy);
    if (g.building && g.building.cut < 0.05) return;
    if (g.building) ctx.globalAlpha = g.building.cut;
    const p = g.p;
    if (g.stage === 'body') {
      const img = p.frames.down[0];
      const charred = g.cause === 'smite' || g.cause === 'fire';
      ctx.save();
      ctx.translate(sx + (g.flip ? -14 : 14), sy - 3);
      if (g.flip) ctx.scale(-1, 1);
      ctx.rotate(-Math.PI / 2);
      if (g.cause === 'fall') ctx.scale(0.75, 1.15);
      ctx.drawImage(charred ? tinted(img, '#1c1418') : img, -11, -34);
      ctx.restore();
      if (charred && performance.now() - g.born < 15000) {
        ctx.fillStyle = Math.sin(t * 9 + g.x) > 0 ? '#ff8a3a' : '#ffd56a';
        for (let i = 0; i < 4; i++) ctx.fillRect(sx - 12 + ((i * 7 + Math.floor(t * 3)) % 24), sy - 6 + (i % 2) * 3, 1, 1);
      }
    } else if (g.stage === 'remains') {
      const look = p.cfg.look || {};
      const bits = [[-6, -2, 4, 3, BLOOD[1]], [-1, -4, 5, 4, BLOOD[2]], [4, -1, 3, 3, BLOOD[0]], [-3, -6, 3, 2, look.shirt || '#6a8fd0'], [2, -6, 2, 2, look.skin || '#e8b48a']];
      for (const [x, y, w, h, c] of bits) { ctx.fillStyle = c; ctx.fillRect(sx + x, sy + y, w, h); }
      ctx.fillStyle = '#e9e1d0'; ctx.fillRect(sx - 2, sy - 10, 5, 4); ctx.fillRect(sx - 1, sy - 6, 3, 1);
      ctx.fillStyle = '#211a24'; ctx.fillRect(sx - 1, sy - 9, 1, 1); ctx.fillRect(sx + 1, sy - 9, 1, 1);
      ctx.fillStyle = '#e9e1d0'; ctx.fillRect(sx + 5, sy - 4, 6, 1); ctx.fillRect(sx + 4, sy - 5, 1, 3); ctx.fillRect(sx + 11, sy - 5, 1, 3);
    } else if (g.stage === 'grave') {
      // Dirt mound
      ctx.fillStyle = 'rgba(40, 20, 90, 0.25)';
      ctx.beginPath(); ctx.ellipse(sx, sy + 1, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7a5434'; ctx.fillRect(sx - 9, sy - 3, 18, 5); ctx.fillRect(sx - 7, sy - 4, 14, 7);
      ctx.fillStyle = '#8f6540'; ctx.fillRect(sx - 7, sy - 4, 14, 2);
      // Headstone
      const hx = sx - 5, hy = sy - 17;
      ctx.fillStyle = '#211a24'; ctx.fillRect(hx - 1, hy + 1, 12, 14); ctx.fillRect(hx, hy, 10, 1); ctx.fillRect(hx + 1, hy - 1, 8, 1);
      ctx.fillStyle = '#a7adb6'; ctx.fillRect(hx, hy + 1, 10, 13); ctx.fillRect(hx + 1, hy, 8, 1);
      ctx.fillStyle = '#c6ccd4'; ctx.fillRect(hx + 1, hy + 1, 2, 11);
      ctx.fillStyle = '#7c828c'; ctx.fillRect(hx + 8, hy + 1, 2, 13);
      ctx.fillStyle = '#5a5f68'; ctx.fillRect(hx + 4, hy + 3, 2, 7); ctx.fillRect(hx + 2, hy + 5, 6, 2);
      // Flowers left by mourners
      const fl = ['#e0405a', '#f2b82e', '#c46bd6', '#ffffff', '#4a8fe0', '#ff8a3a', '#e0405a', '#f2b82e'];
      for (let i = 0; i < Math.min(8, g.flowers || 0); i++) {
        const fx = sx - 8 + ((i * 5) % 17), fy = sy + (i % 2);
        ctx.fillStyle = '#5fae4a'; ctx.fillRect(fx, fy - 2, 1, 2);
        ctx.fillStyle = fl[i]; ctx.fillRect(fx - 1, fy - 3, 2, 2);
      }
    }
    ctx.globalAlpha = 1;
  };

  G.drawOnPerson = (R, ctx, p, sx, sy, t) => {
    if (!p.burning) return;
    ctx.globalAlpha = 0.85;
    R.drawFire(ctx, sx, sy - 10, t * 1.3 + p.id);
    ctx.globalAlpha = 0.9;
    R.drawFire(ctx, sx + 2, sy - 22, t * 1.7 + p.id * 3);
    ctx.globalAlpha = 1;
  };

  G.drawFx = (R, ctx, ox, oy, now) => {
    const sim = R.sim;
    for (const f of sim.godFx) {
      const u = f.t / f.max;
      if (f.kind === 'bolt') {
        if (!(f.t < 0.1 || (f.t < 0.35 && Math.floor(f.t * 28) % 2 === 0))) continue;
        for (const [lw, col] of [[7, 'rgba(150, 200, 255, 0.35)'], [3, '#dff1ff'], [1, '#ffffff']]) {
          ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'square'; ctx.lineJoin = 'miter';
          for (const path of f.paths) {
            ctx.beginPath();
            path.forEach((q, i) => (i ? ctx.lineTo(Math.round(q.x - ox), Math.round(q.y - oy)) : ctx.moveTo(Math.round(q.x - ox), Math.round(q.y - oy))));
            ctx.stroke();
          }
        }
        const gr = ctx.createRadialGradient(f.x - ox, f.y - oy, 1, f.x - ox, f.y - oy, 40);
        gr.addColorStop(0, 'rgba(230, 245, 255, 0.8)'); gr.addColorStop(1, 'rgba(230, 245, 255, 0)');
        ctx.fillStyle = gr; ctx.fillRect(f.x - ox - 40, f.y - oy - 40, 80, 80);
      } else if (f.kind === 'meteor') {
        const e = Math.min(1, u * u);
        const x = IS.lerp(f.fx, f.tx, e) - ox, y = IS.lerp(f.fy, f.ty, e) - oy;
        ctx.fillStyle = `rgba(40, 20, 30, ${0.15 + e * 0.35})`;
        ctx.beginPath(); ctx.ellipse(f.tx - ox, f.ty - oy, 4 + e * 26, 2 + e * 13, 0, 0, Math.PI * 2); ctx.fill();
        const gr = ctx.createRadialGradient(x, y, 2, x, y, 22);
        gr.addColorStop(0, 'rgba(255, 220, 140, 0.9)'); gr.addColorStop(1, 'rgba(255, 120, 40, 0)');
        ctx.fillStyle = gr; ctx.fillRect(x - 22, y - 22, 44, 44);
        ctx.fillStyle = '#3a2a22'; ctx.fillRect(Math.round(x) - 4, Math.round(y) - 4, 8, 8);
        ctx.fillStyle = '#ff8a3a'; ctx.fillRect(Math.round(x) - 4, Math.round(y) + 2, 8, 2); ctx.fillRect(Math.round(x) - 4, Math.round(y) - 4, 2, 8);
      } else if (f.kind === 'boom') {
        const r = 10 + u * 70;
        ctx.globalAlpha = 1 - u;
        const gr = ctx.createRadialGradient(f.x - ox, f.y - oy - 6, 1, f.x - ox, f.y - oy - 6, r);
        gr.addColorStop(0, '#fff4c8'); gr.addColorStop(0.4, '#ffb03a'); gr.addColorStop(1, 'rgba(232, 52, 63, 0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(f.x - ox, f.y - oy - 6, r, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(f.x - ox, f.y - oy, r * 1.3, r * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (f.kind === 'beam') {
        const [r, g, b] = f.color;
        const a = Math.sin(Math.min(1, u) * Math.PI);
        const w = f.w * (0.6 + 0.4 * a);
        const gr = ctx.createLinearGradient(f.x - ox - w / 2, 0, f.x - ox + w / 2, 0);
        gr.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`); gr.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${0.75 * a})`); gr.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx.fillStyle = gr; ctx.fillRect(Math.round(f.x - ox - w / 2), 0, Math.round(w), Math.round(f.y - oy));
        ctx.fillStyle = `rgba(255, 255, 255, ${0.85 * a})`; ctx.fillRect(Math.round(f.x - ox - 2), 0, 4, Math.round(f.y - oy));
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.25 * a})`; ctx.fillRect(Math.round(f.x - ox - w), 0, Math.round(w * 2), Math.round(f.y - oy));
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.5 * a})`;
        ctx.beginPath(); ctx.ellipse(f.x - ox, f.y - oy, w * 0.9, w * 0.4, 0, 0, Math.PI * 2); ctx.fill();
        if (Math.random() < 0.6) sim.fx.add({ x: f.x + IS.rand(-w / 2, w / 2), y: f.y - IS.rand(0, 10), vx: 0, vy: IS.rand(-80, -40), g: 0, max: IS.rand(0.5, 1), color: `rgb(${r}, ${g}, ${b})`, size: 1, fade: true });
      } else if (f.kind === 'ghost') {
        const img = tinted(f.p.frames.down[0], '#eef6ff');
        ctx.globalAlpha = 0.65 * (1 - u) * Math.min(1, f.t * 3);
        const x = Math.round(f.x - ox + Math.sin(f.t * 4) * 3), y = Math.round(f.y - oy - 34 - u * 46);
        ctx.drawImage(img, x - 11, y);
        ctx.globalAlpha = 1;
      }
    }
  };

  G.drawReticle = (R, ctx, ox, oy, t) => {
    const sim = R.sim;
    if (sim.power === 'hand' || !sim.hoverIso || sim.menuOpen) return;
    const iso = sim.hoverIso;
    let x = iso.x, y = iso.y, rx = 12, col = '#ff5a4a';
    if (sim.power === 'bless') col = '#ffe07a';
    if (sim.power === 'revive') {
      col = '#e8fbff';
      const g = G.graveAt(sim, iso);
      if (!g) return;
      const s = IS.Iso.w2s(g.x, g.y); x = s.x; y = s.y;
    } else if (sim.power === 'meteor') rx = 36;
    else {
      const p = G.targetAt(sim, iso);
      if (p) { const s = IS.Iso.w2s(p.x, p.y); x = s.x; y = s.y; }
      else if (sim.power === 'bless') rx = 40;
    }
    ctx.strokeStyle = col; ctx.lineWidth = 1;
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 8);
    ctx.beginPath(); ctx.ellipse(Math.round(x - ox) + 0.5, Math.round(y - oy) + 0.5, rx, rx / 2, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = col;
    for (const [dx, dy] of [[-rx - 4, 0], [rx + 1, 0], [0, -rx / 2 - 4], [0, rx / 2 + 1]]) ctx.fillRect(Math.round(x - ox + dx), Math.round(y - oy + dy), dx ? 3 : 1, dy ? 3 : 1);
    ctx.globalAlpha = 1;
  };

  return G;
})();
