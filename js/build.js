// Building: you pick what and where, the islanders build it.
//  - placing is checked hard: open ground only, a gap around other
//    buildings, and nothing on the island may get cut off (every spot,
//    landmark, door and person stays reachable)
//  - the moment a site is placed its footprint becomes solid, anyone
//    standing there steps out and everyone re-plans their route
//  - islanders who like hard work go hammer at it; the walls rise as it fills
//  - when it's done it becomes a real building with a path to the road
IS.Build = (() => {
  const B = {};
  const TT = () => IS.TT;
  const T = () => IS.TILE;

  // ------------------------------------------------------------ what you can build
  B.TYPES = {
    house: { name: 'House', kind: 'house', w: 6, h: 5, doorCols: [2], wood: 16, food: 0, work: 300, unlock: 0, roofs: ['#e2a23f', '#5fa8c8', '#c25a8a', '#6a9a3a', '#8a6ad6'], wall: '#fbe6cc',
      desc: 'Two beds. Room for two new islanders.' },
    bakery: { name: 'Bakery', kind: 'deco', deco: 'cafe', w: 5, h: 4, doorCols: [2], wood: 12, food: 6, work: 220, unlock: 7, roof: '#d8743a', wall: '#fff0d8', awning: '#e05a3a', act: 'treat',
      desc: 'Fresh pastries. Hungry islanders grab a treat here.' },
    library: { name: 'Library', kind: 'deco', deco: 'cafe', w: 5, h: 4, doorCols: [2], wood: 14, food: 0, work: 240, unlock: 8, roof: '#3f5ad0', wall: '#f4ead8', awning: '#3a4a8a', act: 'library',
      desc: 'Benches and books. Curious islanders love it.' },
    gym: { name: 'Gym', kind: 'deco', deco: 'shed', w: 4, h: 3, doorCols: [1], wood: 10, food: 0, work: 180, unlock: 9, roof: '#5a6a7a', wall: '#e8d8c0', act: 'gymWorkout',
      desc: 'Weights and a pull-up bar. Fitness fans train here.' },
  };
  B.state = sim => (sim.builds = sim.builds || []);
  B.sites = sim => B.state(sim).filter(s => s.state === 'building');
  B.venueCount = sim => B.state(sim).filter(s => s.state === 'done' && B.TYPES[s.type].kind !== 'house').length;
  // Beds in houses, plus spare corners in one-bed houses
  B.popCap = sim => {
    let n = 0;
    for (const b of sim.world.buildings) if (b.kind === 'house') n += Math.max(2, (sim.world.spots.bed || []).filter(s => s.building === b.id).length);
    return n;
  };
  B.unlocked = (sim, type) => IS.Town.residents(sim).length >= B.TYPES[type].unlock;

  // ------------------------------------------------------------ is this a good spot?
  const CLEARABLE = new Set(['tree', 'bush', 'rock', 'stump']);
  const SOFT_SPOTS = new Set(['forage', 'chop', 'beach', 'shore', 'stargaze']);
  const inRect = (x, y, r, m = 0) => x >= r.x0 - m && x < r.x0 + r.w + m && y >= r.y0 - m && y < r.y0 + r.h + m;
  B.rectFor = (type, tx, ty) => { const d = B.TYPES[type]; return { x0: tx - Math.floor(d.w / 2), y0: ty - Math.floor(d.h / 2), w: d.w, h: d.h }; };
  B.doorFront = (type, r) => ({ x: r.x0 + B.TYPES[type].doorCols[0], y: r.y0 + r.h });

  B.check = (sim, type, r) => {
    const W = sim.world, tt = TT();
    if (r.x0 < 3 || r.y0 < 3 || r.x0 + r.w > W.W - 3 || r.y0 + r.h > W.H - 4) return { ok: false, why: 'Too close to the edge of the island.' };
    for (let y = r.y0 - 1; y <= r.y0 + r.h; y++) for (let x = r.x0 - 1; x <= r.x0 + r.w; x++) {
      const t = W.tile(x, y), inside = inRect(x, y, r);
      if (W.isWater(x, y)) return { ok: false, why: 'Too close to the water.' };
      if (W.elev && (W.elev[W.idx(x, y)] || W.hidden[W.idx(x, y)])) return { ok: false, why: 'Too steep here.' };
      if (t === tt.WALL || t === tt.FLOOR) return { ok: false, why: 'Too close to another building.' };
      if (inside && W.landDist[W.idx(x, y)] < 2) return { ok: false, why: 'Too close to the water.' };
      if (inside && ![tt.GRASS, tt.SAND, tt.FOREST].includes(t)) return { ok: false, why: t === tt.FARM ? 'That\'s the farm.' : t === tt.DOCK ? 'That\'s the dock.' : 'Can\'t build on the paths or the plaza.' };
    }
    for (const s of B.sites(sim)) if (r.x0 < s.x0 + s.w + 1 && r.x0 + r.w + 1 > s.x0 && r.y0 < s.y0 + s.h + 1 && r.y0 + r.h + 1 > s.y0) return { ok: false, why: 'Too close to another building site.' };
    for (const o of W.objects) if (inRect(o.tx, o.ty, r) && !CLEARABLE.has(o.kind)) return { ok: false, why: `There's a ${o.kind === 'bigoak' ? 'very old tree' : o.kind} in the way.` };
    for (const [k, list] of Object.entries(W.spots)) for (const s of list) if (inRect(s.x, s.y, r) && !SOFT_SPOTS.has(k) && s.pose !== 'swim') return { ok: false, why: k === 'fish' ? 'That\'s a fishing spot.' : k === 'picnicSeat' ? 'That\'s the picnic meadow.' : 'Something important is there.' };
    for (const g of sim.graves || []) { const gx = Math.floor((g.gx ?? g.x) / T()), gy = Math.floor(((g.gy ?? g.y) - 6) / T()); if (inRect(gx, gy, r, 1)) return { ok: false, why: 'Not on a grave.' }; }
    const tr = sim.treasure; if (tr && !tr.dug && inRect(Math.floor(tr.x / T()), Math.floor((tr.y - 6) / T()), r)) return { ok: false, why: 'Something is buried there...' };
    const df = B.doorFront(type, r);
    const dfObj = W.objects.find(o => o.tx === df.x && o.ty === df.y && !CLEARABLE.has(o.kind));
    if (dfObj || W.isWater(df.x, df.y) || [tt.WALL, tt.FLOOR, tt.FARM].includes(W.tile(df.x, df.y))) return { ok: false, why: 'The front door would be blocked.' };
    // Would it cut anything off? Pretend the walls are up and flood-fill from the plaza.
    const cut = B.wouldCutOff(sim, r, df);
    if (cut) return { ok: false, why: cut };
    const d = B.TYPES[type];
    const upfront = Math.ceil(d.wood / 4);
    if (W.wood < upfront) return { ok: true, afford: false, why: `Needs at least ${upfront} wood to start (you have ${W.wood}).` };
    if (W.food < d.food) return { ok: true, afford: false, why: `Needs ${d.food} food (you have ${W.food}).` };
    return { ok: true, afford: true, why: '' };
  };
  B.wouldCutOff = (sim, r, df) => {
    const W = sim.world;
    const saved = [];
    for (let y = r.y0; y < r.y0 + r.h; y++) for (let x = r.x0; x < r.x0 + r.w; x++) { const i = W.idx(x, y); saved.push([i, W.blocked[i]]); W.blocked[i] = 1; }
    // Clearable things in front of the door will be cleared, so count the door front as open
    const di = W.idx(df.x, df.y), dOld = W.blocked[di]; W.blocked[di] = 0;
    const start = W.pois.find(p => p.name === 'the plaza');
    const reach = W.computeReach(start.x, start.y);
    W.blocked[di] = dOld;
    for (const [i, v] of saved) W.blocked[i] = v;
    const ok = (x, y) => reach[W.idx(x, y)] === 1;
    if (!ok(df.x, df.y)) return 'The front door would have no way in.';
    for (const p of W.pois) if (!ok(p.x, p.y)) return `It would block the way to ${p.name}.`;
    for (const b of W.buildings) for (const d of b.doors) if (W.reach[W.idx(d.x, d.y)] === 1 && !ok(d.x, d.y)) return 'It would block someone\'s front door.';
    for (const [k, list] of Object.entries(W.spots)) for (const s of list) {
      if (s.pose === 'swim' || inRect(s.x, s.y, r)) continue;
      if (W.reach[W.idx(s.x, s.y)] === 1 && !ok(s.x, s.y)) return 'It would cut off part of the island.';
    }
    for (const p of sim.people) if (!inRect(p.tx, p.ty, r) && W.walkable(p.tx, p.ty) && W.reach[W.idx(p.tx, p.ty)] === 1 && !ok(p.tx, p.ty)) return `It would trap ${p.name}.`;
    return null;
  };

  // ------------------------------------------------------------ placing a site
  B.place = (sim, type, r, opts = {}) => {
    const W = sim.world, d = B.TYPES[type];
    const c = opts.restore ? { ok: true, afford: true } : B.check(sim, type, r);
    if (!c.ok || !c.afford) return { ok: false, why: c.why };
    let paid = d.wood;
    if (!opts.restore) { paid = Math.min(W.wood, d.wood); W.wood -= paid; W.food -= d.food; }
    const id = opts.id || 'built' + (B.state(sim).reduce((m, s) => Math.max(m, +String(s.id).replace(/\D/g, '') || 0), 0) + 1);
    const site = { id, type, x0: r.x0, y0: r.y0, w: r.w, h: r.h, state: 'building', work: opts.work || 0, need: d.work, wood: opts.wood ?? paid, woodNeed: d.wood, started: opts.started ?? sim.clock.abs, roof: opts.roof || d.roof || IS.pick(d.roofs) };
    site.depth = (site.x0 + site.w) + (site.y0 + site.h) - 0.5;
    if (!opts.restore || !opts.keepState) B.state(sim).push(site);
    // Clear the ground: trees give wood back
    let logs = 0;
    const df = B.doorFront(type, r);
    W.objects = W.objects.filter(o => {
      const hit = inRect(o.tx, o.ty, r) || (o.tx === df.x && o.ty === df.y);
      if (!hit) return true;
      W.blocked[W.idx(o.tx, o.ty)] = 0;
      if (o.tree) logs += 2;
      return false;
    });
    if (logs && !opts.restore) { W.wood += logs; sim.log(`Clearing the ground gave ${logs} wood.`, 'event'); }
    for (const k of Object.keys(W.spots)) W.spots[k] = W.spots[k].filter(s => !inRect(s.x, s.y, r) && !(s.x === df.x && s.y === df.y && SOFT_SPOTS.has(k)) && !(s.tree && !W.objects.includes(s.tree)));
    sim.sandcastles = (sim.sandcastles || []).filter(o => !inRect(Math.floor(o.x / T()), Math.floor((o.y - 6) / T()), r));
    // Solid from now on
    for (let y = r.y0; y < r.y0 + r.h; y++) for (let x = r.x0; x < r.x0 + r.w; x++) W.blocked[W.idx(x, y)] = 1;
    B.afterTerrainChange(sim, r);
    if (!opts.restore) {
      sim.log(`A ${d.name.toLowerCase()} is going up! Islanders who like to work will start building it.`, 'event');
      sim.toast(`Building site placed: ${d.name}.`);
      IS.Mind.news(sim, 'building', IS.Town.residents(sim)[0], null, { detail: d.name.toLowerCase() });
    }
    return { ok: true, site };
  };

  // Walls appeared or disappeared: nobody may be inside them or walk through them
  B.afterTerrainChange = (sim, r) => {
    const W = sim.world;
    W.reach = W.computeReach(...(p => [p.x, p.y])(W.pois.find(p => p.name === 'the plaza')));
    for (const p of sim.people) {
      if (p.mode !== 'normal' && p.mode !== 'recover' && p.mode !== 'panic') continue;
      if (r && inRect(p.tx, p.ty, r) && !W.walkable(p.tx, p.ty)) {
        const t = W.nearestWalkable(p.tx, p.ty);
        if (p.chat) p.chat.end(true);
        p.cancelAction(); p.setTile(t.x, t.y); p.idleUntil = sim.clock.abs + 1;
      }
      B.fixPath(p);
    }
    for (const cat of IS.Content.cats(sim)) {
      if (!W.walkable(Math.floor(cat.x / T()), Math.floor((cat.y - 6) / T()))) { const t = W.nearestWalkable(Math.floor(cat.x / T()), Math.floor((cat.y - 6) / T())); cat.x = t.x * T() + 12; cat.y = t.y * T() + 18; }
      if (cat.path) cat.path = [];
    }
    if (sim.renderer) { for (const b of W.buildings) B.cacheAlpha(b); sim.renderer.prepObjects(); }
  };
  // Re-plan a route that now goes through a wall
  // Move wood from the pile into a site, a log at a time, as the work needs it
  B.feed = (sim, s) => {
    const W = sim.world;
    while (s.wood < s.woodNeed && W.wood > 0 && s.work >= s.need * (s.wood / s.woodNeed) - 2) { W.wood--; s.wood++; }
  };
  B.needsWood = sim => B.sites(sim).some(s => s.wood < s.woodNeed);

  B.fixPath = p => {
    const W = p.world;
    if (!p.path || !p.path.length) return;
    if (p.path.every(n => W.walkable(n.x, n.y) || W.swimmable(n.x, n.y))) return;
    const goal = p.path[p.path.length - 1];
    const np = W.findPath(p.tx, p.ty, goal.x, goal.y, { swim: p.path.some(n => W.swimmable(n.x, n.y)) });
    if (np) p.path = np; else { p.cancelAction(); p.path = []; }
  };
  B.cacheAlpha = b => { if (b.iso && !b.noCut && !b.iso.alpha) { const c = b.iso.canvas; b.iso.alpha = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; } };
  B.redraw = (sim, b) => { b.iso = IS.Iso.building(b); B.cacheAlpha(b); };

  B.cancel = (sim, site) => {
    if (site.state !== 'building') return;
    const W = sim.world, d = B.TYPES[site.type];
    const refund = site.work < 1 ? 1 : 0.5;
    W.wood += Math.floor((site.wood ?? d.wood) * refund); W.food += Math.floor(d.food * refund);
    for (const p of sim.people) if (p.action && p.action.site === site) p.cancelAction();
    for (let y = site.y0; y < site.y0 + site.h; y++) for (let x = site.x0; x < site.x0 + site.w; x++) W.blocked[W.idx(x, y)] = 0;
    sim.builds = B.state(sim).filter(s => s !== site);
    B.afterTerrainChange(sim, null);
    sim.log(`The ${d.name.toLowerCase()} was called off.${refund < 1 ? ' Half the materials were saved.' : ' All the materials were put back.'}`, 'warn');
  };

  // ------------------------------------------------------------ finishing
  B.complete = (sim, site, opts = {}) => {
    const W = sim.world, d = B.TYPES[site.type];
    for (const p of sim.people) if (p.action && p.action.site === site) { p.action.done = true; p.action.siteDone = true; }
    for (let y = site.y0; y < site.y0 + site.h; y++) for (let x = site.x0; x < site.x0 + site.w; x++) W.blocked[W.idx(x, y)] = 0;
    const b = { id: site.id, kind: d.kind, deco: d.deco, x0: site.x0, y0: site.y0, w: site.w, h: site.h, doorCols: d.doorCols.slice(), roof: site.roof, wall: d.wall, awning: d.awning, beds: 2, built: true, venue: d.act || null, type: site.type };
    W.addBuilding(b);
    site.state = 'done';
    site.done = sim.clock.abs;
    // A path from the door to the nearest road
    site.path = opts.path || B.layPath(sim, B.doorFront(site.type, site));
    for (const t of site.path) W.setT(t.x, t.y, IS.TT.PATH);
    W.pathOverlay = (W.pathOverlay || []).concat(site.path);
    // Places to hang out in front
    if (d.act) {
      const df = B.doorFront(site.type, site);
      for (const dx of [-1, 1, -2, 2]) {
        const x = df.x + dx, y = df.y;
        if (!W.walkable(x, y) || W.tile(x, y) === IS.TT.PATH) continue;
        if (d.act === 'library') { W.objects = W.objects.filter(o => !(o.tx === x && o.ty === y)); const bp = IS.Iso.bench('x'); W.place('bench', x, y, bp.canvas, bp.ax, bp.ay, { block: false, footY: 18 }); }
        W.addSpot(d.act, x, y, d.act === 'library' ? 'down' : 'up', d.act === 'library' ? 'sit' : d.act === 'gymWorkout' ? 'work' : 'stand', { building: b.id });
        if ((W.spots[d.act] || []).filter(s => s.building === b.id).length >= 2) break;
      }
    }
    B.afterTerrainChange(sim, null);
    if (!opts.restore) {
      const helpers = [...new Set(site.helpers || [])];
      sim.log(`The new ${d.name.toLowerCase()} is finished!${helpers.length ? ` Built by ${helpers.join(', ')}.` : ''}`, 'good', helpers.map(n => sim.byName(n)).filter(Boolean));
      sim.toast(`${d.name} finished!`);
      IS.Mind.news(sim, 'built', sim.byName(helpers[0]) || IS.Town.residents(sim)[0], null, { detail: d.name.toLowerCase() });
      for (const n of helpers) { const p = sim.byName(n); if (p) { p.remember(`Helped build the new ${d.name.toLowerCase()}`, { tag: 'built', mood: 10, moodDuration: 720, news: true, detail: d.name.toLowerCase() }); p.emote('sparkle', 2); } }
      for (const p of sim.people) if (IS.dist(p.x, p.y, (site.x0 + site.w / 2) * T(), (site.y0 + site.h) * T()) < T() * 10 && p.pose !== 'sleep' && Math.random() < 0.5) setTimeout(() => { if (!p.chat && p.mode === 'normal') p.say(IS.pick(['It\'s DONE!', 'Look at that!', 'We built that. WE did.', 'Ooh, fancy.']), 2.2); }, 400 + Math.random() * 1200);
    }
    return b;
  };
  // Shortest walk from the door to an existing path, plaza or dock
  B.layPath = (sim, from) => {
    const W = sim.world, tt = IS.TT;
    const prev = new Int32Array(W.W * W.H).fill(-1);
    const start = W.idx(from.x, from.y);
    const q = [start]; prev[start] = start;
    let goal = -1;
    for (let h = 0; h < q.length && goal < 0; h++) {
      const i = q[h], x = i % W.W, y = (i / W.W) | 0;
      for (const [a, b] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
        const nx = x + a, ny = y + b;
        if (!W.inb(nx, ny) || !W.walkable(nx, ny)) continue;
        const j = W.idx(nx, ny);
        if (prev[j] >= 0) continue;
        prev[j] = i;
        const t = W.tiles[j];
        if (t === tt.PATH || t === tt.PLAZA || t === tt.DOCK) { goal = j; break; }
        q.push(j);
      }
    }
    const out = [];
    if (goal < 0) return [{ x: from.x, y: from.y }];
    for (let i = prev[goal]; ; i = prev[i]) { out.push({ x: i % W.W, y: (i / W.W) | 0 }); if (i === start) break; }
    return out.filter(t => ![tt.PATH, tt.PLAZA, tt.DOCK, tt.FARM].includes(W.tile(t.x, t.y)));
  };

  // ------------------------------------------------------------ the work itself
  const BUILD = {
    id: 'build', label: 'Building', outdoor: true, pose: 'work', chatOK: false,
    can: (p, c) => c.min >= 7.5 * 60 && c.min < 19 * 60 && c.weather !== 'storm' && B.sites(p.sim).length > 0,
    score: p => {
      const t = p.traits;
      const urgent = p.sim.people.some(o => o.town && o.town.status === 'waiting') ? 0.6 : 0;
      return 0.35 + t.hardworking * 0.9 + (p.loves.includes('chopping') ? 0.2 : 0) - (p.loves.includes('napping') ? 0.2 : 0) + urgent - (p.needs.energy < 30 ? 0.8 : 0);
    },
    plan: p => {
      const W = p.world;
      const sites = B.sites(p.sim).filter(s => s.work < s.need && (s.work < s.need * (s.wood / s.woodNeed) - 1 || p.world.wood > 0));
      if (!sites.length) return null;
      const site = sites.sort((a, b) => IS.dist(a.x0, a.y0, p.tx, p.ty) - IS.dist(b.x0, b.y0, p.tx, p.ty))[0];
      // A free tile on the edge of the site
      const taken = new Set(p.sim.people.filter(o => o !== p && o.action && o.action.site === site).map(o => o.action.tx + ',' + o.action.ty));
      const ring = [];
      for (let x = site.x0; x < site.x0 + site.w; x++) ring.push([x, site.y0 - 1, 'down'], [x, site.y0 + site.h, 'up']);
      for (let y = site.y0; y < site.y0 + site.h; y++) ring.push([site.x0 - 1, y, 'right'], [site.x0 + site.w, y, 'left']);
      const ok = ring.filter(([x, y]) => W.walkable(x, y) && W.reach[W.idx(x, y)] === 1 && !taken.has(x + ',' + y) && !W.buildingAt(x, y));
      if (!ok.length) return null;
      ok.sort((a, b) => IS.dist(a[0], a[1], p.tx, p.ty) - IS.dist(b[0], b[1], p.tx, p.ty));
      const [x, y, face] = ok[Math.min(ok.length - 1, Math.floor(Math.random() * 3))];
      return { tx: x, ty: y, face, duration: IS.rand(35, 60), site };
    },
    start: (p, a) => { a.site.helpers = a.site.helpers || []; if (!a.site.helpers.includes(p.name)) a.site.helpers.push(p.name); },
    tick: (p, a, dt) => {
      const site = a.site;
      if (!site || site.state !== 'building') { a.done = true; return; }
      p.needs.energy = Math.max(0, p.needs.energy - 0.05 * dt);
      p.needs.fun = Math.min(100, p.needs.fun + (p.traits.hardworking > 0.6 ? 0.06 : 0.01) * dt);
      B.feed(p.sim, site);
      const cap = site.need * (site.wood / site.woodNeed);
      if (site.work >= cap - 0.01) { a.done = true; site.stalled = true; if (!a.saidWood) { a.saidWood = true; p.say(IS.pick(['We\'re out of wood!', 'Need more logs for this.', 'Can\'t build with no wood...']), 2.4); } return; }
      site.stalled = false;
      site.work = Math.min(cap, site.work + dt * (0.6 + p.traits.hardworking * 0.7));
      if (Math.random() < dt * 0.25) p.sim.fx.dust(p.x + IS.rand(-6, 6), p.y - 4);
      if (Math.random() < dt * 0.012) p.say(IS.pick(['*hammering*', 'Hand me that nail.', 'Measure twice, cut once.', 'This wall is going to be SO straight.', 'Who designed this? Oh. The sky.', 'Almost there!', 'My thumb! ...I\'m fine.']), 1.8);
      if (site.work >= site.need) B.complete(p.sim, site);
    },
    finish: (p, a) => { if (!a.siteDone) p.addMood('Did some building', 3, 240); },
    thought: (p, a) => `Building the new ${B.TYPES[a.site.type].name.toLowerCase()}. ${Math.round(a.site.work / a.site.need * 100)}% done.`,
  };
  BUILD.label2 = (p, a) => `Building the ${B.TYPES[a.site.type].name.toLowerCase()}`;

  // What the new places are for
  const VENUES = [
    {
      id: 'treat', label: 'Grabbing a pastry', love: 'cooking', outdoor: true, chatOK: true,
      can: (p, c) => c.min >= 7 * 60 && c.min < 18.5 * 60 && (p.world.spots.treat || []).length > 0 && p.world.food >= 1,
      score: p => 0.15 + (100 - p.needs.hunger) / 140 + (100 - p.needs.fun) / 400 + ((p.cfg.quirks || []).includes('greedy') ? 0.3 : 0),
      plan: p => { const spot = p.world.freeSpot('treat'); return spot ? { spot, duration: IS.rand(12, 22) } : null; },
      finish: p => {
        p.needs.hunger = Math.min(100, p.needs.hunger + 35); p.needs.fun = Math.min(100, p.needs.fun + 8);
        if (Math.random() < 0.5) p.world.food = Math.max(0, p.world.food - 1);
        p.addMood('Fresh pastry', 5, 240);
        if (Math.random() < 0.3) p.say(IS.pick(['Still warm!', 'Okay, ONE more.', 'This is the best thing on the island.', '*crumbs everywhere*']), 2);
      },
      thought: () => IS.pick(['Something smells amazing.', 'Croissant. Now.', 'Just one pastry. Maybe two.']),
    },
    {
      id: 'library', label: 'Reading at the library', love: 'reading', outdoor: true, chatOK: true, pose: 'sit',
      can: (p, c) => c.min >= 8 * 60 && c.min < 20 * 60 && (p.world.spots.library || []).length > 0 && c.weather !== 'rain' && c.weather !== 'storm',
      score: p => 0.12 + p.traits.curious * 0.45 + (p.loves.includes('reading') ? 0.5 : 0) + (100 - p.needs.fun) / 400,
      plan: p => { const spot = p.world.freeSpot('library'); return spot ? { spot, duration: IS.rand(30, 60) } : null; },
      tick: (p, a, dt) => { p.needs.fun = Math.min(100, p.needs.fun + 0.15 * dt); },
      finish: p => p.addMood('A good book', 4, 300),
      thought: () => IS.pick(['Just one more chapter.', 'The library has the good books.', 'Shh. Reading.']),
    },
    {
      id: 'gymWorkout', label: 'Training at the gym', love: 'fitness', outdoor: true, pose: 'work',
      can: (p, c) => c.min >= 6 * 60 && c.min < 20 * 60 && (p.world.spots.gymWorkout || []).length > 0 && p.needs.energy > 35,
      score: p => 0.06 + (p.loves.includes('fitness') ? 0.9 : 0) + p.traits.energetic * 0.3 + p.traits.hardworking * 0.1,
      plan: p => { const spot = p.world.freeSpot('gymWorkout'); return spot ? { spot, duration: IS.rand(25, 45) } : null; },
      tick: (p, a, dt) => { p.needs.energy -= 0.07 * dt; p.needs.fun = Math.min(100, p.needs.fun + (p.loves.includes('fitness') ? 0.2 : 0.05) * dt); IS.Content.gain(p, 'fitness', dt * 0.6); if (Math.random() < dt * 0.02) p.say(IS.pick(['...twenty-one... twenty-two...', 'Gains!', 'One more rep.', 'Hngh!']), 1.6); },
      finish: p => p.addMood('Good workout', 6, 300),
      thought: () => IS.pick(['New gym, new me.', 'Leg day. Unfortunately.', 'The pull-up bar fears me.']),
    },
  ];

  // ------------------------------------------------------------ drawing
  const poly = (ctx, pts, fill, stroke) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); } };
  const diamond = (x0, y0, x1, y1, ox, oy) => [IS.Iso.g2s(x0, y0), IS.Iso.g2s(x1, y0), IS.Iso.g2s(x1, y1), IS.Iso.g2s(x0, y1)].map(p => ({ x: p.x - ox, y: p.y - oy }));
  // Under everything: new paths, site foundations, the placement ghost's footprint
  B.drawGround = (R, ctx, ox, oy, t) => {
    const sim = R.sim, W = sim.world;
    for (const tl of W.pathOverlay || []) {
      const pts = diamond(tl.x, tl.y, tl.x + 1, tl.y + 1, ox, oy);
      poly(ctx, pts, (tl.x + tl.y) % 2 ? '#e6a464' : '#dc9a5a');
      const c = IS.Iso.g2s(tl.x + 0.5, tl.y + 0.5);
      ctx.fillStyle = '#c27e4a'; ctx.fillRect(Math.round(c.x - ox) - 3, Math.round(c.y - oy), 2, 1); ctx.fillRect(Math.round(c.x - ox) + 2, Math.round(c.y - oy) - 2, 2, 1);
    }
    for (const s of B.sites(sim)) {
      poly(ctx, diamond(s.x0 - 0.15, s.y0 - 0.15, s.x0 + s.w + 0.15, s.y0 + s.h + 0.15, ox, oy), '#b0743e');
      poly(ctx, diamond(s.x0 + 0.1, s.y0 + 0.1, s.x0 + s.w - 0.1, s.y0 + s.h - 0.1, ox, oy), '#c9925a');
      for (let x = s.x0 + 1; x < s.x0 + s.w; x++) { const a = IS.Iso.g2s(x, s.y0 + 0.1), b2 = IS.Iso.g2s(x, s.y0 + s.h - 0.1); ctx.strokeStyle = 'rgba(120, 70, 40, 0.35)'; ctx.beginPath(); ctx.moveTo(a.x - ox, a.y - oy); ctx.lineTo(b2.x - ox, b2.y - oy); ctx.stroke(); }
    }
    const g = sim.placing;
    if (g && g.r) {
      const ok = g.check && g.check.ok && g.check.afford;
      const col = ok ? 'rgba(90, 220, 120, 0.38)' : g.check && g.check.ok ? 'rgba(242, 184, 46, 0.4)' : 'rgba(232, 64, 80, 0.4)';
      poly(ctx, diamond(g.r.x0, g.r.y0, g.r.x0 + g.r.w, g.r.y0 + g.r.h, ox, oy), col, ok ? '#2f8a52' : '#a8343f');
      const df = B.doorFront(g.type, g.r);
      poly(ctx, diamond(df.x, df.y, df.x + 1, df.y + 1, ox, oy), 'rgba(255, 255, 255, 0.35)', '#ffffff');
    }
  };
  // A building site: the real building rising out of its scaffolding
  B.siteSprite = (sim, s, wallH) => {
    const key = s.roof + ':' + (wallH || 1);
    s.sprites = s.sprites || {};
    if (s.sprites[key]) return s.sprites[key];
    const d = B.TYPES[s.type];
    s.sprites[key] = IS.Iso.building({ id: 'preview', kind: d.kind, deco: d.deco, x0: s.x0, y0: s.y0, w: s.w, h: s.h, doorCols: d.doorCols, roof: s.roof, wall: d.wall, awning: d.awning, furniture: [], residents: [], wallH: wallH || 0 });
    return s.sprites[key];
  };
  B.drawSite = (R, ctx, s, ox, oy, t) => {
    const k = Math.min(1, s.work / s.need);
    const full = B.siteSprite(R.sim, s);
    // An open shell whose walls really rise (in 10% steps), then the roof fades in at the end
    if (k < 1) {
      const step = Math.max(1, Math.ceil(Math.min(1, k / 0.8) * 10)) / 10;
      const shell = B.siteSprite(R.sim, s, step).interior;
      const sp = B.siteSprite(R.sim, s, step);
      ctx.drawImage(shell.canvas, Math.round(sp.ox - ox), Math.round(sp.oy - oy));
      ctx.drawImage(shell.front, Math.round(sp.ox - ox), Math.round(sp.oy - oy));
    }
    if (k >= 0.8) {
      ctx.globalAlpha = Math.min(1, (k - 0.8) / 0.2);
      ctx.drawImage(full.canvas, Math.round(full.ox - ox), Math.round(full.oy - oy));
      ctx.globalAlpha = 1;
    }
    const iso = full;
    // Scaffolding poles at the corners and a plank along the top of what's built
    const H = Math.max(14, iso.WH * Math.min(1, k * 1.6) + 10);
    const corners = [[s.x0, s.y0 + s.h], [s.x0 + s.w, s.y0 + s.h], [s.x0 + s.w, s.y0], [s.x0, s.y0]].map(([x, y]) => { const p = IS.Iso.g2s(x, y); return { x: Math.round(p.x - ox), y: Math.round(p.y - oy) }; });
    ctx.fillStyle = '#8a5a30';
    for (const c of corners) ctx.fillRect(c.x - 1, c.y - H, 2, H);
    ctx.strokeStyle = '#a8763f'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(corners[0].x, corners[0].y - H * 0.6); ctx.lineTo(corners[1].x, corners[1].y - H * 0.6); ctx.lineTo(corners[2].x, corners[2].y - H * 0.6); ctx.stroke();
    ctx.lineWidth = 1;
    // Progress sign
    const c = corners[0];
    ctx.fillStyle = '#6a4020'; ctx.fillRect(c.x - 16, c.y - 12, 2, 12);
    ctx.fillStyle = '#f4e2bc'; ctx.fillRect(c.x - 26, c.y - 20, 22, 9);
    ctx.fillStyle = '#c84a3a'; ctx.fillRect(c.x - 25, c.y - 13, Math.round(20 * k), 1);
    ctx.fillStyle = '#2a2135'; ctx.font = '7px monospace'; ctx.fillText(`${Math.round(k * 100)}%`, c.x - 24, c.y - 14);
  };
  // The translucent building that follows the cursor while placing
  B.drawGhost = (R, ctx, ox, oy) => {
    const g = R.sim.placing;
    if (!g || !g.r) return;
    if (!g.sprite || g.spriteAt !== g.r.x0 + ',' + g.r.y0) {
      const d = B.TYPES[g.type];
      g.sprite = IS.Iso.building({ id: 'ghost', kind: d.kind, deco: d.deco, x0: g.r.x0, y0: g.r.y0, w: d.w, h: d.h, doorCols: d.doorCols, roof: g.roof, wall: d.wall, awning: d.awning, furniture: [], residents: [] });
      g.spriteAt = g.r.x0 + ',' + g.r.y0;
    }
    ctx.globalAlpha = g.check && g.check.ok ? 0.6 : 0.3;
    ctx.drawImage(g.sprite.canvas, Math.round(g.sprite.ox - ox), Math.round(g.sprite.oy - oy));
    ctx.globalAlpha = 1;
  };
  B.drawProp = (R, ctx, p, sx, sy, t) => {
    const a = p.action;
    if (!a || a.phase !== 'do') return;
    if (a.def.id === 'build') {
      const up = Math.sin(t * 10) > 0;
      const side = p.dir === 'left' ? -1 : 1;
      ctx.fillStyle = '#7a4a2a'; ctx.fillRect(sx + side * 6, sy - (up ? 20 : 14), 1, 6);
      ctx.fillStyle = '#6a6a7a'; ctx.fillRect(sx + side * 6 - 2, sy - (up ? 21 : 15), 5, 2);
    } else if (a.def.id === 'library' && p.pose === 'sit') {
      ctx.fillStyle = '#3a5ad0'; ctx.fillRect(sx - 4, sy - 13, 8, 5); ctx.fillStyle = '#fff4e6'; ctx.fillRect(sx - 3, sy - 13, 6, 1);
    } else if (a.def.id === 'treat') {
      ctx.fillStyle = '#e8a050'; ctx.fillRect(sx + 5, sy - 13, 4, 3); ctx.fillStyle = '#ffd08a'; ctx.fillRect(sx + 6, sy - 13, 2, 1);
    }
  };

  // ------------------------------------------------------------ placing mode (input.js calls these)
  B.startPlacing = (sim, type) => {
    if (!B.unlocked(sim, type)) return;
    const d = B.TYPES[type];
    sim.placing = { type, roof: d.roof || IS.pick(d.roofs), r: null, check: null };
    if (sim.power && sim.power !== 'hand') IS.Gods.setPower(sim, 'hand');
    if (sim.ui) sim.ui.showTown(false);
    sim.placing = { type, roof: d.roof || IS.pick(d.roofs), r: null, check: null };
    B.hint(sim, `Placing a ${d.name.toLowerCase()} (${d.wood} wood${d.food ? `, ${d.food} food` : ''}). Click to build, Esc to cancel.`);
  };
  B.cancelPlacing = sim => { if (!sim.placing) return; sim.placing = null; B.hint(sim, null); };
  B.hover = (sim, iso) => {
    const g = sim.placing;
    if (!g) return;
    const w = IS.Iso.s2w(iso.x, iso.y);
    const tx = Math.floor(w.x / T()), ty = Math.floor(w.y / T());
    const r = B.rectFor(g.type, tx, ty);
    if (g.r && g.r.x0 === r.x0 && g.r.y0 === r.y0) return;
    g.r = r;
    g.check = B.check(sim, g.type, r);
    const d = B.TYPES[g.type];
    B.hint(sim, g.check.ok && g.check.afford ? `${d.name}: good spot. Click to build here (${d.wood} wood${d.food ? `, ${d.food} food` : ''}).` : `${d.name}: ${g.check.why}`, !(g.check.ok && g.check.afford));
  };
  // Mouse: click places. Touch: the first tap moves the ghost, a second tap on it builds.
  B.clickAt = (sim, iso, touch) => {
    const g = sim.placing;
    if (!g) return;
    const prev = g.r && g.r.x0 + ',' + g.r.y0;
    B.hover(sim, iso);
    if (touch && prev !== g.r.x0 + ',' + g.r.y0) return;
    if (!g.check || !g.check.ok || !g.check.afford) { if (sim.ui) sim.ui.toast(g.check ? g.check.why : 'Can\'t build there.'); return; }
    const res = B.place(sim, g.type, g.r);
    if (res.ok) B.cancelPlacing(sim);
    else if (sim.ui) sim.ui.toast(res.why);
  };
  B.hint = (sim, text, bad) => {
    let el = document.getElementById('place-hint');
    if (!text) { if (el) el.hidden = true; return; }
    if (!el) {
      el = document.createElement('div');
      el.id = 'place-hint';
      el.className = 'leather';
      el.innerHTML = '<span></span><button class="key" type="button">Cancel</button>';
      el.querySelector('button').addEventListener('click', () => B.cancelPlacing(sim));
      (document.getElementById('game').parentElement || document.body).appendChild(el);
    }
    el.hidden = false;
    el.classList.toggle('bad', !!bad);
    el.querySelector('span').textContent = text;
  };

  // ------------------------------------------------------------ the Build tab in the Town book
  B.panelHTML = (sim, ui) => {
    const e = s => ui.esc(s), W = sim.world, pop = IS.Town.residents(sim).length;
    void W;
    let h = `<h3>Build something <small>${W.wood} wood · ${W.food} food</small></h3>
      <p class="sub">Pick something, then click a spot on the island. You only need a quarter of the wood to start; builders use the rest as it comes in. Islanders who like hard work will build it over the next few days. Chopping wood and the supply boat bring in more wood.</p><ul class="finds">`;
    for (const [id, d] of Object.entries(B.TYPES)) {
      const locked = pop < d.unlock;
      const afford = W.wood >= Math.ceil(d.wood / 4) && W.food >= d.food;
      h += `<li class="${locked ? 'unknown' : ''}"><b>${e(d.name)}</b><span>${e(d.desc)}<br>${d.wood} wood${d.food ? `, ${d.food} food` : ''} · ${Math.round(d.work / 60)} hours of work</span><br>` +
        (locked ? `<span>Unlocks at ${d.unlock} islanders.</span>` : `<button class="key" data-build="${id}" ${afford ? '' : 'disabled'}>${afford ? 'Place it' : `Need ${Math.ceil(d.wood / 4)} wood${d.food ? ` and ${d.food} food` : ''} to start`}</button>`) + '</li>';
    }
    h += '</ul>';
    const sites = B.sites(sim);
    h += `<h3>Under construction <small>${sites.length}</small></h3>`;
    if (!sites.length) h += '<p class="sub">Nothing being built right now.</p>';
    for (const s of sites) {
      const k = Math.round(s.work / s.need * 100);
      const now = sim.people.filter(p => p.action && p.action.site === s).map(p => p.name);
      const woodLeft = s.woodNeed - s.wood;
      h += `<div class="card"><div><b>${e(B.TYPES[s.type].name)}</b> · ${k}%${woodLeft > 0 ? ` · still needs ${woodLeft} wood` : ''}<div class="meter"><i style="width:${k}%"></i></div>${s.stalled && woodLeft > 0 && W.wood <= 0 ? '<span class="bad">Waiting for wood. Islanders will chop more.</span><br>' : ''}${now.length ? `Working on it now: ${e(now.join(', '))}.` : 'Nobody on it right now. Builders work 7:30 to 19:00.'}${(s.helpers || []).length ? ` Helped so far: ${e(s.helpers.join(', '))}.` : ''}<br><button class="key" data-cancel="${s.id}">Call it off</button></div></div>`;
    }
    const done = B.state(sim).filter(s => s.state === 'done');
    if (done.length) h += `<h3>Built <small>${done.length}</small></h3><p class="sub">${done.map(s => e(B.TYPES[s.type].name)).join(', ')}</p>`;
    return h;
  };
  B.bindPanel = (sim, ui, body) => {
    for (const b of body.querySelectorAll('[data-build]')) b.addEventListener('click', () => B.startPlacing(sim, b.dataset.build));
    for (const b of body.querySelectorAll('[data-cancel]')) b.addEventListener('click', () => { const s = B.sites(sim).find(x => x.id === b.dataset.cancel); if (s) { B.cancel(sim, s); ui.renderTown(); } });
  };

  // ------------------------------------------------------------ the Sky can help
  B.siteAt = (sim, wx, wy) => B.sites(sim).find(s => inRect(Math.floor(wx / T()), Math.floor((wy - 6) / T()), s, 1)) || null;
  B.onBless = (sim, wx, wy) => {
    const s = B.siteAt(sim, wx, wy);
    if (!s) return false;
    s.work = Math.min(s.need, s.work + s.need * 0.3);
    sim.log(`Golden light poured over the ${B.TYPES[s.type].name.toLowerCase()} site. The work leapt ahead.`, 'sky');
    if (s.work >= s.need) B.complete(sim, s);
    return true;
  };
  B.onPopulation = (sim, pop) => {
    for (const [id, d] of Object.entries(B.TYPES)) if (d.unlock && pop === d.unlock) { sim.log(`With ${pop} islanders, the town can now build a ${d.name.toLowerCase()}.`, 'good'); sim.toast(`New building unlocked: ${d.name}!`); }
  };

  // ------------------------------------------------------------ saving
  B.serialize = sim => B.state(sim).map(s => ({ id: s.id, type: s.type, x0: s.x0, y0: s.y0, w: s.w, h: s.h, state: s.state, work: s.work, wood: s.wood, roof: s.roof, helpers: s.helpers || [], path: s.path || null, started: s.started, done: s.done }));
  B.restore = (sim, list) => {
    sim.builds = B.state(sim);
    for (const s of list || []) {
      if (sim.builds.some(x => x.id === s.id) || sim.world.buildings.some(b => b.id === s.id)) continue; // already there
      const r = { x0: s.x0, y0: s.y0, w: s.w, h: s.h };
      const res = B.place(sim, s.type, r, { restore: true, id: s.id, work: s.work, wood: s.wood ?? B.TYPES[s.type].wood, roof: s.roof, started: s.started });
      if (!res.ok) continue;
      res.site.helpers = s.helpers || [];
      if (s.state === 'done') B.complete(sim, res.site, { restore: true, path: s.path || undefined });
    }
  };

  B.register = () => {
    for (const d of [BUILD, ...VENUES]) { IS.Actions[d.id] = d; if (!IS.Actions.list.includes(d)) IS.Actions.list.push(d); }
  };
  B.register();
  return B;
})();
