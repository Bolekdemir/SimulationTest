// Conversations between islanders: topic choice, lines, reactions and
// relationship changes.
IS.Social = (() => {
  const S = {};
  const TRAITS = ['sociable', 'energetic', 'kind', 'grumpy', 'curious', 'hardworking', 'brave'];

  S.compat = (a, b) => {
    let d = 0;
    for (const k of TRAITS) d += Math.abs(a.traits[k] - b.traits[k]);
    let c = 1 - d / TRAITS.length;
    for (const l of a.loves) if (b.loves.includes(l)) c += 0.08;
    for (const l of a.loves) if (b.hates.includes(l)) c -= 0.05;
    return IS.clamp(c, 0, 1);
  };

  S.pairKey = (a, b) => (a.id < b.id ? a.id + '-' + b.id : b.id + '-' + a.id);

  // Called every sim minute: nearby idle people may strike up a chat.
  S.update = (sim, dt) => {
    const ppl = sim.people;
    for (let i = 0; i < ppl.length; i++) for (let j = i + 1; j < ppl.length; j++) {
      const a = ppl[i], b = ppl[j];
      if (!a.canChat() || !b.canChat()) continue;
      if (a.isAvoiding(b) || b.isAvoiding(a)) continue;
      const d = IS.dist(a.x, a.y, b.x, b.y);
      if (d > IS.TILE * 2.2) continue;
      if ((a.building || null) !== (b.building || null)) continue;
      const key = S.pairKey(a, b);
      const atEvent = a.action && b.action && a.action.def.id === 'attend' && b.action.def.id === 'attend';
      if ((sim.chatCooldown[key] || 0) > sim.clock.abs) continue;
      const social = ((100 - a.needs.social) + (100 - b.needs.social)) / 200;
      const rel = (a.relTo(b.name).friendship + b.relTo(a.name).friendship) / 2;
      const relF = IS.clamp(1 + rel / 80, 0.25, 2);
      const travelling = (a.action && a.action.phase === 'travel') || (b.action && b.action.phase === 'travel');
      let p = 0.07 * ((a.traits.sociable + b.traits.sociable) / 2 + 0.2) * (0.6 + social * 1.4) * relF;
      if (atEvent) p *= 4;
      if (travelling) p *= 0.35;
      if (Math.random() < p * dt) S.start(sim, a, b, { atEvent });
    }
  };

  S.start = (sim, a, b, opts = {}) => {
    if (a.chat || b.chat) return false;
    if (!opts.topic && (!b.canChat() || !a.canChat())) {
      if (!opts.forced) return false;
      if (!b.canChat()) return false;
    }
    if (opts.topic === 'sickVisit' && (b.mode !== 'normal' || b.chat)) return false;
    new S.Conversation(sim, a, b, opts);
    return true;
  };

  S.Conversation = class {
    constructor(sim, a, b, opts) {
      this.sim = sim;
      this.a = a; this.b = b;
      this.opts = opts;
      this.step = 0;
      this.timer = 0;
      this.lineMin = 3.2;
      this.exchanges = opts.topic ? 1 : 1 + Math.round(IS.rand(1, 2.5) * ((a.traits.sociable + b.traits.sociable) / 2 + 0.4));
      this.queue = [];
      this.topicsUsed = new Set();
      this.totalDelta = 0;
      a.chat = this; b.chat = this;
      for (const p of [a, b]) if (p.pose === 'walk') p.pose = 'stand';
      if (a.pose !== 'sit') a.faceToward(b.x, b.y);
      if (b.pose !== 'sit' && b.pose !== 'sleep') b.faceToward(a.x, a.y);
      sim.conversations.push(this);
      this.plan();
    }
    other(p) { return p === this.a ? this.b : this.a; }

    plan() {
      const { a, b } = this;
      if (this.opts.topic) {
        this.queueTopic(a, b, this.opts.topic);
        return;
      }
      // Greeting, then a few topic exchanges, alternating who leads.
      this.queue.push({ speaker: a, listener: b, topic: 'greet' });
      this.queue.push({ speaker: b, listener: a, topic: 'greetBack' });
      for (let i = 0; i < this.exchanges; i++) {
        const sp = i % 2 === 0 ? a : b;
        this.queue.push({ speaker: sp, listener: this.other(sp), topic: null });
      }
    }

    queueTopic(sp, li, topic) { this.queue.push({ speaker: sp, listener: li, topic }); }

    update(dt) {
      this.timer -= dt;
      if (this.timer > 0) return;
      const item = this.queue.shift();
      if (!item) { this.end(); return; }
      this.timer = this.lineMin;
      this.run(item);
    }

    run(item) {
      const sim = this.sim;
      const { speaker: sp, listener: li } = item;
      li.bubble = null;
      if (item.response) {
        sp.say(item.text);
        if (item.emote) sp.emote(item.emote, 1.6);
        return;
      }
      if (item.topic === 'greet' || item.topic === 'greetBack') {
        const tone = IS.Dialogue.tone(sp, li);
        sp.say(IS.Dialogue.fill(IS.Dialogue.line('greet', tone), S.ctx(sim, sp, li)));
        sp.needs.social = Math.min(100, sp.needs.social + 2);
        return;
      }
      const t = item.topic ? S.topicFor(sim, sp, li, item.topic) : S.chooseTopic(sim, sp, li, this.topicsUsed);
      this.topicsUsed.add(t.topic);
      sp.say(t.text);
      const outcome = S.react(sim, sp, li, t);
      this.totalDelta += outcome.df;
      if (outcome.text) this.queue.unshift({ speaker: li, listener: sp, response: true, text: outcome.text, emote: outcome.emote });
      if (outcome.endsChat) this.queue = this.queue.filter(q => q.response);
      for (const p of [sp, li]) {
        p.needs.social = Math.min(100, p.needs.social + 2.5 * (0.5 + p.traits.sociable));
        p.needs.fun = Math.min(100, p.needs.fun + (p.loves.includes('chatting') ? 1.2 : 0.5) * (0.4 + p.traits.sociable));
      }
      this.lastTopic = t.topic;
    }

    abort(byWhom) {
      const o = this.other(byWhom);
      if (o.mode === 'normal' && o.pose !== 'sleep') {
        o.emote('exclaim', 1.5);
        o.say(IS.pick([`${byWhom.name}?! Where are you going?!`, `Uh... ${byWhom.name} just floated away.`, 'Hey, I was talking to you!']));
      }
      this.end(true);
    }

    end(aborted) {
      const { a, b, sim } = this;
      a.chat = null; b.chat = null;
      sim.conversations = sim.conversations.filter(c => c !== this);
      const key = S.pairKey(a, b);
      const atEvent = a.action && a.action.def.id === 'attend';
      sim.chatCooldown[key] = sim.clock.abs + (atEvent ? 25 : IS.rand(80, 140));
      if (aborted) return;
      if (this.lastTopic === 'argue') return;
      if (Math.abs(this.totalDelta) >= 6) {
        const good = this.totalDelta > 0;
        for (const [p, o] of [[a, b], [b, a]]) p.remember(good ? `Had a lovely chat with ${o.name}` : `Had an unpleasant talk with ${o.name}`, { tag: 'chat', about: o.name, mood: good ? 4 : -4, moodDuration: 180 });
        if (Math.random() < 0.4) sim.log(good ? `${a.name} and ${b.name} had a great chat.` : `${a.name} and ${b.name} had an awkward conversation.`, good ? 'social' : 'warn', [a, b]);
      }
    }
  };

  S.ctx = (sim, sp, li, extra = {}) => {
    const others = sim.people.filter(p => p !== sp && p !== li);
    const third = (typeof extra.third === 'string' ? sim.byName(extra.third) : extra.third) || (others.length ? IS.pick(others) : null);
    const min = sim.clock.min;
    const greet = min < 720 ? 'good morning' : min < 1080 ? 'good afternoon' : 'good evening';
    const pod = min < 720 ? 'morning' : min < 1080 ? 'afternoon' : 'evening';
    const favOf = p => IS.Dialogue.activityWord[p.loves[0]] || 'wandering';
    const n = sp.needs;
    const lowest = Object.entries(n).sort((x, y) => x[1] - y[1])[0][0];
    return {
      other: li.name, OTHER: li.name.toUpperCase(), Greet: greet[0].toUpperCase() + greet.slice(1), greet,
      partofday: pod, fav: favOf(sp), Fav: favOf(sp)[0].toUpperCase() + favOf(sp).slice(1), otherFav: li.loves[0] || 'gardening',
      doing: sp.history.length ? (IS.Dialogue.activityWord[IS.Actions[sp.history[sp.history.length - 1]]?.love] || 'pottering about') : 'pottering about',
      third: third ? third.name : 'the seagulls', thirdFav: third ? (third.loves[0] || 'napping') : 'squawking',
      thirdDoing: third ? (IS.Dialogue.activityWord[third.loves[0]] || 'napping') : 'squawking',
      needword: { hunger: 'hungry', energy: 'tired', social: 'lonely', fun: 'bored' }[lowest],
      pantryWord: sim.world.food < 5 ? 'pretty empty' : sim.world.food < 12 ? 'a little thin' : 'well stocked',
      ...extra,
    };
  };

  // Pick a topic based on personality, memories, relationship and context.
  S.chooseTopic = (sim, sp, li, used) => {
    const r = sp.relTo(li.name);
    const t = sp.traits;
    const cands = [];
    const add = (topic, w, extra) => { if (w > 0 && !used.has(topic)) cands.push({ topic, w, extra }); };

    if (li.cfg.birthday && sim.isBirthday(li) && !li.visitedBy.has('bday:' + sp.name)) add('birthday', 30);
    for (const tag of ['sea', 'grabbed']) {
      const m = sp.recentMemory(tag, 600, li.name);
      if (m) add(tag === 'sea' ? 'skyhandSea' : 'skyhand', 8, { memory: m });
    }
    const wit = sp.recentMemory('witness', 600, li.name);
    if (wit && wit.about !== li.name) add('skyhandWitness', 5, { memory: wit, third: sim.byName(wit.about) });
    for (const tag of ['letter', 'bottle', 'dolphins', 'star', 'bigfish', 'find', 'contest']) {
      const m = sp.recentMemory(tag, 1800, li.name);
      if (m) add('news:' + tag, 4, { memory: m });
    }
    const ev = sim.events.nextEvent();
    if (ev) add('eventSoon', 1.3, { event: ev });
    add('weather', 0.8);
    add('activity', 0.9);
    if (sp.loves.some(l => li.loves.includes(l))) add('sharedLove', 1.4);
    const others = sim.people.filter(p => p !== sp && p !== li);
    if (others.length) {
      const third = IS.pick(others);
      const f3 = sp.relTo(third.name).friendship;
      add(f3 >= 15 ? 'gossipGood' : f3 < 0 ? 'gossipBad' : 'gossipGood', (t.curious + t.sociable) * 0.6 + (f3 < 0 ? t.grumpy : 0), { third });
    }
    add('compliment', t.kind * 1.4 + (r.friendship > 30 ? 0.5 : 0));
    add('joke', (t.energetic + (1 - t.grumpy)) * 0.55);
    add('complaint', t.grumpy * 1.5 + (sp.mood() < 40 ? 1 : 0));
    if (sp.needs.hunger < 35) add('hungry', 2);
    if (r.friendship > 45 && sim.clock.min > 1140) add('deep', 1.3);
    if (sp.canFallFor(li.name) && r.romance > 25 && !r.partner) add('flirt', r.romance / 30);
    if (r.partner) add('flirt', 1.2);
    if (sp.canFallFor(li.name) && r.romance > 70 && r.friendship > 40 && !r.partner && (sp.confessedTo || {})[li.name] === undefined) add('confess', 4);
    if (r.friendship < -25 || (t.grumpy > 0.6 && sp.mood() < 35)) add('argue', 1.5 + t.grumpy + (r.friendship < -40 ? 1.5 : 0));
    else {
      // Personality friction: clashing or cranky people bicker now and then
      const friction = (0.66 - S.compat(sp, li)) * 4 + t.grumpy * (sp.mood() < 55 ? 1 : 0.3) - t.kind * 0.4;
      if (friction > 0 && r.friendship < 45 && !r.partner) add('argue', friction * 0.8);
    }
    if (r.friendship < 0 && t.kind > 0.5) add('apology', 1.6);
    if ((sp.cfg.catchphrases || []).length) add('catchphrase', 0.7);

    const pick = IS.weightedPick(cands.length ? cands : [{ topic: 'weather', w: 1 }]);
    return S.topicFor(sim, sp, li, pick.topic, pick.extra || {});
  };

  S.topicFor = (sim, sp, li, topic, extra = {}) => {
    const D = IS.Dialogue;
    const ctx = S.ctx(sim, sp, li, extra.third ? { third: extra.third.name, thirdFav: extra.third.loves[0] || 'napping', thirdDoing: D.activityWord[extra.third.loves[0]] || 'napping' } : {});
    const tone = D.tone(sp, li);
    let text;
    if (extra.memory) extra.memory.toldTo.add(li.name);
    switch (topic) {
      case 'weather': text = tone === 'grumpy' && Math.random() < 0.5 ? D.line('weather', null, 'grumpy') : D.line('weather', null, sim.weather); break;
      case 'eventSoon': {
        const ev = extra.event;
        const when = ev.day === sim.clock.day ? (ev.start > sim.clock.min ? 'tonight' : 'today') : 'tomorrow';
        ctx.event = ev.name; ctx.when = ev.start < 17 * 60 && ev.day === sim.clock.day ? 'today' : when;
        text = D.line('eventSoon');
        break;
      }
      case 'catchphrase': text = IS.pick(sp.cfg.catchphrases); break;
      case 'news:bottle': ctx.bottleMsg = extra.memory.detail || '...'; text = D.line('bottle'); break;
      case 'news:find': text = `I found ${extra.memory.detail} in the forest!`; break;
      case 'news:contest': text = extra.memory.text.includes('Won') ? 'I won the fishing contest! Did you hear?' : 'That fishing contest was rigged, I swear.'; break;
      case 'birthday': li.visitedBy.add('bday:' + sp.name); text = D.line('birthday'); break;
      default:
        if (topic.startsWith('news:')) text = D.line(topic.slice(5));
        else text = D.line(topic, tone);
    }
    return { topic, text: D.fill(text, ctx), tone, extra };
  };

  // How does the listener take it? Returns relationship deltas + reply.
  S.react = (sim, sp, li, t) => {
    const D = IS.Dialogue;
    const lt = li.traits;
    const rel = li.relTo(sp.name);
    const base = {
      weather: 0.3, activity: 0.3, sharedLove: 1.2, gossipGood: 0.6, compliment: 1.5, joke: lt.grumpy > 0.6 ? -0.2 : 0.9,
      complaint: lt.grumpy > 0.55 ? 0.7 : lt.kind > 0.6 ? 0.3 : -0.4, hungry: 0.1, deep: 1.1, flirt: li.canFallFor(sp.name) ? 1.4 : -0.3,
      argue: -2.5, apology: lt.kind > 0.5 ? 2.2 : 0.4, skyhand: 0.9, skyhandSea: 0.8, skyhandWitness: 0.7, eventSoon: 0.6,
      birthday: 2.5, sickVisit: 3, catchphrase: 0.35, confess: 0,
    };
    let b = base[t.topic];
    if (t.topic === 'gossipBad') b = li.relTo(t.extra.third ? t.extra.third.name : '').friendship < 0 ? 0.9 : -0.7;
    if (t.topic.startsWith('news:')) b = 0.8 + lt.curious * 0.4;
    if (b === undefined) b = 0.3;
    const compat = S.compat(sp, li);
    let v = b + (compat - 0.65) * 3 + (li.mood() - 60) / 80 + rel.friendship / 200 + IS.rand(-0.6, 0.6);
    if (li.hates.includes('chatting')) v -= 0.4;
    if (li.loves.includes('chatting')) v += 0.15;
    if (lt.grumpy > 0.5) v -= (lt.grumpy - 0.5) * 1.2;
    const ltone = D.tone(li, sp);
    let special = null, emote = null, df = 0, dr = 0, endsChat = false;

    if (t.topic === 'confess') {
      sp.confessedTo = sp.confessedTo || {};
      const accept = rel.romance >= 50 && rel.friendship > 30;
      sp.confessedTo[li.name] = accept;
      if (accept) {
        sp.relTo(li.name).partner = true; li.relTo(sp.name).partner = true;
        for (const [p, o] of [[sp, li], [li, sp]]) { p.remember(`Started dating ${o.name}!`, { tag: 'romance', mood: 25, moodDuration: 1440, about: o.name }); p.emote('heart', 3); }
        sim.log(`${sp.name} confessed to ${li.name}... and ${li.name} said yes! ♥`, 'love', [sp, li]);
        sim.toast(`${sp.name} and ${li.name} are now a couple!`);
        return { df: 10, text: D.response('pos', ltone, 'confessYes'), emote: 'heart' };
      }
      sp.remember(`${li.name} turned me down`, { tag: 'romance', mood: -25, moodDuration: 1440, about: li.name });
      sp.changeRel(li.name, -4, -25);
      sp.emote('sad', 2.5);
      sim.log(`${sp.name} confessed feelings to ${li.name}, but ${li.name} doesn't feel the same.`, 'warn', [sp, li]);
      return { df: -3, text: D.response('neg', ltone, 'confessNo'), emote: 'sweat', endsChat: true };
    }

    if (t.topic === 'argue') {
      df = -5 - lt.grumpy * 4;
      special = 'argue'; emote = 'anger'; endsChat = true;
      sp.emote('anger', 2);
      sp.changeRel(li.name, -4); li.changeRel(sp.name, df);
      const until = sim.clock.abs + 180;
      sp.avoid[li.name] = until; li.avoid[sp.name] = until;
      for (const [p, o] of [[sp, li], [li, sp]]) p.remember(`Argued with ${o.name}`, { tag: 'argue', about: o.name, mood: -8, moodDuration: 300 });
      sim.log(`${sp.name} and ${li.name} got into an argument!`, 'warn', [sp, li]);
      return { df, text: D.response('neg', ltone, special), emote, endsChat };
    }

    if (t.topic === 'apology') {
      const yes = v > 0.5;
      df = yes ? 12 : 3;
      sp.changeRel(li.name, yes ? 8 : 2); li.changeRel(sp.name, df);
      if (yes) sim.log(`${sp.name} apologized to ${li.name}, and they made up.`, 'social', [sp, li]);
      return { df, text: D.response('pos', ltone, yes ? 'apologyYes' : 'apologyNo'), emote: yes ? 'heart' : null };
    }

    const valence = v > 0.6 ? 'pos' : v < -0.2 ? 'neg' : 'neu';
    const mult = ['compliment', 'deep', 'sickVisit', 'birthday', 'sharedLove'].includes(t.topic) ? 2 : 1;
    df = (valence === 'pos' ? IS.rand(1, 2.5) : valence === 'neu' ? 0.3 : -IS.rand(2, 4)) * mult;
    if (df > 0) df *= Math.max(0.12, 1 - Math.max(0, rel.friendship) / 115);
    if (valence === 'pos' && rel.friendship > 15 && li.canFallFor(sp.name)) dr = (t.topic === 'flirt' || t.topic === 'deep' || t.topic === 'compliment' ? 4 : 1.5);
    li.changeRel(sp.name, df, dr);
    sp.changeRel(li.name, df * 0.6, dr ? dr * 0.4 : 0);
    if (t.topic === 'sickVisit') {
      li.visitedBy.add(sp.name);
      li.needs.social = Math.min(100, li.needs.social + 25);
      li.addMood(`${sp.name} brought soup`, 12, 600);
      li.remember(`${sp.name} visited me while I was sick`, { tag: 'care', about: sp.name });
      sim.log(`${sp.name} brought soup to ${li.name}.`, 'social', [sp, li]);
      special = 'sickVisit';
    }
    if (t.topic === 'birthday') { special = 'birthday'; li.addMood('Birthday wishes', 6, 600); }
    if (t.topic === 'joke' && valence !== 'neu') special = 'joke';
    if ((t.topic === 'skyhand' || t.topic === 'skyhandSea') && valence !== 'neg') special = t.topic;
    if (t.topic === 'flirt' && dr > 0) special = 'flirtYes';
    if (valence === 'pos') emote = dr > 0 ? 'heart' : df > 3 ? 'heart' : IS.pick(['note', 'note', 'sparkle']);
    if (valence === 'neg') emote = lt.grumpy > 0.5 ? 'anger' : 'sweat';
    if (special === 'skyhand' || special === 'skyhandSea') emote = 'exclaim';
    // Hearing about the Sky Hand changes how the listener feels about it too
    if (t.topic.startsWith('skyhand')) li.skyOpinion = IS.clamp(li.skyOpinion + (lt.brave > 0.6 ? 2 : -2), -100, 100);
    // News spreads: the listener now "knows" it and might gossip about it
    if (t.extra && t.extra.memory && t.topic.startsWith('news:') && Math.random() < 0.5) {
      const m = t.extra.memory;
      li.remember(`Heard from ${sp.name}: ${m.text.toLowerCase()}`, { tag: 'heard', about: sp.name });
    }
    return { df, dr, text: D.response(valence, ltone, special), emote, endsChat };
  };

  return S;
})();
