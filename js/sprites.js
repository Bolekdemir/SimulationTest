// Procedural pixel art. Every sprite is painted pixel by pixel into an
// offscreen canvas once, then outlined, then reused forever.
IS.Sprites = (() => {
  const S = {};
  const OUT = '#2a2135';

  const px = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const disc = (g, cx, cy, r, c) => {
    g.fillStyle = c;
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        if (x * x + y * y <= r * r + r * 0.6) g.fillRect(cx + x, cy + y, 1, 1);
      }
    }
  };
  const ellipse = (g, cx, cy, rx, ry, c) => {
    g.fillStyle = c;
    for (let y = -ry; y <= ry; y++) {
      for (let x = -rx; x <= rx; x++) {
        if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1.05) g.fillRect(cx + x, cy + y, 1, 1);
      }
    }
  };
  S.px = px; S.disc = disc; S.ellipse = ellipse;

  // ------------------------------------------------------------------
  // People
  // ------------------------------------------------------------------
  // Sprite box is 20x28 "body units" with 6px headroom for hats, buns and
  // tall folks. Canvas is 22x36; feet sit at canvas (11, 34). Left-facing
  // frames are mirrored copies of right-facing ones.
  function drawPerson(look, dir, frame) {
    const { c, g } = IS.makeCanvas(22, 36);
    const side = dir === 'right';
    const back = dir === 'up';
    const tall = look.tall ? 2 : 0;
    let lift = tall; // upper body is raised for tall people
    const P = (x, y, w, h, col) => px(g, x + 1, y + 6 - lift, w, h, col);

    const sk = look.skin, skD = IS.shade(sk, -0.18), skL = IS.shade(sk, 0.15);
    const hr = look.hair, hrD = IS.shade(hr, -0.28), hrL = IS.shade(hr, 0.22);
    const sh = look.shirt, shD = IS.shade(sh, -0.25), shL = IS.shade(sh, 0.18);
    const pn = look.pants, pnD = IS.shade(pn, -0.25);
    const shoe = look.shoes || '#3b2f2f';
    const acc = look.accent || '#e05a5a';
    const style = look.hairStyle || 'short';
    const accessory = look.accessory || 'none';
    const walkA = frame === 1, walkB = frame === 2, work = frame === 3, carry = frame >= 4;
    const armsUp = work || carry;
    const longish = style === 'long' || style === 'longwavy';

    // Long hair and ponytails hang behind the body, so draw them first.
    if (!back && !side && longish) { P(3, 4, 14, 13, hrD); }
    if (side && longish) { P(3, 4, 6, 13, hrD); }
    if (side && style === 'ponytail') { P(1, 5, 4, 7, hr); P(1, 11, 3, 2, hrD); }

    // Legs (drawn from the ground up, longer for tall people)
    lift = 0;
    const L0 = 21 - tall, LH = 5 + tall;
    if (!side) {
      let lx = 6, rx = 11, lLift = 0, rLift = 0;
      if (walkA) lLift = 1;
      if (walkB) rLift = 1;
      if (frame === 4) { lx = 5; rx = 12; lLift = 2; }
      if (frame === 5) { lx = 6; rx = 11; rLift = 2; }
      P(lx, L0, 3, LH - lLift, pn); P(lx, 26 - lLift, 3, 2, shoe);
      P(rx, L0, 3, LH - rLift, pn); P(rx, 26 - rLift, 3, 2, shoe);
      P(rx + 2, L0, 1, LH - rLift, pnD);
    } else {
      let bx = 8, fx = 10, bLift = 0, fLift = 0;
      if (walkA) { bx = 6; fx = 12; }
      if (walkB) { bx = 9; fx = 9; fLift = 1; }
      if (frame === 4) { bx = 6; fx = 12; bLift = 2; }
      if (frame === 5) { bx = 7; fx = 11; fLift = 2; }
      P(bx, L0, 3, LH - bLift, pnD); P(bx, 26 - bLift, 4, 2, IS.shade(shoe, -0.2));
      P(fx, L0, 3, LH - fLift, pn); P(fx, 26 - fLift, 4, 2, shoe);
    }
    lift = tall;

    // Torso
    if (!side) {
      P(5, 13, 10, 8, sh);
      P(5, 13, 1, 8, shL);
      P(14, 13, 1, 8, shD);
      P(5, 20, 10, 1, shD);
      if (!back) P(9, 13, 2, 1, IS.shade(sk, -0.05)); // collar
    } else {
      P(6, 13, 8, 8, sh);
      P(13, 13, 1, 8, shD);
      P(6, 20, 8, 1, shD);
    }

    // Arms
    if (!side) {
      if (armsUp) {
        P(3, 9, 2, 5, sh); P(3, 6, 2, 3, sk);
        P(15, 9, 2, 5, sh); P(15, 6, 2, 3, sk);
      } else {
        const lOff = walkA ? 1 : walkB ? -1 : 0;
        P(3, 13, 2, 4, sh); P(3, 17 + lOff, 2, 3, sk);
        P(15, 13, 2, 4, shD); P(15, 17 - lOff, 2, 3, skD);
      }
    } else {
      if (armsUp) {
        P(9, 8, 3, 6, sh); P(10, 5, 2, 3, sk);
      } else {
        const ax = walkA ? 11 : walkB ? 7 : 9;
        P(ax, 13, 3, 5, shD); P(ax, 18, 3, 2, sk);
      }
    }

    // Scarf sits over the torso
    if (accessory === 'scarf') {
      if (!side) { P(4, 12, 12, 2, acc); if (!back) P(12, 14, 2, 4, IS.shade(acc, -0.15)); }
      else { P(5, 12, 10, 2, acc); P(5, 14, 2, 4, IS.shade(acc, -0.15)); }
    }

    // Head
    P(5, 1, 10, 1, sk); P(4, 2, 12, 9, sk); P(5, 11, 10, 1, sk);
    P(4, 2, 1, 9, skL);
    P(15, 2, 1, 9, skD); P(5, 11, 10, 1, skD);
    if (side) P(16, 7, 1, 2, sk); // nose

    // Face: eyes are a dark pupil over a coloured iris pixel
    const pupil = '#1d1424';
    const iris = look.eyes || '#3a2a30';
    const blush = IS.mix(sk, '#ff7a7a', 0.35);
    if (!back && !side) {
      P(7, 6, 1, 1, pupil); P(7, 7, 1, 1, iris); P(12, 6, 1, 1, pupil); P(12, 7, 1, 1, iris);
      P(6, 9, 1, 1, blush); P(13, 9, 1, 1, blush);
      P(9, 9, 2, 1, IS.shade(sk, -0.35));
    } else if (side) {
      P(13, 6, 1, 1, pupil); P(13, 7, 1, 1, iris); P(12, 9, 1, 1, blush); P(14, 9, 1, 1, IS.shade(sk, -0.35));
    }

    // Hair
    const capFront = () => { P(5, 0, 10, 1, hr); P(4, 1, 12, 3, hr); P(6, 1, 3, 1, hrL); };
    if (back) {
      if (style === 'bald') {
        P(4, 6, 12, 3, hr); P(6, 2, 2, 1, skL);
      } else {
        P(5, 0, 10, 1, hr); P(4, 1, 12, 9, hr); P(3, 3, 1, 6, hr); P(16, 3, 1, 6, hr);
        P(6, 1, 3, 1, hrL); P(4, 9, 12, 1, hrD);
        if (style === 'long') { P(3, 9, 14, 8, hr); P(3, 16, 14, 1, hrD); }
        if (style === 'longwavy') { P(3, 9, 14, 8, hr); for (let i = 0; i < 7; i++) P(3 + i * 2, 16 + (i % 2), 2, 1, hrD); for (let y = 10; y < 16; y += 3) P(5 + (y % 2) * 4, y, 1, 2, hrD); }
        if (style === 'wavy') { P(3, 9, 14, 2, hr); for (let i = 0; i < 7; i++) P(3 + i * 2, 11, 1, 1, hrD); }
        if (style === 'bob') { P(3, 9, 14, 3, hr); P(3, 11, 14, 1, hrD); }
        if (style === 'ponytail') { P(8, 9, 4, 7, hr); P(9, 15, 2, 2, hrD); P(8, 9, 4, 1, acc); }
        if (style === 'curly') { P(2, -1, 16, 12, hr); for (let i = 0; i < 7; i++) P(3 + i * 2, -2, 1, 1, hr); for (const [x, y] of [[4, 1], [9, 0], [14, 2], [6, 5], [12, 5], [3, 8], [9, 8], [15, 8]]) { P(x, y, 2, 1, hrD); P(x, y - 1, 1, 1, hrL); } for (let i = 0; i < 8; i++) P(2 + i * 2, 11, 1, 1, hr); }
        if (style === 'spiky') { for (let i = 0; i < 5; i++) P(5 + i * 2, -2, 1, 2, hr); }
        if (style === 'bun') { P(7, -3, 6, 4, hr); P(8, -3, 2, 1, hrL); }
        if (look.roots) { P(5, 0, 10, 1, look.roots); P(6, 1, 8, 1, IS.mix(look.roots, hr, 0.5)); }
      }
    } else if (side) {
      if (style === 'bald') {
        P(4, 5, 5, 4, hr); P(8, 2, 2, 1, skL);
      } else {
        P(5, 0, 10, 1, hr); P(4, 1, 12, 3, hr); P(4, 4, 5, 6, hr); P(13, 4, 3, 1, hr);
        P(7, 1, 3, 1, hrL);
        if (style === 'long') P(3, 4, 6, 12, hr);
        if (style === 'longwavy') { P(3, 4, 6, 12, hr); P(2, 7, 1, 2, hr); P(2, 12, 1, 2, hr); P(8, 15, 1, 1, hrD); }
        if (style === 'wavy') { P(3, 4, 6, 7, hr); P(2, 6, 1, 2, hr); P(12, 4, 3, 2, hr); P(4, 10, 2, 1, hrD); }
        if (style === 'bob') { P(3, 4, 7, 8, hr); P(3, 11, 7, 1, hrD); }
        if (style === 'curly') { P(2, -1, 14, 5, hr); P(2, 4, 8, 7, hr); for (let i = 0; i < 6; i++) P(3 + i * 2, -2, 1, 1, hr); for (const y of [0, 2, 5, 8]) for (let x = 3 + (y % 2); x < 14; x += 3) { if (y > 3 && x > 9) continue; P(x, y, 1, 1, hrD); P(x + 1, y - 1, 1, 1, hrL); } P(13, 4, 2, 1, hr); P(1, 6, 1, 1, hr); P(3, 11, 1, 1, hr); P(6, 11, 1, 1, hr); }
        if (style === 'spiky') { for (let i = 0; i < 5; i++) P(5 + i * 2, -2, 1, 2, hr); }
        if (style === 'bun') { P(5, -3, 5, 4, hr); }
        if (look.roots) { P(5, 0, 10, 1, look.roots); }
      }
    } else {
      if (style === 'bald') {
        P(3, 5, 2, 4, hr); P(15, 5, 2, 4, hr); P(7, 2, 2, 1, skL);
      } else {
        capFront();
        P(3, 2, 1, 6, hr); P(16, 2, 1, 6, hr);
        if (style === 'bob') {
          P(4, 4, 12, 1, hr); P(3, 2, 2, 10, hr); P(15, 2, 2, 10, hr); P(3, 11, 2, 1, hrD); P(15, 11, 2, 1, hrD);
        } else if (style === 'curly') {
          P(3, -1, 14, 5, hr); P(2, 0, 16, 4, hr); P(2, 2, 2, 8, hr); P(16, 2, 2, 8, hr);
          for (let i = 0; i < 7; i++) P(3 + i * 2, -2, 1, 1, hr);
          for (const y of [-1, 1, 3]) for (let x = 3 + ((y + 1) % 4 ? 1 : 0); x < 17; x += 3) { P(x, y, 1, 1, hrD); P(x + 1, y - 1, 1, 1, hrL); }
          P(5, 4, 2, 1, hr); P(5, 5, 1, 1, hr); P(9, 4, 2, 1, hr); P(10, 5, 1, 1, hrD); P(13, 4, 2, 1, hr); P(14, 5, 1, 1, hr);
          P(1, 4, 1, 1, hr); P(1, 7, 1, 1, hr); P(18, 5, 1, 1, hr); P(18, 8, 1, 1, hr); P(2, 9, 1, 1, hrD); P(17, 9, 1, 1, hrD);
        } else if (style === 'wavy' || style === 'longwavy') {
          // Swept, wavy bangs
          P(4, 4, 5, 1, hr); P(5, 5, 2, 1, hr); P(12, 4, 4, 1, hr); P(14, 5, 2, 1, hr);
          P(10, 1, 2, 1, hrL); P(13, 2, 2, 1, hrL);
          P(3, 2, 2, 7, hr); P(15, 2, 2, 7, hr); P(2, 5, 1, 2, hr); P(17, 4, 1, 2, hr);
          P(3, 9, 1, 1, hrD); P(16, 9, 1, 1, hrD);
        } else {
          // Bangs
          P(4, 4, 3, 1, hr); P(9, 4, 3, 1, hr); P(14, 4, 2, 1, hr);
        }
        if (style === 'long') { P(3, 2, 2, 14, hr); P(15, 2, 2, 14, hr); P(3, 15, 2, 1, hrD); P(15, 15, 2, 1, hrD); }
        if (style === 'longwavy') {
          P(3, 2, 2, 14, hr); P(15, 2, 2, 14, hr);
          for (let y = 6; y < 16; y += 3) { P(2, y, 1, 2, hr); P(17, y + 1, 1, 2, hr); P(4, y + 1, 1, 1, hrD); P(15, y, 1, 1, hrD); }
          P(3, 16, 2, 1, hrD); P(15, 16, 2, 1, hrD);
        }
        if (style === 'ponytail') { P(16, 5, 2, 6, hrD); P(16, 4, 2, 1, acc); }
        if (style === 'spiky') { for (let i = 0; i < 5; i++) P(5 + i * 2, -2, 1, 2, hr); P(4, -1, 12, 1, hr); }
        if (style === 'bun') { P(7, -3, 6, 4, hr); P(8, -3, 2, 1, hrL); }
        if (look.roots) { P(5, 0, 10, 1, look.roots); P(9, 1, 2, 1, IS.mix(look.roots, hr, 0.5)); }
      }
    }

    // Accessories
    const dark = '#2a2135';
    if (accessory === 'glasses' && !back) {
      if (!side) {
        P(6, 5, 3, 1, dark); P(6, 8, 3, 1, dark); P(6, 5, 1, 4, dark); P(8, 5, 1, 4, dark);
        P(11, 5, 3, 1, dark); P(11, 8, 3, 1, dark); P(11, 5, 1, 4, dark); P(13, 5, 1, 4, dark);
        P(9, 6, 2, 1, dark);
      } else {
        P(12, 5, 3, 1, dark); P(12, 8, 3, 1, dark); P(14, 5, 1, 4, dark); P(8, 6, 4, 1, dark);
      }
    }
    if (accessory === 'shades' && !back) {
      if (!side) { P(6, 6, 3, 2, pupil); P(11, 6, 3, 2, pupil); P(9, 6, 2, 1, pupil); P(6, 6, 1, 1, '#7a6fa8'); P(11, 6, 1, 1, '#7a6fa8'); }
      else { P(12, 6, 3, 2, pupil); P(8, 6, 4, 1, pupil); P(12, 6, 1, 1, '#7a6fa8'); }
    }
    if (accessory === 'beard' && !back) {
      if (!side) { P(4, 8, 12, 4, hr); P(5, 12, 10, 1, hr); P(7, 8, 6, 1, hrD); P(9, 10, 2, 1, IS.shade(sk, -0.4)); }
      else { P(10, 8, 6, 4, hr); P(13, 8, 2, 1, hrD); }
    }
    if (accessory === 'hat') {
      P(2, 2, 16, 2, IS.shade(acc, -0.1)); P(5, -2, 10, 4, acc); P(5, 1, 10, 1, IS.shade(acc, -0.35));
      P(6, -2, 3, 1, IS.shade(acc, 0.2));
    }
    if (accessory === 'bandana') {
      P(4, 2, 12, 2, acc); P(5, 2, 3, 1, IS.shade(acc, 0.25));
      if (!side && !back) { P(16, 3, 2, 3, IS.shade(acc, -0.15)); }
      if (back) { P(9, 4, 2, 3, IS.shade(acc, -0.15)); }
      if (side) { P(2, 3, 2, 3, IS.shade(acc, -0.15)); }
    }
    if (accessory === 'flower' && !back) {
      const fx = side ? 6 : 13;
      P(fx, 0, 3, 3, acc); P(fx + 1, 1, 1, 1, '#ffe27a');
    }

    IS.outline(c, OUT);
    return c;
  }

  const mirror = src => {
    const { c, g } = IS.makeCanvas(src.width, src.height);
    g.translate(src.width, 0); g.scale(-1, 1);
    g.drawImage(src, 0, 0);
    return c;
  };

  S.makePerson = look => {
    const frames = {};
    for (const dir of ['down', 'up', 'right']) {
      frames[dir] = [];
      for (let f = 0; f < 6; f++) frames[dir].push(drawPerson(look, dir, f));
    }
    frames.left = frames.right.map(mirror);
    // Portrait: head and shoulders, scaled 4x
    const src = frames.down[0];
    const { c } = IS.makeCanvas(22 * 4, 22 * 4);
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(src, 0, look.tall ? 0 : 2, 22, 22, 0, 0, 88, 88);
    return { frames, portrait: c.toDataURL() };
  };

  // ------------------------------------------------------------------
  // Emote bubbles (HGSS style)
  // ------------------------------------------------------------------
  const ICONS = {
    heart: ['.rr.rr.', 'rrrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'],
    zzz: ['kkkk...', '..k....', '.k.....', 'kkkk...', '....kkk', '.....k.', '....kkk'],
    note: ['...kkk.', '...k.kk', '...k..k', '...k...', '.kkk...', 'kkkk...', '.kk....'],
    exclaim: ['..rr...', '..rr...', '..rr...', '..rr...', '.......', '..rr...'],
    question: ['.kkkk..', 'kk..kk.', '....kk.', '...kk..', '..kk...', '.......', '..kk...'],
    anger: ['rr...rr', '.r...r.', '.......', '.......', '.r...r.', 'rr...rr'],
    sweat: ['...b...', '..bb...', '.bbbb..', '.bbwb..', '.bbbb..', '..bb...'],
    sparkle: ['...y...', '...y...', 'yyyyyyy', '..yyy..', '.y...y.', 'y.....y'],
    food: ['..oooo.', '.ooooo.', '.oooo..', '..oo...', '.w.....', 'ww.....'],
    fish: ['.......', '.bbb..b', 'bwbbbbb', 'bbbbbbb', '.bbb..b', '.......'],
    dizzy: ['.yyy...', 'y...y..', 'y.y.y..', 'y..y...', '.y.....', '..yyyy.'],
    sad: ['.bbbbb.', 'bbbbbbb', '.bbbbb.', '.......', '.b.b.b.', 'b.b.b..'],
    idea: ['..yyy..', '.yyyyy.', '.yyyyy.', '..yyy..', '..kkk..', '..kkk..'],
    gift: ['.r.r...', '..r....', 'ppppppp', 'pppyppp', 'pppyppp', 'pppyppp'],
  };
  const ICOL = { r: '#e0405a', k: '#2a2135', b: '#4a8fe0', w: '#ffffff', y: '#f2b82e', o: '#d9823b', p: '#c46bd6', g: '#5fae4a' };
  S.emotes = {};
  for (const [name, rows] of Object.entries(ICONS)) {
    const { c, g } = IS.makeCanvas(15, 15);
    px(g, 2, 1, 11, 10, '#ffffff'); px(g, 1, 2, 13, 8, '#ffffff');
    px(g, 6, 11, 3, 1, '#ffffff'); px(g, 7, 12, 1, 1, '#ffffff');
    rows.forEach((row, y) => {
      [...row].forEach((ch, x) => { if (ch !== '.') px(g, 4 + x, 2 + y + (rows.length < 7 ? 1 : 0), 1, 1, ICOL[ch]); });
    });
    IS.outline(c, OUT);
    S.emotes[name] = c;
  }

  // ------------------------------------------------------------------
  // Nature
  // ------------------------------------------------------------------
  S.makeOak = seed => {
    const r = IS.mulberry32(seed);
    const { c, g } = IS.makeCanvas(46, 58);
    const hue = r();
    const D = IS.mix('#237a3c', '#2f7d2c', hue), M = IS.mix('#42ad48', '#58b23c', hue), L = IS.mix('#93dc5a', '#bfe25a', hue);
    // trunk
    px(g, 19, 38, 8, 17, '#7a5232'); px(g, 19, 38, 2, 17, '#5e3d24'); px(g, 24, 40, 2, 15, '#946540');
    px(g, 17, 53, 12, 2, '#6a4529');
    // canopy
    const blobs = [[23, 22, 15], [12, 30, 10], [34, 30, 10], [15, 13, 9], [31, 13, 9], [23, 33, 10]];
    for (const [x, y, rr] of blobs) disc(g, x, y, rr, D);
    for (const [x, y, rr] of blobs) disc(g, x - 1, y - 2, rr - 2, M);
    disc(g, 17, 14, 5, L); disc(g, 28, 12, 3, L); disc(g, 11, 26, 3, L); disc(g, 22, 22, 3, IS.mix(M, L, 0.5));
    for (let i = 0; i < 70; i++) {
      const x = 4 + Math.floor(r() * 38), y = 4 + Math.floor(r() * 38);
      const d = g.getImageData(x, y, 1, 1).data;
      if (d[3] > 0) px(g, x, y, 2, 1, r() < 0.5 ? D : L);
    }
    IS.outline(c, '#1f3420');
    return c;
  };

  S.makePine = seed => {
    const r = IS.mulberry32(seed);
    const { c, g } = IS.makeCanvas(36, 62);
    const D = IS.mix('#17664a', '#1d6c40', r()), M = '#26935a', L = '#5ec06c';
    px(g, 16, 48, 4, 12, '#6b4428'); px(g, 16, 48, 1, 12, '#4f311c');
    const layers = [[46, 16, 15], [36, 14, 13], [26, 12, 11], [16, 9, 9]];
    for (const [base, h, half] of layers) {
      for (let row = 0; row < h; row++) {
        const hw = Math.round(((row + 1) / h) * half);
        const y = base - h + row;
        px(g, 18 - hw, y, hw * 2, 1, D);
        px(g, 18 - hw + 1, y, Math.max(1, hw - 1), 1, M);
        if (row % 3 === 0) px(g, 18 - Math.floor(hw / 2), y, 2, 1, L);
      }
    }
    px(g, 17, 2, 2, 3, M);
    IS.outline(c, '#173322');
    return c;
  };

  S.makePalm = seed => {
    const r = IS.mulberry32(seed);
    const { c, g } = IS.makeCanvas(48, 62);
    const flip = r() < 0.5 ? -1 : 1;
    // trunk: curved stack of rings
    for (let i = 0; i < 20; i++) {
      const t = i / 19;
      const x = 22 + Math.round(Math.sin(t * 1.4) * 6 * flip);
      const y = 58 - i * 2;
      px(g, x, y, 5, 2, i % 2 ? '#a77b4b' : '#8c623a');
      px(g, x, y, 1, 2, '#6e4a2a');
    }
    const tx = 22 + Math.round(Math.sin(1.4) * 6 * flip) + 2, ty = 18;
    const frond = (ang, len) => {
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const x = tx + Math.cos(ang) * i;
        const y = ty + Math.sin(ang) * i + t * t * 10;
        px(g, Math.round(x), Math.round(y), 2, 2, '#3aa84a');
        if (i % 2 === 0) px(g, Math.round(x), Math.round(y) + 2, 1, 2, '#2f6f3a');
        if (i % 3 === 0) px(g, Math.round(x) + 1, Math.round(y) - 1, 1, 1, '#7cc35c');
      }
    };
    [-2.9, -2.3, -1.6, -0.9, -0.25, 0.4, 2.6].forEach((a, i) => frond(a, 16 + (i % 2) * 4));
    disc(g, tx, ty + 2, 2, '#6b4a2a'); disc(g, tx + 3, ty + 3, 2, '#5c3f22');
    IS.outline(c, '#1f3420');
    return c;
  };

  S.makeBush = (seed, berries) => {
    const r = IS.mulberry32(seed);
    const { c, g } = IS.makeCanvas(28, 20);
    disc(g, 9, 11, 7, '#3c7a3a'); disc(g, 18, 11, 7, '#3c7a3a'); disc(g, 14, 7, 6, '#3c7a3a');
    disc(g, 8, 9, 5, '#58a04a'); disc(g, 17, 9, 5, '#58a04a'); disc(g, 13, 5, 4, '#6fb558');
    if (berries) for (let i = 0; i < 6; i++) px(g, 5 + Math.floor(r() * 18), 5 + Math.floor(r() * 10), 2, 2, '#d8445a');
    IS.outline(c, '#1f3420');
    return c;
  };

  S.makeRock = seed => {
    const r = IS.mulberry32(seed);
    const { c, g } = IS.makeCanvas(22, 16);
    ellipse(g, 11, 9, 9, 6, '#8a8796');
    ellipse(g, 10, 7, 7, 4, '#a7a4b3');
    px(g, 6, 5, 3, 1, '#c9c6d4');
    if (r() < 0.5) px(g, 13, 10, 3, 1, '#6e6b7c');
    IS.outline(c, OUT);
    return c;
  };

  S.makeStump = () => {
    const { c, g } = IS.makeCanvas(20, 16);
    px(g, 3, 6, 14, 8, '#7a5232'); px(g, 3, 6, 3, 8, '#5e3d24');
    ellipse(g, 10, 6, 7, 3, '#c49a63'); ellipse(g, 10, 6, 4, 1, '#a57a48');
    IS.outline(c, OUT);
    return c;
  };

  S.makeFlowers = seed => {
    const r = IS.mulberry32(seed);
    const { c, g } = IS.makeCanvas(24, 24);
    const cols = ['#ffffff', '#f6d06b', '#f28aa8', '#b48be0', '#ff8f5a'];
    const n = 2 + Math.floor(r() * 3);
    const col = cols[Math.floor(r() * cols.length)];
    for (let i = 0; i < n; i++) {
      const x = 3 + Math.floor(r() * 16), y = 4 + Math.floor(r() * 14);
      px(g, x + 1, y + 2, 1, 3, '#3f8a3a');
      px(g, x, y, 3, 1, col); px(g, x + 1, y - 1, 1, 3, col);
      px(g, x + 1, y, 1, 1, '#f2b82e');
    }
    return c;
  };

  S.makeTuft = seed => {
    const r = IS.mulberry32(seed);
    const { c, g } = IS.makeCanvas(8, 6);
    const col = r() < 0.5 ? '#4f9a45' : '#5aa64c';
    px(g, 1, 2, 1, 4, col); px(g, 3, 0, 1, 6, col); px(g, 5, 2, 1, 4, col); px(g, 2, 3, 1, 3, col); px(g, 4, 1, 1, 5, '#7cc35c');
    return c;
  };

  // ------------------------------------------------------------------
  // Props
  // ------------------------------------------------------------------
  S.lamp = (() => {
    const { c, g } = IS.makeCanvas(12, 36);
    px(g, 5, 9, 2, 25, '#3b3346'); px(g, 3, 31, 6, 3, '#3b3346'); px(g, 5, 9, 1, 22, '#5a5068');
    px(g, 2, 2, 8, 7, '#3b3346'); px(g, 3, 3, 6, 5, '#ffe7a0'); px(g, 3, 3, 2, 2, '#fff8d8');
    px(g, 1, 1, 10, 2, '#4a4058');
    IS.outline(c, OUT);
    return c;
  })();

  S.bench = (() => {
    const { c, g } = IS.makeCanvas(28, 20);
    px(g, 2, 3, 24, 3, '#9a6a3c'); px(g, 2, 3, 24, 1, '#b8834f');
    px(g, 2, 9, 24, 4, '#a8763f'); px(g, 2, 9, 24, 1, '#c4935a');
    px(g, 4, 6, 2, 3, '#6e4a2c'); px(g, 22, 6, 2, 3, '#6e4a2c');
    px(g, 4, 13, 2, 5, '#5c3d24'); px(g, 22, 13, 2, 5, '#5c3d24');
    IS.outline(c, OUT);
    return c;
  })();

  S.well = (() => {
    const { c, g } = IS.makeCanvas(30, 38);
    // roof
    px(g, 2, 2, 26, 7, '#b5523b'); px(g, 2, 2, 26, 2, '#d0705a'); px(g, 2, 8, 26, 1, '#7d3526');
    px(g, 5, 9, 2, 14, '#6e4a2c'); px(g, 23, 9, 2, 14, '#6e4a2c');
    px(g, 7, 12, 16, 1, '#5c3d24'); px(g, 14, 12, 1, 6, '#c9b07a'); px(g, 12, 18, 5, 4, '#8a5a34');
    // stone body
    ellipse(g, 15, 25, 12, 4, '#3a4a6a');
    px(g, 3, 25, 25, 10, '#9a96a6');
    for (let y = 26; y < 35; y += 3) for (let x = 3 + ((y / 3) % 2) * 3; x < 27; x += 6) px(g, x, y, 1, 2, '#7a7688');
    px(g, 3, 25, 25, 1, '#c3bfcf');
    IS.outline(c, OUT);
    return c;
  })();

  S.noticeBoard = (() => {
    const { c, g } = IS.makeCanvas(26, 32);
    px(g, 4, 14, 2, 17, '#6e4a2c'); px(g, 20, 14, 2, 17, '#6e4a2c');
    px(g, 1, 2, 24, 16, '#8a5a34'); px(g, 3, 4, 20, 12, '#d9b77e');
    px(g, 5, 6, 7, 5, '#ffffff'); px(g, 14, 5, 7, 7, '#f6e3a8'); px(g, 6, 12, 6, 3, '#f2c1c9');
    px(g, 8, 6, 1, 1, '#e0405a'); px(g, 17, 5, 1, 1, '#4a8fe0');
    px(g, 1, 1, 24, 2, '#a8763f');
    IS.outline(c, OUT);
    return c;
  })();

  S.logSeat = (() => {
    const { c, g } = IS.makeCanvas(26, 12);
    px(g, 2, 3, 22, 7, '#8a5a34'); px(g, 2, 3, 22, 2, '#a8763f');
    ellipse(g, 2, 6, 2, 3, '#c49a63'); ellipse(g, 23, 6, 2, 3, '#c49a63');
    IS.outline(c, OUT);
    return c;
  })();

  S.firepit = (() => {
    const { c, g } = IS.makeCanvas(30, 18);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      disc(g, 15 + Math.round(Math.cos(a) * 11), 9 + Math.round(Math.sin(a) * 5), 2, i % 2 ? '#8a8796' : '#a7a4b3');
    }
    px(g, 9, 7, 12, 3, '#5c3d24'); px(g, 12, 5, 3, 7, '#6e4a2c'); px(g, 16, 6, 3, 6, '#5c3d24');
    IS.outline(c, OUT);
    return c;
  })();

  S.barrel = (() => {
    const { c, g } = IS.makeCanvas(14, 18);
    px(g, 2, 2, 10, 14, '#9a6a3c'); px(g, 2, 2, 3, 14, '#b8834f');
    px(g, 2, 4, 10, 1, '#4a4058'); px(g, 2, 12, 10, 1, '#4a4058');
    ellipse(g, 7, 2, 5, 1, '#c49a63');
    IS.outline(c, OUT);
    return c;
  })();

  S.crate = (() => {
    const { c, g } = IS.makeCanvas(16, 16);
    px(g, 1, 2, 14, 13, '#b8834f'); px(g, 1, 2, 14, 2, '#d0a066');
    px(g, 1, 8, 14, 1, '#8a5a34'); px(g, 7, 4, 2, 11, '#8a5a34');
    IS.outline(c, OUT);
    return c;
  })();

  S.signpost = (() => {
    const { c, g } = IS.makeCanvas(22, 30);
    px(g, 10, 8, 2, 21, '#6e4a2c');
    px(g, 2, 3, 16, 6, '#b8834f'); px(g, 18, 4, 2, 4, '#b8834f');
    px(g, 4, 11, 16, 5, '#a8763f'); px(g, 2, 12, 2, 3, '#a8763f');
    px(g, 4, 5, 10, 1, '#6e4a2c'); px(g, 7, 13, 10, 1, '#6e4a2c');
    IS.outline(c, OUT);
    return c;
  })();

  S.lighthouse = (() => {
    const { c, g } = IS.makeCanvas(40, 100);
    // tower (tapered)
    for (let y = 26; y < 96; y++) {
      const t = (y - 26) / 70;
      const hw = Math.round(9 + t * 6);
      const band = Math.floor((y - 26) / 12) % 2 === 0;
      const col = band ? '#f4efe6' : '#d9534f';
      px(g, 20 - hw, y, hw * 2, 1, col);
      px(g, 20 - hw, y, 2, 1, band ? '#ffffff' : '#ef7a74');
      px(g, 20 + hw - 3, y, 3, 1, band ? '#cfc6b8' : '#a83a37');
    }
    px(g, 17, 82, 6, 13, '#5c3d24'); px(g, 17, 82, 6, 2, '#6e4a2c');
    px(g, 18, 50, 4, 5, '#3a4a6a'); px(g, 18, 66, 4, 5, '#3a4a6a');
    // gallery + lantern room
    px(g, 7, 22, 26, 4, '#3b3346'); px(g, 7, 22, 26, 1, '#5a5068');
    px(g, 11, 10, 18, 12, '#ffe7a0'); px(g, 11, 10, 2, 12, '#3b3346'); px(g, 19, 10, 2, 12, '#3b3346'); px(g, 27, 10, 2, 12, '#3b3346');
    px(g, 13, 11, 3, 4, '#fff8d8');
    px(g, 9, 6, 22, 4, '#d9534f'); px(g, 12, 3, 16, 3, '#d9534f'); px(g, 18, 0, 4, 3, '#3b3346');
    px(g, 12, 3, 16, 1, '#ef7a74');
    IS.outline(c, OUT);
    return c;
  })();

  S.boat = (() => {
    const { c, g } = IS.makeCanvas(80, 66);
    // mast + sail
    px(g, 38, 4, 3, 44, '#6e4a2c');
    for (let y = 8; y < 42; y++) {
      const w = Math.round(((y - 8) / 34) * 26);
      px(g, 41, y, w, 1, '#f4efe6');
      if (w > 2) px(g, 41 + w - 2, y, 2, 1, '#d8cfc0');
    }
    px(g, 30, 4, 8, 6, '#d9534f'); // flag
    // cabin
    px(g, 16, 38, 20, 12, '#e8d8b8'); px(g, 16, 38, 20, 2, '#c9534f'); px(g, 20, 42, 5, 4, '#7fb6d6'); px(g, 28, 42, 5, 4, '#7fb6d6');
    // hull
    for (let y = 48; y < 62; y++) {
      const inset = Math.round(((y - 48) / 14) ** 2 * 10);
      px(g, 4 + inset, y, 72 - inset * 2, 1, y < 52 ? '#3e5c8a' : '#2f4870');
    }
    px(g, 4, 48, 72, 2, '#f4efe6'); px(g, 6, 53, 68, 1, '#d9534f');
    px(g, 56, 44, 8, 5, '#b8834f'); px(g, 64, 45, 6, 4, '#a8763f');
    IS.outline(c, OUT);
    return c;
  })();

  S.bottle = (() => {
    const { c, g } = IS.makeCanvas(12, 10);
    px(g, 1, 3, 7, 5, '#7ec6a0'); px(g, 8, 4, 2, 3, '#7ec6a0'); px(g, 10, 4, 1, 3, '#8a5a34');
    px(g, 3, 4, 4, 2, '#f4efe6'); px(g, 2, 3, 3, 1, '#c8f0dc');
    IS.outline(c, OUT);
    return c;
  })();

  S.blanket = (() => {
    const { c, g } = IS.makeCanvas(56, 40);
    for (let y = 0; y < 36; y++) for (let x = 0; x < 52; x++) {
      const a = (Math.floor(x / 6) + Math.floor(y / 6)) % 2;
      const b = Math.floor(x / 6) % 2 && Math.floor(y / 6) % 2;
      px(g, x + 2, y + 2, 1, 1, b ? '#c9384a' : a ? '#e05a6a' : '#f8eadb');
    }
    px(g, 8, 10, 10, 8, '#b8834f'); px(g, 8, 10, 10, 2, '#d0a066'); // basket
    px(g, 34, 22, 6, 5, '#f6d06b'); px(g, 42, 12, 5, 5, '#e0405a');
    return c;
  })();

  S.dolphin = [0, 1, 2].map(f => {
    const { c, g } = IS.makeCanvas(22, 16);
    const yoff = [6, 2, 6][f];
    const rot = [-1, 0, 1][f];
    for (let i = 0; i < 16; i++) {
      const y = yoff + Math.round(rot * (i - 8) * 0.4) + (i > 3 && i < 13 ? 0 : 1);
      px(g, 3 + i, y, 1, 4 - (i < 2 || i > 13 ? 2 : 0), '#6d8fb5');
      px(g, 3 + i, y + 3, 1, 1, '#c9d9ea');
    }
    px(g, 10, yoff - 2, 2, 2, '#6d8fb5');
    px(g, 15, yoff + 1, 1, 1, '#1d1530');
    IS.outline(c, OUT);
    return c;
  });

  S.gull = [0, 1].map(f => {
    const { c, g } = IS.makeCanvas(14, 8);
    if (f === 0) { px(g, 1, 2, 5, 1, '#ffffff'); px(g, 8, 2, 5, 1, '#ffffff'); px(g, 1, 1, 2, 1, '#4a4058'); px(g, 11, 1, 2, 1, '#4a4058'); }
    else { px(g, 1, 4, 5, 1, '#ffffff'); px(g, 8, 4, 5, 1, '#ffffff'); px(g, 1, 5, 2, 1, '#4a4058'); px(g, 11, 5, 2, 1, '#4a4058'); }
    px(g, 5, 3, 4, 2, '#ffffff'); px(g, 9, 3, 1, 1, '#f2b82e');
    IS.outline(c, '#4a4058');
    return c;
  });

  // Crops: 4 growth stages x 3 kinds
  S.crops = {};
  for (const kind of ['tomato', 'carrot', 'cabbage']) {
    S.crops[kind] = [0, 1, 2, 3].map(stage => {
      const { c, g } = IS.makeCanvas(18, 18);
      if (stage === 0) { px(g, 7, 13, 2, 1, '#5c3d24'); px(g, 10, 12, 1, 1, '#5c3d24'); return c; }
      const leaf = '#4f9a45', leafL = '#7cc35c';
      if (stage >= 1) { px(g, 8, 10, 1, 5, leaf); px(g, 6, 10, 2, 2, leafL); px(g, 9, 9, 2, 2, leafL); }
      if (stage >= 2) { disc(g, 8, 8, 4, leaf); disc(g, 7, 7, 2, leafL); }
      if (stage === 3) {
        if (kind === 'tomato') { disc(g, 5, 10, 2, '#e0405a'); disc(g, 11, 8, 2, '#e0405a'); disc(g, 9, 12, 2, '#d9343f'); }
        if (kind === 'carrot') { px(g, 6, 12, 5, 3, '#f08a3a'); px(g, 6, 12, 5, 1, '#ffb066'); }
        if (kind === 'cabbage') { disc(g, 8, 9, 5, '#9ed26a'); disc(g, 8, 9, 3, '#c4e88e'); }
      }
      IS.outline(c, '#1f3420');
      return c;
    });
  }

  // ------------------------------------------------------------------
  // Buildings
  // ------------------------------------------------------------------
  // Footprint w x h tiles. Canvas is padded 4px left/right and 18px on top
  // for the roof overhang. Facade = bottom 44px of the footprint.
  S.makeBuilding = opt => {
    const T = IS.TILE;
    const W = opt.w * T + 8, H = opt.h * T + 18;
    const { c, g } = IS.makeCanvas(W, H);
    const roof = opt.roof, wall = opt.wall, trim = opt.trim || '#6e4a2c';
    const facadeTop = H - 44;
    const roofBottom = facadeTop + 6;

    // Facade
    px(g, 4, facadeTop, W - 8, 44, wall);
    for (let y = facadeTop + 4; y < H - 5; y += 5) px(g, 4, y, W - 8, 1, IS.shade(wall, -0.08));
    px(g, 4, facadeTop + 6, W - 8, 4, IS.shade(wall, -0.22));
    px(g, 4, facadeTop, 4, 44, trim); px(g, W - 8, facadeTop, 4, 44, trim);
    px(g, 4, H - 5, W - 8, 5, opt.stone ? '#8f8a9c' : '#9a96a6');
    for (let x = 6; x < W - 6; x += 7) px(g, x, H - 5, 1, 5, '#6e6b7c');

    const windows = [];
    for (const col of opt.windows || []) {
      const wx = 4 + col * T + 5, wy = facadeTop + 13;
      px(g, wx - 1, wy - 1, 16, 14, trim);
      px(g, wx, wy, 14, 12, '#9ccbe0');
      px(g, wx, wy, 14, 3, '#c8e6f2');
      px(g, wx + 6, wy, 2, 12, trim); px(g, wx, wy + 5, 14, 2, trim);
      px(g, wx - 2, wy + 12, 18, 3, IS.shade(trim, 0.1)); // sill
      if (opt.flowerBoxes) { px(g, wx - 1, wy + 14, 16, 3, '#8a5a34'); for (let i = 0; i < 4; i++) px(g, wx + i * 4, wy + 12, 2, 2, ['#f28aa8', '#f6d06b', '#ffffff', '#b48be0'][i]); }
      windows.push({ x: wx, y: wy, w: 14, h: 12 });
    }
    const doors = [];
    const dcols = opt.doors || [];
    if (dcols.length) {
      const x0 = 4 + dcols[0] * T + 4;
      const dw = dcols.length * T - 8;
      const dy = H - 31;
      px(g, x0 - 2, dy - 2, dw + 4, 28, trim);
      px(g, x0, dy, dw, 26, '#8a5a34');
      for (let x = x0 + 3; x < x0 + dw - 2; x += 5) px(g, x, dy + 2, 1, 22, '#6e4a2c');
      if (dcols.length > 1) px(g, x0 + dw / 2 - 1, dy, 2, 26, trim);
      px(g, x0 + dw - 4, dy + 13, 2, 2, '#f2b82e');
      if (dcols.length > 1) px(g, x0 + 2, dy + 13, 2, 2, '#f2b82e');
      px(g, x0 - 3, H - 4, dw + 6, 4, '#c4bdac'); // doorstep
      doors.push({ x: x0, y: dy, w: dw, h: 26 });
    }

    // Roof with shingle rows
    for (let y = 0; y < roofBottom; y++) {
      const row = Math.floor(y / 6);
      const base = row % 2 ? IS.shade(roof, -0.07) : roof;
      px(g, 0, y, W, 1, base);
      if (y % 6 < 3) {
        for (let x = (row % 2) * 4; x < W; x += 8) px(g, x, y, 1, 1, IS.shade(roof, -0.25));
      }
    }
    px(g, 0, 0, W, 3, IS.shade(roof, 0.28));
    px(g, 0, roofBottom - 3, W, 3, IS.shade(roof, -0.4));
    px(g, 0, 0, 2, roofBottom, IS.shade(roof, 0.15));
    px(g, W - 2, 0, 2, roofBottom, IS.shade(roof, -0.3));
    if (opt.chimney) {
      const cx = W - 34;
      px(g, cx, 2, 10, 14, '#a85a46'); px(g, cx - 1, 1, 12, 3, '#7d3d2e');
      px(g, cx + 2, 6, 3, 1, '#7d3d2e'); px(g, cx + 5, 10, 3, 1, '#7d3d2e');
    }
    if (opt.bell) {
      const bx = W / 2 - 10;
      px(g, bx, 0, 20, 4, IS.shade(roof, -0.3));
      px(g, bx + 3, 4, 2, 12, trim); px(g, bx + 15, 4, 2, 12, trim);
      disc(g, bx + 10, 10, 4, '#f2b82e'); px(g, bx + 9, 13, 2, 2, '#c48a1e');
    }
    if (opt.sign) {
      const sx = W / 2 - 18, sy = facadeTop - 2;
      px(g, sx, sy, 36, 9, '#6e4a2c'); px(g, sx + 1, sy + 1, 34, 7, '#d9b77e');
      for (let i = 0; i < 5; i++) px(g, sx + 5 + i * 6, sy + 3, 3, 3, '#8a5a34');
    }

    IS.outline(c, OUT);
    return { canvas: c, windows, doors, w: W, h: H };
  };

  // Interior floor plan for cutaway view, plus the low front wall that is
  // drawn in the depth-sorted pass.
  S.makeInterior = (b, furniture) => {
    const T = IS.TILE;
    const W = b.w * T + 8, H = b.h * T + 18;
    const { c, g } = IS.makeCanvas(W, H);
    const ox = 4, oy = 18;
    const beam = '#6e4a2c', beamL = '#8a5a34';
    // Walls seen from above
    px(g, ox, oy - 18, b.w * T, b.h * T + 18, beam);
    for (let y = 0; y < H; y += 8) px(g, ox, y, b.w * T, 1, beamL);
    // Floor
    const fx = ox + T, fy = oy + T, fw = (b.w - 2) * T, fh = (b.h - 2) * T;
    const plank = b.kind === 'hall' ? '#c08a55' : '#b98552';
    px(g, fx, fy, fw, fh + T, plank);
    for (let y = fy; y < fy + fh + T; y += 6) {
      px(g, fx, y, fw, 1, IS.shade(plank, -0.2));
      for (let x = fx + ((y / 6) % 2) * 12; x < fx + fw; x += 24) px(g, x, y, 1, 6, IS.shade(plank, -0.15));
    }
    // Back wall face
    const paper = b.kind === 'hall' ? '#e8d2a8' : b.wallpaper || '#efdcc0';
    px(g, fx, oy - 6, fw, T + 6, paper);
    for (let x = fx + 4; x < fx + fw; x += 8) px(g, x, oy - 6, 2, T + 6, IS.shade(paper, -0.06));
    px(g, fx, oy + T - 8, fw, 8, IS.shade(beam, 0.1));
    px(g, fx, oy - 8, fw, 2, beam);
    // Shadow under back wall
    px(g, fx, oy + T, fw, 3, 'rgba(40,20,30,0.25)');

    for (const f of furniture) drawFurniture(g, f, ox, oy);
    IS.outline(c, OUT);

    // Front low wall (bottom footprint row) with door gap
    const fr = IS.makeCanvas(W, T + 6);
    const fg = fr.g;
    px(fg, ox, 6, b.w * T, T, beam);
    px(fg, ox, 6, b.w * T, 3, beamL);
    for (const dc of b.doorCols) {
      fg.clearRect(ox + dc * T, 0, T, T + 6);
    }
    IS.outline(fr.c, OUT);
    return { canvas: c, front: fr.c };
  };

  function drawFurniture(g, f, ox, oy) {
    const T = IS.TILE;
    const x = ox + f.c * T, y = oy + f.r * T;
    switch (f.type) {
      case 'bed': {
        const blanket = f.color || '#6a8fc9';
        px(g, x + 2, y - 4, 20, 46, '#8a5a34');
        px(g, x + 3, y - 3, 18, 44, '#f4efe6');
        px(g, x + 5, y - 1, 14, 8, '#ffffff'); px(g, x + 5, y + 6, 14, 1, '#d8cfc0');
        px(g, x + 3, y + 10, 18, 30, blanket);
        px(g, x + 3, y + 10, 18, 3, IS.shade(blanket, 0.25));
        for (let i = 0; i < 3; i++) px(g, x + 3, y + 18 + i * 8, 18, 1, IS.shade(blanket, -0.2));
        break;
      }
      case 'stove':
        px(g, x + 2, y - 10, 20, 26, '#4a4058'); px(g, x + 2, y - 10, 20, 3, '#6a5f7a');
        px(g, x + 6, y - 2, 12, 8, '#2a2135'); px(g, x + 8, y, 8, 4, '#e0763a');
        px(g, x + 6, y - 16, 10, 7, '#9a96a6'); px(g, x + 6, y - 16, 10, 2, '#c3bfcf');
        break;
      case 'shelf':
        px(g, x + 2, y - 18, 20, 32, '#8a5a34');
        for (let i = 0; i < 3; i++) {
          px(g, x + 3, y - 16 + i * 10, 18, 8, '#5c3d24');
          for (let j = 0; j < 5; j++) px(g, x + 4 + j * 3, y - 15 + i * 10, 2, 7, ['#d9534f', '#4a8fe0', '#f2b82e', '#5fae4a', '#c46bd6'][(i + j) % 5]);
        }
        break;
      case 'table':
        px(g, x + 2, y + 2, f.w * T - 4, 18, '#a8763f');
        px(g, x + 2, y + 2, f.w * T - 4, 3, '#c4935a');
        px(g, x + 4, y + 20, 3, 4, '#6e4a2c'); px(g, x + f.w * T - 7, y + 20, 3, 4, '#6e4a2c');
        if (f.cloth) { px(g, x + 6, y + 3, f.w * T - 12, 14, '#f4efe6'); for (let i = 0; i < f.w; i++) px(g, x + 10 + i * T, y + 8, 6, 4, '#e0d8c8'); }
        break;
      case 'chair':
        px(g, x + 7, y + 6, 10, 10, '#9a6a3c'); px(g, x + 7, y + 6, 10, 2, '#b8834f');
        break;
      case 'armchair':
        px(g, x + 3, y, 18, 18, f.color || '#7a5c9e'); px(g, x + 3, y, 18, 6, IS.shade(f.color || '#7a5c9e', -0.2));
        px(g, x + 6, y + 6, 12, 9, IS.shade(f.color || '#7a5c9e', 0.15));
        break;
      case 'rug':
        px(g, x + 2, y + 3, f.w * T - 4, 18, f.color || '#c9534f');
        px(g, x + 5, y + 6, f.w * T - 10, 12, IS.shade(f.color || '#c9534f', 0.2));
        px(g, x + 8, y + 9, f.w * T - 16, 6, f.color || '#c9534f');
        break;
      case 'plant':
        px(g, x + 8, y + 10, 8, 8, '#b5523b');
        disc(g, x + 12, y + 5, 6, '#4f9a45'); disc(g, x + 10, y + 3, 3, '#7cc35c');
        break;
      case 'counter':
        px(g, x + 1, y - 8, f.w * T - 2, 22, '#8a5a34'); px(g, x + 1, y - 8, f.w * T - 2, 4, '#d9cfc0');
        px(g, x + 6, y - 16, 8, 8, '#9a96a6'); px(g, x + 20, y - 14, 10, 6, '#e8d8b8'); px(g, x + 40, y - 15, 6, 7, '#5fae4a');
        break;
      case 'fireplace':
        px(g, x, y - 22, f.w * T, 36, '#9a96a6');
        for (let yy = y - 20; yy < y + 12; yy += 5) for (let xx = x + ((yy / 5) % 2) * 4; xx < x + f.w * T; xx += 8) px(g, xx, yy, 1, 4, '#7a7688');
        px(g, x + 8, y - 6, f.w * T - 16, 18, '#2a2135');
        px(g, x - 2, y - 24, f.w * T + 4, 4, '#6e4a2c');
        break;
    }
  }

  return S;
})();
