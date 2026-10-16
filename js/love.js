// Couples: what being together actually changes.
//  - a relationship has a history: when it started, a stage (new, dating,
//    serious, engaged, married), pet names, anniversaries
//  - dates only couples go on: sunset by the sea (holding hands), a picnic
//    for two, a slow dance under the lamps
//  - gifts picked for what the other one loves
//  - kisses hello, jealousy, fights and making up
//  - proposals, and a wedding at the Hall that the whole island attends
//  - the Sky Hand notices: grab one and the other one yells at you,
//    bless them together and they take it as a sign
IS.Love = (() => {
  const L = {};
  const T = () => IS.TILE;
  const H = h => h * 60;
  const between = (min, a, b) => (a <= b ? min >= a && min < b : min >= a || min < b);
  const clear = c => c.weather === 'sunny' || c.weather === 'cloudy';
  const pick = (arr, who) => IS.pick(arr, who);
  const both = (a, b, f) => { f(a.relTo(b.name), a, b); f(b.relTo(a.name), b, a); };

  // ------------------------------------------------------------ the relationship itself
  L.begin = (sim, a, b) => {
    both(a, b, r => { r.since = sim.clock.abs; r.engaged = false; r.married = false; r.tiff = null; r.annivSaid = 0; r.pet = null; });
  };
  L.end = (sim, a, b) => {
    both(a, b, r => { r.engaged = false; r.married = false; r.tiff = null; r.since = undefined; });
    L.callOff(sim, a.name, b.name, 'breakup');
  };
  L.since = (p, o) => {
    const r = p.relTo(o.name), r2 = o.relTo(p.name);
    if (r.since === undefined || r.since === null) r.since = r2.since ?? p.sim.clock.abs;
    r2.since = r.since;
    return r.since;
  };
  L.days = (p, o) => Math.max(0, Math.floor((p.sim.clock.abs - L.since(p, o)) / 1440));
  L.stage = (p, o) => {
    const r = p.relTo(o.name);
    if (!r.partner) return null;
    if (r.married) return 'married';
    if (r.engaged) return 'engaged';
    const d = L.days(p, o);
    if (d >= 3 && r.romance > 80) return 'serious';
    return d >= 1 ? 'dating' : 'new';
  };
  const STAGE = { new: 'Just started dating', dating: 'Dating', serious: 'Serious', engaged: 'Engaged', married: 'Married' };
  L.label = (p, name) => {
    const o = p.sim.byName(name);
    if (!o) return 'Partner';
    const d = L.days(p, o), s = L.stage(p, o);
    return `${s === 'new' ? 'Partner' : STAGE[s]}${d >= 1 ? ` · ${d} day${d > 1 ? 's' : ''}` : ''}`;
  };
  L.tiff = (p, o) => { const r = p.relTo(o.name), r2 = o.relTo(p.name); return (r.tiff && r.tiff.stormed) || (r2.tiff && r2.tiff.stormed) ? (r.tiff || r2.tiff) : null; };

  // What they call each other. Picked once, kept forever.
  const PETS = {
    Iroh: ['nerd', 'goofball', 'dork', 'snack'], Forest: ['babe', 'champ', 'gorgeous'], Egg: ['sleepyhead', 'pumpkin', 'bean'],
    Jude: ['trouble', 'gorgeous', 'angel'], Beach: ['darling', 'sweetie', 'my love'], Lynn: ['sweetheart', 'love', 'sunshine'],
  };
  L.pet = (sp, o) => {
    if (!o || !sp.relTo(o.name).partner) return o ? o.name : 'you';
    const r = sp.relTo(o.name);
    if (!r.pet) r.pet = IS.pick(PETS[sp.name] || ['babe', 'love', 'sweetheart']);
    return Math.random() < 0.65 ? r.pet : o.name;
  };

  // ------------------------------------------------------------ dates only couples go on
  const freePartner = p => {
    const o = p.partner();
    if (!o || o.dead || p.sick || o.sick || L.tiff(p, o)) return null;
    if (IS.Gods && IS.Gods.inMourning && (IS.Gods.inMourning(p) || IS.Gods.inMourning(o))) return null;
    return IS.Mind.available(o, p) ? o : null;
  };
  const dateScore = (p, base, id) => {
    const o = freePartner(p);
    if (!o) return 0;
    const r = p.relTo(o.name);
    const since = p.sim.clock.abs - (r.lastDate ?? -1e9);
    // Two dates a day at most, six hours apart
    if ((r.dateDay === p.sim.clock.day && r.dateN >= 2) || since < 360) return 0;
    return Math.max(0.05, base + r.romance / 300 + p.traits.sociable * 0.1 + (since > 900 ? 0.25 : 0) - (r.lastKind === id ? 0.3 : 0));
  };
  // Keep the pair in step: if the other one walked off, wrap up soon after
  const inStep = (p, a, dt) => {
    const o = a.with && p.sim.byName(a.with);
    const ok = o && o.action && o.action.def === a.def;
    if (ok) a.alone = 0;
    else { a.alone = (a.alone || 0) + dt; if (a.alone > 4) a.done = true; }
    return ok ? o : null;
  };
  const dateFinish = (p, a, line) => {
    const o = a.with && p.sim.byName(a.with);
    if (!o) return;
    p.needs.social = Math.min(100, p.needs.social + 25);
    if (a.invitedBy) return;
    if (line && Math.random() < 0.7) p.say(line.replace('{pet}', L.pet(p, o)), 2.6);
    L.milestone(p.sim, p, o);
  };

  // Somewhere out in the open, so walls don't hide the couple
  const open = (W, x, y, m = 2) => !W.buildings.some(b => x >= b.x0 - m && x <= b.x0 + b.w + m - 1 && y >= b.y0 - m && y <= b.y0 + b.h + m - 1);
  // The partner joins on the tile right beside the host (same screen row in iso)
  const beside = (p, extra = {}) => {
    const h = p.dateHost, W = p.world;
    if (!h || !h.action) return null;
    const hx = h.action.tx, hy = h.action.ty;
    for (const [dx, dy] of [[1, -1], [-1, 1], [1, 0], [0, 1], [0, -1], [-1, 0]]) {
      const x = hx + dx, y = hy + dy;
      if (W.walkable(x, y) && W.reach[W.idx(x, y)] === 1 && !W.buildingAt(x, y) && !p.sim.people.some(o => o !== p && o.tx === x && o.ty === y)) return { tx: x, ty: y, fixed: true, face: h.action.face, ...extra };
    }
    return null;
  };
  const DATES = [
    {
      id: 'sunsetWalk', label: 'Watching the sunset together', outdoor: true, couple: true, chatOK: true,
      can: (p, c) => between(c.min, H(17.25), H(20)) && clear(c),
      score: p => dateScore(p, 0.45, 'sunsetWalk'),
      plan: p => { if (p.dateHost) return beside(p, { duration: IS.rand(30, 50) }); const spot = p.world.freeSpot('shore'); return spot ? { spot, duration: IS.rand(30, 50), face: spot.face } : null; },
      tick: (p, a, dt) => {
        p.needs.fun = Math.min(100, p.needs.fun + 0.2 * dt);
        const o = inStep(p, a, dt);
        if (o && a.phase === 'do' && Math.random() < 0.012 * dt) p.say(pick(['Look at the colours.', 'I could stay here forever.', 'This is my favourite part of the day now.', 'You\'re warm.', '*squeezes {pet}\'s hand*', 'Same time tomorrow?'], p.name).replace('{pet}', L.pet(p, o)), 2.4);
      },
      finish: (p, a) => dateFinish(p, a, IS.pick(['Best sunset yet, {pet}.', 'Okay. I\'m keeping you.', 'That was perfect.'])),
      thought: (p, a) => (a.with ? `Watching the sun go down with ${a.with}. Holding hands.` : 'Sunset. Just us.'),
    },
    {
      id: 'picnicDate', label: 'Picnic for two', outdoor: true, couple: true, chatOK: true, pose: 'sit',
      can: (p, c) => between(c.min, H(11), H(16)) && clear(c) && p.world.food >= 1,
      score: p => { const s = dateScore(p, 0.2, 'picnicDate'); return s ? s + (100 - p.needs.hunger) / 400 : 0; },
      plan: p => {
        if (p.dateHost) return beside(p, { duration: IS.rand(40, 60) });
        const W = p.world, poi = W.pois.find(x => x.name === 'the west meadow') || IS.pick(W.pois);
        const t2 = W.findNear(poi.x + IS.randi(-3, 3), poi.y + IS.randi(-2, 2), (x, y) => W.walkable(x, y) && W.reach[W.idx(x, y)] === 1 && open(W, x, y, 8) && W.walkable(x + 1, y - 1) && W.walkable(x, y + 1) && W.walkable(x + 1, y) && W.walkable(x + 1, y + 1), 12) || W.findNear(poi.x, poi.y, (x, y) => W.walkable(x, y) && W.reach[W.idx(x, y)] === 1 && open(W, x, y) && W.walkable(x + 1, y - 1), 8);
        return t2 ? { tx: t2.x, ty: t2.y, duration: IS.rand(40, 60), face: 'right' } : null;
      },
      start: (p, a) => {
        if (a.invitedBy) { const h = p.sim.byName(a.invitedBy); if (h) p.dir = h.x < p.x ? 'left' : 'right'; return; }
        p.world.food = Math.max(0, p.world.food - 1);
        L.objects(p.sim).push(a.blanket = { kind: 'blanket', x: p.x + T() * 0.5, y: p.y - T() * 0.5 + 2, by: p.name, t: p.sim.clock.abs, color: IS.pick(['#e0405a', '#4a8fe0', '#f2b82e']) });
      },
      tick: (p, a, dt) => {
        p.needs.fun = Math.min(100, p.needs.fun + 0.16 * dt);
        p.needs.hunger = Math.min(100, p.needs.hunger + 0.5 * dt);
        const o = inStep(p, a, dt);
        if (o && a.phase === 'do' && Math.random() < 0.01 * dt) p.say(pick(['I made the sandwiches myself. Be nice.', 'Try the strawberries.', 'You have crumbs. Right... there.', 'This is so much better than eating alone.', 'Feed me a grape, {pet}.'], p.name).replace('{pet}', L.pet(p, o)), 2.4);
      },
      finish: (p, a) => dateFinish(p, a, IS.pick(['Best lunch ever.', 'We should do this every Sunday.', 'I\'m so full. And so happy.'])),
      cancel: (p, a) => { if (a && a.blanket) a.blanket.t -= 9999; },
      thought: (p, a) => (a.with ? `A picnic with ${a.with}. Sandwiches, sunshine, no one else.` : 'Picnic blanket: check.'),
    },
    {
      id: 'slowDance', label: 'Slow dancing', outdoor: true, couple: true,
      can: (p, c) => between(c.min, H(19.5), H(23.5)) && c.weather !== 'rain' && c.weather !== 'storm',
      score: p => { const s = dateScore(p, 0.35, 'slowDance'); return s ? s + (p.traits.energetic > 0.5 ? 0.1 : 0) : 0; },
      plan: p => {
        if (p.dateHost) return beside(p, { duration: IS.rand(20, 35) });
        const W = p.world, fire = W.bonfire && W.bonfire.lit;
        const poi = W.pois.find(x => x.name === (fire ? 'the beach' : 'the plaza')) || IS.pick(W.pois);
        const t2 = W.findNear(poi.x + IS.randi(-2, 2), poi.y + IS.randi(-2, 2), (x, y) => W.walkable(x, y) && W.reach[W.idx(x, y)] === 1 && open(W, x, y), 8) || W.findNear(poi.x, poi.y, (x, y) => W.walkable(x, y) && W.reach[W.idx(x, y)] === 1 && !W.buildingAt(x, y), 6);
        return t2 ? { tx: t2.x, ty: t2.y, duration: IS.rand(20, 35) } : null;
      },
      start: (p, a) => { const h = a.with && p.sim.byName(a.with); if (h) p.faceToward(h.x, h.y); },
      tick: (p, a, dt) => {
        p.needs.fun = Math.min(100, p.needs.fun + 0.22 * dt);
        const o = inStep(p, a, dt);
        if (!o || a.phase !== 'do') return;
        p.anim += dt * 2;
        if (Math.random() < dt * 0.05) p.faceToward(o.x, o.y);
        if (Math.random() < dt * 0.04) p.emote(IS.pick(['heart', 'note']), 1.4);
        if (Math.random() < dt * 0.008) p.say(pick(['You\'re stepping on my feet.', 'There\'s no music. I don\'t care.', 'Spin me.', '*hums badly*', 'Don\'t let go.'], p.name), 2.2);
        if (!a.invitedBy && !a.seen && Math.random() < dt * 0.05) { a.seen = true; L.onlookers(p.sim, p, o, 'dance'); }
      },
      finish: (p, a) => dateFinish(p, a, IS.pick(['Okay, I can\'t dance. But that was perfect.', 'One more song? There\'s no song. One more anyway.', 'My feet hurt. Worth it.'])),
      thought: (p, a) => (a.with ? `Dancing with ${a.with}. There's no music. Doesn't matter.` : 'Dance with me.'),
    },
    {
      // A gift: go find something they'd love, then take it to them
      id: 'loveGift', label: 'Finding a gift', outdoor: true, pose: 'work',
      can: (p, c) => between(c.min, H(8), H(18.5)) && !p.giftFor && c.weather !== 'storm',
      score: p => {
        const o = p.partner();
        if (!o || o.dead || p.sick) return 0;
        const r = p.relTo(o.name);
        if (p.sim.clock.abs - (r.lastGift ?? -1e9) < 1440 * 1.2) return 0;
        return 0.2 + r.romance / 300 + p.traits.kind * 0.25 + (L.tiff(p, o) ? 0.5 : 0);
      },
      plan: p => {
        const o = p.partner(); if (!o) return null;
        const g = L.giftFor(p, o);
        const t2 = g.where === 'shore' ? p.world.freeSpot('shore') : null;
        if (t2) return { spot: t2, duration: IS.rand(8, 14), gift: g };
        const W = p.world, poi = W.pois.find(x => x.name === g.where) || IS.pick(W.pois);
        const tt = W.findNear(poi.x + IS.randi(-3, 3), poi.y + IS.randi(-2, 2), (x, y) => W.walkable(x, y) && W.reach[W.idx(x, y)] === 1 && !W.buildingAt(x, y), 6);
        return tt ? { tx: tt.x, ty: tt.y, duration: IS.rand(8, 14), gift: g } : null;
      },
      finish: (p, a) => {
        const o = p.partner(); if (!o) return;
        p.giftFor = { to: o.name, gift: a.gift, t: p.sim.clock.abs };
        p.relTo(o.name).lastGift = p.sim.clock.abs;
        p.say(IS.pick([`Perfect. ${o.name} is going to love this.`, 'Found it!', 'Okay, act cool. It\'s just a gift.']), 2.2);
        p.emote('gift', 1.6);
      },
      thought: (p, a) => `Finding ${a.gift ? a.gift.what : 'something nice'} for ${(p.partner() || {}).name || 'someone'}.`,
    },
  ];
  L.DATES = DATES;
  L.isDate = id => DATES.some(d => d.id === id && d.couple);

  // What would they actually like?
  const GIFTS = [
    { what: 'a bunch of wildflowers', love: 'gardening', where: 'the west meadow', line: 'I picked these for you. The yellow ones reminded me of you.' },
    { what: 'a pretty shell', love: 'shells', where: 'shore', line: 'I found this shell. It\'s pink inside. Like, really pink.' },
    { what: 'a heart-shaped stone', love: null, where: 'shore', line: 'Look. It\'s a rock. Shaped like a heart. I\'ve been looking for an hour.' },
    { what: 'a fresh fish', love: 'fishing', where: 'shore', line: 'I got you a fish. It\'s the romantic kind of fish.' },
    { what: 'a pine cone', love: 'wandering', where: 'the Old Oak', line: 'A perfect pine cone. Don\'t laugh. It\'s perfect.' },
    { what: 'a little drawing', love: 'painting', where: 'the west meadow', line: 'I drew you. It\'s not great. Your nose is... interpretive.' },
    { what: 'a song', love: 'music', where: 'the plaza', line: 'I wrote you a song. It\'s three notes. They\'re YOUR three notes.' },
  ];
  L.giftFor = (p, o) => {
    const fits = GIFTS.filter(g => g.love && o.loves.includes(g.love) && !(o.hates || []).includes(g.love));
    return IS.pick(fits.length && Math.random() < 0.8 ? fits : GIFTS.filter(g => !g.love || !(o.hates || []).includes(g.love)));
  };
  L.giftVerdict = (b, g) => {
    if (g.love && (b.hates || []).includes(g.love)) return 'meh';
    if (g.love && b.loves.includes(g.love)) return 'love';
    return b.traits.grumpy > 0.6 && Math.random() < 0.4 ? 'meh' : 'like';
  };

  // ------------------------------------------------------------ asking the partner along
  const ASK = {
    sunsetWalk: ['Sun\'s going down. Come watch it with me, {pet}?', 'Walk with me? The sky\'s doing the pink thing.', 'Sunset. You. Me. Now?'],
    picnicDate: ['I packed us a picnic. Don\'t ask questions, just come.', 'Picnic? Just us two, {pet}?', 'I\'m kidnapping you for lunch.'],
    slowDance: ['Dance with me, {pet}.', 'There\'s no music. Dance with me anyway?', 'Hey. Come here. I want to dance.'],
  };
  const YES = {
    sunsetWalk: ['Always.', 'Hold my hand the whole way.', 'I was hoping you\'d ask.'],
    picnicDate: ['You packed FOOD? Marry me.', 'Yes! What kind of sandwiches?', 'I\'m being kidnapped. Yay.'],
    slowDance: ['I can\'t dance. Yes.', 'Lead the way, {pet}.', 'Only if you don\'t laugh.'],
  };
  const NO = ['Not now, {pet}. Later?', 'I\'m wiped. Rain check?', 'Can\'t right now. Sorry!'];
  L.invite = (sim, p, a) => {
    const def = a.def, o = p.partner();
    const r = o ? o.relTo(p.name) : null;
    const fail = () => { p.failUntil[def.id] = sim.clock.abs + 120; p.cancelAction(); };
    if (!o || !IS.Mind.available(o, p)) { if (o && (a.cmd || p.dateCmd)) p.say(`${o.name} is busy... later, then.`, 2); return fail(); }
    p.say(pick(ASK[def.id], p.name).replace('{pet}', L.pet(p, o)), 2.6);
    const e = IS.Mind.feeling(o);
    let yes = 0.72 + r.romance / 400 + (a.cmd || p.dateCmd ? 0.15 : 0) - (o.needs.energy < 25 ? 0.35 : 0) - (e && e.type === 'sulking' && e.about === p.name ? 0.9 : 0);
    o.dateHost = p;
    const joined = Math.random() < yes && IS.Mind.join(sim, o, p, def);
    o.dateHost = null;
    if (joined) {
      a.with = o.name; a.date = true;
      o.action.date = true; o.action.with = p.name;
      setTimeout(() => { if (!o.chat) o.say(pick(YES[def.id], o.name).replace('{pet}', L.pet(o, p)), 2.4); }, 1100);
      const day = sim.clock.day, first = o.relTo(p.name).dateDay !== day;
      both(p, o, rr => { if (rr.dateDay !== day) { rr.dateDay = day; rr.dateN = 0; } rr.dateN++; rr.lastDate = sim.clock.abs; rr.lastKind = def.id; });
      if (first) IS.Mind.news(sim, 'date', p, o);
      sim.log(`${p.name} and ${o.name}: ${{ sunsetWalk: 'watching the sunset together, holding hands', picnicDate: 'a picnic for two in the meadow', slowDance: 'slow dancing with no music' }[def.id]}. ♥`, 'love', [p, o]);
      return;
    }
    setTimeout(() => { if (!o.chat) o.say(pick(NO, o.name).replace('{pet}', L.pet(o, p)), 2.2); }, 1100);
    p.addMood(`${o.name} said not now`, -2, 120);
    fail();
  };

  // ------------------------------------------------------------ milestones
  const MILESTONES = [1, 3, 7, 14, 28, 56];
  L.nextAnniv = (p, o) => {
    const d = L.days(p, o), said = p.relTo(o.name).annivSaid || 0;
    const m = MILESTONES.filter(x => x <= d && x > said).pop();
    return m || null;
  };
  L.milestone = (sim, p, o) => {
    const s = L.stage(p, o), r = p.relTo(o.name);
    if (s === 'serious' && !r.seriousLogged) {
      both(p, o, rr => { rr.seriousLogged = true; });
      sim.log(`${p.name} and ${o.name} are getting serious. The island has noticed.`, 'love', [p, o]);
    }
  };

  // ------------------------------------------------------------ talking (added to the topic pool)
  L.topics = (sim, sp, li, add) => {
    const r = sp.relTo(li.name), now = sim.clock.abs;
    if (IS.Gods && IS.Gods.inMourning && IS.Gods.inMourning(sp)) return;
    // Someone just flirted with your partner and they flirted back
    const myTiff = r.tiff;
    if (r.partner && myTiff && !myTiff.stormed && !myTiff.talked) add('coupleFight', 7 + sp.traits.grumpy * 3, { rival: myTiff.about });
    const tf = L.tiff(sp, li);
    if (r.partner && tf && tf.stormed && now - tf.stormed > 90) add('makeUp', 5 + sp.traits.kind * 4);
    if (!r.partner) {
      if (sp.giftFor && sp.giftFor.to === li.name) add('gift', 12, { gift: sp.giftFor.gift });
      return;
    }
    if (sp.giftFor && sp.giftFor.to === li.name) add('gift', 12, { gift: sp.giftFor.gift });
    if (tf) return;
    const ann = L.nextAnniv(sp, li);
    if (ann) add('anniversary', 6, { days: ann });
    add('us', 1.6 + sp.traits.sociable * 0.4);
    const stage = L.stage(sp, li);
    if (stage === 'serious' && r.romance > 88 && r.friendship > 50 && now - (r.proposedAt ?? -1e9) > 1440 * 1.5 && L.days(sp, li) >= 4) add('propose', 3.5 + (1 - sp.traits.grumpy) * 2);
    if (stage === 'engaged') add('weddingTalk', 2.4);
  };

  // Would they say yes?
  L.wouldMarry = (b, a) => {
    const r = b.relTo(a.name);
    return r.partner && r.romance > 78 && r.friendship > 40 && !L.tiff(a, b) && (L.days(a, b) >= 2 || r.romance > 95);
  };

  L.engage = (sim, a, b) => {
    const day = sim.clock.day + 2;
    both(a, b, r => { r.engaged = true; r.weddingDay = day; });
    sim.weddings = (sim.weddings || []).filter(w => !(w.a === a.name || w.b === a.name || w.a === b.name || w.b === b.name));
    sim.weddings.push({ a: a.name, b: b.name, day });
    for (const [p, o] of [[a, b], [b, a]]) { p.remember(`Got engaged to ${o.name}!!`, { tag: 'romance', mood: 30, moodDuration: 2880, about: o.name, news: true }); p.emote('heart', 3); }
    L.hearts(sim, a, 18); L.hearts(sim, b, 18);
    IS.Mind.news(sim, 'engaged', a, b);
    sim.log(`${a.name} proposed to ${b.name}... and ${b.name} said YES! The wedding is on ${IS.WEEKDAYS[sim.weekdayOf(day)]} at the Hall. 💍`, 'love', [a, b]);
    sim.toast(`${a.name} and ${b.name} are engaged! Wedding on ${IS.WEEKDAYS[sim.weekdayOf(day)]}.`);
    L.onlookers(sim, a, b, 'propose');
  };
  L.callOff = (sim, an, bn, why) => {
    const had = (sim.weddings || []).some(w => !w.done && ((w.a === an && w.b === bn) || (w.a === bn && w.b === an)));
    sim.weddings = (sim.weddings || []).filter(w => w.done || !((w.a === an && w.b === bn) || (w.a === bn && w.b === an)));
    if (had && sim.events) for (const ev of sim.events.list) if (ev.kind === 'wedding' && ev.couple.includes(an) && ev.couple.includes(bn) && ev.state !== 'done') ev.state = 'done';
    if (had) sim.log(why === 'breakup' ? `The wedding of ${an} and ${bn} is off.` : `The wedding of ${an} and ${bn} won't happen now.`, 'warn');
  };
  L.marry = (sim, a, b) => {
    both(a, b, r => { r.married = true; r.engaged = false; r.romance = Math.min(100, r.romance + 5); });
    for (const w of sim.weddings || []) if ((w.a === a.name && w.b === b.name) || (w.a === b.name && w.b === a.name)) w.done = true;
    for (const [p, o] of [[a, b], [b, a]]) { p.remember(`Married ${o.name}. Best day of my life.`, { tag: 'romance', mood: 35, moodDuration: 2880, about: o.name, news: true }); IS.Mind.feel(p, 'giddy', o.name, 20); }
    IS.Mind.news(sim, 'wedding', a, b);
    sim.log(`${a.name} and ${b.name} are married! The whole Hall cried. 💒`, 'love', [a, b]);
    sim.toast(`${a.name} and ${b.name} just got married!`);
  };

  // People nearby see a couple being a couple
  L.onlookers = (sim, a, b, what) => {
    for (const w of sim.people) {
      if (w === a || w === b || w.pose === 'sleep' || w.mode !== 'normal' || w.chat || (w.building || null) !== (a.building || null) || IS.dist(w.x, w.y, a.x, a.y) > T() * 9) continue;
      const rival = [a, b].find(x => w.relTo(x.name).romance > 45);
      if (rival) {
        const other = rival === a ? b : a;
        IS.Mind.feel(w, 'jealous', other.name, what === 'propose' ? 12 : 6);
        w.thought = `${rival.name} and ${other.name}. Great. Love that for them. Ugh.`;
        if (Math.random() < 0.6) w.say(pick(['...Cool.', 'Ugh.', 'I\'m fine. I\'m FINE.'], w.name), 2);
        continue;
      }
      if (Math.random() > 0.65) continue;
      const f = (w.relTo(a.name).friendship + w.relTo(b.name).friendship) / 2;
      const lines = what === 'propose' ? (f > 10 ? ['OH MY GOSH!', 'SAY YES! SAY YES!', 'I\'m crying. I\'m actually crying.'] : ['Wow. Okay.', 'Bold.'])
        : what === 'kiss' ? (w.traits.grumpy > 0.5 ? ['Get a room.', 'Ew. In public?', 'Some of us are trying to have a day.'] : ['Aww!', 'Stop it, you two.', 'Get a room! ...Cute though.'])
          : (f > 20 ? ['Aww, look at them.', 'Okay, that\'s adorable.', 'I want what they have.'] : ['There\'s no music...', 'Are they... dancing?', 'Get a room.']);
      setTimeout(() => { if (!w.chat && w.mode === 'normal') w.say(pick(lines, w.name), 2.2); }, 600 + Math.random() * 900);
      if (f > 10 && what !== 'kiss') w.addMood(`Saw ${a.name} and ${b.name} being cute`, 3, 240);
    }
  };

  // ------------------------------------------------------------ hellos
  L.onChatStart = (sim, conv) => {
    const { a, b } = conv;
    if (!a.relTo(b.name).partner || L.tiff(a, b)) return;
    if (IS.Gods && IS.Gods.inMourning && (IS.Gods.inMourning(a) || IS.Gods.inMourning(b))) return;
    if (sim.clock.abs - (a.relTo(b.name).lastKiss ?? -1e9) < 120 || Math.random() > 0.6) return;
    both(a, b, r => { r.lastKiss = sim.clock.abs; });
    L.kiss(sim, a, b);
  };
  L.kiss = (sim, a, b) => {
    a.faceToward(b.x, b.y); b.faceToward(a.x, a.y);
    a.emote('heart', 1.8); b.emote('heart', 1.8);
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, s = IS.Iso.w2s(mx, my);
    for (let i = 0; i < 6; i++) sim.fx.add({ x: s.x + IS.rand(-5, 5), y: s.y - 26 - IS.rand(0, 6), vx: IS.rand(-8, 8), vy: IS.rand(-24, -12), g: 0, max: IS.rand(0.8, 1.3), color: IS.pick(['#ff6f91', '#ff9db5', '#e0405a']), size: 2, fade: true });
    a.changeRel(b.name, 0.5, 1); b.changeRel(a.name, 0.5, 1);
    if (Math.random() < 0.5) L.onlookers(sim, a, b, 'kiss');
  };
  L.hearts = (sim, p, n = 10) => {
    const s = IS.Iso.w2s(p.x, p.y);
    for (let i = 0; i < n; i++) sim.fx.add({ x: s.x + IS.rand(-10, 10), y: s.y - IS.rand(14, 34), vx: IS.rand(-14, 14), vy: IS.rand(-34, -14), g: 0, max: IS.rand(0.9, 1.7), color: IS.pick(['#ff6f91', '#ff9db5', '#e0405a', '#fff0f4']), size: 2, fade: true });
  };

  // ------------------------------------------------------------ jealousy -> a fight
  L.onFlirtSeen = (sim, watcher, flirter, partner, landed) => {
    if (!watcher.relTo(partner.name).partner || !landed) return;
    const r = watcher.relTo(partner.name);
    if (r.tiff && sim.clock.abs - r.tiff.t < 240) return;
    r.tiff = { about: flirter.name, t: sim.clock.abs, stormed: 0, talked: false };
    watcher.thought = `Did ${partner.name} just flirt BACK with ${flirter.name}?!`;
  };
  L.fightOutcome = (sim, a, b, ctx) => {
    const r = a.relTo(b.name);
    if (!r.tiff) return;
    r.tiff.talked = true;
    if (ctx.vars.soften) {
      r.tiff = null;
      a.changeRel(b.name, 1, 2); b.changeRel(a.name, 1, 2);
      L.kiss(sim, a, b);
      return;
    }
    r.tiff.stormed = sim.clock.abs;
    for (const [p, o] of [[a, b], [b, a]]) { p.changeRel(o.name, -5, -4); IS.Mind.feel(p, 'sulking', o.name, 8); p.remember(`Had a fight with ${o.name}`, { tag: 'fight', about: o.name, mood: -8 }); }
    IS.Mind.news(sim, 'fight', a, b);
    sim.log(`${a.name} and ${b.name} had a lovers' spat about ${r.tiff.about}.`, 'warn', [a, b]);
    if (a.relTo(b.name).romance < 40 && ctx.vars.guilty) IS.Mind.breakup(sim, a, b);
  };
  L.madeUp = (sim, a, b) => {
    both(a, b, r => { r.tiff = null; });
    for (const [p, o] of [[a, b], [b, a]]) { IS.Mind.clearFeeling(p, 'sulking'); p.changeRel(o.name, 3, 4); p.remember(`Made up with ${o.name}`, { tag: 'romance', about: o.name, mood: 10 }); }
    L.kiss(sim, a, b);
    IS.Mind.news(sim, 'makeup', a, b);
    sim.log(`${a.name} and ${b.name} made up. Kiss and everything.`, 'love', [a, b]);
  };

  // ------------------------------------------------------------ the Sky Hand
  L.onBless = (sim, targets) => {
    const seen = new Set();
    for (const p of targets) {
      const o = p.partner();
      if (!o || seen.has(o.name) || IS.dist(o.x, o.y, p.x, p.y) > T() * 3) continue;
      seen.add(p.name); seen.add(o.name);
      both(p, o, r => { r.romance = Math.min(100, r.romance + 6); r.skyBlessed = sim.clock.abs; });
      L.hearts(sim, p, 14); L.hearts(sim, o, 14);
      for (const [x, y] of [[p, o], [o, p]]) x.remember(`The Sky blessed me and ${y.name} together`, { tag: 'blessed', about: y.name, mood: 10, moodDuration: 1440 });
      setTimeout(() => { if (p.mode === 'normal') p.say(IS.pick(['The sky approves of us!', 'Did... the sky just bless US?', 'That\'s a sign. That\'s definitely a sign.']), 2.6); }, 1500);
      sim.log(`The Sky blessed ${p.name} and ${o.name} together. They're taking it as a sign.`, 'love', [p, o]);
    }
  };

  // ------------------------------------------------------------ every tick
  L.tick = (sim, dt) => {
    if (!(dt > 0)) return;
    const now = sim.clock.abs;
    for (const p of sim.people) {
      const o = p.partner();
      // Grab one, the other one yells at the sky
      if (o && p.mode === 'carried' && !p.loveCarry) {
        p.loveCarry = true;
        if (o.mode === 'normal' && o.pose !== 'sleep' && !o.chat && IS.dist(o.x, o.y, p.x, p.y) < T() * 14) {
          o.say(IS.pick([`PUT ${L.pet(o, p).toUpperCase()} DOWN!`, `Hey! That's my ${L.stage(o, p) === 'married' ? 'spouse' : 'partner'}!`, `${p.name}!! Be gentle with them!`, 'Don\'t you DARE drop them!']), 2.6);
          o.emote('anger', 2); o.faceToward(p.x, p.y);
          o.skyOpinion = IS.clamp(o.skyOpinion - 3, -100, 100);
        }
      }
      if (p.mode === 'normal' && p.loveCarry) {
        p.loveCarry = false;
        if (o && o.mode === 'normal' && !o.chat && IS.Social.isFree(o) && IS.dist(o.x, o.y, p.x, p.y) < T() * 18 && Math.random() < 0.8) IS.Social.approach(sim, o, p, 'checkOn');
      }
      // Gift in hand: go find them (expires after half a day)
      if (p.giftFor) {
        const to = sim.byName(p.giftFor.to);
        if (!to || now - p.giftFor.t > 720) { p.giftFor = null; continue; }
        if (!p.chat && p.mode === 'normal' && !p.sick && p.pose !== 'sleep' && (!p.action || (p.action.def.id !== 'approach' && !p.action.forced && !p.action.event)) && to.mode === 'normal' && to.pose !== 'sleep' && (p.giftTry || 0) < now) {
          p.giftTry = now + 30;
          IS.Social.approach(sim, p, to, 'gift', false, { gift: p.giftFor.gift });
        }
      }
    }
  };
  L.objects = sim => (sim.loveObjs = (sim.loveObjs || []).filter(o => sim.clock.abs - o.t < 90));

  // ------------------------------------------------------------ drawing
  L.drawObj = (R, ctx, o, x, y) => {
    if (o.kind !== 'blanket') return;
    ctx.fillStyle = 'rgba(40, 20, 60, 0.2)'; ctx.beginPath(); ctx.ellipse(x, y + 1, 19, 7, 0, 0, Math.PI * 2); ctx.fill();
    const pts = [[-18, 0], [0, -8], [18, 0], [0, 8]];
    ctx.fillStyle = o.color; ctx.beginPath(); pts.forEach(([a, b], i) => (i ? ctx.lineTo(x + a, y + b) : ctx.moveTo(x + a, y + b))); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff6ec';
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) if ((i + j) % 2 === 0) { const cx = x + (i - j) * 3.4, cy = y + (i + j) * 1.6; if (Math.abs(cx - x) / 18 + Math.abs(cy - y) / 8 < 0.85) ctx.fillRect(Math.round(cx) - 1, Math.round(cy) - 1, 3, 2); }
    // basket
    ctx.fillStyle = '#8a5a2a'; ctx.fillRect(x + 6, y - 6, 8, 5); ctx.fillStyle = '#b07a3a'; ctx.fillRect(x + 6, y - 6, 8, 1);
    ctx.strokeStyle = '#6a4020'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x + 10, y - 6, 3, Math.PI, 0); ctx.stroke();
    ctx.fillStyle = '#e0405a'; ctx.fillRect(x - 8, y - 2, 2, 2); ctx.fillRect(x - 5, y - 1, 2, 2);
  };
  // Holding hands at sunset, a little heart over slow dancers
  L.drawProp = (R, ctx, p, sx, sy, t) => {
    const a = p.action;
    if (!a || a.phase !== 'do' || !a.with || !a.date) return;
    const o = p.sim.byName(a.with);
    if (!o || !o.action || o.action.phase !== 'do' || o.action.def !== a.def) return;
    if (IS.dist(o.x, o.y, p.x, p.y) > T() * 1.8) return;
    const s1 = IS.Iso.w2s(p.x, p.y), s2 = IS.Iso.w2s(o.x, o.y);
    const ox = s2.x - s1.x, oy = s2.y - s1.y;
    if (a.def.id === 'sunsetWalk' || a.def.id === 'slowDance') {
      // My arm out to the middle, where the hands meet
      const dir = Math.sign(ox) || 1;
      const y1 = a.def.id === 'slowDance' ? -17 : -12;
      const ax = sx + dir * 4, ay = sy + y1, mx = sx + ox / 2, my = sy + oy / 2 + y1;
      ctx.fillStyle = IS.shade(p.cfg.look.shirt, -0.1);
      ctx.fillRect(Math.min(ax, mx), Math.round(Math.min(ay, my)), Math.max(1, Math.abs(Math.round(mx - ax))), 2);
      ctx.fillStyle = '#2a2135'; ctx.fillRect(Math.round(mx) - 2, Math.round(my) - 1, 4, 4);
      ctx.fillStyle = p.cfg.look.skin || '#f0c8a0'; ctx.fillRect(Math.round(mx) - 1, Math.round(my), 2, 2);
    }
    if (p.name < o.name && Math.sin(t * 2) > 0.6) {
      const hx = Math.round(sx + ox / 2) - 3, hy = Math.round(sy + oy / 2) - 46 - Math.round(Math.sin(t * 3) * 2);
      const H2 = ['.r.r.', 'rrrrr', '.rrr.', '..r..'];
      ctx.fillStyle = '#ff6f91';
      H2.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === 'r') ctx.fillRect(hx + i, hy + j, 1, 1); }));
    }
  };

  L.register = () => {
    for (const d of DATES) { IS.Actions[d.id] = d; if (!IS.Actions.list.includes(d)) IS.Actions.list.push(d); }
  };
  L.register();
  return L;
})();
