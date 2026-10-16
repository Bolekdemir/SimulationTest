// The islanders' inner lives, layered on top of the moment-to-moment
// utility AI:
//   plans     2-3 goals each morning that bias what they choose all day
//   ledger    grudges and gratitude per person, forgiven at personality speed
//   emotion   jealous, heartbroken, proud, giddy, sulking, lonely
//   invites   asking friends along, bro hangouts, evening dates for couples
//   news      who saw what, gossip spreading, opinions shifting
//   reactions checking on dunked friends, congratulating, comforting
IS.Mind = (() => {
  const M = {};
  const D = () => IS.Dialogue;
  // "come ___ with me" / "went ___ together"
  const GO = { fish: 'fishing', swim: 'swimming', beach: 'to the beach', stargaze: 'stargazing', wander: 'wandering', plaza: 'to the plaza', forage: 'foraging', garden: 'gardening', chop: 'chopping wood', petCat: 'to see the cat', watchDolphins: 'to watch the dolphins', read: 'reading' };
  // Plan list wording
  const TODO = { fish: 'Go fishing', swim: 'Go for a swim', beach: 'Chill at the beach', stargaze: 'Go stargazing', wander: 'Go for a wander', plaza: 'Hang out at the plaza', forage: 'Go foraging', garden: 'Tend the garden', chop: 'Chop some wood', read: 'Read a good book', petCat: 'Pet the cat' };
  const word = id => GO[id] || (IS.Actions[id] ? IS.Actions[id].label.toLowerCase() : id);
  const pick = (pool, who) => IS.Dialogue.fresh(pool, who);

  M.init = p => { p.plans = []; p.ledger = {}; p.emotion = null; p.knows = new Set(); p.lastChatAt = 0; };
  M.led = (p, name) => p.ledger[name] || (p.ledger[name] = { grudge: 0, thanks: 0, why: '', favor: '' });

  // ------------------------------------------------------------ emotions
  const EMO = {
    heartbroken: { rank: 5, mood: -16, label: o => `Heartbroken${o ? ' over ' + o : ''}`, emote: 'sad' },
    jealous: { rank: 4, mood: -8, label: o => `Jealous of ${o}`, emote: 'anger' },
    giddy: { rank: 3, mood: 12, label: o => `Giddy about ${o}`, emote: 'heart' },
    sulking: { rank: 2, mood: -7, label: o => `Sulking about ${o}`, emote: 'anger' },
    proud: { rank: 2, mood: 8, label: () => 'Proud of themselves', emote: 'sparkle' },
    lonely: { rank: 1, mood: -6, label: () => 'Lonely', emote: 'sad' },
  };
  M.feel = (p, type, about, hours) => {
    const now = p.sim.clock.abs;
    const cur = p.emotion && p.emotion.until > now ? p.emotion : null;
    if (cur && EMO[cur.type].rank > EMO[type].rank && cur.type !== type) return false;
    p.emotion = { type, about: about || null, until: now + hours * 60 };
    p.addMood('emotion', EMO[type].mood, hours * 60);
    p.emote(EMO[type].emote, 2);
    return true;
  };
  M.feeling = p => (p.emotion && p.emotion.until > p.sim.clock.abs ? p.emotion : null);
  M.feelingLabel = p => { const e = M.feeling(p); return e ? EMO[e.type].label(e.about) : null; };
  M.clearFeeling = (p, type) => { const e = M.feeling(p); if (e && (!type || e.type === type)) { p.emotion = null; p.moodMods = p.moodMods.filter(m => m.label !== 'emotion'); } };

  // ------------------------------------------------------------ news
  // Something happened. The people involved and anyone who saw it now know.
  M.news = (sim, kind, a, b, extra = {}) => {
    sim.news = sim.news || [];
    const n = { id: sim.newsId = (sim.newsId || 0) + 1, kind, a: a.name, b: b ? b.name : null, t: sim.clock.abs, ...extra };
    sim.news.push(n);
    if (sim.news.length > 60) sim.news.shift();
    for (const p of sim.people) {
      const involved = p === a || p === b;
      const saw = !involved && p.mode === 'normal' && p.pose !== 'sleep' && (p.building || null) === (a.building || null) && IS.dist(p.x, p.y, a.x, a.y) < IS.TILE * 11;
      if (involved || saw) M.learn(sim, p, n, null);
    }
    return n;
  };

  // Hearing about something changes how people feel
  M.learn = (sim, p, n, from) => {
    if (p.knows.has(n.id)) return;
    p.knows.add(n.id);
    const a = sim.byName(n.a), b = n.b ? sim.byName(n.b) : null;
    const involved = p === a || p === b;
    if (n.kind === 'couple' && !involved) {
      for (const lover of [a, b]) {
        const r = p.relTo(lover.name);
        if (r.romance > 40 && !r.partner) {
          const rival = lover === a ? b : a;
          if (r.romance > 62) M.feel(p, 'heartbroken', lover.name, 20);
          else M.feel(p, 'jealous', rival.name, 10);
          p.remember(`${a.name} and ${b.name} got together`, { tag: 'heartache', about: lover.name });
        }
      }
      if (!p.emotion || p.emotion.type !== 'heartbroken') M.addPlan(p, { kind: 'talk', who: IS.pick([a, b]).name, topic: 'congrats', text: `Congratulate ${a.name} and ${b.name}` });
    }
    if ((n.kind === 'rejected' || n.kind === 'breakup') && !involved) {
      const sad = n.kind === 'rejected' ? a : (a.relTo(b.name).romance >= b.relTo(a.name).romance ? a : b);
      if (p.relTo(sad.name).friendship > 35 && p.traits.kind > 0.4) M.addPlan(p, { kind: 'talk', who: sad.name, topic: 'comfort', text: `Cheer up ${sad.name}` });
    }
    if (n.kind === 'won' && !involved && p.relTo(a.name).friendship > 20) M.addPlan(p, { kind: 'talk', who: a.name, topic: 'congrats', text: `Congratulate ${a.name}` });
    // Second-hand fights make you a little wary of both sides, unless you're on someone's side
    if (n.kind === 'fight' && !involved && from) {
      for (const x of [a, b]) if (x !== from && p.relTo(x.name).friendship < 40) p.changeRel(x.name, -1);
    }
  };

  // Something the speaker knows that the listener doesn't (and isn't about them)
  M.unknownNews = (sim, sp, li) => {
    const now = sim.clock.abs;
    return (sim.news || []).slice().reverse().find(n => sp.knows.has(n.id) && !li.knows.has(n.id) && n.a !== li.name && n.b !== li.name && n.a !== sp.name && n.b !== sp.name && now - n.t < 2880 && RUMOR[n.kind]);
  };
  // The speaker's own news that the listener hasn't heard yet (told in first person)
  M.ownNews = (sim, sp, li) => {
    const now = sim.clock.abs;
    return (sim.news || []).slice().reverse().find(n => (n.a === sp.name || n.b === sp.name) && n.a !== li.name && n.b !== li.name && !li.knows.has(n.id) && now - n.t < 2880 && ['couple', 'won', 'breakup', 'dunk', 'rejected'].includes(n.kind) && !(n.kind === 'rejected' && sp.traits.sociable < 0.6));
  };
  const RUMOR = {
    fight: ['Did you hear {a} and {b} got into it?', '{a} and {b} had a HUGE fight earlier.', 'So... {a} and {b} aren\'t talking right now.'],
    couple: ['Okay, {a} and {b} are a thing now. Officially!', 'Did you hear? {a} and {b} are together!', '{a} and {b}. Together. I called it.'],
    rejected: ['Don\'t tell anyone, but {a} confessed to {b}... and got turned down.', 'Poor {a}. {b} said no.'],
    breakup: ['{a} and {b} broke up. It\'s over.', 'Did you hear {a} and {b} split?'],
    won: ['{a} won the fishing contest. We will never hear the end of it.', 'Did you see {a} win the contest?'],
    dunk: ['{a} got thrown into the SEA earlier. By the sky!', 'The Sky Hand dropped {a} in the ocean. I saw it.'],
    date: ['{a} and {b} were on a little date earlier. So cute.', 'I saw {a} and {b} stargazing together...'],
  };

  // ------------------------------------------------------------ plans
  M.addPlan = (p, plan) => {
    if (!p.plans) p.plans = [];
    if (p.plans.some(x => !x.done && x.kind === plan.kind && x.who === plan.who && x.def === plan.def && x.topic === plan.topic)) return;
    if (p.plans.filter(x => !x.done).length >= 4) return;
    p.plans.push({ done: false, tries: 0, ...plan });
  };

  M.makePlans = (sim, p) => {
    const t = p.traits;
    const plans = [];
    const others = sim.people.filter(o => o !== p);
    const W = sim.world;
    const loves = p.loves.filter(l => !['chatting', 'cats', 'napping', 'cooking'].includes(l));
    const loveAct = { fishing: 'fish', gardening: 'garden', foraging: 'forage', chopping: 'chop', reading: 'read', beach: 'beach', swimming: 'swim', wandering: 'wander', stargazing: 'stargaze' };
    // Work
    if (t.hardworking > 0.6) {
      // Driven people do the chore that's needed, but lean toward the ones they enjoy
      const chores = ['garden', 'chop', 'fish'].filter(d => !p.hates.includes(IS.Actions[d].love));
      const liked = chores.filter(d => p.loves.includes(IS.Actions[d].love));
      const food = liked.find(d => d !== 'chop') || chores.find(d => d !== 'chop');
      if (W.wood < 5 && chores.includes('chop')) plans.push({ kind: 'do', def: 'chop', text: 'Restock the woodpile' });
      else if (W.food < 12 && food) plans.push({ kind: 'do', def: food, text: 'Fill up the pantry' });
      else if (chores.length) plans.push({ kind: 'do', def: IS.pick(liked.length ? liked : chores), text: 'Get some work done' });
    }
    // Fun
    if (loves.length) {
      const l = IS.pick(loves);
      const def = loveAct[l];
      if (def) plans.push({ kind: 'do', def, text: TODO[def] || `Go ${word(def)}`, invite: t.sociable > 0.4 });
    }
    // People
    const partner = p.partner();
    const crush = IS.Dialogue.crushOf(p);
    const ranked = others.map(o => ({ o, s: p.relTo(o.name).friendship + p.relTo(o.name).romance * 0.6 })).sort((a, b) => b.s - a.s);
    if (partner) plans.push({ kind: 'date', who: partner.name, text: `Plan something cute with ${partner.name}` });
    else if (crush) {
      const r = p.relTo(crush.name);
      if (r.romance > 72 && r.friendship > 35 && (p.confessedTo || {})[crush.name] === undefined) plans.push({ kind: 'talk', who: crush.name, topic: 'confess', text: `Tell ${crush.name} how I feel` });
      else plans.push({ kind: 'talk', who: crush.name, topic: 'flirt', text: `Talk to ${crush.name} (act normal)` });
    }
    const bros = others.filter(o => (p.relTo(o.name).label || '').includes('bro'));
    if (bros.length >= 2 && Math.random() < 0.6) plans.push({ kind: 'bros', text: 'Hang out with the bros' });
    else if (ranked[0] && ranked[0].s > 25) plans.push({ kind: 'see', who: ranked[0].o.name, text: `Hang out with ${ranked[0].o.name}` });
    // Repair or avoid
    const sore = others.map(o => ({ o, g: M.led(p, o.name).grudge, f: p.relTo(o.name).friendship })).sort((a, b) => b.g - a.g)[0];
    if (sore && sore.g > 10 && t.kind > 0.55) plans.push({ kind: 'talk', who: sore.o.name, topic: 'apology', text: `Make up with ${sore.o.name}` });
    const enemy = others.find(o => p.relTo(o.name).friendship < -25);
    if (enemy) { plans.push({ kind: 'avoid', who: enemy.name, text: `Stay away from ${enemy.name}` }); p.avoid[enemy.name] = sim.clock.abs + 14 * 60; }
    // Keep it to three, people first if sociable, work first if driven
    plans.sort((a, b) => (b.kind === 'do' ? t.hardworking : t.sociable + 0.2) - (a.kind === 'do' ? t.hardworking : t.sociable + 0.2));
    p.plans = plans.slice(0, 3).map(x => ({ done: false, tries: 0, ...x }));
  };

  M.planBonus = (p, def) => {
    let b = 0;
    for (const pl of p.plans || []) {
      if (pl.done) continue;
      if (pl.kind === 'do' && pl.def === def.id) b += IS.Tune.planWeight + p.traits.hardworking * 0.4;
    }
    const e = M.feeling(p);
    if (e) {
      // Sad people retreat into comfort activities they love, and away from crowds
      if (e.type === 'heartbroken' || e.type === 'sulking') { if (def.love && p.loves.includes(def.love)) b += 0.6; if (def.social || def.id === 'plaza') b -= 0.4; }
      if (e.type === 'proud' && ['plaza', 'fish', 'swim'].includes(def.id)) b += 0.3;
      if (e.type === 'lonely' && (def.id === 'socialize' || def.id === 'plaza')) b += 0.8;
    }
    return b;
  };

  // Called when an action wraps up normally
  M.onFinish = (p, a) => {
    if (a.elapsed < Math.min(20, a.duration * 0.5)) return;
    for (const pl of p.plans || []) if (!pl.done && pl.kind === 'do' && pl.def === a.def.id) { pl.done = true; break; }
    if (a.date && a.with) {
      const o = p.sim.byName(a.with);
      if (o) { p.changeRel(o.name, 2, 3); p.remember(`Went on a date with ${o.name}`, { tag: 'date', about: o.name, mood: 8, moodDuration: 600 }); }
      for (const pl of p.plans || []) if (pl.kind === 'date') pl.done = true;
    }
    if (a.with) for (const pl of p.plans || []) if (!pl.done && (pl.kind === 'bros' || (pl.kind === 'see' && a.with.includes(pl.who)))) pl.done = true;
  };

  M.onChatEnd = (a, b, aborted) => {
    for (const p of [a, b]) if (p.afterChat) { const f = p.afterChat; p.afterChat = null; if (!aborted) f(); }
    if (aborted) return;
    a.lastChatAt = b.lastChatAt = a.sim.clock.abs;
    for (const [p, o] of [[a, b], [b, a]]) {
      for (const pl of p.plans || []) if (!pl.done && pl.kind === 'see' && pl.who === o.name) pl.done = true;
      if (M.feeling(p) && M.feeling(p).type === 'lonely') M.clearFeeling(p, 'lonely');
    }
  };

  // ------------------------------------------------------------ invitations
  const INVITE = { fish: 1, swim: 1, beach: 1, stargaze: 1, wander: 0.8, plaza: 1, forage: 0.7, garden: 0.5, petCat: 0.4, chop: 0.3, watchDolphins: 1 };
  const DATE = new Set(['stargaze', 'beach', 'wander', 'swim', 'plaza']);
  const LINES = {
    ask: ['Hey {o}! Wanna come {w} with me?', '{o}! Come {w}? Right now?', 'I\'m going {w}. You in, {o}?', 'Come {w} with me, {o}!'],
    askBros: ['Boys! We\'re going {w}. Let\'s go.', 'Bros. {W}. Now.', 'Squad\'s going {w}. Move it!'],
    askDate: ['Hey you. Wanna go {w} with me? Just us?', 'Date night? Let\'s go {w}.', 'Come {w} with me. I\'ll make it nice.'],
    yes: ['Say less!', 'Ooh, yes!', 'Be right there!', 'Okay okay, I\'m coming.', 'Sure, why not!'],
    yesDate: ['I\'d love that.', 'Yes. Obviously.', 'I was hoping you\'d ask.'],
    no: ['Maybe later!', 'Nah, I\'m good.', 'Not right now, sorry.', 'Pass. Have fun though!'],
  };

  M.onStart = (sim, p, a) => {
    const def = a.def;
    if (!INVITE[def.id] || a.invitedBy || p.noAutoInvite || p.mode !== 'normal' || p.sick) return;
    const min = sim.clock.min;
    const partner = p.partner();
    const plan = (p.plans || []).find(pl => !pl.done && ((pl.kind === 'do' && pl.def === def.id && pl.invite) || pl.kind === 'bros' || (pl.kind === 'date' && DATE.has(def.id) && min >= 17 * 60)));
    const dateTime = partner && DATE.has(def.id) && min >= 17.5 * 60 && min < 22 * 60;
    let chance = (IS.Tune.inviteBase + p.traits.sociable * IS.Tune.inviteSoc) * INVITE[def.id];
    if (plan) chance += 0.45;
    if (dateTime) chance += 0.4;
    if (Math.random() > chance) return;
    const bros = plan && plan.kind === 'bros';
    const cands = sim.people.filter(o => o !== p && M.available(o, p)).map(o => {
      const r = p.relTo(o.name);
      let s = r.friendship + r.romance * 0.7 + ((r.label || '').includes('bro') ? 30 : 0) + (r.partner ? 60 : 0);
      if (def.love && o.loves.includes(def.love)) s += 25;
      if (def.love && o.hates.includes(def.love)) s -= 50;
      s -= IS.dist(o.x, o.y, p.x, p.y) / IS.TILE;
      return { o, s };
    }).filter(c => c.s > 10).sort((x, y) => y.s - x.s);
    if (!cands.length) return;
    const isDate = dateTime && cands[0].o === partner;
    const invitees = bros ? cands.filter(c => (p.relTo(c.o.name).label || '').includes('bro')).slice(0, 2).map(c => c.o) : [cands[0].o];
    if (!invitees.length) return;
    const fill = s => s.replace('{o}', invitees.map(o => o.name).join(' and ')).replace('{w}', word(def.id)).replace('{W}', word(def.id)[0].toUpperCase() + word(def.id).slice(1));
    p.say(fill(pick(isDate ? LINES.askDate : bros ? LINES.askBros : LINES.ask, p.name)));
    const joined = [];
    for (const o of invitees) {
      const r = o.relTo(p.name);
      let yes = 0.2 + r.friendship / 130 + (def.love && o.loves.includes(def.love) ? 0.3 : 0) - (def.love && o.hates.includes(def.love) ? 0.6 : 0) + o.traits.sociable * 0.15;
      if (r.partner) yes += 0.45;
      if (M.feeling(o) && M.feeling(o).type === 'sulking' && M.feeling(o).about === p.name) yes -= 0.8;
      if (o.needs.energy < 25) yes -= 0.4;
      if (Math.random() < yes && M.join(sim, o, p, def)) joined.push(o);
      else setTimeout(() => { if (!o.chat) o.say(pick(LINES.no, o.name)); }, 1100);
    }
    if (!joined.length) return;
    const names = joined.map(o => o.name).join(' and ');
    a.with = names;
    a.date = isDate && joined.includes(partner);
    for (const o of joined) { o.action.date = a.date; setTimeout(() => { if (!o.chat) o.say(pick(a.date ? LINES.yesDate : LINES.yes, o.name)); }, 1100); }
    if (bros && joined.length === 2) for (const o of joined) o.action.with = [p, ...joined].filter(x => x !== o).map(x => x.name).join(' and ');
    if (a.date) { M.news(sim, 'date', p, partner); sim.log(`${p.name} and ${partner.name} went ${word(def.id)} on a little date.`, 'love', [p, partner]); }
    else if (Math.random() < 0.6) sim.log(`${p.name} and ${names} went ${word(def.id)} together.`, 'social', [p, ...joined]);
  };

  // Free enough to drop what they're doing for an invite?
  M.available = (o, by) => {
    if (o.mode !== 'normal' || o.chat || o.sick || o.pose === 'sleep') return false;
    if (o.isAvoiding(by) || by.isAvoiding(o)) return false;
    const a = o.action;
    if (!a) return true;
    if (a.forced || a.invitedBy || ['attend', 'cook', 'care', 'eat', 'sleep', 'approach'].includes(a.def.id)) return false;
    return true;
  };

  M.join = (sim, o, host, def) => {
    o.cancelAction();
    const ha = host.action;
    o.joinNear = ha.spot ? { x: ha.spot.x, y: ha.spot.y } : { x: ha.tx, y: ha.ty };
    const ok = o.startAction(def, sim.clock);
    o.joinNear = null;
    if (!ok) return false;
    o.action.invitedBy = host.name;
    o.action.with = host.name;
    return true;
  };

  // A friend got dunked or flung: the people who care come running
  M.rally = (sim, victim) => {
    const n = M.news(sim, 'dunk', victim);
    for (const o of sim.people) {
      if (o === victim || !IS.Social.isFree(o)) continue;
      const f = o.relTo(victim.name).friendship;
      if (f < 30 || !o.knows.has(n.id)) continue;
      if (Math.random() < 0.35 + f / 200 + o.traits.kind * 0.2) {
        o.say(IS.pick([`${victim.name}!! Are you okay?!`, `Hang on, ${victim.name}!`, `${victim.name}! I'm coming!`]));
        IS.Social.approach(sim, o, victim, 'checkOn');
      }
    }
  };

  // ------------------------------------------------------------ talking
  // Extra conversation topics driven by the mind (added to chooseTopic)
  M.topics = (sim, sp, li, add, r) => {
    const t = sp.traits;
    const n = M.unknownNews(sim, sp, li);
    if (n) add('rumor', 1.4 + t.curious * 0.8 + t.sociable * 0.6 - t.kind * 0.4, { news: n });
    const g = M.led(sp, li.name);
    if (g.grudge > 14 && t.kind < 0.8) add('grudge', g.grudge / 14 + t.grumpy);
    if (g.thanks > 8) add('thanks', 1 + g.thanks / 20);
    const own = M.ownNews(sim, sp, li);
    if (own) add('myNews', 2.6 + t.sociable, { news: own });
    const known = (sim.news || []).filter(x => sp.knows.has(x.id) && (x.a === li.name || x.b === li.name) && x.a !== sp.name && x.b !== sp.name && sim.clock.abs - x.t < 1440 * 2);
    const congrats = known.find(x => (x.kind === 'couple' || x.kind === 'won') && !(sp.congratulated || new Set()).has(x.id));
    if (congrats) {
      const e = M.feeling(sp);
      add(e && (e.type === 'jealous' || e.type === 'heartbroken') ? 'congratsSour' : 'congrats', 3, { news: congrats });
    }
    const hurt = M.feeling(li);
    if (hurt && (hurt.type === 'heartbroken' || hurt.type === 'sulking') && sp.relTo(li.name).friendship > 30) add('comfort', 2.5 + t.kind * 2);
    const mine = M.feeling(sp);
    if (mine) {
      if (mine.type === 'heartbroken' && r.friendship > 30) add('vent', 2.5);
      if (mine.type === 'jealous' && mine.about === li.name) { add('snipe', 2.5 + t.grumpy * 2); add('argue', 1 + t.grumpy * 2); }
      if (mine.type === 'proud') add('proudBrag', 2);
      if (mine.type === 'giddy') add('giddyTalk', 2.2);
    }
  };

  const T = {
    grudge: ['I haven\'t forgotten {why}, you know.', 'Still mad about {why}, honestly.', 'You never really apologized for {why}.'],
    thanks: ['Thanks again for {favor}. I mean it.', 'I still owe you for {favor}.', 'You were really there for me with {favor}.'],
    congrats: { couple: ['You and {other2}?! Congrats!! Finally!', 'Okay, you two are adorable. Congrats!', 'I KNEW it. Congratulations!'], won: ['Champion of the dock! Congrats!', 'You actually won! Congrats!', 'Teach me your fishing secrets, champ.'] },
    congratsSour: ['So... you and {other2}. Cool. Good for you.', 'Congrats, I guess.', 'Heard about you and {other2}. Great. Really.'],
    comfort: ['Hey. I heard. You okay?', 'Come here. Want to talk about it?', 'For what it\'s worth, you deserve better.', 'I brought snacks. And ears. For listening.'],
    vent: ['I can\'t stop thinking about {about}.', 'Is it dumb that I\'m still sad about {about}?', 'Everything reminds me of {about} today.'],
    snipe: ['Must be nice, huh? Having everyone like you.', 'Don\'t look so pleased with yourself.', 'You think you\'re so charming, don\'t you.'],
    proudBrag: ['Did you see what I did? Pretty great, right?', 'I\'m kind of on a roll lately.', 'Today? I\'m unstoppable.'],
    giddyTalk: ['Sorry, I can\'t stop smiling today.', 'Is the sky extra pretty today or is it just me?', 'I\'m in such a good mood, you have no idea.'],
    checkOn: ['Are you okay?! That looked terrifying!', 'Are you hurt? Talk to me!', 'I saw you go flying! You okay?'],
  };
  const R = {
    rumor: { couple: ['No WAY!', 'I knew it! I KNEW it.', 'Wait, seriously?!'], fight: ['Yikes. About what?', 'Again? Those two...', 'Oof. I\'m staying out of that.'], rejected: ['Oh no... poor thing.', 'Ouch. That\'s rough.'], breakup: ['What?! They were so cute!', 'Oh no. Are they okay?'], won: ['Ugh, we\'ll never hear the end of it.', 'Ha! Good for them.'], dunk: ['THE SEA?!', 'The sky did WHAT?'], date: ['Aww!', 'Stop, that\'s so cute.'] },
    grudge: { sorry: ['You\'re right. I\'m sorry about that.', 'Yeah... that wasn\'t okay. Sorry.'], defend: ['Are you still on that?', 'Let it go already.', 'That was ages ago!'] },
    thanks: ['Anytime. Seriously.', 'That\'s what friends are for.', 'Don\'t mention it!'],
    congrats: ['Thank you!!', 'Hehe, thanks!', 'Aww, thanks!'],
    congratsSour: ['...Thanks?', 'Okay... thanks, I guess.'],
    comfort: ['Thanks. I really needed that.', 'You\'re a good friend, you know that?', '...Yeah. Thanks.'],
    vent: ['Hey. It\'s gonna be okay. Promise.', 'You\'re allowed to be sad. I\'m here.', 'Want to go do something to take your mind off it?'],
    snipe: ['What\'s your problem?', 'Uh. Okay?', 'Someone\'s cranky.'],
    proudBrag: ['Yeah, yeah, you\'re great.', 'Okay, that IS impressive.'],
    giddyTalk: ['Ha, it\'s cute on you.', 'Wonder why... *wink*'],
    checkOn: ['I\'m okay... I think.', 'My pride is hurt. Mostly my pride.', 'Thanks for checking. That was insane.'],
  };

  M.lineFor = (sim, sp, li, topic, extra, ctx) => {
    const who = sp.name;
    const e = M.feeling(sp);
    const fill = s => s.replace('{why}', M.led(sp, li.name).why || 'what you said').replace('{favor}', M.led(sp, li.name).favor || 'the other day').replace('{about}', e && e.about ? e.about : 'everything');
    switch (topic) {
      case 'rumor': {
        const n = extra.news;
        return pick(RUMOR[n.kind], who).replace('{a}', n.a).replace('{b}', n.b || '');
      }
      case 'congrats': case 'congratsSour': {
        const n = extra.news;
        sp.congratulated = sp.congratulated || new Set();
        sp.congratulated.add(n.id);
        const other2 = n.a === li.name ? n.b : n.a;
        const pool = topic === 'congrats' ? T.congrats[n.kind] : T.congratsSour;
        return pick(pool, who).replace('{other2}', other2 || 'them');
      }
      default: return T[topic] ? fill(pick(T[topic], who)) : null;
    }
  };

  // The listener's reply for a mind topic, and what it does to them
  M.react = (sim, sp, li, t) => {
    const who = li.name;
    const topic = t.topic;
    const e = t.extra || {};
    switch (topic) {
      case 'rumor': {
        M.learn(sim, li, e.news, sp);
        return { v: 0.8 + li.traits.curious * 0.5, text: pick(R.rumor[e.news.kind] || ['Huh!'], who) };
      }
      case 'grudge': {
        const sorry = li.traits.kind > 0.55 && li.relTo(sp.name).friendship > -10;
        if (sorry) { const g = M.led(sp, li.name); g.grudge *= 0.4; return { v: 1.2, text: pick(R.grudge.sorry, who) }; }
        M.led(li, sp.name).grudge += 4;
        return { v: -1.5, text: pick(R.grudge.defend, who), emote: 'anger' };
      }
      case 'thanks': { M.led(sp, li.name).thanks *= 0.6; return { v: 2, text: pick(R.thanks, who) }; }
      case 'congrats': return { v: 2, text: pick(R.congrats, who), emote: 'heart' };
      case 'congratsSour': return { v: -0.4, text: pick(R.congratsSour, who) };
      case 'comfort': {
        const f = M.feeling(li);
        if (f && f.type === 'heartbroken') f.until -= 6 * 60;
        else M.clearFeeling(li);
        M.led(li, sp.name).thanks += 8; M.led(li, sp.name).favor = 'cheering me up';
        li.addMood(`${sp.name} cheered me up`, 8, 360);
        for (const pl of sp.plans || []) if (!pl.done && pl.topic === 'comfort' && pl.who === li.name) pl.done = true;
        return { v: 2.5, text: pick(R.comfort, who), emote: 'heart' };
      }
      case 'vent': { M.led(sp, li.name).thanks += 4; M.led(sp, li.name).favor = 'listening to me'; return { v: 1.5, text: pick(R.vent, who) }; }
      case 'snipe': { M.led(li, sp.name).grudge += 5; M.led(li, sp.name).why = 'that snide comment'; return { v: -2.2, text: pick(R.snipe, who), emote: 'anger' }; }
      case 'proudBrag': return { v: li.traits.kind > 0.5 ? 0.8 : -0.3, text: pick(R.proudBrag, who) };
      case 'giddyTalk': return { v: 1, text: pick(R.giddyTalk, who) };
      case 'checkOn': { M.led(li, sp.name).thanks += 10; M.led(li, sp.name).favor = 'checking on me after the Sky Hand thing'; return { v: 2.5, text: pick(R.checkOn, who), emote: 'heart' }; }
    }
    return null;
  };
  M.TOPICS = new Set(['rumor', 'grudge', 'thanks', 'congrats', 'congratsSour', 'comfort', 'vent', 'snipe', 'proudBrag', 'giddyTalk', 'checkOn']);

  // After any topic lands: ledgers, emotions, news, plans
  M.afterTopic = (sim, sp, li, t, out) => {
    const topic = t.topic;
    for (const pl of sp.plans || []) if (!pl.done && pl.kind === 'talk' && pl.who === li.name && (pl.topic === topic || (pl.topic === 'flirt' && topic === 'confess'))) pl.done = true;
    if (topic === 'argue') {
      for (const [p, o, w] of [[li, sp, 1], [sp, li, 0.6]]) {
        const g = M.led(p, o.name);
        g.grudge += 12 * w * (0.5 + p.traits.grumpy); g.why = `our fight on ${IS.WEEKDAYS[sim.clock.weekday]}`;
      }
      M.news(sim, 'fight', sp, li);
      if (li.traits.grumpy > 0.3 || li.traits.kind < 0.5) M.feel(li, 'sulking', sp.name, 4);
      // Couples who fight can break up
      const r = sp.relTo(li.name);
      if (r.partner && li.relTo(sp.name).friendship < 8 && Math.random() < 0.55) M.breakup(sim, sp, li);
    }
    if (topic === 'apology' && out.df > 5) {
      M.led(li, sp.name).grudge *= 0.3; M.led(sp, li.name).grudge *= 0.3;
      M.clearFeeling(li, 'sulking'); M.clearFeeling(sp, 'sulking');
    }
    if (topic === 'confess') {
      if (sp.relTo(li.name).partner) {
        M.news(sim, 'couple', sp, li);
        M.feel(sp, 'giddy', li.name, 16); M.feel(li, 'giddy', sp.name, 16);
      } else {
        M.news(sim, 'rejected', sp, li);
        if (sp.relTo(li.name).romance > 55) M.feel(sp, 'heartbroken', li.name, 26); else M.feel(sp, 'sulking', li.name, 6);
      }
    }
    if (topic === 'flirt' && out.dr > 0) {
      // Anyone nearby who likes either of them notices
      for (const w of sim.people) {
        if (w === sp || w === li || w.pose === 'sleep' || (w.building || null) !== (sp.building || null) || IS.dist(w.x, w.y, sp.x, sp.y) > IS.TILE * 9) continue;
        if (w.relTo(li.name).romance > 40 || w.relTo(li.name).partner) { M.feel(w, 'jealous', sp.name, w.relTo(li.name).partner ? 10 : 6); w.thought = `Why is ${sp.name} flirting with ${li.name}?!`; M.led(w, sp.name).grudge += w.relTo(li.name).partner ? 8 : 3; M.led(w, sp.name).why = `flirting with ${li.name}`; }
      }
    }
    if (topic === 'myNews' && t.extra && t.extra.news) M.learn(sim, li, t.extra.news, sp);
    if (topic === 'sickVisit') { const g = M.led(li, sp.name); g.thanks += 12; g.favor = 'the soup when I was sick'; }
    if (topic === 'roast' && out.df < 0) { const g = M.led(li, sp.name); g.grudge += 3; g.why = 'that roast'; }
    if ((topic === 'compliment' || topic === 'deep') && out.df > 1) M.led(li, sp.name).thanks += 1;
    if (topic === 'gossipBad' || topic === 'gossipGood') {
      const third = t.extra && t.extra.third;
      if (third && third !== li) {
        const trust = IS.clamp(li.relTo(sp.name).friendship / 60, 0, 1);
        li.changeRel(third.name, (topic === 'gossipBad' ? -1.6 * (1 - li.traits.kind * 0.4) : 1.2) * trust);
      }
    }
  };

  M.breakup = (sim, a, b) => {
    a.relTo(b.name).partner = false; b.relTo(a.name).partner = false;
    a.relTo(b.name).romance *= 0.4; b.relTo(a.name).romance *= 0.4;
    M.news(sim, 'breakup', a, b);
    for (const [p, o] of [[a, b], [b, a]]) { M.feel(p, 'heartbroken', o.name, 30); p.remember(`Broke up with ${o.name}`, { tag: 'heartache', about: o.name }); }
    sim.log(`${a.name} and ${b.name} broke up. Oof.`, 'warn', [a, b]);
    sim.toast(`${a.name} and ${b.name} broke up...`);
  };

  // ------------------------------------------------------------ ticking
  M.tick = (sim, dt) => {
    const now = sim.clock.abs, min = sim.clock.min;
    for (const p of sim.people) {
      const e = M.feeling(p);
      if (p.emotion && !e) p.emotion = null;
      // Loneliness
      if (!e && p.needs.social < IS.Tune.lonelyAt && now - (p.lastChatAt || 0) > 240 && p.pose !== 'sleep') M.feel(p, 'lonely', null, 3);
      // Feelings leak into thoughts now and then
      if (e && p.action && Math.random() < 0.004 * dt) p.thought = M.thoughtFor(p, e);
      if (p.action && p.action.date && p.action.phase === 'do' && Math.random() < 0.05 * dt) p.emote('heart', 1.4);
      // Working toward social plans
      if (min < 8 * 60 || min > 21 * 60 || !IS.Social.isFree(p)) continue;
      for (const x of p.plans || []) if (!x.done && x.kind === 'talk' && (x.topic === 'confess' || x.topic === 'flirt') && (p.partner() || sim.byName(x.who).partner())) x.done = x.gaveUp = true;
      const pl = (p.plans || []).find(x => !x.done && (x.kind === 'talk' || x.kind === 'see') && (x.nextTry || 0) < now);
      if (!pl) continue;
      const o = sim.byName(pl.who);
      if (!o || o.chat || !o.canBeVisited(p)) continue;
      if (Math.random() < IS.Tune.planSocialRate * dt * (0.5 + p.traits.sociable)) {
        pl.tries++; pl.nextTry = now + 90;
        if (pl.tries > 4) { pl.done = true; pl.gaveUp = true; continue; }
        if (pl.topic === 'confess' && p.relTo(o.name).romance < 70) pl.topic = 'flirt';
        IS.Social.approach(sim, p, o, pl.kind === 'talk' ? pl.topic : null);
      }
    }
  };

  M.thoughtFor = (p, e) => {
    const o = e.about;
    return IS.pick({
      heartbroken: [`I keep thinking about ${o}.`, 'Everything feels a bit grey today.', `Why did it have to end like that with ${o}?`],
      jealous: [`What does everyone see in ${o} anyway?`, `${o} better watch it.`, `Ugh. ${o}.`],
      giddy: [`${o}!!! Okay. Breathe.`, `I can't stop smiling.`, `Is this what being happy feels like?`],
      sulking: [`${o} is SO annoying.`, `I'm not talking to ${o}. Not today.`, 'Hmph.'],
      proud: ['I am the best. Objectively.', 'Did everyone see that? I hope everyone saw that.'],
      lonely: ['It\'s been a while since I talked to anyone.', 'Where is everybody?', 'I could really use some company.'],
    }[e.type] || ['...']);
  };

  // ------------------------------------------------------------ days
  M.newDay = sim => {
    for (const p of sim.people) {
      const keep = IS.clamp(0.55 + p.traits.grumpy * 0.4 - p.traits.kind * 0.25, 0.3, 0.95);
      for (const g of Object.values(p.ledger || {})) { g.grudge *= keep; g.thanks *= 0.85; if (g.grudge < 1) g.grudge = 0; }
    }
  };
  // Long memory pulls friendships toward how they've been treated
  M.baselineShift = (p, o) => { const g = p.ledger && p.ledger[o.name]; return g ? g.thanks * 0.3 - g.grudge * 0.45 : 0; };
  M.morning = sim => { for (const p of sim.people) M.makePlans(sim, p); };

  M.reputation = (sim, p) => {
    const others = sim.people.filter(o => o !== p);
    const avg = others.reduce((s, o) => s + o.relTo(p.name).friendship, 0) / Math.max(1, others.length);
    return { avg, word: avg > 45 ? 'Beloved' : avg > 22 ? 'Well liked' : avg > 5 ? 'Liked' : avg > -10 ? 'Mixed' : avg > -30 ? 'Not popular' : 'Disliked' };
  };

  return M;
})();
