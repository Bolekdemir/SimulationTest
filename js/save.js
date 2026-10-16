// Saving the island to this browser. The island layout is generated from a
// fixed seed, so a save only needs the living state: time, weather,
// stores, crops, and everything about the people.
IS.Save = (() => {
  const S = {};
  const KEY = 'tidewhistle-save-v1';

  S.serialize = sim => ({
    v: 1,
    savedAt: Date.now(),
    abs: sim.clock.abs,
    weather: sim.weather,
    food: sim.world.food,
    wood: sim.world.wood,
    crops: sim.world.crops.map(c => Math.round(c.growth * 1000) / 1000),
    news: sim.news || [],
    newsId: sim.newsId || 0,
    log: sim.logEntries.slice(-80),
    lastDolphinDay: sim.events.lastDolphinDay,
    deaths: sim.deaths || 0, lastDeathAt: sim.lastDeathAt,
    graves: (sim.graves || []).map(g => ({ name: g.name, cause: g.cause, day: g.day, season: g.season, t: g.t, x: g.x, y: g.y, gx: g.gx, gy: g.gy, stage: g.stage, flowers: g.flowers, flip: g.flip, foundAt: g.foundAt || 0, stash: g.p.stash || {} })),
    people: (sim.everyone || sim.people).map(p => ({
      name: p.name, x: p.x, y: p.y, dead: !!p.dead, mourning: p.mourning || {}, revivedAt: p.revivedAt || 0, welcomedBack: p.welcomedBack || {}, revived: p.revived || {}, toldBack: p.toldBack || {},
      needs: p.needs, rel: p.rel, moodMods: p.moodMods,
      memories: p.memories.map(m => ({ ...m, toldTo: [...m.toldTo] })),
      skyOpinion: p.skyOpinion, grabCount: p.grabCount, sick: p.sick, wetUntil: p.wetUntil,
      plans: p.plans, ledger: p.ledger, emotion: p.emotion, knows: [...p.knows],
      history: p.history, confessedTo: p.confessedTo || {}, heardSky: !!p.heardSky, avoid: p.avoid,
      visitedBy: [...p.visitedBy], congratulated: [...(p.congratulated || [])], lastChatAt: p.lastChatAt || 0,
    })),
  });

  S.apply = (sim, d) => {
    sim.clock.abs = d.abs;
    sim.updateClock();
    sim.weather = d.weather || 'sunny';
    sim.world.food = d.food;
    sim.world.wood = d.wood;
    (d.crops || []).forEach((g, i) => { if (sim.world.crops[i]) sim.world.crops[i].growth = g; });
    sim.news = d.news || [];
    sim.newsId = d.newsId || 0;
    sim.logEntries = d.log || [];
    sim.events.lastDolphinDay = d.lastDolphinDay ?? -9;
    for (const s of d.people || []) {
      const p = sim.byName(s.name);
      if (!p) continue;
      p.cancelAction();
      p.x = s.x; p.y = s.y; p.z = 0;
      p.mode = 'normal'; p.pose = 'stand';
      Object.assign(p.needs, s.needs);
      p.rel = s.rel || {};
      p.moodMods = s.moodMods || [];
      p.memories = (s.memories || []).map(m => ({ ...m, toldTo: new Set(m.toldTo || []) }));
      p.skyOpinion = s.skyOpinion || 0; p.grabCount = s.grabCount || 0;
      p.sick = !!s.sick; p.wetUntil = s.wetUntil || 0;
      p.plans = s.plans || []; p.ledger = s.ledger || {}; p.emotion = s.emotion || null;
      p.knows = new Set(s.knows || []);
      p.history = s.history || []; p.confessedTo = s.confessedTo || {}; p.heardSky = !!s.heardSky;
      p.avoid = s.avoid || {};
      p.visitedBy = new Set(s.visitedBy || []);
      p.congratulated = new Set(s.congratulated || []);
      p.lastChatAt = s.lastChatAt || 0;
      p.idleUntil = 0;
      p.thought = 'Where was I?';
      p.mourning = s.mourning || {}; p.revivedAt = s.revivedAt || 0; p.welcomedBack = s.welcomedBack || {}; p.revived = s.revived || {}; p.toldBack = s.toldBack || {};
    }
    // The dead stay dead
    sim.deaths = d.deaths || 0;
    sim.lastDeathAt = d.lastDeathAt ?? -1e9;
    for (const sg of d.graves || []) {
      const p = sim.everyone.find(x => x.name === sg.name);
      if (!p) continue;
      p.dead = true; p.mode = 'dead'; p.stash = sg.stash || {};
      sim.people = sim.people.filter(x => x !== p);
      sim.graves.push({ ...sg, p, building: sg.stage === 'body' ? sim.world.buildingAt(Math.floor(sg.x / IS.TILE), Math.floor((sg.y - 6) / IS.TILE)) : null, born: performance.now() - 60000, stash: undefined });
    }
  };

  S.save = sim => {
    try { localStorage.setItem(KEY, JSON.stringify(S.serialize(sim))); return true; } catch (e) { return false; }
  };
  S.load = () => {
    try { const d = JSON.parse(localStorage.getItem(KEY)); return d && d.v === 1 && d.people ? d : null; } catch (e) { return null; }
  };
  S.clear = () => { try { localStorage.removeItem(KEY); } catch (e) { /* storage blocked */ } };

  // "Day 4, Spring 4, 14:30"
  S.describe = d => {
    const day = Math.floor(d.abs / 1440) + 1;
    const season = IS.SEASONS[Math.floor((day - 1) / 28) % 4];
    const wd = IS.WEEKDAYS[(day - 1 + 4) % 7];
    return `Day ${day} · ${wd}, ${season} ${((day - 1) % 28) + 1} · ${IS.fmtTime(d.abs % 1440)}`;
  };

  return S;
})();

// Player preferences, kept on this device
IS.Settings = (() => {
  const KEY = 'tw-settings';
  const s = { speed: 1, names: true, journal: window.innerWidth >= 760, nightSkip: true, autosave: true, powers: false };
  try { Object.assign(s, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { /* defaults */ }
  return {
    get: k => s[k],
    set: (k, v) => { s[k] = v; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* storage blocked */ } },
  };
})();

// The browser offers installation once it decides the app qualifies
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  IS.installPrompt = e;
  document.dispatchEvent(new Event('tw-installable'));
});
