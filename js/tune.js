// The islanders' tunable brain settings. tools/train.js evolves these by
// running many simulations and scoring how sensible and lively they are;
// the values here are the current best (trained over 18 generations x 10
// brains x 5 islands, validated on 32 unseen islands).
IS.Tune = {
  chatRate: 0.164,        // nearby, both free: chance per minute to start chatting
  chatEventMult: 3,     // ...multiplied at events
  chatTravelMult: 0.1, // ...multiplied while walking somewhere
  noticeRate: 0.021,     // spotting a friend across the island and walking over
  noticeMin: 0.302,       // how much they must want company before they bother
  passByChance: 0.312,    // waving hello when passing on a path
  glanceRate: 0.015,    // looks-driven crushes growing from afar
  secondBase: 0.149,      // chance a chat drifts to a second topic...
  secondSoc: 0.018,      // ...plus this much per point of sociability
  inviteBase: 0.086,     // asking a friend along to an activity
  inviteSoc: 0.282,
  planWeight: 1.099,      // how strongly the day's plans steer choices
  planSocialRate: 0.017,// going to find the person a plan is about
  lonelyAt: 5.806,         // social need below this starts loneliness
  // Topic weight multipliers (1 = as authored), learned by tools/train.js
  topic: {
    activity: 1.943,
    argue: 1.872,
    brag: 0.403,
    cat: 0.792,
    catchphrase: 0.892,
    cocky: 1.376,
    complaint: 0.286,
    compliment: 0.443,
    deep: 2.377,
    eventSoon: 0.834,
    flirt: 2.661,
    food: 0.846,
    gossipBad: 1.943,
    gossipGood: 0.648,
    hungry: 0.896,
    island: 1.136,
    joke: 1.109,
    myNews: 1.115,
    observe: 0.855,
    plans: 1.109,
    question: 0.588,
    roast: 0.25,
    rumor: 1.316,
    sharedLove: 0.644,
    tease: 1.379,
    weather: 0.769,
  },
};
