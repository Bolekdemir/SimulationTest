// The islanders' tunable brain settings. tools/train.js evolves these by
// running many simulations and scoring how sensible and lively they are;
// the values here are the current best.
IS.Tune = {
  chatRate: 0.1,        // nearby, both free: chance per minute to start chatting
  chatEventMult: 3,     // ...multiplied at events
  chatTravelMult: 0.35, // ...multiplied while walking somewhere
  noticeRate: 0.02,     // spotting a friend across the island and walking over
  noticeMin: 0.2,       // how much they must want company before they bother
  passByChance: 0.7,    // waving hello when passing on a path
  glanceRate: 0.015,    // looks-driven crushes growing from afar
  secondBase: 0.2,      // chance a chat drifts to a second topic...
  secondSoc: 0.45,      // ...plus this much per point of sociability
  inviteBase: 0.08,     // asking a friend along to an activity
  inviteSoc: 0.3,
  planWeight: 0.9,      // how strongly the day's plans steer choices
  planSocialRate: 0.035,// going to find the person a plan is about
  lonelyAt: 14,         // social need below this starts loneliness
  // Topic weight multipliers (1 = as authored)
  topic: {},
};
