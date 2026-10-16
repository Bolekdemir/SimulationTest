// Newcomers: islanders made from parts, so every island grows differently.
// A newcomer gets an archetype (sunny, grump, dreamer...) that sets the
// shape of their personality, then everything is jittered: traits, looks
// (skin, hair, eye colour, clothes), loves and hates, humour, a bio and a
// few catchphrases. They run on exactly the same brain as the original six.
IS.Newcomers = (() => {
  const N = {};
  const R = (a, b) => a + Math.random() * (b - a);
  const clamp01 = v => Math.max(0.03, Math.min(0.97, v));
  const wpick = list => { let t = 0; for (const [, w] of list) t += w; let r = Math.random() * t; for (const [v, w] of list) { r -= w; if (r <= 0) return v; } return list[0][0]; };
  const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

  // Names chosen so the whisper typo-fixer never turns a real word into one
  // (no "Milo" eating "milk", no "Vera" eating "very").
  N.NAMES = ['Ziggy', 'Jasper', 'Ozzy', 'Tito', 'Arlo', 'Otis', 'Quinn', 'Kenji', 'Priya', 'Amara', 'Dario', 'Elio', 'Freya', 'Jonah', 'Marco', 'Nadia',
    'Tomas', 'Yusuf', 'Zara', 'Soren', 'Anouk', 'Bram', 'Esme', 'Gideon', 'Ingrid', 'Maren', 'Orla', 'Tamsin', 'Matteo', 'Odessa', 'Cosmo', 'Mabel',
    'Rufus', 'Pippa', 'Lucan', 'Ayla', 'Margot', 'Indigo', 'Tarek', 'Kofi', 'Imani', 'Leilani', 'Bruno', 'Celeste', 'Dmitri'];

  // ------------------------------------------------------------ personalities
  const A = {
    sunny: {
      t: { sociable: 0.82, energetic: 0.7, kind: 0.85, grumpy: 0.1, curious: 0.6, hardworking: 0.5, brave: 0.5 },
      humor: ['wholesome', 'goofy'], loves: ['chatting', 'beach', 'cooking', 'music', 'cats', 'kites', 'swimming'], hates: ['chopping', 'reading'],
      lsf: [0.6, 0.5, 0.65],
      bio: [['Arrived smiling and has not stopped since.', 'Waves at everyone, including the seagulls.', 'Moved here because the brochure said "sunny". Took it personally.'],
        ['Remembers every birthday and bakes for most of them.', 'Can make friends with a rock. Has done so, twice.', 'Thinks every problem can be fixed with a picnic.'],
        ['Cries at sunsets. Every sunset.', 'Secretly afraid of being too much.', 'Has never once been in a bad mood before lunch.']],
      say: ['Good morning, island!', 'Today is going to be a great day. I can feel it.', 'Group hug? No? Group hug.', 'Have you eaten? You look like you need a snack.', 'Life\'s too short to be grumpy.'],
    },
    grump: {
      t: { sociable: 0.3, energetic: 0.45, kind: 0.4, grumpy: 0.75, curious: 0.4, hardworking: 0.75, brave: 0.55 },
      humor: ['dry', 'roast'], loves: ['fishing', 'reading', 'gardening', 'chopping', 'napping'], hates: ['chatting', 'music', 'kites'],
      lsf: [0.45, 0.6, 0.55],
      bio: [['Arrived with one suitcase and a lot of opinions.', 'Came here for peace and quiet. Is still waiting.', 'Moved to the island to get away from people. Bad plan.'],
        ['Pretends not to care, keeps a notebook of everyone\'s birthdays.', 'Fixes things nobody asked them to fix, then complains about it.', 'Has a favourite chair and will not discuss it.'],
        ['Softer than they look. Do not tell anyone.', 'Laughs exactly once a week, and it is worth the wait.', 'Will help you, but will sigh the whole time.']],
      say: ['Hmph.', 'Back in my day, we didn\'t have giant hands in the sky.', 'I\'m not grumpy. I\'m accurate.', 'Don\'t touch that.', 'Fine. But I\'m not happy about it.'],
    },
    dreamer: {
      t: { sociable: 0.45, energetic: 0.35, kind: 0.72, grumpy: 0.18, curious: 0.88, hardworking: 0.3, brave: 0.3 },
      humor: ['goofy', 'dry', 'wholesome'], loves: ['stargazing', 'painting', 'reading', 'wandering', 'bugs'], hates: ['chopping', 'fitness'],
      lsf: [0.55, 0.65, 0.55],
      bio: [['Came to the island following a dream. A literal one.', 'Showed up with a sketchbook and no plan.', 'Arrived on the supply boat, mostly by accident.'],
        ['Names every cloud. Has strong opinions about which ones are best.', 'Writes poems about the tide and hides them in books.', 'Believes the Old Oak is listening.'],
        ['Forgets to eat when inspired.', 'Gets lost on a straight path. Somehow.', 'Is pretty sure the stars are spelling something.']],
      say: ['Did you know the moon is slowly drifting away? Rude.', 'I had the strangest dream last night.', 'That cloud looks like a whale wearing a hat.', 'What if the sea is just the sky, but heavier?', 'Shh. I\'m having a thought.'],
    },
    hustler: {
      t: { sociable: 0.6, energetic: 0.88, kind: 0.5, grumpy: 0.35, curious: 0.5, hardworking: 0.95, brave: 0.62 },
      humor: ['brag', 'cocky'], loves: ['chopping', 'fishing', 'fitness', 'gardening'], hates: ['napping', 'stargazing'],
      lsf: [0.6, 0.55, 0.45],
      bio: [['Came to the island with a business plan. The island did not have a business.', 'Arrived at dawn and was working by breakfast.', 'Showed up with three jobs and a whistle.'],
        ['Has a schedule for their schedule.', 'Thinks naps are a myth invented by lazy people.', 'Counts the woodpile every morning. Out loud.'],
        ['Secretly wants someone to say "good job".', 'Has never once taken a day off. Might combust.', 'Is going to run this island one day. Probably.']],
      say: ['Rise and grind.', 'Time is wood, people. Time is wood.', 'I\'ll rest when the pantry\'s full.', 'Did you hit your step count today? I did. Twice.', 'Less talking, more chopping.'],
    },
    charmer: {
      t: { sociable: 0.9, energetic: 0.6, kind: 0.55, grumpy: 0.2, curious: 0.5, hardworking: 0.35, brave: 0.7 },
      humor: ['cocky', 'roast'], loves: ['chatting', 'swimming', 'music', 'beach'], hates: ['reading', 'gardening'],
      lsf: [0.82, 0.5, 0.65],
      bio: [['Arrived in sunglasses. At night.', 'Stepped off the boat like it was a red carpet.', 'Came to the island because the mainland got boring.'],
        ['Knows everyone\'s business within a day.', 'Has a different nickname for every person on the island.', 'Can talk their way out of anything, and often has to.'],
        ['Underneath the charm, a little lonely.', 'Has never lost a staring contest. Ever.', 'Flirts with the cat. The cat flirts back.']],
      say: ['Miss me?', 'You\'re welcome, by the way. For being here.', 'Is it hot, or is it just me? It\'s me.', 'I don\'t do mornings. Mornings do me.', 'Relax. I\'ve got this.'],
    },
    bookworm: {
      t: { sociable: 0.3, energetic: 0.3, kind: 0.7, grumpy: 0.25, curious: 0.92, hardworking: 0.6, brave: 0.22 },
      humor: ['dry', 'wholesome'], loves: ['reading', 'gardening', 'bugs', 'stargazing'], hates: ['swimming', 'fitness'],
      lsf: [0.5, 0.9, 0.5],
      bio: [['Arrived with four boxes of books and one shirt.', 'Came to the island to finish a book. Started six more.', 'Moved here to study the tides. Got distracted by beetles.'],
        ['Corrects everyone\'s facts, gently.', 'Has read every book in the Hall. Twice.', 'Keeps pressed flowers in every page.'],
        ['Terrified of deep water, fascinated by it anyway.', 'Would rather read about an adventure than have one.', 'Talks to plants. The plants are doing great.']],
      say: ['Actually, that\'s a common misconception.', 'I read about this once.', 'Fun fact: octopuses have three hearts.', 'Sorry, I was in the middle of a chapter.', 'Hm. Fascinating.'],
    },
    adventurer: {
      t: { sociable: 0.6, energetic: 0.92, kind: 0.6, grumpy: 0.2, curious: 0.8, hardworking: 0.5, brave: 0.95 },
      humor: ['goofy', 'roast', 'cocky'], loves: ['swimming', 'wandering', 'foraging', 'kites', 'fishing'], hates: ['napping', 'reading'],
      lsf: [0.65, 0.5, 0.65],
      bio: [['Swam the last bit to the island. The boat was right there.', 'Arrived with a backpack, a compass and no fear.', 'Came here after sailing around the world. Twice.'],
        ['Has climbed the lighthouse. From the outside.', 'Thinks storms are the best weather.', 'Has a scar for every story, and more stories than scars.'],
        ['Cannot sit still for more than four minutes.', 'Wants to be grabbed by the Sky Hand. On purpose.', 'Is sure there is a cave somewhere on this island.']],
      say: ['Let\'s go explore!', 'What\'s the worst that could happen?', 'I\'ve survived worse. Probably.', 'Race you to the lighthouse!', 'Danger is just fun with extra steps.'],
    },
    slacker: {
      t: { sociable: 0.55, energetic: 0.2, kind: 0.72, grumpy: 0.2, curious: 0.4, hardworking: 0.15, brave: 0.4 },
      humor: ['goofy', 'wholesome'], loves: ['napping', 'beach', 'cats', 'cooking'], hates: ['chopping', 'fitness'],
      lsf: [0.55, 0.5, 0.7],
      bio: [['Came to the island for a nap. Stayed for the naps.', 'Arrived on the boat asleep. Nobody knows how.', 'Moved here because it looked comfy.'],
        ['Has napped in every spot on the island and ranked them.', 'Believes hard work is overrated, and is very nice about it.', 'Makes the best snacks on the island and refuses to share the recipe.'],
        ['More thoughtful than anyone expects.', 'Will do anything for a cat.', 'Thinks the hammock is the greatest invention ever.']],
      say: ['Five more minutes.', 'Work? I thought you said "snack".', 'Why walk when you can lie down?', 'I\'m not lazy, I\'m conserving energy.', 'Nap first, then we\'ll see.'],
    },
  };
  N.ARCHETYPES = Object.keys(A);

  // ------------------------------------------------------------ looks
  const SKIN = ['#f6d7bd', '#f1c9a5', '#ecbf98', '#e2ad84', '#d39a6a', '#bb8253', '#9c6a42', '#7e5233', '#5f3c26'];
  const HAIR = [['#1e1a1d', 3], ['#2e2018', 3], ['#4a3020', 3], ['#6a4428', 2.5], ['#8a5a32', 2], ['#b07a44', 1.5], ['#d4ac66', 1.5], ['#ecd49c', 1], ['#b4482a', 1], ['#d8742e', 1], ['#8a8a96', 0.4]];
  const DYED = ['#e86aa8', '#5a8ae8', '#4ab88a', '#9a5ae0', '#ff8a4a'];
  // Eyes: browns are most common, but blue, green, grey and amber turn up often
  N.EYES = [['#2e1c14', 2.6], ['#5a3420', 2.2], ['#7a5428', 1.3], ['#3e7ad8', 1.6], ['#2f98c8', 0.6], ['#4a9a4a', 1.4], ['#6aa83a', 0.5], ['#7a8a9a', 0.6], ['#c8902a', 0.5]];
  const SHIRT = ['#e2743a', '#3f8a52', '#f4cf5a', '#e0405a', '#4a8fe0', '#c46bd6', '#5fc0b0', '#f28aa8', '#7a5ae0', '#f2a03a', '#3a5a8a', '#e8e0d0', '#2a2a36', '#8ac24a', '#b04a3a'];
  const PANTS = ['#36425e', '#4e3e30', '#6a7fae', '#2a2a36', '#8a6a4a', '#5a6a3a', '#a04a4a', '#d8c8a8', '#3a3a4a'];
  const SHOES = ['#3a2a22', '#2e2420', '#f4efe6', '#c84a3a', '#2a3a5a', '#6a4a2a'];
  const STYLES = {
    he: [['short', 3], ['fringe', 2], ['slickback', 1.5], ['curlyshort', 2], ['spiky', 1.5], ['wavy', 1], ['bald', 0.4], ['bun', 0.4], ['long', 0.3]],
    she: [['long', 2], ['longwavy', 2], ['ponytail', 2], ['bun', 1.5], ['bob', 1.5], ['curly', 1.5], ['wavy', 1], ['fringe', 0.6], ['short', 0.4]],
    they: [['short', 1], ['fringe', 1], ['bob', 1], ['curly', 1], ['wavy', 1], ['spiky', 1], ['ponytail', 1], ['curlyshort', 1]],
  };
  const ACC = p => [['none', 9], ['glasses', 2], ['shades', 1], ['hat', 1.4], ['bandana', 0.9], ['flower', p === 'he' ? 0.3 : 1.2], ['scarf', 1], ['beard', p === 'he' ? 1.6 : 0]];

  N.makeLook = pronoun => {
    const dyed = Math.random() < 0.08;
    const natural = wpick(HAIR);
    const shirt = IS.pick(SHIRT);
    const look = {
      skin: IS.pick(SKIN), hair: dyed ? IS.pick(DYED) : natural, hairStyle: wpick(STYLES[pronoun] || STYLES.they),
      eyes: wpick(N.EYES), shirt, pants: IS.pick(PANTS), shoes: IS.pick(SHOES), accessory: wpick(ACC(pronoun)),
      accent: Math.random() < 0.5 ? shirt : IS.pick(SHIRT), tall: Math.random() < 0.3,
    };
    if (dyed) look.roots = natural === '#ecd49c' || natural === '#d4ac66' ? '#6a4428' : natural;
    return look;
  };

  // ------------------------------------------------------------ a whole person
  const SEASONS = ['Spring', 'Summer', 'Fall', 'Winter'];
  N.used = sim => new Set((sim.everyone || sim.people).map(p => p.name).concat((sim.leftIsland || []).map(x => x.name), (sim.visitorsSeen || [])));
  N.pickName = sim => { const used = N.used(sim); const free = N.NAMES.filter(n => !used.has(n)); return free.length ? IS.pick(free) : null; };

  N.make = (sim, opts = {}) => {
    const name = opts.name || N.pickName(sim);
    if (!name) return null;
    const kind = opts.archetype || IS.pick(N.ARCHETYPES);
    const a = A[kind];
    const pronoun = opts.pronoun || wpick([['he', 0.46], ['she', 0.46], ['they', 0.08]]);
    const traits = {};
    for (const [k, v] of Object.entries(a.t)) traits[k] = Math.round(clamp01(v + R(-0.14, 0.14)) * 100) / 100;
    const loves = shuffle(a.loves).slice(0, 2 + (Math.random() < 0.5 ? 1 : 0));
    const extraLove = shuffle(['fishing', 'gardening', 'foraging', 'reading', 'beach', 'swimming', 'wandering', 'chatting', 'stargazing', 'cooking', 'cats', 'shells', 'bugs', 'painting', 'music', 'kites', 'sandcastles'].filter(l => !loves.includes(l) && !a.hates.includes(l)))[0];
    if (Math.random() < 0.6 && extraLove) loves.push(extraLove);
    const hates = shuffle(a.hates.filter(h => !loves.includes(h))).slice(0, Math.random() < 0.5 ? 2 : 1);
    const [l0, s0, f0] = a.lsf;
    const into = {};
    for (const k of shuffle(['looks', 'smarts', 'funny', 'kind', 'drive', 'confidence']).slice(0, 3)) into[k] = Math.round(R(0.2, 0.45) * 100) / 100;
    const attractedTo = wpick([[pronoun === 'he' ? ['she'] : pronoun === 'she' ? ['he'] : ['he', 'she', 'they'], 7], [['he', 'she', 'they'], 2.5], [pronoun === 'he' ? ['he'] : pronoun === 'she' ? ['she'] : ['they'], 1.2], [[], 0.4]]);
    const bio = a.bio.map(part => IS.pick(part)).join(' ');
    const quirks = [];
    if (Math.random() < 0.1) quirks.push('greedy');
    if (Math.random() < 0.08 + traits.grumpy * 0.1) quirks.push('impulsive');
    return {
      name, pronoun, generated: true, archetype: kind, bio,
      look: N.makeLook(pronoun), traits, humor: IS.pick(a.humor), quirks, loves, hates,
      home: null, canFallFor: [], attractedTo,
      looks: Math.round(clamp01(l0 + R(-0.2, 0.2)) * 100) / 100, smarts: Math.round(clamp01(s0 + R(-0.2, 0.2)) * 100) / 100, funny: Math.round(clamp01(f0 + R(-0.2, 0.2)) * 100) / 100,
      into, age: Math.round(R(19, 39)), birthday: { season: IS.pick(SEASONS), day: 1 + Math.floor(Math.random() * 28) },
      catchphrases: shuffle(a.say).slice(0, 3), bonds: {},
    };
  };

  // Who someone can fall for. Newcomers have it in their config; for the original six it's
  // read off the people Mav picked for them.
  N.attractedTo = p => {
    if (p.cfg.attractedTo) return p.cfg.attractedTo;
    if (!p._attr) p._attr = [...new Set((p.cfg.canFallFor || []).map(n => (IS.ISLANDERS.find(c => c.name === n) || {}).pronoun).filter(Boolean))];
    return p._attr;
  };

  // ------------------------------------------------------------ joining the island
  N.add = (sim, cfg, opts = {}) => {
    sim.nextPersonId = Math.max(sim.nextPersonId || 0, ...sim.everyone.map(p => p.id + 1));
    const p = new IS.Person(cfg, sim.nextPersonId++, sim);
    // Their own bed: an owned one if the save says so, else a free guest bedroll in the Hall
    const beds = sim.world.spots.bed || [];
    const mine = beds.find(s => s.owner === p.name) || beds.find(s => s.building === p.homeId && !s.owner && !sim.everyone.some(o => o !== p && o.bedSpot === s));
    p.bedSpot = mine || null;
    if (mine) mine.owner = p.name;
    if (mine && !opts.at) p.setTile(mine.x, mine.y);
    if (opts.at) { const t = sim.world.nearestWalkable(opts.at.x, opts.at.y); p.setTile(t.x, t.y); }
    p.thought = opts.visitor ? 'So this is Tidewhistle...' : 'New island, new me.';
    p.needs = { hunger: 70, energy: 80, social: 55, fun: 60 };
    sim.people.push(p);
    sim.everyone.push(p);
    if (sim.ui) sim.ui.buildRoster();
    return p;
  };

  return N;
})();
