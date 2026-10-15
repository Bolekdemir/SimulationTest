// Line pools for conversations. A speaker's tone comes from their traits,
// mood and how they feel about the listener.
IS.Dialogue = (() => {
  const D = {};

  const L = {
    greet: {
      warm: ['{Greet}, {other}!', 'Oh, {other}! Just who I wanted to see.', 'Hey you! How are you holding up?', '{Greet}! You look well, {other}.'],
      neutral: ['{Greet}, {other}.', 'Hey, {other}.', 'Oh, hi.'],
      grumpy: ['...{other}.', 'Oh. It\'s you.', 'Hm. {Greet}, I suppose.'],
      excited: ['{OTHER}!! Hi hi hi!', 'Heyyy {other}! Guess what?', 'There you are!'],
    },
    weather: {
      sunny: ['What a gorgeous day.', 'Sun\'s out! Perfect for {fav}.', 'Not a cloud in the sky.'],
      cloudy: ['Bit grey today, huh?', 'Clouds are rolling in.', 'Cozy kind of weather.'],
      rain: ['This rain won\'t quit.', 'I like the sound of rain on the roof.', 'Everything smells like wet grass.'],
      storm: ['Did you hear that thunder?!', 'This storm is wild.', 'Hope the dock survives this one.'],
      fog: ['Can barely see the lighthouse in this fog.', 'Spooky fog this morning.'],
      grumpy: ['Weather\'s terrible. As usual.', 'Can\'t this island pick a weather and stick to it?'],
    },
    activity: {
      warm: ['I\'ve been {doing} all {partofday}. Loving it.', '{Fav} is the best thing on this island, change my mind.', 'Want to go {fav} with me later?'],
      neutral: ['Been {doing} mostly.', 'Just {doing}. You know how it is.'],
      grumpy: ['I\'ve been {doing}. Thrilling stuff.', 'Busy. Very busy.'],
    },
    sharedLove: ['You love {fav} too, right? We should go together!', 'Nothing beats {fav}. You get it.'],
    gossipGood: ['{third} made me laugh so hard yesterday.', 'Have you noticed how kind {third} is lately?', '{third} is really good at {thirdFav}, you know.'],
    gossipBad: ['{third} has been getting on my nerves.', 'Between us... {third} snores. Loudly.', 'Is it just me or is {third} always {thirdDoing}?'],
    compliment: ['You\'ve been working so hard, {other}.', 'You always know how to cheer me up.', 'Your {otherFav} skills are getting really good.', 'That shirt really suits you.'],
    joke: [
      'Why did the fish blush? It saw the ocean\'s bottom.',
      'I tried to catch fog this morning. Mist.',
      'What do you call a sleeping bull? A bulldozer.',
      'I told the dock a joke. It was a bit of a stretch.',
      'Why don\'t crabs share? Because they\'re shellfish.',
      'The tide and I have a lot in common. We both keep coming back.',
    ],
    complaint: ['My back is killing me.', 'The seagulls stole my sandwich. Again.', 'Nobody ever restocks the pantry but me.', 'I\'m so {needword}.', 'Everything is going wrong today.'],
    hungry: ['I\'m starving. Got anything to eat?', 'The pantry\'s looking {pantryWord}.'],
    deep: ['Do you ever wonder what\'s past the horizon?', 'I\'m really glad you\'re here, {other}.', 'Sometimes I miss the mainland. Not often, though.', 'This island feels like home now.'],
    flirt: ['The sunset\'s nicer when you\'re around.', 'Want to watch the stars with me sometime?', 'I saved you the best seat at dinner, you know.', 'You\'ve got something in your hair. Oh wait, it\'s just charm.'],
    argue: ['You left the dock a mess again, {other}!', 'Why do you ALWAYS do that?!', 'I\'m not in the mood for you right now.', 'You know what, {other}? You\'re exhausting.'],
    apology: ['Hey... sorry about earlier.', 'I was a jerk before. I\'m sorry, {other}.'],
    skyhand: ['{other}, a giant hand picked me up today! A HAND!', 'The Sky Hand took me again. I need to lie down.', 'I was flying, {other}. Actually flying.'],
    skyhandSea: ['Something tossed me into the SEA, {other}. The sea!', 'I\'m still wet from my little trip into the ocean.'],
    skyhandWitness: ['I saw {third} floating over the island! FLOATING!', 'Did you see {third} fly earlier? Am I losing it?'],
    eventSoon: ['You coming to the {event} {when}?', 'Can\'t wait for the {event} {when}!'],
    eventPast: ['Last {event} was lovely.', 'That {event} was so much fun.'],
    birthday: ['Happy birthday, {other}!!', 'It\'s your birthday! Happy birthday!'],
    sickVisit: ['I brought you some soup. Feel better, okay?', 'How are you feeling? I made you some tea.'],
    letter: ['I got a letter from the mainland today!', 'My cousin wrote! The mainland sounds so noisy.'],
    bottle: ['I found a message in a bottle! It said: "{bottleMsg}"', 'There was a note in a bottle on the beach. "{bottleMsg}"'],
    dolphins: ['Did you see the dolphins?!', 'Dolphins by the shore today! So many!'],
    star: ['I saw a shooting star last night. Made a wish!', 'Shooting star last night. Not telling you what I wished for.'],
    bigfish: ['I caught a fish THIS big today!', 'You should\'ve seen the fish I caught. Huge.'],
    confess: ['{other}... I think I\'m falling for you.', 'Can I tell you something? I really, really like you.'],
  };

  const R = {
    pos: {
      warm: ['Haha, I love that.', 'Aww, {other}!', 'Same here!', 'You always know what to say.', 'Ha! Good one.', 'Totally!'],
      excited: ['No way! That\'s amazing!', 'Hahaha!', 'YES. Exactly!'],
      neutral: ['Heh. Nice.', 'Yeah, fair.', 'Good point.'],
      grumpy: ['...okay, that was funny.', 'Hmph. Fine, you\'re right.', 'Not bad.'],
    },
    neu: {
      warm: ['Hm, maybe!', 'Oh, really?', 'I hadn\'t thought of that.'],
      excited: ['Huh! Okay!', 'Interesting!'],
      neutral: ['Huh.', 'Mm-hm.', 'If you say so.', 'Sure.'],
      grumpy: ['Uh huh.', 'Okay.', 'And?'],
    },
    neg: {
      warm: ['Oh... that\'s not very nice.', 'Hey, come on.', 'I don\'t think that\'s fair.'],
      excited: ['Whoa, what?!', 'Rude!'],
      neutral: ['...okay, rude.', 'Why would you say that?', 'Not cool.'],
      grumpy: ['Ugh.', 'Do you ever stop talking?', 'Not interested.', 'Wow. Riveting.'],
    },
    special: {
      birthday: ['Aww, thank you!', 'You remembered!'],
      sickVisit: ['You\'re the best, {other}.', 'Thank you... I feel better already.'],
      skyhand: ['WHAT?! Are you okay?', 'The Sky Hand?! Again?', 'I knew it! I knew something was up there!'],
      skyhandSea: ['Oh no! Do you need a towel?', 'Pfft... sorry. Sorry! Are you okay?'],
      argue: ['Excuse me?!', 'Oh, here we go.', 'Fine! Whatever!', 'You\'re one to talk!'],
      apologyYes: ['It\'s okay. Water under the dock.', 'Thanks. I\'m sorry too.'],
      apologyNo: ['Hmph. We\'ll see.', 'Words are cheap.'],
      confessYes: ['...I feel the same way.', 'I was hoping you\'d say that.'],
      confessNo: ['Oh... I\'m sorry. I don\'t feel the same.', 'I think we\'re better as friends.'],
      flirtYes: ['Heh... maybe I would.', 'Stop it, you\'re making me blush.'],
      joke: ['Hahaha! Terrible. I love it.', 'Boo! Get off the stage!', '...I hate that I laughed.'],
    },
  };

  D.bottleMessages = [
    'Whoever finds this: you are doing great.',
    'Help! I am stuck in a bottle factory.',
    'The treasure is under the third palm. Or the fourth.',
    'Please return my left sock.',
    'If found, please reply. I am lonely and so is my cat.',
    'Day 40: the seagulls know my name now.',
  ];

  D.activityWord = {
    fishing: 'fishing', gardening: 'tending the garden', foraging: 'foraging in the woods', chopping: 'chopping wood',
    reading: 'reading', beach: 'lazing on the beach', swimming: 'swimming', wandering: 'wandering around',
    chatting: 'chatting', stargazing: 'stargazing', cooking: 'cooking', napping: 'napping',
  };

  D.tone = (p, other) => {
    const t = p.traits;
    const rel = other ? p.relTo(other.name).friendship : 0;
    const mood = p.mood();
    if (t.grumpy > 0.55 && (mood < 65 || rel < 20) || mood < 25 || rel < -30) return 'grumpy';
    if (t.energetic > 0.75 && mood > 55) return 'excited';
    if (t.kind > 0.55 || rel > 40) return 'warm';
    return 'neutral';
  };

  D.fill = (text, ctx) => text.replace(/\{(\w+)\}/g, (_, k) => (ctx[k] !== undefined ? ctx[k] : k));

  D.line = (topic, tone, sub) => {
    const pool = L[topic];
    if (!pool) return '...';
    if (Array.isArray(pool)) return IS.pick(pool);
    if (sub && pool[sub]) return IS.pick(pool[sub]);
    return IS.pick(pool[tone] || pool.neutral || Object.values(pool)[0]);
  };

  D.response = (valence, tone, special) => {
    if (special && R.special[special]) return IS.pick(R.special[special]);
    const pool = R[valence];
    return IS.pick(pool[tone] || pool.neutral);
  };

  return D;
})();
