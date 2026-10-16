// Whispers from the sky: plain-English orders for the selected islander.
//
// parse() reads the sentence the way a person would: who it's addressed to
// ("with/to Lynn"), who it's about ("about Forest"), what to do ("go fishing",
// "flirt", "apologize"), and whether to bring someone along ("go fishing with
// Egg"). If it can't tell, it says so instead of guessing. run() then makes
// the islander do it. They always obey, with an opinion about it.
IS.Command = (() => {
  const C = {};

  // ------------------------------------------------------------ lexicon
  // Each entry: phrases (matched as whole words, in order). Longer phrases win.
  const ACTS = {
    sleep: ['sleep', 'nap', 'take a nap', 'go to bed', 'go to sleep', 'bed', 'rest', 'snooze', 'lie down', 'get some sleep', 'get some rest'],
    eat: ['eat', 'eat something', 'have lunch', 'have breakfast', 'have dinner', 'grab a bite', 'get food', 'get some food', 'snack', 'lunch', 'breakfast', 'food', 'hungry'],
    fish: ['fish', 'fishing', 'go fishing', 'cast a line', 'catch fish', 'catch some fish'],
    garden: ['garden', 'gardening', 'tend the garden', 'farm', 'farming', 'plant', 'plants', 'crops', 'water the plants', 'weed', 'weeding', 'harvest'],
    forage: ['forage', 'foraging', 'mushroom', 'mushrooms', 'berries', 'pick berries', 'gather'],
    chop: ['chop', 'chop wood', 'chopping', 'chop some wood', 'cut wood', 'cut trees', 'wood', 'woodcutting', 'lumber', 'axe'],
    read: ['read', 'reading', 'read a book', 'book', 'study'],
    swim: ['swim', 'swimming', 'go swimming', 'go for a swim', 'take a dip', 'dive', 'go in the water', 'go in the sea'],
    beach: ['beach', 'the beach', 'sunbathe', 'tan', 'lounge', 'chill on the beach', 'relax', 'chill'],
    stargaze: ['stargaze', 'stargazing', 'look at the stars', 'watch the stars', 'stars'],
    plaza: ['plaza', 'the plaza', 'people watch', 'bench'],
    petCat: ['pet the cat', 'play with the cat', 'find the cat', 'cuddle the cat', 'the cat', 'cat', 'kitty'],
    home: ['go home', 'home', 'house', 'go inside', 'inside'],
    wander: ['wander', 'walk', 'go for a walk', 'take a walk', 'explore', 'stroll', 'look around', 'adventure'],
  };
  const ACT_WHAT = { sleep: 'take a nap', eat: 'eat something', fish: 'go fishing', garden: 'tend the garden', forage: 'go foraging', chop: 'chop wood', read: 'read a book', swim: 'go for a swim', beach: 'relax on the beach', stargaze: 'go stargazing', plaza: 'hang out at the plaza', petCat: 'pet the cat', home: 'head home', wander: 'go for a wander' };
  const ACT_GO = { fish: 'fishing', garden: 'gardening', forage: 'foraging', chop: 'chopping wood', read: 'reading', swim: 'swimming', beach: 'to the beach', stargaze: 'stargazing', plaza: 'to the plaza', petCat: 'to see the cat', wander: 'for a walk', eat: 'to eat', sleep: 'to nap', home: 'home' };

  // Social intents that need someone to do it to
  const SOCIAL = {
    confess: ['confess', 'confess to', 'ask out', 'ask them out', 'ask her out', 'ask him out', 'tell them how they feel', 'tell her how he feels', 'tell him how she feels', 'tell how they feel', 'tell how he feels', 'tell how she feels', 'tell how i feel', 'tell them they like', 'say they like', 'you like her', 'you like him', 'you like them', 'you love her', 'you love him', 'i like you', 'i love you', 'likes her', 'likes him', 'loves her', 'loves him', 'have a crush on', 'has a crush on', 'say i love you', 'declare', 'propose', 'admit their feelings', 'admit feelings'],
    flirt: ['flirt', 'flirt with', 'rizz', 'rizz up', 'charm', 'wink', 'hit on', 'make a move', 'make a move on', 'seduce', 'kiss', 'date', 'romance'],
    apology: ['apologize', 'apologise', 'apologize to', 'apology', 'say sorry', 'sorry', 'make up', 'make up with', 'make amends', 'reconcile', 'fix things'],
    argue: ['argue', 'argue with', 'fight', 'pick a fight', 'start a fight', 'yell', 'yell at', 'insult', 'confront', 'beef', 'start drama', 'be mean', 'be mean to', 'scream at'],
    roast: ['roast', 'tease', 'mock', 'make fun of', 'clown', 'clown on', 'diss'],
    compliment: ['compliment', 'praise', 'be nice', 'be nice to', 'hype up', 'hype', 'hug', 'encourage', 'say something nice', 'say something nice to', 'flatter'],
    joke: ['joke', 'tell a joke', 'tell a joke to', 'make laugh', 'make them laugh', 'something funny', 'pun'],
    comfort: ['comfort', 'console', 'cheer up', 'check on', 'make feel better', 'support'],
    thanks: ['thank', 'thanks', 'say thanks', 'say thank you'],
    teach: ['learn from', 'learn how to', 'ask to teach', 'to teach', 'teach me', 'teach him', 'teach her', 'get lessons from', 'get a lesson from', 'lessons'],
    invite: ['invite', 'ask to come', 'take', 'bring', 'go with', 'come with', 'ask to join', 'join'],
    talk: ['talk', 'talk to', 'talk with', 'chat', 'chat with', 'speak', 'speak to', 'speak with', 'visit', 'say hi', 'say hello', 'hello', 'greet', 'hang out', 'hang out with', 'go see', 'see', 'find', 'meet', 'call', 'catch up', 'catch up with', 'go to', 'go talk to', 'ask', 'tell', 'hang with', 'spend time with'],
  };
  // "about ___" topics that aren't people
  const ABOUT = {
    weather: ['weather', 'the weather', 'rain', 'the rain', 'storm', 'the storm', 'fog', 'sun'],
    eventSoon: ['dinner', 'the dinner', 'friday dinner', 'party', 'the party', 'bonfire', 'the bonfire', 'picnic', 'the picnic', 'contest', 'the contest', 'event', 'the event', 'story night'],
    cat: ['cat', 'the cat', 'cats', 'biscuit', 'kitty'],
    dream: ['dream', 'dreams', 'a dream', 'their dream', 'last night'],
    future: ['future', 'the future', 'life', 'goals', 'their goals', 'life goals', 'what they want in life'],
    tease: ['crush', 'their crush', 'love life', 'their love life', 'romance', 'who they like'],
    catchphrase: ['plan', 'the plan', 'a plan', 'plans', 'scheme', 'a scheme'],
    food: ['food', 'pizza', 'cooking', 'what to eat'],
    pantry: ['pantry', 'the pantry', 'food supply'],
    mystery: ['mystery', 'mysteries', 'the island', 'island', 'the lighthouse', 'lighthouse', 'history'],
    skyhand: ['sky hand', 'the sky hand', 'the hand', 'flying', 'the sky'],
    activity: ['their day', 'day', 'what they did', 'what they have been doing', 'work'],
    question: ['anything', 'stuff', 'something', 'random stuff', 'life stuff'],
    deep: ['feelings', 'deep stuff', 'meaning of life', 'the meaning of life'],
    joke: ['jokes', 'something funny'],
    gossip: ['gossip', 'drama', 'the drama', 'news', 'the news', 'rumors', 'rumours', 'what happened'],
  };
  const GOSSIP_BAD = ['trash talk', 'talk trash', 'talk smack', 'complain', 'complain about', 'vent', 'vent about', 'badmouth', 'spill tea', 'spill the tea', 'gossip', 'gossip about', 'rant', 'rant about', 'moan', 'whine', 'be mean about'];
  const GOSSIP_GOOD = ['say nice things about', 'say good things about', 'praise', 'hype up', 'talk up', 'brag about', 'put in a good word', 'put in a good word for'];
  const STOP = ['stop', 'stay', 'wait', 'freeze', 'stand still', 'stay put', 'do nothing', 'chill out', 'cancel', 'quit', 'idle', 'pause'];

  const FILLER = /\b(please|pls|plz|now|right now|go ahead and|can you|could you|would you|i want you to|you should|you need to|let's|lets|ok|okay|just|maybe|quickly|immediately|for me|actually|really|then)\b/g;

  // ------------------------------------------------------------ helpers
  const norm = s => ' ' + s.toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/\bwanna\b/g, 'want to').replace(/\bgonna\b/g, 'going to').replace(/\bgotta\b/g, 'have to')
    .replace(/\b(don't|dont|do not|stop|quit|no more)\s+(going\s+)?/g, m => ' not ')
    .replace(/[^a-z' ]/g, ' ').replace(/'s\b/g, '').replace(/'/g, '')
    .replace(FILLER, ' ').replace(/\s+/g, ' ').trim() + ' ';

  // Longest phrase in the list found in the text, with its position
  const find = (text, phrases) => {
    let best = null;
    for (const ph of phrases) {
      const re = new RegExp(`(^| )${ph.replace(/ /g, ' (?:\\w+ )?')}( |$)`);
      const m = re.exec(text);
      if (m && (!best || ph.length > best.ph.length)) best = { ph, at: m.index, len: ph.split(' ').length };
    }
    return best;
  };
  const scoreAll = (text, table) => {
    const out = [];
    for (const [k, phrases] of Object.entries(table)) { const f = find(text, phrases); if (f) out.push({ k, ...f }); }
    // Vague words ('relax', 'walk', 'food') lose to specific ones ('home', 'beach', 'fishing')
    const WEAK = new Set(['relax', 'chill', 'rest', 'food', 'hungry', 'book', 'bed', 'wood', 'plant', 'plants', 'see', 'find', 'tell', 'ask', 'take', 'bring', 'join', 'call', 'meet']);
    return out.sort((a, b) => (WEAK.has(a.ph) - WEAK.has(b.ph)) || b.len - a.len || a.at - b.at);
  };

  const PLACES = new Set(['beach']);

  // ------------------------------------------------------------ parse
  // Returns { kind: 'act'|'actWith'|'social'|'stop'|'unknown'|'needWho', ... , what }
  C.parse = (raw, actor, people) => {
    let text = norm(raw || '');
    if (!text.trim()) return { kind: 'unknown', reason: 'empty' };
    const others = people.filter(o => o !== actor);
    // Drop "tell Iroh to ..." / "Iroh, ..." aimed at the islander themself
    const me = actor.name.toLowerCase();
    text = text.replace(new RegExp(`^ ?(tell|make|have|get|ask) ${me} (to )?`), ' ').replace(new RegExp(`^ ?${me} `), ' ').replace(new RegExp(` ${me} `, 'g'), ' ').replace(/\s+/g, ' ');
    if (!text.endsWith(' ')) text += ' ';
    const negated = /(^| )not /.test(text);

    // People mentioned, and their role from the word before them
    const mentions = [];
    for (const o of others) {
      const re = new RegExp(`(\\w+ )?(\\w+ )?${o.name.toLowerCase()}( |$)`, 'g');
      let m;
      while ((m = re.exec(text))) {
        const w1 = (m[2] || '').trim(), w2 = (m[1] || '').trim();
        // A name that's also a place ("the beach"): only a person if capitalised mid-sentence and not after "the"
        if (PLACES.has(o.name.toLowerCase())) {
          const capital = new RegExp(`(^|[^.!?]\\s)${o.name}\\b`).test(raw.trim().replace(/^\\S+/, ''));
          const startCap = new RegExp(`^${o.name}\\b`).test(raw.trim());
          const socialBefore = ['with', 'about', 'of', 'regarding', 'flirt', 'roast', 'hug', 'kiss', 'tease', 'diss', 'compliment', 'console', 'comfort', 'thank', 'ask', 'tell', 'visit', 'find', 'meet', 'invite'].includes(w1) || (w1 === 'to' && ['talk', 'apologize', 'apologise', 'sorry', 'confess', 'hi', 'hello', 'nice', 'mean', 'speak', 'up'].includes(w2));
          if (['the', 'a'].includes(w1) || !(capital || startCap || socialBefore)) continue;
        }
        let role = 'target';
        if (['about', 'on', 'regarding', 'of'].includes(w1) || (w1 === 'for' && /good word/.test(text))) role = 'subject';
        else if (w1 === 'with' && w2 && !['talk', 'chat', 'speak', 'hang', 'flirt', 'argue', 'out', 'up', 'fight', 'catch', 'time', 'make', 'be'].includes(w2)) role = 'companion';
        mentions.push({ p: o, role, at: m.index + (m[0].length - o.name.length - 1) });
      }
    }
    mentions.sort((a, b) => a.at - b.at);
    const cat = people[0] && people[0].sim && people[0].sim.cat ? people[0].sim.cat.name.toLowerCase() : 'biscuit';
    text = text.replace(new RegExp(` ${cat} `, 'g'), ' cat ');

    let target = (mentions.find(m => m.role === 'target') || {}).p || null;
    const subject = (mentions.find(m => m.role === 'subject') || {}).p || null;
    let companion = (mentions.find(m => m.role === 'companion') || {}).p || null;
    // "talk to Lynn about Forest": first named is who, "about" is what
    const extraTargets = mentions.filter(m => m.role === 'target').slice(1).map(m => m.p);

    // Look for activities and verbs with the people's names taken out
    let plain = text;
    for (const m of mentions) plain = plain.replace(new RegExp(` ${m.p.name.toLowerCase()} `), ' someone ');
    const acts = scoreAll(plain, ACTS);
    const socials = scoreAll(text, SOCIAL);
    const aboutAt = text.indexOf(' about ');
    const aboutText = aboutAt >= 0 ? text.slice(aboutAt + 6) : '';
    const abouts = aboutText ? scoreAll(' ' + aboutText, ABOUT) : [];
    let bad = find(text, GOSSIP_BAD), good = find(text, GOSSIP_GOOD);
    const stop = find(text, STOP);

    if (negated && !socials.find(s => s.k !== 'talk') || (stop && !acts.length && !socials.length && !target)) return { kind: 'stop', what: 'stay put' };

    // A person to deal with, and no activity to do with them
    const socialIntent = socials.find(s => s.k !== 'talk' && s.k !== 'invite' && s.k !== 'teach');
    const invite = socials.find(s => s.k === 'invite');
    const actNoCat = acts.filter(a => !(a.k === 'petCat' && (subject || abouts.length)));
    const act = actNoCat[0] || null;
    if (!act && companion) { if (!target) target = companion; else extraTargets.unshift(companion); companion = null; }

    // "ask Egg to teach me fishing", "learn fishing from Egg"
    if (socials.find(s => s.k === 'teach') && target) {
      const love = act ? (IS.Actions[act.k] && IS.Actions[act.k].love) : target.loves.find(l => !['chatting', 'napping', 'cats', 'cooking'].includes(l));
      if (love) return { kind: 'social', topic: 'teach', target, extra: { teachLove: love }, what: `learn ${IS.Dialogue.activityWord[love] || love} from ${target.name}` };
    }
    // "tell Forest to go fishing", "ask Egg to come swimming": suggest it to them in person
    if (act && target && !socialIntent && !subject && new RegExp(`(tell|ask|convince|get|persuade) ${target.name.toLowerCase()} to `).test(text) && ['fish', 'swim', 'beach', 'stargaze', 'wander', 'garden', 'forage', 'read', 'petCat'].includes(act.k)) {
      return { kind: 'social', topic: 'hangout', target, extra: { hangDef: act.k }, what: `ask ${target.name} to go ${ACT_GO[act.k]} together` };
    }
    // Bring someone along: "go fishing with Egg", "invite Egg to the beach", "take Egg swimming"
    if (act && (companion || (target && (invite || /( with | take | bring | invite )/.test(text)))) && !socialIntent && !subject && aboutAt < 0) {
      const friend = companion || target;
      if (['sleep', 'eat', 'home'].includes(act.k) && !invite) return { kind: 'act', act: act.k, what: ACT_WHAT[act.k] };
      return { kind: 'actWith', act: act.k, with: friend, what: `go ${ACT_GO[act.k]} with ${friend.name}` };
    }
    // Sharing an opinion: "tell Lynn what you think of Forest" is telling, not asking
    const share = /\b(tell|let|show)\b.*\b(what you think|how you feel|what you feel|your opinion|your thoughts|your take)\b|\bshare your (opinion|thoughts|take)\b/.test(text);
    if (share && subject && !bad && !good) {
      const rel = actor.relTo ? actor.relTo(subject.name) : null;
      if (rel && (rel.friendship < 0)) bad = ['share']; else good = ['share'];
    }
    // Gossip: "trash talk Forest to Lynn", "say nice things about Egg to Jude"
    if ((bad || good) && (subject || (target && extraTargets.length) || (target && /\bto\b/.test(text) === false && !socialIntent))) {
      let subj = subject, who = target;
      if (!subj && target && extraTargets.length) { subj = target; who = extraTargets[0]; }
      if (!subj && target && !extraTargets.length) { subj = target; who = null; }
      if (who === subj) who = null;
      if (!who) who = C.confidant(actor, others, subj);
      if (!who) return { kind: 'needWho', what: 'gossip', reason: 'nobody to gossip with' };
      const topic = good && !bad ? 'gossipGood' : 'gossipBad';
      return { kind: 'social', topic, target: who, extra: { third: subj }, what: share ? `tell ${who.name} what they think of ${subj.name}` : `${topic === 'gossipGood' ? 'say nice things about' : 'gossip about'} ${subj.name} with ${who.name}` };
    }
    // Asking someone about someone else
    if (subject && !socialIntent) {
      let who = target;
      if (!who || who === subject) who = C.confidant(actor, others, subject);
      if (!who) return { kind: 'needWho', what: 'talk', reason: 'nobody to ask' };
      return { kind: 'social', topic: 'askAbout', target: who, extra: { subject }, what: `ask ${who.name} what they think of ${subject.name}` };
    }
    if (socialIntent) {
      if (!target && subject) target = subject;
      if (!target) return { kind: 'needWho', what: socialIntent.k, reason: `${socialIntent.ph} who?` };
      const topic = socialIntent.k === 'comfort' ? 'comfort' : socialIntent.k;
      const words = { confess: 'confess to', flirt: 'flirt with', apology: 'apologize to', argue: 'pick a fight with', roast: 'roast', compliment: 'compliment', joke: 'tell a joke to', comfort: 'cheer up', thanks: 'thank' };
      return { kind: 'social', topic, target, extra: {}, what: `${words[topic]} ${target.name}` };
    }
    // "ask Egg to teach me fishing", "learn fishing from Egg"
    if (socials.find(s => s.k === 'teach') && target) {
      const love = act ? (IS.Actions[act.k] && IS.Actions[act.k].love) : target.loves.find(l => !['chatting', 'napping', 'cats', 'cooking'].includes(l));
      if (love) return { kind: 'social', topic: 'teach', target, extra: { teachLove: love }, what: `learn ${IS.Dialogue.activityWord[love] || love} from ${target.name}` };
    }
    // "talk to Egg about the cat", "chat with Lynn"
    if (target) {
      if (abouts.length) {
        let k = abouts[0].k;
        if (k === 'catchphrase' && actor.name !== 'Iroh') k = 'plans';
        if (k === 'gossip') k = 'rumor';
        if (k === 'joke') return { kind: 'social', topic: 'joke', target, extra: {}, what: `tell ${target.name} a joke` };
        const nice = { weather: 'the weather', eventSoon: 'the next event', cat: 'the cat', dream: 'dreams', future: 'the future', tease: `${target.name}'s crush`, catchphrase: 'the plan', plans: 'plans', food: 'food', pantry: 'the pantry', mystery: 'the island\'s mysteries', skyhand: 'the Sky Hand', activity: 'their day', question: 'anything', deep: 'deep stuff', rumor: 'the latest news' };
        return { kind: 'social', topic: k, target, extra: {}, what: `talk to ${target.name} about ${nice[k] || k}` };
      }
      if (act && aboutAt >= 0) {
        const love = IS.Actions[act.k] && IS.Actions[act.k].love;
        const topic = love && target.loves.includes(love) && !actor.loves.includes(love) ? 'teach' : 'sharedLove';
        return { kind: 'social', topic, target, extra: topic === 'teach' ? { teachLove: love } : {}, what: `talk to ${target.name} about ${ACT_GO[act.k] || act.k}` };
      }
      if (act && !socials.length) return { kind: 'actWith', act: act.k, with: target, what: `go ${ACT_GO[act.k]} with ${target.name}` };
      return { kind: 'social', topic: null, target, extra: {}, what: `go talk to ${target.name}` };
    }
    if (act) return { kind: 'act', act: act.k, what: ACT_WHAT[act.k] };
    if (socials.find(s => s.k === 'talk') || abouts.length) return { kind: 'needWho', what: 'talk', reason: 'talk to who?' };
    if (stop) return { kind: 'stop', what: 'stay put' };
    return { kind: 'unknown', reason: 'no idea' };
  };

  // Who to talk to about someone, if you didn't say: a close friend who isn't them
  C.confidant = (actor, others, about) => {
    const list = others.filter(o => o !== about).sort((a, b) => actor.relTo(b.name).friendship - actor.relTo(a.name).friendship);
    return list[0] || null;
  };

  C.suggestions = p => {
    const others = p.sim.people.filter(o => o !== p);
    const crush = others.filter(o => p.canFallFor(o.name)).sort((a, b) => p.relTo(b.name).romance - p.relTo(a.name).romance)[0];
    const rival = others.slice().sort((a, b) => p.relTo(a.name).friendship - p.relTo(b.name).friendship)[0];
    const bff = others.slice().sort((a, b) => p.relTo(b.name).friendship - p.relTo(a.name).friendship)[0];
    const s = ['Take a nap', `Go fishing with ${bff.name}`];
    if (crush) s.push(`Ask ${bff === crush ? IS.pick(others.filter(o => o !== crush)).name : bff.name} about ${crush.name}`);
    if (crush) s.push(`Flirt with ${crush.name}`);
    if (rival && p.relTo(rival.name).friendship < 0) s.push(`Apologize to ${rival.name}`);
    else s.push(`Tell ${IS.pick(others).name} a joke`);
    return s.slice(0, 5);
  };

  const WORK = new Set(['fish', 'garden', 'forage', 'chop']);
  const HELP = 'Try: "go fishing", "take a nap", "go swimming with Egg", "flirt with Lynn", "ask Jude about Beach", "apologize to Forest", "talk to Egg about the cat".';

  // ------------------------------------------------------------ run
  // Returns { ok, text } describing what happened, for the HUD.
  C.run = (sim, p, raw) => {
    if (!(raw || '').trim()) return { ok: false, text: 'Type something for them to do.' };
    if (p.mode !== 'normal') { p.say(IS.pick(['I am literally in the air right now.', 'Kinda busy being flung?!'])); return { ok: false, text: `${p.name} can't do anything while the Sky Hand has them.` }; }
    const order = C.parse(raw, p, sim.people);

    if (order.kind === 'unknown') {
      p.emote('question', 1.8);
      p.say(IS.pick(['...Huh?', 'I don\'t know how to do that.', 'Was that the sky talking? What?']));
      return { ok: false, text: `${p.name} didn't understand. ${HELP}` };
    }
    if (order.kind === 'needWho') {
      p.emote('question', 1.8);
      p.say(IS.pick(['With who?', 'Who, though?', '...To who?']));
      return { ok: false, text: `${p.name} needs a name. For example: "${order.what === 'talk' ? 'talk to Lynn' : order.what + ' ' + (order.what === 'flirt' ? 'with ' : order.what === 'apology' ? 'to ' : '') + 'Lynn'}".` };
    }
    if (p.sick && !(order.kind === 'act' && (order.act === 'sleep' || order.act === 'eat'))) {
      p.say('I\'m sick... can it wait?'); p.emote('sad', 1.6);
      return { ok: false, text: `${p.name} has a cold and is staying in bed. Rest or food only.` };
    }
    const who = order.target || order.with;
    if (who && who.sick && order.kind !== 'social') return { ok: false, text: `${who.name} is sick in bed right now.` };

    const wasAsleep = p.pose === 'sleep';
    if (p.chat) p.chat.end(true);
    p.cancelAction();
    p.idleUntil = 0;

    let ok = false, note = '';
    if (order.kind === 'stop') {
      p.idleUntil = sim.clock.abs + 30;
      p.thought = 'The sky told me to stay put. So... I\'m staying.';
      ok = true;
    } else if (order.kind === 'social') {
      ok = IS.Social.approach(sim, p, order.target, order.topic, true, order.extra);
    } else {
      const def = IS.Actions[order.act];
      p.noAutoInvite = order.kind === 'actWith';
      ok = p.startAction(def, sim.clock);
      p.noAutoInvite = false;
      if (ok) {
        p.action.forced = true;
        p.thought = `A voice from the sky told me to ${order.what}.`;
        if (order.kind === 'actWith') {
          const f = order.with;
          if (IS.Mind.available(f, p) && IS.Mind.join(sim, f, p, def)) {
            p.action.with = f.name;
            f.action.forced = true;
            setTimeout(() => { if (!f.chat) f.say(IS.pick(['Coming!', 'Wait up!', 'Okay, okay, I\'m coming.'])); }, 1000);
          } else note = ` ${f.name} is busy, so ${p.name} went alone.`;
        }
      }
    }
    if (!ok) {
      p.say(IS.pick(['I can\'t get there right now.', 'There\'s no room for me.', 'Not possible right now, sorry.']));
      return { ok: false, text: `${p.name} couldn't ${order.what} right now (no free spot or no way there).` };
    }
    const line = C.reaction(p, order, wasAsleep);
    p.say(line);
    if (!p.heardSky) {
      p.heardSky = true;
      p.emote('exclaim', 2);
      p.skyOpinion = IS.clamp(p.skyOpinion + (p.traits.brave > 0.6 ? 6 : -4), -100, 100);
      p.remember('Heard a voice from the sky', { tag: 'sky', news: true });
    }
    sim.log(`The sky told ${p.name} to ${order.what}.`, 'sky', [p]);
    return { ok: true, text: `${p.name} will ${order.what}.${note} “${line}”` };
  };

  C.reaction = (p, order, wasAsleep) => {
    const t = p.traits;
    if (!p.heardSky) return IS.pick(['WHO SAID THAT?!', 'Did... the sky just talk to me?', 'Okay. Okay. The sky talks now. Cool.']);
    if (wasAsleep) return t.grumpy > 0.3 ? 'I was SLEEPING. Fine.' : 'Mmh... okay, okay, I\'m up.';
    if (order.kind === 'social') {
      const r = p.relTo(order.target.name);
      const s = order.extra && (order.extra.subject || order.extra.third);
      if (order.topic === 'askAbout') return IS.pick([`What does ${order.target.name} think of ${s.name}? Ooh, good question.`, 'Investigating. On it.', `Okay, but if ${s.name} finds out, it was the sky's idea.`]);
      if (order.topic === 'gossipBad') return t.kind > 0.7 ? `I don't love talking about ${s.name} behind their back...` : 'Oh, I have THOUGHTS.';
      if (order.topic === 'gossipGood') return `${s.name} deserves it, honestly.`;
      if (order.topic === 'confess') return r.romance > 40 ? 'Oh no. Okay. Deep breaths.' : `Confess? To ${order.target.name}?? Uh...`;
      if (order.topic === 'flirt') return r.romance > 30 ? 'Say less.' : `Flirt with ${order.target.name}? ...If you insist.`;
      if (order.topic === 'apology') return t.kind > 0.6 ? 'Yeah. I owe them that.' : 'Ugh. Fine. I\'ll say sorry.';
      if (order.topic === 'argue') return t.kind > 0.7 ? 'I really don\'t want to fight...' : 'Oh, gladly.';
      if (order.topic === 'roast') return p.cfg.humor === 'roast' ? 'Oh, I\'ve been WAITING for this.' : 'Okay, let me cook.';
      if (order.topic === 'teach') return 'Lessons! I\'m going to be so good at this.';
      return r.friendship > 40 ? `Yeah, I miss ${order.target.name}.` : r.friendship < -10 ? `${order.target.name}? Really?` : 'Sure, why not.';
    }
    if (order.kind === 'stop') return 'Standing still. Weird, but okay.';
    if (order.kind === 'actWith') return IS.pick([`${order.with.name}! Come on, we're going.`, 'Field trip!', 'Okay, but you\'re coming too.']);
    const def = IS.Actions[order.act];
    const love = def.love && p.loves.includes(def.love), hate = def.love && p.hates.includes(def.love);
    if (love) return IS.pick(['Say less!', 'Oh, gladly!', 'You read my mind.']);
    if (hate) return t.grumpy > 0.3 ? 'Seriously? ...FINE.' : 'Ugh. I hate this. Okay.';
    if (WORK.has(order.act) && t.hardworking < 0.3) return IS.pick(['Do I have to? ...Fine.', 'Work? Me? Okay...', 'This is so not my thing.']);
    return IS.pick(['On it.', 'Sure thing.', 'Okay, okay.']);
  };

  return C;
})();
