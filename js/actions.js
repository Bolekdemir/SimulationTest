// Every activity an islander can choose. Each person's brain scores all
// of these against their needs, traits, loves/hates, time, weather and
// events, then picks one with a bit of randomness (utility AI).
IS.Actions = (() => {
  const A = {};
  const def = d => { A[d.id] = d; return d; };

  const dN = (p, k) => (100 - p.needs[k]) / 100;
  const love = (p, key) => (p.loves.includes(key) ? 0.45 : 0) - (p.hates.includes(key) ? 0.6 : 0);
  const between = (min, a, b) => (a <= b ? min >= a && min < b : min >= a || min < b);
  const H = h => h * 60;
  const clear = c => c.weather === 'sunny' || c.weather === 'cloudy' || c.weather === 'fog';
  const ownSpot = (p, kind) => (p.world.spots[kind] || []).find(s => s.building === p.homeId && (!s.takenBy || s.takenBy === p));

  def({
    id: 'sleep', label: 'Sleeping', love: 'napping', indoor: true,
    score: (p, c) => {
      if (p.sick) return 12;
      if (p.isBedtime(c.min)) return 4 + dN(p, 'energy') * 2;
      let s = dN(p, 'energy') > 0.78 ? 2.6 : 0;
      if (between(c.min, H(13), H(16)) && dN(p, 'energy') > 0.45) s += 0.5 + love(p, 'napping');
      return s;
    },
    plan: (p, c) => {
      const spot = p.bedSpot && (!p.bedSpot.takenBy || p.bedSpot.takenBy === p) ? p.bedSpot : p.world.freeSpot('bed', s => s.building === p.homeId);
      if (!spot) return null;
      const night = p.isBedtime(c.min);
      let duration = night ? p.minutesUntilWake(c.min) + IS.rand(-10, 15) : IS.rand(50, 100);
      if (p.sick) duration = Math.max(120, p.minutesUntilWake(c.min));
      return { spot, duration: Math.max(20, duration), night };
    },
    tick: (p, a, dt, c) => {
      p.needs.energy = Math.min(100, p.needs.energy + (a.night ? 0.21 : 0.32) * dt);
      if (!a.night && !p.sick && p.needs.energy >= 99) a.done = true;
      if (Math.random() < dt * 0.08) p.emote('zzz', 1.6);
    },
    finish: p => { if (p.needs.energy > 85 && !p.sick) p.addMood('Well rested', 6, 240); },
    thought: (p, a) => p.sick ? 'Ugh... I feel awful. Staying in bed.' : a.night ? 'Zzz... goodnight, island.' : 'Just resting my eyes for a bit.',
  });

  def({
    id: 'eat', label: 'Eating', love: 'cooking', indoor: true,
    score: (p, c) => {
      if (p.needs.hunger > 85) return 0;
      let s = Math.pow(dN(p, 'hunger'), 1.4) * 4;
      if (dN(p, 'hunger') > 0.25 && (between(c.min, H(7), H(9)) || between(c.min, H(12), H(13.5)) || between(c.min, H(18), H(20)))) s += 0.9;
      return s;
    },
    plan: p => {
      const spot = ownSpot(p, 'eat') || p.world.freeSpot('hallSeat');
      return spot ? { spot, duration: IS.rand(25, 35) } : null;
    },
    start: p => p.emote('food', 2),
    finish: (p, a) => {
      if (p.world.food > 0) {
        p.world.food--;
        if ((p.cfg.quirks || []).includes('greedy') && p.world.food > 0 && Math.random() < 0.5) {
          p.world.food--;
          if (Math.random() < 0.3) p.sim.log(`${p.name} helped himself to seconds. And thirds.`.replace('himself', p.cfg.pronoun === 'she' ? 'herself' : p.cfg.pronoun === 'they' ? 'themselves' : 'himself'), 'warn', [p]);
        }
        p.needs.hunger = Math.min(100, p.needs.hunger + 55);
        if (p.loves.includes('cooking')) { p.needs.fun = Math.min(100, p.needs.fun + 12); p.addMood('Cooked something tasty', 5, 120); }
      } else {
        p.needs.hunger = Math.min(100, p.needs.hunger + 20);
        p.addMood('Meager meal', -8, 240);
        p.sim.log(`${p.name} found the pantry empty and scraped together some crumbs.`, 'warn', [p]);
      }
    },
    thought: p => dN(p, 'hunger') > 0.6 ? 'My stomach is growling. Food. Now.' : 'Time for a bite to eat.',
  });

  def({
    id: 'fish', label: 'Fishing', love: 'fishing', outdoor: true, chatOK: true, pose: 'fish',
    can: (p, c) => between(c.min, H(5), H(20.5)) && c.weather !== 'storm',
    score: (p, c) => 0.35 + p.traits.hardworking * 0.3 + (p.world.food < 10 ? 0.5 : 0) + dN(p, 'fun') * 0.4 + love(p, 'fishing'),
    plan: p => { const spot = p.world.freeSpot('fish'); return spot ? { spot, duration: IS.rand(60, 140) } : null; },
    tick: (p, a, dt) => {
      a.acc = (a.acc || 0) + dt;
      p.needs.fun = Math.min(100, p.needs.fun + (p.loves.includes('fishing') ? 0.2 : 0.06) * dt);
      if (a.acc >= 20) {
        a.acc = 0;
        if (Math.random() < 0.25 + (p.loves.includes('fishing') ? 0.1 : 0) + (p.sim.weather === 'rain' ? 0.08 : 0)) {
          p.world.food++;
          a.catches = (a.catches || 0) + 1;
          p.emote('fish', 2);
          p.sim.fx.splash(p.bobberX(), p.bobberY(), 5);
          if (Math.random() < 0.05) {
            p.world.food += 2;
            p.remember('Caught a HUGE fish', { tag: 'bigfish', mood: 12, news: true });
            p.say(IS.pick(['WHOA! Look at the size of this thing!', 'Biggest fish ever. EVER.', 'Someone get a ruler!']));
            p.sim.log(`${p.name} reeled in an enormous fish!`, 'good', [p]);
          }
        }
      }
    },
    thought: p => p.loves.includes('fishing') ? 'Nothing beats the quiet of the water.' : 'Pantry could use some fish.',
  });

  def({
    id: 'garden', label: 'Gardening', love: 'gardening', outdoor: true, chatOK: true, pose: 'work',
    can: (p, c) => between(c.min, H(6), H(19)) && c.weather !== 'storm',
    score: (p, c) => {
      const ripe = p.world.crops.some(cr => cr.growth >= 1);
      return 0.3 + p.traits.hardworking * 0.55 + (ripe ? 0.35 : 0) + (p.world.food < 10 ? 0.3 : 0) + (c.weekday < 5 && between(c.min, H(9), H(17)) ? 0.2 : 0) + love(p, 'gardening');
    },
    plan: p => {
      const spot = p.world.freeSpot('farm', s => s.crop.growth >= 1) || p.world.freeSpot('farm');
      return spot ? { spot, duration: IS.rand(40, 80) } : null;
    },
    tick: (p, a, dt) => {
      const crop = a.spot.crop;
      crop.growth = Math.min(1, crop.growth + 0.0015 * dt);
      p.needs.fun = Math.min(100, p.needs.fun + (p.loves.includes('gardening') ? 0.18 : 0.03) * dt);
    },
    finish: (p, a) => {
      const crop = a.spot.crop;
      if (crop.growth >= 1) {
        crop.growth = 0.02;
        p.world.food += 1;
        p.emote('sparkle', 2);
        const word = { tomato: 'tomatoes', carrot: 'carrots', cabbage: 'a cabbage' }[crop.kind];
        if (Math.random() < 0.35) p.sim.log(`${p.name} harvested ${word}.`, 'good', [p]);
      }
    },
    thought: p => p.loves.includes('gardening') ? 'Grow, little guys, grow!' : 'Somebody has to keep these alive.',
  });

  def({
    id: 'forage', label: 'Foraging', love: 'foraging', outdoor: true, chatOK: true, pose: 'work',
    can: (p, c) => between(c.min, H(7), H(18)) && c.weather !== 'storm',
    score: (p, c) => 0.3 + p.traits.curious * 0.35 + (p.world.food < 10 ? 0.3 : 0) + love(p, 'foraging'),
    plan: p => { const spot = p.world.freeSpot('forage'); return spot ? { spot, duration: IS.rand(40, 90) } : null; },
    tick: (p, a, dt) => {
      a.acc = (a.acc || 0) + dt;
      p.needs.fun = Math.min(100, p.needs.fun + (p.loves.includes('foraging') ? 0.2 : 0.06) * dt);
      if (a.acc >= 20) {
        a.acc = 0;
        if (Math.random() < 0.22) { p.world.food++; p.emote('food', 1.5); }
        if (Math.random() < 0.04) {
          const find = IS.pick(['a glowing blue mushroom', 'a strange shiny stone', 'an old brass compass', 'a bird\'s nest with a feather in it']);
          p.remember(`Found ${find} in the forest`, { tag: 'find', mood: 10, news: true, detail: find });
          p.say(`Ooh! ${find[0].toUpperCase() + find.slice(1)}!`);
          p.sim.log(`${p.name} found ${find} in the forest.`, 'good', [p]);
        }
      }
    },
    thought: () => 'Berries, mushrooms, maybe treasure...',
  });

  def({
    id: 'chop', label: 'Chopping wood', love: 'chopping', outdoor: true, pose: 'work',
    can: (p, c) => between(c.min, H(8), H(18)) && clear(c),
    score: (p, c) => 0.2 + p.traits.hardworking * 0.5 + (p.world.wood < 6 ? 0.4 : 0) + love(p, 'chopping') - dN(p, 'energy') * 0.6,
    plan: p => { const spot = p.world.freeSpot('chop'); return spot ? { spot, duration: IS.rand(45, 90) } : null; },
    tick: (p, a, dt) => {
      a.acc = (a.acc || 0) + dt;
      p.needs.energy -= 0.03 * dt;
      if (Math.random() < dt * 0.6) p.sim.fx.chips(p.x, p.y);
      if (a.acc >= 20) { a.acc = 0; p.world.wood++; }
      if (p.loves.includes('chopping')) p.needs.fun = Math.min(100, p.needs.fun + 0.18 * dt);
    },
    thought: p => p.loves.includes('chopping') ? 'Thwack! So satisfying.' : 'Somebody has to keep the woodpile stocked.',
  });

  def({
    id: 'read', label: 'Reading', love: 'reading', indoor: true, pose: 'sit',
    score: (p, c) => 0.3 + (1 - p.traits.energetic) * 0.35 + love(p, 'reading') + (c.weather === 'rain' || c.weather === 'storm' ? 0.5 : 0) + (c.hour >= 20 ? 0.2 : 0),
    plan: (p, c) => {
      let spot = Math.random() < 0.7 ? ownSpot(p, 'read') : null;
      if (!spot && clear(c) && c.hour < 20) spot = p.world.freeSpot('bench');
      if (!spot) spot = p.world.freeSpot('read');
      return spot ? { spot, duration: IS.rand(40, 90) } : null;
    },
    tick: (p, a, dt) => { p.needs.fun = Math.min(100, p.needs.fun + (p.loves.includes('reading') ? 0.2 : 0.08) * dt); },
    thought: p => p.loves.includes('reading') ? 'Just one more chapter...' : 'A bit of quiet reading.',
  });

  def({
    id: 'beach', label: 'Relaxing on the beach', love: 'beach', outdoor: true, chatOK: true, pose: 'sit',
    can: (p, c) => between(c.min, H(9), H(19.5)) && (c.weather === 'sunny' || c.weather === 'cloudy'),
    score: (p, c) => 0.3 + love(p, 'beach') + dN(p, 'fun') * 0.5 + (1 - p.traits.hardworking) * 0.25 + (c.weekday >= 5 ? 0.3 : 0),
    plan: p => { const spot = p.world.freeSpot('beach'); return spot ? { spot, duration: IS.rand(40, 110) } : null; },
    tick: (p, a, dt) => { p.needs.fun = Math.min(100, p.needs.fun + 0.18 * dt); p.needs.energy = Math.min(100, p.needs.energy + 0.02 * dt); },
    thought: () => 'Sun, sand, and absolutely nothing to do.',
  });

  def({
    id: 'swim', label: 'Swimming', love: 'swimming', outdoor: true, pose: 'swim',
    can: (p, c) => between(c.min, H(10), H(18)) && c.weather === 'sunny' && c.season !== 'Winter',
    score: (p, c) => 0.15 + p.traits.brave * 0.35 + p.traits.energetic * 0.2 + love(p, 'swimming') + dN(p, 'fun') * 0.3,
    plan: p => { const spot = p.world.freeSpot('swim'); return spot ? { spot, duration: IS.rand(30, 60), swim: true } : null; },
    tick: (p, a, dt) => { p.needs.fun = Math.min(100, p.needs.fun + 0.3 * dt); p.needs.energy -= 0.05 * dt; },
    finish: (p, a, c) => { p.wetUntil = c.abs + 40; },
    thought: () => 'The water is perfect today!',
  });

  def({
    id: 'wander', label: 'Wandering', love: 'wandering', outdoor: true, chatOK: true,
    can: (p, c) => between(c.min, H(6), H(21.5)) && c.weather !== 'storm',
    score: (p, c) => 0.25 + p.traits.curious * 0.45 + p.traits.energetic * 0.15 + love(p, 'wandering') + dN(p, 'fun') * 0.25,
    plan: p => {
      const opts = p.world.pois.filter(poi => IS.dist(poi.x, poi.y, p.tx, p.ty) > 8);
      const poi = IS.pick(opts.length ? opts : p.world.pois);
      return { tx: poi.x, ty: poi.y, face: IS.pick(['down', 'left', 'right']), duration: IS.rand(8, 20), poi };
    },
    tick: (p, a, dt) => { p.needs.fun = Math.min(100, p.needs.fun + (p.loves.includes('wandering') ? 0.22 : 0.1) * dt); },
    thought: (p, a) => `Let's go see what's happening at ${a.poi ? a.poi.name : 'the island'}.`,
  });

  def({
    id: 'stargaze', label: 'Stargazing', love: 'stargazing', outdoor: true, chatOK: true, pose: 'sit',
    can: (p, c) => between(c.min, H(20.5), H(1)) && c.weather === 'sunny',
    score: (p, c) => 0.25 + love(p, 'stargazing') + p.traits.curious * 0.2 + (p.partner() ? 0.3 : 0) - (p.isBedtime(c.min) ? 1.5 : 0),
    plan: p => { const spot = p.world.freeSpot('stargaze'); return spot ? { spot, duration: IS.rand(40, 80) } : null; },
    tick: (p, a, dt) => { p.needs.fun = Math.min(100, p.needs.fun + 0.25 * dt); },
    thought: () => 'So many stars out here. No city lights.',
  });

  def({
    id: 'plaza', label: 'Hanging out at the plaza', love: 'chatting', outdoor: true, chatOK: true, pose: 'sit',
    can: (p, c) => between(c.min, H(8), H(21)) && clear(c),
    score: (p, c) => 0.2 + p.traits.sociable * 0.35 + dN(p, 'social') * 0.5,
    plan: p => { const spot = p.world.freeSpot('bench', s => s.area === 'plaza'); return spot ? { spot, duration: IS.rand(30, 60) } : null; },
    tick: (p, a, dt) => { p.needs.fun = Math.min(100, p.needs.fun + 0.06 * dt); },
    thought: () => 'Let\'s see who walks by.',
  });

  def({
    id: 'home', label: 'Pottering at home', indoor: true,
    score: (p, c) => 0.18 + (c.weather === 'rain' ? 0.4 : 0) + (c.weather === 'storm' ? 2 : 0) + (c.hour >= 20 ? 0.35 : 0) + (p.loves.includes('cooking') ? 0.15 : 0),
    plan: p => {
      const spot = ownSpot(p, 'cookHome') || ownSpot(p, 'read');
      return spot ? { spot, duration: IS.rand(25, 55) } : null;
    },
    tick: (p, a, dt) => {
      p.needs.fun = Math.min(100, p.needs.fun + (p.loves.includes('cooking') ? 0.15 : 0.03) * dt);
      p.needs.energy = Math.min(100, p.needs.energy + 0.02 * dt);
    },
    label2: p => (p.loves.includes('cooking') ? 'Cooking at home' : 'Pottering at home'),
    thought: (p, a, c) => c.weather === 'storm' ? 'Not going out in THAT.' : p.loves.includes('cooking') ? 'Trying a new recipe.' : 'Tidying up a little.',
  });

  def({
    id: 'socialize', label: 'Looking for company', love: 'chatting', outdoor: false, social: true,
    can: (p, c) => between(c.min, H(7), H(22)) && p.sim.people.some(o => o !== p && o.canBeVisited(p)),
    score: (p, c) => Math.pow(dN(p, 'social'), 1.2) * 2.6 * (0.5 + p.traits.sociable) + love(p, 'chatting') * 0.6,
    plan: p => {
      const cands = p.sim.people.filter(o => o !== p && o.canBeVisited(p)).map(o => {
        const r = p.relTo(o.name);
        return { o, w: Math.max(5, 50 + r.friendship + r.romance * 0.8 + (r.friendship < 0 && p.traits.kind > 0.6 ? 30 : 0)) };
      });
      if (!cands.length) return null;
      const target = IS.weightedPick(cands).o;
      return { follow: target, duration: 5 };
    },
    thought: (p, a) => a.follow ? `I could use a chat with ${a.follow.name}.` : 'Feeling a bit lonely.',
  });

  def({
    id: 'care', label: 'Visiting a sick friend', outdoor: false, social: true,
    can: (p, c) => !p.sick && between(c.min, H(8), H(20)) && p.sim.people.some(o => o.sick && o !== p && !o.visitedBy.has(p.name)),
    score: p => {
      const sick = p.sim.people.find(o => o.sick && o !== p && !o.visitedBy.has(p.name));
      if (!sick) return 0;
      return (p.traits.kind * 1.6 + p.relTo(sick.name).friendship / 70) * 1.4;
    },
    plan: p => {
      const sick = p.sim.people.find(o => o.sick && o !== p && !o.visitedBy.has(p.name));
      if (!sick) return null;
      return { follow: sick, duration: 5, care: true };
    },
    thought: (p, a) => `${a.follow ? a.follow.name : 'Someone'} is sick. I'll bring some soup.`,
  });

  def({
    id: 'watchDolphins', label: 'Watching dolphins', outdoor: true, chatOK: true,
    can: (p, c) => !!p.sim.events.dolphins && !p.sawDolphins,
    score: p => 0.8 + p.traits.curious * 2,
    plan: p => {
      const d = p.sim.events.dolphins;
      const spot = (p.world.spots.shore || []).filter(s => !s.takenBy).sort((a, b) => IS.dist(a.x, a.y, d.tx, d.ty) - IS.dist(b.x, b.y, d.tx, d.ty))[0];
      return spot ? { spot, duration: 30 } : null;
    },
    start: p => {
      p.sawDolphins = true;
      p.remember('Watched dolphins playing offshore', { tag: 'dolphins', mood: 10, news: true });
      p.say(IS.pick(['DOLPHINS!!', 'Look at them jump!', 'Hello, dolphin friends!']));
    },
    tick: (p, a, dt) => { p.needs.fun = Math.min(100, p.needs.fun + 0.5 * dt); if (!p.sim.events.dolphins) a.done = true; },
    thought: () => 'Dolphins! Right there!',
  });

  def({
    id: 'pickBottle', label: 'Checking out a bottle', outdoor: true,
    can: (p, c) => !!p.sim.events.bottle && !p.sim.events.bottle.claimedBy && between(c.min, H(7), H(19.5)),
    score: p => 0.2 + p.traits.curious * 1.6,
    plan: p => {
      const b = p.sim.events.bottle;
      b.claimedBy = p;
      return { tx: b.tx, ty: b.ty, face: 'down', duration: 4 };
    },
    finish: p => p.sim.events.readBottle(p),
    cancel: p => { const b = p.sim.events.bottle; if (b && b.claimedBy === p) b.claimedBy = null; },
    thought: () => 'Is that a bottle on the beach?',
  });

  def({
    id: 'greetBoat', label: 'Meeting the supply boat', outdoor: true, chatOK: true,
    can: (p, c) => { const b = p.sim.events.boat; return !!b && (b.state === 'arriving' || b.state === 'docked') && !p.greetedBoat; },
    score: p => 0.6 + p.traits.curious * 0.8 + p.traits.sociable * 0.5 + p.traits.hardworking * 0.3,
    plan: p => { const spot = p.world.freeSpot('greet'); return spot ? { spot, duration: 60 } : null; },
    start: p => { p.greetedBoat = true; },
    tick: (p, a) => { const b = p.sim.events.boat; if (!b || b.state === 'leaving') a.done = true; },
    thought: () => 'Supply boat! Maybe there\'s mail for me.',
  });

  def({
    id: 'petCat', label: 'Petting the cat', love: 'cats', outdoor: true, chatOK: true,
    can: (p, c) => { const cat = p.sim.cat; return !!cat && !cat.building && !cat.reserved && between(c.min, H(7), H(21)); },
    score: p => {
      const cat = p.sim.cat;
      const near = IS.dist(p.x, p.y, cat.x, cat.y) < IS.TILE * 14 ? 0.3 : 0;
      return 0.1 + p.traits.kind * 0.25 + love(p, 'cats') * 1.4 + near + (p.loves.includes('cats') ? dN(p, 'fun') * 0.6 : 0);
    },
    plan: p => {
      const cat = p.sim.cat;
      const goal = p.world.findNear(cat.tx, cat.ty, (x, y) => p.world.walkable(x, y) && !(x === cat.tx && y === cat.ty) && Math.abs(x - cat.tx) + Math.abs(y - cat.ty) === 1, 2);
      cat.reserved = p;
      return { tx: goal.x, ty: goal.y, duration: IS.rand(10, 20), cat };
    },
    start: (p, a) => {
      p.faceToward(a.cat.x, a.cat.y);
      a.cat.pettedBy = p;
      p.emote('heart', 2);
      if (Math.random() < 0.5) p.say(IS.pick([`Hi ${a.cat.name}! Who's a good kitty?`, 'Look at those little paws...', `${a.cat.name}! My favourite!`, 'Pspspsps.']));
    },
    tick: (p, a, dt) => {
      p.needs.fun = Math.min(100, p.needs.fun + (p.loves.includes('cats') ? 0.6 : 0.25) * dt);
      if (Math.random() < dt * 0.12) a.cat.purr();
    },
    finish: (p, a) => {
      a.cat.reserved = null; a.cat.pettedBy = null;
      if (p.loves.includes('cats')) p.remember(`Petted ${a.cat.name}`, { tag: 'cat', mood: 6, moodDuration: 240 });
    },
    cancel: (p, a) => { const cat = p.sim.cat; if (cat && cat.reserved === p) { cat.reserved = null; cat.pettedBy = null; } },
    thought: p => p.loves.includes('cats') ? 'I need to pet the cat. It is urgent.' : 'Hey, kitty kitty.',
  });

  // Event attendance and hosting are handed out by the event manager.
  def({
    id: 'attend', label: 'At an event', outdoor: false, chatOK: true, pose: 'sit',
    can: p => !!p.sim.events.eventFor(p),
    score: () => 9,
    plan: p => {
      const ev = p.sim.events.eventFor(p);
      const spot = p.world.freeSpot(ev.seat, ev.seatFilter);
      if (!spot) return null;
      return { spot, duration: Math.max(10, ev.end - p.sim.clock.min), event: ev };
    },
    start: (p, a) => p.sim.events.onArrive(p, a.event),
    tick: (p, a, dt) => { if (a.event.state === 'done') a.done = true; else p.sim.events.tickAttendee(p, a.event, dt); },
    label2: (p, a) => a.event ? a.event.name : 'At an event',
    thought: (p, a) => a.event ? a.event.thought(p) : 'Party time!',
  });

  def({
    id: 'cook', label: 'Cooking dinner', indoor: true,
    can: p => !!p.sim.events.cookingFor(p),
    score: () => 10,
    plan: p => {
      const ev = p.sim.events.cookingFor(p);
      const spot = (p.world.spots.cook || [])[0];
      return spot ? { spot, duration: Math.max(10, ev.start - 5 - p.sim.clock.min), event: ev, face: 'up' } : null;
    },
    tick: (p, a, dt) => { if (Math.random() < dt * 0.3) p.emote(IS.pick(['note', 'food']), 1.4); },
    thought: () => 'Chop, stir, taste... needs more salt.',
  });

  // Walking over to someone they noticed (or were told to talk to)
  def({
    id: 'approach', label: 'Going to say hi', outdoor: false, social: true,
    can: () => false,
    score: () => 0,
    plan: p => p.approachTarget ? { follow: p.approachTarget, duration: 5, topic: p.approachTopic } : null,
    label2: (p, a) => a.follow ? `Going over to ${a.follow.name}` : 'Going to say hi',
    thought: (p, a) => {
      const o = a.follow; if (!o) return 'Oh, hey!';
      if (a.forced) return `The sky says I should talk to ${o.name}. Okay then.`;
      const r = p.relTo(o.name);
      if (r.romance > 45) return `Act normal. It's just ${o.name}. Totally normal.`;
      if (r.friendship > 50) return `There's ${o.name}! Gotta go bug them.`;
      if (r.friendship < -10) return `Maybe I should clear the air with ${o.name}.`;
      return `Oh, ${o.name}'s over there. I'll go say hi.`;
    },
  });

  A.list = Object.values(A).filter(d => typeof d === 'object' && d.id);
  return A;
})();
