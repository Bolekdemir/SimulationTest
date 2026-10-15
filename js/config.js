// =====================================================================
//  ISLANDERS: design your people here.
//  Designed by Mav.
// =====================================================================
//
//  look.hairStyle : short | long | longwavy | wavy | curly | ponytail | bun | spiky | bob | bald
//  look.accessory : none | glasses | shades | hat | bandana | beard | flower | scarf
//  look.tall      : true makes them 2px taller
//  look.eyes      : iris colour.   look.roots: dark roots for dyed hair
//  traits         : 0.0 to 1.0
//     sociable    : how much they seek out and enjoy company (introvert ~0.3, extrovert ~0.9)
//     energetic   : activity level, stays up later, walks with purpose
//     kind        : gentle words, helps others, forgives easily
//     grumpy      : snappy, impatient, starts arguments
//     curious     : explores, investigates strange things, loves news
//     hardworking : prefers chores (farm, wood, fishing) over lazing about
//     brave       : enjoys swimming, storms, and being grabbed by the Sky Hand
//  humor          : roast | dry | goofy | cocky | brag | wholesome
//  quirks         : greedy (eats extra portions), impulsive (picks more fights)
//  loves / hates  : fishing, gardening, foraging, chopping, reading, beach, swimming,
//                   wandering, chatting, stargazing, cooking, napping, cats
//  home           : which house they live in (0-3). Two people can share one.
//  canFallFor     : names this person can develop romantic feelings for.
//  birthday       : { season: Spring|Summer|Fall|Winter, day: 1-28 }
//  bonds          : starting relationships. friendship -100 to 100, romance 0 to 100.
// =====================================================================

