// Whispers from the sky: plain-English orders for the selected islander.
// A small keyword parser maps the text onto real activities or a
// conversation with someone. They always obey, but how they feel about
// it depends on who they are and what you asked.
IS.Command = (() => {
  const C = {};

  const ACTIVITIES = [
    { id: 'sleep', words: ['sleep', 'nap', 'bed', 'rest', 'snooze'], what: 'take a nap' },
    { id: 'eat', words: ['eat', 'food', 'snack', 'lunch', 'dinner', 'breakfast', 'hungry'], what: 'eat something' },
    { id: 'fish', words: ['fish', 'fishing', 'rod', 'dock'], what: 'go fishing' },
    { id: 'garden', words: ['garden', 'farm', 'plant', 'crops', 'water the'], what: 'tend the garden' },
    { id: 'forage', words: ['forage', 'mushroom', 'berries', 'berry', 'gather'], what: 'go foraging' },
    { id: 'chop', words: ['chop', 'wood', 'axe', 'lumber', 'tree'], what: 'chop wood' },
    { id: 'read', words: ['read', 'book', 'study'], what: 'read a book' },
    { id: 'swim', words: ['swim', 'swimming', 'dive', 'ocean', 'sea'], what: 'go for a swim' },
    { id: 'beach', words: ['beach', 'tan', 'sunbathe', 'chill', 'relax', 'lounge'], what: 'relax on the beach' },
    { id: 'stargaze', words: ['star', 'stars', 'stargaze', 'sky'], what: 'go stargazing' },
    { id: 'plaza', words: ['plaza', 'bench', 'people watch', 'hang out'], what: 'hang out at the plaza' },
    { id: 'petCat', words: ['cat', 'kitty', 'biscuit', 'pet '], what: 'pet the cat' },
    { id: 'home', words: ['home', 'house', 'inside', 'go back'], what: 'head home' },
    { id: 'wander', words: ['wander', 'walk', 'explore', 'stroll', 'adventure'], what: 'go for a wander' },
  ];

  const SOCIAL = [
    { topic: 'confess', words: ['confess', 'ask out', 'date', 'feelings', 'love you', 'propose'], what: 'confess to' },
    { topic: 'flirt', words: ['flirt', 'rizz', 'charm', 'wink'], what: 'flirt with' },
    { topic: 'apology', words: ['apolog', 'sorry', 'make up', 'forgive'], what: 'apologize to' },
    { topic: 'argue', words: ['argue', 'fight', 'yell', 'insult', 'beef'], what: 'pick a fight with' },
    { topic: 'roast', words: ['roast', 'tease', 'mock', 'clown'], what: 'roast' },
    { topic: 'compliment', words: ['compliment', 'praise', 'nice to', 'hype', 'hug'], what: 'compliment' },
    { topic: 'joke', words: ['joke', 'funny', 'make them laugh', 'laugh'], what: 'tell a joke to' },
    { topic: 'gossipGood', words: ['gossip', 'tea', 'rumor', 'rumour'], what: 'gossip with' },
    { topic: null, words: ['talk', 'chat', 'speak', 'visit', 'say hi', 'hello', 'hang', 'go to', 'find', 'see'], what: 'go talk to' },
  ];

  const WORK = new Set(['fish', 'garden', 'forage', 'chop']);
  const has = (text, words) => words.some(w => text.includes(w));

  C.suggestions = p => {
    const others = p.sim.people.filter(o => o !== p);
    const crush = others.filter(o => p.canFallFor(o.name)).sort((a, b) => p.relTo(b.name).romance - p.relTo(a.name).romance)[0];
    const rival = others.slice().sort((a, b) => p.relTo(a.name).friendship - p.relTo(b.name).friendship)[0];
    const s = ['Take a nap', 'Go fishing', 'Swim'];
    if (crush) s.push(`Flirt with ${crush.name}`);
    if (rival && p.relTo(rival.name).friendship < 0) s.push(`Apologize to ${rival.name}`);
    else s.push(`Talk to ${IS.pick(others).name}`);
    s.push('Chop wood');
    return s.slice(0, 5);
  };

  // Returns { ok, text } describing what happened, for the HUD.
  C.run = (sim, p, raw) => {
    const text = ' ' + raw.toLowerCase().replace(/[^a-z' ]/g, ' ').replace(/\s+/g, ' ') + ' ';
    if (!text.trim()) return { ok: false, text: 'Type something for them to do.' };
    if (p.mode !== 'normal') { p.say(IS.pick(['I am literally in the air right now.', 'Kinda busy being flung?!'])); return { ok: false, text: `${p.name} can't do anything while the Sky Hand has them.` }; }

    const target = sim.people.find(o => o !== p && new RegExp(`\\b${o.name.toLowerCase()}\\b`).test(text));
    const self = new RegExp(`\\b${p.name.toLowerCase()}\\b`).test(text) && !target;

    let order = null;
    if (target) {
      const soc = SOCIAL.find(s => has(text, s.words)) || SOCIAL[SOCIAL.length - 1];
      order = { kind: 'social', topic: soc.topic, target, what: `${soc.what} ${target.name}` };
    } else if (has(text, [' stop', ' stay', ' wait', ' freeze', ' idle', 'stand still', 'chill out'])) {
      order = { kind: 'stop', what: 'stay put' };
    } else {
      const act = ACTIVITIES.find(a => has(text, a.words));
      if (act) order = { kind: 'act', id: act.id, what: act.what };
    }
    if (!order) {
      p.emote('question', 1.8);
      p.say(IS.pick(['...Huh?', 'I don\'t know how to do that.', 'Was that the sky talking? What?']));
      return { ok: false, text: `Didn't catch that${self ? '' : ''}. Try an activity (fish, nap, swim, read, chop wood, beach) or a person (talk to, flirt with, apologize to, roast).` };
    }

    if (p.sick && !(order.kind === 'act' && (order.id === 'sleep' || order.id === 'eat'))) {
      p.say('I\'m sick... can it wait?'); p.emote('sad', 1.6);
      return { ok: false, text: `${p.name} has a cold and is staying in bed. Rest or food only.` };
    }
    if (order.kind === 'social' && order.target.sick) {
      return { ok: false, text: `${order.target.name} is sick in bed. Try “visit” once they're up.` };
    }

    // Wake up, drop the conversation, drop the current task
    const wasAsleep = p.pose === 'sleep';
    if (p.chat) p.chat.end(true);
    p.cancelAction();
    p.idleUntil = 0;

    let ok = false;
    if (order.kind === 'stop') {
      p.idleUntil = sim.clock.abs + 30;
      p.thought = 'The sky told me to stay put. So... I\'m staying.';
      ok = true;
    } else if (order.kind === 'social') {
      ok = IS.Social.approach(sim, p, order.target, order.topic, true);
    } else {
      const def = IS.Actions[order.id];
      ok = p.startAction(def, sim.clock);
      if (ok) {
        p.action.forced = true;
        p.thought = `A voice from the sky told me to ${order.what}. ${p.action.def.thought ? p.action.def.thought(p, p.action, sim.clock) : ''}`;
      }
    }
    if (!ok) {
      p.say(IS.pick(['I can\'t get there right now.', 'There\'s no room for me.', 'Not possible right now, sorry.']));
      return { ok: false, text: `${p.name} couldn't ${order.what} right now (no free spot or no way there).` };
    }

    // How they feel about it
    const line = C.reaction(p, order, wasAsleep);
    p.say(line);
    if (!p.heardSky) {
      p.heardSky = true;
      p.emote('exclaim', 2);
      p.skyOpinion = IS.clamp(p.skyOpinion + (p.traits.brave > 0.6 ? 6 : -4), -100, 100);
      p.remember('Heard a voice from the sky', { tag: 'sky', news: true });
    }
    sim.log(`The sky told ${p.name} to ${order.what}.`, 'sky', [p]);
    return { ok: true, text: `${p.name}: “${line}”` };
  };

  C.reaction = (p, order, wasAsleep) => {
    const t = p.traits;
    if (!p.heardSky) return IS.pick(['WHO SAID THAT?!', 'Did... the sky just talk to me?', 'Okay. Okay. The sky talks now. Cool.']);
    if (wasAsleep) return t.grumpy > 0.3 ? 'I was SLEEPING. Fine.' : 'Mmh... okay, okay, I\'m up.';
    if (order.kind === 'social') {
      const r = p.relTo(order.target.name);
      if (order.topic === 'confess') return r.romance > 40 ? 'Oh no. Okay. Deep breaths.' : `Confess? To ${order.target.name}?? Uh...`;
      if (order.topic === 'flirt') return r.romance > 30 ? 'Say less.' : `Flirt with ${order.target.name}? ...If you insist.`;
      if (order.topic === 'apology') return t.kind > 0.6 ? 'Yeah. I owe them that.' : 'Ugh. Fine. I\'ll say sorry.';
      if (order.topic === 'argue') return t.kind > 0.7 ? 'I really don\'t want to fight...' : 'Oh, gladly.';
      if (order.topic === 'roast') return p.cfg.humor === 'roast' ? 'Oh, I\'ve been WAITING for this.' : 'Okay, let me cook.';
      return r.friendship > 40 ? `Yeah, I miss ${order.target.name}.` : r.friendship < -10 ? `${order.target.name}? Really?` : 'Sure, why not.';
    }
    if (order.kind === 'stop') return 'Standing still. Weird, but okay.';
    const def = IS.Actions[order.id];
    const love = def.love && p.loves.includes(def.love), hate = def.love && p.hates.includes(def.love);
    if (love) return IS.pick(['Say less!', 'Oh, gladly!', 'You read my mind.']);
    if (hate) return t.grumpy > 0.3 ? 'Seriously? ...FINE.' : 'Ugh. I hate this. Okay.';
    if (WORK.has(order.id) && t.hardworking < 0.3) return IS.pick(['Do I have to? ...Fine.', 'Work? Me? Okay...', 'This is so not my thing.']);
    return IS.pick(['On it.', 'Sure thing.', 'Okay, okay.']);
  };

  return C;
})();
