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
      event: ev ? ev.name : 'the next dinner', eventBday: ev && ev.birthday ? ev.birthday : null,
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
      if (k === 'pet') return IS.Love ? IS.Love.pet(sp, other) : other.name;
      // "Egg is going to see Forest" said by Forest -> "going to see me"
      if (k === 'thirdNow' && ctx.vars.thirdNow) return ctx.vars.thirdNow.replace(new RegExp(`\\b${sp.name}\\b`, 'g'), 'me').replace(new RegExp(`\\b${other.name}\\b`, 'g'), 'you');
      if (k === 'event' && ctx.vars.eventBday === sp.name) return 'my birthday party';
      if (k === 'event' && ctx.vars.eventBday === other.name) return 'your birthday party';
      if (k === 'self') return sp.name;
      const v = ctx.vars[k];
      return v !== undefined ? v : m;
    }).replace(/\{(\w+)\}/g, (m, k) => (ctx.vars[k] !== undefined ? ctx.vars[k] : m));
  };

  // A beat's lines can be: a list, a function, or an object keyed by the
  // speaker's name, by the reaction (pos/neu/neg), or by a custom pick.
  const resolve = (say, ctx, sp, beat) => {
    if (typeof say === 'function') return resolve(say(ctx, sp), ctx, sp, beat);
    if (typeof say === 'string') return [say];
    if (Array.isArray(say)) return IS.more(say);
    if (say && typeof say === 'object') {
      // Personal lines win often, but a tiny personal pool shouldn't drown out the shared one
      const own = say[sp.name];
      if (own && Math.random() < (Array.isArray(own) ? Math.min(0.7, own.length * 0.15) : 0.5)) return resolve(own, ctx, sp, beat);
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
      { by: 'a', say: ['What are you doing later?', 'Got plans this {partofday}?', 'What\'s the move later?', 'Busy rest of the day?', 'What\'s next on your list?'] },
      { by: 'b', say: ctx => [`Thinking I'll ${ctx.vars.bNext}.`, `Probably ${ctx.vars.bNext}. You?`, `I really need to ${ctx.vars.bNext}.`] },
      { by: 'a', judge: 'plans', say: {
        pos: ctx => ctx.vars.aNext === ctx.vars.bNext ? ['Wait, me too! Let\'s go together.', 'Same! Meet you there?'] : [`Nice. I'm gonna ${ctx.vars.aNext}.`, `Fun. I should ${ctx.vars.aNext} at some point.`],
        neu: [`Cool. I'll probably ${'{aNext}'}.`, 'Fair.'],
        neg: ['Sounds like a lot of effort.', 'Have fun with that.'] } },
      { by: 'b', if: ctx => ctx.v === 'pos', say: ctx => ctx.vars.aNext === ctx.vars.bNext ? ['Deal. Don\'t be late.', 'It\'s a date. A friend date. A frate.', 'Race you there.'] : ['Have fun!', 'Look at you, with a plan.', 'Don\'t work too hard.', 'Ooh, nice. Tell me how it goes.', 'Save some fun for the rest of us.'] },
    ],
  });

  // --- A real question, a real answer, and a follow-up on that answer
  const QS = [
    { q: 'What\'s your favourite thing about the island?', a: b => b.loves[0] ? `${cap(IS.Dialogue.activityWord[b.loves[0]] || b.loves[0])}. Easy.` : 'The quiet.', f: { pos: ['Ha, I knew you\'d say that.', 'Same, honestly.'], neu: ['Fair answer.', 'Makes sense.'], neg: ['Boring answer.', 'Really? That?'] } },
    { q: 'If you could leave for one day, where would you go?', a: b => b.traits.curious > 0.6 ? 'A huge library. I\'d never come out.' : (b.cfg.quirks || []).includes('greedy') ? 'A buffet. All of them.' : b.traits.sociable > 0.8 ? 'A party. A huge one.' : 'Nowhere. I like it here.', f: { pos: ['Okay, I respect that.', 'Take me with you.'], neu: ['Interesting.', 'Huh.'], neg: ['Of course you would.', 'Weird choice.'] } },
    { q: 'Morning person or night person?', a: b => b.traits.energetic > 0.75 ? 'Both. Sleep is optional.' : b.wakeMin > 7 * 60 ? 'Night. Mornings are a scam.' : 'Mornings. Best light of the day.', f: { pos: ['Same!', 'Knew it.'], neu: ['Hm. Opposite of me.', 'Fair.'], neg: ['Wrong answer.', 'We can\'t be friends.'] } },
    { q: 'One giant crab or ten tiny crabs. Who wins?', a: b => brave(b) ? 'I\'d take the giant crab. Easy.' : 'I\'d lose to both. Next question.', f: { pos: ['Hahaha, valid.', 'Okay, I believe you.'], neu: ['Debatable.', 'Bold.'], neg: ['You would lose so fast.', 'Delusional.'] } },
    { q: 'Do you think the Sky Hand is real?', a: b => b.grabCount ? 'I\'ve BEEN up there. It\'s real.' : b.traits.curious > 0.6 ? 'Something\'s up there, for sure.' : 'Nah. People just trip a lot.', f: { pos: ['Right?! Thank you!', 'Finally someone gets it.'], neu: ['Hmm. Maybe.', 'Spooky.'], neg: ['Sure, sure.', 'Okay, conspiracy theorist.'] } },
    { q: 'What would you do with a whole free day?', a: b => b.traits.hardworking > 0.75 ? 'Fix the fence. Then the other fence.' : isLazy(b) ? 'Nap. Then nap again.' : 'Beach all day. No notes.', f: { pos: ['Honestly, perfect.', 'Living the dream.'], neu: ['Hm, okay.', 'Interesting choice.'], neg: ['That\'s so sad.', 'That is NOT a free day.'] } },
    { q: 'Do you have a crush on anyone? Be honest.', a: (b, a) => { const c = IS.Dialogue.crushOf(b); if (!c) return 'Nope. Free as a seagull.'; if (c === a) return '...Why are you asking ME that?'; return b.traits.sociable > 0.8 ? `Okay, fine. ${c.name}. Don't tell!` : 'What? No. ...Maybe. Next question.'; }, f: { pos: ['Your secret\'s safe with me.', 'I KNEW it.'], neu: ['Interesting...', 'Noted. Very noted.'], neg: ['Wow, okay, defensive.', 'Suspicious.'] } },
    { q: 'What\'s the best thing you\'ve eaten here?', a: b => IS.pick(['That berry pie at the last dinner.', 'Fresh fish off the grill.', b.name === 'Lynn' ? 'My own soup, if I\'m honest.' : 'Lynn\'s soup. Every time.', 'A tomato straight off the vine.']), f: { pos: ['Oh, good call.', 'Now I\'m hungry.'], neu: ['Hm, okay.', 'Not bad.'], neg: ['Overrated.', 'Pfft.'] } },
    { q: 'What\'s the most annoying thing about living here?', a: b => b.name === 'Beach' ? 'The WiFi. Or the lack of it.' : b.traits.grumpy > 0.3 ? 'The seagulls. They have no respect.' : 'Honestly? Sand. Everywhere. Always.', f: { pos: ['Ha! So true.', 'Don\'t get me started on the seagulls.'], neu: ['Fair.', 'Hm, yeah.'], neg: ['That\'s what you\'re complaining about?', 'Get over it.'] } },
    { q: 'If you could have one thing from the mainland, what would it be?', a: b => (b.cfg.quirks || []).includes('greedy') ? 'Pizza. Every kind of pizza.' : b.traits.curious > 0.6 ? 'A library card.' : b.name === 'Beach' ? 'My phone. With signal.' : 'Proper coffee.', f: { pos: ['Oh, good answer.', 'Now I want that too.'], neu: ['Interesting.', 'Huh.'], neg: ['Of all things?', 'Weird pick.'] } },
    { q: 'Who on the island makes you laugh the most?', a: (b, a) => { const best = Object.entries(b.rel).filter(([n]) => n !== b.name).sort((x, y) => y[1].friendship - x[1].friendship)[0]; return best ? (best[0] === a.name ? 'You, obviously. Don\'t let it go to your head.' : `${best[0]}. Every single day.`) : 'The cat.'; }, f: { pos: ['Aww.', 'Ha, I can see that.'], neu: ['Hm.', 'Okay.'], neg: ['Really?', 'Them? Wow.'] } },
    { q: 'What\'s your secret talent?', a: b => ({ Iroh: 'I can hold my breath for two minutes. Probably.', Forest: 'I can split a log with one swing. Every time.', Egg: 'I can fall asleep anywhere. Standing up, even.', Jude: 'Charm. Obviously. Next.', Beach: 'I can tell real gold from fake from across a room.', Lynn: 'I can name every star you can see from here.' }[b.name] || 'I\'m very good at nothing.'), f: { pos: ['Okay, that\'s actually impressive.', 'Prove it.'], neu: ['Huh.', 'Sure.'], neg: ['That\'s not a talent.', 'Doubt it.'] } },
    { q: 'Do you miss anything about life before the island?', a: b => b.traits.sociable > 0.8 ? 'The noise. The people. Parties.' : b.traits.kind > 0.8 ? 'My family. But this lot is family now.' : 'Not really. Is that weird?', f: { pos: ['That\'s kind of sweet.', 'Yeah. Me too.'], neu: ['Fair enough.', 'Hm.'], neg: ['Huh. Cold.', 'Okay...'] } },
    { q: 'Be honest. Am I a good fisher?', a: (b, a) => a.loves.includes('fishing') ? 'Honestly? Yeah. Annoyingly good.' : 'You fish like a cat swims.', f: { pos: ['Thank you! Finally!', 'I\'ll take it.'], neu: ['Okay, fair.', 'Hm.'], neg: ['Rude!', 'I\'m telling everyone you said that.'] } },
  ];
  def('question', {
    key: 'question', w: 1.1,
    setup: ctx => {
      // Don't ask what you've already asked them, or what they've already answered
      const asked = ctx.a.asked = ctx.a.asked || {};
      const pool = QS.filter((q, i) => !(asked[ctx.b.name] || []).includes(i) && !(ctx.b.answered || []).includes(i));
      ctx.q = IS.pick(pool.length ? pool : QS);
      const i = QS.indexOf(ctx.q);
      (asked[ctx.b.name] = asked[ctx.b.name] || []).push(i);
      (ctx.b.answered = ctx.b.answered || []).push(i);
    },
    beats: [
      { by: 'a', say: ctx => [ctx.q.q] },
      { by: 'b', say: ctx => [ctx.q.a(ctx.b, ctx.a)] },
      { by: 'a', judge: 'question', say: ctx => ctx.q.f },
      { by: 'b', say: { pos: ['What about you?', 'Your turn. Same question.'], neu: ['What, what would you say?', 'Okay, you answer then.'], neg: ['Like you have a better answer.', 'Oh, and yours is so great?'] } },
      { by: 'a', say: ctx => { const mine = ctx.q.a(ctx.a, ctx.b).replace('Why are you asking ME that?', 'Not telling.'); return mine === ctx.q.a(ctx.b, ctx.a) ? ['Honestly? Same answer.', 'Same as you, weirdly.', 'Ha. Same.'] : [mine]; } },
    ],
  });

  // --- The schemer: each islander's catchphrase opens their own little bit
  const SCHEMES = ['We build a raft and see what\'s past the lighthouse.', 'We teach {cat} to fish. Then we retire.', 'We sneak onto the supply boat and ride it to the mainland and back.', 'We dig a pool next to the beach. A pool. Next to the ocean.', 'We start a band. I\'ll learn an instrument by Thursday.', 'Midnight fishing. Glow-in-the-dark bait. Don\'t ask how.', 'We build a treehouse in the big oak by the forest.', 'We train the seagulls. As an army. A friendly army.', 'We dig for treasure under the plaza. Tonight.', 'We swap everyone\'s houses while they sleep. As a bit.', 'We make a giant sandcastle. A sandcastle CITY.', 'We start an island newspaper. I\'m the editor. You\'re the paper boy.'];
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
  // Newcomers say their own catchphrases (newcomers.js)
  def('newCatch', {
    key: 'catchphrase', w: 1, who: IS.Newcomers.NAMES,
    setup: ctx => { ctx.vars.cp = IS.pick(ctx.a.cfg.catchphrases || ['Hm.']); },
    beats: [
      { by: 'a', say: ctx => [ctx.vars.cp] },
      { by: 'b', judge: 'joke', say: { pos: ['Ha! You always say that.', 'And that\'s why I like you.', 'Never change.'], neu: ['...Okay.', 'Sure.', 'If you say so.'], neg: ['You say that a lot.', 'Please stop saying that.', 'Ugh.'] } },
    ],
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
    ['Why don\'t eggs tell jokes?', 'They\'d crack each other up.'],
    ['What do you call a fake noodle?', 'An impasta.'],
    ['Why did the tomato blush?', 'It saw the salad dressing.'],
    ['How does a cat catch fish?', 'With purr-severance.'],
    ['Why was the beach so wet?', 'Because the sea weed.'],
    ['What do you call a lazy kangaroo?', 'A pouch potato.'],
    ['Why did the lighthouse go to school?', 'To get a little brighter.'],
    ['What did one wave say to the other?', 'Long time no sea.'],
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
      { by: 'a', say: { any: ['The sunset\'s nicer when you\'re around.', 'You look really good today.', 'I keep finding reasons to walk past wherever you are.'], Jude: ['Careful. You\'re staring again.', 'You know you can\'t resist me, right?'], Forest: ['You look... good. That\'s all.', 'I like when you\'re around. You make the work go faster.', 'You\'ve got dirt on your face. ...It suits you.', 'I saved you the best spot by the water.'], Iroh: ['Is it hot out here or is it just you? Wait. Don\'t answer.'], Egg: ['You\'re like a cat in a sunbeam. In a good way.'] } },
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
    burned: ['{na} got set on FIRE today. They lived, somehow.', 'So {na} was literally on fire earlier. Like, flames.'],
    blessed: ['The sky blessed {na}. There was a golden beam and everything.', '{na} got hit by this glowing light and now they\'re all smiley.'],
    flung: ['A meteor nearly flattened {na}. They went FLYING.', '{na} got blasted across the island. By a METEOR.'],
    nearMiss: ['Lightning struck right next to {na}. Like, inches away.', 'The sky almost fried {na} today.'],
    meteor: ['A meteor crashed down near {na}. There\'s a crater now. A CRATER.', 'Did you hear that boom? A rock fell out of the sky near {na}.'],
    weird: ['{na} started {detail} out of nowhere. Just... {detail}.', 'Is {na} okay? I saw them {detail} for no reason at all.'],
    levelUp: ['{na} is a {detail} now, apparently. They won\'t stop talking about it.', 'Did you hear {na} became a {detail}?'],
    rareFind: ['{na} found a {detail}! An actual {detail}!', 'Guess what {na} found. A {detail}. So lucky.'],
    bonk: ['A coconut fell right on {na}\'s head. I can\'t stop laughing.', '{na} got bonked by a coconut earlier. Bonk.'],
    bees: ['{na} got chased by BEES in the garden.', 'Did you see {na} running from the bees? Incredible.'],
    treasure: ['{na} dug up buried treasure! A {detail}!', 'There was actual treasure on the island. {na} found a {detail}.'],
    treasureMap: ['{na} found a treasure map. There\'s an X somewhere on the island.', 'Psst. {na} has a treasure map. X marks the spot.'],
    kitten: ['{na} adopted a kitten! It\'s called {detail}.', 'There\'s a new kitten on the island. {na} named it {detail}.'],
    painting: ['{na} painted "{detail}". It\'s honestly beautiful.', 'Have you seen {na}\'s new painting? "{detail}". Stunning.'],
    concert: ['{na} played guitar earlier and people actually stopped to listen.', 'Did you hear {na} play? They\'re good now!'],
    engaged: ['{na} and {nb} are ENGAGED! There\'s going to be a wedding!', '{na} got down on one knee for {nb}. ONE KNEE.'],
    building: ['They\'re building a {detail}! Over by the path.', 'There\'s a {detail} going up. A real one.'],
    built: ['The new {detail} is finished! Have you seen it?', 'We have a {detail} now. An actual {detail}.'],
    visitor: ['There\'s a visitor on the island. {na}. Came in on the boat.', 'Have you met {na}? New face. Just visiting, apparently.'],
    movedIn: ['{na} is staying! They live here now.', 'Big news: {na} moved in for good.'],
    wedding: ['{na} and {nb} got married! I cried the whole time.', 'The wedding! {na} and {nb}! Did you see?'],
    makeup: ['{na} and {nb} made up. Kissed right there by the path.', 'Good news: {na} and {nb} are talking again.'],
    gift: ['{na} gave {nb} {detail}. For no reason. Just love.', 'Did you see what {na} got {nb}? {detail}!'],
    notYet: ['{na} proposed to {nb}... and {nb} said "not yet". Oof.', 'Don\'t say anything, but {nb} turned down a proposal from {na}.'],
  };
  const RUMOR_R = {
    fight: { pos: ['Yikes. About what?', 'Again? Those two...'], neu: ['Oof.', 'Huh.'], neg: ['I\'m staying out of that.', 'Not my business.'] },
    couple: { pos: ['No WAY! I called it!', 'Wait, seriously?! Good for them!'], neu: ['Huh. Okay.', 'Didn\'t see that coming.'], neg: ['...Oh. Cool. Great.', 'Whatever. Good for them.'] },
    rejected: { pos: ['Oh no. Poor thing.', 'Ouch. That\'s rough.'], neu: ['Oof.'], neg: ['Can\'t say I\'m surprised.'] },
    breakup: { pos: ['What?! They were so cute!', 'Oh no. Are they okay?'], neu: ['Huh.'], neg: ['Saw that coming.'] },
    won: { pos: ['Ha! Good for them.', 'Honestly, deserved.'], neu: ['Hm.'], neg: ['Ugh. Rigged.'] },
    dunk: { pos: ['THE SEA?!', 'The sky did WHAT?'], neu: ['...What?'], neg: ['Sounds made up.'] },
    date: { pos: ['Aww!', 'Stop, that\'s so cute.'], neu: ['Oh, nice.'], neg: ['Ew. Get a room.'] },
    burned: { pos: ['WHAT?! Are they okay?!', 'On FIRE? Poor thing.'], neu: ['...On fire? Like, actual fire?'], neg: ['Huh. Toasty.'] },
    blessed: { pos: ['Lucky! Why don\'t I get beams?', 'Aww, that\'s kind of beautiful.'], neu: ['Weird. Good weird, I guess.'], neg: ['Of course it was them.'] },
    flung: { pos: ['Are they hurt?!', 'This island is getting dangerous.'], neu: ['A METEOR?'], neg: ['Sounds made up.'] },
    nearMiss: { pos: ['That\'s terrifying.', 'I\'m staying indoors.'], neu: ['Yikes.'], neg: ['Shame it missed. Kidding!'] },
    meteor: { pos: ['A CRATER?! I have to see this.', 'Okay, the sky is officially out of control.'], neu: ['Wow.'], neg: ['Probably a big hailstone.'] },
    weird: { pos: ['Honestly? Iconic.', 'Haha, I love that.'], neu: ['...Huh.'], neg: ['Weirdo.'] },
    levelUp: { pos: ['Good for them! They earned it.', 'Okay, that\'s impressive.'], neu: ['Cool.'], neg: ['Here we go. More bragging.'] },
    rareFind: { pos: ['NO WAY. I need to see it.', 'So lucky!'], neu: ['Huh, nice.'], neg: ['Probably fake.'] },
    bonk: { pos: ['HAHA. Is their head okay?', 'Nature is undefeated.'], neu: ['Ouch.'], neg: ['Deserved, honestly.'] },
    bees: { pos: ['HAHAHA. Are they okay though?', 'Not the bees!'], neu: ['Yikes.'], neg: ['Ha. Good.'] },
    treasure: { pos: ['ACTUAL treasure?! On OUR island?!', 'I\'m digging up the whole beach tomorrow.'], neu: ['Wow.'], neg: ['Finders keepers, I guess.'] },
    treasureMap: { pos: ['I\'m helping. I\'m SO helping.', 'Where?! Where\'s the X?'], neu: ['A treasure map? Seriously?'], neg: ['Probably a prank.'] },
    kitten: { pos: ['A KITTEN?! I need to meet it.', 'Stop. That\'s adorable.'], neu: ['Oh, cute.'], neg: ['More fur everywhere. Great.'] },
    painting: { pos: ['I want to see it!', 'We should hang it in the Hall.'], neu: ['Nice.'], neg: ['I\'ve seen better.'] },
    concert: { pos: ['I need to hear this!', 'Our own island musician!'], neu: ['Huh, cool.'], neg: ['My ears disagree.'] },
    engaged: { pos: ['A WEDDING?! I\'m crying already.', 'Finally! I need an outfit.'], neu: ['Wow. Fast.'], neg: ['...Good for them. I guess.'] },
    building: { pos: ['A {detail}?! Finally!', 'Ooh, I\'ll go help.'], neu: ['Huh. Nice.'], neg: ['More hammering. Great.'] },
    built: { pos: ['I have to see it!', 'This island is turning into a real town.'], neu: ['Oh, cool.'], neg: ['It\'s fine, I guess.'] },
    visitor: { pos: ['Ooh, a new face! I have to meet them.', 'A visitor? We should make them feel welcome.'], neu: ['Huh. Okay.'], neg: ['Great. Another person.'] },
    movedIn: { pos: ['Yay! The island\'s getting bigger!', 'Welcome to the family, then.'], neu: ['Oh, cool.'], neg: ['Hope they don\'t take my bench.'] },
    wedding: { pos: ['Our first island wedding!', 'Stop, I\'m going to cry again.'], neu: ['Nice.'], neg: ['Give it a month.'] },
    makeup: { pos: ['Oh thank goodness.', 'Good. They\'re better together.'], neu: ['Huh, okay.'], neg: ['Until the next fight.'] },
    gift: { pos: ['Aww! Why does nobody get ME stuff?', 'Okay, that\'s adorable.'], neu: ['Cute.'], neg: ['Show-offs.'] },
    notYet: { pos: ['Oh no. Poor thing.', 'Ouch. On one knee and everything?'], neu: ['Yikes.'], neg: ['Smart, honestly.'] },
  };
  def('rumor', {
    key: 'rumor', w: 1,
    setup: ctx => { const n = ctx.news; ctx.vars.na = n.a; ctx.vars.nb = n.b || ''; ctx.vars.detail = n.detail || 'acting weird'; },
    beats: [
      { by: 'a', say: ['Okay, have you heard?', 'You will NOT believe what happened.', 'Did you hear the news?'] },
      { by: 'b', say: ['Heard what?', 'No? What happened?', 'Ooh. Tell me.'] },
      { by: 'a', say: ctx => RUMOR[ctx.news.kind] || ['Something happened. I forget what.'] },
      { by: 'b', judge: 'rumor', say: ctx => RUMOR_R[ctx.news.kind] || { pos: ['Wow!'], neu: ['Huh.'], neg: ['Hm.'] } },
      { by: 'a', say: ctx => ctx.news.kind === 'couple' ? ['I give it a month. Kidding! Mostly.', 'I\'m so happy for them. And a little jealous.'] : ctx.news.kind === 'fight' ? ['I hope they work it out.', 'This island is too small for drama.'] : ['Right?', 'I know.', 'Island news, man.'] },
    ],
  });

  // --- Your own big news, told in first person
  const MINE = {
    movedIn: ['I live here now! Officially!', 'Guess who\'s a real islander now? Me!'],
    engaged: ['{partner} and I are getting MARRIED!', 'Guess who\'s engaged? Me! To {partner}!'],
    wedding: ['I got married! To {partner}! It\'s real!', 'Hi. I\'m a married person now. {partner} and I did it.'],
    makeup: ['{partner} and I made up. We\'re good again.', 'We sorted it out, {partner} and me. All good.'],
    couple: ['Okay, so... {partner} and I are together now.', 'I have news. {partner} and I are a thing.', 'Don\'t freak out. {partner} and I are dating.'],
    won: ['I won the fishing contest. Just saying.', 'You\'re looking at the fishing champion.'],
    breakup: ['{partner} and I broke up.', 'So... {partner} and I aren\'t together anymore.'],
    dunk: ['The sky threw me in the sea today.', 'I got dropped in the ocean. By the SKY.'],
    rejected: ['I told {partner} how I feel. They said no.', 'I confessed to {partner}. It did not go well.'],
    burned: ['I got set on fire today. Actual fire.', 'The sky set me on FIRE. I\'m still smoking a bit.'],
    blessed: ['The sky blessed me! There was this golden light...', 'Something up there likes me. I got a whole beam.'],
    flung: ['A meteor nearly hit me. I flew. Like, FLEW.', 'I got blasted by a meteor and I\'m somehow fine.'],
    nearMiss: ['Lightning hit right next to me. I can still hear it.', 'The sky almost fried me today.'],
    levelUp: ['I\'m officially a {detail} now. Just so you know.', 'Guess who\'s a {detail}? Me. It\'s me.'],
    rareFind: ['I found a {detail}! Look at it!', 'Okay, don\'t freak out. I found a {detail}.'],
    bonk: ['A coconut fell on my head today. My HEAD.', 'I got bonked by a coconut. Don\'t laugh.'],
    treasure: ['I dug up actual treasure. A {detail}!', 'I followed the map and found a {detail}. Real treasure!'],
    kitten: ['I adopted a kitten! Meet {detail}!', 'I have a kitten now. Her name is {detail}. I\'d die for her.'],
  };
  const MINE_R = {
    couple: { pos: ['WHAT?! Finally! I\'m so happy for you!', 'I KNEW it! Congrats!!'], neu: ['Oh! Wow. Congrats.', 'Huh. Didn\'t see that coming.'], neg: ['...Oh. Cool.', 'Great. Good for you.'] },
    won: { pos: ['Champion! I bow.', 'Okay, that\'s actually impressive.'], neu: ['Nice.', 'Congrats, I guess.'], neg: ['Rigged.', 'Beginner\'s luck.'] },
    breakup: { pos: ['Oh no. Come here. Are you okay?', 'I\'m so sorry. Want to talk about it?'], neu: ['Oh. That\'s rough.'], neg: ['Saw that coming, honestly.'] },
    dunk: { pos: ['WHAT?! Are you okay?!', 'The sea?! Do you need a towel?'], neu: ['...The sky did?'], neg: ['Sure it did.'] },
    rejected: { pos: ['Oh no. Their loss. Seriously.', 'Ouch. I\'m sorry. You were brave.'], neu: ['Oof.'], neg: ['Bold move.'] },
    burned: { pos: ['WHAT?! Are you okay?! Let me see!', 'Oh my gosh. Do you need anything?'], neu: ['...Fire? Really?'], neg: ['You do smell a bit burnt.'] },
    blessed: { pos: ['That\'s amazing! You deserve it.', 'Wait, really? What did it feel like?'], neu: ['Huh. Lucky.'], neg: ['Must be nice.'] },
    flung: { pos: ['Are you hurt?! Sit down!', 'That\'s terrifying. I\'m so glad you\'re okay.'], neu: ['A meteor? Wow.'], neg: ['Sure it did.'] },
    nearMiss: { pos: ['That\'s so scary. Are you okay?', 'Stay close to me, okay?'], neu: ['Yikes.'], neg: ['Close one.'] },
    levelUp: { pos: ['Look at you! Congrats!', 'Teach me sometime?'], neu: ['Nice.'], neg: ['Okay, okay, we get it.'] },
    rareFind: { pos: ['NO WAY! Let me hold it!', 'That\'s incredible!'], neu: ['Oh, neat.'], neg: ['Lucky.'] },
    bonk: { pos: ['Oh no! Are you okay? ...pfft.', 'Your poor head!'], neu: ['Ouch.'], neg: ['HA.'] },
    treasure: { pos: ['You\'re RICH! Kind of!', 'That\'s amazing!'], neu: ['Huh, nice.'], neg: ['Must be nice.'] },
    kitten: { pos: ['I NEED TO MEET HER.', 'Stop. Adorable.'], neu: ['Cute.'], neg: ['Keep it away from my stuff.'] },
  };
  def('myNews', {
    key: 'myNews', w: 1,
    setup: ctx => { const n = ctx.news; ctx.vars.partner = n.a === ctx.a.name ? (n.b || '') : n.a; ctx.vars.detail = n.detail || 'something'; },
    beats: [
      { by: 'a', say: ['Can I tell you something?', 'Okay. Big news.', 'So, something happened.'] },
      { by: 'b', say: ['Of course. What?', 'Ooh. Tell me.', 'Uh oh. What happened?'] },
      { by: 'a', say: ctx => MINE[ctx.news.kind] || ['Things have been eventful.'] },
      { by: 'b', judge: 'myNews', say: ctx => MINE_R[ctx.news.kind] || { pos: ['Wow!'], neu: ['Huh.'], neg: ['Hm.'] } },
      { by: 'a', say: ctx => ({ couple: ['I\'m kind of freaking out. In a good way.', 'Don\'t tell everyone. ...Okay, you can tell everyone.'], won: ['I\'ll sign autographs later.', 'Thank you. Thank you.'], breakup: ['I\'ll be okay. Probably.', 'Thanks for listening.'], dunk: ['I\'m still finding seaweed in my hair.', 'I think the sky has it out for me.'], rejected: ['Yeah. I\'ll live.', 'Thanks. Really.'], burned: ['My eyebrows will grow back. Probably.', 'Never again.'], blessed: ['I feel like I could fly.', 'Best day ever.'], flung: ['My ears are still ringing.', 'I\'m staying indoors forever.'], nearMiss: ['I keep checking the sky now.', 'I don\'t like it up there.'] }[ctx.news.kind] || ['Yeah.']) },
    ],
  });

  // --- Last night's event, remembered together
  def('eventRecap', {
    key: 'eventRecap', w: 1,
    beats: [
      { by: 'a', say: ['Okay, {recap} was so good.', 'Still thinking about {recap}.', 'Did you have fun at {recap}?'] },
      { by: 'b', judge: 'eventRecap', say: { pos: ['SO good. Best one yet.', 'I had the best time.', 'Honestly, I needed that.'], neu: ['It was fine.', 'Yeah, it was nice.'], neg: ['Eh. Went on too long.', 'Not my thing, honestly.'] } },
      { by: 'a', say: ctx => ctx.vars.recapHost ? [`${ctx.vars.recapHost} did such a good job with the food.`, `Who knew ${ctx.vars.recapHost} could cook like that?`, 'The food though. THE FOOD.'] : ['The fire was perfect.', 'Did you see the stars after?', 'Everyone was in such a good mood.'] },
      { by: 'b', pick: ctx => ctx.vars.recapHost === ctx.b.name ? 'me' : ctx.v === 'neg' ? 'neg' : 'any', say: { me: ['Aww, thank you! I was so nervous.', 'Hehe, it was nothing. It was a lot.'], any: ['Right?', 'Can we do it again tomorrow?', 'Totally.', 'Next one\'s going to be even better.'], neg: ['If you say so.', 'Sure.'] } },
      { by: 'a', if: ctx => ctx.v === 'pos', say: ['We should sit together next time.', 'I can\'t wait for the next one.', 'This island\'s pretty great sometimes.'] },
    ],
  });

  // --- Weather small talk that goes somewhere
  def('weatherTalk', {
    key: 'weather', w: 1,
    beats: [
      { by: 'a', say: ctx => ({ sunny: ['What a gorgeous day.', 'Not a cloud in the sky.', 'Is it just me or is it hot today?'], cloudy: ['Bit grey today, huh?', 'Looks like rain later.'], rain: ['This rain won\'t quit.', 'I love the sound of the rain on the roof.'], storm: ['Did you hear that thunder?!', 'This storm is wild.'], fog: ['Can\'t even see the lighthouse.', 'This fog is so eerie.'] }[ctx.sim.weather] || ['Weird weather today.']) },
      { by: 'b', judge: 'weather', pick: (ctx, sp) => sp.traits.grumpy > 0.4 && ctx.v !== 'pos' ? 'grump' : ctx.sim.weather, say: {
        sunny: ['Perfect beach weather.', 'I might actually get a tan.', 'Days like this are why we live here.'],
        cloudy: ['Cozy kind of day, though.', 'Good napping weather.'],
        rain: ['The garden\'s loving it.', 'Good day to stay in and read.', 'My socks are soaked. Both of them.'],
        storm: ['I\'m not going outside. Nope.', 'Hope the dock survives.', 'The windows are rattling like crazy.'],
        fog: ['Feels like the island\'s in a cloud.', 'I walked into a tree earlier. Don\'t tell anyone.'],
        grump: ['Weather\'s terrible. As usual.', 'Can\'t this island pick a weather?'] } },
      { by: 'a', say: ctx => ({ sunny: ['Want to go to the beach later?', 'I\'m going to swim until I\'m a raisin.'], rain: ['Tea and a book, then.', 'At least the crops are happy.'], storm: ['Stay safe, okay?', 'If the power goes out I\'m blaming the seagulls.'], fog: ['Let\'s not get lost.', 'Perfect weather for ghost stories.'], cloudy: ['Could go either way.', 'At least it\'s not raining.'] }[ctx.sim.weather] || ['Yeah.']) },
    ],
  });

  // --- A friendly debate, answered from who they actually are
  const DEBATES = [
    { q: 'Okay, settle this. The beach or the forest?', side: p => (p.loves.includes('beach') || p.loves.includes('swimming') ? 'The beach. Obviously.' : p.loves.includes('foraging') || p.loves.includes('chopping') || p.loves.includes('wandering') ? 'The forest. It\'s got character.' : 'Uh... the plaza?'), tag: p => (p.loves.includes('beach') || p.loves.includes('swimming') ? 'beach' : 'forest') },
    { q: 'Important question. Fishing: relaxing or boring?', side: p => (p.loves.includes('fishing') ? 'Relaxing. It\'s meditation.' : p.hates.includes('fishing') ? 'Boring. You stare at water.' : 'Bit of both, honestly.'), tag: p => (p.loves.includes('fishing') ? 'yes' : 'no') },
    { q: 'Is a nap a waste of time or a gift?', side: p => (p.loves.includes('napping') ? 'A gift. A sacred gift.' : p.hates.includes('napping') ? 'Waste of time.' : 'Depends on the nap.'), tag: p => (p.loves.includes('napping') ? 'yes' : 'no') },
    { q: 'Stars or sunsets?', side: p => (p.loves.includes('stargazing') ? 'Stars. They go on forever.' : 'Sunsets. They\'re warmer.'), tag: p => (p.loves.includes('stargazing') ? 'stars' : 'sunsets') },
    { q: 'Would you rather never swim again, or never eat fish again?', side: p => (p.loves.includes('swimming') ? 'Never eat fish. Easy.' : 'Never swim. Who needs it.'), tag: p => (p.loves.includes('swimming') ? 'swim' : 'fish') },
    { q: 'Rain or sunshine?', side: p => (p.loves.includes('reading') || p.loves.includes('gardening') ? 'Rain. Cozy and the plants love it.' : 'Sunshine. Obviously.'), tag: p => (p.loves.includes('reading') || p.loves.includes('gardening') ? 'rain' : 'sun') },
    { q: 'Breakfast: big and early, or skip it?', side: p => (p.traits.hardworking > 0.6 ? 'Big and early. Fuel.' : 'Skip it. Sleep is breakfast.'), tag: p => (p.traits.hardworking > 0.6 ? 'big' : 'skip') },
    { q: 'Would you rather be a seagull or a fish?', side: p => (p.loves.includes('swimming') || p.loves.includes('fishing') ? 'Fish. The ocean is huge.' : 'Seagull. Steal sandwiches, no consequences.'), tag: p => (p.loves.includes('swimming') || p.loves.includes('fishing') ? 'fish' : 'gull') },
    { q: 'Hardest worker on the island. Go.', side: p => (p.name === 'Forest' ? 'Me. Obviously.' : p.name === 'Lynn' ? 'Forest. Though I do a lot.' : p.name === 'Egg' ? 'Not me. I am at peace with that.' : 'Forest. Or Lynn. Definitely not Egg.'), tag: () => 'x' },
  ];
  def('debate', {
    key: 'debate', w: 1,
    setup: ctx => { ctx.d = IS.pick(DEBATES); ctx.agree = ctx.d.tag(ctx.a) === ctx.d.tag(ctx.b); },
    beats: [
      { by: 'a', say: ctx => [ctx.d.q] },
      { by: 'b', say: ctx => [ctx.d.side(ctx.b)] },
      { by: 'a', judge: 'debate', pick: ctx => (ctx.agree ? 'agree' : 'disagree'), say: ctx => ({ agree: ['Correct answer.', 'THANK you.', 'See, this is why we\'re friends.'], disagree: [ctx.d.side(ctx.a).replace(/\.$/, '') + '. Wrong answer.', 'Wow. Okay. ' + ctx.d.side(ctx.a), 'Absolutely not. ' + ctx.d.side(ctx.a)] }) },
      { by: 'b', pick: ctx => (ctx.agree ? 'agree' : ctx.v === 'neg' ? 'heated' : 'tease'), say: { agree: ['Great minds.', 'Obviously.'], tease: ['We can still be friends. Barely.', 'Agree to disagree.', 'You\'re wrong, but I love you.'], heated: ['I can\'t believe you just said that.', 'Unbelievable.', 'I\'m never trusting your opinion again.'] } },
    ],
  });

  // --- Island mysteries
  def('mystery', {
    key: 'mystery', w: 1,
    beats: [
      { by: 'a', say: ['Do you ever wonder who lived here before us?', 'Why is there a lighthouse if nobody ever sails past?', 'Where do the messages in the bottles even come from?', 'Have you noticed the cat disappears every night at exactly the same time?'] },
      { by: 'b', judge: 'mystery', pick: (ctx, sp) => (sp.traits.curious > 0.6 ? 'curious' : sp.traits.grumpy > 0.4 ? 'grump' : 'shrug'), say: { curious: ['ALL the time.', 'Okay, I have a theory.', 'Don\'t get me started.'], shrug: ['Huh. Never thought about it.', 'Should I be worried?'], grump: ['No.', 'Does it matter?'] } },
      { by: 'a', say: ['I bet it was pirates.', 'I think the Sky Hand built this place.', 'Maybe it\'s someone on the mainland who misses us.', 'I think {cat} knows something we don\'t.'] },
      { by: 'b', if: ctx => ctx.v !== 'neg', say: ['That\'s either genius or insane.', 'We should investigate.', 'Okay, now I\'m going to be thinking about this all night.', 'I\'m telling Iroh. He\'ll make it a plan.'] },
    ],
  });

  // --- Learning something from a friend who loves it (and then actually doing it)
  const TIPS = { fishing: ['Don\'t yank the line. Let the fish think it\'s winning.'], gardening: ['Talk to the plants. I\'m serious.'], swimming: ['Breathe out underwater. Everyone forgets.'], chopping: ['It\'s all in the swing.'], reading: ['Start with something with a map at the front.'], stargazing: ['Let your eyes adjust for ten minutes, then look up.'], foraging: ['If it\'s bright red, don\'t eat it.'], beach: ['Step one: lie down. Step two: there is no step two.'] };
  def('teach', {
    key: 'teach', w: 1,
    setup: ctx => { ctx.vars.act = IS.Dialogue.activityWord[ctx.teachLove] || ctx.teachLove; },
    beats: [
      { by: 'a', say: ['Can you teach me how to do {act} properly?', 'Okay, you\'re good at {act}. What\'s the secret?', 'Teach me your ways. {act}. Please.'] },
      { by: 'b', judge: 'teach', say: ctx => ({ pos: [ctx.tip = IS.pick(['Oh, I\'d love to! ', 'Finally, someone asks! ', 'Okay, lesson one. ']) + IS.pick(TIPS[ctx.teachLove] || ['Just do it a lot. That\'s the trick.'])], neu: ['Uh, sure. I guess.', 'It\'s not that hard, honestly.'], neg: ['Figure it out yourself.', 'It\'s not something you teach.'] }) },
      { by: 'b', if: () => false, say: ctx => ({ fishing: ['Don\'t yank the line. Let the fish think it\'s winning.'], gardening: ['Talk to the plants. I\'m serious.'], swimming: ['Breathe out underwater. Everyone forgets.'], chopping: ['It\'s all in the hips. And the swing. Mostly the swing.'], reading: ['Start with something with a map at the front.'], stargazing: ['Let your eyes adjust for ten minutes. Then look up.'], foraging: ['If it\'s bright red, don\'t eat it.'], beach: ['Step one: lie down. Step two: there is no step two.'] }[ctx.teachLove] || ['Just do it a lot. That\'s the trick.']) },
      { by: 'a', if: ctx => ctx.v === 'pos', say: ['Okay. Lesson tomorrow?', 'Let\'s do it together sometime.', 'I\'m writing this down. Mentally.'] },
      { by: 'b', if: ctx => ctx.v === 'pos', say: ['Deal.', 'You\'re on.', 'I\'ll come find you.'] },
    ],
    after: (ctx, sim) => {
      if (ctx.v !== 'pos') return;
      const act = { fishing: 'fish', gardening: 'garden', swimming: 'swim', chopping: 'chop', reading: 'read', stargazing: 'stargaze', foraging: 'forage', beach: 'beach' }[ctx.teachLove];
      if (act) IS.Mind.addPlan(ctx.a, { kind: 'do', def: act, text: `Practise ${IS.Dialogue.activityWord[ctx.teachLove]} like ${ctx.b.name} showed me`, invite: true });
    },
  });

  // --- Noticing a friend seems down
  def('wellbeing', {
    key: 'wellbeing', w: 1,
    beats: [
      { by: 'a', say: ['Hey. You okay? You seem a bit off.', 'You\'ve been quiet today. Everything alright?', 'Real question. How are you actually doing?'] },
      { by: 'b', pick: ctx => (ctx.b.needs.energy < 30 ? 'tired' : ctx.b.needs.social < 30 ? 'lonely' : ctx.b.needs.fun < 30 ? 'bored' : ctx.b.needs.hunger < 30 ? 'hungry' : 'meh'), say: { tired: ['Honestly? Exhausted.', 'I haven\'t slept properly in ages.'], lonely: ['Kind of lonely, honestly.', 'Feels like I haven\'t talked to anyone in forever.'], bored: ['Just bored out of my mind.', 'Every day feels the same lately.'], hungry: ['I\'m just really hungry.', 'Haven\'t eaten properly.'], meh: ['Just one of those days.', 'I don\'t know. Off.'] } },
      { by: 'a', judge: 'comfort', pick: ctx => (ctx.b.needs.energy < 30 ? 'tired' : ctx.b.needs.social < 30 ? 'lonely' : ctx.b.needs.fun < 30 ? 'bored' : ctx.b.needs.hunger < 30 ? 'hungry' : 'meh'), say: { tired: ['Go nap. I\'ll cover for you.', 'Rest. Seriously. The island won\'t sink.'], lonely: ['Well, you\'ve got me. Let\'s hang out more.', 'Come find me anytime. I mean it.'], bored: ['Come do something with me later.', 'Let\'s shake things up. Beach? Swim? Chaos?'], hungry: ['Come on, let\'s get you food.', 'Go eat. Right now. I\'ll wait.'], meh: ['Want company? I\'m good at quiet.', 'Those days happen. I\'m here.'] } },
      { by: 'b', say: { pos: ['...Thanks. That actually helps.', 'You\'re a good friend.'], neu: ['Yeah. Maybe.', 'Thanks.'], neg: ['I\'m fine. Really.', 'I just want to be alone.'] } },
    ],
    after: (ctx) => { if (ctx.v === 'pos') { ctx.b.addMood(`${ctx.a.name} checked on me`, 6, 300); IS.Mind.addPlan(ctx.a, { kind: 'see', who: ctx.b.name, text: `Spend time with ${ctx.b.name}` }); } },
  });

  // --- Asking a friend for crush advice (then acting on it)
  def('crushAdvice', {
    key: 'crushAdvice', w: 1,
    beats: [
      { by: 'a', say: ['Can I ask you something? You have to promise not to laugh.', 'I need advice. Love advice. Don\'t make it weird.'] },
      { by: 'b', say: ['Oh, this is going to be good.', 'I promise nothing. Go.', 'Of course. What\'s up?'] },
      { by: 'a', say: ['How do I talk to {crush} without sounding like an idiot?', 'I think I like {crush}. What do I do?', 'Every time {crush} talks to me my brain stops working.'] },
      { by: 'b', judge: 'deep', pick: (ctx, sp) => (sp.cfg.humor === 'cocky' ? 'jude' : sp.traits.kind > 0.8 ? 'kind' : sp.cfg.humor === 'roast' ? 'roast' : sp.traits.hardworking > 0.8 ? 'direct' : 'chill'), say: {
        jude: ['Easy. Confidence. Lean on something. Never blink.', 'Just be me. Oh wait, you can\'t.'],
        kind: ['Just be yourself. Ask about their day and actually listen.', 'Be honest. People like honest.'],
        roast: ['Step one: don\'t do the thing you\'re doing right now.', 'You? Talk to {crush}? I\'m getting popcorn.'],
        direct: ['Just tell them. Wasting time is worse than a no.', 'Walk up, say hi, invite them somewhere. Done.'],
        chill: ['Don\'t overthink it. Hang out, see what happens.', 'Invite them stargazing. Works every time.'] } },
      { by: 'a', say: { pos: ['Okay. Okay. I can do this.', 'You\'re right. I\'m going to talk to them.'], neu: ['...That\'s not helpful, but thanks.', 'I\'ll think about it.'], neg: ['Why did I ask you.', 'Never mind.'] } },
      { by: 'b', if: ctx => ctx.v === 'pos', say: ['Go get them.', 'Report back. I need updates.', 'You\'ve got this.'] },
    ],
    after: (ctx) => { if (ctx.v === 'pos' && ctx.vars.crush) IS.Mind.addPlan(ctx.a, { kind: 'talk', who: ctx.vars.crush, topic: 'flirt', text: `Actually talk to ${ctx.vars.crush}` }); },
  });

  // --- Jealousy, vented to a friend
  def('jealousVent', {
    key: 'jealousVent', w: 1,
    beats: [
      { by: 'a', say: ['Can we talk about {rival} for a second?', 'Is it just me, or is {rival} kind of the worst lately?'] },
      { by: 'b', say: ['Uh oh. What did they do?', 'Okay, what happened?', 'This sounds personal.'] },
      { by: 'a', say: ['They keep hanging around {crush}. Constantly.', 'Everyone acts like they\'re so charming. They\'re not.', 'I just don\'t like how they look at {crush}.'] },
      { by: 'b', judge: 'gossipBad', pick: (ctx, sp) => (sp.traits.kind > 0.6 ? 'kind' : ctx.v === 'pos' ? 'agree' : 'call'), say: { kind: ['Sounds like you\'re a little jealous.', 'Maybe talk to {crush} instead of worrying about {rival}?'], agree: ['Ugh, yeah. I\'ve noticed.', '{rival} can be a lot.'], call: ['That sounds like a you problem.', 'Jealous much?'] } },
      { by: 'a', say: ['...Okay, maybe a little jealous.', 'I\'m not jealous. I\'m observant.', 'Whatever. I\'m fine.'] },
    ],
    setup: ctx => { const e = IS.Mind.feeling(ctx.a); ctx.vars.rival = e && e.about ? e.about : 'them'; const c = IS.Dialogue.crushOf(ctx.a) || ctx.a.partner(); ctx.vars.crush = c ? c.name : 'everyone'; },
  });

  // --- Pantry crisis: someone actually goes fishing afterwards
  def('pantry', {
    key: 'pantry', w: 1,
    beats: [
      { by: 'a', say: ['Have you seen the pantry? It\'s nearly empty.', 'We\'re running really low on food.', 'If someone doesn\'t catch something soon, we\'re eating seaweed.'] },
      { by: 'b', judge: 'complaint', pick: (ctx, sp) => (sp.traits.hardworking > 0.6 ? 'worker' : isLazy(sp) ? 'lazy' : 'any'), say: { worker: ['I\'m on it. I\'ll go fishing.', 'I\'ll take care of it.'], lazy: ['Someone should do something about that.', 'Can\'t we just... eat less?'], any: ['Yikes. Want to go fishing together?', 'Okay, we should fix that.'] } },
      { by: 'a', pick: (ctx) => (isLazy(ctx.b) ? 'lazy' : 'ok'), say: { ok: ['Thank you. Seriously.', 'Okay, let\'s do it.'], lazy: ['"Someone." Wow.', 'You could be someone, you know.'] } },
    ],
    after: (ctx) => {
      const worker = isLazy(ctx.b) ? ctx.a : ctx.b;
      const def = worker.hates.includes('fishing') ? 'garden' : 'fish';
      IS.Mind.addPlan(worker, { kind: 'do', def, text: 'Restock the pantry (promised)', invite: true });
    },
  });

  // --- Dreams, in the morning
  def('dream', {
    key: 'dream', w: 1,
    beats: [
      { by: 'a', say: ['I had the weirdest dream last night.', 'Okay, I need to tell you my dream before I forget it.'] },
      { by: 'b', say: ['Oh no. Go.', 'Was I in it?', 'Dreams are so weird. Tell me.'] },
      { by: 'a', say: ['{cat} could talk, and she was SO rude.', 'The whole island was floating. Like, in the sky.', 'I was a fish and you were trying to catch me.', 'Forest was doing push-ups on the moon.', 'Everyone forgot my name and called me Gerald.', 'The supply boat was full of nothing but cheese.'] },
      { by: 'b', judge: 'joke', say: { pos: ['That is incredible. Please have that dream again.', 'Okay, that\'s hilarious.', 'I need to know how it ended.'], neu: ['...Okay.', 'You need more sleep.'], neg: ['That\'s so weird.', 'Please never tell me your dreams again.'] } },
      { by: 'a', if: ctx => ctx.v === 'pos', say: ['And THEN I woke up.', 'It felt so real.', 'I think it means something.'] },
    ],
  });

  // --- Hopes for the future
  const FUTURE = {
    Iroh: ['One day I\'m going to sail past the horizon and see what\'s out there.', 'Build a boat. Find a new island. Name it after myself.', 'Honestly? Adventure. Any kind. The dumber the better.'],
    Forest: ['I want to build a house. With my own hands. Every board.', 'Run the whole island\'s farm. Properly.', 'Be the strongest version of me. Every day a bit more.'],
    Egg: ['I want to open a cat café. Just me, the cats, and naps.', 'Be happy. That\'s it. That\'s the plan.', 'Hammock. Ocean view. Cat on my chest. Forever.'],
    Jude: ['I\'m going to be famous. For what? Details later.', 'Have everyone on the mainland know my name.', 'Get rich without trying too hard. It\'s possible. I\'ve seen it.'],
    Beach: ['Honestly? Sometimes I think about opening a spa. Here.', 'Go home and show everyone I survived an island.', 'Prove to my dad I can do something on my own. ...Don\'t repeat that.'],
    Lynn: ['I want to write a book about every plant on this island.', 'Make sure everyone here is okay. Always.', 'Teach. Maybe. Kids, plants, whoever will listen.'],
  };
  def('future', {
    key: 'future', w: 1,
    setup: ctx => { (ctx.a.heardFuture = ctx.a.heardFuture || {})[ctx.b.name] = ctx.sim.clock.abs; (ctx.b.heardFuture = ctx.b.heardFuture || {})[ctx.a.name] = ctx.sim.clock.abs; },
    beats: [
      { by: 'a', say: ['What do you want to do, like... long term?', 'Do you ever think about the future?', 'If you could do anything with your life, what would it be?'] },
      { by: 'b', say: ctx => FUTURE[ctx.b.name] || ['I don\'t know yet. Is that okay?'] },
      { by: 'a', judge: 'deep', say: { pos: ['That\'s actually beautiful.', 'You\'d be amazing at that.', 'I can totally see that.'], neu: ['Huh. I didn\'t expect that.', 'Interesting.'], neg: ['That\'s... ambitious.', 'Good luck with that.'] } },
      { by: 'b', say: ['What about you?', 'Your turn.'] },
      { by: 'a', say: ctx => FUTURE[ctx.a.name] || ['Honestly? I just want to be happy here.'] },
      { by: 'b', if: ctx => ctx.v !== 'neg', say: ['I believe in you.', 'Can I come?', 'We should help each other get there.'] },
    ],
  });

  // --- The bros being bros
  def('broBanter', {
    key: 'broBanter', w: 1,
    beats: [
      { by: 'a', say: ['Bro.', 'Bro. Bro. Listen.', 'Okay, bro, real talk.'] },
      { by: 'b', say: ['Bro.', 'What, bro.', 'Bro, what.'] },
      { by: 'a', say: ['I bet I can swim to the buoy faster than you.', 'Who would win in a fight: you or a really big crab?', 'If we were all fish, what fish would we be?', 'Remember when {third} fell off the dock? Best day of my life.', 'We need a secret handshake. Like, today.'] },
      { by: 'b', judge: 'joke', say: { pos: ['Oh, you\'re ON.', 'Obviously me. Next question.', 'HAHA. I still think about that.', 'Already working on it.'], neu: ['Why are you like this.', 'Bro, what.'], neg: ['Bro, no.', 'That\'s the dumbest thing you\'ve said today.'] } },
      { by: 'a', say: { pos: ['Bros for life.', 'This is why you\'re my bro.', 'Okay, okay. Respect.'], neu: ['Think about it.', 'I\'ll ask Egg.'], neg: ['Wow. Bro.', 'Fine. I\'ll ask Egg.'] } },
    ],
  });

  // --- Bragging, and the listener not buying it
  def('brag', {
    key: 'brag', w: 1,
    beats: [
      { by: 'a', say: { any: ['Not to brag, but I\'m kind of amazing.'], Beach: ['My dad could buy this whole island. Twice.', 'Do you know how much my sunglasses cost?', 'Back home I had two pools.'], Jude: ['I could win the fishing contest blindfolded.', 'Everyone on this island secretly wants to be me.', 'You\'re welcome for me being here, by the way.'] } },
      { by: 'b', judge: 'brag', say: { pos: ['Okay, that\'s actually kind of impressive.', 'Wait, really?'], neu: ['Mhm.', 'Cool story.', 'Sure.'], neg: ['Nobody asked.', 'Wow. Riveting.', 'You\'re unbelievable.'] } },
      { by: 'a', say: { pos: ['I know.', 'See? Iconic.'], neu: ['You\'re just jealous.', 'Whatever.'], neg: ['Jealousy is a terrible look.', 'Ugh. Fine.'] } },
      { by: 'b', if: ctx => ctx.v === 'neg', say: ['Jealous of WHAT?', 'Okay, sure.', 'Bye.'] },
    ],
  });
  TH.brag2 = { ...TH.brag, id: 'brag2', key: 'cocky' };

  // --- Cats (mostly Egg)
  def('cat', {
    key: 'cat', w: 1,
    beats: [
      { by: 'a', say: ['{cat} sat on my feet earlier. I couldn\'t move for an hour.', 'I think {cat} is the real mayor of this island.', '{cat} followed me around all morning.'] },
      { by: 'b', judge: 'cat', pick: ctx => (ctx.b.loves.includes('cats') ? 'love' : 'meh'), say: { love: ['I LOVE {cat}.', 'Aww, {cat}!', '{cat} is perfect and I won\'t hear otherwise.'], meh: ['She ignores me. Every time.', 'She bit me once. I haven\'t forgotten.', 'It\'s a cat. You know that, right?'] } },
      { by: 'a', say: ['She brought me a leaf yesterday. A gift.', 'I\'m pretty sure she understands everything we say.', 'I\'m saving her a fish from dinner.'] },
      { by: 'b', say: { pos: ['We don\'t deserve her.', 'That cat has a better life than all of us.'], neu: ['Okay, that\'s kind of cute.'], neg: ['You need hobbies.', 'Okay, cat person.'] } },
    ],
  });

  // --- Birthday wishes
  def('birthday', {
    key: 'birthday', w: 1,
    beats: [
      { by: 'a', say: ['HAPPY BIRTHDAY!!', 'Happy birthday, {other}!', 'It\'s the birthday person!'] },
      { by: 'b', judge: 'birthday', say: ['Aww, thank you!', 'You remembered!', 'Hehe, thanks!'] },
      { by: 'a', say: ['How does it feel to be ancient?', 'Any birthday wishes?', 'You\'d better be at the party.'] },
      { by: 'b', say: ['Honestly? Great.', 'Just this. Friends. Cake. Maybe cake.', 'Wouldn\'t miss my own party.'] },
    ],
    after: (ctx) => ctx.b.visitedBy.add('bday:' + ctx.a.name),
  });

  // --- Hungry
  def('hungry', {
    key: 'hungry', w: 1,
    beats: [
      { by: 'a', say: ['I\'m starving. Got anything to eat?', 'My stomach just growled at me. Loudly.', 'When\'s food. I need food.'] },
      { by: 'b', judge: 'hungry', pick: ctx => (ctx.sim.world.food < 5 ? 'empty' : 'ok'), say: { ok: ['There\'s stuff in the pantry, go!', 'Go eat! You\'re getting cranky.'], empty: ['The pantry\'s basically empty...', 'Someone needs to go fishing.'] } },
      { by: 'a', say: ['Okay. Food. Then I\'m a person again.', 'You\'re right. Bye.', 'Fine. Seaweed it is.'] },
    ],
  });

  // --- Island observations
  def('island', {
    key: 'island', w: 1,
    beats: [
      { by: 'a', say: ['I found a new path behind the greenhouse.', 'Have you been to the north cliffs lately? The view is unreal.', 'The lighthouse looks so pretty at night.', 'Someone should name the big rock by the beach.', 'There\'s a tide pool by the south rocks with tiny crabs in it.', 'The big oak in the forest has a hollow you can sit in.', 'I think the well echoes if you say your name into it.', 'The flowers by the plaza are blooming like crazy.', 'Someone carved initials into the dock. Old ones.'] },
      { by: 'b', judge: 'island', say: { pos: ['No way, show me!', 'Ooh, I love that.', 'I\'ve been meaning to go!'], neu: ['Huh, cool.', 'Nice.'], neg: ['It\'s a small island. It\'s all the same.', 'Thrilling.'] } },
      { by: 'a', say: ['I\'ll take you sometime.', 'I vote we call the rock Steve.', 'This place keeps surprising me.', 'Let\'s go look later.', 'Every time I think I\'ve seen it all, I find something new.'] },
      { by: 'b', if: ctx => ctx.v === 'pos', say: ['Deal.', 'Steve. Perfect.', 'Same.'] },
    ],
  });

  // --- Old grudges and old favours
  def('grudge', {
    key: 'grudge', w: 1,
    setup: ctx => { const g = IS.Mind.led(ctx.a, ctx.b.name); ctx.vars.why = g.why || 'what you said'; },
    beats: [
      { by: 'a', say: ['Hey. Can we talk about {why}?', 'I\'m still not over {why}, you know.', 'You never really apologized for {why}.'] },
      { by: 'b', judge: 'grudge', say: { pos: ['...Yeah. I\'m sorry about that. I mean it.', 'You\'re right. That wasn\'t okay.'], neu: ['Are we really doing this now?', 'I thought we were past that.'], neg: ['Are you STILL on that?', 'Let it go already.', 'That was ages ago!'] } },
      { by: 'a', say: { pos: ['...Okay. Thanks. That helps.', 'Alright. We\'re good.'], neu: ['I just needed to say it.', 'Fine.'], neg: ['Wow. Okay.', 'Unbelievable.'] } },
    ],
  });
  def('thanks', {
    key: 'thanks', w: 1,
    setup: ctx => { const g = IS.Mind.led(ctx.a, ctx.b.name); ctx.vars.favor = g.favor || 'the other day'; },
    beats: [
      { by: 'a', say: ['I never properly thanked you for {favor}.', 'Hey. Thanks again for {favor}. I mean it.', 'I still owe you for {favor}.'] },
      { by: 'b', judge: 'thanks', say: ['Anytime. Seriously.', 'That\'s what friends are for.', 'Don\'t mention it! ...But you can mention it.'] },
      { by: 'a', say: ['Still. It meant a lot.', 'I\'ll make it up to you.', 'You\'re a good one, {other}.'] },
    ],
  });

  // --- Feelings spilling into conversation
  def('giddy', {
    key: 'giddyTalk', w: 1,
    beats: [
      { by: 'a', say: ['Is the sky extra pretty today or is it just me?', 'Sorry, I can\'t stop smiling today.', 'Everything is just... good. You know?'] },
      { by: 'b', judge: 'giddyTalk', say: { pos: ['Wonder why. *wink*', 'Ha, it\'s cute on you.', 'Somebody\'s in love.'], neu: ['Uh huh.', 'Okay, weirdo.'], neg: ['Please tone it down.', 'Gross.'] } },
      { by: 'a', say: ['Shut up. ...Okay, maybe.', 'I don\'t know what you\'re talking about.', 'Is it that obvious?'] },
    ],
  });
  def('proud', {
    key: 'proudBrag', w: 1,
    beats: [
      { by: 'a', say: ['Did you see what I did? Pretty great, right?', 'I\'m kind of on a roll lately.', 'Today? I\'m unstoppable.'] },
      { by: 'b', judge: 'proudBrag', say: { pos: ['Okay, yeah. You earned it.', 'Look at you!'], neu: ['Sure, champ.', 'Mhm.'], neg: ['Yeah, yeah, you\'re great.', 'Don\'t let it go to your head.'] } },
      { by: 'a', say: { pos: ['I know. Thank you.', 'Autographs later.'], neu: ['You\'ll see.', 'Just saying.'], neg: ['Jealous.', 'Hater.'] } },
    ],
  });
  def('snipe', {
    key: 'snipe', w: 1,
    beats: [
      { by: 'a', say: ['Must be nice, huh? Having everyone like you.', 'Don\'t look so pleased with yourself.', 'You think you\'re so charming, don\'t you.'] },
      { by: 'b', judge: 'snipe', say: { pos: ['...Are you okay?', 'Where is this coming from?'], neu: ['Uh. Okay?', 'Someone\'s cranky.'], neg: ['What\'s your problem?', 'Wow. Okay. Bye.'] } },
      { by: 'a', say: { pos: ['...Forget it.', 'Nothing. Never mind.'], neu: ['Nothing.', 'Whatever.'], neg: ['You know exactly what.', 'Forget it.'] } },
    ],
  });
  def('sourCongrats', {
    key: 'congratsSour', w: 1,
    beats: [
      { by: 'a', say: ['So. You and {partnerOf}. Cool. Good for you.', 'Heard about you and {partnerOf}. Great. Really.', 'Congrats, I guess.'] },
      { by: 'b', judge: 'congratsSour', say: ['...Thanks?', 'Okay... thanks, I guess.', 'Is something wrong?'] },
      { by: 'a', say: ['Nope. Everything\'s great.', 'I\'m fine. Totally fine.', 'Just... happy for you. Yep.'] },
    ],
    setup: ctx => { const n = ctx.news; ctx.vars.partnerOf = n ? (n.a === ctx.b.name ? n.b : n.a) : 'them'; },
  });

  // --- News about things that happened to you
  def('newsBottle', {
    key: 'news:bottle', w: 1,
    setup: ctx => { const m = ctx.a.memories.find(x => x.tag === 'bottle'); ctx.vars.msg = (m && m.detail) || 'Please return my left sock.'; },
    beats: [
      { by: 'a', say: ['I found a message in a bottle on the beach!', 'Guess what washed up today. A message in a bottle!'] },
      { by: 'b', say: ['No way! What did it say?', 'Seriously? Read it!', 'Who even sends those?'] },
      { by: 'a', say: ['It said: "{msg}"', 'Okay, it says: "{msg}"'] },
      { by: 'b', judge: 'news:bottle', say: { pos: ['That\'s amazing.', 'We should write one back!', 'I need to know who wrote it.'], neu: ['Huh. Weird.', 'Creepy, kind of.'], neg: ['Probably a prank.', 'That\'s it?'] } },
    ],
  });
  def('newsDolphins', {
    key: 'news:dolphins', w: 1,
    beats: [
      { by: 'a', say: ['Did you see the dolphins?!', 'There were DOLPHINS by the shore today!'] },
      { by: 'b', pick: ctx => (ctx.b.sawDolphins ? 'saw' : 'missed'), say: { saw: ['YES! One jumped so high!', 'I saw them! I almost cried.'], missed: ['WHAT? I missed them?!', 'No! Where?!'] } },
      { by: 'a', judge: 'news:dolphins', say: ['Best thing that\'s happened all week.', 'I think they were showing off.', 'Next time I\'m coming to get you.'] },
    ],
  });
  def('newsFish', {
    key: 'news:bigfish', w: 1,
    beats: [
      { by: 'a', say: ['I caught a fish THIS big today.', 'Biggest fish of my life. No witnesses, sadly.'] },
      { by: 'b', judge: 'news:bigfish', say: { pos: ['No way! How big?', 'Pics or it didn\'t happen. Oh wait.'], neu: ['Sure you did.', 'Uh huh.'], neg: ['Every fisherman says that.', 'And it got away, right?'] } },
      { by: 'a', say: ['Bigger than {cat}. I swear.', 'It looked me in the eye. We had a moment.', 'You\'ll see at dinner.'] },
    ],
  });
  def('newsStar', {
    key: 'news:star', w: 1,
    beats: [
      { by: 'a', say: ['I saw a shooting star last night.', 'Did you see the shooting star?'] },
      { by: 'b', say: ['Did you make a wish?', 'No! What did you wish for?'] },
      { by: 'a', judge: 'news:star', say: ['Not telling. It won\'t come true.', 'Something about you. ...Kidding. Maybe.', 'More cheese on the supply boat.'] },
      { by: 'b', say: ['Fair.', 'Okay, now I need to know.', 'Ha. Valid wish.'] },
    ],
  });
  def('newsFind', {
    key: 'news:find', w: 1,
    setup: ctx => { const m = ctx.a.memories.find(x => x.tag === 'find'); ctx.vars.found = (m && m.detail) || 'something weird'; },
    beats: [
      { by: 'a', say: ['I found {found} in the forest!', 'Look what I found in the woods. {found}!'] },
      { by: 'b', judge: 'news:find', say: { pos: ['Ooh! Where exactly?', 'Lucky!'], neu: ['Huh. Nice.', 'Cool.'], neg: ['Okay?', 'Thrilling.'] } },
      { by: 'a', say: ['By the big oak. Don\'t tell anyone.', 'I\'ll show you sometime.', 'I\'m keeping it forever.'] },
    ],
  });
  def('sickVisit', {
    key: 'sickVisit', w: 1,
    beats: [
      { by: 'a', say: ['Soup delivery! Don\'t argue, just eat.', 'I brought you some soup. How are you feeling?', 'Knock knock. I brought tea and terrible jokes.'] },
      { by: 'b', judge: 'sickVisit', say: ['You\'re the best. Seriously.', 'You didn\'t have to... thank you.', 'Ugh. Awful. But better now.', 'My head is pounding. Soup helps.', '*cough* You\'re an angel.', 'Bless you. Wait, that\'s my line.', 'I feel like a wet sock. Thanks for coming.'] },
      { by: 'a', say: ['Rest up, okay? We miss you out there.', 'Get better. That\'s an order.', 'I\'ll check on you tomorrow.'] },
    ],
  });
  def('fightCallback', {
    key: 'memoryBad', w: 1,
    beats: [
      { by: 'a', say: ['Are we good? After earlier?', 'I didn\'t like how things went last time.', 'Still a bit weird about earlier, honestly.'] },
      { by: 'b', judge: 'memoryBad', say: { pos: ['Yeah. We\'re good. I\'m sorry too.', 'Honestly? Me too. Let\'s forget it.'], neu: ['I guess.', 'Mostly.'], neg: ['Not really, no.', 'Give me some time.'] } },
      { by: 'a', if: ctx => ctx.v === 'pos', say: ['Okay. Good. I hate fighting with you.', 'Friends?'] },
    ],
  });

  // --- What do you think of ___? Answered from how they really feel
  const opinionOf = (b, subj) => {
    const r = b.relTo(subj.name);
    if (r.partner) return 'partner';
    if (r.romance > 45) return 'crush';
    if (r.friendship > 55) return 'love';
    if (r.friendship > 20) return 'like';
    if (r.friendship > -10) return 'meh';
    return 'dislike';
  };
  def('askAbout', {
    key: 'askAbout', w: 1,
    setup: ctx => { ctx.vars.subj = ctx.subject.name; ctx.op = opinionOf(ctx.b, ctx.subject); ctx.mine = opinionOf(ctx.a, ctx.subject); },
    beats: [
      { by: 'a', say: ['Can I ask you something? What do you think of {subj}?', 'Real talk. How do you feel about {subj}?', 'Okay, honest opinion. {subj}. Go.', 'What\'s your deal with {subj}, anyway?'] },
      { by: 'b', pick: ctx => ctx.op, say: {
        partner: ['{subj}? I\'m crazy about them. You know that.', 'Honestly? Best thing that ever happened to me.'],
        crush: ['W-why are you asking? No reason. They\'re fine. Great. Whatever.', '...Is it that obvious?', 'Uh. They\'re... nice. Really nice. Why?'],
        love: ['Love them. Best person on this island.', '{subj}? Ride or die.', 'Honestly, one of my favourite people.'],
        like: ['They\'re great. Bit much sometimes, but great.', 'I like {subj}. Good vibes.', 'Solid. I\'d trust them.'],
        meh: ['They\'re fine, I guess.', 'Don\'t really know them that well.', 'Eh. No strong feelings.'],
        dislike: ['Don\'t get me started.', 'Honestly? Not my favourite.', 'Can we talk about literally anyone else?'] } },
      { by: 'a', judge: 'askAbout', pick: ctx => { if (ctx.op === 'crush' || ctx.op === 'partner') return ctx.op; const pos = x => ['love', 'like', 'partner', 'crush'].includes(x); if (pos(ctx.mine) === pos(ctx.op)) return 'agree'; return ctx.mine === 'love' || ctx.mine === 'partner' ? 'defend' : ctx.mine === 'dislike' ? 'hate' : 'disagree'; }, say: {
        defend: ['Really? {subj} is one of my favourite people.', 'Hey, that\'s my best friend you\'re talking about.', 'Wow. You don\'t know {subj} like I do.'],
        hate: ['Really? I can\'t stand them.', 'Huh. You must see something I don\'t.', 'Wait, you LIKE {subj}?'],
        crush: ['Oh my god. You LIKE {subj}.', 'Wait. Wait wait wait. You have a crush on {subj}!', 'I KNEW it.'],
        partner: ['Aww. You two are disgusting. In a good way.', 'Okay, that\'s really sweet.'],
        agree: ['Same, honestly.', 'Yeah, I feel the same way.', 'Okay good, it\'s not just me.'],
        disagree: ['Huh. I see them really differently.', 'Really? I kind of like them.', 'Wow. Okay. Not how I see it.'] } },
      { by: 'b', pick: ctx => (ctx.op === 'crush' ? 'crush' : 'any'), say: { crush: ['SHH. Don\'t tell anyone. Especially not {subj}.', 'If you tell {subj}, I will throw you in the sea.', '...Okay, yes. Maybe. Shut up.'], any: ['Anyway. Why do you ask?', 'Don\'t tell them I said that.', 'That\'s just my take.', 'Ask me again in a week.'] } },
    ],
    after: (ctx, sim) => {
      // Opinions rub off a little, and secrets get learned
      const delta = { partner: 2, crush: 1, love: 2, like: 1, meh: 0, dislike: -2 }[ctx.op] || 0;
      ctx.a.changeRel(ctx.subject.name, delta * Math.max(0, ctx.a.relTo(ctx.b.name).friendship) / 60);
      if (ctx.op === 'crush') ctx.a.remember(`Found out ${ctx.b.name} likes ${ctx.subject.name}`, { tag: 'secret', about: ctx.b.name });
    },
  });

  // --- Inviting someone to do something right after the chat (and then doing it)
  const HANG = { fishing: 'fish', swimming: 'swim', beach: 'beach', stargazing: 'stargaze', wandering: 'wander', gardening: 'garden', foraging: 'forage', reading: 'read', cats: 'petCat' };
  const HANG_GO = { fish: 'fishing', swim: 'swimming', beach: 'to the beach', stargaze: 'stargazing', wander: 'for a walk', garden: 'gardening', forage: 'foraging', read: 'read together', petCat: 'find the cat' };
  def('hangout', {
    key: 'hangout', w: 1,
    setup: ctx => { ctx.vars.go = HANG_GO[ctx.hangDef] || 'hang out'; },
    beats: [
      { by: 'a', say: ['Wanna go {go} with me after this?', 'I\'m going {go} in a bit. Come with?', 'Hey, come {go} with me. Please?'] },
      { by: 'b', judge: 'sharedLove', pick: (ctx, sp) => (ctx.v === 'neg' ? 'no' : (sp.needs.energy < 25 ? 'tired' : ctx.v === 'pos' || sp.loves.includes(IS.Actions[ctx.hangDef] && IS.Actions[ctx.hangDef].love) ? 'yes' : 'maybe')), say: { yes: ['Yes! Let\'s go.', 'I was hoping you\'d ask.', 'Say less.', 'Lead the way.'], maybe: ['...Sure, why not.', 'Okay, but just for a bit.'], tired: ['I\'m wiped. Next time?', 'Can\'t, I\'m half asleep.'], no: ['Nah, I\'m good.', 'Pass.', 'Not today.'] } },
      { by: 'a', say: { pos: ['Yes! Okay, come on.', 'Best decision you\'ve made all day.'], neu: ['Cool, come on then.', 'Great.'], neg: ['Your loss.', 'Fine, more for me.'] } },
    ],
    after: (ctx, sim) => {
      if (ctx.v === 'neg' || ctx.b.needs.energy < 25) return;
      ctx.a.afterChat = () => {
        const def = IS.Actions[ctx.hangDef];
        if (!def || ctx.a.mode !== 'normal' || ctx.b.mode !== 'normal' || ctx.b.chat) return;
        ctx.a.cancelAction();
        if (!ctx.a.startAction(def, sim.clock)) return;
        if (IS.Mind.join(sim, ctx.b, ctx.a, def)) {
          ctx.a.action.with = ctx.b.name;
          sim.log(`${ctx.a.name} talked ${ctx.b.name} into going ${HANG_GO[ctx.hangDef]}.`, 'social', [ctx.a, ctx.b]);
        }
      };
    },
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
      { by: 'a', say: ['We should go together sometime.', 'Next time I go, you\'re coming.', 'We should make it a weekly thing.', 'We should start a club. Two members. Very exclusive.', 'You and me. Tomorrow. Be there.'] },
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
      { by: 'a', say: ['Should we go bother them?', 'Bet you they\'ll be doing that for hours.', 'I wish I had that energy.', 'Every single day, same thing.', 'Honestly, kind of iconic.', 'Do you think they ever get bored?'] },
      { by: 'b', say: ['Later. I\'m comfy.', 'Nah, let them be.', 'Ha, maybe.', 'Never. It\'s their whole personality.', 'Leave them alone, they\'re happy.', 'I\'d join, but effort.'] },
    ],
    setup: ctx => { ctx.vars.ThirdNow = cap(ctx.vars.thirdNow); },
  });

  // --- Upcoming event: you going? sit together?
  def('event', {
    key: 'eventSoon', w: 1,
    beats: [
      { by: 'a', say: ['You coming to the {event} {when}?', 'Are you going to the {event}?'] },
      { by: 'b', pick: ctx => { const ev = ctx.sim.events.nextEvent(); return ev && ev.attendees && ev.attendees.size ? (ev.attendees.get(ctx.b.name) ? 'yes' : 'no') : 'maybe'; }, say: { yes: ['Wouldn\'t miss it.', 'Obviously. Free food.', 'Yeah! You?'], no: ['Nah, I think I\'ll skip it.', 'Not feeling it, honestly.'], maybe: ['Maybe. Depends on my mood.', 'Probably?'] } },
      { by: 'a', judge: 'eventSoon', pick: ctx => { const ev = ctx.sim.events.nextEvent(); const go = ev && ev.attendees && ev.attendees.size ? ev.attendees.get(ctx.b.name) : null; ctx.going = go; return go === true ? (ctx.v === 'neg' ? 'yesCool' : 'yes') : go === false ? 'no' : 'maybe'; }, say: {
        yes: ['Me too! Sit with me?', 'Same. Save me a seat?', 'Obviously. See you there!'], yesCool: ['Great. Me too, I guess.', 'Cool. See you there.'],
        no: ['Aw, come on! It\'ll be fun.', 'Your loss.', 'Seriously? It\'s the best night of the week.'], maybe: ['Come! It won\'t be the same without you.', 'Think about it.'] } },
      { by: 'b', pick: ctx => (ctx.going === true ? (ctx.v === 'neg' ? 'flat' : 'yes') : ctx.going === false ? 'no' : 'maybe'), say: { yes: ['Deal.', 'Only if you don\'t steal my food.', 'Of course.'], flat: ['Sure.', 'Okay.'], no: ['Maybe next time.', 'I\'ll think about it.', 'We\'ll see.'], maybe: ['Okay, okay. Maybe.', 'Fine. Probably.'] } },
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
      { by: 'a', say: ['Walk with me later? Just us?', 'Dinner together tonight?', 'I was just thinking about you.', 'You looked really happy earlier. I liked that.', 'Can we watch the sunset tonight?', 'I made you something. It\'s a rock. It\'s a nice rock.'] },
      { by: 'b', judge: 'couple', say: { pos: ['Always.', 'You\'re ridiculous. Yes.', 'Stop, people are looking. ...Don\'t stop.'], neu: ['Maybe. I\'ve got stuff to do.'], neg: ['Not tonight. I\'m tired.'] } },
    ],
  });


  // --- Newcomers and visitors (town.js)
  const isNew = p => !!p.cfg.generated;
  const isVis = p => IS.Town.isVisitor(p);
  def('welcome', {
    key: 'welcome', w: 1,
    setup: ctx => {
      ctx.aNew = isNew(ctx.a) && isVis(ctx.a);
      ctx.vars.tip = IS.pick([
        `If you like ${IS.Dialogue.activityWord[ctx.a.loves[0]] || 'walks'}, you're going to love it here.`,
        'Friday dinners at the Hall are the best thing on the island.', 'Watch out for the sky. It has hands. I\'m serious.',
        `That's ${ctx.vars.cat}, by the way. ${ctx.vars.cat} runs this place.`, 'The sunsets here are unreal. Go to the beach tonight.',
        'If you need anything, just ask. Except my fishing spot. That\'s mine.']);
    },
    beats: [
      { by: 'a', pick: ctx => (ctx.aNew ? 'me' : 'them'), say: {
        them: ['Hey! You must be the new face. I\'m {A}.', 'Oh, hi! I don\'t think we\'ve met. I\'m {A}.', 'Welcome to Tidewhistle! I\'m {A}.', 'You\'re the one from the boat! I\'m {A}. Hi!'],
        me: ['Hi! I\'m {A}. I just got here.', 'Hello! I\'m {A}. I\'m new. Or visiting. Not sure yet.', 'Hi, sorry, I\'m {A}. Still figuring out where everything is.'] } },
      { by: 'b', pick: ctx => (isNew(ctx.b) && isVis(ctx.b) ? 'newbie' : ctx.b.traits.grumpy > 0.6 ? 'cool' : 'warm'), say: {
        newbie: ['Nice to meet you! I\'m {B}.', 'Hi! {B}. I\'m visiting for a few days.', 'Thanks! I\'m {B}. Everyone\'s so friendly here.'],
        warm: ['Nice to meet you! I\'m {B}.', 'Hi! {B}. So good to meet you.', 'Oh, hello! I\'m {B}. Welcome!'],
        cool: ['...{B}. Hi.', '{B}. Nice to meet you, I guess.'] } },
      { by: 'a', pick: ctx => (ctx.aNew ? 'me' : 'them'), say: { them: ctx => [ctx.vars.tip], me: ['So what\'s it like living here?', 'Any tips for a newcomer?', 'Everyone seems so nice here. Is that real?'] } },
      { by: 'b', judge: 'compliment', pick: ctx => (isNew(ctx.b) && isVis(ctx.b) ? 'me' : ctx.v === 'neg' ? 'neg' : 'them'), say: {
        me: ['Ha, noted. I think I\'m going to like it here.', 'Good to know. Thanks for the welcome!', 'Okay, this place is growing on me already.'],
        them: ['Honestly? Best place I\'ve ever lived.', 'It\'s quiet. Mostly. Until the sky does something.', 'Stick around a few days. You\'ll see.', 'Ask me again after a Friday dinner.'],
        neg: ['We\'ll see.', 'Hm. Okay.'] } },
    ],
    after: (ctx) => { const { a, b } = ctx; a.relTo(b.name).met = true; b.relTo(a.name).met = true; for (const [p, o] of [[a, b], [b, a]]) p.remember(`Met ${o.name}`, { tag: 'met', about: o.name, mood: 2 }); },
  });
  def('farewell', {
    key: 'farewell', w: 1,
    beats: [
      { by: 'a', say: ['So you\'re really leaving, huh?', 'I heard you\'re taking the next boat.', 'You\'re leaving? Already?'] },
      { by: 'b', say: ctx => (ctx.b.town && ctx.b.town.why === 'noHome' ? ['There\'s nowhere for me to live. I wish there was.', 'I wanted to stay. There just isn\'t room.'] : ['Yeah. It\'s just not for me.', 'I think so. It\'s been nice, though.', 'Yeah. Don\'t take it personally.']) },
      { by: 'a', say: ['Well, it was really nice meeting you.', 'Come back and visit, okay?', 'The island will miss you. I will, a bit.'] },
      { by: 'b', say: ['Thanks. I mean it.', 'You were one of the good ones.', 'Maybe one day.'] },
    ],
    after: (ctx) => { ctx.a.saidBye = ctx.a.saidBye || {}; ctx.a.saidBye[ctx.b.name] = true; ctx.a.changeRel(ctx.b.name, 2); ctx.b.changeRel(ctx.a.name, 3); },
  });
  def('stayPlease', {
    key: 'stayPlease', w: 1,
    setup: ctx => { const t = ctx.b.town || {}; ctx.vars.why = (t.whyLeave && t.whyLeave[0]) || 'I\'m just not happy here'; const f = ctx.b.relTo(ctx.a.name).friendship; ctx.swayed = f > 40 || (f > 15 && Math.random() < 0.55) || Math.random() < 0.2; },
    beats: [
      { by: 'a', say: ['Hey. I heard you might leave the island.', 'Is it true? You\'re thinking of leaving?', 'Please tell me you\'re not really leaving.'] },
      { by: 'b', say: ctx => [`I don't know. ${ctx.vars.why[0].toUpperCase() + ctx.vars.why.slice(1)}.`, `Maybe. ${ctx.vars.why[0].toUpperCase() + ctx.vars.why.slice(1)}.`] },
      { by: 'a', say: ['We need you here. I need you here.', 'It won\'t be the same without you.', 'Give it a few more days. Please. For me.', 'Whatever it is, we\'ll fix it together.'] },
      { by: 'b', pick: ctx => (ctx.swayed ? 'yes' : 'no'), say: { yes: ['...Okay. I\'ll give it another chance.', 'You really mean that? Okay. I\'ll stay. For now.', 'Thank you. I needed to hear that.'], no: ['I\'ll think about it. That\'s all I can promise.', 'I appreciate it. I just don\'t know.'] } },
    ],
    after: (ctx, sim) => { IS.Town.plead(sim, ctx.b, ctx.a.name, ctx.swayed ? 2 : 1); ctx.a.changeRel(ctx.b.name, 2); ctx.b.changeRel(ctx.a.name, ctx.swayed ? 5 : 2); },
  });
  def('homeTalk', {
    key: 'homeTalk', w: 1,
    beats: [
      { by: 'a', say: ['Any luck finding a place to live?', 'Still at the Hall?', 'How\'s the guest bed?'] },
      { by: 'b', say: ['No... I really want to stay, though.', 'Still waiting. Someone needs to build a house.', 'The guest bed is fine. A HOUSE would be better.'] },
      { by: 'a', say: ['Fingers crossed. I hope you stay.', 'Someone should build you one. Sky? Hello?', 'You\'d fit right in here.'] },
    ],
  });

  // --- Couples (see love.js)
  const LV = () => IS.Love;
  def('gift', {
    key: 'gift', w: 1,
    setup: ctx => {
      const g = ctx.gift || { what: 'a little something', line: 'I got you a little something. Don\'t make it weird.' };
      ctx.gift = g; ctx.vars.gift = g.what; ctx.vars.giftLine = g.line; ctx.verdict = LV().giftVerdict(ctx.b, g);
    },
    beats: [
      { by: 'a', say: ['I got you something.', 'Close your eyes. No peeking, {pet}.', 'Hold out your hands. Trust me.'] },
      { by: 'b', say: ['What? For me?', '...Okay, they\'re closed.', 'Is it a bug? It better not be a bug.'] },
      { by: 'a', say: ctx => [ctx.vars.giftLine] },
      { by: 'b', pick: ctx => ctx.verdict, say: { love: ['I LOVE it. How did you know?!', 'Stop. This is perfect.', 'I\'m keeping this forever. FOREVER.'], like: ['Aww. Thank you, {pet}.', 'That\'s really sweet of you.', 'You\'re ridiculous. Thank you.'], meh: ['Oh. {gift}. ...Thanks.', 'Huh. Okay. It\'s the thought that counts, right?'] } },
      { by: 'a', if: ctx => ctx.verdict !== 'meh', say: ['You\'re worth it.', 'Okay, now I\'m blushing.', 'Happy no-reason day.'] },
      { by: 'a', if: ctx => ctx.verdict === 'meh', say: ['...I\'ll do better next time.', 'Noted. No more of those.'] },
    ],
    after: (ctx, sim) => {
      const { a, b, gift, verdict } = ctx;
      if (a.giftFor && a.giftFor.to === b.name) a.giftFor = null;
      const d = { love: 6, like: 3, meh: 0 }[verdict];
      b.changeRel(a.name, d, d + 1); a.changeRel(b.name, 1, 1);
      b.remember(`${a.name} gave me ${gift.what}`, { tag: 'gift', about: a.name, mood: verdict === 'meh' ? 1 : 8, moodDuration: 600 });
      a.addMood(verdict === 'meh' ? 'Gift flopped a bit' : `${b.name} loved my gift`, verdict === 'meh' ? -2 : 5, 300);
      if (verdict === 'love') { b.emote('heart', 2.4); IS.Love.hearts(sim, b, 10); }
      if (a.relTo(b.name).partner) IS.Mind.news(sim, 'gift', a, b, { detail: gift.what });
      sim.log(`${a.name} gave ${b.name} ${gift.what}. ${verdict === 'love' ? `${b.name} loved it. ♥` : verdict === 'meh' ? 'It... could have gone better.' : 'Sweet.'}`, verdict === 'meh' ? 'social' : 'love', [a, b]);
    },
  });

  const US = {
    new: [['I still can\'t believe we\'re a thing.', 'Me neither. In a good way.'], ['So... are we telling people? I already told people.', 'You told EVERYONE, didn\'t you.'], ['Is it weird that I miss you when you\'re two houses away?', 'Not weird. Cute.']],
    dating: [['Remember when you tripped on the dock and pretended it was on purpose?', 'It WAS on purpose. Mostly.'], ['You know what I like about you? Everything. It\'s annoying.', 'Stop. ...No, keep going.'], ['Honest question. Pancakes or waffles. This decides our future.', 'Pancakes. Is that the right answer?'], ['I caught myself smiling at nothing today. It was you. You\'re the nothing.', 'That\'s the worst compliment and I love it.'], ['We should have a song. Like, a couple song.', 'As long as it\'s not one {third} sings.']],
    serious: [['Do you ever think about... us? Like, long term?', 'All the time, honestly.'], ['I think I want to grow old on this island. With you.', 'Old and grumpy together. Deal.'], ['I don\'t think I\'ve ever been this happy, {pet}.', 'Me neither. It\'s a little scary.'], ['You\'re my favourite person. Don\'t tell {third}.', 'Your secret\'s safe. I\'m telling everyone.']],
    engaged: [['We\'re getting MARRIED. Say it with me.', 'We\'re getting married! Ahh!'], ['I keep looking at you and thinking: fiancé. FIANCÉ.', 'Ugh, I love that word.'], ['Who\'s doing the speech? Not {third}. Anyone but {third}.', 'Agreed. Absolutely not {third}.'], ['Should we invite {cat} to the wedding?', '{cat} is the ring bearer. Non-negotiable.']],
    married: [['Morning, my favourite person. Legally.', 'Legally obligated to say good morning back.'], ['Being married to you is just a sleepover that never ends.', 'Best sleepover. Worst blanket hog.'], ['I still look at you and think: wow. I married that.', 'You did. No refunds.'], ['Do you ever miss being single?', 'Not for one second, {pet}.']],
  };
  def('us', {
    key: 'us', w: 1,
    setup: ctx => { ctx.stage = LV().stage(ctx.a, ctx.b) || 'dating'; const list = US[ctx.stage]; ctx.pair = list[Math.floor(Math.random() * list.length)]; },
    beats: [
      { by: 'a', say: ctx => [ctx.pair[0]] },
      { by: 'b', say: ctx => [ctx.pair[1]] },
      { by: 'a', if: ctx => ctx.a.relTo(ctx.b.name).romance > 60, say: ['Love you, {pet}.', 'Okay, go. Before I get sappy.', '*bumps your shoulder*', 'You\'re the best part of this island.'] },
    ],
    after: (ctx) => { ctx.a.changeRel(ctx.b.name, 0.5, 1); ctx.b.changeRel(ctx.a.name, 0.5, 1); },
  });

  def('anniversary', {
    key: 'anniversary', w: 1,
    setup: ctx => {
      const d = ctx.days || 1;
      ctx.vars.days = String(d); ctx.vars.dayword = d === 1 ? 'one whole day' : d === 7 ? 'one whole week' : d === 14 ? 'two whole weeks' : `${d} days`;
      const r = ctx.b.relTo(ctx.a.name);
      ctx.remembers = r.romance > 70 && Math.random() < 0.7 - ctx.b.traits.grumpy * 0.3;
    },
    beats: [
      { by: 'a', say: ['Do you know what today is?', 'Guess what today is, {pet}.', 'Big day today. You know why?'] },
      { by: 'b', pick: ctx => (ctx.remembers ? 'yes' : 'no'), say: { yes: ['Of course I know. {dayword}. Us.', 'It\'s been {dayword}! Of us!'], no: ['Uh... laundry day?', 'Is it... someone\'s birthday?', 'Fish day? Every day is fish day.'] } },
      { by: 'a', pick: ctx => (ctx.remembers ? 'yes' : 'no'), say: { yes: ['You remembered!', 'Happy anniversary, {pet}. Our {days}-day-iversary.'], no: ['It\'s been {dayword}, you goof. Of US.', '{dayword}! Together! Hello?!'] } },
      { by: 'b', if: ctx => !ctx.remembers, say: ['OH. Oh no. Happy anniversary! I love you!', 'I knew that. I was testing you. Happy anniversary!'] },
      { by: 'b', if: ctx => ctx.remembers, say: ['Here\'s to {dayword} more. At least.', 'Best {dayword} of my life.'] },
    ],
    after: (ctx, sim) => {
      const { a, b } = ctx, d = ctx.days || 1;
      for (const [p, o] of [[a, b], [b, a]]) { p.relTo(o.name).annivSaid = d; p.addMood(`${d} day${d > 1 ? 's' : ''} with ${o.name}`, ctx.remembers ? 8 : 4, 600); p.changeRel(o.name, 1, ctx.remembers ? 3 : 1); }
      if (!ctx.remembers) a.changeRel(b.name, -0.5);
      if (d >= 3) sim.log(`${a.name} and ${b.name} celebrated ${ctx.vars.dayword} together.${ctx.remembers ? '' : ` ${b.name} forgot. Almost.`}`, 'love', [a, b]);
    },
  });

  def('propose', {
    key: 'propose', w: 1,
    setup: ctx => { ctx.yes = LV().wouldMarry(ctx.b, ctx.a); },
    beats: [
      { by: 'a', say: ['Can I ask you something? It\'s kind of big.', 'Okay. Don\'t freak out. I\'m about to do a thing.', '{B}. Stay right there. Don\'t move.'] },
      { by: 'b', say: ['...Okay? You\'re scaring me.', 'Why are you kneeling?', 'What thing? What are you doing?'] },
      { by: 'a', say: ['*kneels* {B}, will you marry me?', '*holds out a ring made of seaweed* Marry me?', 'I want every sunset with you. Will you marry me?'] },
      { by: 'b', pick: ctx => (ctx.yes ? 'yes' : 'no'), say: { yes: ['YES. Yes yes yes!', 'Oh my gosh. YES. Obviously yes!', 'I... yes. A thousand times yes.'], no: ['I... I love you. But it\'s too soon.', 'Can we wait a little? I\'m not ready.', 'Oh no. Get up. I can\'t. Not yet.'] } },
      { by: 'a', pick: ctx => (ctx.yes ? 'yes' : 'no'), say: { yes: ['We\'re getting MARRIED!', 'I can\'t feel my legs.', 'Best. Day. Ever.'], no: ['Oh. No, I get it. I do.', 'Okay. That\'s okay. I\'ll ask again someday.'] } },
    ],
    after: (ctx, sim) => {
      const { a, b } = ctx;
      a.relTo(b.name).proposedAt = sim.clock.abs;
      if (ctx.yes) return LV().engage(sim, a, b);
      a.addMood(`${b.name} said "not yet"`, -12, 720); a.changeRel(b.name, 0, -3);
      IS.Mind.feel(a, 'sulking', b.name, 6);
      IS.Mind.news(sim, 'notYet', a, b);
      sim.log(`${a.name} proposed to ${b.name}. ${b.name} said "not yet". Ouch.`, 'warn', [a, b]);
    },
  });

  def('weddingTalk', {
    key: 'weddingTalk', w: 1,
    setup: ctx => { const d = (ctx.a.relTo(ctx.b.name).weddingDay || ctx.sim.clock.day + 1) - ctx.sim.clock.day; ctx.vars.wday = d <= 0 ? 'today' : d === 1 ? 'tomorrow' : `${IS.WEEKDAYS[ctx.sim.weekdayOf(ctx.sim.clock.day + d)]}`; },
    beats: [
      { by: 'a', say: ['Are you nervous about {wday}?', 'The wedding is {wday}. THE WEDDING.', 'I\'m going to cry at the wedding. Fair warning.'] },
      { by: 'b', say: ['Only that you\'ll come to your senses.', 'Nervous? No. Terrified? A little.', 'You cry at sunsets. I\'d expect nothing less.'] },
      { by: 'a', say: ['I can\'t wait to marry you, {pet}.', 'See you at the Hall. Don\'t be late.', 'Practise your "I do". Mine\'s ready.'] },
    ],
  });

  def('coupleFight', {
    key: 'coupleFight', w: 1,
    setup: ctx => {
      ctx.vars.rival = ctx.rival || 'them';
      const rv = ctx.sim.byName(ctx.vars.rival);
      ctx.vars.guilty = !!(rv && ctx.b.relTo(rv.name).romance > 40);
      const r = ctx.a.relTo(ctx.b.name);
      ctx.vars.soften = ctx.vars.guilty ? Math.random() < 0.25 : (ctx.a.traits.kind > 0.5 || r.romance > 82 || Math.random() < 0.4);
    },
    beats: [
      { by: 'a', say: ['So. You and {rival}. Want to explain?', 'I saw you with {rival}. Laughing. Flirting.', 'Fun chat with {rival} earlier, huh?'] },
      { by: 'b', pick: ctx => (ctx.vars.guilty ? 'guilty' : 'innocent'), say: { innocent: ['What? It was nothing! We were just talking.', 'Are you jealous? Of {rival}? Seriously?', '{pet}, no. You\'re the only one.'], guilty: ['...It\'s not what it looks like.', 'Okay, I MAYBE flirted a little. It meant nothing.'] } },
      { by: 'a', pick: ctx => (ctx.vars.soften ? 'soft' : 'storm'), say: { soft: ['...Okay. I believe you. I just got scared.', 'Fine. Sorry. I hate feeling like this.'], storm: ['Whatever. I need some space.', 'Don\'t "{pet}" me right now.', 'I can\'t even look at you.'] } },
      { by: 'b', pick: ctx => (ctx.vars.soften ? 'soft' : 'storm'), say: { soft: ['Come here. Nobody else, okay?', 'Hey. I\'m yours. Dork.'], storm: ['Wait, please!', 'Fine! Go, then!'] } },
    ],
    after: (ctx, sim) => LV().fightOutcome(sim, ctx.a, ctx.b, ctx),
  });

  def('makeUp', {
    key: 'makeUp', w: 1,
    beats: [
      { by: 'a', say: ['Hey. About earlier...', 'Can we talk? I hate this.', 'I\'ve been miserable all day. You?'] },
      { by: 'b', say: ['Yeah. Me too.', 'I\'m sorry. I really am.', 'Miserable. Completely.'] },
      { by: 'a', say: ['I hate fighting with you.', 'I overreacted. A little. Okay, a lot.', 'Nothing\'s fun when we\'re not talking.'] },
      { by: 'b', say: ['Kiss and make up?', 'Come here, {pet}.', 'Truce? Truce. Come here.'] },
    ],
    after: (ctx, sim) => LV().madeUp(sim, ctx.a, ctx.b),
  });

  def('kiss', {
    key: 'kiss', w: 1,
    setup: ctx => {
      const r = ctx.b.relTo(ctx.a.name);
      ctx.kind = ctx.a.relTo(ctx.b.name).partner ? 'partner' : r.romance > 55 && r.friendship > 25 && !ctx.a.partner() && !ctx.b.partner() ? 'yes' : 'no';
    },
    beats: [
      { by: 'a', pick: ctx => (ctx.kind === 'partner' ? 'p' : 'x'), say: { p: ['C\'mere, {pet}.', 'Hey. Come here a sec.'], x: ['Can I try something?', 'Okay. Don\'t move.'] } },
      { by: 'b', say: ['Mm? What?', '...What are you doing?'] },
      { by: 'a', say: ['*kiss*', '*leans in and kisses {B}*'] },
      { by: 'b', pick: ctx => ctx.kind, say: { partner: ['...What was that for?', 'Do that again.', 'Hi to you too.'], yes: ['...Wait. Does this mean...?', 'Oh. OH. Okay. Wow.'], no: ['WHAT are you DOING?!', 'Whoa! Personal space!', 'Did the sky put you up to this?!'] } },
      { by: 'a', pick: ctx => ctx.kind, say: { partner: ['Just because.', 'You looked kissable.'], yes: ['It means I like you. A lot.', 'Yeah. It means that.'], no: ['I... sorry. The sky made me do it.', 'That was a mistake. A huge one.'] } },
    ],
    after: (ctx, sim) => {
      const { a, b } = ctx;
      if (ctx.kind === 'partner') { LV().kiss(sim, a, b); a.changeRel(b.name, 1, 2); b.changeRel(a.name, 1, 2); return; }
      if (ctx.kind === 'yes') {
        a.relTo(b.name).partner = true; b.relTo(a.name).partner = true;
        a.relTo(b.name).romance = Math.max(a.relTo(b.name).romance, 60);
        LV().begin(sim, a, b); LV().kiss(sim, a, b);
        for (const [p, o] of [[a, b], [b, a]]) p.remember(`Started dating ${o.name}!`, { tag: 'romance', mood: 25, moodDuration: 1440, about: o.name });
        IS.Mind.news(sim, 'couple', a, b);
        sim.log(`${a.name} kissed ${b.name} out of nowhere... and now they're dating! ♥`, 'love', [a, b]);
        sim.toast(`${a.name} and ${b.name} are now a couple!`);
        return;
      }
      b.changeRel(a.name, -8, -10); b.emote('anger', 2);
      a.addMood(`${b.name} did NOT want that kiss`, -10, 600);
      const g = IS.Mind.led(b, a.name); g.grudge += 6; g.why = 'that kiss';
      IS.Mind.news(sim, 'rejected', a, b);
      sim.log(`${a.name} tried to kiss ${b.name}. ${b.name} was not having it.`, 'warn', [a, b]);
    },
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
      { by: 'a', say: ctx => ctx.news && ctx.news.kind === 'engaged' ? ['You two are getting MARRIED! Congrats!!', 'Engaged! I need to hear the whole proposal.'] : ctx.news && ctx.news.kind === 'wedding' ? ['Married! You two! Congrats!!', 'That wedding. I\'m still crying.'] : ctx.news && ctx.news.kind === 'won' ? ['Champion of the dock! Congrats!', 'You actually won! Congrats!'] : ['You and {partnerOf}?! Congrats!! Finally!', 'Okay, you two are adorable. Congrats!'] },
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
  // ------------------------------------------------------------ greetings
  // Built from what's going on: time, weather, how long since they talked,
  // what the other person is doing, and how they feel about each other.
  const GREET = {
    morning: ['Morning, {other}!', 'Good morning!', 'Oh, morning!', 'Morning. Sleep okay?', 'Hey, early bird.'],
    afternoon: ['Hey, {other}!', 'Afternoon!', 'Oh, hey!', 'Hey you.', 'There you are.'],
    evening: ['Evening, {other}.', 'Good evening!', 'Hey, {other}. Long day?', 'Oh, hey. Nice evening, huh?'],
    night: ['Hey. Can\'t sleep either?', 'Still up?', 'Oh! Didn\'t expect anyone out here.'],
    again: ['Back again?', 'Oh, hi again!', 'Twice in one day!', 'We keep running into each other.', 'Hey again.'],
    long: ['{other}! Long time no see!', 'Where have YOU been?', 'Haven\'t seen you in ages!', 'Oh wow, look who it is! {other}!'],
    rain: ['Hey! Soaked yet?', 'Nice weather for ducks, huh?', 'Hey! Come stand under here.', 'You\'re dripping!', 'Rain buddies!'],
    storm: ['You\'re out in THIS?', 'Get inside, it\'s wild out there!', 'Hey! Did the wind try to steal you too?', 'Stay close, it\'s nasty out.'],
    fog: ['Oh! You came out of the fog like a ghost.', 'Hey, I almost didn\'t see you there.', 'Is that you? Hard to tell in this soup.', 'Spooky out, huh?'],
    cloudy: ['Grey one today, huh?', 'Hey! Think it\'ll rain?'],
    best: ['{OTHER}! My favourite person.', 'There\'s my guy.', 'Ayy, look who it is!', 'Hey, you!'],
    partner: ['Hey, you. Hi.', 'There you are. Missed you.', 'Hi, cutie.', 'Oh, hi. Hi hi.', 'Hey, {pet}.', 'There\'s my {pet}.', '{pet}! Come here.'],
    crush: ['Oh! H-hey, {other}.', 'Hey! Hi. Hello. Hey.', 'Oh, it\'s you! Cool. Hi.'],
    rival: ['Oh. It\'s you.', '...{other}.', 'Great. You.', 'Hm. Hi.'],
  };
  // "What are you doing" greetings, each with answers that fit that question
  const DOING = {
    fish: [['Catch anything?', ['A couple. You?', 'Nothing. The fish are on strike.', 'One. It was tiny. I let it go.', 'Three! Don\'t ask how big.']], ['Fishing again?', ['Always.', 'You know it.', 'It\'s basically my job now.']], ['Biting today?', ['Not even a nibble.', 'Like crazy!', 'Slowly.']], ['Still waiting on the big one?', ['Any minute now.', 'It\'s out there. I can feel it.']]],
    garden: [['How\'s the garden?', ['Growing! Slowly.', 'Weeds are winning.', 'The carrots are being stubborn.', 'Thriving. Unlike me.']], ['Those tomatoes look close!', ['Two more days, I think.', 'Don\'t jinx it!']], ['Need a hand with the weeds?', ['Please. They grow back out of spite.', 'I\'ve got it, thanks!']], ['Talking to the plants again?', ['They\'re good listeners.', 'They started it.']], ['Getting your hands dirty?', ['Always.', 'Best kind of dirty.']], ['What are you planting?', ['Cabbages. Again.', 'Hope, mostly.']], ['Still out here?', ['Plants don\'t water themselves.', 'Can\'t leave them now.']], ['The garden looks amazing.', ['Thanks! It\'s been a lot of work.', 'Tell the cabbages, they\'ll be thrilled.']]],
    chop: [['Saving some trees for the rest of us?', ['A few. Maybe.', 'No promises.']], ['Need a hand with that?', ['Grab an axe.', 'I\'m good. Almost done.']], ['How many logs is that?', ['Twelve. Not that I\'m counting.', 'Enough for a week.']], ['Careful with that axe!', ['I\'m always careful.', 'Says the person standing right there.']]],
    read: [['Good book?', ['So good. Don\'t spoil it.', 'Can\'t put it down.']], ['What are you reading?', ['Something with a map in the front. The best kind.', 'A mystery. Everyone\'s lying.']], ['How far in are you?', ['Halfway. It\'s getting wild.', 'Last chapter. Go away.']]],
    beach: [['Working on that tan?', ['Every day.', 'It\'s a full-time job.']], ['Comfy down there?', ['Extremely comfy.', 'Peak relaxation.']], ['Room for one more?', ['Always.', 'If you bring snacks.']], ['Are you asleep?', ['...No.', 'Not anymore.']]],
    swim: [['How\'s the water?', ['Perfect.', 'Freezing. Love it.', 'Like bathwater!']], ['Seen any fish?', ['Something touched my foot.', 'One. It was judging me.']]],
    forage: [['Find anything good?', ['Mushrooms! Probably edible.', 'Some berries. I ate half.']], ['Any berries left for me?', ['A few. Maybe.', 'Define "left."']]],
    stargaze: [['Any shooting stars yet?', ['Not yet. Patience.', 'One! You missed it.']], ['Which one\'s your favourite?', ['That bright one. Always.', 'The little crown, over there.']]],
    petCat: [['How\'s {cat}?', ['Perfect, as always.', 'Purring like an engine.']], ['Has she forgiven you yet?', ['She\'s ignoring me. Lovingly.', 'Almost.']]],
  };
  const GREET_BACK = {
    warm: ['Hey yourself!', 'Oh, hi!', 'Hey hey!', 'Hi! What\'s up?', 'Good to see you.', 'Oh, perfect timing!', 'Hi! I was just thinking about you.', 'There you are!', 'Oh, yay, company.', 'Hiii.', 'Look who it is!', 'Hey! How\'s it going?'],
    neutral: ['Hey.', 'Hi.', 'Oh, hey.', 'Yo.', 'Mm, hi.', 'Hey there.', 'Oh. Hi.', 'What\'s up?'],
    grumpy: ['What.', 'Hm.', 'Yeah, hi.', 'Make it quick.', 'Oh. You.', 'I\'m busy.', 'Mm.'],
    partner: ['Hi, you.', 'There you are.', 'Missed you too.', 'Hi, {pet}.', 'Hey yourself, {pet}.'],
    crush: ['Oh! Hi! Hey.', 'H-hey!', 'Oh, hi! Cool. Hi.'],
  };

  T.greetLines = (sim, a, b) => {
    const ctx = T.ctx(sim, a, b);
    const min = sim.clock.min, now = sim.clock.abs;
    const lastSeen = (a.lastTalked || {})[b.name];
    const r = a.relTo(b.name), rb = b.relTo(a.name);
    const pools = [];
    const add = (pool, n = 1) => { for (let i = 0; i < n; i++) pools.push(pool); };
    add(min < 5 * 60 || min >= 22 * 60 ? GREET.night : min < 12 * 60 ? GREET.morning : min < 17 * 60 ? GREET.afternoon : GREET.evening, 2);
    if (lastSeen !== undefined && now - lastSeen < 240) add(GREET.again, 3);
    if (lastSeen === undefined || now - lastSeen > 2880) add(GREET.long, 2);
    if (GREET[sim.weather]) add(GREET[sim.weather]);
    if (r.partner) add(GREET.partner, 3);
    else if (r.romance > 45) add(GREET.crush, 2);
    else if (r.friendship > 55) add(GREET.best, 2);
    else if (r.friendship < -15) add(GREET.rival, 3);
    const bAct = b.action && b.action.phase === 'do' ? b.action.def.id : null;
    const doingQ = bAct && DOING[bAct] && Math.random() < 0.55;
    const tone = IS.Dialogue.tone(a, b);
    const qa = doingQ ? IS.pick(DOING[bAct]) : null;
    let first = qa ? qa[0] : null;
    if (!first) {
      const pool = Math.random() < 0.35 ? null : IS.pick(pools);
      first = pool ? pick(pool, a.name) : IS.Dialogue.as(a).line('greet', tone);
    }
    let second;
    if (qa) second = pick(qa[1], b.name);
    else {
      const t2 = IS.Dialogue.tone(b, a);
      const bp = rb.partner ? GREET_BACK.partner : rb.romance > 45 ? GREET_BACK.crush : GREET_BACK[t2 === 'excited' ? 'warm' : t2] || GREET_BACK.neutral;
      second = Math.random() < 0.6 ? pick(bp, b.name) : IS.Dialogue.as(b).line('greet', t2);
    }
    const f = (t, sp) => IS.Dialogue.fill(fill(t, ctx, sp), IS.Social.ctx(sim, sp, sp === a ? b : a));
    // Never met: no "long time no see"
    if (IS.Town.stranger(a, b)) {
      const aNew = a.cfg.generated && IS.Town.isVisitor(a), bNew = b.cfg.generated && IS.Town.isVisitor(b);
      const first = aNew && !bNew ? ['Hi! Um, hello!', 'Oh, hello there!', 'Hi! Sorry, I\'m new here.'] : bNew && !aNew ? ['Oh, hello!', 'Hi there!', 'Oh! A new face!', 'Hey! Hi!'] : ['Hi!', 'Oh, hello!', 'Hey there!'];
      const second = bNew && !aNew ? ['Hi!', 'Oh, hello!', 'Hello! I\'m new.'] : ['Hi!', 'Oh, hello.', 'Hey there!'];
      const out = [{ sp: a, text: f(IS.pick(first), a) }, { sp: b, text: f(IS.pick(second), b) }];
      out.askedDoing = true;
      return out;
    }
    // A couple in the middle of a fight (or about to have one)
    if (r.partner && ((r.tiff && !r.tiff.talked) || IS.Love.tiff(a, b))) {
      const stormed = IS.Love.tiff(a, b);
      const out = [{ sp: a, text: f(IS.pick(stormed ? ['Hey.', '...Hi.', 'Can I talk to you?'] : ['Hey. We need to talk.', '...Hi.', 'Oh. It\'s you.']), a) }, { sp: b, text: f(IS.pick(stormed ? ['...Hi.', 'Hey.', 'Oh. Hi.'] : ['Uh oh.', 'Okay... what?', 'That doesn\'t sound good.']), b) }];
      out.askedDoing = true;
      return out;
    }
    if (IS.Gods.inMourning(a) || IS.Gods.inMourning(b)) {
      first = IS.pick(['Hey.', 'Hi.', `Hey, {other}.`, '...hi.', 'How are you holding up?']);
      second = IS.pick(['Hey.', 'Hi.', 'I\'ve been better.', 'Barely.', '...']);
      const out = [{ sp: a, text: f(first, a) }, { sp: b, text: f(second, b) }];
      out.askedDoing = true;
      return out;
    }
    const out = [{ sp: a, text: f(first, a) }, { sp: b, text: f(second, b) }];
    out.askedDoing = !!qa;
    return out;
  };

  const SEGUE = ['Oh, that reminds me—', 'Anyway!', 'Okay, totally unrelated, but—', 'Oh! Before I forget—', 'Wait, also—', 'Okay, new topic.', 'Okay, changing the subject.', 'Speaking of nothing at all—', 'Oh! Random thought.', 'Wait, I have to tell you something.', 'So, anyway.', 'Okay, but more importantly—', 'Also! Also.', 'Unrelated, but—'];
  const BYE = {
    a: ['Anyway, I should {aNext}.', 'Okay, I gotta {aNext}. Later!', 'I\'ll let you go. Gonna {aNext}.', 'Alright, I\'m gonna {aNext}. See you!', 'Okay, {aNext} time. Bye!', 'I\'d better {aNext} before it gets late.', 'Right. I really need to {aNext}.'],
    night: ['Okay, I\'m heading to bed. Night!', 'I can barely keep my eyes open. Night!', 'Bedtime for me. Sleep well!'],
    event: ['See you at the {event}!', 'Save me a seat at the {event}!', 'Okay, see you {when}!'],
    partner: ['Okay. Bye, you.', 'See you later. Miss me.', 'Bye! Don\'t go flirting with anyone.', 'I\'ll come find you later.', 'Okay, go. Before I make you stay.', 'Bye. Think about me.', 'See you tonight?', 'Bye, {pet}.', 'Later, {pet}. Love you.'],
    b: { warm: ['See you later!', 'Bye! Don\'t be a stranger.', 'Later!', 'Have fun!', 'Bye bye!', 'See ya!', 'Don\'t work too hard!', 'Catch you later!'], cool: ['Bye.', 'See ya.', 'Mm. Bye.', 'Later.', 'Okay.'], partner: ['Bye, you.', 'Miss you already.', 'Don\'t be long.', 'Later, cutie.', 'Go, go. Have fun.', 'I\'ll be thinking about you.', 'Come back soon.'], night: ['Night!', 'Sleep well!', 'Night night.'] },
  };

  // ------------------------------------------------------------ lore
  T.addLore = (sim, l) => {
    sim.lore = sim.lore || [];
    sim.lore.push({ id: (sim.loreId = (sim.loreId || 0) + 1), t: sim.clock.abs, ...l });
    if (sim.lore.length > 20) sim.lore.shift();
  };

  // ------------------------------------------------------------ death (see gods.js)
  // Talking about someone who died
  def('mourn', {
    key: 'mourn', w: 1,
    setup: ctx => {
      ctx.vars.dead = ctx.dead;
      const e = ctx.b.mourning && ctx.b.mourning[ctx.dead];
      ctx.bFelt = !e ? 'meh' : e.partner || e.f > 50 ? 'close' : e.f > 10 ? 'sad' : e.f < -30 ? 'cold' : 'meh';
    },
    beats: [
      { by: 'a', pick: ctx => ctx.stage || 'sadness', say: {
        anger: ['The Sky did this. I\'ll never forgive it.', 'I\'m so ANGRY. {dead} didn\'t deserve that.', 'Why {dead}? Out of everyone. Why?'],
        acceptance: ['I was thinking about {dead} today. The good stuff, for once.', 'I think {dead} would want us to be okay.', 'Remember how {dead} used to laugh? I miss that.'],
        sadness: { any: ['I keep thinking about {dead}.', 'It doesn\'t feel real. {dead} is just... gone.', 'I walked past {dead}\'s place today. Out of habit.', 'Do you ever just... forget? And then remember {dead} is gone?'], Iroh: ['I had a joke ready for {dead}. A good one. Now what do I do with it?'], Lynn: ['I keep making two cups of tea.'], Egg: ['Even {cat} seems sad about {dead}.'], Jude: ['Feels wrong without {dead} around, man.'], Beach: ['Not that I care, but... it\'s quiet without {dead}.'], Forest: ['{dead} would have hated how quiet it is now.'] } } },
      { by: 'b', pick: ctx => ctx.bFelt, say: {
        close: ['Me too. Every single day.', 'I can\'t even go near the grave yet.', 'I still hear their voice sometimes.'],
        sad: ['Yeah. It\'s strange without them.', 'I know. I didn\'t expect it to hit this hard.', 'Same. It\'s just... wrong.'],
        meh: ['Yeah. It\'s strange.', 'I didn\'t know them that well, but still.', 'Mm. Life is short, huh.'],
        cold: ['I\'m not going to pretend I\'ll miss them.', '...I don\'t really know what to say.', 'Honestly? I\'m fine.'],
      } },
      { by: 'a', if: ctx => ctx.stage !== 'acceptance', pick: ctx => ctx.cause || 'fall', say: {
        smite: ['Lightning. From a CLEAR sky.', 'The Sky just... struck them down. Why them?', 'I can still see the flash when I close my eyes.'],
        meteor: ['A rock. From SPACE. Who even dies like that?', 'There wasn\'t even enough left to bury properly.', 'I still find bits of... never mind.'],
        fire: ['The screaming. I can still hear the screaming.', 'If someone had just gotten water...', 'I can\'t look at the bonfire anymore.'],
        fall: ['The Sky threw them. Just THREW them.', 'That sound when they landed... I\'ll never forget it.', 'One second they were flying, and then...'],
      } },
      { by: 'b', if: ctx => ctx.bFelt !== 'cold', judge: 'comfort', say: { pos: ['Hey. Come here. We\'ll get through it.', 'At least we still have each other.', 'They\'d want us to keep going. Probably with snacks.'], neu: ['Don\'t say that too loud. It might be listening.', 'Whatever is up there, it isn\'t kind.', 'Maybe they\'ll come back. Stranger things have happened.'], neg: ['I really don\'t want to talk about this.', 'Can we not? Please?'] } },
    ],
    after: ctx => {
      if (ctx.bFelt === 'cold') { ctx.a.changeRel(ctx.b.name, -4); return; }
      ctx.a.changeRel(ctx.b.name, 3); ctx.b.changeRel(ctx.a.name, 3);
      ctx.a.addMood('Shared the grief', 3, 300);
    },
  });

  // --- Coming back from the dead (gods.js)
  // Telling someone the good news
  def('reviveNews', {
    key: 'reviveNews', w: 1,
    setup: ctx => { ctx.vars.dead = ctx.dead; const e = ctx.b.revived && ctx.b.revived[ctx.dead]; ctx.bFelt = !e ? 'mid' : e.partner || e.f > 40 ? 'close' : e.f < -30 ? 'cold' : 'mid'; },
    beats: [
      { by: 'a', say: ['You will NOT believe this.', 'Okay, sit down. Good news, for once.', 'Have you heard?! About {dead}?', 'Something impossible just happened.'] },
      { by: 'b', say: ['What? What happened?', 'If this is a joke, I\'m not in the mood.', 'Heard what?'] },
      { by: 'a', say: ['{dead} is alive. ALIVE. The Sky brought them back.', '{dead} climbed out of the grave. I saw it.', '{dead} is back. Like, walking-around back.'] },
      { by: 'b', pick: ctx => ctx.bFelt, say: {
        close: ['...What? WHERE? Where are they?!', 'Don\'t lie to me. Don\'t you DARE lie to me.', 'I have to see them. Right now.'],
        mid: ['No way. That\'s... that\'s insane.', 'Back from the DEAD? How?!', 'Okay, that\'s actually terrifying.'],
        cold: ['Great. Wonderful. Fantastic.', 'Of course they are.', 'Huh. So much for peace and quiet.'],
      } },
    ],
    after: (ctx, sim) => IS.Gods.learnRevive(sim, ctx.b, ctx.dead, 'told', ctx.a),
  });

  // Someone still grieving gets set straight
  def('mournCorrected', {
    key: 'mournCorrected', w: 1,
    setup: ctx => { ctx.vars.dead = ctx.dead; },
    beats: [
      { by: 'a', say: ['I keep thinking about {dead}.', 'I miss {dead} so much.', 'It\'s so quiet without {dead}.'] },
      { by: 'b', say: ['Wait. You didn\'t hear?!', 'Oh my gosh. Nobody told you?', 'Hold on. You don\'t know?'] },
      { by: 'a', say: ['...Hear what?', 'Know what?', 'What are you talking about?'] },
      { by: 'b', say: ['{dead} is ALIVE! The Sky brought them back!', '{dead} came back! They\'re walking around and everything!', 'Go look! {dead} is alive!'] },
    ],
    after: (ctx, sim) => IS.Gods.learnRevive(sim, ctx.a, ctx.dead, 'told', ctx.b),
  });

  // Two people who know, trying to make sense of it
  def('miracleTalk', {
    key: 'miracleTalk', w: 1,
    setup: ctx => { ctx.vars.dead = ctx.dead; },
    beats: [
      { by: 'a', say: ['So... {dead} came back from the dead. We\'re just okay with that?', 'I still can\'t believe {dead} is alive.', '{dead} being back. What does that even MEAN?'] },
      { by: 'b', pick: ctx => (ctx.b.skyOpinion > 20 ? 'faith' : ctx.b.skyOpinion < -30 ? 'fear' : 'unsure'), say: {
        faith: ['Maybe the Sky isn\'t so bad after all.', 'It means the Sky cares. Kind of.', 'Honestly? It\'s beautiful.'],
        fear: ['It means the Sky decides who lives. That\'s scarier.', 'If it can bring us back, it can take us again.', 'I don\'t trust it.'],
        unsure: ['I stopped trying to understand this island.', 'I\'m just glad they\'re back.', 'I have no idea. I\'m choosing joy.'],
      } },
      { by: 'a', say: ['Did they seem... different to you?', 'They keep talking about a hand. A big hand.', 'Let\'s just be nice to them. Being dead sounds rough.'] },
    ],
    after: ctx => { (ctx.a.revived[ctx.dead].talked = ctx.a.revived[ctx.dead].talked || {})[ctx.b.name] = true; ctx.a.changeRel(ctx.b.name, 2); },
  });

  // The revived person finding the people they love
  def('imBack', {
    key: 'imBack', w: 1,
    setup: ctx => { ctx.vars.dead = ctx.a.name; ctx.knew = !!(ctx.b.revived && ctx.b.revived[ctx.a.name] && ctx.b.revived[ctx.a.name].aware); },
    beats: [
      { by: 'a', say: ['Hey... it\'s me. I\'m back.', 'Surprise? I\'m not dead anymore.', 'I came straight to find you.', 'I missed you. Like, from the other side.'] },
      { by: 'b', pick: ctx => (ctx.knew ? 'knew' : 'shock'), say: { knew: ['I heard! I didn\'t believe it! Come here!', 'You\'re really here. You\'re actually here.', 'Don\'t you EVER do that to me again.'], shock: ['...What. WHAT?!', 'You\'re... you were... I went to your FUNERAL!', 'Am I dreaming? Pinch me.'] } },
      { by: 'a', say: ['I know. I know. It\'s a lot.', 'The Sky did it. Don\'t ask me how.', 'I\'m okay. I think. Mostly.'] },
      { by: 'b', pick: ctx => { const f = ctx.b.relTo(ctx.a.name).friendship; return f > 35 ? 'pos' : f > -20 ? 'neu' : 'neg'; }, say: { pos: ['I\'m never letting you out of my sight.', 'Best news I\'ve ever had.', 'Welcome back. For real.'], neu: ['Okay. Okay. This is fine.', 'Welcome back, I guess.'], neg: ['Huh. Welcome back.', 'Great.'] } },
    ],
    after: (ctx, sim) => { (ctx.a.toldBack = ctx.a.toldBack || {})[ctx.b.name] = sim.clock.abs; (ctx.b.welcomedBack = ctx.b.welcomedBack || {})[ctx.a.name] = sim.clock.abs; IS.Gods.learnRevive(sim, ctx.b, ctx.a.name, 'met'); ctx.a.changeRel(ctx.b.name, 5); ctx.b.changeRel(ctx.a.name, 6); },
  });

  // "Break up with Jude" (a whisper)
  def('breakup', {
    key: 'breakup', w: 1,
    beats: [
      { by: 'a', say: ['We need to talk.', 'Can we talk? Like, actually talk?', 'I\'ve been thinking. About us.'] },
      { by: 'b', say: ['...Uh oh.', 'That doesn\'t sound good.', 'Okay... what\'s up?'] },
      { by: 'a', say: ['I think we should break up.', 'I don\'t think this is working anymore.', 'I think we\'re better as friends.'] },
      { by: 'b', pick: ctx => (ctx.b.relTo(ctx.a.name).romance > 60 ? 'hurt' : 'fine'), say: { hurt: ['What? Why?!', 'Wow. Okay. I didn\'t see that coming.', 'Did I do something wrong?'], fine: ['...Yeah. I kind of felt it too.', 'Honestly? Fair.', 'Okay. No hard feelings.'] } },
    ],
    after: (ctx, sim) => { if (ctx.a.relTo(ctx.b.name).partner) IS.Mind.breakup(sim, ctx.a, ctx.b); },
  });

  // Breaking the news to someone who hasn't heard
  def('breakNews', {
    key: 'breakNews', w: 1,
    setup: ctx => {
      ctx.vars.dead = ctx.dead;
      const e = ctx.b.mourning && ctx.b.mourning[ctx.dead];
      ctx.bFelt = !e ? 'mid' : e.partner || e.f > 40 ? 'close' : e.f < -30 ? 'cold' : 'mid';
    },
    beats: [
      { by: 'a', say: ['Did you hear about {dead}?', 'Hey... you haven\'t heard, have you? About {dead}.', 'You might want to sit down for this.', 'I have to tell you something. It\'s about {dead}.'] },
      { by: 'b', say: ['No? What about {dead}?', 'What happened?', 'You\'re scaring me. What is it?', 'What? What\'s wrong?'] },
      { by: 'a', pick: ctx => ctx.cause || 'fall', say: {
        smite: ['{dead} is dead. Lightning. Out of a clear sky.', 'The Sky struck {dead} down. They\'re gone.'],
        meteor: ['{dead} is gone. A meteor. A literal METEOR.', 'Something fell from the sky and... {dead} didn\'t make it.'],
        fire: ['{dead} burned to death. Nobody could get to them in time.', '{dead} is gone. There was a fire.'],
        fall: ['The Sky threw {dead}. They didn\'t survive the landing.', '{dead} is dead. Thrown. Like a ragdoll.'],
      } },
      { by: 'b', pick: ctx => ctx.bFelt, say: {
        close: ['No. No, that\'s not funny.', 'You\'re lying. Tell me you\'re lying.', 'I... I need to sit down.', 'No... not {dead}...'],
        mid: ['What?! When?!', 'Oh no... that\'s awful.', 'Are you serious? {dead}?', 'I just saw them yesterday...'],
        cold: ['...Huh.', 'Wow. Okay.', 'Can\'t say I\'m surprised.', 'That\'s... a lot.'],
      } },
      { by: 'a', if: ctx => ctx.bFelt === 'close', say: ['I\'m so sorry. I know what they meant to you.', 'I didn\'t want you to hear it from anyone else.', 'Come here.'] },
    ],
    after: (ctx, sim) => {
      IS.Gods.learnDeath(sim, ctx.b, ctx.dead, 'told', ctx.a);
      if (ctx.bFelt === 'close') { ctx.b.emote('sad', 3); ctx.b.changeRel(ctx.a.name, 3); }
    },
  });

  // Right after: nobody knows what to do with themselves
  def('shockTalk', {
    key: 'shockTalk', w: 1,
    setup: ctx => { ctx.vars.dead = ctx.dead; },
    beats: [
      { by: 'a', say: ['I can\'t believe {dead} is gone.', '{dead} was just here. Like, this morning.', 'It doesn\'t feel real.', 'I keep thinking I\'ll see {dead} around the corner.'] },
      { by: 'b', say: ['Me neither.', 'I don\'t know what to do with myself.', 'I keep replaying it.', 'I can\'t stop shaking.'] },
      { by: 'a', say: ['What do we even do now?', 'Someone should... I don\'t know. Do something.', 'We have to bury them, don\'t we.', 'Let\'s just... stay together today.'] },
    ],
    after: ctx => { ctx.a.changeRel(ctx.b.name, 2); ctx.b.changeRel(ctx.a.name, 2); },
  });

  // Is the Sky out to get us?
  def('skyFear', {
    key: 'skyFear', w: 1,
    beats: [
      { by: 'a', say: { any: ['Do you ever feel like something up there is watching us?', 'Is it just me, or is the sky angry lately?', 'Be careful today. The Sky has been... hungry.', 'I keep looking up. Every time a cloud moves.'], Iroh: ['Theory: the Sky is just bored and we\'re its TV.'], Beach: ['If the Sky touches me, I\'m suing.'] } },
      { by: 'b', pick: ctx => (ctx.b.skyOpinion > 30 ? 'faith' : ctx.b.skyOpinion < -40 ? 'fear' : 'unsure'), say: {
        faith: ['The Sky is just. We must have deserved it.', 'Pray and it will spare you. It spared me.', 'It blessed me once, you know. It\'s not all bad.'],
        fear: ['I barely sleep anymore.', 'Every time it thunders I hide under my bed.', 'We need to stay together. Safety in numbers.'],
        unsure: ['Accidents happen. Probably.', 'I try not to think about it.', 'Maybe it\'s testing us?'],
      } },
      { by: 'a', say: ['Let\'s just... stay away from open fields.', 'If I go, you can have my stuff. Except the good stuff.', 'Well, if it comes for us, at least we\'ll go together.', 'Maybe we should pray. Just in case.'] },
    ],
    after: ctx => { ctx.a.changeRel(ctx.b.name, 1); },
  });

  // Talking to someone who came back from the dead
  def('backFromDead', {
    key: 'backFromDead', w: 1,
    beats: [
      { by: 'a', say: { any: ['You... you were DEAD.', 'Is it really you?! I saw your grave!', 'Okay, I have to ask. What was it like?', 'You\'re not a ghost, right? Let me poke you.'], Iroh: ['So. Death. Five stars or one star?'], Beach: ['You were dead for a WHOLE day and nobody took your stuff. You\'re welcome.'] } },
      { by: 'b', say: { any: ['I know. Trust me, I know.', 'It was dark. And quiet. And then... a hand.', 'Being dead was very boring. Would not recommend.', 'I don\'t really want to talk about it.'], Egg: ['Honestly? Best nap of my life.'], Forest: ['Death was just a warm-up.'] } },
      { by: 'a', pick: ctx => { const f = ctx.a.relTo(ctx.b.name).friendship; return f > 35 ? 'pos' : f > -20 ? 'neu' : 'neg'; }, say: { pos: ['Don\'t ever do that again.', 'I\'m so glad you\'re back. Seriously.', 'I missed you. Like, a lot.'], neu: ['Well. Welcome back, I guess.', 'Weird. But okay.'], neg: ['Great. You\'re back.', 'Huh. And here I was enjoying the quiet.'] } },
    ],
    after: (ctx, sim) => { (ctx.a.welcomedBack = ctx.a.welcomedBack || {})[ctx.b.name] = sim.clock.abs; if (ctx.a.relTo(ctx.b.name).friendship > 35) { ctx.a.changeRel(ctx.b.name, 4); ctx.b.changeRel(ctx.a.name, 6); } },
  });

  // ------------------------------------------------------------ choosing
  const BYKEY = {};
  for (const t of Object.values(TH)) (BYKEY[t.key] = BYKEY[t.key] || []).push(t);

  // Turn a topic (from the topic weighting in social.js) into a thread
  T.threadFor = (sim, a, b, topic, extra = {}) => {
    let list = (BYKEY[topic] || []).filter(t => !t.who || t.who.includes(a.name));
    if (topic === 'catchphrase' && !list.length) list = [];
    if (!list.length) return null;
    if ((topic === 'congrats') && !extra.news) extra.news = (sim.news || []).slice().reverse().find(n => a.knows.has(n.id) && ['couple', 'won', 'engaged', 'wedding'].includes(n.kind) && (n.a === b.name || n.b === b.name) && n.a !== a.name && n.b !== a.name);
    if (topic === 'myNews' && !extra.news) return null;
    if (topic === 'welcome' && !IS.Town.stranger(a, b)) return null;
    if (topic === 'farewell' && !(b.town && b.town.status === 'leaving')) return null;
    if (topic === 'homeTalk' && !(b.town && b.town.status === 'waiting')) return null;
    if (topic === 'stayPlease' && !(b.town && b.town.considering && b.town.status === 'resident')) return null;
    if (topic === 'congrats' && !extra.news) return null;
    if (topic === 'congratsSour' && !extra.news) return null;
    if (topic === 'tease' && !extra.crush) { extra.crush = IS.Dialogue.crushOf(b); if (!extra.crush || extra.crush === a) return null; }
    if (topic === 'rumor' && !extra.news) return null;
    if (topic === 'lore' && !extra.lore) return null;
    const pk = [a.name, b.name].sort().join('+');
    const recent = (sim.pairThreads = sim.pairThreads || {})[pk] || {};
    const fresh = list.filter(t => !(sim.clock.abs - (recent[t.id] ?? -1e9) < 1080));
    const th = IS.pick(fresh.length ? fresh : list);
    recent[th.id] = sim.clock.abs;
    sim.pairThreads[pk] = recent;
    if (topic === 'eventRecap' && !extra.recap) return null;
    if (topic === 'teach' && !extra.teachLove) return null;
    if (topic === 'hangout' && !extra.hangDef) return null;
    if (topic === 'breakNews' && !extra.dead) { const n = IS.Gods.newsToBreak(sim, a, b); if (n) { extra.dead = n.name; extra.cause = n.cause; } }
    // They heard it from someone else on the way over: talk about it instead
    if (topic === 'breakNews' && extra.dead && b.mourning && b.mourning[extra.dead] && b.mourning[extra.dead].aware) return T.threadFor(sim, a, b, 'shockTalk', extra);
    if (topic === 'imBack' && !(a.revivedAt && sim.clock.abs - a.revivedAt < 2880)) return null;
    if (topic === 'reviveNews' && !extra.dead) { const n = IS.Gods.reviveToBreak(sim, a, b); if (n) extra.dead = n.name; }
    if (topic === 'reviveNews' && extra.dead && b.revived && b.revived[extra.dead] && b.revived[extra.dead].aware) return T.threadFor(sim, a, b, 'miracleTalk', extra);
    if ((topic === 'mourn' || topic === 'breakNews' || topic === 'shockTalk' || topic === 'reviveNews' || topic === 'mournCorrected' || topic === 'miracleTalk') && !extra.dead) return null;
    if (topic === 'askAbout' && (!extra.subject || extra.subject === a || extra.subject === b)) return null;
    if (topic === 'crushAdvice' && !extra.crush) { extra.crush = IS.Dialogue.crushOf(a); if (!extra.crush || extra.crush === b) return null; }
    const ctx = T.ctx(sim, a, b, extra);
    if (extra.recap) { ctx.vars.recap = extra.recap.replace(/^(\w+)'s/, (m, n) => n === a.name ? 'my' : n === b.name ? 'your' : m); ctx.vars.recapHost = extra.recapHost; }
    if (extra.crush) ctx.vars.crush = extra.crush.name;
    if (extra.third) { ctx.third = extra.third; ctx.vars.third = extra.third.name; ctx.vars.thirdNow = IS.Social.nowWord(extra.third); }
    if (th.setup) th.setup(ctx);
    return { th, ctx, beat: 0 };
  };

  // Topics that come from the situation, added to the usual weighting
  T.topics = (sim, sp, li, add, r) => {
    const heard = (sp.heardFuture = sp.heardFuture || {});
    const now = sim.clock.abs, min = sim.clock.min, t = sp.traits;
    const ev = sp.memories.find(m => m.tag === 'event' && now - m.t < 1080 && li.memories.some(x => x.tag === 'event' && x.text === m.text));
    // Death and the Sky
    if (IS.Love) IS.Love.topics(sim, sp, li, add);
    IS.Town.topics(sim, sp, li, add);
    const tell = IS.Gods.newsToBreak(sim, sp, li);
    if (tell) add('breakNews', 9, { dead: tell.name, cause: tell.cause });
    const shock = IS.Gods.shockTopic(sim, sp, li);
    if (shock) add('shockTalk', 4, { dead: shock.name, cause: shock.cause });
    const back = IS.Gods.reviveToBreak(sim, sp, li);
    if (back) add('reviveNews', 10, { dead: back.name });
    const wonder = IS.Gods.miracleTopic(sim, sp, li);
    if (wonder) add('miracleTalk', 3, { dead: wonder.name });
    if (sp.revivedAt && now - sp.revivedAt < 1440 && (sp.relTo(li.name).friendship > 35 || sp.relTo(li.name).partner) && !((sp.toldBack || {})[li.name] > sp.revivedAt)) add('imBack', 6);
    const grief = IS.Gods.mournTopic(sim, sp);
    // Still grieving someone the listener knows is alive again
    if (grief && li.revived && li.revived[grief.name] && li.revived[grief.name].aware) add('mournCorrected', 12, { dead: grief.name });
    else if (grief && grief.name !== li.name) add('mourn', 2.2 + grief.f / 30 + (grief.partner ? 2 : 0), { dead: grief.name, cause: grief.cause, stage: grief.stage });
    if (li.revivedAt && now - li.revivedAt < 2880 && !(sp.welcomedBack && sp.welcomedBack[li.name] > li.revivedAt)) add('backFromDead', 8);
    if (sim.deaths && now - sim.lastDeathAt < 2880) add('skyFear', 0.9 + Math.max(0, -sp.skyOpinion) / 50);
    if (ev) { const name = ev.text.replace('Went to ', ''); const evObj = sim.events.list.find(e => e.name === name); add('eventRecap', 2.2, { recap: name, recapHost: evObj && evObj.host }); }
    if (sim.weather !== 'sunny') add('weather', 0.9);
    add('debate', 0.8);
    add('mystery', 0.2 + t.curious * 0.7);
    const teach = li.loves.find(l => !sp.loves.includes(l) && !sp.hates.includes(l) && !['chatting', 'napping', 'cats', 'cooking'].includes(l));
    if (teach && r.friendship > 15) add('teach', 0.6 + t.curious * 0.5, { teachLove: teach });
    if (li.mood() < 42 && r.friendship > 25 && !IS.Mind.feeling(li)) add('wellbeing', 1.4 + t.kind * 1.5);
    const crush = IS.Dialogue.crushOf(sp);
    if (crush && crush !== li && r.friendship > 40 && li.relTo(crush.name).romance < 40) add('crushAdvice', 1.6, { crush });
    const e = IS.Mind.feeling(sp);
    if (e && e.type === 'jealous' && e.about !== li.name && r.friendship > 30) add('jealousVent', 2.2);
    if (sim.world.food < 8) add('pantry', 1.2 + t.hardworking);
    if (min < 10 * 60) add('dream', 0.9);
    if ((min > 18 * 60 || r.friendship > 45) && !(sim.clock.abs - (heard[li.name] ?? -1e9) < 4320)) add('future', 0.5 + (r.friendship > 45 ? 0.5 : 0));
    if ((r.label || '').includes('bro')) add('broBanter', 1.8);
    // Inviting them along to something they'd both enjoy
    const shared = sp.loves.find(l => HANG[l] && !li.hates.includes(l));
    const min2 = sim.clock.min;
    if (shared && r.friendship > 10 && min2 > 7 * 60 && min2 < 20 * 60 && sp.needs.energy > 35) add('hangout', 0.9 + t.sociable * 0.8 + (r.partner ? 0.8 : 0), { hangDef: HANG[shared] });
  };

  T.pickThread = (sim, a, b, used) => {
    const cands = IS.Social.chooseTopic(sim, a, b, used, true);
    // Lore: someone heard about a plan and wants to know how it's going
    const lore = (sim.lore || []).find(l => l.owner === b.name && l.knownBy.includes(a.name) && sim.clock.abs - l.t > 240 && !(l.asked || []).includes(a.name));
    if (lore) cands.push({ topic: 'lore', w: 2.4, extra: { lore } });
    const pk = [a.name, b.name].sort().join('+');
    const recent = (sim.pairThreads || {})[pk] || {};
    const usable = cands.filter(c => !used.has(c.topic) && (BYKEY[c.topic] || []).some(t => !t.who || t.who.includes(a.name)));
    // Topics this pair already covered today are much less likely to come up again
    for (const c of usable) if ((BYKEY[c.topic] || []).every(t => sim.clock.abs - (recent[t.id] ?? -1e9) < 1080)) c.w *= 0.1;
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
      const filled = pool.map(l => fill(l, ctx, sp)); filled._more = true;
      let text = pool.length ? pick(filled, sp.name) : null;
      if (!text && stock && stock.text) text = stock.text;
      if (!text) continue;
      return { sp, text, emote: stock && stock.emote };
    }
    if (th.after && !run.afterDone) { run.afterDone = true; th.after(ctx, conv.sim); }
    return null;
  };

  // A friend standing nearby reacts to what they just overheard
  const CHIME = {
    joke: ['HAHA.', 'Boo! Get off the stage!', 'That joke is mine, you stole it.', 'I heard that. Unfortunately.'],
    roast: ['OOOH.', 'Get him!', 'Oh, that\'s going in the journal.', 'Somebody get some ice for that burn.'],
    flirt: ['Get a room.', 'Ew. Cute, but ew.', 'I\'m standing RIGHT here.'],
    argue: ['Whoa, whoa. Guys.', 'Okay, let\'s all calm down.', 'Yikes.'],
    catchphrase: ['Here we go again.', 'Oh no, not this again.', 'I want in. Whatever it is.'],
    gossipGood: ['Agreed, actually.', 'Same, honestly.'],
    gossipBad: ['Ooh, tea.', 'Wait, what did I miss?'],
    debate: ['The answer is obviously neither.', 'You\'re both wrong.', 'Ooh, I have opinions on this.'],
    broBanter: ['Bros.', 'Count me in.', 'You two are so weird.'],
    any: ['Hey guys!', 'Sounds fun over here.', 'Don\'t mind me, just listening.', 'Ooh, this sounds juicy.'],
  };
  T.chimeIn = (conv, run) => {
    if (Math.random() > 0.5) return null;
    const { sim, a, b } = conv;
    const key = run.th.key;
    const near = sim.people.filter(p => p !== a && p !== b && !p.chat && p.mode === 'normal' && p.pose !== 'sleep' && (p.building || null) === (a.building || null) && IS.dist(p.x, p.y, a.x, a.y) < IS.TILE * 3.2 && p.relTo(a.name).friendship > 0);
    if (!near.length) return null;
    const by = IS.pick(near);
    // Being gossiped about while standing right there
    if ((key === 'gossipBad' || key === 'gossipGood') && run.ctx.third === by) {
      if (key === 'gossipBad') { by.changeRel(a.name, -3); by.emote('anger', 1.6); }
      return { sp: by, text: pick(key === 'gossipBad' ? ['I\'m RIGHT HERE.', 'Wow. I can hear you, you know.', 'Say it to my face. Oh wait.'] : ['Aww, I can hear you!', 'Stop, you\'re making me blush.'], by.name) };
    }
    const pool = CHIME[key] || (Math.random() < 0.4 ? CHIME.any : null);
    if (!pool) return null;
    by.needs.social = Math.min(100, by.needs.social + 3);
    return { sp: by, text: pick(pool, by.name) };
  };

  T.segue = (conv, sp) => pick(SEGUE, sp.name);
  T.bye = (conv, a, b) => {
    const sim = conv.sim;
    const ctx = T.ctx(sim, a, b);
    const min = sim.clock.min;
    const late = (min >= 21.5 * 60 || min < 4 * 60) && a.isBedtime((min + 40) % 1440);
    const ev = sim.events.nextEvent();
    const evSoon = ev && ev.day === sim.clock.day && ev.start - min < 180 && ev.start > min && ev.attendees && ev.attendees.get(a.name) && ev.attendees.get(b.name);
    const partners = a.relTo(b.name).partner;
    const warm = b.relTo(a.name).friendship > 20 && b.traits.grumpy < 0.5;
    // After bad news, or while grieving: no chirpy goodbyes
    const heavy = IS.Social.HEAVY.has(conv.lastTopic) || IS.Gods.inMourning(a) || IS.Gods.inMourning(b);
    if (conv.lastTopic === 'coupleFight' || conv.lastTopic === 'makeUp') {
      const sore = IS.Love.tiff(a, b);
      return sore
        ? [{ sp: a, text: pick(['I can\'t do this right now.', 'I\'m going for a walk.', 'Don\'t follow me.'], a.name) }, { sp: b, text: pick(['...Okay.', 'Fine.', '*sighs*'], b.name) }]
        : [{ sp: a, text: fill(pick(['Okay. Come here, you.', 'Love you, {pet}.', 'No more fighting. Deal?'], a.name), ctx, a) }, { sp: b, text: fill(pick(['Deal.', 'Love you too.', 'Never again. Probably.'], b.name), ctx, b) }];
    }
    if (heavy && !['apology', 'argue'].includes(conv.lastTopic)) {
      const told = conv.lastTopic === 'breakNews';
      return [
        { sp: a, text: pick(told ? ['I\'m sorry you had to hear it like this.', 'I just thought you should know.', 'Take care of yourself, okay?'] : ['I need some time alone.', 'Let\'s stick together today, okay?', 'Take care of yourself.', 'I\'m going to go sit somewhere quiet.', 'Come find me if you need me.'], a.name) },
        { sp: b, text: pick(told ? ['Thanks for telling me.', 'I need a minute.', '...Yeah. Thanks.'] : ['You too.', 'Yeah. Okay.', 'Stay safe.', 'I will. You too.'], b.name) },
      ];
    }
    const first = late ? BYE.night : evSoon && Math.random() < 0.7 ? BYE.event : partners && Math.random() < 0.6 ? BYE.partner : BYE.a;
    const second = late ? BYE.b.night : partners ? BYE.b.partner : warm ? BYE.b.warm : BYE.b.cool;
    return [
      { sp: a, text: fill(pick(first, a.name), ctx, a) },
      { sp: b, text: fill(pick(second, b.name), ctx, b) },
    ];
  };
  T.has = topic => !!BYKEY[topic];
  T.hangFor = love => HANG[love] || null;

  return T;
})();