IS.ISLANDERS = [
  {
    name: 'Iroh',
    pronoun: 'he',
    bio: 'Tall, sharp and disciplined, though you would never guess it. Goofs off constantly and somehow gets away with it. Roasts everyone he likes.',
    look: { skin: '#f1c9a5', hair: '#c79a6a', hairStyle: 'wavy', eyes: '#2a1a14', shirt: '#e2743a', pants: '#36425e', shoes: '#3a2a22', accessory: 'none', accent: '#e2743a', tall: true },
    traits: { sociable: 0.4, energetic: 0.85, kind: 0.85, grumpy: 0.12, curious: 0.7, hardworking: 0.85, brave: 0.8 },
    humor: 'roast',
    loves: ['swimming', 'wandering', 'fishing'],
    hates: ['napping'],
    home: 0,
    canFallFor: [],
    birthday: { season: 'Spring', day: 10 },
    catchphrases: ['Relax, I\'m a professional.', 'I have a plan. It\'s a bad plan, but it\'s a plan.', 'Don\'t worry, I only roast the people I like.', 'Okay. Serious face. ...Nope, can\'t.'],
    bonds: { Forest: { friendship: 75, label: 'bros' }, Egg: { friendship: 75, label: 'bros' } },
  },
  {
    name: 'Forest',
    pronoun: 'he',
    bio: 'Driven, disciplined and a little impatient. The most athletic person on the island. Serious until his bros drag the goofiness out of him.',
    look: { skin: '#eec39d', hair: '#cfa574', hairStyle: 'curly', eyes: '#c8902a', shirt: '#3f8a52', pants: '#4e3e30', shoes: '#2e2420', accessory: 'none', accent: '#f2c14e' },
    traits: { sociable: 0.3, energetic: 0.85, kind: 0.7, grumpy: 0.38, curious: 0.5, hardworking: 0.95, brave: 0.85 },
    humor: 'dry',
    loves: ['chopping', 'swimming', 'gardening'],
    hates: ['fishing', 'napping'],
    home: 0,
    canFallFor: ['Lynn', 'Beach'],
    birthday: { season: 'Spring', day: 17 },
    catchphrases: ['Less talking, more doing.', 'We\'re wasting daylight.', 'I\'ll just do it myself.', 'Respect the grind.'],
    bonds: { Iroh: { friendship: 75, label: 'bros' }, Egg: { friendship: 75, label: 'bros' }, Lynn: { friendship: 5, romance: 25 }, Beach: { friendship: 0, romance: 15 } },
  },
  {
    name: 'Egg',
    pronoun: 'he',
    bio: 'Always happy, endlessly unserious, allergic to effort. Would trade everything for a nap with a cat on his chest.',
    look: { skin: '#f3cfae', hair: '#b4875a', hairStyle: 'wavy', eyes: '#4a2e1e', shirt: '#f4cf5a', pants: '#6a7fae', shoes: '#f4efe6', accessory: 'none', accent: '#f4cf5a' },
    traits: { sociable: 0.45, energetic: 0.25, kind: 0.95, grumpy: 0.02, curious: 0.45, hardworking: 0.15, brave: 0.45 },
    humor: 'goofy',
    loves: ['cats', 'napping', 'beach'],
    hates: ['chopping'],
    home: 1,
    canFallFor: [],
    birthday: { season: 'Spring', day: 3 },
    catchphrases: ['Life\'s good, man.', 'Nap first, problems later.', 'Everything\'s gonna be fine. Probably.', 'Has anyone seen the cat? Asking for me.'],
    bonds: { Iroh: { friendship: 75, label: 'bros' }, Forest: { friendship: 75, label: 'bros' } },
  },
  {
    name: 'Jude',
    pronoun: 'he',
    bio: 'Charismatic bad boy with a lot of rizz and not a lot of thoughts. Lazy and a little greedy, but loyal when it counts.',
    look: { skin: '#e3b088', hair: '#6b4428', hairStyle: 'wavy', eyes: '#4a2e1e', shirt: '#2b2a33', pants: '#3a5276', shoes: '#1d1424', accessory: 'none', accent: '#f2c14e' },
    traits: { sociable: 0.95, energetic: 0.55, kind: 0.3, grumpy: 0.35, curious: 0.35, hardworking: 0.15, brave: 0.8 },
    humor: 'cocky',
    quirks: ['greedy'],
    loves: ['chatting', 'beach', 'swimming'],
    hates: ['gardening', 'reading'],
    home: 2,
    canFallFor: [],
    birthday: { season: 'Spring', day: 13 },
    catchphrases: ['Relax, I got this.', 'You\'re welcome, by the way.', 'What\'s in it for me?', 'Heh. Smooth.'],
    bonds: {},
  },
  {
    name: 'Beach',
    pronoun: 'she',
    bio: 'Rich-girl energy on an island with no shops. Loud, lazy, impulsive and not especially nice about it.',
    look: { skin: '#efc49e', hair: '#f6dd86', roots: '#6b4a2e', hairStyle: 'long', eyes: '#4a2e1e', shirt: '#f0629c', pants: '#f2e8dc', shoes: '#f0629c', accessory: 'shades', accent: '#f0629c' },
    traits: { sociable: 1.0, energetic: 0.6, kind: 0.12, grumpy: 0.45, curious: 0.2, hardworking: 0.05, brave: 0.5 },
    humor: 'brag',
    quirks: ['impulsive'],
    loves: ['beach', 'chatting', 'swimming'],
    hates: ['gardening', 'chopping', 'fishing'],
    home: 3,
    canFallFor: [],
    birthday: { season: 'Spring', day: 20 },
    catchphrases: ['Ugh, this island has no WiFi.', 'Do you know who my dad is?', 'I\'m literally so bored.', 'That\'s so not my problem.'],
    bonds: { Lynn: { friendship: 5, label: 'roommates' } },
  },
  {
    name: 'Lynn',
    pronoun: 'she',
    bio: 'Kind, clever and quietly hardworking. The one who makes sure everyone has eaten. Somewhere between introvert and extrovert.',
    look: { skin: '#f6d2b8', hair: '#e8875a', hairStyle: 'longwavy', eyes: '#2a1a14', shirt: '#79b8a4', pants: '#485a7e', shoes: '#6b4a2e', accessory: 'none', accent: '#f4cf5a', tall: true },
    traits: { sociable: 0.55, energetic: 0.6, kind: 0.95, grumpy: 0.05, curious: 0.7, hardworking: 0.85, brave: 0.55 },
    humor: 'wholesome',
    loves: ['gardening', 'reading', 'stargazing'],
    hates: [],
    home: 3,
    canFallFor: [],
    birthday: { season: 'Spring', day: 6 },
    catchphrases: ['Let\'s figure it out together.', 'Has everyone eaten today?', 'The garden\'s looking happy this morning!', 'Be kind, it\'s free.'],
    bonds: { Beach: { friendship: 5, label: 'roommates' } },
  },
];

// =====================================================================
//  Simulation tuning
// =====================================================================
IS.CONFIG = {
  islandName: 'Tidewhistle Isle',
  startDay: 1,              // day 1 is Spring 1, a Friday
  startMinute: 6 * 60 + 30, // 06:30
  speeds: [0, 1, 2, 5, 15], // game minutes per real second
  nightSpeed: 30,           // auto fast-forward while everyone sleeps
  startFood: 24,
  catName: 'Biscuit',
  startWood: 6,
};
