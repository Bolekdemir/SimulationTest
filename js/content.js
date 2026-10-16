// Things to do and things to find: skills that level up, a collection of
// finds, new activities (beachcombing, sandcastles, bug catching, painting,
// guitar, workouts, kites) and random happenings (rainbows, whales, auroras,
// coconuts, bees, buried treasure, a stray kitten).
IS.Content = (() => {
  const C = {};
  const T = () => IS.TILE;
  const H = h => h * 60;
  const between = (min, a, b) => (a <= b ? min >= a && min < b : min >= a || min < b);
  const dN = (p, k) => (100 - p.needs[k]) / 100;
  const love = (p, key) => (p.loves.includes(key) ? 0.45 : 0) - (p.hates.includes(key) ? 0.6 : 0);
  const clear = c => c.weather === 'sunny' || c.weather === 'cloudy';
  const awake = o => o.pose !== 'sleep' && o.mode === 'normal';

  // ------------------------------------------------------------ skills
  C.SKILLS = {
    fishing: { name: 'Fishing', titles: ['Beginner angler', 'Keen angler', 'Skilled angler', 'Master angler'] },
    gardening: { name: 'Gardening', titles: ['Seedling', 'Green thumb', 'Gardener', 'Master gardener'] },
    foraging: { name: 'Foraging', titles: ['Wanderer', 'Forager', 'Trail expert', 'Forest whisperer'] },
    chopping: { name: 'Woodcutting', titles: ['Splinter magnet', 'Woodcutter', 'Lumberjack', 'Axe legend'] },
    swimming: { name: 'Swimming', titles: ['Paddler', 'Swimmer', 'Strong swimmer', 'Basically a fish'] },
    beachcombing: { name: 'Beachcombing', titles: ['Shell spotter', 'Beachcomber', 'Treasure hunter', 'Shell oracle'] },
    building: { name: 'Sandcastles', titles: ['Sand pile maker', 'Castle builder', 'Sand architect', 'Sandcastle royalty'] },
    bugs: { name: 'Bug catching', titles: ['Net waver', 'Bug catcher', 'Entomologist', 'Bug whisperer'] },
    painting: { name: 'Painting', titles: ['Doodler', 'Painter', 'Artist', 'Master painter'] },
    music: { name: 'Guitar', titles: ['Strummer', 'Busker', 'Musician', 'Island legend'] },
    fitness: { name: 'Fitness', titles: ['Couch potato', 'Getting fit', 'Athlete', 'Peak human'] },
  };
  const ACT_SKILL = { fish: 'fishing', garden: 'gardening', forage: 'foraging', chop: 'chopping', swim: 'swimming', beachcomb: 'beachcombing', sandcastle: 'building', bugs: 'bugs', paint: 'painting', guitar: 'music', workout: 'fitness', jog: 'fitness' };
  C.level = xp => Math.min(10, Math.floor(Math.sqrt((xp || 0) / 25)));
  C.lvl = (p, skill) => C.level((p.skills || {})[skill]);
  C.title = (p, skill) => { const l = C.lvl(p, skill); const t = C.SKILLS[skill].titles; return t[Math.min(t.length - 1, Math.floor(l / 3))]; };
  C.gain = (p, skill, xp) => {
    p.skills = p.skills || {};
    const before = C.level(p.skills[skill]);
    p.skills[skill] = (p.skills[skill] || 0) + xp * (p.loves.includes(skillLove(skill)) ? 1.4 : 1);
    const after = C.level(p.skills[skill]);
    if (after > before && after >= 1) {
      const sk = C.SKILLS[skill];
      const newTitle = after % 3 === 0;
      p.emote('sparkle', 2.4);
      p.say(IS.pick(newTitle ? [`I'm officially a ${C.title(p, skill).toLowerCase()} now!`, `${sk.name} level ${after}! Call me ${C.title(p, skill)}.`] : [`I'm getting really good at ${sk.name.toLowerCase()}!`, `${sk.name} level ${after}. Not bad.`, 'Practice pays off!']), 3);
      p.addMood(`Got better at ${sk.name.toLowerCase()}`, newTitle ? 8 : 4, 600);
      p.remember(`Reached ${sk.name.toLowerCase()} level ${after}`, { tag: 'level', news: newTitle });
      if (newTitle) { IS.Mind.feel(p, 'proud', null, 3); IS.Mind.news(p.sim, 'levelUp', p, null, { detail: C.title(p, skill).toLowerCase() }); }
      if (newTitle) p.sim.log(`${p.name} became a ${C.title(p, skill)}! (${sk.name} ${after})`, 'good', [p]);
    }
  };
  const skillLove = s => ({ fishing: 'fishing', gardening: 'gardening', foraging: 'foraging', chopping: 'chopping', swimming: 'swimming', beachcombing: 'shells', building: 'sandcastles', bugs: 'bugs', painting: 'painting', music: 'music', fitness: 'fitness' }[s]);
  // Every working minute counts toward the skill
  C.practice = (p, a, dt) => { const s = ACT_SKILL[a.def.id]; if (s) C.gain(p, s, dt * 0.5); };

  // ------------------------------------------------------------ collection
  C.ITEMS = [
    // beach
    ['spiral', 'shell', 'Spiral shell', 'beach', 30], ['conch', 'shell', 'Pink conch', 'beach', 18], ['dollar', 'shell', 'Sand dollar', 'beach', 18], ['glass', 'shell', 'Sea glass', 'beach', 20],
    ['starfish', 'shell', 'Starfish', 'beach', 12], ['pearl', 'shell', 'Pearl', 'beach', 3], ['coin', 'shell', 'Pirate coin', 'beach', 3], ['bottlecap', 'shell', 'Mystery bottle cap', 'beach', 8],
    // forest
    ['bluecap', 'forest', 'Glowing blue mushroom', 'forage', 14], ['stone', 'forest', 'Shiny stone', 'forage', 18], ['compass', 'forest', 'Old brass compass', 'forage', 5], ['feather', 'forest', 'Bird\'s nest feather', 'forage', 16],
    ['clover', 'forest', 'Four-leaf clover', 'forage', 6], ['fossil', 'forest', 'Fern fossil', 'forage', 4], ['acorn', 'forest', 'Golden acorn', 'forage', 2],
    // fish
    ['carp', 'fish', 'Golden carp', 'fish', 6], ['eel', 'fish', 'Glowing eel', 'fish', 4], ['puffer', 'fish', 'Pufferfish', 'fish', 10], ['boot', 'fish', 'Old boot', 'fish', 14],
    ['octo', 'fish', 'Tiny octopus', 'fish', 6], ['swordfish', 'fish', 'Swordfish', 'fish', 2], ['crab', 'fish', 'Grumpy crab', 'fish', 12],
    // bugs
    ['butterfly', 'bug', 'Blue butterfly', 'bugs', 20], ['ladybug', 'bug', 'Ladybug', 'bugs', 22], ['beetle', 'bug', 'Stag beetle', 'bugs', 10], ['grasshopper', 'bug', 'Grasshopper', 'bugs', 20],
    ['dragonfly', 'bug', 'Dragonfly', 'bugs', 12], ['firefly', 'bug', 'Firefly', 'bugsNight', 30], ['moth', 'bug', 'Luna moth', 'bugsNight', 6], ['mantis', 'bug', 'Orchid mantis', 'bugs', 3],
    // treasure
    ['chest', 'treasure', 'Pirate treasure chest', 'treasure', 1], ['spyglass', 'treasure', 'Captain\'s spyglass', 'treasure', 1], ['crown', 'treasure', 'Tiny gold crown', 'treasure', 1], ['map', 'treasure', 'Torn treasure map', 'treasure', 1],
  ].map(([id, cat, name, src, w]) => ({ id, cat, name, src, w }));
  C.CATS = { shell: 'Shore finds', forest: 'Forest finds', fish: 'Catches', bug: 'Bugs', treasure: 'Treasure', art: 'Paintings' };
  C.find = (p, src, chance = 1) => {
    if (Math.random() > chance) return null;
    const pool = C.ITEMS.filter(i => i.src === src);
    if (!pool.length) return null;
    const it = IS.weightedPick(pool);
    const sim = p.sim;
    sim.collection = sim.collection || {};
    const isNew = !sim.collection[it.id];
    const rare = it.w <= 4;
    if (isNew) {
      sim.collection[it.id] = { by: p.name, day: sim.clock.day, season: sim.clock.season };
      sim.log(`${p.name} found something new: ${it.name}!${rare ? ' A rare one.' : ''}`, 'good', [p]);
      if (sim.ui) sim.ui.toast(`New for the collection: ${it.name}${rare ? ' (rare!)' : ''}`);
    }
    p.emote(rare ? 'sparkle' : 'exclaim', 2);
    p.say(IS.pick(rare ? [`NO WAY. A ${it.name.toLowerCase()}!`, `Is this... a real ${it.name.toLowerCase()}?!`, `Everyone come look! ${it.name}!`] : isNew ? [`Ooh, a ${it.name.toLowerCase()}!`, `${it.name}! Never seen one of these.`, `Look what I found!`] : [`Another ${it.name.toLowerCase()}.`, 'Nice.', `${it.name}. Classic.`]), 2.6);
    p.addMood(rare ? 'Found something rare' : 'Found something', rare ? 10 : isNew ? 5 : 2, 360);
    if (rare || isNew) p.remember(`Found a ${it.name.toLowerCase()}`, { tag: src === 'forage' ? 'find' : 'collect', detail: `a ${it.name.toLowerCase()}`, news: rare && src === 'forage', mood: rare ? 6 : 0 });
    if (rare) IS.Mind.news(sim, 'rareFind', p, null, { detail: it.name.toLowerCase() });
    return it;
  };

  // ------------------------------------------------------------ world objects
  // Sandcastles on the beach, an X where treasure is buried, finished paintings
  C.objects = sim => (sim.sandcastles || []).concat(sim.treasure && !sim.treasure.dug ? [sim.treasure] : []);
  C.addSandcastle = (p, size) => {
    const sim = p.sim;
    sim.sandcastles = sim.sandcastles || [];
    const spot = p.action && p.action.spot;
    const tx = spot ? spot.x : p.tx, ty = spot ? spot.y + 1 : p.ty + 1;
    if (!sim.world.walkable(tx, ty)) return;
    sim.sandcastles.push({ kind: 'castle', x: tx * T() + 12, y: ty * T() + 18, size, by: p.name, t: sim.clock.abs, flag: IS.pick(['#e0405a', '#4a8fe0', '#f2b82e', '#5fae4a']) });
    if (sim.sandcastles.length > 6) sim.sandcastles.shift();
  };
  C.drawObj = (R, ctx, o, ox, oy, t) => {
    const s = IS.Iso.w2s(o.x, o.y);
    const x = Math.round(s.x - ox), y = Math.round(s.y - oy);
    const px = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + a, y + b, w, h); };
    if (o.kind === 'castle') {
      const age = (R.sim.clock.abs - o.t) / 1440;
      const k = o.size, melt = Math.min(1, age * 1.2);
      const ol = '#6a4a2a', sand = '#f0d49a', sandD = '#c99a58', sandL = '#fff0c8';
      // outlined block: dark edge, sunlit left, shaded right
      const block = (a, b, w, h) => { px(a - 1, b - 1, w + 2, h + 2, ol); px(a, b, w, h, sand); px(a, b, 2, h, sandL); px(a + w - 2, b, 2, h, sandD); };
      ctx.fillStyle = 'rgba(60, 30, 20, 0.28)'; ctx.beginPath(); ctx.ellipse(x, y, 13, 4, 0, 0, Math.PI * 2); ctx.fill();
      const h = Math.max(3, Math.round((7 + k * 3) * (1 - melt * 0.7)));
      block(-10, -4, 20, 5);
      if (k >= 2) { block(-11, -3 - (h - 3), 5, h - 3); block(6, -3 - (h - 3), 5, h - 3); }
      block(-5, -4 - h, 10, h);
      for (let i = 0; i < 3; i++) block(-5 + i * 4, -6 - h, 2, 2);
      if (k >= 3) block(-1, -11 - h, 2, 6);
      px(-1, -3 - Math.round(h / 3), 3, 4, '#5a3a22');
      if (melt < 0.5) { const fy = k >= 3 ? -18 - h : -12 - h; px(0, fy, 1, 6, '#4a3020'); px(1, fy, 5, 3, o.flag); }
    } else if (o.kind === 'x') {    } else if (o.kind === 'x') {
      ctx.globalAlpha = 0.85;
      for (let i = -3; i <= 3; i++) { px(i, i - 1, 2, 1, '#c8443a'); px(i, -i - 1, 2, 1, '#c8443a'); }
      ctx.globalAlpha = 1;
    }
  };

  // ------------------------------------------------------------ props held while doing things
  C.drawProp = (R, ctx, p, sx, sy, t) => {
    const a = p.action;
    if (!a || a.phase !== 'do') return;
    const id = a.def.id;
    const px = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(sx + x, sy + y, w, h); };
    const side = p.dir === 'left' ? -1 : 1;
    if (id === 'guitar') {
      const bob = Math.sin(t * 8) > 0 ? 1 : 0;
      px(-7, -15, 9, 6, '#8a4a28'); px(-6, -14, 7, 4, '#c4733a'); px(-3, -13, 2, 2, '#2a1a14');
      px(2, -17 - bob, 8, 1, '#5a3420'); px(9, -18 - bob, 2, 2, '#3a2418');
      if (Math.random() < 0.06) R.sim.fx.add({ x: sx + R.ox + IS.rand(-4, 8), y: sy + R.oy - 30, vx: IS.rand(-6, 6), vy: -18, g: 0, max: 1.2, color: IS.pick(['#2a2135', '#4a3a60']), size: 2, fade: true });
    } else if (id === 'paint') {
      const ex = side * 12;
      px(ex - 1, -24, 2, 22, '#7a4a2a'); px(ex - 5, -6, 2, 6, '#7a4a2a'); px(ex + 3, -6, 2, 6, '#7a4a2a');
      px(ex - 7, -26, 14, 12, '#f8f2e4'); px(ex - 7, -26, 14, 1, '#2a2135');
      const done = Math.min(1, a.elapsed / a.duration);
      const cols = a.palette || (a.palette = IS.shuffle(['#4a8fe0', '#5fae4a', '#f2b82e', '#e0405a', '#c46bd6', '#ff8a3a']).slice(0, 3));
      for (let i = 0; i < Math.floor(done * 9); i++) px(ex - 6 + (i % 3) * 4, -25 + Math.floor(i / 3) * 3, 4, 3, cols[i % 3]);
      px(side * 4, -14 + (Math.sin(t * 6) > 0 ? 1 : 0), 1, 4, '#6a4030');
    } else if (id === 'bugs') {
      const sw = Math.sin(t * 5);
      const hx = side * (8 + sw * 3), hy = -22 - Math.abs(sw) * 3;
      ctx.strokeStyle = '#7a4a2a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx + side * 3, sy - 14); ctx.lineTo(sx + hx, sy + hy); ctx.stroke();
      ctx.strokeStyle = '#f4f0f8'; ctx.beginPath(); ctx.ellipse(sx + hx + side * 2, sy + hy - 2, 4, 3, 0, 0, Math.PI * 2); ctx.stroke();
      if (Math.random() < 0.08) { const n = R.sim.clock.min > 20 * 60 || R.sim.clock.min < 5 * 60; R.sim.fx.add({ x: sx + R.ox + IS.rand(-14, 14), y: sy + R.oy - IS.rand(14, 30), vx: IS.rand(-10, 10), vy: IS.rand(-6, 6), g: 0, max: 1.2, color: n ? '#ffe86a' : IS.pick(['#4a8fe0', '#e0405a', '#ffffff']), size: 1, fade: true }); }
    } else if (id === 'kite') {
      const kx = side * 26 + Math.sin(t * 1.3) * 6, ky = -70 + Math.cos(t * 1.7) * 5;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx + side * 3, sy - 16); ctx.quadraticCurveTo(sx + kx * 0.5, sy - 30, sx + kx, sy + ky); ctx.stroke();
      ctx.fillStyle = a.color || (a.color = IS.pick(['#e0405a', '#4a8fe0', '#f2b82e', '#c46bd6']));
      ctx.beginPath(); ctx.moveTo(sx + kx, sy + ky - 7); ctx.lineTo(sx + kx + 5, sy + ky); ctx.lineTo(sx + kx, sy + ky + 7); ctx.lineTo(sx + kx - 5, sy + ky); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#2a2135'; ctx.stroke();
      for (let i = 1; i < 4; i++) px(kx - 1 + Math.round(Math.sin(t * 3 + i) * 2), ky + 7 + i * 3, 2, 1, '#ffffff');
    } else if (id === 'beachcomb') {
      px(side * 8 - 3, -6, 6, 5, '#d8b070'); px(side * 8 - 3, -6, 6, 1, '#a07840');
    } else if (id === 'workout') {
      if (Math.floor(t * 2) % 2 === 0 && Math.random() < 0.05) R.sim.fx.drip(p.x + IS.rand(-4, 4), p.y, 28);
    }
  };

  // ------------------------------------------------------------ new activities
  const meadowTile = (p, near) => {
    const W = p.world, poi = W.pois.find(x => x.name === near) || IS.pick(W.pois);
    return W.findNear(poi.x + IS.randi(-4, 4), poi.y + IS.randi(-3, 3), (x, y) => W.walkable(x, y) && W.reach[W.idx(x, y)] === 1 && !W.buildingAt(x, y) && !p.sim.people.some(o => o !== p && o.tx === x && o.ty === y), 6);
  };
  const ACTIVITIES = [
    {
      id: 'beachcomb', label: 'Beachcombing', love: 'shells', outdoor: true, chatOK: true, pose: 'work',
      can: (p, c) => between(c.min, H(6.5), H(19)) && c.weather !== 'storm',
      score: (p, c) => 0.3 + p.traits.curious * 0.4 + love(p, 'shells') + love(p, 'beach') * 0.4 + dN(p, 'fun') * 0.25,
      plan: p => { const spot = p.world.freeSpot('shore'); return spot ? { spot, duration: IS.rand(30, 60), face: 'down' } : null; },
      tick: (p, a, dt) => {
        p.needs.fun = Math.min(100, p.needs.fun + 0.12 * dt);
        a.acc = (a.acc || 0) + dt;
        if (a.acc >= 15) { a.acc = 0; C.find(p, 'beach', 0.22 + C.lvl(p, 'beachcombing') * 0.02); }
      },
      thought: () => IS.pick(['Shells, shells, maybe a pearl...', 'The tide always brings something.', 'Eyes on the sand.']),
    },
    {
      id: 'sandcastle', label: 'Building a sandcastle', love: 'sandcastles', outdoor: true, chatOK: true, pose: 'work',
      can: (p, c) => between(c.min, H(9), H(18.5)) && clear(c),
      score: (p, c) => 0.18 + love(p, 'sandcastles') + love(p, 'beach') * 0.5 + dN(p, 'fun') * 0.35 + (1 - p.traits.hardworking) * 0.15,
      plan: p => { const spot = p.world.freeSpot('beach'); return spot ? { spot, duration: IS.rand(40, 70) } : null; },
      tick: (p, a, dt) => { p.needs.fun = Math.min(100, p.needs.fun + 0.2 * dt); if (Math.random() < dt * 0.3) p.sim.fx.dust(p.x + IS.rand(-6, 6), p.y + 8); },
      finish: p => {
        const l = C.lvl(p, 'building');
        const size = l >= 6 ? 3 : l >= 3 ? 2 : 1;
        C.addSandcastle(p, size);
        p.say(IS.pick(size === 3 ? ['Behold. A FORTRESS.', 'My masterpiece. Nobody touch it.'] : size === 2 ? ['Two towers! Getting fancy.', 'Not bad, if I say so myself.'] : ['It\'s... a lump. A proud lump.', 'Okay, it\'s small. It has heart.']), 2.6);
        p.emote('sparkle', 2);
        if (size === 3) p.sim.log(`${p.name} built a huge sandcastle on the beach.`, 'good', [p]);
      },
      thought: () => IS.pick(['A moat. It needs a moat.', 'This one will survive the tide. Probably.', 'Towers first, then walls.']),
    },
    {
      id: 'bugs', label: 'Catching bugs', love: 'bugs', outdoor: true, chatOK: true,
      can: (p, c) => (between(c.min, H(7), H(18)) || between(c.min, H(20), H(22.5))) && c.weather !== 'storm' && c.weather !== 'rain',
      score: (p, c) => 0.2 + p.traits.curious * 0.4 + p.traits.energetic * 0.15 + love(p, 'bugs') + dN(p, 'fun') * 0.3,
      plan: p => { const t2 = meadowTile(p, IS.pick(['the west meadow', 'the farm', 'the Old Oak'])); return t2 ? { tx: t2.x, ty: t2.y, duration: IS.rand(30, 60), face: IS.pick(['left', 'right']) } : null; },
      tick: (p, a, dt, c) => {
        p.needs.fun = Math.min(100, p.needs.fun + 0.15 * dt);
        a.acc = (a.acc || 0) + dt;
        if (a.acc >= 15) { a.acc = 0; const night = c.min >= H(20) || c.min < H(5); C.find(p, night ? 'bugsNight' : 'bugs', 0.25 + C.lvl(p, 'bugs') * 0.025); }
      },
      thought: () => IS.pick(['Hold still, little guy...', 'Butterflies are faster than they look.', 'Got one! ...no. No I didn\'t.']),
    },
    {
      id: 'paint', label: 'Painting', love: 'painting', outdoor: true,
      can: (p, c) => between(c.min, H(8), H(19)) && clear(c),
      score: (p, c) => 0.1 + love(p, 'painting') * 2 + p.traits.curious * 0.25 + (c.min > H(17) ? 0.2 : 0) + dN(p, 'fun') * 0.2,
      plan: p => {
        const where = IS.pick(['the lighthouse', 'the dock', 'the west meadow', 'the Old Oak', 'the beach']);
        const t2 = meadowTile(p, where);
        return t2 ? { tx: t2.x, ty: t2.y, duration: IS.rand(60, 110), face: IS.pick(['left', 'right']), subject: where } : null;
      },
      tick: (p, a, dt) => { p.needs.fun = Math.min(100, p.needs.fun + 0.14 * dt); },
      finish: (p, a, c) => {
        const sim = p.sim, l = C.lvl(p, 'painting');
        const light = c.min > H(17) ? 'at sunset' : c.min < H(10) ? 'in the morning' : c.weather === 'cloudy' ? 'on a grey day' : 'in the sun';
        const name = `${a.subject.replace(/^the /, 'The ').replace(/^\w/, ch => ch.toUpperCase())} ${light}`;
        const quality = l >= 7 ? 'masterpiece' : l >= 4 ? 'lovely' : l >= 2 ? 'decent' : 'questionable';
        sim.paintings = sim.paintings || [];
        sim.paintings.push({ name, by: p.name, quality, day: sim.clock.day });
        if (sim.paintings.length > 40) sim.paintings.shift();
        p.say(IS.pick(quality === 'masterpiece' ? ['It\'s done. It\'s PERFECT.', 'I think this is my best one yet.'] : quality === 'questionable' ? ['Is it a boat? It\'s supposed to be a boat.', 'Art is subjective. Right?'] : ['Finished! I kind of love it.', 'Another one for the wall.']), 3);
        sim.log(`${p.name} finished a ${quality} painting: "${name}".`, 'good', [p]);
        p.remember(`Painted "${name}"`, { tag: 'painting', mood: quality === 'questionable' ? 1 : 6, news: quality === 'masterpiece', detail: name });
        if (quality === 'masterpiece') IS.Mind.news(sim, 'painting', p, null, { detail: name });
      },
      thought: (p, a) => `Trying to get ${a.subject} just right.`,
    },
    {
      id: 'guitar', label: 'Playing guitar', love: 'music', outdoor: true, chatOK: true, pose: 'sit',
      can: (p, c) => between(c.min, H(10), H(22.5)) && c.weather !== 'storm' && c.weather !== 'rain',
      score: (p, c) => 0.08 + love(p, 'music') * 1.2 + p.traits.sociable * 0.2 + (c.min > H(18) ? 0.3 : 0) + dN(p, 'fun') * 0.2,
      plan: (p, c) => { const spot = (c.min > H(19) ? p.world.freeSpot('bonfireSeat') : null) || p.world.freeSpot('bench', s => s.area === 'plaza') || p.world.freeSpot('beach'); return spot ? { spot, duration: IS.rand(30, 60) } : null; },
      tick: (p, a, dt) => {
        p.needs.fun = Math.min(100, p.needs.fun + 0.18 * dt);
        if (Math.random() < dt * 0.04) {
          const l = C.lvl(p, 'music');
          for (const o of p.sim.people) {
            if (o === p || !awake(o) || IS.dist(o.x, o.y, p.x, p.y) > T() * 6 || (o.building || null) !== (p.building || null)) continue;
            if (l >= 3) { o.addMood(`Enjoyed ${p.name}'s music`, 4 + l, 240); o.changeRel(p.name, 0.5); if (Math.random() < 0.3) o.say(IS.pick(['This song slaps.', 'Play another one!', '*nods along*', 'Okay, that\'s actually good.']), 2); }
            else if (Math.random() < 0.3) o.say(IS.pick(['...is that a cat dying?', 'You\'ll get there!', 'Maybe practise somewhere else?', '*covers ears politely*']), 2);
          }
        }
      },
      finish: p => { if (C.lvl(p, 'music') >= 6 && Math.random() < 0.3) { p.sim.log(`${p.name} played a little concert. People actually stopped to listen.`, 'good', [p]); IS.Mind.news(p.sim, 'concert', p); } },
      thought: p => (C.lvl(p, 'music') >= 3 ? 'Okay, this one I can actually play.' : 'G... C... wait, where does that finger go?'),
    },
    {
      id: 'workout', label: 'Working out', love: 'fitness', outdoor: true, pose: 'work',
      can: (p, c) => between(c.min, H(6), H(19)) && c.weather !== 'storm' && p.needs.energy > 35,
      score: (p, c) => 0.08 + love(p, 'fitness') * 1.3 + p.traits.energetic * 0.3 + (c.min < H(9) ? 0.25 : 0),
      plan: p => { const t2 = meadowTile(p, IS.pick(['the plaza', 'the beach', 'the west meadow'])); return t2 ? { tx: t2.x, ty: t2.y, duration: IS.rand(25, 45), face: 'down' } : null; },
      tick: (p, a, dt) => { p.needs.energy -= 0.06 * dt; p.needs.fun = Math.min(100, p.needs.fun + (p.loves.includes('fitness') ? 0.2 : 0.04) * dt); p.anim += dt * 8; if (Math.random() < dt * 0.02) p.say(IS.pick(['...eighteen... nineteen...', 'Feel the burn!', 'One more set.', 'Hngh!']), 1.6); },
      finish: p => p.addMood('Good workout', 5, 300),
      thought: () => IS.pick(['Push-ups, then squats, then more push-ups.', 'No days off.', 'Discipline is freedom.']),
    },
    {
      id: 'jog', label: 'Going for a jog', love: 'fitness', outdoor: true,
      can: (p, c) => between(c.min, H(6), H(19.5)) && c.weather !== 'storm' && p.needs.energy > 40,
      score: (p, c) => 0.05 + love(p, 'fitness') * 1.5 + p.traits.energetic * 0.25,
      plan: p => { const poi = IS.pick(p.world.pois.filter(x => IS.dist(x.x, x.y, p.tx, p.ty) > 10)); return poi ? { tx: poi.x, ty: poi.y, duration: IS.rand(4, 8), poi } : null; },
      tick: (p, a, dt) => { p.needs.energy -= 0.04 * dt; },
      finish: p => { p.addMood('Good run', 4, 240); p.needs.fun = Math.min(100, p.needs.fun + 8); },
      thought: () => IS.pick(['Lap around the island. Let\'s go.', 'Breathe in, breathe out.', 'Race you! ...to nobody.']),
    },
    {
      id: 'kite', label: 'Flying a kite', love: 'kites', outdoor: true, chatOK: true,
      can: (p, c) => between(c.min, H(9), H(18)) && (c.weather === 'cloudy' || c.weather === 'sunny'),
      score: (p, c) => 0.08 + love(p, 'kites') * 1.8 + p.traits.curious * 0.15 + dN(p, 'fun') * 0.3 + (c.weather === 'cloudy' ? 0.2 : 0),
      plan: p => { const t2 = meadowTile(p, IS.pick(['the west meadow', 'the beach'])); return t2 ? { tx: t2.x, ty: t2.y, duration: IS.rand(30, 60), face: IS.pick(['left', 'right']) } : null; },
      tick: (p, a, dt) => { p.needs.fun = Math.min(100, p.needs.fun + 0.22 * dt); },
      thought: () => IS.pick(['Higher! HIGHER!', 'The wind is perfect for this.', 'Don\'t get stuck in a tree, don\'t get stuck in a tree...']),
    },
    {
      id: 'digTreasure', label: 'Digging for treasure', outdoor: true, pose: 'work',
      can: (p, c) => between(c.min, H(7), H(19)) && !!p.sim.treasure && !p.sim.treasure.dug && !p.sim.treasure.digger && ((p.sim.treasure.knownBy || []).includes(p.name) || p.knows.has(p.sim.treasure.newsId)),
      score: p => 3 + p.traits.curious * 1.5,
      plan: p => { const tr = p.sim.treasure, W = p.world; const t2 = W.findNear(Math.floor(tr.x / T()), Math.floor((tr.y - 6) / T()), (x, y) => W.walkable(x, y) && W.reach[W.idx(x, y)] === 1, 2); return t2 ? { tx: t2.x, ty: t2.y, duration: IS.rand(25, 40) } : null; },
      start: p => { p.sim.treasure.digger = p.name; p.say(IS.pick(['X marks the spot!', 'Treasure, here I come!', 'If this is a prank I\'m going to scream.']), 2.6); },
      tick: (p, a, dt) => { if (Math.random() < dt * 0.6) p.sim.fx.dust(p.sim.treasure.x + IS.rand(-5, 5), p.sim.treasure.y); },
      finish: p => {
        const sim = p.sim; const tr = sim.treasure; tr.dug = true;
        const it = C.ITEMS.filter(i => i.cat === 'treasure' && !(sim.collection || {})[i.id]);
        const got = it.length ? IS.pick(it) : null;
        sim.world.food += 4;
        if (got) { sim.collection = sim.collection || {}; sim.collection[got.id] = { by: p.name, day: sim.clock.day, season: sim.clock.season }; }
        p.say(got ? `TREASURE! A ${got.name.toLowerCase()}!` : 'Just... old jars of pickles? Treasure, I guess.', 3);
        p.emote('sparkle', 3);
        sim.log(got ? `${p.name} dug up buried treasure: ${got.name}! There were snacks in it too.` : `${p.name} dug up a crate of very old pickles. The pantry grew.`, 'good', [p]);
        if (sim.ui) sim.ui.toast(got ? `Treasure found: ${got.name}!` : 'Buried pickles found.');
        IS.Mind.news(sim, 'treasure', p, null, { detail: got ? got.name.toLowerCase() : 'a crate of pickles' });
        p.remember(got ? `Dug up ${got.name.toLowerCase()}!` : 'Dug up old pickles', { tag: 'find', mood: 12, news: true, detail: got ? got.name.toLowerCase() : 'pickles' });
      },
      cancel: p => { if (p.sim.treasure && p.sim.treasure.digger === p.name) p.sim.treasure.digger = null; },
      thought: () => 'Treasure. Actual buried treasure.',
    },
  ];

  // ------------------------------------------------------------ random happenings
  C.hourly = (sim, hour) => {
    const W = sim.world;
    const day = hour >= 7 && hour <= 18;
    const people = sim.people.filter(awake);
    // A whale far out at sea
    if (!sim.whale && day && sim.weather !== 'storm' && sim.lastWhaleDay !== sim.clock.day && Math.random() < 0.025) {
      sim.lastWhaleDay = sim.clock.day;
      const bf = W.bonfire;
      let ty = bf.y + 6; while (ty < W.H - 2 && W.waterDist[W.idx(bf.x, ty)] < 6) ty++;
      sim.whale = { x: (bf.x + IS.randi(-10, 10)) * T(), y: ty * T(), until: sim.clock.abs + 60, t0: performance.now() };
      sim.log('A whale is breaching off the south coast!', 'event'); sim.toast('A whale! Off the south coast!');
      for (const p of people) if (Math.random() < p.traits.curious) sim.nudge(p, 1);
      for (const p of people) if (!p.building && Math.random() < 0.4) p.remember('Saw a whale off the coast', { tag: 'whale', mood: 8, news: true });
    }
    // Aurora on a clear night
    if (!sim.aurora && (hour === 22 || hour === 23) && sim.weather === 'sunny' && Math.random() < 0.06) {
      sim.aurora = { until: sim.clock.abs + 150, t0: performance.now() };
      sim.log('The sky is glowing green and purple. An aurora!', 'event'); sim.toast('An aurora is lighting up the sky!');
      for (const p of people) if (!p.building) { p.emote('sparkle', 2.4); if (Math.random() < 0.6) p.say(IS.pick(['The sky is DANCING!', 'Is the Sky... happy?', 'Wake everyone up! Look!', 'It\'s beautiful...']), 2.6); p.addMood('Saw the aurora', 10, 720); p.remember('Saw the aurora light up the sky', { tag: 'aurora', news: true }); }
    }
    // A coconut, right on the head
    if (day && Math.random() < 0.03) {
      const v = IS.pick(people.filter(p => p.action && ['beach', 'beachcomb', 'sandcastle', 'guitar'].includes(p.action.def.id)));
      if (v) {
        v.emote('dizzy', 2.4); v.say(IS.pick(['OW! A COCONUT?!', 'Who threw that?! ...oh. A coconut.', 'The island is attacking me now?!']), 2.6);
        v.addMood('Bonked by a coconut', -4, 180); sim.world.food += 1;
        sim.log(`A coconut fell on ${v.name}'s head. Free snack, at least.`, 'event', [v]);
        IS.Mind.news(sim, 'bonk', v);
        IS.Gods.witness(sim, v, ['PFFT. A coconut!', 'You okay?! ...that was hilarious.', 'Nature said no.'], 7);
      }
    }
    // Bees in the garden
    if (day && Math.random() < 0.025) {
      const v = IS.pick(people.filter(p => p.action && p.action.def.id === 'garden' && p.action.phase === 'do'));
      if (v && IS.Gods.panicRun(sim, v)) {
        v.say(IS.pick(['BEES! BEES! BEEEES!', 'NOT THE BEES!', 'Why are they following me?!']), 2.6); v.emote('exclaim', 2.4);
        sim.beeSwarm = { who: v, until: performance.now() + 4500 };
        sim.log(`${v.name} disturbed a beehive in the garden and ran for it.`, 'event', [v]);
        IS.Mind.news(sim, 'bees', v);
        IS.Gods.witness(sim, v, ['Run! RUN!', 'HAHAHA. Sorry. Run!', 'Not it! Not it!'], 8);
      }
    }
    // Buried treasure: a map in a bottle, then an X on the ground
    if (!sim.treasure || sim.treasure.dug) {
      if (day && sim.clock.day >= 2 && Math.random() < 0.012) {
        const v = IS.pick(people.filter(p => !p.building));
        const spot = W.findNear(IS.randi(15, 60), IS.randi(15, 45), (x, y) => W.walkable(x, y) && W.reach[W.idx(x, y)] === 1 && !W.buildingAt(x, y) && W.tile(x, y) !== IS.TT.PLAZA && W.tile(x, y) !== IS.TT.FLOOR, 10);
        if (v && spot) {
          sim.treasure = { kind: 'x', x: spot.x * T() + 12, y: spot.y * T() + 18, knownBy: [v.name], dug: false, t: sim.clock.abs };
          v.emote('exclaim', 2.4); v.say(IS.pick(['A treasure map?! In a BOTTLE?!', 'X marks the spot... wait, this is OUR island!']), 3);
          v.remember('Found a treasure map in a bottle', { tag: 'find', mood: 8, news: true, detail: 'a treasure map' });
          sim.log(`${v.name} found a treasure map in a bottle. There's an X on it.`, 'event', [v]);
          sim.toast(`${v.name} found a treasure map! An X appeared on the island.`);
          sim.treasure.newsId = IS.Mind.news(sim, 'treasureMap', v).id;
        }
      }
    }
    // A stray kitten turns up
    if (!sim.kitten && sim.clock.day >= 2 && day && Math.random() < 0.015) {
      sim.kitten = new IS.Cat(sim, IS.pick(['Mochi', 'Pickle', 'Noodle', 'Pebble']), 'hall', 'grey');
      sim.kitten.stray = true;
      sim.log(`A tiny grey kitten wandered out of the bushes near the Hall. It looks lost.`, 'event');
      sim.toast('A stray kitten turned up near the Hall!');
      for (const p of people) if (p.loves.includes('cats')) { sim.nudge(p, 1); p.say(IS.pick(['Is that a KITTEN?!', 'Oh my gosh. Baby.', 'I will protect it with my life.']), 2.6); }
    }
  };

  // Rain clears up: rainbow
  C.onWeather = (sim, prev, w) => {
    if ((prev === 'rain' || prev === 'storm') && (w === 'sunny' || w === 'cloudy') && sim.clock.min > H(7) && sim.clock.min < H(18)) {
      sim.rainbow = { until: sim.clock.abs + 90, t0: performance.now() };
      sim.log('A rainbow stretches over the island.', 'event');
      for (const p of sim.people.filter(awake)) if (!p.building) { p.addMood('Saw a rainbow', 5, 300); if (Math.random() < 0.4) { p.emote('sparkle', 2); p.say(IS.pick(['A rainbow!', 'Double rainbow? No. Single. Still great.', 'Look up! LOOK UP!']), 2.4); } }
    }
  };

  // The kitten gets adopted by whoever pets it first
  C.adopt = (sim, p, cat) => {
    if (!cat.stray) return;
    cat.stray = false;
    cat.home = sim.world.buildings.find(b => b.id === p.homeId) || cat.home;
    cat.owner = p.name;
    sim.log(`${p.name} adopted the stray kitten and named it ${cat.name}!`, 'love', [p]);
    sim.toast(`${p.name} adopted ${cat.name}!`);
    p.say(IS.pick([`You're coming home with me, ${cat.name}.`, `I'm calling you ${cat.name}. Welcome home.`]), 3);
    p.addMood(`Adopted ${cat.name}`, 14, 1440);
    p.remember(`Adopted a kitten called ${cat.name}`, { tag: 'kitten', news: true });
    IS.Mind.news(sim, 'kitten', p, null, { detail: cat.name });
  };
  C.cats = sim => [sim.cat, sim.kitten].filter(Boolean);
  C.freeCat = p => IS.pick(C.cats(p.sim).filter(c => !c.building && !c.reserved)) || null;

  // ------------------------------------------------------------ per frame
  C.update = (sim, dt, rdt) => {
    const now = sim.clock.abs;
    if (sim.whale && now > sim.whale.until) sim.whale = null;
    if (sim.aurora && now > sim.aurora.until) sim.aurora = null;
    if (sim.rainbow && now > sim.rainbow.until) sim.rainbow = null;
    if (sim.kitten && dt > 0) sim.kitten.update(dt);
    // Sandcastles melt away in about a day, faster in the rain; grumpy people kick them
    if (sim.sandcastles && dt > 0) {
      const rain = sim.weather === 'rain' || sim.weather === 'storm';
      sim.sandcastles = sim.sandcastles.filter(o => now - o.t < (rain ? 600 : 1440));
      for (const o of sim.sandcastles) {
        if (o.kicked) continue;
        const k = sim.people.find(p => p.name !== o.by && p.traits.grumpy > 0.55 && awake(p) && IS.dist(p.x, p.y, o.x, o.y) < T() * 1.2 && Math.random() < 0.002 * dt);
        if (k) {
          o.kicked = true; o.t = now - 1300;
          k.say(IS.pick(['Oops. My foot slipped.', 'It was in my way.', 'Sandcastles are for children.']), 2.4);
          sim.log(`${k.name} "accidentally" kicked over ${o.by}'s sandcastle.`, 'warn', [k]);
          const b = sim.byName(o.by); if (b) { b.changeRel(k.name, -6); IS.Mind.led(b, k.name).grudge += 6; IS.Mind.led(b, k.name).why = 'kicking my sandcastle'; }
        }
      }
    }
    // Bee swarm follows its victim for a few seconds
    if (sim.beeSwarm) {
      if (performance.now() > sim.beeSwarm.until) sim.beeSwarm = null;
      else { const s = IS.Iso.w2s(sim.beeSwarm.who.x, sim.beeSwarm.who.y); for (let i = 0; i < 2; i++) sim.fx.add({ x: s.x + IS.rand(-10, 10), y: s.y - IS.rand(14, 34), vx: IS.rand(-30, 30), vy: IS.rand(-20, 20), g: 0, max: 0.4, color: Math.random() < 0.5 ? '#ffd23a' : '#2a2135', size: 1 }); }
    }
  };

  // Sky and sea overlays drawn by the renderer
  C.drawSea = (R, ctx, ox, oy, now) => {
    const w = R.sim.whale;
    if (!w) return;
    const s = IS.Iso.w2s(w.x, w.y);
    const ph = ((now - w.t0) / 1000) % 7;
    const x = Math.round(s.x - ox), y = Math.round(s.y - oy);
    if (ph < 3) {
      const up = Math.sin(ph / 3 * Math.PI);
      ctx.fillStyle = '#3a4a6a'; ctx.beginPath(); ctx.ellipse(x, y + 4 - up * 6, 22, 5 + up * 3, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#5a6a8a'; ctx.fillRect(x - 12, y - up * 6, 10, 2);
      if (ph > 0.6 && ph < 2) { ctx.fillStyle = 'rgba(232, 251, 255, 0.8)'; for (let i = 0; i < 6; i++) ctx.fillRect(x - 8 + IS.randi(-3, 3), y - 10 - up * 8 - i * 3, 2, 2); }
    } else if (ph > 4.5 && ph < 5.5) {
      ctx.fillStyle = '#3a4a6a'; ctx.beginPath(); ctx.moveTo(x + 14, y + 2); ctx.lineTo(x + 24, y - 8); ctx.lineTo(x + 20, y + 2); ctx.lineTo(x + 30, y - 6); ctx.lineTo(x + 26, y + 3); ctx.closePath(); ctx.fill();
    }
  };
  C.drawSky = (R, ctx, now) => {
    const sim = R.sim, vw = R.vw, vh = R.vh;
    if (sim.rainbow) {
      const left = (sim.rainbow.until - sim.clock.abs) / 90;
      ctx.globalAlpha = Math.min(1, left * 3, (now - sim.rainbow.t0) / 2000) * 0.32;
      const cols = ['#ff5a5a', '#ffa83a', '#ffe85a', '#6ade6a', '#5ab4ff', '#9a7aff'];
      cols.forEach((c, i) => { ctx.strokeStyle = c; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(vw * 0.55, vh * 1.05, vh * 0.85 - i * 5, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); });
      ctx.globalAlpha = 1;
    }
    if (sim.aurora) {
      const t = now / 1000;
      const left = (sim.aurora.until - sim.clock.abs) / 150;
      ctx.globalCompositeOperation = 'lighter';
      for (let band = 0; band < 3; band++) {
        ctx.globalAlpha = Math.min(1, left * 3, (now - sim.aurora.t0) / 3000) * (0.16 - band * 0.03);
        ctx.fillStyle = band === 1 ? '#c46bff' : '#5affb0';
        for (let x = 0; x < vw; x += 4) {
          const y = vh * (0.08 + band * 0.07) + Math.sin(x / 60 + t * 0.6 + band) * 18 + Math.sin(x / 23 + t * 1.3) * 6;
          ctx.fillRect(x, y, 4, 30 + Math.sin(x / 37 + t) * 14);
        }
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
  };

  // ------------------------------------------------------------ setup
  C.init = sim => {
    // A few new favourite things
    const extra = { Iroh: ['kites', 'bugs'], Forest: ['fitness'], Egg: ['sandcastles'], Jude: ['music'], Beach: ['shells'], Lynn: ['painting', 'bugs'] };
    for (const p of sim.people) for (const l of extra[p.name] || []) if (!p.loves.includes(l)) p.loves.push(l);
    sim.collection = sim.collection || {};
    sim.paintings = sim.paintings || [];
    sim.sandcastles = sim.sandcastles || [];
  };
  C.register = () => {
    for (const d of ACTIVITIES) { IS.Actions[d.id] = d; if (!IS.Actions.list.includes(d)) IS.Actions.list.push(d); }
    // Practice makes perfect: every skilled activity earns experience
    for (const id of Object.keys(ACT_SKILL)) {
      const d = IS.Actions[id];
      if (!d || d._practice) continue;
      const orig = d.tick;
      d.tick = (p, a, dt, c) => { if (orig) orig(p, a, dt, c); C.practice(p, a, dt); };
      d._practice = true;
    }
    Object.assign(IS.Dialogue.activityWord || {}, { shells: 'beachcombing', sandcastles: 'sandcastle building', bugs: 'bug catching', painting: 'painting', music: 'guitar', fitness: 'working out', kites: 'kite flying' });
  };
  C.register();

  return C;
})();
