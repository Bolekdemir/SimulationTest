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
    pray: ['pray', 'pray to the sky', 'worship', 'worship the sky', 'say a prayer'],
    beachcomb: ['beachcomb', 'beachcombing', 'collect shells', 'look for shells', 'find shells', 'shells', 'shell hunting', 'search the beach'],
    sandcastle: ['sandcastle', 'build a sandcastle', 'make a sandcastle', 'sand castle', 'build a sand castle'],
    bugs: ['catch bugs', 'bug catching', 'bugs', 'catch butterflies', 'butterflies', 'catch fireflies', 'fireflies', 'insects'],
    paint: ['paint', 'painting', 'go paint', 'draw', 'drawing', 'make art', 'paint a picture'],
    guitar: ['guitar', 'play guitar', 'play the guitar', 'play music', 'play a song', 'jam', 'music'],
    workout: ['work out', 'workout', 'exercise', 'push ups', 'pushups', 'lift', 'train', 'get swole', 'gym'],
    jog: ['jog', 'jogging', 'go for a run', 'go running', 'run laps', 'run around the island'],
    kite: ['kite', 'fly a kite', 'kite flying'],
    digTreasure: ['dig for treasure', 'dig up the treasure', 'find the treasure', 'treasure', 'dig'],
  };
  const ACT_WHAT = { sleep: 'take a nap', eat: 'eat something', fish: 'go fishing', garden: 'tend the garden', forage: 'go foraging', chop: 'chop wood', read: 'read a book', swim: 'go for a swim', beach: 'relax on the beach', stargaze: 'go stargazing', plaza: 'hang out at the plaza', petCat: 'pet the cat', home: 'head home', wander: 'go for a wander', pray: 'pray to the sky', beachcomb: 'look for shells', sandcastle: 'build a sandcastle', bugs: 'catch bugs', paint: 'paint a picture', guitar: 'play guitar', workout: 'work out', jog: 'go for a jog', kite: 'fly a kite', digTreasure: 'dig for treasure' };
  const ACT_GO = { fish: 'fishing', garden: 'gardening', forage: 'foraging', chop: 'chopping wood', read: 'reading', swim: 'swimming', beach: 'to the beach', stargaze: 'stargazing', plaza: 'to the plaza', petCat: 'to see the cat', wander: 'for a walk', eat: 'to eat', sleep: 'to nap', home: 'home', pray: 'to pray', beachcomb: 'beachcombing', sandcastle: 'to build a sandcastle', bugs: 'bug catching', paint: 'painting', guitar: 'to play guitar', workout: 'to work out', jog: 'jogging', kite: 'kite flying', digTreasure: 'treasure hunting' };

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
          const socialBefore = ['with', 'about', 'of', 'regarding', 'flirt', 'roast', 'hug', 'kiss', 'tease', 'diss', 'compliment', 'console', 'comfort', 'thank', 'ask', 'tell', 'visit', 'find', 'meet', 'invite', 'avoid', 'ignore', 'dump'].includes(w1) || (w1 === 'to' && ['talk', 'apologize', 'apologise', 'sorry', 'confess', 'hi', 'hello', 'nice', 'mean', 'speak', 'up', 'feelings', 'something', 'love', 'joke', 'secret'].includes(w2));
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
      if (/\bhang (out )?with\b|\bspend time with\b/.test(text)) {
        const love = actor.loves.find(l => target.loves.includes(l) && IS.Talk.hangFor && IS.Talk.hangFor(l));
        if (love) return { kind: 'social', topic: 'hangout', target, extra: { hangDef: IS.Talk.hangFor(love) }, what: `hang out with ${target.name}` };
      }
      return { kind: 'social', topic: null, target, extra: {}, what: `go talk to ${target.name}` };
    }
    if (act) return { kind: 'act', act: act.k, what: ACT_WHAT[act.k] };
    if (socials.find(s => s.k === 'talk') || abouts.length) return { kind: 'needWho', what: 'talk', reason: 'talk to who?' };
    if (stop) return { kind: 'stop', what: 'stay put' };
    return { kind: 'unknown', reason: 'no idea' };
  };

  // ------------------------------------------------------------ smarter reading
  // Typos: "go fihsing with lyn" -> "go fishing with lynn"
  const COMMON = ('a an the to with about and then of for on in at me my you your i it is are am be do does did what who how why where when which go get make have please up out over into from not no yes some something someone him her them he she they his their this that ' +
    'head heads here there now today tonight tomorrow later soon again more less very much many few all any every each other others thing things stuff time day night morning evening ' +
    'good bad nice mean cute hot cool fine okay ok well sure yeah yep nope maybe really just also too only even still back away around near far down off fast slow little big small ' +
    'want wants need needs like likes love loves hate hates think thinks feel feels know knows say says said tell tells told ask asks asked give gives take takes come comes came went gone going ' +
    'look looks see sees saw watch find found keep let lets put run runs walk walks talk talks try tries help leave left right new old young happy sad mad angry upset scared afraid ' +
    'friend friends people person guy guys girl girls boy boys everyone everybody anyone anybody nobody ur u ya youre im ill its thats whats wheres hows whos dont doesnt cant wont ' +
    'house home place woods forest trail meadow field beach sea ocean water island sky hand god cat dog fish food dinner lunch breakfast party song song ' +
    'hug hugs kiss kisses date dating gift gifts present flowers flower propose marry married wedding sunset picnic smooch romantic shell crush single taken partner boyfriend girlfriend best worst hungry tired bored lonely sick wrong matter secret hobby hobbies age name yourself').split(' ');
  let VOCAB = null;
  const vocab = () => {
    if (VOCAB) return VOCAB;
    const words = new Set(COMMON);
    const add = list => { for (const ph of list) for (const w of ph.split(' ')) words.add(w); };
    for (const t of [ACTS, SOCIAL, ABOUT]) for (const l of Object.values(t)) add(l);
    add(GOSSIP_BAD); add(GOSSIP_GOOD); add(STOP);
    add(['dance', 'sing', 'laugh', 'cry', 'wave', 'jump', 'scream', 'clap', 'shrug', 'sneeze', 'flex', 'wake', 'calm', 'down', 'avoid', 'ignore', 'away', 'break', 'dock', 'pier', 'lighthouse', 'forest', 'woods', 'meadow', 'trail', 'hall', 'oak', 'farm', 'hungry', 'tired', 'bored', 'lonely', 'crush', 'friend', 'best', 'hate', 'like', 'love', 'think', 'feel', 'doing', 'plans', 'secret', 'scared', 'afraid']);
    VOCAB = words;
    return words;
  };
  const dist = (a, b) => {
    const m = a.length, n = b.length;
    if (Math.abs(m - n) > 2) return 9;
    const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
    for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
    return d[m][n];
  };
  C.fixTypos = (raw, people) => {
    const V = vocab();
    const names = people.map(p => p.name);
    return raw.replace(/[A-Za-z']+/g, w => {
      const lw = w.toLowerCase();
      if (V.has(lw) || names.some(n => n.toLowerCase() === lw) || lw.length < 3) return w;
      // Names first: "lyn", "frest", "jdue"
      let best = null, bd = 9;
      for (const n of names) { const d = dist(lw, n.toLowerCase()); if (d < bd && d <= (n.length >= 6 ? 2 : 1)) { bd = d; best = n; } }
      if (best && !V.has(lw)) return best;
      if (lw.length < 4) return w;
      for (const v of V) { if (v.length < 4) continue; const d = dist(lw, v); if (d < bd && d <= (lw.length >= 8 ? 2 : 1)) { bd = d; best = v; } }
      return best || w;
    });
  };

  // Several orders in one go: "eat, then go fishing", "after you nap, go swimming"
  C.splitSteps = (raw, actor, people) => {
    let t = raw.trim();
    let m = t.match(/^after (?:you )?(.+?),\s*(.+)$/i);
    if (m) return [m[1], ...C.splitSteps(m[2], actor, people)];
    m = t.match(/^before (?:you )?(.+?),\s*(.+)$/i);
    if (m) return [...C.splitSteps(m[2], actor, people), m[1]];
    const parts = t.split(/\s*(?:,?\s*\band then\b|,?\s*\bthen\b|\bafter that\b|\bafterwards\b|;|\.\s+)\s*/i).map(x => x.trim()).filter(Boolean);
    if (parts.length > 1) return parts.flatMap(x => C.splitSteps(x, actor, people));
    // "go fishing and take a nap": only split when both halves are real orders
    const i = t.toLowerCase().lastIndexOf(' and ');
    if (i > 0) {
      const a = t.slice(0, i);
      const leftWho = people.find(o => o !== actor && new RegExp(`\\b${o.name}\\b`, 'i').test(a));
      const b = PRONOUN.test(t.slice(i + 5)) && leftWho ? C.withPronouns(t.slice(i + 5), leftWho) : t.slice(i + 5);
      const pb = C.special(b, actor, people) || C.parse(b, actor, people), pa = C.special(a, actor, people) || C.parse(a, actor, people);
      const real = (o, txt) => o.kind !== 'unknown' && o.kind !== 'needWho' && !(o.kind === 'social' && !o.topic && !/\b(talk|chat|visit|see|find|meet|go)\b/i.test(txt));
      if (real(pa, a) && real(pb, b) && !/^\s*[A-Z][a-z]+\s*$/.test(b)) return [...C.splitSteps(a, actor, people), b];
    }
    return [t];
  };

  // Things that aren't errands: questions, little actions, feelings
  const EMOTES = {
    dance: { re: /\b(dance|dancing|boogie|groove|twerk|break ?dance)\b/, emote: 'note', say: ['*dances*', 'Look at me GO!', '*busts a move*', 'Is this... is this good?'] },
    sing: { re: /\b(sing|singing|hum)\b/, emote: 'note', say: ['La la laaa~', '*sings badly*', 'Hmm hmm hmmm~', 'This one goes out to the sky!'] },
    laugh: { re: /\b(laugh|giggle|lol)\b/, emote: 'note', say: ['HAHAHA!', '*laughs*', 'Heh. Hehehe.'] },
    cry: { re: /\b(cry|sob|weep)\b/, emote: 'sad', say: ['*sniff* ...why am I crying?', 'Waaah!', '*sobs dramatically*'] },
    wave: { re: /\b(wave|say hi to the sky|say hi to me)\b/, emote: 'heart', say: ['*waves at the sky*', 'Hiii, up there!', 'Hello, Sky!'] },
    jump: { re: /\b(jump|hop|leap)\b/, emote: 'exclaim', say: ['*jumps*', 'Boing!', 'Whee!'] },
    scream: { re: /\b(scream|shout|yell)\b(?! at)/, emote: 'exclaim', say: ['AAAAAAAAH!', 'WHAAAT?!', 'AAAH! ...okay, that felt good.'] },
    clap: { re: /\b(clap|applaud)\b/, emote: 'note', say: ['*claps*', 'Bravo! For... what are we clapping for?'] },
    shrug: { re: /\bshrug\b/, emote: 'question', say: ['*shrugs*', 'Eh.'] },
    sneeze: { re: /\bsneeze\b/, emote: 'sweat', say: ['ACHOO!', '*sneezes* ...excuse me.'] },
    flex: { re: /\b(flex|show off|pose)\b/, emote: 'sparkle', say: ['*flexes*', 'Behold.', 'You\'re welcome.'] },
    stretch: { re: /\b(stretch|yoga|meditate)\b/, emote: 'note', say: ['*stretches*', 'Ahh, that\'s the spot.', 'Inner peace. Finding it. Any second now.'] },
  };
  const SOOTHE = /\b(calm down|cheer up|be happy|smile|dont worry|don t worry|stop crying|dont be sad|chin up|its okay|it s okay|it is okay|take a deep breath|breathe|relax a bit|feel better|its alright|it s alright|you got this|youre doing great|you are doing great|good job|i love you|proud of you)\b/;

  const QWORD = /^(how|what|whats|who|whos|why|where|wheres|when|are|r|do|does|did|is|have|can|will|would|tell me|whatcha|wyd|hbu|hru|you ok|u ok)\b/;
  const qnorm = s => ' ' + s.toLowerCase().replace(/[’`]/g, "'").replace(/'s\b/g, ' s').replace(/'/g, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
  C.question = (raw, actor, people) => {
    const t = qnorm(raw).trim();
    const q = /\?\s*$/.test(raw.trim()) || QWORD.test(t);
    if (!q) return null;
    if (/^(ask|tell|go|make|have) [a-z]+ /.test(t) && !/^tell me\b/.test(t)) return null;
    const you = /\b(you|your|youre|u|ya|yourself|ur)\b/.test(t) || /^(hru|wyd|hbu)\b/.test(t);
    const other = people.find(o => o !== actor && new RegExp(`\\b${o.name.toLowerCase()}\\b`).test(t));
    // "do you want to go fishing?" / "can you go swimming?" are orders, not questions
    const rest = t.replace(/^.*?\b(want to|like to|feel like|wanna)\b/, '').replace(/^(can|could|would|will|wont|cant) (you|u) (please )?/, '');
    if (rest !== t && (scoreAll(' ' + rest + ' ', ACTS).length || scoreAll(' ' + rest + ' ', SOCIAL).some(x => x.k !== 'talk'))) return null;
    if (other && /^tell me about /.test(t)) return { kind: 'ask', q: 'opinion', about: other, what: 'answer a question' };
    if (!you && other) {
      if (/^(is|isnt|does|did) /.test(t) && /\b(nice|cute|hot|annoying|mean|funny|smart|kind|weird|cool|good|bad|okay|ok|pretty|handsome|single)\b/.test(t)) return { kind: 'ask', q: 'opinion', about: other, what: 'answer a question' };
      return null;
    }
    const has = re => re.test(t);
    let k = null;
    if (has(/\b(who are you|about yourself|tell me about you|your name)\b/)) k = 'bio';
    else if (!other && has(/^(how (are|r) (you|u)|how .*\bfeeling\b|hru|how s it going|hows it going|how is it going|how are things|how have you been|you ok|u ok|you good|u good|you alright|are you ok|are you okay|how do you feel|how you feeling|how are you feeling)\b/)) k = 'mood';
    else if (has(/\b(miss)\b/) && other) k = 'miss';
    else if (other && has(/\b(think of|think about|feel about|thoughts on|thoughts about|opinion of|opinion on|view on|take on|like|love|hate|is .* nice|cute|hot|annoying|trust|get along)\b/)) k = 'opinion';
    else if (has(/\b(crush|in love|like anyone|love anyone|like someone|who do you like|who do you love|dating|seeing anyone|girlfriend|boyfriend|partner|single|taken)\b/)) k = 'crush';
    else if (has(/\b(best friend|bff|favou?rite person|closest|best mate)\b/)) k = 'bff';
    else if (has(/\b(hate|enemy|enemies|rival|dont like|don t like|cant stand|can t stand|worst)\b/) && !has(/\bdoing\b/)) k = 'enemy';
    else if (has(/\b(me|the sky|sky hand|scared of me|afraid of me|trust me|like me|love me|hate me|fear me|think of me|god)\b/) && you) k = 'sky';
    else if (has(/\b(hungry|starving|eaten|eat anything)\b/)) k = 'hungry';
    else if (has(/\b(tired|sleepy|exhausted)\b/)) k = 'tired';
    else if (has(/\b(bored)\b/)) k = 'bored';
    else if (has(/\b(lonely|alone)\b/)) k = 'lonely';
    else if (has(/\b(sick|ill|cold)\b/) && you) k = 'sick';
    else if (has(/\b(why .*(sad|mad|upset|angry|grumpy|crying|down|happy)|whats wrong|what s wrong|what is wrong|matter)\b/)) k = 'why';
    else if (has(/\b(doing|up to|wyd|whatcha|busy)\b/)) k = 'doing';
    else if (has(/\b(where)\b/)) k = 'where';
    else if (has(/\b(want|wanna|feel like doing|plan|plans|planning|today|going to do)\b/)) k = 'want';
    else if (has(/\b(new|news|happened|gossip|heard|anything interesting|tea)\b/)) k = 'news';
    else if (has(/\b(secret)\b/)) k = 'secret';
    else if (has(/\b(hobby|hobbies|love doing|like doing|enjoy|favou?rite thing|fun)\b/)) k = 'loves';
    else if (has(/\b(old|age)\b/)) k = 'age';
    else if (has(/\b(who are you|about yourself|yourself|your name)\b/)) k = 'bio';
    else if (has(/\b(how are|how do you feel|how you feel|you ok|u ok|you good|how s it going|hows it going|how is it going|how have you been|how are things|hru|feeling|mood|happy|sad|okay)\b/)) k = 'mood';
    if (!k && !you) return null;
    return { kind: 'ask', q: k || 'shrug', about: other || null, what: 'answer a question' };
  };

  const listWords = arr => (arr.length < 2 ? arr.join('') : arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1]);
  // Each islander's little sign-off, now and then
  const TAIL = { Iroh: [' Obviously.', ' Next question.', ' You\'re welcome.'], Beach: [' Why do you even care?', ' Whatever.', ' Ugh.'], Egg: [' *yawn*', ' Anyway, nap time?'], Jude: [' Heh.', ' Keep up.'], Forest: [' Stay focused.', ' Moving on.'], Lynn: [' Thanks for asking!', ' How are YOU?'] };
  C.answer = (sim, p, order) => {
    const line = C.answerRaw(sim, p, order);
    const tail = TAIL[p.name];
    return tail && Math.random() < 0.3 && line.length < 60 && !/[?!]$/.test(line) ? line + IS.pick(tail) : line;
  };
  C.answerRaw = (sim, p, order) => {
    const t = p.traits, M = IS.Mind, n = p.needs;
    const others = sim.people.filter(o => o !== p);
    const shy = t.kind > 0.6 && t.brave < 0.6;
    const grumpy = t.grumpy > 0.5;
    const pk = a => IS.pick(a);
    const feel = M.feeling(p);
    const byF = others.slice().sort((a, b) => p.relTo(b.name).friendship - p.relTo(a.name).friendship);
    const lowNeed = () => {
      const l = [['hunger', 'I\'m starving, honestly.'], ['energy', 'I\'m so tired.'], ['social', 'Kind of lonely, if I\'m honest.'], ['fun', 'Bored out of my mind.']].filter(([k]) => n[k] < 28).sort((a, b) => n[a[0]] - n[b[0]])[0];
      return l ? l[1] : '';
    };
    switch (order.q) {
      case 'mood': {
        const m = p.mood();
        let a = m > 75 ? pk(['Honestly? Great.', 'Living my best life.', 'Really good, actually!']) : m > 55 ? pk(['Pretty good.', 'Not bad at all.', 'Good! You?']) : m > 35 ? pk(['Meh. Could be better.', 'I\'m okay. I think.', 'Surviving.']) : pk(['Not great, honestly.', 'Bad. Really bad.', 'Please don\'t ask.']);
        if (p.sick) a += ' I have a cold.';
        else if (feel) a += ' ' + ({ heartbroken: `I can't stop thinking about ${feel.about}.`, shocked: `${feel.about} is gone. I can't...`, furious: `I'm so angry about ${feel.about}.`, grieving: `I miss ${feel.about}.`, jealous: `${feel.about} is getting on my nerves.`, giddy: `I keep thinking about ${feel.about}, hehe.`, sulking: `${feel.about} annoyed me.`, proud: 'I did something great today.', lonely: 'Kind of lonely, though.' }[feel.type] || '');
        else a += (lowNeed() ? ' ' + lowNeed() : '');
        return a.trim();
      }
      case 'doing': {
        const a = p.action, label = p.actionLabel();
        if (p.chat) return `Talking with ${p.chat.other(p).name}. Well, I was.`;
        if (!a) return `Nothing much. ${p.thought || ''}`.trim();
        if (a.phase === 'travel') return `${ACT_GO[a.def.id] ? 'Heading off ' + ACT_GO[a.def.id] : label}. ${p.thought || ''}`.trim();
        return `${label}. ${p.thought || ''}`.trim();
      }
      case 'why': {
        if (p.sick) return 'I\'m sick. Everything aches.';
        if (feel) return { heartbroken: `It's ${feel.about}. It hurts.`, shocked: `${feel.about} died. Isn't that enough?`, furious: `You know why. ${feel.about}.`, grieving: `I miss ${feel.about}.`, jealous: `It's ${feel.about}. Everyone loves them. Ugh.`, giddy: `...${feel.about}. Don't make me say it.`, sulking: `${feel.about}. That's why.`, proud: 'Because I\'m amazing, obviously.', lonely: 'Nobody\'s talked to me in ages.' }[feel.type] || 'It\'s complicated.';
        const mem = p.memories.find(x => x.t > sim.clock.abs - 600);
        return lowNeed() || (mem ? `${mem.text}. That's all.` : pk(['Am I? I didn\'t notice.', 'No reason. I\'m fine.']));
      }
      case 'crush': {
        const partner = p.partner();
        if (partner) return pk([`I'm with ${partner.name}. Obviously.`, `${partner.name}, of course. Who else?`, `${partner.name}. Don't be weird about it.`]);
        const crush = IS.Dialogue.crushOf(p);
        if (crush) return shy ? pk([`...Maybe ${crush.name}? Don't tell ANYONE.`, `W-what? No! ...okay, ${crush.name}. A little.`]) : t.brave > 0.7 ? pk([`${crush.name}. And they're about to know it.`, `${crush.name}. Is it that obvious?`]) : pk([`I might like ${crush.name}. Maybe.`, `...${crush.name}. Shh.`]);
        return pk(['Nobody. I\'m focusing on me.', 'No one, really.', 'Romance? On this island? Ha.']);
      }
      case 'bff': {
        const b = byF[0];
        if (!b || p.relTo(b.name).friendship < 20) return 'I don\'t really have one yet...';
        return pk([`${b.name}, easy.`, `${b.name}. Don't tell the others.`, `Probably ${b.name}.`]);
      }
      case 'enemy': {
        const w = byF[byF.length - 1];
        if (!w || p.relTo(w.name).friendship > -10) return t.kind > 0.6 ? 'I don\'t hate anyone.' : 'Nobody, really. Yet.';
        const g = M.led(p, w.name);
        return `${w.name}. ${g.why ? 'Still not over ' + g.why + '.' : 'Don\'t get me started.'}`;
      }
      case 'opinion': {
        const o = order.about, r = p.relTo(o.name), g = M.led(p, o.name);
        if (r.partner) return pk([`${o.name}? I love them.`, `${o.name} is my everything. Gross, right?`]);
        if (r.romance > 45) return shy ? `${o.name}? They're... fine. Why are you asking?!` : pk([`${o.name}? ...They're kind of amazing.`, `Honestly? I like ${o.name}. Like, LIKE like.`]);
        if (g.grudge > 12) return `${o.name}? Still mad about ${g.why || 'what they did'}.`;
        if (r.friendship > 55) return pk([`${o.name}'s one of my favourite people.`, `${o.name}? Love them. Best on the island.`]);
        if (r.friendship > 20) return pk([`${o.name}'s nice. I like them.`, `${o.name}? Good people.`]);
        if (r.friendship > -10) return pk([`${o.name}? Don't really know them.`, `${o.name}'s alright, I guess.`, 'No strong feelings.']);
        return grumpy ? pk([`${o.name}? Ugh.`, `Don't even say that name.`]) : pk([`${o.name} and I don't really get along.`, `${o.name}... is a lot.`]);
      }
      case 'sky': {
        const s = p.skyOpinion;
        const deaths = sim.deaths || 0;
        if (s > 60) return pk(['You? You\'re amazing. Please don\'t drop me.', 'I trust you, Sky.']);
        if (s > 20) return pk(['You\'re alright, Sky.', 'You\'re weird, but I like you.']);
        if (s > -20) return pk(['Still figuring you out.', 'You\'re... a lot to process.']);
        if (s > -60) return deaths ? pk(['You killed people. So yeah, I\'m scared.', 'Please. Just leave me alone.']) : pk(['You scare me a little.', 'I don\'t trust you.']);
        return grumpy ? pk(['I hate you.', 'You\'re a monster.']) : pk(['Please... please leave me alone.', '*trembling* What do you want from me?']);
      }
      case 'hungry': return n.hunger < 30 ? pk(['STARVING.', 'Yes. Feed me.']) : n.hunger < 60 ? 'A little peckish.' : 'Nope, I\'m full.';
      case 'tired': return n.energy < 30 ? pk(['Exhausted. I could sleep standing up.', 'So tired.']) : n.energy < 60 ? 'A bit.' : 'Nope, wide awake!';
      case 'bored': return n.fun < 30 ? 'SO bored.' : n.fun < 60 ? 'Kind of.' : 'Nah, I\'m having fun.';
      case 'lonely': return n.social < 30 ? 'Honestly? Yeah.' : 'Not really. I\'ve got people.';
      case 'sick': return p.sick ? '*cough* Yeah. Don\'t come too close.' : 'Nope, healthy as a horse.';
      case 'where': {
        const b = p.building;
        const poi = sim.world.pois.slice().sort((a, b2) => IS.dist(a.x, a.y, p.tx, p.ty) - IS.dist(b2.x, b2.y, p.tx, p.ty))[0];
        const here = b ? (b.kind === 'hall' ? 'the Hall' : b.residents && b.residents.includes(p.cfg.name) ? 'home' : 'someone\'s house') : poi ? `near ${poi.name}` : 'outside';
        const a = p.action;
        return a && a.phase === 'travel' && ACT_GO[a.def.id] ? `I'm ${here}. Heading off ${ACT_GO[a.def.id]}.` : `I'm ${here}.`;
      }
      case 'want': {
        const plans = (p.plans || []).filter(x => !x.done).map(x => x.text.charAt(0).toLowerCase() + x.text.slice(1));
        if (plans.length) return `Today I want to ${listWords(plans.slice(0, 2))}.`;
        const need = lowNeed();
        if (need) return need;
        const fav = p.loves.find(l => IS.Dialogue.activityWord[l]);
        return fav ? `Honestly? Some ${IS.Dialogue.activityWord[fav]}.` : 'No idea. Surprise me.';
      }
      case 'news': {
        const mem = p.memories.find(m => m.tag !== 'sky');
        return mem ? pk([`Well... ${mem.text.charAt(0).toLowerCase() + mem.text.slice(1)}.`, `${mem.text}. That's the latest.`]) : 'Nothing. It\'s been quiet.';
      }
      case 'secret': {
        const crush = IS.Dialogue.crushOf(p);
        if (crush) return `Okay. Don't tell anyone. I like ${crush.name}.`;
        const enemy = byF[byF.length - 1];
        if (enemy && p.relTo(enemy.name).friendship < -10) return `Between us? I can't stand ${enemy.name}.`;
        return pk(['I talk to the plants sometimes. They don\'t talk back. Yet.', 'I\'m secretly scared of the dark.', 'No secrets here. I\'m an open book.']);
      }
      case 'loves': return `I love ${listWords(p.loves.slice(0, 3))}.${p.hates.length ? ' But ' + p.hates[0] + '? No thanks.' : ''}`;
      case 'age': return p.cfg.age ? `${p.cfg.age}. Why?` : 'Old enough.';
      case 'bio': return p.cfg.bio ? p.cfg.bio.replace(new RegExp(`^${p.name}\\b`), 'I').replace(/^I is/, 'I\'m') : `I'm ${p.name}.`;
      case 'miss': {
        const o = order.about;
        const e = p.mourning && p.mourning[o.name];
        if (e && e.aware) return e.f > 20 ? pk([`Every day.`, `${o.name}? So much it hurts.`]) : 'A little, I guess.';
        const r = p.relTo(o.name);
        return r.friendship > 40 ? `${o.name}? Yeah, I should go see them.` : 'Not really.';
      }
      default: return pk(['Hmm. Good question.', 'I... don\'t know how to answer that.', 'Why are you asking ME?']);
    }
  };

  // Everything else that isn't the classic errand parser
  C.special = (raw, actor, people) => {
    const t = qnorm(raw);
    const named = people.find(o => o !== actor && new RegExp(` ${o.name.toLowerCase()} `).test(t));
    // say "exact words"
    let m = raw.match(/^\s*(say|shout|yell|whisper|scream|sing)\s*:?\s*["“'](.+?)["”']?\s*$/i) || raw.match(/^\s*(say|shout)\s*:\s*(.+)$/i);
    if (m) return { kind: 'say', text: m[2].trim().slice(0, 80), loud: /shout|yell|scream/i.test(m[1]), what: `say “${m[2].trim().slice(0, 40)}”` };
    const q = C.question(raw, actor, people);
    if (q) return q;
    if (named && /\b(break up|breakup|dump|leave)\b/.test(t)) return { kind: 'social', topic: 'breakup', target: named, extra: {}, what: `break up with ${named.name}` };
    if (named && /\b(avoid|ignore|stay away from|keep away from|stop talking to|block)\b/.test(t)) return { kind: 'avoid', target: named, what: `stay away from ${named.name}` };
    if (/\b(wake up|get up|rise and shine)\b/.test(t)) return { kind: 'wake', what: 'wake up' };
    const love = named && C.loveOrder(t, actor, named);
    if (love) return love;
    const house = people.find(o => o !== actor && new RegExp(` ${o.name.toLowerCase()} s? ?(house|home|place)\\b`).test(t));
    if (house && /\b(go|walk|run|head|get|move|come|travel|visit)\b/.test(t)) return { kind: 'goto', place: 'house', of: house, what: `go to ${house.name}'s house` };
    const acts = scoreAll(t, ACTS).filter(a => a.k !== 'wander' && !(a.ph === 'farm' && / to the farm /.test(t)));
    // Places
    if (!acts.length && (/\b(go|walk|run|head|get|move|come|travel|visit)\b/.test(t) || / to the /.test(t))) {
      const P = [['the dock', /\b(dock|pier|jetty)\b/], ['the lighthouse', /\blighthouse\b/], ['the Old Oak', /\b(old oak|oak|forest|woods)\b/], ['the north trail', /\b(trail|north)\b/], ['the west meadow', /\b(meadow|field|west)\b/], ['the farm', /\b(farm)\b/], ['the Hall', /\b(hall|town hall)\b/]];
      for (const [name, re] of P) if (re.test(t)) return { kind: 'goto', place: name, what: `go to ${name}` };
    }
    if (!named && SOOTHE.test(t)) return { kind: 'soothe', what: 'feel a bit better' };
    if (!named && !acts.length) for (const [k, e] of Object.entries(EMOTES)) if (e.re.test(t) && !/\b(with|to|at)\b/.test(t.replace(/ (go|want) to /, ' '))) return { kind: 'emote', k, what: k === 'flex' ? 'show off' : k };
    return null;
  };

  // Couple stuff: kisses, dates, gifts, proposals, making up (love.js)
  C.loveOrder = (t, actor, who) => {
    const partner = actor.relTo(who.name).partner;
    const so = { kind: 'social', target: who, extra: {} };
    if (/\b(propose|marry|proposal|pop the question|engaged)\b/.test(t)) return { ...so, topic: 'propose', what: `propose to ${who.name}` };
    if (/\b(make up|kiss and make up|patch (it|things) up)\b/.test(t)) return { ...so, topic: 'makeUp', what: `make up with ${who.name}` };
    if (/\b(kiss|kisses|smooch|peck|snog|make out)\b/.test(t)) return { ...so, topic: 'kiss', what: `kiss ${who.name}` };
    if (/\b(gift|present|flowers|flower|surprise|shell)\b/.test(t) || / give .+ something /.test(t)) return { ...so, topic: 'gift', extra: { gift: IS.Love.giftFor(actor, who) }, what: `give ${who.name} a gift` };
    const act = /\b(sunset|hold hands|holding hands)\b/.test(t) ? 'sunsetWalk' : /\bpicnic\b/.test(t) ? 'picnicDate' : /\b(slow dance|dance with|dance together)\b/.test(t) ? 'slowDance' : /\b(date|take .+ out|romantic|cuddle)\b/.test(t) ? 'any' : null;
    if (!act) return null;
    if (!partner) return act === 'slowDance' ? null : { ...so, topic: 'flirt', what: `ask ${who.name} out` };
    return { kind: 'date', act, target: who, what: act === 'any' ? `take ${who.name} on a date` : `${{ sunsetWalk: 'watch the sunset with', picnicDate: 'have a picnic with', slowDance: 'slow dance with' }[act]} ${who.name}` };
  };

  // Pronouns: "find Lynn and hug her" / "hug her" after talking about Lynn
  const PRONOUN = /\b(him|her|them|he|she|they)\b/i;
  C.withPronouns = (raw, ref) => (ref ? raw.replace(/\b(him|her|them)\b/gi, ref.name).replace(/\b(he|she|they)\b(?= (is|was|likes|thinks))/gi, ref.name) : raw);

  // The full read of one whisper: a list of orders to do in turn
  C.understand = (sim, p, raw) => {
    const people = sim.people;
    let text = C.fixTypos(raw, people);
    const steps = C.splitSteps(text, p, people);
    let ref = (sim.whisperRef || {})[p.name] || null;
    const out = [];
    for (let st of steps) {
      let o = C.special(st, p, people) || C.parse(st, p, people);
      if ((o.kind === 'needWho' || o.kind === 'unknown') && PRONOUN.test(st) && ref) {
        const st2 = C.withPronouns(st, ref);
        const o2 = C.special(st2, p, people) || C.parse(st2, p, people);
        if (o2.kind !== 'unknown' && o2.kind !== 'needWho') o = o2;
      }
      const who = o.target || o.with || (o.extra && o.extra.subject) || o.about || o.of;
      if (who) ref = who;
      o.raw = st;
      out.push(o);
    }
    sim.whisperRef = sim.whisperRef || {};
    if (ref) sim.whisperRef[p.name] = ref;
    return out;
  };

  // Orders waiting their turn, run when the islander is free again
  C.tick = sim => {
    for (const p of sim.people) {
      if (!p.cmdQueue || !p.cmdQueue.length) continue;
      if (p.mode !== 'normal' || p.chat || (p.action && p.action.cmd) || (p.cmdWait || 0) > sim.clock.abs) continue;
      const next = p.cmdQueue.shift();
      const r = C.runOne(sim, p, next, true);
      if (sim.selected === p && sim.ui) { const out = document.getElementById('cmd-out'); if (out) { out.textContent = r.text; out.classList.toggle('err', !r.ok); } }
    }
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
    const s = [IS.pick(['How are you?', 'What are you up to?', 'Who\'s your crush?', 'Any news?']), `Go fishing with ${bff.name}`];
    if (crush) s.push(`Ask ${bff === crush ? IS.pick(others.filter(o => o !== crush)).name : bff.name} about ${crush.name}`);
    if (crush) s.push(`Flirt with ${crush.name}`);
    if (rival && p.relTo(rival.name).friendship < 0) s.push(`Apologize to ${rival.name}`);
    else s.push(`Tell ${IS.pick(others).name} a joke`);
    s.push(`What do you think of ${IS.pick(others).name}?`, 'Eat, then take a nap');
    return s.slice(0, 6);
  };

  const WORK = new Set(['fish', 'garden', 'forage', 'chop']);
  const HELP = 'Try: "go fishing then take a nap", "how are you?", "who\'s your crush?", "what do you think of Beach?", "go to the dock", "flirt with Lynn", "dance", "say \"hello\"".';

  // ------------------------------------------------------------ run
  // Returns { ok, text } describing what happened, for the HUD.
  C.run = (sim, p, raw) => {
    if (!(raw || '').trim()) return { ok: false, text: 'Type something for them to do.' };
    const orders = C.understand(sim, p, raw);
    p.cmdQueue = [];
    const r = C.runOne(sim, p, orders[0]);
    if (r.ok && orders.length > 1) {
      p.cmdQueue = orders.slice(1);
      r.text += ` Then: ${orders.slice(1).map(o => o.what || o.raw).join(', then ')}.`;
    }
    return r;
  };

  C.runOne = (sim, p, order, queued) => {
    if (typeof order === 'string') order = C.understand(sim, p, order)[0];
    if (p.mode !== 'normal' && p.mode !== 'recover') { p.say(IS.pick(['I am literally in the air right now.', 'Kinda busy being flung?!'])); return { ok: false, text: `${p.name} can't do anything right now.` }; }
    if (order.kind === 'ask') {
      const line = C.answer(sim, p, order);
      if (p.chat && p.chat.transcript) p.chat.transcript.push({ who: p.name, text: line });
      p.say(line, 4);
      p.emote(order.q === 'crush' || (order.q === 'opinion' && order.about && p.relTo(order.about.name).romance > 45) ? 'heart' : 'question', 1.6);
      if (!p.heardSky) { p.heardSky = true; p.remember('Heard a voice from the sky', { tag: 'sky', news: true }); }
      return { ok: true, text: `${p.name}: “${line}”` };
    }
    if (order.kind === 'say') {
      p.say(order.loud ? order.text.toUpperCase() : order.text, 4);
      p.cmdWait = sim.clock.abs + 3;
      return { ok: true, text: `${p.name} said it. Their face says they don't know why.` };
    }
    if (order.kind === 'emote') {
      const e = EMOTES[order.k];
      p.say(IS.pick(e.say), 3); p.emote(e.emote, 2);
      p.needs.fun = Math.min(100, p.needs.fun + 4);
      p.cmdWait = sim.clock.abs + 4;
      const ing = { dance: 'dancing', sing: 'singing', laugh: 'laughing', cry: 'crying', wave: 'waving at the sky', jump: 'jumping around', scream: 'screaming', clap: 'clapping', flex: 'flexing', stretch: 'stretching' }[order.k];
      const seenBy = sim.people.filter(o => o !== p && o.pose !== 'sleep' && (o.building || null) === (p.building || null) && IS.dist(o.x, o.y, p.x, p.y) < IS.TILE * 8);
      if (ing && seenBy.length) {
        IS.Mind.news(sim, 'weird', p, null, { detail: ing });
        IS.Gods.witness(sim, p, [`...${p.name}?`, 'What are they DOING?', 'Is this a bit?', 'Okay, I love this.'], 8);
      }
      return { ok: true, text: `${p.name} will ${order.what}.` };
    }
    if (order.kind === 'soothe') {
      const e = IS.Mind.feeling(p);
      if (e && ['lonely', 'sulking'].includes(e.type)) IS.Mind.clearFeeling(p);
      p.addMood('The sky was kind to me', 6, 300);
      p.skyOpinion = IS.clamp(p.skyOpinion + 3, -100, 100);
      const line = e && ['heartbroken', 'shocked', 'grieving', 'furious'].includes(e.type) ? IS.pick(['...Thanks. It still hurts, though.', 'I\'ll try. Thank you.']) : IS.pick(['...Thanks, Sky. I needed that.', 'Okay. Okay. Deep breath.', 'You\'re sweet for a giant voice in the sky.']);
      p.say(line, 3); p.emote('heart', 2);
      return { ok: true, text: `${p.name} feels a little better. “${line}”` };
    }
    if (order.kind === 'wake') {
      if (p.pose !== 'sleep') { p.say('I\'m... already awake?'); return { ok: true, text: `${p.name} is already up.` }; }
      p.cancelAction(); p.pose = 'stand'; p.idleUntil = sim.clock.abs + 2;
      const line = p.traits.grumpy > 0.4 ? 'I was SLEEPING. What?!' : IS.pick(['Mmh... five more minutes...', 'I\'m up, I\'m up!']);
      p.say(line, 3); p.emote('zzz', 1.4);
      return { ok: true, text: `${p.name} woke up. “${line}”` };
    }
    if (order.kind === 'avoid') {
      p.avoid[order.target.name] = sim.clock.abs + 720;
      if (p.chat && p.chat.other(p) === order.target) p.chat.end(true);
      const line = p.relTo(order.target.name).friendship > 40 ? `Avoid ${order.target.name}? ...If you say so.` : `Gladly.`;
      p.say(line, 3);
      return { ok: true, text: `${p.name} will keep away from ${order.target.name} for half a day. “${line}”` };
    }
    if (order.kind === 'date') return C.runDate(sim, p, order);
    if (order.kind === 'social' && order.topic === 'makeUp' && !p.relTo(order.target.name).partner) order = { ...order, topic: 'apology' };
    if (order.kind === 'social' && order.topic === 'propose' && !p.relTo(order.target.name).partner) {
      const line = `Propose?! ${order.target.name} and I aren't even dating!`;
      p.say(line, 3); p.emote('question', 1.6);
      return { ok: false, text: `${p.name} and ${order.target.name} aren't a couple. “${line}”` };
    }
    if (order.kind === 'social' && order.topic === 'makeUp' && !IS.Love.tiff(p, order.target)) order = { ...order, topic: 'couple' };
    if (order.kind === 'social' && order.topic === 'breakup' && !p.relTo(order.target.name).partner) {
      p.say(`Break up? ${order.target.name} and I aren't even together.`, 3);
      return { ok: false, text: `${p.name} and ${order.target.name} aren't a couple.` };
    }
    const legacy = C.runLegacy(sim, p, order, queued);
    return legacy;
  };

  // A date the sky asked for: the best one the time and weather allow
  C.runDate = (sim, p, order) => {
    const o = order.target, c = sim.clock;
    if (p.sick || o.sick) return { ok: false, text: `${p.sick ? p.name : o.name} is sick in bed. No dates today.` };
    const ids = order.act === 'any' ? ['sunsetWalk', 'slowDance', 'picnicDate'] : [order.act];
    const def = ids.map(id => IS.Actions[id]).find(d => d.can(p, c));
    if (!def) {
      const when = order.act === 'sunsetWalk' ? 'in the evening (5-8pm), when it\'s not raining' : order.act === 'picnicDate' ? 'around midday (11am-4pm), in nice weather, with food in the pantry' : order.act === 'slowDance' ? 'at night (7:30pm onwards), when it\'s dry' : 'when the time and weather are right: picnics at midday, sunsets in the evening, dancing at night';
      p.say(IS.pick(['Not really date weather...', 'Now? Hmm. Later would be better.']), 2.4);
      return { ok: false, text: `Dates work ${when}.` };
    }
    if (p.chat) p.chat.end(true);
    p.cancelAction(); p.idleUntil = 0;
    p.dateCmd = true; p.startAction(def, c); p.dateCmd = false;
    if (!p.heardSky) { p.heardSky = true; p.remember('Heard a voice from the sky', { tag: 'sky', news: true }); }
    if (p.action && p.action.with) { p.action.cmd = true; return { ok: true, text: `${p.name} asked ${o.name}: ${def.label.toLowerCase()}. ${o.name} said yes. ♥` }; }
    return { ok: false, text: `${p.name} asked, but ${o.name} said not now.` };
  };

  C.runLegacy = (sim, p, order, queued) => {

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
      if (ok && p.action) p.action.cmd = true;
    } else if (order.kind === 'goto') {
      const W = sim.world;
      let spot = null;
      if (order.place === 'house') {
        const b = W.buildings.find(x => x.id === order.of.homeId);
        if (b && b.doors[0]) spot = W.findNear(b.doors[0].x, b.doors[0].y - 1, (x, y) => W.walkable(x, y) && W.buildingAt(x, y) === b, 3);
      } else if (order.place === 'the Hall') {
        const b = W.buildings.find(x => x.kind === 'hall');
        if (b) spot = W.findNear(b.doors[0].x, b.doors[0].y - 2, (x, y) => W.walkable(x, y) && W.buildingAt(x, y) === b, 3);
      } else {
        const poi = W.pois.find(x => x.name === order.place);
        if (poi) spot = W.findNear(poi.x, poi.y, (x, y) => W.walkable(x, y) && W.reach[W.idx(x, y)] === 1, 3);
      }
      if (spot) { p.gotoTarget = { x: spot.x, y: spot.y, name: order.place === 'house' ? `${order.of.name}'s house` : order.place }; ok = p.startAction(IS.Actions.goto, sim.clock); if (ok) { p.action.forced = true; p.action.cmd = true; } }
    } else {
      const def = IS.Actions[order.act];
      p.noAutoInvite = order.kind === 'actWith';
      ok = p.startAction(def, sim.clock);
      p.noAutoInvite = false;
      if (ok) {
        p.action.forced = true;
        p.action.cmd = true;
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
      if (order.topic === 'kiss') return r.partner ? IS.pick(['Gladly.', 'Say less.', 'You don\'t have to tell me twice.']) : r.romance > 40 ? 'Oh no. Okay. Okay okay okay.' : `Kiss ${order.target.name}?! This is a terrible idea.`;
      if (order.topic === 'propose') return IS.pick(['Okay. This is it. Where\'s a ring? Is seaweed a ring?', 'I\'m going to throw up. In a good way.']);
      if (order.topic === 'gift') return IS.pick([`${order.target.name} is going to love this.`, 'Ooh, a surprise!']);
      if (order.topic === 'makeUp') return 'Yeah. I miss them. Okay.';
      if (order.topic === 'breakup') return r.partner ? IS.pick(['...Okay. It\'s time.', 'This is going to hurt.']) : `Break up? We're not even together.`;
      return r.friendship > 40 ? `Yeah, I miss ${order.target.name}.` : r.friendship < -10 ? `${order.target.name}? Really?` : 'Sure, why not.';
    }
    if (order.kind === 'stop') return 'Standing still. Weird, but okay.';
    if (order.kind === 'goto') return IS.pick([`Off to ${order.place === 'house' ? order.of.name + '\'s place' : order.place}!`, 'On my way.', 'Field trip!']);
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
