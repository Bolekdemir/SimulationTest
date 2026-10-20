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
    collection: sim.collection || {}, paintings: sim.paintings || [], sandcastles: sim.sandcastles || [],
    treasure: sim.treasure || null, weddings: sim.weddings || [],
    town: sim.town || null, leftIsland: sim.leftIsland || [], visitorsSeen: sim.visitorsSeen || [],
    builds: IS.Build.serialize(sim), extraBeds: sim.extraBeds || [], kitten: sim.kitten ? { name: sim.kitten.name, owner: sim.kitten.owner || null, stray: !!sim.kitten.stray, x: sim.kitten.x, y: sim.kitten.y } : null,
    graves: (sim.graves || []).map(g => ({ name: g.name, cause: g.cause, day: g.day, season: g.season, t: g.t, x: g.x, y: g.y, gx: g.gx, gy: g.gy, stage: g.stage, flowers: g.flowers, flip: g.flip, foundAt: g.foundAt || 0, stash: g.p.stash || {} })),
    people: (sim.everyone || sim.people).map(p => ({
      name: p.name, x: p.x, y: p.y, dead: !!p.dead, mourning: p.mourning || {}, revivedAt: p.revivedAt || 0, welcomedBack: p.welcomedBack || {}, revived: p.revived || {}, toldBack: p.toldBack || {},
      needs: p.needs, rel: p.rel, moodMods: p.moodMods,
      memories: p.memories.map(m => ({ ...m, toldTo: [...m.toldTo] })),
      skyOpinion: p.skyOpinion, grabCount: p.grabCount, sick: p.sick, wetUntil: p.wetUntil,
      skills: p.skills || {}, plans: p.plans, ledger: p.ledger, emotion: p.emotion, knows: [...p.knows],
      history: p.history, confessedTo: p.confessedTo || {}, heardSky: !!p.heardSky, avoid: p.avoid,
      visitedBy: [...p.visitedBy], congratulated: [...(p.congratulated || [])], lastChatAt: p.lastChatAt || 0,
      cfg: p.cfg.generated ? p.cfg : undefined, homeId: p.homeId, town: p.town || null, bed: p.bedSpot ? { x: p.bedSpot.x, y: p.bedSpot.y } : null,
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
    // Buildings first (their beds are where newcomers sleep), then extra beds in old houses
    IS.Build.restore(sim, d.builds);
    sim.extraBeds = [];
    for (const eb of d.extraBeds || []) { const b = sim.world.buildings.find(x => x.id === eb.b); if (b && !b.furniture.some(f => f.type === 'bed' && f.c === eb.c && f.r === eb.r)) IS.Town.addBed(sim, b); }
    // Newcomers aren't in config.js: rebuild them from their saved recipe first
    for (const s of d.people || []) if (s.cfg && s.cfg.generated && !sim.everyone.some(x => x.name === s.name)) IS.Newcomers.add(sim, s.cfg);
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
      p.skills = s.skills || {}; p.plans = s.plans || []; p.ledger = s.ledger || {}; p.emotion = s.emotion || null;
      p.knows = new Set(s.knows || []);
      p.history = s.history || []; p.confessedTo = s.confessedTo || {}; p.heardSky = !!s.heardSky;
      p.avoid = s.avoid || {};
      p.visitedBy = new Set(s.visitedBy || []);
      p.congratulated = new Set(s.congratulated || []);
      p.lastChatAt = s.lastChatAt || 0;
      if (s.homeId) {
        p.homeId = s.homeId;
        const beds = sim.world.spots.bed || [];
        const mine = (s.bed && beds.find(b => b.x === s.bed.x && b.y === s.bed.y)) || beds.find(b => b.owner === p.name) || beds.find(b => b.building === p.homeId && !b.owner);
        for (const b of beds) if (b.owner === p.name && b !== mine) b.owner = null;
        p.bedSpot = mine || null;
        if (mine && p.cfg.generated) mine.owner = p.name;
      }
      p.town = s.town || null;
      p.idleUntil = 0;
      p.thought = 'Where was I?';
      p.mourning = s.mourning || {}; p.revivedAt = s.revivedAt || 0; p.welcomedBack = s.welcomedBack || {}; p.revived = s.revived || {}; p.toldBack = s.toldBack || {};
    }
    sim.collection = d.collection || {}; sim.paintings = d.paintings || []; sim.sandcastles = d.sandcastles || []; sim.treasure = d.treasure || null; sim.weddings = d.weddings || [];
    sim.town = d.town || null; sim.leftIsland = d.leftIsland || []; sim.visitorsSeen = d.visitorsSeen || [];
    if (sim.town) sim.town.pending = null;
    if (d.kitten) {
      const owner = d.kitten.owner && sim.everyone.find(x => x.name === d.kitten.owner);
      sim.kitten = new IS.Cat(sim, d.kitten.name, owner ? owner.homeId : 'hall', 'grey');
      sim.kitten.stray = d.kitten.stray; sim.kitten.owner = d.kitten.owner; sim.kitten.x = d.kitten.x; sim.kitten.y = d.kitten.y;
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
  const s = { speed: 1, fps: 60, sound: 2, music: 2, fx: 0, names: true, journal: window.innerWidth >= 760, nightSkip: true, autosave: true, powers: false };
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
