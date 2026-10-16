// Line pools for conversations. A speaker's tone comes from their traits,
// mood and how they feel about the listener. Each islander also has their
// own voice (VOICE below) that is mixed in, and nobody repeats a line they
// or anyone else said recently.
IS.Dialogue = (() => {
  const D = {};

  const L = {
    greet: {
      warm: ['{Greet}, {other}!', 'Oh, {other}! Just who I wanted to see.', 'Hey you! How are you holding up?', '{Greet}! You look well, {other}.', 'There\'s my favourite {other}.', '{other}! Come sit for a sec.', 'Hey, stranger!', 'Oh good, a friendly face.', 'Look who it is!', 'Hi hi, {other}.', 'Ah, {other}! Perfect timing.'],
      neutral: ['{Greet}, {other}.', 'Hey, {other}.', 'Oh, hi.', 'Hey. What\'s new?', 'Oh, hey.', '{other}. Hi.', 'Yo.', 'Hey there.'],
      grumpy: ['...{other}.', 'Oh. It\'s you.', 'Hm. {Greet}, I suppose.', 'What.', 'Make it quick.', 'Ugh. Hi.'],
      excited: ['{OTHER}!! Hi hi hi!', 'Heyyy {other}! Guess what?', 'Oh hey, {other}!', '{other}! Okay okay okay, listen.', 'Oh perfect, I needed someone to talk to!', 'Ayy, {other}!'],
    },
    weather: {
      sunny: ['What a gorgeous day.', 'Sun\'s out! Perfect for {fav}.', 'Not a cloud in the sky.', 'It\'s so bright I can see the mainland. Almost.', 'Days like this make the whole island glow.', 'I\'m gonna get a tan line from this shirt.', 'The sea\'s so blue today it looks fake.', 'Warm wind, warm sand. I\'m set.'],
      cloudy: ['Bit grey today, huh?', 'Clouds are rolling in.', 'Cozy kind of weather.', 'Sky can\'t make up its mind today.', 'Perfect weather for a nap, honestly.', 'Feels like it might rain later.', 'At least nobody\'s getting sunburnt.'],
      rain: ['This rain won\'t quit.', 'I like the sound of rain on the roof.', 'Everything smells like wet grass.', 'My socks are soaked. Both of them.', 'The garden must be loving this.', 'Good day to stay in with a book.', 'Puddle on the path is basically a lake now.'],
      storm: ['Did you hear that thunder?!', 'This storm is wild.', 'Hope the dock survives this one.', 'The windows are rattling like crazy.', 'I\'m not going outside. Nope.', 'That lightning lit up the whole bay!'],
      fog: ['Can barely see the lighthouse in this fog.', 'Spooky fog this morning.', 'I walked into a tree in this fog. Don\'t tell anyone.', 'Feels like the island\'s inside a cloud.', 'You could lose the whole dock in this.'],
      grumpy: ['Weather\'s terrible. As usual.', 'Can\'t this island pick a weather and stick to it?', 'Too hot. Or too cold. Never right.', 'I\'m not talking about the weather.'],
    },
    activity: {
      warm: ['I\'ve been {doing} all {partofday}. Loving it.', '{Fav} is the best thing on this island, change my mind.', 'Want to go {fav} with me later?', 'Had the nicest time {doing} earlier.', 'I could spend all day {doing}, honestly.', 'You should try {fav} with me sometime!'],
      neutral: ['Been {doing} mostly.', 'Just {doing}. You know how it is.', 'Not much. Some {doing}.', 'Same old. {Fav}, mostly.', 'Been keeping busy.'],
      grumpy: ['I\'ve been {doing}. Thrilling stuff.', 'Busy. Very busy.', 'Doing my thing. Alone. Ideally.', 'Don\'t ask.'],
    },
    sharedLove: ['You love {fav} too, right? We should go together!', 'Nothing beats {fav}. You get it.', 'We should make {fav} a weekly thing.', 'You\'re the only one who gets the {fav} thing.', 'Okay, {fav} later. You and me. Deal?'],
    gossipGood: ['{third} made me laugh so hard yesterday.', 'Have you noticed how kind {third} is lately?', '{third} is really good at {thirdFav}, you know.', 'I think {third} has been in a really good mood.', '{third} helped me out earlier. Didn\'t even ask.', 'Honestly? {third} is underrated.'],
    gossipBad: ['{third} has been getting on my nerves.', 'Between us... {third} snores. Loudly.', 'Is it just me or is {third} always {thirdDoing}?', '{third} ate the last of the bread. I saw it.', 'Don\'t tell {third} I said this, but...', '{third} thinks they\'re SO funny.'],
    compliment: ['You\'ve been working so hard, {other}.', 'You always know how to cheer me up.', 'Your {otherFav} skills are getting really good.', 'That shirt really suits you.', 'You\'re a good friend, {other}. Just saying.', 'This island\'s better with you on it.', 'You\'ve got the best laugh here, you know that?', 'I trust you more than anyone here.'],
    joke: [
      'Why did the fish blush? It saw the ocean\'s bottom.',
      'I tried to catch fog this morning. Mist.',
      'What do you call a sleeping bull? A bulldozer.',
      'I told the dock a joke. It was a bit of a stretch.',
      'Why don\'t crabs share? Because they\'re shellfish.',
      'The tide and I have a lot in common. We both keep coming back.',
      'What did the ocean say to the beach? Nothing, it just waved.',
      'I\'m reading a book about gravity. Can\'t put it down.',
      'Why do seagulls fly over the sea? Because then they\'d be bagels.',
      'What do you call a fish with no eyes? A fsh.',
      'I lost my job at the lighthouse. Too many shifts in the dark.',
    ],
    complaint: ['My back is killing me.', 'The seagulls stole my sandwich. Again.', 'Nobody ever restocks the pantry but me.', 'I\'m so {needword}.', 'Everything is going wrong today.', 'I stubbed my toe on the dock. Twice.', 'There\'s sand in places sand should not be.', 'I can\'t find my good socks anywhere.', 'Somebody left the hall door open all night.'],
    hungry: ['I\'m starving. Got anything to eat?', 'The pantry\'s looking {pantryWord}.', 'I could eat a whole fish right now. Raw. Don\'t judge.', 'What\'s for dinner? Please say something good.', 'My stomach just growled at me.'],
    deep: ['Do you ever wonder what\'s past the horizon?', 'I\'m really glad you\'re here, {other}.', 'Sometimes I miss the mainland. Not often, though.', 'This island feels like home now.', 'Do you think we\'ll still be here in ten years?', 'What do you think you\'d be doing if you never came here?', 'I feel like I can actually breathe out here.', 'Do the stars look different to you here, or is it just me?', 'I don\'t say it enough, but thanks for being around.'],
    flirt: ['The sunset\'s nicer when you\'re around.', 'Want to watch the stars with me sometime?', 'I saved you the best seat at dinner, you know.', 'You\'ve got something in your hair. Oh wait, it\'s just charm.', 'Is it hot out here or is it you?', 'I keep finding reasons to walk past wherever you are.', 'You look really good today. Like, really.', 'If you get lost in the fog, I\'ll come find you.'],
    argue: ['You left the dock a mess again, {other}!', 'Why do you ALWAYS do that?!', 'I\'m not in the mood for you right now.', 'You know what, {other}? You\'re exhausting.', 'Did you take my spot? Again?', 'You never listen to anything I say!', 'Could you NOT, for once?', 'Unbelievable. Actually unbelievable.'],
    apology: ['Hey... sorry about earlier.', 'I was a jerk before. I\'m sorry, {other}.', 'Can we just reset? I didn\'t mean it.', 'I\'ve been thinking about what I said. Sorry.'],
    skyhand: ['{other}, a giant hand picked me up today! A HAND!', 'The Sky Hand took me again. I need to lie down.', 'I was flying, {other}. Actually flying.', 'Something grabbed me by the collar and YEETED me.', 'I saw the whole island from up there. It was kind of beautiful?'],
    skyhandSea: ['Something tossed me into the SEA, {other}. The sea!', 'I\'m still wet from my little trip into the ocean.', 'A fish looked me in the eye today. Because I was IN the sea.'],
    skyhandWitness: ['I saw {third} floating over the island! FLOATING!', 'Did you see {third} fly earlier? Am I losing it?', '{third} went up like a balloon. Just... up.'],
    eventSoon: ['You coming to the {event} {when}?', 'Can\'t wait for the {event} {when}!', 'Save me a seat at the {event}, yeah?', 'The {event} is {when}. Don\'t be late this time.'],
    eventPast: ['Last {event} was lovely.', 'That {event} was so much fun.'],
    birthday: ['Happy birthday, {other}!!', 'It\'s your birthday! Happy birthday!', 'Birthday {other}! Another year of being you.', 'Happy birthday! You don\'t look a day older.'],
    sickVisit: ['I brought you some soup. Feel better, okay?', 'How are you feeling? I made you some tea.', 'Soup delivery! Don\'t argue, just eat.'],
    letter: ['I got a letter from the mainland today!', 'My cousin wrote! The mainland sounds so noisy.'],
    bottle: ['I found a message in a bottle! It said: "{bottleMsg}"', 'There was a note in a bottle on the beach. "{bottleMsg}"'],
    dolphins: ['Did you see the dolphins?!', 'Dolphins by the shore today! So many!', 'A dolphin jumped like five feet out of the water!'],
    star: ['I saw a shooting star last night. Made a wish!', 'Shooting star last night. Not telling you what I wished for.'],
    bigfish: ['I caught a fish THIS big today!', 'You should\'ve seen the fish I caught. Huge.', 'Biggest fish of my life today. No pictures, sadly.'],
    find: ['I found {detail} in the forest!', 'Look what I found out in the woods. {Detail}!'],
    confess: ['{other}... I think I\'m falling for you.', 'Can I tell you something? I really, really like you.', 'I\'ve been trying to find the right moment. I like you, {other}.'],
    food: ['What I\'d give for a proper pizza right now.', 'Lynn\'s soup could cure anything, I swear.', 'We should do a cook-off sometime.', 'If I eat one more fish I\'m going to grow gills.', 'Fresh tomatoes from the garden hit different.', 'Who keeps putting the empty jars back in the pantry?'],
    island: ['The lighthouse looks so pretty at night.', 'I found a new path behind the greenhouse.', 'Have you been to the north cliffs? The view is unreal.', 'The dock creaks like it\'s telling a story.', 'Someone should name the big rock by the beach.', 'I think the island\'s getting greener.', 'The hall smells like old wood and cinnamon. I love it.'],
    observe: ['Look at {third}, {thirdNow}.', 'Is {third} seriously {thirdNow} right now?', 'Ha, there goes {third}. {ThirdNow}, as always.', 'Should we go bother {third}? They\'re {thirdNow}.', '{third} has been {thirdNow} for ages.'],
    tease: ['Sooo... you and {crush}, huh?', 'You went all red when {crush} walked past.', 'I see how you look at {crush}. Everyone sees it.', 'Want me to put in a good word with {crush}?', 'You\'ve said {crush}\'s name like nine times today.'],
    couple: ['Hey you. Missed you.', 'I was just thinking about you.', 'Dinner together later?', 'Have I told you you\'re my favourite person today?', 'Walk with me later? Just us?', 'You\'re cute when you\'re concentrating.'],
    plans: ['What are you up to later?', 'Got any plans today?', 'What\'s the move this {partofday}?', 'Doing anything fun later?'],
    question: [],
    memoryGood: ['That chat we had was really nice, by the way.', 'I keep thinking about what you said earlier. You\'re right.', 'Thanks again for the other day.'],
    memoryBad: ['Still a bit weird about our fight, honestly.', 'Are we good? After earlier?', 'I didn\'t like how things went last time.'],
    memoryCare: ['Thanks again for the soup. Seriously.', 'You looked after me when I was sick. I won\'t forget it.'],
    // Humour styles (set per islander with `humor` in config.js)
    joke_roast: ['I\'d agree with you, {other}, but then we\'d both be wrong.', 'You fish like a cat swims.', 'Nice hair. Did the wind do that or did you lose a fight?', 'You\'re the reason the seagulls look confident.', 'You\'re like a cloud. When you leave, it\'s a nice day.', 'I\'ve seen driftwood with more personality. Kidding. Mostly.', 'You run like your shoes are arguing with each other.'],
    joke_dry: ['I chopped eleven logs today. The logs did not chop back. I win.', 'I timed my breakfast. Four minutes. Could be three.', 'Fun fact: the dock has 212 planks. I counted. Twice.', 'I rested today. For six minutes. It was terrible.', 'The seagull and I have an understanding. He stays away. I stay away.'],
    joke_goofy: ['What\'s a cat\'s favourite colour? Purrrple.', 'I want to be a cat. Sleep, eat, get petted. Peak.', 'I tried to eat a clock once. Very time consuming.', 'If you hold a shell to your ear you can hear me napping.', 'I named a crab Gerald. Gerald pinched me. Gerald is no longer my friend.', 'What if fish think WE\'RE the ones underwater?'],
    joke_cocky: ['Not to brag, but I\'m the best looking guy on this island.', 'Wait, is the ocean salty because fish sweat?', 'I\'d tell you a joke but you can\'t afford it.', 'The sun came out because it heard I was outside.', 'I don\'t lose at fishing. The fish just aren\'t ready for me.'],
    joke_brag: ['Is the moon just the sun at night? Like, genuinely?', 'Why is the sand so... sandy?', 'I\'d laugh but I just did my face.', 'Do fish get thirsty? Asking for real.', 'If I sneeze on the island does it count as weather?'],
    joke_wholesome: ['What do you call a happy island? An is-LAND of smiles. ...I tried.', 'Why did the tomato blush? It saw the salad dressing! Okay, that one\'s Egg\'s.', 'I planted a joke in the garden. Hopefully it grows funnier.'],
    roast: ['You look terrible today, {other}. Love that for you.', 'I\'ve seen better posture on a wet noodle.', 'You\'re lucky you\'re funny, {other}. Wait, you\'re not.', 'Was that your outfit on purpose?', 'You cast a fishing line like you\'re swatting a fly.', 'If confidence was talent, you\'d still be average.', 'I\'d roast you more but your life already did.'],
    brag: ['My dad could buy this whole island. Twice.', 'Ugh, there\'s literally no shopping here.', 'Back home I had a pool. Two pools, actually.', 'Do you know how much my sunglasses cost?', 'My skincare routine has more steps than the lighthouse.', 'I\'ve been to like nine countries. This is the smallest.'],
    cocky: ['You\'re welcome for me being here, by the way.', 'I could win the fishing contest blindfolded.', 'Everyone on this island secretly wants to be me.', 'I\'m basically the island\'s main character.', 'I don\'t chase. I attract. Like a magnet. A handsome magnet.'],
    cat: ['{cat} sat on my feet today. I\'m never moving again.', 'Have you seen {cat}? I need to pet {cat}.', '{cat} looked at me today. We\'re basically best friends now.', '{cat} brought me a leaf. A gift. For me.', 'I think {cat} is the real mayor of this island.'],
  };

  // Questions with answers that come from who the listener actually is
  const Q = [
    { q: 'What\'s your favourite thing on this island?', a: li => li.loves[0] ? IS.pick([`Easy. ${cap(D.activityWord[li.loves[0]] || li.loves[0])}.`, `${cap(D.activityWord[li.loves[0]] || li.loves[0])}, no contest.`, `Hmm... ${D.activityWord[li.loves[0]] || li.loves[0]}, probably.`]) : 'Honestly? The quiet.' },
    { q: 'What do you hate doing the most?', a: li => li.hates[0] ? IS.pick([`${cap(D.activityWord[li.hates[0]] || li.hates[0])}. Never again.`, `Don't make me go ${D.activityWord[li.hates[0]] || li.hates[0]}.`]) : 'Hate? Nah, I\'m good with most things.' },
    { q: 'If you could leave the island for one day, where would you go?', a: li => li.traits.curious > 0.6 ? IS.pick(['A library. A giant one.', 'Somewhere I\'ve never been. Anywhere.']) : li.cfg.quirks?.includes('greedy') ? 'A buffet. Obviously.' : li.traits.sociable > 0.8 ? 'A party. A huge one.' : IS.pick(['Nowhere, honestly. I like it here.', 'Somewhere with good bread.']) },
    { q: 'Who on the island do you trust most?', a: (li, sim, sp) => { const best = bestFriend(li, sp); return best ? (best === sp ? 'You, obviously. Don\'t make it weird.' : `${best.name}. Don't tell anyone.`) : 'Myself. And the cat.'; } },
    { q: 'Morning person or night person?', a: li => li.traits.energetic > 0.7 ? 'Both! Why choose?' : li.wakeMin > 7 * 60 ? 'Night. Mornings are a scam.' : 'Morning. The light\'s best then.' },
    { q: 'Would you rather fight one giant crab or ten tiny ones?', a: li => li.traits.brave > 0.7 ? 'One giant crab. I\'d win.' : IS.pick(['Neither. I\'d run.', 'Ten tiny ones. I have shoes.']) },
    { q: 'What\'s the best thing you\'ve eaten here?', a: li => IS.pick(['That berry pie at the last dinner.', 'Fresh fish off the grill. Unbeatable.', li.name === 'Lynn' ? 'My own soup, if I\'m honest.' : 'Lynn\'s soup. Every time.', 'A tomato straight off the vine. Warm from the sun.']) },
    { q: 'Do you think the Sky Hand is real?', a: li => li.grabCount ? 'I\'ve BEEN up there. It\'s real.' : li.traits.curious > 0.6 ? 'I think something\'s up there, yeah.' : 'Nah. People just trip a lot.' },
    { q: 'What would you do with a whole free day?', a: li => li.traits.hardworking > 0.7 ? 'Free day? I\'d still fix the fence.' : IS.pick(['Nap. Then nap again.', 'Beach. All day.', 'Absolutely nothing. It\'d be perfect.']) },
    { q: 'Do you have a crush on anyone?', a: (li, sim, sp) => { const c = crushOf(li); if (!c) return IS.pick(['Nope. Free as a seagull.', 'Not really. Should I?']); if (c === sp) return IS.pick(['...Why are you asking ME that?', 'Maybe. ...Don\'t look at me like that.']); return li.traits.sociable > 0.8 ? `Okay fine. ${c.name}. Don't tell!` : IS.pick(['What? No. ...Maybe.', 'I\'m not answering that.']); } },
  ];
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
  const bestFriend = (p, exclude) => { let best = null, f = 30; for (const [n, r] of Object.entries(p.rel)) if (r.friendship > f) { f = r.friendship; best = p.sim.byName(n); } return best; };
  const crushOf = p => { let best = null, r0 = 35; for (const [n, r] of Object.entries(p.rel)) if (r.romance > r0 && !r.partner) { r0 = r.romance; best = p.sim.byName(n); } return best; };
  D.crushOf = crushOf;
  D.question = () => IS.pick(Q);

  // Answers to "what are you up to later?"
  D.plansAnswer = li => {
    const want = li.loves.filter(l => l !== 'chatting' && l !== 'cats');
    const w = want.length ? D.activityWord[IS.pick(want)] : 'whatever happens';
    return IS.pick([`Probably ${w}. You?`, `${cap(w)}, if nobody bugs me.`, `Thinking about ${w}.`, `No plan. Maybe ${w}.`]);
  };

  // Each islander's own voice, mixed in with the shared pools
  const VOICE = {
    Iroh: {
      greet: ['Ayy, {other}. You look like you need a roast.', 'Look who finally woke up.', '{other}! My favourite victim.', 'Oh good, I was getting bored.'],
      activity: ['Went for a swim, then a run, then another swim. Normal day.', 'I\'m training. For what? Unclear.', 'Explored the cliffs again. Found nothing. Loved it.'],
      deep: ['I goof around a lot, but I do think about stuff, you know.', 'Sometimes I wonder if I\'m too much. Then I remember I\'m great.', 'You and the bros are kind of my whole world here.'],
      island: ['I swam out to the buoy today. It\'s further than it looks.', 'I\'ve mapped every path on this island. In my head. Probably.'],
      complaint: ['Forest made me do push-ups. FIFTY.', 'Someone hid my fishing rod. I suspect Egg.'],
      pos: ['Haha, okay, that was good.', 'Bro. BRO.', 'Okay that\'s actually fair.', 'Respect.', 'I\'ll allow it.', 'See, this is why we\'re friends.', 'Okay, you win this round.', 'Ha! Love it.'],
      neu: ['Interesting. Anyway—', 'Huh. Cool cool.', 'Noted.'],
      neg: ['Wow. Okay. Didn\'t ask.', 'That\'s a you problem.', 'Bold of you.'],
    },
    Forest: {
      greet: ['{other}.', 'Hey. Walk with me, I\'m busy.', 'You\'re up late.', 'Hey. You train today?'],
      activity: ['Chopped a full cord this morning.', 'Garden\'s ahead of schedule. Good.', 'Swam the bay twice. Could do three.'],
      deep: ['I push hard because standing still scares me a little.', 'I\'m not great at saying it, but I\'m glad you\'re here.', 'Sometimes I think I should slow down. Then I don\'t.'],
      island: ['The fence on the farm needs fixing. I\'ll do it.', 'Woodpile\'s low again. Nobody else notices.'],
      complaint: ['People here waste so much daylight.', 'Iroh keeps moving my axe as a joke.'],
      flirt: ['You look... good. Really good. That\'s all.', 'I\'d slow down for you. Maybe.', 'Want to train together sometime? Or... just walk?'],
      pos: ['Mm. Good.', 'Ha. Fair.', 'Right.', 'Not bad at all.', '...Okay, that\'s funny.', 'Good. I like that.', 'Huh. You\'re right.'],
      neu: ['Okay.', 'Sure.', 'Mm.'],
      neg: ['Waste of time.', 'Hm. No.', 'Don\'t start.'],
    },
    Egg: {
      greet: ['Heyyy {other}! Life\'s good, huh?', 'Oh hey! I was just about to nap. Or not. Hi!', '{other}! Have you seen the cat?', 'Yooo. What\'s good?'],
      activity: ['I napped on the beach and woke up with sand in my ear. Ten out of ten.', 'Followed {cat} around for an hour. Worth it.', 'I did nothing today and it was perfect.'],
      deep: ['I think being happy is kind of a choice, you know?', 'I don\'t need much. Sun, snacks, friends. That\'s it.', 'You\'re a good one, {other}. Like, a really good one.'],
      island: ['I found the comfiest rock on the island. Not telling where.', 'The beach at sunset? That\'s my spot.'],
      complaint: ['Forest tried to make me jog. JOG.', 'I can\'t find {cat}. I\'m worried. I\'m not worried. I\'m worried.'],
      pos: ['Hehe, nice!', 'Haha yesss.', 'Aw, I love that.', 'That\'s so good, man.', 'Dude, same!', 'Ha! Classic.', 'You\'re the best, man.'],
      neu: ['Huh, okay!', 'Cool cool cool.', 'Nice, nice.'],
      neg: ['Aw man.', 'Oof. Okay.', 'That\'s kinda harsh, dude.'],
    },
    Jude: {
      greet: ['Well, well. {other}.', 'Ayy, look who it is.', 'Miss me?', '{other}. Looking good. Not as good as me, but good.'],
      activity: ['Been chilling. It\'s a skill.', 'Swam a bit. Looked great doing it.', 'Took a nap in the sun. Woke up even better looking.'],
      deep: ['People think I don\'t care. I care. I just make it look easy.', 'I\'ve got your back. Always. Don\'t make it weird.', 'Sometimes I wonder if anyone here actually likes me.'],
      island: ['This island needs a snack bar. I\'d run it.', 'Best view on the island is the dock. Because I\'m usually on it.'],
      complaint: ['Somebody ate my snack. Okay, it was me, but still.', 'Why is everyone always working? Relax.'],
      flirt: ['You know you can\'t resist me, right?', 'Careful, you\'re staring.', 'Me and you. Sunset. Think about it.'],
      pos: ['Heh. Smooth.', 'I like that.', 'Yeah, yeah. Good one.', 'You\'re alright.', 'Okay, that\'s pretty good.', 'Ha. I\'d say that.', 'You learned that from me.'],
      neu: ['Sure, whatever.', 'Cool.', 'If you say so.'],
      neg: ['Whatever, man.', 'Pfft. Okay.', 'You\'re killing the vibe.'],
    },
    Beach: {
      greet: ['Oh. Hi, {other}.', 'Omg, finally, someone to talk to.', 'Ugh, hi. Do I look okay?', 'Hiii. You\'ll never believe my day.'],
      activity: ['I tanned. For four hours. You can tell, right?', 'I tried to call home. No signal. Obviously.', 'Literally did nothing. Iconic.'],
      deep: ['Sometimes I think nobody here actually likes me.', 'Back home everyone wanted something from me. Here nobody does. It\'s weird.', 'Don\'t tell anyone, but I kind of like it here.'],
      island: ['This island needs a spa. Like, desperately.', 'Who designed this place? There\'s no mirror ANYWHERE.'],
      complaint: ['My nails are ruined. Ruined.', 'There\'s literally a bug in my hair. GET IT OUT.', 'The sand here is so... sandy.'],
      flirt: ['You\'re kind of cute when you try.', 'I\'d let you carry my bag. Maybe.', 'Okay, you\'re not totally boring.'],
      pos: ['Literally yes.', 'Omg, same.', 'Okay, iconic.', 'Love that for me. And you.', 'Wait, that\'s cute.', 'Okay, you\'re funny. Sometimes.', 'Stop, I love that.'],
      neu: ['K.', 'Sure, I guess.', 'Mhm. Anyway.'],
      neg: ['Ew.', 'Who asked?', 'That\'s so not my problem.', 'Rude. Literally.'],
    },
    Lynn: {
      greet: ['{Greet}, {other}! Have you eaten?', 'Oh, {other}! I was hoping I\'d run into you.', 'Hi! How are you, really?', 'There you are! Everything okay?'],
      activity: ['The tomatoes are finally ripening!', 'I read three chapters and the garden got watered. Good day.', 'I\'ve been mapping the stars from the cliff.'],
      deep: ['I worry about everyone a bit too much, I think.', 'Do you ever feel like you have to hold everything together?', 'I\'m really grateful for this little island family.'],
      island: ['The greenhouse herbs are doing so well this week.', 'I\'m making a little map of the island\'s flowers.'],
      complaint: ['Someone keeps leaving muddy boots in the hall.', 'The pantry\'s getting low and nobody\'s noticed.'],
      flirt: ['I like when you\'re around. Things feel calmer.', 'Would you want to stargaze with me tonight?', 'You\'re sweeter than you let people see.'],
      pos: ['Oh, that\'s lovely!', 'Aww, I love that.', 'That\'s so true.', 'Haha, you\'re sweet.', 'That made me smile.', 'You always say the nicest things.', 'Ha! Okay, that\'s good.'],
      neu: ['Oh, interesting!', 'Hm, I hadn\'t thought of that.', 'Really?'],
      neg: ['Hm, I don\'t think that\'s fair.', 'That wasn\'t very kind.', 'Let\'s not, okay?'],
    },
  };

  const R = {
    pos: {
      warm: ['Haha, I love that.', 'Aww, {other}!', 'Same here!', 'You always know what to say.', 'Ha! Good one.', 'Totally!', 'That made my day.', 'Okay, that\'s cute.', 'Hehe, yeah.'],
      excited: ['No way! That\'s amazing!', 'Hahaha!', 'YES. Exactly!', 'Oh my gosh, yes!', 'Stop, that\'s so good!'],
      neutral: ['Heh. Nice.', 'Yeah, fair.', 'Good point.', 'Ha, true.', 'Not bad.'],
      grumpy: ['...okay, that was funny.', 'Hmph. Fine, you\'re right.', 'Not bad.', 'I\'ll give you that one.'],
    },
    neu: {
      warm: ['Hm, maybe!', 'Oh, really?', 'I hadn\'t thought of that.', 'Huh, interesting.'],
      excited: ['Huh! Okay!', 'Interesting!', 'Ooh, really?'],
      neutral: ['Huh.', 'Mm-hm.', 'If you say so.', 'Sure.', 'Yeah?'],
      grumpy: ['Uh huh.', 'Okay.', 'And?', 'Riveting.'],
    },
    neg: {
      warm: ['Oh... that\'s not very nice.', 'Hey, come on.', 'I don\'t think that\'s fair.'],
      excited: ['Whoa, what?!', 'Rude!', 'Hey!'],
      neutral: ['...okay, rude.', 'Why would you say that?', 'Not cool.'],
      grumpy: ['Ugh.', 'Do you ever stop talking?', 'Not interested.', 'Wow. Riveting.'],
    },
    special: {
      birthday: ['Aww, thank you!', 'You remembered!', 'Best birthday ever. So far.'],
      sickVisit: ['You\'re the best, {other}.', 'Thank you... I feel better already.', 'You didn\'t have to... thank you.'],
      skyhand: ['WHAT?! Are you okay?', 'The Sky Hand?! Again?', 'I knew it! I knew something was up there!', 'Did it at least say hi?'],
      skyhandSea: ['Oh no! Do you need a towel?', 'Pfft... sorry. Sorry! Are you okay?', 'At least you got a free swim?'],
      argue: ['Excuse me?!', 'Oh, here we go.', 'Fine! Whatever!', 'You\'re one to talk!', 'Seriously? Right now?'],
      apologyYes: ['It\'s okay. Water under the dock.', 'Thanks. I\'m sorry too.', 'We\'re good. Promise.'],
      apologyNo: ['Hmph. We\'ll see.', 'Words are cheap.', 'Not yet. Give me time.'],
      confessYes: ['...I feel the same way.', 'I was hoping you\'d say that.', 'Took you long enough. Yes.'],
      confessNo: ['Oh... I\'m sorry. I don\'t feel the same.', 'I think we\'re better as friends.', 'I care about you, just... not like that.'],
      flirtYes: ['Heh... maybe I would.', 'Stop it, you\'re making me blush.', 'You\'re trouble, you know that?', '...Smooth. Really smooth.'],
      flirtNo: ['Haha... okay?', 'Uh. Thanks?', 'Let\'s just stay friends, yeah?'],
      joke: ['Hahaha! Terrible. I love it.', 'Boo! Get off the stage!', '...I hate that I laughed.', 'Groan. Okay, that was good.', 'I\'m stealing that one.', 'That was so bad it looped back to good.', 'Who taught you that?!', 'Pfft. Okay, okay.', 'Never say that again. Ha!', 'I need to sit down. Haha.'],
      roastPos: ['HAHA shut up.', 'Wow. Okay. Fair.', 'I\'m telling everyone you said that.', 'You\'re so annoying. Haha.', 'Oh you\'re DEAD.'],
      roastNeg: ['...wow. Okay.', 'Was that supposed to be funny?', 'Rude. Genuinely rude.'],
      brag: ['Cool story.', 'Wow. Riveting.', 'Okay, sure.', 'Nobody asked, but okay.'],
      bragPos: ['Omg, same.', 'Wait, that\'s actually so cool.'],
      cat: ['Aww, {cat}!', 'I love that cat.', 'That cat has a better life than me.'],
      teased: ['W-what? No! Shut up!', 'I don\'t know what you\'re talking about.', '...Is it that obvious?', 'Okay, maybe a little. SHH.'],
      teasedNo: ['Ew, no. Not happening.', 'Pfft. As if.', 'You\'re way off.'],
      couple: ['Missed you too.', 'You\'re ridiculous. I like it.', 'Always.', 'Stop, people are looking. ...Don\'t stop.'],
      memoryBad: ['Yeah. I\'m sorry about that.', 'We\'re okay. Promise.', 'Honestly, me too.'],
    },
  };

  D.bottleMessages = [
    'Whoever finds this: you are doing great.',
    'Help! I am stuck in a bottle factory.',
    'The treasure is under the third palm. Or the fourth.',
    'Please return my left sock.',
    'If found, please reply. I am lonely and so is my cat.',
    'Day 40: the seagulls know my name now.',
    'Drink more water. Love, a stranger.',
    'I bet you can\'t do a cartwheel. Prove me wrong.',
  ];

  D.activityWord = {
    fishing: 'fishing', gardening: 'tending the garden', foraging: 'foraging in the woods', chopping: 'chopping wood',
    reading: 'reading', beach: 'lazing on the beach', swimming: 'swimming', wandering: 'wandering around',
    chatting: 'chatting', stargazing: 'stargazing', cooking: 'cooking', napping: 'napping', cats: 'hanging out with the cat',
  };

  D.tone = (p, other) => {
    const t = p.traits;
    const rel = other ? p.relTo(other.name).friendship : 0;
    const mood = p.mood();
    if (t.grumpy > 0.55 && (mood < 65 || rel < 20) || mood < 25 || rel < -30) return 'grumpy';
    if (t.energetic > 0.75 && t.sociable >= 0.4 && mood > 55) return 'excited';
    if (t.kind > 0.55 || rel > 40) return 'warm';
    return 'neutral';
  };

  D.fill = (text, ctx) => text.replace(/\{(\w+)\}/g, (_, k) => (ctx[k] !== undefined ? ctx[k] : k));

  // --- No repeats: remember what each person (and the island) said lately
  const recentAll = [];
  const recentBy = new Map();
  const fresh = (pool, who) => {
    if (!pool || !pool.length) return null;
    pool = IS.more(pool);
    const mine = who ? (recentBy.get(who) || []) : [];
    // Nobody talks about themselves in the third person ("Lynn's soup" from Lynn)
    if (who) { const own = pool.filter(l => !l.includes(who)); if (own.length) pool = own; }
    let cands = pool.filter(l => !mine.includes(l) && !recentAll.includes(l));
    if (!cands.length) cands = pool.filter(l => !mine.includes(l));
    if (!cands.length) cands = pool;
    const line = cands[Math.floor(Math.random() * cands.length)];
    if (who) { mine.push(line); if (mine.length > 40) mine.shift(); recentBy.set(who, mine); }
    recentAll.push(line); if (recentAll.length > 50) recentAll.shift();
    return line;
  };

  D.fresh = (pool, who) => fresh(pool, who);

  // The speaker for the next line() / response() call; set by social.js
  D.speaker = null;
  D.as = p => { D.speaker = p; return D; };

  D.line = (topic, tone, sub) => {
    const who = D.speaker ? D.speaker.name : null;
    const pool = L[topic];
    const voice = who && VOICE[who] && VOICE[who][topic];
    let base;
    if (!pool) base = null;
    else if (Array.isArray(pool)) base = pool.length ? pool : L.joke;
    else if (sub && pool[sub]) base = pool[sub];
    else base = pool[tone] || pool.neutral || Object.values(pool)[0];
    // Personal lines come up often but don't crowd out the shared pool
    if (voice && (!base || Math.random() < 0.45)) return fresh(voice, who) || '...';
    return fresh(base, who) || '...';
  };

  D.response = (valence, tone, special) => {
    const who = D.speaker ? D.speaker.name : null;
    if (special && R.special[special]) return fresh(R.special[special], who);
    const voice = who && VOICE[who] && VOICE[who][valence];
    if (voice && Math.random() < 0.5) return fresh(voice, who);
    const pool = R[valence];
    return fresh(pool[tone] || pool.neutral, who);
  };

  return D;
})();
