// Conversations with flow. A chat is an opening, one or two topic threads
// that play out over several back-and-forth beats (each reply depends on how
// the last line landed), maybe a segue, and a goodbye. Interrupted threads
// are remembered and picked back up; some threads leave island lore behind
// (Iroh's plans, Lynn's stargazing map) that others ask about later.
IS.Talk = (() => {
  const T = {};
  const pick = (pool, who) => IS.Dialogue.fresh(pool, who);
  const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);

  // ------------------------------------------------------------ context
  const DID = {
    fish: 'fishing at the dock', garden: 'in the garden', chop: 'chopping wood', read: 'reading', beach: 'lying on the beach',
    swim: 'swimming', wander: 'wandering around', forage: 'foraging in the woods', stargaze: 'stargazing', plaza: 'people-watching at the plaza',
    petCat: 'hanging out with {cat}', sleep: 'napping', eat: 'eating', home: 'pottering around at home', attend: 'at the event',
    cook: 'cooking', greetBoat: 'at the dock for the boat', watchDolphins: 'watching the dolphins',
  };
  const NEXT = { fish: 'go fishing', garden: 'check on the garden', chop: 'chop some wood', read: 'get back to my book', beach: 'hit the beach', swim: 'go for a swim', wander: 'go for a walk', forage: 'go foraging', stargaze: 'go look at the stars', plaza: 'go sit at the plaza', petCat: 'go find {cat}', sleep: 'take a nap', eat: 'grab some food', home: 'head home' };
  const LOVEACT = { fishing: 'fish', gardening: 'garden', foraging: 'forage', chopping: 'chop', reading: 'read', beach: 'beach', swimming: 'swim', wandering: 'wander', stargazing: 'stargaze', napping: 'sleep', cats: 'petCat' };

  const lastDid = p => {
    const h = p.history.slice().reverse().find(id => DID[id] && !['eat', 'sleep', 'attend', 'socialize', 'approach'].includes(id));
    return h || null;
  };
  const nextFor = p => {
    const plan = (p.plans || []).find(x => !x.done && x.kind === 'do');
    if (plan && NEXT[plan.def]) return NEXT[plan.def];
    const love = p.loves.map(l => LOVEACT[l]).find(id => id && NEXT[id]);
    return NEXT[love] || 'get going';
  };

  T.ctx = (sim, a, b, extra = {}) => {
    const others = sim.people.filter(p => p !== a && p !== b);
    const third = extra.third || (others.length ? IS.pick(others) : null);
    const ev = sim.events.nextEvent();
    const min = sim.clock.min;
    const aDid = lastDid(a), bDid = lastDid(b);
    const vars = {
      A: a.name, B: b.name,
      cat: sim.cat ? sim.cat.name : 'the cat',
      third: third ? third.name : 'the seagulls',
      thirdNow: third ? IS.Social.nowWord(third) : 'squawking',
      partofday: min < 720 ? 'morning' : min < 1080 ? 'afternoon' : 'evening',
      event: ev ? ev.name : 'the next dinner',
      when: ev ? (ev.day !== sim.clock.day ? 'tomorrow' : ev.start >= 17 * 60 ? 'tonight' : ev.start > min ? 'today' : 'right now') : 'soon',
      aDid: aDid ? DID[aDid] : 'not much', bDid: bDid ? DID[bDid] : 'not much',
      aNext: nextFor(a), bNext: nextFor(b),
      aFav: IS.Dialogue.activityWord[a.loves[0]] || 'wandering', bFav: IS.Dialogue.activityWord[b.loves[0]] || 'wandering',
      weather: sim.weather,
    };
    return { sim, a, b, v: null, vars, third, aDidId: aDid, bDidId: bDid, ...extra };
  };

  const fill = (text, ctx, sp) => {
    const other = sp === ctx.a ? ctx.b : ctx.a;
    return text.replace(/\{(\w+)\}/g, (m, k) => {
      if (k === 'other') return other.name;
      if (k === 'self') return sp.name;
      const v = ctx.vars[k];
      return v !== undefined ? v : m;
    }).replace(/\{(\w+)\}/g, (m, k) => (ctx.vars[k] !== undefined ? ctx.vars[k] : k));
  };

  // A beat's lines can be: a list, a function, or an object keyed by the
  // speaker's name, by the reaction (pos/neu/neg), or by a custom pick.
  const resolve = (say, ctx, sp, beat) => {
    if (typeof say === 'function') return resolve(say(ctx, sp), ctx, sp, beat);
    if (typeof say === 'string') return [say];
    if (Array.isArray(say)) return say;
    if (say && typeof say === 'object') {
      if (say[sp.name] && Math.random() < 0.7) return resolve(say[sp.name], ctx, sp, beat);
      const key = beat.pick ? beat.pick(ctx, sp) : ctx.v;
      return resolve(say[key] || say.any || say.neu || [], ctx, sp, beat);
    }
    return [];
  };

  // ------------------------------------------------------------ threads
  // by: who speaks ('a' started this thread, 'b' is the other one)
  // judge: run the relationship reaction for this topic first (sets ctx.v)
  // if: skip the beat unless true.  stop: end the thread after this beat if true.
  const TH = {};
  const def = (id, t) => { TH[id] = { id, ...t }; };
  const isLazy = p => p.traits.hardworking < 0.3;
  const isKind = p => p.traits.kind > 0.6;
  const brave = p => p.traits.brave > 0.65;

  // --- Catching up: what you've actually been doing
  def('catchup', {
    key: 'activity', w: 1.2,
    beats: [
      { by: 'a', say: { any: ['What have you been up to?', 'So what\'s new with you?', 'Busy {partofday}?', 'Where have you been all {partofday}?'], Lynn: ['How\'s your day been, really?'], Iroh: ['Report. What have you been doing.'] } },
      { by: 'b', say: ctx => ctx.bDidId ? [`Been ${ctx.vars.bDid} most of the {partofday}.`, `${cap(ctx.vars.bDid)}. You?`, `Honestly? ${cap(ctx.vars.bDid)}.`] : ['Not much, honestly.', 'Nothing. It\'s been glorious.', 'Bit of this, bit of that.'] },
      { by: 'a', judge: 'activity', say: {
        pos: ctx => ctx.bDidId && ctx.a.loves.includes(IS.Actions[ctx.bDidId] && IS.Actions[ctx.bDidId].love) ? ['Oh, jealous. I love that.', 'Ugh, take me with you next time.'] : ['Ooh, nice. How was it?', 'That sounds really nice.', 'Love that for you.'],
        neu: ['Huh. Cool.', 'Fair enough.', 'Mm, nice.'],
        neg: ['Sounds boring.', 'Rather you than me.', 'Thrilling.'] } },
      { by: 'b', if: ctx => ctx.v !== 'neg', say: ctx => {
        const id = ctx.bDidId;
        const caught = ctx.b.recentMemory('bigfish', 600) ? ['Caught a fish THIS big. No witnesses, sadly.'] : [];
        const by = {
          fish: [...caught, 'Caught a couple. One of them looked at me funny.', 'The fish were NOT cooperating.', 'Quiet. Just me, the water, and one rude seagull.'],
          garden: ['The tomatoes are almost ready. I can feel it.', 'Pulled so many weeds. They grow back out of spite.', 'Talked to the plants a bit. They\'re good listeners.'],
          chop: ['My arms are dead. Woodpile\'s happy though.', 'Split a log in one hit. Felt like a hero.'],
          read: ['Can\'t put it down. Someone\'s about to get betrayed, I can feel it.', 'Read the same page three times. Very relaxing.'],
          beach: ['Peak relaxation. Zero thoughts.', 'Got a little sunburnt. Worth it.'],
          swim: ['Water was perfect. Swam out to the buoy and back.', 'A fish brushed my leg and I screamed. Don\'t tell anyone.'],
          wander: ['Found a new path behind the greenhouse.', 'Just walked. The island looks different every day.'],
          forage: ['Found mushrooms. Not sure which ones are the fun kind.', 'Berries! Some. Ate most of them.'],
          stargaze: ['Saw a shooting star. Didn\'t tell anyone my wish.', 'Found the little crown constellation again.'],
          petCat: ['{cat} let me pet her for SIX minutes. A record.', '{cat} sat on me. I couldn\'t move. I had no choice.'],
        };
        return by[id] || ['It was nice. Quiet.', 'Could\'ve been worse.', 'Pretty good, actually.'];
      } },
      { by: 'a', if: ctx => ctx.v !== 'neg', say: ctx => ctx.aDidId ? [`Nice. I was ${ctx.vars.aDid}.`, `I've been ${ctx.vars.aDid}. Way less exciting.`] : ['Love that.', 'Ha, nice.'] },
      { by: 'b', if: ctx => ctx.v === 'pos', say: ctx => ctx.aDidId && ctx.aDidId === ctx.bDidId ? ['We should go together next time.', 'Next time, we go together.'] : ['Sounds like a good day.', 'Look at us, being productive.', 'Island life, huh.'] },
    ],
  });

  // --- Plans for later, with an invite if they line up
  def('plans', {
    key: 'plans', w: 1,
    beats: [
      { by: 'a', say: ['What are you doing later?', 'Got plans this {partofday}?', 'What\'s the move later?'] },
      { by: 'b', say: ctx => [`Thinking I'll ${ctx.vars.bNext}.`, `Probably ${ctx.vars.bNext}. You?`, `I really need to ${ctx.vars.bNext}.`] },
      { by: 'a', judge: 'plans', say: {
        pos: ctx => ctx.vars.aNext === ctx.vars.bNext ? ['Wait, me too! Let\'s go together.', 'Same! Meet you there?'] : [`Nice. I'm gonna ${ctx.vars.aNext}.`, `Fun. I should ${ctx.vars.aNext} at some point.`],
        neu: [`Cool. I'll probably ${'{aNext}'}.`, 'Fair.'],
        neg: ['Sounds like a lot of effort.', 'Have fun with that.'] } },
      { by: 'b', if: ctx => ctx.v === 'pos', say: ctx => ctx.vars.aNext === ctx.vars.bNext ? ['Deal. Don\'t be late.', 'It\'s a date. A friend date. A frate.'] : ['Have fun!', 'Look at you, with a plan.', 'Don\'t work too hard.'] },
    ],
  });

  // --- A real question, a real answer, and a follow-up on that answer
  const QS = [
    { q: 'What\'s your favourite thing about the island?', a: b => b.loves[0] ? `${cap(IS.Dialogue.activityWord[b.loves[0]] || b.loves[0])}. Easy.` : 'The quiet.', f: { pos: ['Ha, I knew you\'d say that.', 'Same, honestly.'], neu: ['Fair answer.', 'Makes sense.'], neg: ['Boring answer.', 'Really? That?'] } },
    { q: 'If you could leave for one day, where would you go?', a: b => b.traits.curious > 0.6 ? 'A huge library. I\'d never come out.' : (b.cfg.quirks || []).includes('greedy') ? 'A buffet. All of them.' : b.traits.sociable > 0.8 ? 'A party. A huge one.' : 'Nowhere. I like it here.', f: { pos: ['Okay, I respect that.', 'Take me with you.'], neu: ['Interesting.', 'Huh.'], neg: ['Of course you would.', 'Weird choice.'] } },
    { q: 'Morning person or night person?', a: b => b.traits.energetic > 0.75 ? 'Both. Sleep is optional.' : b.wakeMin > 7 * 60 ? 'Night. Mornings are a scam.' : 'Morning. Best light of the day.', f: { pos: ['Same!', 'Knew it.'], neu: ['Hm. Opposite of me.', 'Fair.'], neg: ['Wrong answer.', 'We can\'t be friends.'] } },
    { q: 'One giant crab or ten tiny crabs. Who wins?', a: b => brave(b) ? 'I\'d take the giant crab. Easy.' : 'I\'d lose to both. Next question.', f: { pos: ['Hahaha, valid.', 'Okay, I believe you.'], neu: ['Debatable.', 'Bold.'], neg: ['You would lose so fast.', 'Delusional.'] } },
    { q: 'Do you think the Sky Hand is real?', a: b => b.grabCount ? 'I\'ve BEEN up there. It\'s real.' : b.traits.curious > 0.6 ? 'Something\'s up there, for sure.' : 'Nah. People just trip a lot.', f: { pos: ['Right?! Thank you!', 'Finally someone gets it.'], neu: ['Hmm. Maybe.', 'Spooky.'], neg: ['Sure, sure.', 'Okay, conspiracy theorist.'] } },
    { q: 'What would you do with a whole free day?', a: b => b.traits.hardworking > 0.75 ? 'Fix the fence. Then the other fence.' : isLazy(b) ? 'Nap. Then nap again.' : 'Beach all day. No notes.', f: { pos: ['Honestly, perfect.', 'Living the dream.'], neu: ['Hm, okay.', 'Interesting choice.'], neg: ['That\'s so sad.', 'That is NOT a free day.'] } },
    { q: 'Do you have a crush on anyone? Be honest.', a: (b, a) => { const c = IS.Dialogue.crushOf(b); if (!c) return 'Nope. Free as a seagull.'; if (c === a) return '...Why are you asking ME that?'; return b.traits.sociable > 0.8 ? `Okay, fine. ${c.name}. Don't tell!` : 'What? No. ...Maybe. Next question.'; }, f: { pos: ['Your secret\'s safe with me.', 'I KNEW it.'], neu: ['Interesting...', 'Noted. Very noted.'], neg: ['Wow, okay, defensive.', 'Suspicious.'] } },
    { q: 'What\'s the best thing you\'ve eaten here?', a: b => IS.pick(['That berry pie at the last dinner.', 'Fresh fish off the grill.', b.name === 'Lynn' ? 'My own soup, if I\'m honest.' : 'Lynn\'s soup. Every time.', 'A tomato straight off the vine.']), f: { pos: ['Oh, good call.', 'Now I\'m hungry.'], neu: ['Hm, okay.', 'Not bad.'], neg: ['Overrated.', 'Pfft.'] } },
  ];
  def('question', {
    key: 'question', w: 1.1,
    setup: ctx => { ctx.q = IS.pick(QS); },
    beats: [
      { by: 'a', say: ctx => [ctx.q.q] },
      { by: 'b', say: ctx => [ctx.q.a(ctx.b, ctx.a)] },
      { by: 'a', judge: 'question', say: ctx => ctx.q.f },
      { by: 'b', say: { pos: ['What about you?', 'Your turn. Same question.'], neu: ['What, what would you say?', 'Okay, you answer then.'], neg: ['Like you have a better answer.', 'Oh, and yours is so great?'] } },
      { by: 'a', say: ctx => [ctx.q.a(ctx.a, ctx.b).replace('Why are you asking ME that?', 'Not telling.')] },
    ],
  });

  // --- The schemer: each islander's catchphrase opens their own little bit
  const SCHEMES = ['We build a raft and see what\'s past the lighthouse.', 'We teach {cat} to fish. Then we retire.', 'We sneak onto the supply boat and ride it to the mainland and back.', 'We dig a pool next to the beach. A pool. Next to the ocean.', 'We start a band. I\'ll learn an instrument by Thursday.', 'Midnight fishing. Glow-in-the-dark bait. Don\'t ask how.', 'We build a treehouse in the big oak by the forest.'];
  def('scheme', {
    key: 'catchphrase', w: 1, who: ['Iroh'],
    setup: ctx => { ctx.vars.scheme = IS.pick(SCHEMES).replace('{cat}', ctx.vars.cat); },
    beats: [
      { by: 'a', say: ['Okay. I have a plan.', 'Hear me out. I have a plan.', 'I have a plan. It\'s a bad plan, but it\'s a plan.'] },
      { by: 'b', say: { any: ['Oh no. What is it?', '...Go on.', 'Every time you say that, something catches fire.'], Forest: ['Is it a bad plan?', 'Does it involve work? Then I\'m listening.'], Egg: ['Is there a nap in this plan?', 'Ooh, I love your plans!'], Lynn: ['Is it safe? Tell me it\'s safe.'], Beach: ['Ugh. Fine. What.'] } },
      { by: 'a', say: ctx => [ctx.vars.scheme] },
      { by: 'b', judge: 'joke', pick: ctx => brave(ctx.b) && ctx.v !== 'neg' ? 'in' : ctx.v === 'neg' ? 'no' : isLazy(ctx.b) ? 'lazy' : 'maybe', say: {
        in: ['...I\'m in.', 'That\'s insane. I\'m in.', 'When do we start?'],
        lazy: ['Does it involve walking?', 'I support this from a distance.'],
        maybe: ['That is a terrible plan.', 'I hate that I kind of like it.', 'Okay, but who\'s telling Lynn?'],
        no: ['Absolutely not.', 'No. No no no.', 'I\'m telling everyone you said that.'] } },
      { by: 'a', say: ['It\'s a bad plan, but it\'s a plan.', 'Phase one starts tomorrow. Probably.', 'Trust the process.', 'You\'ll see. You\'ll all see.'] },
    ],
    after: (ctx, sim) => T.addLore(sim, { kind: 'scheme', owner: ctx.a.name, text: ctx.vars.scheme, knownBy: [ctx.a.name, ctx.b.name] }),
  });
  def('grind', {
    key: 'catchphrase', w: 1, who: ['Forest'],
    beats: [
      { by: 'a', say: ['You know what your problem is?', 'Can I be honest with you?'] },
      { by: 'b', say: { any: ['...What?', 'Here we go.', 'Oh boy.'], Iroh: ['My problem is you, mostly.'], Egg: ['Is it naps? It\'s naps.'] } },
      { by: 'a', say: ['You\'re wasting daylight. We all are.', 'Too much talking. Not enough doing.', 'Nobody on this island has a routine except me.'] },
      { by: 'b', judge: 'complaint', say: { pos: ['...Okay, that\'s fair.', 'Ugh. You\'re right. I hate it.'], neu: ['Maybe. Maybe not.', 'Noted. Ignored, but noted.'], neg: ['Relax, it\'s an island.', 'Not everyone wants to chop wood at dawn, Forest.'] } },
      { by: 'a', say: { pos: ['Tomorrow. Six a.m. Be there.', 'Respect the grind.'], neu: ['Respect the grind.', 'Whatever. I\'ll do it myself.'], neg: ['I\'ll just do it myself.', 'Fine. More wood for me.'] } },
    ],
  });
  def('napgospel', {
    key: 'catchphrase', w: 1, who: ['Egg'],
    beats: [
      { by: 'a', say: ['Can I tell you my life philosophy?', 'I figured something out today.'] },
      { by: 'b', say: ['...Sure?', 'Oh boy. Go.', 'Is this going to be about naps?'] },
      { by: 'a', say: ['Nap first. Problems later. Problems are smaller after a nap.', 'Everything\'s gonna be fine. Probably. Mostly.', 'If {cat} isn\'t worried, I\'m not worried.'] },
      { by: 'b', judge: 'deep', say: { pos: ['...That\'s weirdly wise.', 'Okay, I needed to hear that.'], neu: ['That\'s... a philosophy.', 'Sure, Egg.'], neg: ['That\'s just laziness with extra steps.', 'That is not a philosophy.'] } },
      { by: 'a', say: { pos: ['Life\'s good, man.', 'I\'m basically a monk.'], neu: ['You\'ll come around.', 'Life\'s good, man.'], neg: ['Agree to disagree. I\'m gonna go nap.', 'Your loss, man.'] } },
    ],
  });
  def('deal', {
    key: 'catchphrase', w: 1, who: ['Jude'],
    beats: [
      { by: 'a', say: ['Okay, I\'ve got a business proposal.', 'Hey. You want to make a deal?'] },
      { by: 'b', say: ['...What kind of deal?', 'Why do I feel scammed already?', 'Go on.'] },
      { by: 'a', say: ['You do my chores tomorrow, and I... let you hang out with me.', 'I\'ll tell you a secret if you give me your dessert at dinner.', 'I\'ll teach you how to flirt. One lesson. Cheap.'] },
      { by: 'b', judge: 'cocky', say: { pos: ['...Okay, that\'s kind of tempting.', 'Hahaha, deal. Kind of.'], neu: ['I\'ll think about it.', 'Counter-offer: no.'], neg: ['What\'s in it for ME?', 'Absolutely not.', 'You\'re ridiculous.'] } },
      { by: 'a', say: { pos: ['Pleasure doing business.', 'Smart. Real smart.'], neu: ['Offer expires soon. Just saying.', 'You\'ll be back.'], neg: ['Your loss.', 'Heh. Worth a shot.'] } },
    ],
  });
  def('nowifi', {
    key: 'catchphrase', w: 1, who: ['Beach'],
    beats: [
      { by: 'a', say: ['Okay, can we talk about how there\'s no WiFi here?', 'I\'m literally so bored.', 'Do you know what I would do for a coffee shop right now?'] },
      { by: 'b', say: { any: ['Here we go again.', 'It\'s an island, Beach.', '...Have you tried going outside?'], Jude: ['Same, honestly.'], Lynn: ['Want to come garden with me? It\'s fun!'] } },
      { by: 'a', say: ['Back home I had a pool, a driver AND signal.', 'My dad is going to hear about this.', 'I\'ve read every magazine on this island. Twice.'] },
      { by: 'b', judge: 'brag', say: { pos: ['Okay, the pool sounds amazing.', 'I\'d miss the coffee too.'], neu: ['Mhm.', 'Sounds... hard.'], neg: ['Nobody cares about your pool.', 'Wow. Riveting.', 'You\'re unbelievable.'] } },
      { by: 'a', say: { pos: ['Thank you! Finally someone gets it.', 'See? I\'m suffering.'], neu: ['Whatever.', 'You just don\'t get it.'], neg: ['Ugh. That\'s so not my problem.', 'Rude. Literally.'] } },
    ],
  });
  def('checkin', {
    key: 'catchphrase', w: 1, who: ['Lynn'],
    beats: [
      { by: 'a', say: ['Have you eaten today? Properly?', 'You look tired. Are you sleeping okay?'] },
      { by: 'b', pick: ctx => ctx.b.needs.hunger < 45 || ctx.b.needs.energy < 40 ? 'no' : 'yes', say: { yes: ['Yes, mom.', 'I have! Promise.', 'All good, really.'], no: ['...Define properly.', 'Not really, no.', 'I had a berry. One berry.'] } },
      { by: 'a', pick: ctx => ctx.b.needs.hunger < 45 || ctx.b.needs.energy < 40 ? 'no' : 'yes', say: { yes: ['Good. I worry, you know.', 'Okay, okay. Just checking.'], no: ['Okay, come on, there\'s soup at my place.', 'That\'s it, you\'re eating something. Now.'] } },
      { by: 'b', judge: 'compliment', say: { pos: ['You\'re the best, Lynn.', 'What would we do without you?'], neu: ['Okay, okay. Thanks.', 'Fine. Thank you.'], neg: ['I\'m not a child.', 'I\'m fine. Seriously.'] } },
    ],
  });

  // --- Gossip with a take, and a second take
  def('gossip', {
    key: 'gossipGood', w: 1,
    beats: [
      { by: 'a', say: ['Okay, can I tell you something about {third}?', 'Have you noticed {third} lately?', 'So. {third}.'] },
      { by: 'b', say: ['Ooh. What?', 'What about them?', 'Uh oh. Go on.'] },
      { by: 'a', say: ['{third} helped me out earlier without me even asking.', '{third} has been in such a good mood. It\'s contagious.', '{third} is secretly really good at {thirdFav}.'] },
      { by: 'b', judge: 'gossipGood', say: { pos: ['Honestly? {third} is underrated.', 'I love that. {third} deserves it.'], neu: ['Huh, didn\'t know that.', 'Interesting.'], neg: ['Hm. Not my experience.', '{third}? Really?'] } },
    ],
    setup: ctx => { ctx.vars.thirdFav = ctx.third ? (IS.Dialogue.activityWord[ctx.third.loves[0]] || 'napping') : 'squawking'; },
  });
  def('trashtalk', {
    key: 'gossipBad', w: 1,
    beats: [
      { by: 'a', say: ['Okay, between us...', 'Can I vent about {third} for a second?', 'Don\'t tell {third} I said this, but...'] },
      { by: 'b', say: ['...Oh no. What happened?', 'My lips are sealed.', 'Spill.'] },
      { by: 'a', say: ['{third} has been getting on my nerves SO much.', '{third} ate the last of the bread. I saw it.', '{third} snores. Loudly. Through walls.', '{third} thinks they\'re so funny. They\'re not.'] },
      { by: 'b', judge: 'gossipBad', say: { pos: ['Honestly? Same.', 'Thank you! I thought it was just me.', 'Okay, yeah, I\'ve noticed.'], neu: ['Hm. Maybe they\'re just having a week.', 'I don\'t know...'], neg: ['That\'s kind of harsh.', 'I like {third}, actually.', 'Maybe say that to their face?'] } },
      { by: 'a', say: { pos: ['RIGHT?', 'See, you get it.'], neu: ['Maybe. Still annoying.', 'Whatever. I said what I said.'], neg: ['...Fine. Forget I said anything.', 'Okay, okay. Sorry.'] } },
    ],
  });

  // --- A joke with setup, groan, and a comeback
  const JOKES = [
    ['Why don\'t crabs share?', 'Because they\'re shellfish.'],
    ['What did the ocean say to the beach?', 'Nothing. It just waved.'],
    ['Why did the fish blush?', 'It saw the ocean\'s bottom.'],
    ['What do you call a fish with no eyes?', 'A fsh.'],
    ['Why did the scarecrow win an award?', 'He was outstanding in his field.'],
    ['What\'s a cat\'s favourite colour?', 'Purrrple.'],
    ['Why do seagulls fly over the sea?', 'Because if they flew over the bay, they\'d be bagels.'],
    ['What do you call a sleeping bull?', 'A bulldozer.'],
  ];
  def('joke', {
    key: 'joke', w: 1,
    setup: ctx => { ctx.joke = IS.pick(JOKES); },
    beats: [
      { by: 'a', say: ['Okay okay, I have a joke.', 'Want to hear a terrible joke?', 'Stop what you\'re doing. Joke time.'] },
      { by: 'b', say: { any: ['...Fine.', 'Oh no. Go.', 'I\'m ready.'], Forest: ['Make it quick.'], Beach: ['Ugh. Go.'] } },
      { by: 'a', say: ctx => [ctx.joke[0]] },
      { by: 'b', say: ['...What?', 'I don\'t know, what?', 'Don\'t say it.'] },
      { by: 'a', say: ctx => [ctx.joke[1]] },
      { by: 'b', judge: 'joke', say: { pos: ['HAHAHA. I hate you.', '...I hate that I laughed.', 'Okay, that one got me.'], neu: ['Heh.', 'Groan.', 'That was so bad it looped back to good.'], neg: ['Boo. Get off the stage.', 'That\'s the worst one yet.', 'I want those ten seconds back.'] } },
      { by: 'a', if: ctx => ctx.v === 'neg', say: ['Tough crowd.', 'You\'ll be laughing about that later.', 'Wow. Okay. Comedy is dead.'] },
    ],
  });

  // --- Roast battle (only between people who can take it)
  def('roast', {
    key: 'roast', w: 1,
    beats: [
      { by: 'a', say: ['Nice outfit. Did you lose a bet?', 'You look like you got dressed in the dark.', 'I watched you fish earlier. The fish felt sorry for you.', 'You run like your shoes are arguing.'] },
      { by: 'b', judge: 'roast', say: {
        pos: ['Says the guy whose hair looks like a seagull nest.', 'Oh, you want to do this? You walk like a crab.', 'At least I don\'t talk to myself while chopping wood.', 'Bold words from someone who lost to a fish.'],
        neu: ['Okay, wow.', 'Was that supposed to hurt?'],
        neg: ['...Wow. Okay.', 'That actually wasn\'t funny.', 'Rude. Genuinely rude.'] } },
      { by: 'a', if: ctx => ctx.v === 'neu', say: ['A little, yeah.', 'Worth a shot.', 'Tough crowd.'] },
      { by: 'a', if: ctx => ctx.v === 'pos', say: ['HA! Okay, fair.', 'Oh, it\'s ON.', 'Okay, you got me. Truce?'] },
      { by: 'b', if: ctx => ctx.v === 'pos', say: ['Truce. For now.', 'I\'ll get you back later.', 'Love you too.'] },
      { by: 'a', if: ctx => ctx.v === 'neg', say: ['Hey, I was kidding. Sorry.', 'Too far? Too far. Sorry.'] },
    ],
  });

  // --- A compliment, modesty, insistence
  def('compliment', {
    key: 'compliment', w: 1,
    beats: [
      { by: 'a', say: ['Hey, I meant to say. You\'ve been working really hard lately.', 'You know you\'re a good friend, right?', 'The island\'s better with you on it. Just saying.', 'You were really funny at dinner the other night.'] },
      { by: 'b', judge: 'compliment', say: { pos: ['Stop, you\'re going to make me blush.', 'Aww. Where\'s this coming from?', 'That... actually means a lot.'], neu: ['Oh. Thanks?', 'Okay, what do you want?'], neg: ['...What do you want?', 'Suspicious.'] } },
      { by: 'a', say: { pos: ['Nowhere. Just true.', 'I mean it!'], neu: ['Nothing! I mean it.', 'Can\'t a person be nice?'], neg: ['Wow. Okay. Never again.', 'Forget it.'] } },
      { by: 'b', if: ctx => ctx.v === 'pos', say: ['Well. Thanks. You too.', 'Okay, you\'re not so bad yourself.'] },
    ],
  });

  // --- A complaint, and advice that fits who's giving it
  def('complaint', {
    key: 'complaint', w: 1,
    beats: [
      { by: 'a', say: ctx => ctx.a.needs.energy < 35 ? ['I\'m SO tired.', 'I could sleep for a week.'] : ctx.a.needs.hunger < 35 ? ['I\'m starving. Like, actually.', 'When\'s food. I need food.'] : ['The seagulls stole my sandwich. Again.', 'My back is killing me.', 'There\'s sand in places sand should not be.', 'Nobody ever restocks the pantry but me.'] },
      { by: 'b', judge: 'complaint', pick: (ctx, sp) => ctx.v === 'neg' ? 'neg' : isKind(sp) ? 'kind' : sp.traits.hardworking > 0.8 ? 'tough' : isLazy(sp) ? 'lazy' : 'neu', say: {
        kind: ['Oh no. Want me to help?', 'Aw. Come on, let\'s fix it.', 'Do you want some tea? Tea fixes things.'],
        tough: ['Walk it off.', 'Push through. You\'ll be fine.'],
        lazy: ['Honestly? Nap. Solves everything.', 'Have you tried lying down?'],
        neu: ['Ugh, that sucks.', 'Rough.'],
        neg: ['Join the club.', 'Everyone\'s got problems.', 'Do you ever stop complaining?'] } },
      { by: 'a', say: { pos: ['Thanks. I needed that.', 'Yeah. Okay. Yeah.'], neu: ['Yeah...', 'I guess.'], neg: ['Wow. Thanks for nothing.', 'Forget I said anything.'] } },
    ],
  });

  // --- Late-night deep talk
  def('deep', {
    key: 'deep', w: 1,
    beats: [
      { by: 'a', say: ['Can I ask you something weird?', 'Do you ever think about stuff? Like, big stuff?', 'Random question.'] },
      { by: 'b', say: ['Always.', 'Sure. Go.', 'Uh oh, a deep one.'] },
      { by: 'a', say: ['Do you think we\'ll still be here in ten years?', 'What would you be doing if you never came to the island?', 'Do you ever miss the mainland?', 'Do the stars look different here, or is it just me?'] },
      { by: 'b', judge: 'deep', say: { pos: ['Honestly? I hope so. This place feels like home.', 'I think about that a lot, actually.', 'I\'d be somewhere loud and lonely. This is better.'], neu: ['Hm. Never thought about it.', 'Maybe? Hard to say.'], neg: ['That\'s too deep for me right now.', 'Can we not get philosophical?'] } },
      { by: 'a', if: ctx => ctx.v === 'pos', say: ['Yeah. Me too.', 'I\'m glad you\'re here, {other}.', 'Same. It\'s weird how fast it became home.'] },
      { by: 'b', if: ctx => ctx.v === 'pos', say: ['Me too.', 'Don\'t get sappy on me.', '...Yeah.'] },
    ],
  });

  // --- Flirting, with a real reaction and a follow-up
  def('flirt', {
    key: 'flirt', w: 1,
    beats: [
      { by: 'a', say: { any: ['The sunset\'s nicer when you\'re around.', 'You look really good today.', 'I keep finding reasons to walk past wherever you are.'], Jude: ['Careful. You\'re staring again.', 'You know you can\'t resist me, right?'], Forest: ['You look... good. That\'s all.'], Iroh: ['Is it hot out here or is it just you? Wait. Don\'t answer.'], Egg: ['You\'re like a cat in a sunbeam. In a good way.'] } },
      { by: 'b', judge: 'flirt', say: { pos: ['...Stop. You\'re making me blush.', 'Smooth. Really smooth.', 'Oh? Tell me more.'], neu: ['Haha... thanks?', 'Okay?'], neg: ['Uh. Thanks. I guess.', 'Let\'s stay friends, yeah?'] } },
      { by: 'a', if: ctx => ctx.v === 'pos', say: ['Want to watch the stars with me sometime?', 'So... walk with me later?', 'I saved you the best seat at dinner, by the way.'] },
      { by: 'b', if: ctx => ctx.v === 'pos', say: ['...I\'d like that.', 'Maybe. If you\'re lucky.', 'It\'s a date. Maybe.'] },
      { by: 'a', if: ctx => ctx.v === 'neg', say: ['Right. Yeah. Friends. Cool cool cool.', 'Ha. Okay. Pretend I didn\'t say that.'] },
    ],
  });

  // --- Teasing a friend about their crush
  def('tease', {
    key: 'tease', w: 1,
    beats: [
      { by: 'a', say: ['Sooo... you and {crush}, huh?', 'You went all red when {crush} walked past.', 'I see how you look at {crush}. Everyone sees it.'] },
      { by: 'b', judge: 'tease', pick: ctx => ctx.b.relTo(ctx.vars.crush).romance > 35 ? 'yes' : 'no', say: { yes: ['W-what? No! Shut up!', 'I don\'t know what you\'re talking about.', '...Is it that obvious?'], no: ['Ew, no. Not happening.', 'Pfft. As if.'] } },
      { by: 'a', if: ctx => ctx.b.relTo(ctx.vars.crush).romance > 35, say: ['You\'re literally blushing right now.', 'Want me to put in a good word?', 'Your secret\'s safe with me. Mostly.'] },
      { by: 'b', if: ctx => ctx.b.relTo(ctx.vars.crush).romance > 35, say: ['Okay, MAYBE a little. Don\'t you dare tell anyone.', 'If you tell {crush}, I\'ll throw you in the sea.', '...Do you think {crush} likes me back?'] },
      { by: 'a', if: ctx => ctx.b.relTo(ctx.vars.crush).romance > 35, say: ['My lips are sealed.', 'Only one way to find out.', 'I\'m invested now. Keep me updated.'] },
    ],
  });

  // --- News going around, with opinions
  const RUMOR = {
    fight: ['Did you hear {na} and {nb} got into it?', 'So {na} and {nb} had a HUGE fight earlier.'],
    couple: ['Okay, {na} and {nb} are a thing now. Officially!', 'Did you hear? {na} and {nb}. Together.'],
    rejected: ['Don\'t tell anyone, but {na} confessed to {nb}... and got turned down.'],
    breakup: ['{na} and {nb} broke up. It\'s over.'],
    won: ['{na} won the fishing contest. We will never hear the end of it.'],
    dunk: ['{na} got thrown into the SEA earlier. By the sky!'],
    date: ['{na} and {nb} were on a little date earlier. So cute.'],
  };
  const RUMOR_R = {
    fight: { pos: ['Yikes. About what?', 'Again? Those two...'], neu: ['Oof.', 'Huh.'], neg: ['I\'m staying out of that.', 'Not my business.'] },
    couple: { pos: ['No WAY! I called it!', 'Wait, seriously?! Good for them!'], neu: ['Huh. Okay.', 'Didn\'t see that coming.'], neg: ['...Oh. Cool. Great.', 'Whatever. Good for them.'] },
    rejected: { pos: ['Oh no. Poor thing.', 'Ouch. That\'s rough.'], neu: ['Oof.'], neg: ['Can\'t say I\'m surprised.'] },
    breakup: { pos: ['What?! They were so cute!', 'Oh no. Are they okay?'], neu: ['Huh.'], neg: ['Saw that coming.'] },
    won: { pos: ['Ha! Good for them.', 'Honestly, deserved.'], neu: ['Hm.'], neg: ['Ugh. Rigged.'] },
    dunk: { pos: ['THE SEA?!', 'The sky did WHAT?'], neu: ['...What?'], neg: ['Sounds made up.'] },
    date: { pos: ['Aww!', 'Stop, that\'s so cute.'], neu: ['Oh, nice.'], neg: ['Ew. Get a room.'] },
  };
  def('rumor', {
    key: 'rumor', w: 1,
    setup: ctx => { const n = ctx.news; ctx.vars.na = n.a; ctx.vars.nb = n.b || ''; },
    beats: [
      { by: 'a', say: ['Okay, have you heard?', 'You will NOT believe what happened.', 'Did you hear the news?'] },
      { by: 'b', say: ['Heard what?', 'No? What happened?', 'Ooh. Tell me.'] },
      { by: 'a', say: ctx => RUMOR[ctx.news.kind] || ['Something happened. I forget what.'] },
      { by: 'b', judge: 'rumor', say: ctx => RUMOR_R[ctx.news.kind] || { pos: ['Wow!'], neu: ['Huh.'], neg: ['Hm.'] } },
      { by: 'a', say: ctx => ctx.news.kind === 'couple' ? ['I give it a month. Kidding! Mostly.', 'I\'m so happy for them. And a little jealous.'] : ctx.news.kind === 'fight' ? ['I hope they work it out.', 'This island is too small for drama.'] : ['Right?', 'I know.', 'Island news, man.'] },
    ],
  });

  // --- Asking about island lore someone started (Iroh's plans, etc.)
  def('followup', {
    key: 'lore', w: 1,
    beats: [
      { by: 'a', say: ctx => [`So how's the plan going? The one about... "${ctx.lore.text.replace(/\.$/, '')}"`, 'Wait, what happened with your big plan?', 'Any progress on the plan?'] },
      { by: 'b', say: ['Phase one is complete.', 'It\'s... in development.', 'We don\'t talk about the plan anymore.', 'Funny you ask. I need a volunteer.'] },
      { by: 'a', judge: 'joke', say: { pos: ['What was phase one?', 'I need to know everything.', 'I\'m invested. Keep me posted.'], neu: ['Okay...', 'Should I be worried?'], neg: ['So, nothing.', 'Sure it is.'] } },
      { by: 'b', say: ['Napping. Phase one was napping.', 'I\'ll tell you when you\'re older.', 'You\'ll find out. Everyone will find out.', 'Mostly drawing. Big drawings.'] },
    ],
  });

  // --- Shared hobby: let's do it together
  def('shared', {
    key: 'sharedLove', w: 1,
    beats: [
      { by: 'a', say: ctx => [`You love ${ctx.vars.shared} too, right?`, `Okay, real talk. ${cap(ctx.vars.shared)}. Best thing on the island?`] },
      { by: 'b', say: ['Obviously.', 'Don\'t even start, I could talk about it for hours.', 'Is that even a question?'] },
      { by: 'a', say: ['We should go together sometime.', 'Next time I go, you\'re coming.', 'We should make it a weekly thing.'] },
      { by: 'b', judge: 'sharedLove', say: { pos: ['Deal. No backing out.', 'Yes! Finally, someone who gets it.'], neu: ['Maybe. If I\'m free.', 'Sure, sometime.'], neg: ['I kind of like doing it alone.', 'Eh. Maybe.'] } },
    ],
    setup: ctx => { const l = ctx.a.loves.find(x => ctx.b.loves.includes(x)) || 'fishing'; ctx.vars.shared = IS.Dialogue.activityWord[l] || l; },
  });

  // --- Watching someone else and having opinions about it
  def('observe', {
    key: 'observe', w: 1,
    beats: [
      { by: 'a', say: ['Look at {third}. {ThirdNow}.', 'Is {third} seriously {thirdNow} right now?', 'Ha. There goes {third}, {thirdNow}.'] },
      { by: 'b', judge: 'observe', pick: ctx => (ctx.b.relTo(ctx.vars.third).friendship > 30 ? 'fond' : ctx.b.relTo(ctx.vars.third).friendship < -10 ? 'cold' : 'neu'), say: { fond: ['Classic {third}. Love that.', 'Honestly, {third} is the best.', 'Leave {third} alone, they\'re happy.'], neu: ['Huh. Good for them.', 'Typical.'], cold: ['Ugh. {third}.', 'Don\'t get me started on {third}.'] } },
      { by: 'a', say: ['Should we go bother them?', 'Bet you they\'ll be doing that for hours.', 'I wish I had that energy.'] },
      { by: 'b', say: ['Later. I\'m comfy.', 'Nah, let them be.', 'Ha, maybe.'] },
    ],
    setup: ctx => { ctx.vars.ThirdNow = cap(ctx.vars.thirdNow); },
  });

  // --- Upcoming event: you going? sit together?
  def('event', {
    key: 'eventSoon', w: 1,
    beats: [
      { by: 'a', say: ['You coming to the {event} {when}?', 'Are you going to the {event}?'] },
      { by: 'b', pick: ctx => { const ev = ctx.sim.events.nextEvent(); return ev && ev.attendees && ev.attendees.size ? (ev.attendees.get(ctx.b.name) ? 'yes' : 'no') : 'maybe'; }, say: { yes: ['Wouldn\'t miss it.', 'Obviously. Free food.', 'Yeah! You?'], no: ['Nah, I think I\'ll skip it.', 'Not feeling it, honestly.'], maybe: ['Maybe. Depends on my mood.', 'Probably?'] } },
      { by: 'a', judge: 'eventSoon', say: { pos: ['Save me a seat?', 'Sit with me, yeah?', 'It\'s going to be so good.'], neu: ['Cool.', 'Okay, see you there maybe.'], neg: ['Your loss.', 'Fine, more food for me.'] } },
      { by: 'b', if: ctx => ctx.v === 'pos', say: ['Deal.', 'Only if you don\'t steal my food.', 'Of course.'] },
    ],
  });

  // --- Food talk
  def('food', {
    key: 'food', w: 1,
    beats: [
      { by: 'a', say: ['What I\'d give for a pizza right now.', 'If I eat one more fish I\'m going to grow gills.', 'I keep dreaming about bread. Fresh bread.'] },
      { by: 'b', say: { any: ['Don\'t. Now I want one too.', 'Same. Every day.', 'The pantry is looking {pantry}, too.'], Lynn: ['I could make soup?'], Jude: ['I\'d eat two pizzas. Minimum.'] } },
      { by: 'a', say: ['We should do a cook-off.', 'Next supply boat, I\'m asking for cheese. So much cheese.', 'Tomatoes from the garden are basically pizza if you squint.'] },
      { by: 'b', judge: 'food', say: { pos: ['Okay, I\'m in. I\'ll win, though.', 'Yes. Cheese. Please.'], neu: ['Ha, sure.', 'Maybe.'], neg: ['You can\'t cook.', 'That is not how pizza works.'] } },
    ],
    setup: ctx => { const f = ctx.sim.world.food; ctx.vars.pantry = f < 5 ? 'pretty empty' : f < 12 ? 'a little thin' : 'fine, actually'; },
  });

  // --- Couple banter
  def('couple', {
    key: 'couple', w: 1,
    beats: [
      { by: 'a', say: ['Hey you.', 'There you are. Missed you.', 'Hi. Hi hi.'] },
      { by: 'b', say: ['Hey. Missed you too.', 'Oh, hi. You\'re cute today.', 'Hi.'] },
      { by: 'a', say: ['Walk with me later? Just us?', 'Dinner together tonight?', 'I was just thinking about you.'] },
      { by: 'b', judge: 'couple', say: { pos: ['Always.', 'You\'re ridiculous. Yes.', 'Stop, people are looking. ...Don\'t stop.'], neu: ['Maybe. I\'ve got stuff to do.'], neg: ['Not tonight. I\'m tired.'] } },
    ],
  });

  // --- Sky Hand stories
  def('skyhand', {
    key: 'skyhand', w: 1,
    beats: [
      { by: 'a', say: ['You will never believe what happened to me.', 'Okay, don\'t laugh.'] },
      { by: 'b', say: ['...What?', 'Try me.'] },
      { by: 'a', say: ['A giant HAND picked me up. From the SKY.', 'I was flying. Actually flying. Something grabbed me by the collar.'] },
      { by: 'b', judge: 'skyhand', say: { pos: ['WHAT?! Are you okay?', 'I KNEW something was up there!'], neu: ['...Did you hit your head?', 'Okay...'], neg: ['Sure. And I\'m a mermaid.', 'You dreamed that.'] } },
      { by: 'a', say: ['I\'m serious! I saw the whole island!', 'It was terrifying. And kind of amazing.', 'I think it likes me. Or hates me. Hard to tell.'] },
    ],
  });

  // --- Comfort, venting
  def('comfort', {
    key: 'comfort', w: 1,
    beats: [
      { by: 'a', say: ['Hey. You okay? You seem down.', 'I heard. Come here. Want to talk about it?'] },
      { by: 'b', say: ['...Not really.', 'I\'m fine. Totally fine.', 'It\'s just been a rough day.'] },
      { by: 'a', say: ['You don\'t have to be fine.', 'I brought snacks. And ears. For listening.', 'For what it\'s worth, you deserve better.'] },
      { by: 'b', judge: 'comfort', say: { pos: ['...Thanks. I really needed that.', 'You\'re a good friend, you know that?'], neu: ['Yeah. Thanks.'], neg: ['I just want to be alone right now.'] } },
    ],
  });
  def('vent', {
    key: 'vent', w: 1,
    beats: [
      { by: 'a', say: ['Can I talk to you about something?', 'I can\'t stop thinking about it.'] },
      { by: 'b', say: ['Of course. What\'s up?', 'Always. Go.'] },
      { by: 'a', say: ['I keep thinking about {about}.', 'Everything reminds me of {about} today.', 'Is it dumb that I\'m still sad about {about}?'] },
      { by: 'b', judge: 'vent', say: { pos: ['It\'s not dumb. It\'s gonna be okay.', 'You\'re allowed to be sad. I\'m here.'], neu: ['Give it time.'], neg: ['You need to move on.'] } },
      { by: 'a', say: { pos: ['Thanks. Really.', 'Yeah. Okay.'], neu: ['Yeah...'], neg: ['...Right.'] } },
    ],
    setup: ctx => { const e = IS.Mind.feeling(ctx.a); ctx.vars.about = e && e.about ? e.about : 'everything'; },
  });

  // --- Fights that can escalate or cool off
  def('argue', {
    key: 'argue', w: 1,
    beats: [
      { by: 'a', say: ['Can we talk about what you did?', 'You know what, {other}? I\'ve had it.', 'Why do you ALWAYS do that?!'] },
      { by: 'b', say: ['Excuse me?', 'Oh, here we go.', 'What did I do NOW?'] },
      { by: 'a', say: ['You left the dock a mess. Again.', 'You never listen to anything I say!', 'You took my spot and you know it.', 'You\'re exhausting, that\'s what.'] },
      { by: 'b', judge: 'argue', pick: ctx => ctx.b.traits.kind > 0.7 ? 'cool' : 'hot', say: { hot: ['You\'re one to talk!', 'Unbelievable. I\'m done.', 'Fine! Whatever!'], cool: ['...Okay. I\'m not doing this right now.', 'Let\'s talk when you\'ve calmed down.'] } },
    ],
  });
  def('apology', {
    key: 'apology', w: 1,
    beats: [
      { by: 'a', say: ['Hey... got a sec?', 'Can we talk? About earlier?'] },
      { by: 'b', say: ['...What.', 'Okay. Talk.', 'Depends.'] },
      { by: 'a', say: ['I\'m sorry. I was a jerk.', 'I said some stuff I didn\'t mean. I\'m sorry.', 'I hate fighting with you. Sorry.'] },
      { by: 'b', judge: 'apology', say: { pos: ['...It\'s okay. I\'m sorry too.', 'Water under the dock.', 'Thanks. We\'re good.'], neu: ['Okay. Thanks for saying it.'], neg: ['Words are cheap.', 'Hmph. We\'ll see.'] } },
      { by: 'a', if: ctx => ctx.v === 'pos', say: ['Hug it out?', 'Friends?', 'Okay. Good. Good.'] },
    ],
  });
  def('confess', {
    key: 'confess', w: 1,
    beats: [
      { by: 'a', say: ['Hey, {other}... can I tell you something?', 'Okay. I need to say something before I lose my nerve.'] },
      { by: 'b', say: ['Of course. What is it?', '...You\'re scaring me a little.'] },
      { by: 'a', say: ['I think I\'m falling for you.', 'I really, really like you. Like, like-like.', 'I\'ve liked you for a while now.'] },
      { by: 'b', judge: 'confess', say: { pos: ['...I feel the same way.', 'I was hoping you\'d say that.', 'Took you long enough. Yes.'], neu: ['I... need to think.'], neg: ['Oh... I\'m sorry. I don\'t feel the same.', 'I care about you. Just... not like that.'] } },
      { by: 'a', say: { pos: ['Really?!', 'Okay. Wow. Okay!'], neu: ['Take your time.'], neg: ['...Right. Okay. Sorry.', 'No, it\'s fine. It\'s fine.'] } },
    ],
  });
  def('congrats', {
    key: 'congrats', w: 1,
    beats: [
      { by: 'a', say: ctx => ctx.news && ctx.news.kind === 'won' ? ['Champion of the dock! Congrats!', 'You actually won! Congrats!'] : ['You and {partnerOf}?! Congrats!! Finally!', 'Okay, you two are adorable. Congrats!'] },
      { by: 'b', judge: 'congrats', say: ['Hehe, thanks!', 'Thank you!!', 'Aww, thanks!'] },
      { by: 'a', say: ctx => ctx.news && ctx.news.kind === 'won' ? ['Teach me your secrets.', 'Don\'t let it go to your head.'] : ['Be nice to each other.', 'I want details. Later.'] },
    ],
    setup: ctx => { ctx.vars.partnerOf = ctx.news ? (ctx.news.a === ctx.b.name ? ctx.news.b : ctx.news.a) : 'them'; },
  });
  def('checkOn', {
    key: 'checkOn', w: 1,
    beats: [
      { by: 'a', say: ['Are you okay?! That looked terrifying!', 'I saw you go flying! You okay?'] },
      { by: 'b', judge: 'checkOn', say: ['I\'m okay... I think.', 'My pride is hurt. Mostly my pride.', 'I\'m soaked. And confused.'] },
      { by: 'a', say: ['What even WAS that?', 'Come on, let\'s get you dry.', 'This island is so weird.'] },
    ],
  });

  // Lines that bridge one topic to another
  const SEGUE = ['Oh, that reminds me—', 'Anyway!', 'Okay, totally unrelated, but—', 'Oh! Before I forget—', 'Wait, also—'];
  const BYE = {
    a: ['Anyway, I should {aNext}.', 'Okay, I gotta {aNext}. Later!', 'I\'ll let you go. Gonna {aNext}.', 'Alright, I\'m gonna {aNext}. See you!'],
    b: { warm: ['See you later!', 'Bye! Don\'t be a stranger.', 'Later!'], cool: ['Bye.', 'See ya.', 'Mm. Bye.'] },
  };

  // ------------------------------------------------------------ lore
  T.addLore = (sim, l) => {
    sim.lore = sim.lore || [];
    sim.lore.push({ id: (sim.loreId = (sim.loreId || 0) + 1), t: sim.clock.abs, ...l });
    if (sim.lore.length > 20) sim.lore.shift();
  };

  // ------------------------------------------------------------ choosing
  const BYKEY = {};
  for (const t of Object.values(TH)) (BYKEY[t.key] = BYKEY[t.key] || []).push(t);

  // Turn a topic (from the topic weighting in social.js) into a thread
  T.threadFor = (sim, a, b, topic, extra = {}) => {
    let list = (BYKEY[topic] || []).filter(t => !t.who || t.who.includes(a.name));
    if (topic === 'catchphrase' && !list.length) list = [];
    if (!list.length) return null;
    if ((topic === 'congrats') && !extra.news) extra.news = (sim.news || []).slice().reverse().find(n => a.knows.has(n.id) && (n.kind === 'couple' || n.kind === 'won') && (n.a === b.name || n.b === b.name));
    if (topic === 'congrats' && !extra.news) return null;
    if (topic === 'tease' && !extra.crush) { extra.crush = IS.Dialogue.crushOf(b); if (!extra.crush || extra.crush === a) return null; }
    if (topic === 'rumor' && !extra.news) return null;
    if (topic === 'lore' && !extra.lore) return null;
    const th = IS.pick(list);
    const ctx = T.ctx(sim, a, b, extra);
    if (extra.crush) ctx.vars.crush = extra.crush.name;
    if (extra.third) { ctx.third = extra.third; ctx.vars.third = extra.third.name; ctx.vars.thirdNow = IS.Social.nowWord(extra.third); }
    if (th.setup) th.setup(ctx);
    return { th, ctx, beat: 0 };
  };

  T.pickThread = (sim, a, b, used) => {
    const cands = IS.Social.chooseTopic(sim, a, b, used, true);
    // Lore: someone heard about a plan and wants to know how it's going
    const lore = (sim.lore || []).find(l => l.owner === b.name && l.knownBy.includes(a.name) && sim.clock.abs - l.t > 240 && !(l.asked || []).includes(a.name));
    if (lore) cands.push({ topic: 'lore', w: 2.4, extra: { lore } });
    const usable = cands.filter(c => !used.has(c.topic) && (BYKEY[c.topic] || []).some(t => !t.who || t.who.includes(a.name)));
    if (!usable.length) return null;
    const c = IS.weightedPick(usable);
    if (c.topic === 'lore') { c.extra.lore.asked = c.extra.lore.asked || []; c.extra.lore.asked.push(a.name); }
    return T.threadFor(sim, a, b, c.topic, c.extra || {});
  };

  // ------------------------------------------------------------ playing
  // Returns the next line { sp, text, emote } of a running thread, or null when it's done.
  T.step = (conv, run) => {
    const { th, ctx } = run;
    while (run.beat < th.beats.length) {
      const beat = th.beats[run.beat++];
      if (beat.if && !beat.if(ctx)) continue;
      const sp = beat.by === 'a' ? ctx.a : ctx.b;
      const li = sp === ctx.a ? ctx.b : ctx.a;
      let stock = null;
      if (beat.judge) {
        // The listener of the previous line reacts: relationship effects happen here
        const out = IS.Social.react(conv.sim, li, sp, { topic: beat.judge, text: '', tone: 'neutral', extra: ctx.reactExtra || { third: ctx.third, crush: ctx.vars.crush ? conv.sim.byName(ctx.vars.crush) : null, news: ctx.news, memory: null } });
        conv.totalDelta += out.df || 0;
        ctx.v = out.df > 0.9 ? 'pos' : out.df < -0.4 ? 'neg' : 'neu';
        if (beat.judge === 'confess') ctx.v = sp.relTo(li.name).partner ? 'pos' : 'neg';
        if (beat.judge === 'apology') ctx.v = out.df > 5 ? 'pos' : 'neg';
        stock = out;
        if (out.endsChat) run.endsAfter = true;
      }
      const pool = resolve(beat.say, ctx, sp, beat);
      let text = pool.length ? pick(pool.map(l => fill(l, ctx, sp)), sp.name) : null;
      if (!text && stock && stock.text) text = stock.text;
      if (!text) continue;
      return { sp, text, emote: stock && stock.emote };
    }
    if (th.after && !run.afterDone) { run.afterDone = true; th.after(ctx, conv.sim); }
    return null;
  };

  T.segue = (conv, sp) => pick(SEGUE, sp.name);
  T.bye = (conv, a, b) => {
    const ctx = T.ctx(conv.sim, a, b);
    const warm = b.relTo(a.name).friendship > 20 && b.traits.grumpy < 0.5;
    return [
      { sp: a, text: fill(pick(BYE.a, a.name), ctx, a) },
      { sp: b, text: fill(pick(warm ? BYE.b.warm : BYE.b.cool, b.name), ctx, b) },
    ];
  };
  T.has = topic => !!BYKEY[topic];

  return T;
})();
