// =====================================================================
//  ISLANDERS: design your people here.
//  These four are placeholders. Replace them with your own designs.
// =====================================================================
//
//  look.hairStyle : short | long | ponytail | bun | spiky | bob | curly | bald
//  look.accessory : none | glasses | hat | bandana | beard | flower | scarf
//  traits         : 0.0 to 1.0
//     sociable    : how much they seek out and enjoy company
//     energetic   : activity level, stays up later, walks with purpose
//     kind        : gentle words, helps others, forgives easily
//     grumpy      : snappy, complains, starts arguments
//     curious     : explores, investigates strange things, loves news
//     hardworking : prefers chores (farm, wood, fishing) over lazing about
//     brave       : enjoys swimming, storms, and being grabbed by the Sky Hand
//  loves / hates  : activities from this list:
//     fishing, gardening, foraging, chopping, reading, beach, swimming,
//     wandering, chatting, stargazing, cooking, napping
//  home           : which house they live in (0-3). Two people can share one.
//  canFallFor     : names this person can develop romantic feelings for.
//                   Leave empty for no romance.
//  birthday       : { season: Spring|Summer|Fall|Winter, day: 1-28 }
//  catchphrases   : lines they drop into conversations now and then
//  bonds          : starting relationships. friendship -100 to 100,
//                   romance 0 to 100, plus an optional label.
// =====================================================================

IS.ISLANDERS = [
  {
    name: 'Mira',
    age: 27,
    bio: 'Runs the dock. Knows every fish by name and every islander by mood.',
    look: { skin: '#f3c9a0', hair: '#8a3b2a', hairStyle: 'ponytail', shirt: '#e8735a', pants: '#3e4f74', shoes: '#4a3428', accessory: 'none', accent: '#f6d06b' },
    traits: { sociable: 0.85, energetic: 0.65, kind: 0.85, grumpy: 0.1, curious: 0.55, hardworking: 0.6, brave: 0.5 },
    loves: ['fishing', 'chatting', 'stargazing'],
    hates: ['chopping'],
    home: 0,
    canFallFor: [],
    birthday: { season: 'Spring', day: 4 },
    catchphrases: ['Tide waits for no one!', 'Smells like rain. Or fish. Probably fish.', 'Hey, chin up, sailor.'],
    bonds: { Theo: { friendship: 30, label: 'old friends' }, Juno: { friendship: 45, label: 'big-sister energy' } },
  },
  {
    name: 'Theo',
    age: 36,
    bio: 'Carpenter. Built half the island and complains about the other half.',
    look: { skin: '#c68a5c', hair: '#2b2220', hairStyle: 'short', shirt: '#5f8a4f', pants: '#5a4634', shoes: '#2e2420', accessory: 'beard', accent: '#c94f3f' },
    traits: { sociable: 0.35, energetic: 0.55, kind: 0.45, grumpy: 0.7, curious: 0.3, hardworking: 0.9, brave: 0.75 },
    loves: ['chopping', 'gardening', 'cooking'],
    hates: ['swimming', 'chatting'],
    home: 1,
    canFallFor: [],
    birthday: { season: 'Spring', day: 9 },
    catchphrases: ['Measure twice, cut once.', 'Who left the hammer outside AGAIN?', 'Hmph.'],
    bonds: { Mira: { friendship: 30, label: 'old friends' }, Bram: { friendship: -10, label: 'bickering neighbours' } },
  },
  {
    name: 'Juno',
    age: 19,
    bio: 'Restless explorer. Has a map of the island with way too many X marks on it.',
    look: { skin: '#f0d2b4', hair: '#2f3f66', hairStyle: 'bob', shirt: '#f2c14e', pants: '#4b6d63', shoes: '#7a3f3f', accessory: 'bandana', accent: '#e05a7a' },
    traits: { sociable: 0.6, energetic: 0.95, kind: 0.6, grumpy: 0.2, curious: 0.95, hardworking: 0.3, brave: 0.9 },
    loves: ['foraging', 'swimming', 'wandering'],
    hates: ['reading', 'napping'],
    home: 2,
    canFallFor: [],
    birthday: { season: 'Spring', day: 2 },
    catchphrases: ['Race you to the lighthouse!', 'I found a weird rock. Wanna see?', 'Adventure is calling and I am ANSWERING.'],
    bonds: { Mira: { friendship: 45, label: 'little-sister energy' }, Bram: { friendship: 25, label: 'story buddies' } },
  },
  {
    name: 'Bram',
    age: 64,
    bio: 'Retired sailor. Tells the same three stories, each one bigger than the last.',
    look: { skin: '#e2b48c', hair: '#d9d4cc', hairStyle: 'bald', shirt: '#6b5b95', pants: '#3b3b4f', shoes: '#3a2a22', accessory: 'glasses', accent: '#9bc4e2' },
    traits: { sociable: 0.7, energetic: 0.2, kind: 0.75, grumpy: 0.4, curious: 0.5, hardworking: 0.25, brave: 0.35 },
    loves: ['reading', 'napping', 'beach'],
    hates: ['chopping', 'swimming'],
    home: 3,
    canFallFor: [],
    birthday: { season: 'Spring', day: 15 },
    catchphrases: ['Did I ever tell you about the squid of \'82?', 'Back in my day, the sea was saltier.', 'Ahh, my knees.'],
    bonds: { Theo: { friendship: -10, label: 'bickering neighbours' }, Juno: { friendship: 25, label: 'story buddies' } },
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
  startFood: 18,
  startWood: 6,
};
