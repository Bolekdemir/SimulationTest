// The town: how the island is doing (the Island Rating), visitors who come
// on the boat, spend two days meeting everyone and then decide whether to
// stay, and moving in. Building new homes and places is in build.js.
IS.Town = (() => {
  const T = {};
  const H = h => h * 60;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp01 = (v, lo, hi) => clamp((v - lo) / (hi - lo), 0, 1);

  T.residents = sim => sim.people.filter(p => !T.isVisitor(p));
  T.isVisitor = p => !!(p.town && (p.town.status === 'visitor' || p.town.status === 'waiting' || p.town.status === 'leaving'));
  T.visitor = sim => sim.people.find(T.isVisitor) || null;
  // Never met: a newcomer and someone they haven't talked to yet
  T.stranger = (a, b) => (a.cfg.generated || b.cfg.generated) && !a.relTo(b.name).met;

  // ------------------------------------------------------------ the Island Rating
  T.rating = sim => {
    const res = T.residents(sim);
    const n = Math.max(1, res.length);
    const mood = res.reduce((s, p) => s + p.mood(), 0) / n;
    let fs = 0, fc = 0;
    for (const a of res) for (const b of res) if (a !== b) { fs += a.relTo(b.name).friendship; fc++; }
    const friend = fc ? fs / fc : 0;
    const food = sim.world.food / n;
    const venues = IS.Build ? IS.Build.venueCount(sim) : 0;
    const now = sim.clock.abs;
    const recentDeaths = (sim.graves || []).filter(g => now - (g.t || 0) < 1440 * 5).length;
    const sky = res.reduce((s, p) => s + p.skyOpinion, 0) / n;
    const parts = [
      { key: 'happy', label: 'Happiness', value: Math.round(lerp01(mood, 40, 82) * 30), max: 30, note: mood > 70 ? 'People are in great spirits.' : mood > 55 ? 'Mostly content.' : 'People are struggling.' },
      { key: 'friends', label: 'Friendliness', value: Math.round(lerp01(friend, -10, 45) * 20), max: 20, note: friend > 30 ? 'A close little community.' : friend > 10 ? 'Friendly enough.' : 'Lots of tension.' },
      { key: 'food', label: 'Food', value: Math.round(lerp01(food, 0.5, 4) * 15), max: 15, note: food >= 4 ? 'The pantry is full.' : food >= 2 ? 'Enough to go around.' : 'The pantry is nearly empty.' },
      { key: 'fun', label: 'Things to do', value: Math.min(20, 8 + venues * 3), max: 20, note: venues ? `${venues} place${venues > 1 ? 's' : ''} built so far.` : 'Build new places to attract people.' },
      { key: 'charm', label: 'Island charm', value: 15, max: 15, note: 'Beaches, a lighthouse, a cat.' },
    ];
    const fear = Math.round(Math.min(30, recentDeaths * 8 + Math.max(0, -sky) / 3));
    if (fear > 0) parts.push({ key: 'fear', label: 'Fear of the Sky', value: -fear, max: 0, note: recentDeaths ? `${recentDeaths} death${recentDeaths > 1 ? 's' : ''} this week. Word gets around.` : 'People are nervous about the sky.' });
    const score = clamp(parts.reduce((s, p) => s + p.value, 0), 0, 100);
    return { score, parts, word: score >= 80 ? 'Thriving' : score >= 65 ? 'Welcoming' : score >= 50 ? 'Okay' : score >= 35 ? 'Struggling' : 'Miserable' };
  };

  // ------------------------------------------------------------ the goal: from hamlet to town
  T.TIERS = [
    { n: 0, name: 'Hamlet', text: 'A handful of people and a cat.' },
    { n: 8, name: 'Village', text: 'People have heard of Tidewhistle now.' },
    { n: 10, name: 'Big village', text: 'The plaza feels busy on Friday nights.' },
    { n: 12, name: 'Town', text: 'Tidewhistle is a real town.' },
  ];
  T.GOAL = 12;
  T.tier = sim => { const pop = T.residents(sim).length; let t = T.TIERS[0]; for (const x of T.TIERS) if (pop >= x.n) t = x; return t; };
  T.nextTier = sim => T.TIERS.find(x => x.n > T.residents(sim).length) || null;
  T.checkTier = sim => {
    const st = T.state(sim), t = T.tier(sim);
    st.best = st.best || 'Hamlet';
    const rank = n => T.TIERS.findIndex(x => x.name === n);
    if (rank(t.name) <= rank(st.best)) return;
    st.best = t.name;
    for (const p of T.residents(sim)) p.addMood(`Tidewhistle is a ${t.name.toLowerCase()} now`, 6, 1440);
    if (t.n >= T.GOAL && !st.isTown) {
      st.festivalDay = sim.clock.day + 1;
      sim.log(`${T.residents(sim).length} islanders! Tidewhistle is big enough to be a real town. There'll be a Town Festival at the Hall tomorrow evening.`, 'good');
      sim.toast('Tidewhistle is becoming a town! Festival tomorrow at the Hall.');
      if (sim.events && sim.events.scheduled.has(st.festivalDay)) sim.events.addFestival(st.festivalDay);
    } else {
      sim.log(`Tidewhistle has grown into a ${t.name.toLowerCase()}! ${t.text}`, 'good');
      sim.toast(`Tidewhistle is now a ${t.name.toLowerCase()}!`);
    }
  };
  T.becomeTown = sim => {
    const st = T.state(sim);
    if (st.isTown) return;
    st.isTown = sim.clock.day;
    for (const p of T.residents(sim)) { p.remember('Tidewhistle became a real town today', { tag: 'town', mood: 20, moodDuration: 2880, news: true }); p.emote('sparkle', 3); }
    sim.log('🎉 Tidewhistle is officially a TOWN. From six people and a cat to this. Keep going: there\'s always room for more.', 'good');
    sim.toast('Tidewhistle is officially a town!');
    if (sim.ui) sim.ui.townWin = true;
  };

  // ------------------------------------------------------------ homes
  // A bed someone could move into: an empty bed in a house, or a spare
  // corner in a house where the people living there like the newcomer.
  const isHouse = b => b && (b.kind === 'house');
  T.bedOwnerCount = (sim, s) => sim.everyone.filter(p => !p.dead && p.bedSpot === s).length;
  T.homeFor = (sim, p) => {
    const W = sim.world;
    const cands = [];
    for (const b of W.buildings.filter(isHouse)) {
      const living = sim.people.filter(o => o !== p && o.homeId === b.id && !T.isVisitor(o));
      const beds = (W.spots.bed || []).filter(s => s.building === b.id);
      const free = beds.find(s => !s.owner && !sim.everyone.some(o => o !== p && !o.dead && o.bedSpot === s));
      const spare = !free && beds.length < 2;
      if (!free && !spare) continue;
      // Housemates have a say
      if (living.length) {
        const ok = living.every(o => o.relTo(p.name).friendship >= 0) && living.reduce((s, o) => s + o.relTo(p.name).friendship, 0) / living.length >= 8;
        if (!ok) continue;
      }
      const like = living.length ? living.reduce((s, o) => s + o.relTo(p.name).friendship + p.relTo(o.name).friendship, 0) / living.length : 15;
      cands.push({ b, bed: free, spare, living, score: like + (living.length ? 0 : 12) + (b.built ? 6 : 0) });
    }
    cands.sort((x, y) => y.score - x.score);
    return cands[0] || null;
  };
  T.freeHomes = sim => sim.world.buildings.filter(isHouse).filter(b => {
    const beds = (sim.world.spots.bed || []).filter(s => s.building === b.id);
    return beds.length < 2 || beds.some(s => !s.owner && !sim.everyone.some(o => !o.dead && o.bedSpot === s));
  }).length;

  // Add the second bed to a one-bed house (and redraw the interior)
  T.addBed = (sim, b) => {
    const W = sim.world;
    const cells = [[1, 1], [4, 1]];
    const used = b.furniture.filter(f => f.type === 'bed').map(f => f.c + ',' + f.r);
    const cell = cells.find(([c, r]) => !used.includes(c + ',' + r));
    if (!cell) return null;
    b.furniture.push({ type: 'bed', c: cell[0], r: cell[1], color: '#6a8fc9' });
    W.addSpot('bed', b.x0 + cell[0], b.y0 + cell[1], 'down', 'sleep', { building: b.id, owner: null });
    sim.extraBeds = (sim.extraBeds || []).concat([{ b: b.id, c: cell[0], r: cell[1] }]);
    IS.Build.redraw(sim, b);
    return W.spots.bed[W.spots.bed.length - 1];
  };

  T.moveIn = (sim, p, home) => {
    const b = home.b;
    let bed = home.bed || T.addBed(sim, b);
    if (!bed) return false;
    if (p.bedSpot && p.bedSpot.owner === p.name) p.bedSpot.owner = null;
    bed.owner = p.name;
    const f = b.furniture.find(x => x.type === 'bed' && b.x0 + x.c === bed.x && b.y0 + x.r === bed.y);
    if (f) { f.color = IS.shade(p.cfg.look.shirt, -0.1); IS.Build.redraw(sim, b); }
    p.bedSpot = bed;
    p.homeId = b.id;
    p.cfg.homeId = b.id;
    if (!b.residents.includes(p.name)) b.residents.push(p.name);
    p.town = { ...(p.town || {}), status: 'resident', movedIn: sim.clock.abs };
    p.remember(home.living.length ? `Moved in with ${home.living.map(o => o.name).join(' and ')}` : 'Moved into my own house!', { tag: 'home', mood: 20, moodDuration: 1440, news: true });
    for (const o of home.living) { o.remember(`${p.name} moved in with me`, { tag: 'home', about: p.name, mood: 4 }); o.changeRel(p.name, 4); }
    IS.Mind.news(sim, 'movedIn', p, home.living[0] || null);
    const pop = T.residents(sim).length;
    sim.log(`${p.name} moved in${home.living.length ? ` with ${home.living.map(o => o.name).join(' and ')}` : ' to a house of their own'}. Tidewhistle has ${pop} islanders now!`, 'good', [p, ...home.living]);
    sim.toast(`${p.name} moved to Tidewhistle! Population ${pop}.`);
    p.say(IS.pick(['I live here now. I LIVE here!', 'Home. This is home.', 'Okay. Unpacking. Where do the spoons go?']), 3);
    p.emote('heart', 2.5);
    if (IS.Build) IS.Build.onPopulation(sim, pop);
    T.checkTier(sim);
    return true;
  };

  // ------------------------------------------------------------ visitors
  T.state = sim => (sim.town = sim.town || { lastVisitDay: -9, visits: 0, arrivals: [], lastDecision: null });

  // Schedule a visitor for a boat today
  T.scheduleVisitor = (sim, forced) => {
    const st = T.state(sim);
    if (T.visitor(sim) || st.pending) return false;
    const cfg = IS.Newcomers.make(sim);
    if (!cfg) return false;
    st.pending = { cfg, at: H(10) };
    sim.visitorsSeen = sim.visitorsSeen || [];
    sim.visitorsSeen.push(cfg.name);
    if (forced) st.pending.at = sim.clock.min + 2;
    return true;
  };

  // The boat brought them: step onto the dock
  T.arrive = sim => {
    const st = T.state(sim);
    const cfg = st.pending && st.pending.cfg;
    st.pending = null;
    if (!cfg) return null;
    const W = sim.world;
    const p = IS.Newcomers.add(sim, cfg, { at: { x: W.dock.x, y: W.dock.endY - 1 }, visitor: true });
    p.town = { status: 'visitor', since: sim.clock.abs, decideAt: sim.clock.abs + 1440 * 2 - 120, sky0: p.skyOpinion, deaths0: sim.deaths || 0, grab0: p.grabCount, moodSum: 0, moodN: 0, reasons: [] };
    st.lastVisitDay = sim.clock.day; st.visits++;
    p.say(IS.pick(['Hello? Is this Tidewhistle?', 'Wow. It\'s even prettier than the postcard.', 'Hi! I\'m just visiting. Probably.']), 3);
    IS.Mind.news(sim, 'visitor', p);
    sim.log(`A visitor stepped off the boat: ${p.name}. ${p.cfg.bio.split('. ')[0]}.`, 'event', [p]);
    sim.toast(`A visitor arrived: ${p.name}! Make a good impression.`);
    // Friendly people come down to say hi
    for (const o of T.residents(sim)) {
      if (!IS.Social.isFree(o) || Math.random() > 0.25 + o.traits.sociable * 0.5) continue;
      IS.Mind.addPlan(o, { kind: 'talk', who: p.name, topic: 'welcome', text: `Say hi to ${p.name}, the new face` });
    }
    T.visitorPlans(p);
    return p;
  };
  T.visitorPlans = p => {
    const others = T.residents(p.sim).filter(o => !p.relTo(o.name).met);
    for (const o of IS.shuffle(others).slice(0, 2)) IS.Mind.addPlan(p, { kind: 'talk', who: o.name, topic: 'welcome', text: `Meet ${o.name}` });
    IS.Mind.addPlan(p, { kind: 'do', def: 'wander', text: 'Have a look around the island' });
  };

  // How the visit went: a number, and the reasons they'll give
  T.judgeVisit = (sim, p) => {
    const t = p.town, res = T.residents(sim);
    const reasons = [];
    const fr = res.map(o => ({ o, f: p.relTo(o.name).friendship, g: IS.Mind.led(p, o.name).grudge }));
    const met = fr.filter(x => p.relTo(x.o.name).met);
    const avg = met.length ? met.reduce((s, x) => s + x.f, 0) / met.length : -10;
    let score = lerp01(avg, -15, 35) * 0.35;
    const best = fr.slice().sort((a, b) => b.f - a.f)[0];
    if (best && best.f > 30) { score += 0.08; reasons.push({ good: true, w: best.f, text: `${best.o.name} was so lovely to me` }); }
    if (met.length < Math.min(3, res.length)) { score -= 0.06; reasons.push({ good: false, w: 20, text: 'barely anyone talked to me' }); }
    else if (avg > 15) reasons.push({ good: true, w: avg, text: 'everyone was so welcoming' });
    const rude = fr.filter(x => x.g > 6 || x.f < -15);
    for (const x of rude.slice(0, 2)) { score -= 0.07; reasons.push({ good: false, w: 30 + x.g, text: `${x.o.name} was rude to me` }); }
    const mood = t.moodN ? t.moodSum / t.moodN : p.mood();
    score += lerp01(mood, 40, 80) * 0.22;
    if (mood > 68) reasons.push({ good: true, w: mood - 40, text: 'I had a really good time' });
    if (mood < 45) reasons.push({ good: false, w: 50 - mood, text: 'I was miserable most of the time' });
    const r = T.rating(sim);
    score += r.score / 100 * 0.25;
    if (sim.world.food < res.length) { score -= 0.12; reasons.push({ good: false, w: 35, text: 'the pantry is basically empty' }); }
    // The sky
    const deaths = (sim.deaths || 0) - (t.deaths0 || 0);
    const skyDrop = (t.sky0 || 0) - p.skyOpinion;
    const grabbed = p.grabCount - (t.grab0 || 0);
    const fear = deaths * 0.28 + Math.max(0, skyDrop) / 45 + grabbed * 0.06;
    score -= Math.min(0.7, fear);
    if (deaths) reasons.push({ good: false, w: 90, text: deaths > 1 ? 'people DIED while I was here' : 'someone died while I was here' });
    else if (skyDrop > 10) reasons.push({ good: false, w: 60, text: 'the sky here is terrifying' });
    if (grabbed > 1) reasons.push({ good: false, w: 40, text: 'a giant hand kept grabbing me' });
    if (p.skyOpinion > 25) { score += 0.05; reasons.push({ good: true, w: 30, text: 'the sky here seems kind' }); }
    score += 0.12; // most people want to like a new place
    reasons.sort((a, b) => b.w - a.w);
    return { score, stay: score >= 0.55, reasons };
  };

  T.decide = (sim, p) => {
    const j = T.judgeVisit(sim, p);
    const st = T.state(sim);
    const good = j.reasons.filter(x => x.good).slice(0, 2).map(x => x.text);
    const bad = j.reasons.filter(x => !x.good).slice(0, 2).map(x => x.text);
    st.lastDecision = { name: p.name, stay: j.stay, good, bad, day: sim.clock.day, score: Math.round(j.score * 100) };
    p.town.reasons = j.reasons.slice(0, 4);
    if (!j.stay) {
      const why = bad.length ? bad.join(', and ') : 'it just isn\'t for me';
      p.say(IS.pick([`I think I'll head home. Honestly? ${cap(why)}.`, `It's not for me. ${cap(why)}.`]), 4.5);
      p.emote('sad', 2);
      sim.log(`${p.name} decided not to stay: "${cap(why)}." They'll take the next boat out.`, 'warn', [p]);
      sim.toast(`${p.name} won't be staying.`);
      return T.startLeaving(sim, p, 'declined');
    }
    const home = T.homeFor(sim, p);
    const why = good.length ? good.join(', and ') : 'it just feels right';
    if (home) {
      p.say(IS.pick([`I'm staying! ${cap(why)}.`, `You know what? I'm staying. ${cap(why)}.`]), 4.5);
      return T.moveIn(sim, p, home);
    }
    p.town.status = 'waiting';
    p.town.waitUntil = sim.clock.abs + 1440 * 4;
    p.say(IS.pick(['I\'d love to stay... if there were somewhere to live.', 'I want to stay! Is there a house I could have?']), 4.5);
    const spare = T.freeHomes(sim);
    sim.log(`${p.name} wants to stay (${why}), but has nowhere to live yet. ${spare ? 'The spare rooms are with people who don\'t know them well enough yet. Help them make friends, or build' : 'Build'} a house in the next 4 days or they'll leave.`, 'event', [p]);
    sim.toast(`${p.name} wants to stay! They need a home within 4 days.`);
    return true;
  };
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;

  // Off they go: walk to the dock, take the next boat
  T.startLeaving = (sim, p, why) => {
    p.town.status = 'leaving'; p.town.why = why; p.town.leaveAt = Math.floor(sim.clock.abs / 1440) * 1440 + 1440 + H(9.5);
    if (sim.clock.min < H(8)) p.town.leaveAt -= 1440;
    for (const o of T.residents(sim)) if (o.relTo(p.name).friendship > 35) { o.addMood(`${p.name} is leaving`, -6, 720); IS.Mind.addPlan(o, { kind: 'talk', who: p.name, topic: 'farewell', text: `Say goodbye to ${p.name}` }); }
    return true;
  };
  T.depart = (sim, p) => {
    const why = p.town && p.town.why;
    sim.leftIsland = sim.leftIsland || [];
    sim.leftIsland.push({ name: p.name, cfg: p.cfg, why, day: sim.clock.day });
    T.remove(sim, p);
    sim.log(`${p.name} sailed away from Tidewhistle.`, why === 'declined' ? 'event' : 'warn');
  };
  // Take someone out of the world cleanly
  T.remove = (sim, p) => {
    if (p.chat) p.chat.end(true);
    p.cancelAction();
    p.mode = 'gone';
    if (p.bedSpot && p.bedSpot.owner === p.name) p.bedSpot.owner = null;
    p.bedSpot = null;
    for (const k of Object.keys(sim.world.spots)) for (const s of sim.world.spots[k]) if (s.takenBy === p) s.takenBy = null;
    for (const b of sim.world.buildings) if (b.residents) b.residents = b.residents.filter(n => n !== p.name);
    for (const o of sim.people) {
      if (o.action && (o.action.follow === p || o.approachTarget === p)) o.cancelAction();
      if (o.approachTarget === p) o.approachTarget = null;
      if (o.plans) o.plans = o.plans.filter(pl => pl.who !== p.name);
      if (o.relTo(p.name).partner) IS.Mind.breakup(sim, o, p);
    }
    sim.people = sim.people.filter(o => o !== p);
    sim.everyone = sim.everyone.filter(o => o !== p);
    if (sim.selected === p) sim.selected = null;
    if (sim.ui) { sim.ui.forget(p); sim.ui.buildRoster(); }
  };

  // ------------------------------------------------------------ unhappy islanders leave
  // Every hour we note how they feel; every morning a bad day adds up, a good one wears it down.
  T.why = (sim, p) => {
    const out = [];
    const res = T.residents(sim).filter(o => o !== p);
    if (p.skyOpinion < -40) out.push('the sky terrifies me');
    if (Object.values(p.mourning || {}).some(e => e.aware && e.f > 30)) out.push('I can\'t stop thinking about who we lost');
    if (sim.world.food < Math.max(2, res.length / 2)) out.push('there\'s never enough food');
    const best = res.reduce((m, o) => Math.max(m, p.relTo(o.name).friendship), -100);
    if (best < 20) out.push('I don\'t really have friends here');
    const enemies = res.filter(o => p.relTo(o.name).friendship < -35).map(o => o.name);
    if (enemies.length) out.push(`I can't stand ${enemies[0]}`);
    const e = IS.Mind.feeling(p);
    if (e && e.type === 'heartbroken') out.push('my heart is broken');
    if (!out.length) out.push('I\'m just not happy here');
    return out;
  };
  T.morningCheck = sim => {
    for (const p of T.residents(sim)) {
      const t = (p.town = p.town || { status: 'resident' });
      if (t.status !== 'resident') continue;
      const mood = t.moodN ? t.moodSum / t.moodN : p.mood();
      const sickDay = (t.sickN || 0) > (t.moodN || 0) * 0.3 || p.sick;
      t.moodSum = 0; t.moodN = 0; t.sickN = 0;
      // A cold isn't a reason to emigrate: sick days don't count either way
      if (sickDay && p.skyOpinion >= -55) continue;
      const bad = mood < 38 || p.skyOpinion < -55;
      t.misery = Math.max(0, (t.misery || 0) + (bad ? 1 : -1));
      const stubborn = p.cfg.generated ? 0 : 2; // the original six have deep roots
      if (!t.considering && t.misery >= 2 + stubborn) {
        t.considering = sim.clock.abs;
        t.whyLeave = T.why(sim, p);
        p.thought = `Maybe I should leave the island. ${cap(t.whyLeave[0])}.`;
        p.say(IS.pick([`I've been thinking about leaving. ${cap(t.whyLeave[0])}.`, `I don't know if I can stay here much longer.`]), 4);
        sim.log(`${p.name} is thinking about leaving Tidewhistle: "${cap(t.whyLeave.slice(0, 2).join(', and '))}."`, 'warn', [p]);
        sim.toast(`${p.name} is thinking about leaving the island.`);
        for (const o of T.residents(sim)) if (o !== p && o.relTo(p.name).friendship > 10) IS.Mind.addPlan(o, { kind: 'talk', who: p.name, topic: 'stayPlease', text: `Talk ${p.name} into staying` });
      } else if (t.considering && !bad && t.misery < 2) {
        t.considering = 0;
        p.say(IS.pick(['You know what? I think I\'m staying.', 'I feel better. I\'m not going anywhere.']), 3);
        sim.log(`${p.name} has decided to stay on the island after all.`, 'good', [p]);
      } else if (t.considering && t.misery >= 4 + stubborn * 1.5) {
        const why = (t.whyLeave || T.why(sim, p)).slice(0, 2).join(', and ');
        p.say(IS.pick([`I'm sorry. I'm leaving. ${cap(why)}.`, 'I\'ve made up my mind. I\'m taking the next boat.']), 4.5);
        sim.log(`${p.name} has decided to leave Tidewhistle for good. "${cap(why)}."`, 'warn', [p]);
        sim.toast(`${p.name} is leaving the island.`);
        T.startLeaving(sim, p, 'unhappy');
      }
    }
  };
  // A friend (or the Sky) talked them round
  T.plead = (sim, p, by, strength) => {
    const t = p.town;
    if (!t || !t.considering) return false;
    t.misery = Math.max(0, t.misery - strength);
    if (t.misery < 2) { t.considering = 0; p.addMood(`${by} asked me to stay`, 10, 1440); sim.log(`${by} talked ${p.name} into staying.`, 'good', [p]); }
    return true;
  };

  // ------------------------------------------------------------ every game minute
  T.tick = sim => {
    const minute = Math.floor(sim.clock.abs);
    if (minute === T._last) return;
    const steps = T._last === undefined ? 1 : Math.min(30, minute - T._last);
    T._last = minute;
    for (let s = steps - 1; s >= 0; s--) T.minute(sim, minute - s);
  };
  T.minute = (sim, abs) => {
    const st = T.state(sim), min = abs % 1440, day = Math.floor(abs / 1440) + 1;
    if (min === H(6) + 5) T.morningCheck(sim);
    // Morning: does anyone want to visit today?
    if (min === H(7)) {
      const r = T.rating(sim);
      const pop = T.residents(sim).length;
      const boatDay = sim.weekdayOf(day) === 2;
      const cooldown = day - st.lastVisitDay < 2;
      const cap = IS.Build ? IS.Build.popCap(sim) : 16;
      // The very first visitor always comes on the first boat, so something happens early
      if (!st.visits && !T.visitor(sim) && !st.pending) T.scheduleVisitor(sim);
      else if (!T.visitor(sim) && !st.pending && !cooldown && pop < cap && r.score >= 50) {
        const chance = 0.18 + (r.score - 50) / 90 + (boatDay ? 0.25 : 0);
        if (Math.random() < chance) T.scheduleVisitor(sim);
      }
    }
    if (st.pending && min >= st.pending.at && !st.pending.sent) { st.pending.sent = true; if (sim.events) sim.events.sendFerry(); }
    for (const p of sim.people.slice()) {
      const t = p.town;
      if (!t && min % 60 === 0 && p.pose !== 'sleep') p.town = { status: 'resident', moodSum: p.mood(), moodN: 1 };
      if (!t) continue;
      if (t.status === 'resident' && min % 60 === 0 && p.pose !== 'sleep') { t.moodSum = (t.moodSum || 0) + p.mood(); t.moodN = (t.moodN || 0) + 1; if (p.sick) t.sickN = (t.sickN || 0) + 1; }
      if (t.status === 'resident' && min % 60 === 0 && p.pose === 'sleep' && p.sick) t.sickN = (t.sickN || 0) + 1;
      if (t.status === 'visitor') {
        if (min % 30 === 0 && p.pose !== 'sleep') { t.moodSum += p.mood(); t.moodN++; }
        if (abs >= t.decideAt && !p.chat) T.decide(sim, p);
      } else if (t.status === 'waiting') {
        const home = min % 10 === 0 ? T.homeFor(sim, p) : null;
        if (home) { p.say('A home! For ME?', 3); T.moveIn(sim, p, home); }
        else if (abs >= t.waitUntil) {
          p.say('I waited, but... I can\'t stay without a home. Maybe next time.', 4);
          sim.log(`${p.name} gave up waiting for a home and is leaving.`, 'warn', [p]);
          T.startLeaving(sim, p, 'noHome');
        }
      } else if (t.status === 'leaving') {
        if (abs >= t.leaveAt - 40 && !t.toDock) { t.toDock = true; T.walkToDock(sim, p); }
        if (abs >= t.leaveAt && !t.ferryCalled) { t.ferryCalled = true; if (sim.events) sim.events.sendFerry(p); }
        if (abs >= t.leaveAt + 90) T.depart(sim, p); // the boat can't wait forever
      }
    }
  };
  T.walkToDock = (sim, p) => {
    if (p.chat) p.chat.end(true);
    p.cancelAction();
    const W = sim.world;
    p.gotoTarget = { x: W.dock.x, y: W.dock.endY - 1, name: 'the dock' };
    if (p.startAction(IS.Actions.goto, sim.clock)) { p.action.forced = true; p.action.duration = 300; p.thought = 'Time to catch the boat.'; }
    p.say(IS.pick(['Bye, Tidewhistle.', 'Okay. Boat time.', 'I\'ll miss this place. A little.']), 2.6);
  };
  // The ferry docked: drop off whoever it brought, pick up whoever's leaving
  T.onFerryDocked = (sim, passenger) => {
    const st = T.state(sim);
    if (st.pending) T.arrive(sim);
    if (passenger && sim.people.includes(passenger)) {
      passenger.say('Goodbye, everyone!', 2.5);
      T.depart(sim, passenger);
    }
  };

  // ------------------------------------------------------------ conversation hooks
  T.topics = (sim, sp, li, add) => {
    if (T.stranger(sp, li)) add('welcome', 12);
    if (li.town && li.town.status === 'leaving' && sp.relTo(li.name).friendship > 20 && !(sp.saidBye || {})[li.name]) add('farewell', 9);
    if (li.town && li.town.status === 'waiting' && !T.stranger(sp, li)) add('homeTalk', 2);
    if (li.town && li.town.considering && li.town.status === 'resident' && sp.relTo(li.name).friendship > 10) add('stayPlease', 9);
  };
  T.onChatEnd = (a, b) => { a.relTo(b.name).met = true; b.relTo(a.name).met = true; };

  T.init = sim => { T.state(sim); };
  return T;
})();
