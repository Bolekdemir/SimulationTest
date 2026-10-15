// Isometric projection and procedural isometric art (buildings, interiors,
// boxes, stalls, fences...). The simulation still thinks in a flat tile grid;
// only drawing goes through this projection.
//
// Grid (gx, gy) in tiles -> iso pixels:
//   x = (gx - gy) * 16 + OX
//   y = (gx + gy) * 8  + OY
// Light comes from the upper left: south-facing ("left") faces are sunlit and
// warm, east-facing ("right") faces are in cool blue-violet shade.
IS.Iso = (() => {
  const I = { HW: 16, HH: 8 };

  I.setup = world => {
    I.OX = world.H * 16 + 64;
    I.OY = 140;
    I.W = (world.W + world.H) * 16 + 128;
    I.H = (world.W + world.H) * 8 + 220;
  };
  I.g2s = (gx, gy) => ({ x: (gx - gy) * 16 + I.OX, y: (gx + gy) * 8 + I.OY });
  I.w2s = (x, y) => I.g2s(x / IS.TILE, (y - 6) / IS.TILE);
  I.s2g = (sx, sy) => {
    const u = (sx - I.OX) / 16, v = (sy - I.OY) / 8;
    return { gx: (u + v) / 2, gy: (v - u) / 2 };
  };
  I.s2w = (sx, sy) => { const g = I.s2g(sx, sy); return { x: g.gx * IS.TILE, y: g.gy * IS.TILE + 6 }; };

  // Warm light / cool shade colour ramps
  I.lit = (hex, a = 0.12) => IS.mix(hex, '#fff0c8', a);
  I.shade = (hex, a = 0.3) => IS.mix(hex, '#3a3070', a);
  I.deep = (hex, a = 0.5) => IS.mix(hex, '#241a48', a);

  const poly = (g, pts, col) => {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    g.closePath();
    g.fill();
  };
  I.poly = poly;
  const up = (p, h) => ({ x: p.x, y: p.y - h });
  I.up = up;

  // Draw inside a parallelogram: u runs P0->P1, v runs P0->P3, both 0..1
  const plane = (g, P0, P1, P3, fn) => {
    g.save();
    g.setTransform(P1.x - P0.x, P1.y - P0.y, P3.x - P0.x, P3.y - P0.y, P0.x, P0.y);
    fn(g);
    g.restore();
  };
  I.plane = plane;

  // Snap anti-aliased edges to hard pixels, then outline: polygon art becomes pixel art
  I.crisp = (c, outlineCol = '#2a1f40') => {
    const g = c.getContext('2d');
    const img = g.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 110 ? 255 : 0;
    g.putImageData(img, 0, 0);
    if (outlineCol) IS.outline(c, outlineCol);
    return c;
  };

  // An axis-aligned box on the grid. L(gx, gy) maps grid coords to canvas coords.
  I.box = (g, L, gx, gy, w, d, h, cols, z = 0) => {
    const N = up(L(gx, gy), z), E = up(L(gx + w, gy), z), S = up(L(gx + w, gy + d), z), W = up(L(gx, gy + d), z);
    poly(g, [W, S, up(S, h), up(W, h)], cols.left);
    poly(g, [S, E, up(E, h), up(S, h)], cols.right);
    poly(g, [up(N, h), up(E, h), up(S, h), up(W, h)], cols.top);
    return { N, E, S, W };
  };
  const boxCols = (base, top) => ({ top: top || I.lit(base, 0.18), left: I.lit(base, 0.05), right: I.shade(base, 0.32) });
  I.boxCols = boxCols;

  // ---------------------------------------------------------------- props
  // Single-tile prop canvas: the tile centre sits at (cx, cy) in the canvas.
  I.prop = (w, h, cx, cy, draw, outline = '#2a1f40') => {
    const { c, g } = IS.makeCanvas(w, h);
    const L = (gx, gy) => ({ x: cx + (gx - gy) * 16, y: cy + (gx + gy) * 8 });
    draw(g, L);
    I.crisp(c, outline);
    return { canvas: c, ax: cx, ay: cy };
  };

  // A wooden crate with planks and a cross brace on both visible faces
  const crateAt = (g, L, gx, gy, s, h, z = 0) => {
    const b = I.box(g, L, gx, gy, s, s, h, { top: '#f0c080', left: '#dc9c58', right: '#9a6a5a' }, z);
    const brace = (P0, P1, col) => plane(g, up(P0, z), up(P1, z), up(P0, z + h), f => {
      f.fillStyle = col;
      f.fillRect(0, 0, 1, 0.12); f.fillRect(0, 0.88, 1, 0.12); f.fillRect(0, 0, 0.12, 1); f.fillRect(0.88, 0, 0.12, 1);
      for (let i = 0; i < 10; i++) f.fillRect(0.1 + i * 0.08, 0.1 + i * 0.08, 0.1, 0.1);
    });
    brace(b.W, b.S, '#a8683a');
    brace(b.S, b.E, '#6a4248');
  };
  I.crate = () => I.prop(40, 44, 20, 34, (g, L) => crateAt(g, L, -0.32, -0.32, 0.64, 13));
  I.crateStack = () => I.prop(56, 56, 28, 42, (g, L) => {
    crateAt(g, L, -0.55, -0.2, 0.55, 12);
    crateAt(g, L, 0.05, -0.2, 0.5, 11);
    crateAt(g, L, -0.4, -0.15, 0.5, 11, 12);
  });
  I.barrel = () => I.prop(32, 40, 16, 30, (g, L) => {
    const c = L(0, 0);
    g.fillStyle = '#a8663a'; g.fillRect(c.x - 6, c.y - 15, 12, 15);
    g.fillStyle = '#c47e48'; g.fillRect(c.x - 6, c.y - 15, 5, 15);
    g.fillStyle = '#5a3a5a'; g.fillRect(c.x - 6, c.y - 12, 12, 1); g.fillRect(c.x - 6, c.y - 4, 12, 1);
    g.fillStyle = '#d9a46a'; g.beginPath(); g.ellipse(c.x, c.y - 15, 6, 3, 0, 0, Math.PI * 2); g.fill();
  });
  I.flowerBed = (seed, along) => I.prop(56, 44, 28, 30, (g, L) => {
    const r = IS.mulberry32(seed);
    const [w, d] = along === 'y' ? [0.6, 1] : [1, 0.6];
    const b = I.box(g, L, -w / 2, -d / 2, w, d, 6, boxCols('#a0603a', '#76a234'));
    const cols = ['#ff7aa8', '#ffd060', '#ffffff', '#c58aff', '#ff9a58'];
    for (let i = 0; i < 14; i++) {
      const p = L(-w / 2 + r() * w, -d / 2 + r() * d);
      g.fillStyle = cols[Math.floor(r() * cols.length)];
      g.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 9, 2, 2);
      g.fillStyle = '#3f8a3a'; g.fillRect(Math.round(p.x), Math.round(p.y) - 7, 1, 2);
    }
  }, '#2a1f40');
  I.hedge = (seed, along) => I.prop(56, 50, 28, 32, (g, L) => {
    const r = IS.mulberry32(seed);
    const [w, d] = along === 'y' ? [0.7, 1] : [1, 0.7];
    I.box(g, L, -w / 2, -d / 2, w, d, 14, { top: '#9cb83c', left: '#6e9230', right: '#3e5a32' });
    for (let i = 0; i < 26; i++) {
      const p = L(-w / 2 + r() * w, -d / 2 + r() * d);
      g.fillStyle = r() < 0.5 ? '#d2d050' : '#46682a';
      g.fillRect(Math.round(p.x), Math.round(p.y) - 14 - Math.floor(r() * 2), 2, 1);
    }
  });
  I.fence = along => I.prop(48, 44, 24, 30, (g, L) => {
    const wood = '#d4a066', dark = '#8a5a3a';
    const pts = along === 'y' ? [[0, -0.5], [0, 0], [0, 0.5]] : [[-0.5, 0], [0, 0], [0.5, 0]];
    for (const [a, b] of pts) { const p = L(a, b); g.fillStyle = dark; g.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 13, 3, 13); g.fillStyle = wood; g.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 13, 2, 12); }
    const a0 = along === 'y' ? L(0, -0.5) : L(-0.5, 0), a1 = along === 'y' ? L(0, 0.5) : L(0.5, 0);
    for (const h of [10, 5]) { g.strokeStyle = wood; g.lineWidth = 2; g.beginPath(); g.moveTo(a0.x, a0.y - h); g.lineTo(a1.x, a1.y - h); g.stroke(); }
  });
  I.stall = (seed, colA = '#e8584a') => I.prop(72, 84, 36, 60, (g, L) => {
    const colB = '#fff2dc';
    // counter
    const b = I.box(g, L, -0.75, -0.4, 1.5, 0.8, 13, boxCols('#b9784a', '#e6c08a'));
    // produce on the counter
    const r = IS.mulberry32(seed);
    for (let i = 0; i < 9; i++) { const p = L(-0.6 + r() * 1.2, -0.3 + r() * 0.5); g.fillStyle = ['#ff6a5a', '#ffb84a', '#8ad050', '#ffe070'][i % 4]; g.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 16, 3, 2); }
    // posts
    for (const [x, y] of [[-0.75, 0.4], [0.75, 0.4], [0.75, -0.4], [-0.75, -0.4]]) { const p = L(x, y); g.fillStyle = '#6a4030'; g.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 34, 2, 34); }
    // striped awning sloping down toward the front
    const A0 = up(L(-0.85, -0.5), 36), A1 = up(L(0.85, -0.5), 36), A3 = up(L(-0.85, 0.55), 28);
    plane(g, A0, A1, A3, g2 => { for (let i = 0; i < 8; i++) { g2.fillStyle = i % 2 ? colB : colA; g2.fillRect(i / 8, 0, 1 / 8 + 0.002, 1); } });
    const F0 = up(L(-0.85, 0.55), 28), F1 = up(L(0.85, 0.55), 28);
    plane(g, F0, F1, { x: F0.x, y: F0.y + 5 }, g2 => { for (let i = 0; i < 8; i++) { g2.fillStyle = i % 2 ? colB : colA; g2.fillRect(i / 8, 0, 1 / 8 + 0.002, 1); } });
  });
  I.umbrella = (seed, col = '#ff6a7a') => I.prop(56, 64, 28, 54, (g, L) => {
    const c = L(0, 0);
    g.fillStyle = '#f4efe6'; g.fillRect(c.x, c.y - 34, 2, 34);
    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * Math.PI * 2, a1 = ((i + 1) / 8) * Math.PI * 2;
      poly(g, [{ x: c.x + 1, y: c.y - 44 }, { x: c.x + 1 + Math.cos(a0) * 20, y: c.y - 32 + Math.sin(a0) * 9 }, { x: c.x + 1 + Math.cos(a1) * 20, y: c.y - 32 + Math.sin(a1) * 9 }], i % 2 ? '#fff6e6' : col);
    }
  });
  I.lounger = () => I.prop(56, 40, 28, 26, (g, L) => {
    I.box(g, L, -0.35, -0.6, 0.7, 1.2, 4, boxCols('#d4a066'));
    I.box(g, L, -0.3, -0.55, 0.6, 0.45, 6, boxCols('#5ab8e0', '#8ad8f8'), 4);
  });
  I.planter = (seed) => I.prop(36, 44, 18, 34, (g, L) => {
    I.box(g, L, -0.22, -0.22, 0.44, 0.44, 8, boxCols('#c8643e'));
    const c = L(0, 0);
    IS.Sprites.disc(g, c.x, c.y - 14, 6, '#3f9a4a'); IS.Sprites.disc(g, c.x - 2, c.y - 16, 3, '#8fd65a');
    if (seed % 2) { g.fillStyle = '#ff8ab0'; g.fillRect(c.x + 2, c.y - 18, 2, 2); g.fillRect(c.x - 4, c.y - 13, 2, 2); }
  });
  I.mailbox = () => I.prop(32, 44, 16, 34, (g, L) => {
    const c = L(0, 0);
    g.fillStyle = '#6a4030'; g.fillRect(c.x - 1, c.y - 14, 2, 14);
    I.box(g, (gx, gy) => ({ x: c.x + (gx - gy) * 16, y: c.y - 14 + (gx + gy) * 8 }), -0.15, -0.25, 0.3, 0.5, 8, boxCols('#4a7ad8'));
  });
  I.bench = along => I.prop(56, 44, 28, 30, (g, L) => {
    const [w, d] = along === 'y' ? [0.4, 1.1] : [1.1, 0.4];
    const leg = boxCols('#6a4030');
    for (const [a, b] of [[0.05, 0.05], [w - 0.13, 0.05], [0.05, d - 0.13], [w - 0.13, d - 0.13]]) I.box(g, L, -w / 2 + a, -d / 2 + b, 0.08, 0.08, 5, leg);
    if (along === 'y') I.box(g, L, -w / 2, -d / 2, 0.08, d, 7, boxCols('#c88a50'), 5);
    else I.box(g, L, -w / 2, -d / 2, w, 0.08, 7, boxCols('#c88a50'), 5);
    I.box(g, L, -w / 2, -d / 2, w, d, 2, boxCols('#e0a464'), 5);
  });
  I.logSeat = along => I.prop(56, 40, 28, 28, (g, L) => {
    const [w, d] = along === 'y' ? [0.45, 1.1] : [1.1, 0.45];
    I.box(g, L, -w / 2, -d / 2, w, d, 7, { top: '#c8925a', left: '#8a5a34', right: '#5e3a2e' });
  });

  // ---------------------------------------------------------------- buildings
  // Returns canvases in iso space plus window polygons for night lighting.
  I.building = b => {
    const hall = b.kind === 'hall';
    const deco = b.deco;
    const WH = hall ? 46 : deco === 'shed' ? 26 : 36;
    const RH = hall ? 30 : deco === 'greenhouse' ? 18 : 24;
    const x0 = b.x0, y0 = b.y0, x1 = b.x0 + b.w, y1 = b.y0 + b.h; // exclusive far edges
    const ov = 0.28;
    const g2s = I.g2s;
    const minX = g2s(x0 - ov, y1 + ov).x - 6, maxX = g2s(x1 + ov, y0 - ov).x + 6;
    const minY = g2s(x0 - ov, y0 - ov).y - WH - RH - 30, maxY = g2s(x1, y1).y + 6;
    const cw = Math.ceil(maxX - minX), ch = Math.ceil(maxY - minY);
    const L = (gx, gy) => { const p = g2s(gx, gy); return { x: p.x - minX, y: p.y - minY }; };
    const out = { ox: minX, oy: minY, w: cw, h: ch, windows: [], doors: [], WH };

    const wall = b.wall, roof = b.roof, trim = b.trim || '#7a4a3a';
    const wallLit = I.lit(wall, 0.1), wallShade = I.shade(wall, 0.34);
    const ridgeAlongX = b.w >= b.h;

    const ext = IS.makeCanvas(cw, ch).c, g = ext.getContext('2d');
    g.imageSmoothingEnabled = false;
    const N = L(x0, y0), E = L(x1, y0), S = L(x1, y1), W = L(x0, y1);

    // Walls: south face (sunlit) and east face (shade), with plank lines
    const isGlass = deco === 'greenhouse';
    const faceS = (fn) => plane(g, W, S, up(W, WH), fn);
    const faceE = (fn) => plane(g, S, E, up(S, WH), fn);
    faceS(f => {
      f.fillStyle = isGlass ? '#9fe0e8' : wallLit; f.fillRect(0, 0, 1, 1);
      f.fillStyle = isGlass ? '#d8f6f8' : I.lit(wall, 0.25);
      for (let i = 1; i < 9; i++) f.fillRect(0, i / 9, 1, 0.012);
      f.fillStyle = '#8f86a8'; f.fillRect(0, 0, 1, 0.1); // stone footing
    });
    faceE(f => {
      f.fillStyle = isGlass ? '#6fb0c8' : wallShade; f.fillRect(0, 0, 1, 1);
      f.fillStyle = I.shade(wall, 0.42);
      for (let i = 1; i < 9; i++) f.fillRect(0, i / 9, 1, 0.012);
      f.fillStyle = '#5e5680'; f.fillRect(0, 0, 1, 0.1);
    });
    // corner posts
    for (const P of [W, S, E]) { g.fillStyle = trim; g.fillRect(Math.round(P.x) - 1, Math.round(P.y) - WH, 3, WH); }

    // Windows and doors on the south face
    const winRect = (P0, P1, P3) => [P0, P1, { x: P1.x + P3.x - P0.x, y: P1.y + P3.y - P0.y }, P3];
    const winOnS = (u0, u1, v0, v1) => {
      const A = L(x0 + u0, y1), B = L(x0 + u1, y1);
      const q = winRect(up(A, v0), up(B, v0), up(A, v1));
      poly(g, q.map(p => ({ x: p.x, y: p.y })), trim);
      const inset = winRect(up(L(x0 + u0 + 0.05, y1), v0 + 2), up(L(x0 + u1 - 0.05, y1), v0 + 2), up(L(x0 + u0 + 0.05, y1), v1 - 2));
      poly(g, inset, '#5a6aa8');
      out.windows.push({ pts: inset.map(p => ({ x: p.x + minX, y: p.y + minY })), face: 's' });
    };
    const winOnE = (u0, u1, v0, v1) => {
      const A = L(x1, y1 - u0), B = L(x1, y1 - u1);
      poly(g, winRect(up(A, v0), up(B, v0), up(A, v1)), I.shade(trim, 0.3));
      const inset = winRect(up(L(x1, y1 - u0 - 0.05), v0 + 2), up(L(x1, y1 - u1 + 0.05), v0 + 2), up(L(x1, y1 - u0 - 0.05), v1 - 2));
      poly(g, inset, '#4a5890');
      out.windows.push({ pts: inset.map(p => ({ x: p.x + minX, y: p.y + minY })), face: 'e' });
    };
    const wTop = WH - 8, wBot = Math.max(12, WH - 24);
    const doorCols = b.doorCols || [];
    for (let c = 0; c < b.w; c++) {
      if (doorCols.includes(c) || (c === 0) || c === b.w - 1) continue;
      if (isGlass) continue;
      winOnS(c + 0.18, c + 0.82, wBot, wTop);
      if (hall) winOnS(c + 0.18, c + 0.82, 8, wBot - 6);
    }
    for (let r = 1; r < b.h - 1; r++) { if (!isGlass) winOnE(r + 0.2, r + 0.8, wBot, wTop); }
    if (isGlass) {
      faceS(f => { f.fillStyle = '#e8fcff'; for (let i = 1; i < 6; i++) f.fillRect(i / 6, 0, 0.012, 1); });
      faceE(f => { f.fillStyle = '#a8e0ea'; for (let i = 1; i < 4; i++) f.fillRect(i / 4, 0, 0.02, 1); });
      out.windows.push({ pts: [up(W, 6), up(S, 6), up(S, WH - 2), up(W, WH - 2)].map(p => ({ x: p.x + minX, y: p.y + minY })), face: 's', glass: true });
    }
    if (doorCols.length) {
      const u0 = doorCols[0] + 0.12, u1 = doorCols[doorCols.length - 1] + 0.88;
      const A = L(x0 + u0, y1), B = L(x0 + u1, y1);
      poly(g, winRect(A, B, up(A, 24)), trim);
      const A2 = L(x0 + u0 + 0.06, y1), B2 = L(x0 + u1 - 0.06, y1);
      poly(g, winRect(A2, B2, up(A2, 22)), '#9a5a3a');
      const knob = up(L(x0 + u1 - 0.2, y1), 11); g.fillStyle = '#ffd060'; g.fillRect(Math.round(knob.x), Math.round(knob.y), 2, 2);
      out.doors.push({ pts: winRect(A2, B2, up(A2, 22)).map(p => ({ x: p.x + minX, y: p.y + minY })) });
      // little step
      I.box(g, L, x0 + u0 - 0.05, y1, u1 - u0 + 0.1, 0.25, 3, boxCols('#b8aec8'));
    }

    // Roof
    const roofLit = I.lit(roof, 0.12), roofShade = I.shade(roof, 0.36), roofDeep = I.deep(roof, 0.35);
    const shingles = (f, base, rows, line) => {
      f.fillStyle = base; f.fillRect(0, 0, 1, 1);
      for (let i = 0; i < rows; i++) {
        f.fillStyle = i % 2 ? IS.mix(base, line, 0.25) : base; f.fillRect(0, i / rows, 1, 1 / rows);
        f.fillStyle = line; f.fillRect(0, i / rows, 1, 0.18 / rows);
      }
    };
    if (isGlass) {
      // greenhouse: glass gable along x
      const ym = (y0 + y1) / 2;
      const Rw = up(L(x0, ym), WH + RH), Re = up(L(x1, ym), WH + RH);
      poly(g, [up(N, WH), up(E, WH), Re, Rw], '#8ccfe0');
      poly(g, [up(S, WH), up(E, WH), Re], '#6fb0c8');
      plane(g, up(W, WH), up(S, WH), Rw, f => { f.fillStyle = '#c8f2f8'; f.fillRect(0, 0, 1, 1); f.fillStyle = '#ffffff'; for (let i = 1; i < 6; i++) f.fillRect(i / 6, 0, 0.012, 1); f.fillRect(0, 0.5, 1, 0.03); });
    } else if (ridgeAlongX) {
      const ym = (y0 + y1) / 2;
      const Rw = up(L(x0 - ov, ym), WH + RH), Re = up(L(x1 + ov, ym), WH + RH);
      const Nv = up(L(x0 - ov, y0 - ov), WH - 2), Ev = up(L(x1 + ov, y0 - ov), WH - 2);
      const Wv = up(L(x0 - ov, y1 + ov), WH - 2), Sv = up(L(x1 + ov, y1 + ov), WH - 2);
      plane(g, Nv, Ev, Rw, f => shingles(f, roofDeep, 6, I.deep(roof, 0.55)));
      // east gable
      poly(g, [up(S, WH), up(E, WH), up(L(x1, ym), WH + RH)], wallShade);
      const gw = up(L(x1, ym), WH + RH * 0.45);
      poly(g, [{ x: gw.x - 3, y: gw.y - 3 }, { x: gw.x + 3, y: gw.y - 6 }, { x: gw.x + 3, y: gw.y }, { x: gw.x - 3, y: gw.y + 3 }], '#4a5890');
      out.windows.push({ pts: [{ x: gw.x - 3 + minX, y: gw.y - 3 + minY }, { x: gw.x + 3 + minX, y: gw.y - 6 + minY }, { x: gw.x + 3 + minX, y: gw.y + minY }, { x: gw.x - 3 + minX, y: gw.y + 3 + minY }], face: 'e' });
      plane(g, Wv, Sv, Rw, f => shingles(f, roofLit, 7, I.shade(roof, 0.25)));
      g.strokeStyle = roofShade; g.lineWidth = 2;
      g.beginPath(); g.moveTo(Wv.x, Wv.y); g.lineTo(Sv.x, Sv.y); g.lineTo(Ev.x, Ev.y); g.stroke();
      g.strokeStyle = I.lit(roof, 0.4); g.beginPath(); g.moveTo(Rw.x, Rw.y); g.lineTo(Re.x, Re.y); g.stroke();
      out.ridge = { a: Rw, b: Re, along: 'x' };
    } else {
      const xm = (x0 + x1) / 2;
      const Rn = up(L(xm, y0 - ov), WH + RH), Rs = up(L(xm, y1 + ov), WH + RH);
      const Nv = up(L(x0 - ov, y0 - ov), WH - 2), Ev = up(L(x1 + ov, y0 - ov), WH - 2);
      const Wv = up(L(x0 - ov, y1 + ov), WH - 2), Sv = up(L(x1 + ov, y1 + ov), WH - 2);
      plane(g, Nv, Rn, Wv, f => shingles(f, roofLit, 6, I.shade(roof, 0.2)));
      poly(g, [up(W, WH), up(S, WH), up(L(xm, y1), WH + RH)], wallLit);
      plane(g, Rs, Sv, Rn, f => shingles(f, roofShade, 7, I.deep(roof, 0.45)));
      g.strokeStyle = I.deep(roof, 0.4); g.lineWidth = 2;
      g.beginPath(); g.moveTo(Wv.x, Wv.y); g.lineTo(Sv.x, Sv.y); g.lineTo(Ev.x, Ev.y); g.stroke();
      out.ridge = { a: Rn, b: Rs, along: 'y' };
    }
    // Chimney
    if (!isGlass && deco !== 'shed') {
      const cx = x1 - 1.2, cy = y0 + 0.6;
      const base = L(cx, cy);
      const Lc = (gx, gy) => ({ x: base.x + (gx - gy) * 16, y: base.y - (WH + RH * 0.6) + (gx + gy) * 8 });
      I.box(g, Lc, 0, 0, 0.45, 0.45, 18, boxCols('#c46a50'));
      out.chimney = up(L(cx + 0.22, cy + 0.22), WH + RH * 0.6 + 20);
    }
    // Hall: bell tower, awning over the doors, hanging lanterns
    if (hall) {
      const ym = (y0 + y1) / 2, xm = (x0 + x1) / 2;
      const base = up(L(xm - 0.5, ym - 0.5), WH + RH - 4);
      const Lt = (gx, gy) => ({ x: base.x + (gx - gy) * 16, y: base.y + (gx + gy) * 8 });
      I.box(g, Lt, 0, 0, 1, 1, 18, boxCols('#f2dcb0'));
      const bell = up(Lt(0.5, 0.5), 22);
      IS.Sprites.disc(g, Math.round(bell.x), Math.round(bell.y), 3, '#ffc94a');
      I.box(g, Lt, -0.1, -0.1, 1.2, 1.2, 4, boxCols('#c8503a'), 18);
      const u0 = doorCols[0] - 0.6, u1 = doorCols[doorCols.length - 1] + 1.6;
      const A0 = up(L(x0 + u0, y1), 30), A1 = up(L(x0 + u1, y1), 30), A3 = up(L(x0 + u0, y1 + 0.7), 22);
      plane(g, A0, A1, A3, f => { for (let i = 0; i < 10; i++) { f.fillStyle = i % 2 ? '#fff2dc' : '#e8584a'; f.fillRect(i / 10, 0, 0.101, 1); } });
      const F0 = up(L(x0 + u0, y1 + 0.7), 22), F1 = up(L(x0 + u1, y1 + 0.7), 22);
      plane(g, F0, F1, { x: F0.x, y: F0.y + 4 }, f => { for (let i = 0; i < 10; i++) { f.fillStyle = i % 2 ? '#fff2dc' : '#c8443a'; f.fillRect(i / 10, 0, 0.101, 1); } });
      out.lanterns = [up(L(x0 + u0 + 0.2, y1 + 0.05), 18), up(L(x0 + u1 - 0.2, y1 + 0.05), 18)].map(p => ({ x: p.x + minX, y: p.y + minY }));
      for (const p of out.lanterns) { g.fillStyle = '#3a2a40'; g.fillRect(Math.round(p.x - minX) - 2, Math.round(p.y - minY) - 3, 5, 7); g.fillStyle = '#5a6aa8'; g.fillRect(Math.round(p.x - minX) - 1, Math.round(p.y - minY) - 2, 3, 5); }
      // sign
      const s0 = up(L(x0 + doorCols[0] - 0.2, y1), 38), s1 = up(L(x0 + doorCols[doorCols.length - 1] + 1.2, y1), 38);
      plane(g, s0, s1, up(s0, 7), f => { f.fillStyle = '#7a4a3a'; f.fillRect(0, 0, 1, 1); f.fillStyle = '#ffd9a0'; f.fillRect(0.06, 0.2, 0.88, 0.6); });
    }
    if (deco === 'cafe') {
      const A0 = up(L(x0 + 0.3, y1), 28), A1 = up(L(x1 - 0.3, y1), 28), A3 = up(L(x0 + 0.3, y1 + 0.6), 21);
      plane(g, A0, A1, A3, f => { for (let i = 0; i < 9; i++) { f.fillStyle = i % 2 ? '#fff2dc' : '#3fa88a'; f.fillRect(i / 9, 0, 0.112, 1); } });
      const F0 = up(L(x0 + 0.3, y1 + 0.6), 21), F1 = up(L(x1 - 0.3, y1 + 0.6), 21);
      plane(g, F0, F1, { x: F0.x, y: F0.y + 4 }, f => { for (let i = 0; i < 9; i++) { f.fillStyle = i % 2 ? '#fff2dc' : '#2f8a70'; f.fillRect(i / 9, 0, 0.112, 1); } });
    }
    // Flower boxes under south windows
    if (b.flowerBoxes) {
      for (const w of out.windows.filter(w => w.face === 's' && !w.glass)) {
        const p0 = { x: w.pts[0].x - minX, y: w.pts[0].y - minY }, p1 = { x: w.pts[1].x - minX, y: w.pts[1].y - minY };
        poly(g, [{ x: p0.x - 1, y: p0.y }, { x: p1.x + 1, y: p1.y }, { x: p1.x + 1, y: p1.y + 3 }, { x: p0.x - 1, y: p0.y + 3 }], '#8a4a30');
        for (let i = 0; i < 5; i++) { const t = (i + 0.5) / 5; g.fillStyle = ['#ff7aa8', '#ffd060', '#ffffff', '#c58aff', '#ff9a58'][i]; g.fillRect(Math.round(p0.x + (p1.x - p0.x) * t), Math.round(p0.y + (p1.y - p0.y) * t) - 2, 2, 2); }
      }
    }
    I.crisp(ext);
    out.canvas = ext;
    out.interior = I.interior(b, L, cw, ch, WH);
    return out;
  };

  // Cutaway view: floor, full-height back walls, stub front walls, furniture.
  I.interior = (b, L, cw, ch, WH) => {
    const { c, g } = IS.makeCanvas(cw, ch);
    const front = IS.makeCanvas(cw, ch);
    const x0 = b.x0, y0 = b.y0, x1 = b.x0 + b.w - 1, y1 = b.y0 + b.h - 1;
    const plank = b.kind === 'hall' ? '#d4955a' : '#c98a52';
    const paper = b.wallpaper || '#f0d8c0';
    // floor
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const pts = [L(x, y), L(x + 1, y), L(x + 1, y + 1), L(x, y + 1)];
      poly(g, pts, (x + y) % 2 ? plank : I.shade(plank, 0.08));
      plane(g, pts[0], pts[1], pts[3], f => { f.fillStyle = I.shade(plank, 0.22); f.fillRect(0, 0.33, 1, 0.03); f.fillRect(0, 0.66, 1, 0.03); });
    }
    // walls: back rows full height, front rows stubs (drawn into `front`)
    const doors = (b.doorCols || []).map(cIdx => b.x0 + cIdx);
    const back = { top: '#7a4a3a', left: paper, right: I.shade(paper, 0.2) };
    for (let x = x0; x <= x1; x++) I.box(g, L, x, y0, 1, 1, WH, back);
    for (let y = y0 + 1; y <= y1; y++) I.box(g, L, x0, y, 1, 1, WH, back);
    const stub = { top: '#7a4a3a', left: I.lit('#b07850'), right: I.shade('#b07850') };
    for (let x = x0 + 1; x <= x1; x++) if (!doors.includes(x)) I.box(front.g, L, x, y1, 1, 1, 8, stub);
    for (let y = y0 + 1; y < y1; y++) I.box(front.g, L, x1, y, 1, 1, 8, stub);
    // a framed picture and a window on the back wall
    const pic = up(L(x0 + 2.2, y0 + 1), WH - 14);
    g.fillStyle = '#7a4a3a'; g.fillRect(Math.round(pic.x) - 5, Math.round(pic.y) - 4, 11, 9); g.fillStyle = '#7ab8e0'; g.fillRect(Math.round(pic.x) - 4, Math.round(pic.y) - 3, 9, 4); g.fillStyle = '#6aa848'; g.fillRect(Math.round(pic.x) - 4, Math.round(pic.y) + 1, 9, 3);
    // furniture, back to front
    const items = (b.furniture || []).slice().sort((a, b2) => (a.c + a.r) - (b2.c + b2.r));
    for (const f of items) {
      const gx = b.x0 + f.c, gy = b.y0 + f.r;
      switch (f.type) {
        case 'bed': {
          I.box(g, L, gx + 0.1, gy + 0.05, 0.8, 1.9, 6, boxCols('#8a5a3a'));
          I.box(g, L, gx + 0.12, gy + 0.1, 0.76, 0.5, 3, boxCols('#ffffff', '#fff8f0'), 6);
          I.box(g, L, gx + 0.12, gy + 0.65, 0.76, 1.25, 2, boxCols(f.color || '#6a8fc9'), 6);
          break;
        }
        case 'stove': I.box(g, L, gx + 0.15, gy + 0.1, 0.7, 0.6, 15, boxCols('#4a4060', '#6a5f80')); { const p = up(L(gx + 0.5, gy + 0.7), 7); g.fillStyle = '#ff9a40'; g.fillRect(Math.round(p.x) - 3, Math.round(p.y) - 2, 6, 3); } break;
        case 'shelf': {
          I.box(g, L, gx + 0.05, gy + 0.05, 0.9, 0.35, 26, boxCols('#9a6038'));
          for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) { const p = up(L(gx + 0.15 + j * 0.2, gy + 0.4), 6 + i * 7); g.fillStyle = ['#ff6a5a', '#5aa0ff', '#ffd060', '#7ad060'][(i + j) % 4]; g.fillRect(Math.round(p.x), Math.round(p.y) - 4, 2, 4); }
          break;
        }
        case 'table': {
          I.box(g, L, gx + 0.1, gy + 0.2, f.w - 0.2, 0.6, 9, boxCols('#b07a44', f.cloth ? '#f0d8b8' : '#d49a5a'));
          if (f.cloth) for (let i = 0; i < f.w; i++) { const p = up(L(gx + i + 0.5, gy + 0.5), 10); g.fillStyle = '#f8ecd8'; g.fillRect(Math.round(p.x) - 3, Math.round(p.y) - 1, 6, 3); }
          break;
        }
        case 'chair': I.box(g, L, gx + 0.3, gy + 0.3, 0.4, 0.4, 5, boxCols('#a8703e')); break;
        case 'armchair': I.box(g, L, gx + 0.15, gy + 0.15, 0.7, 0.7, 8, boxCols(f.color || '#8a5ab8')); I.box(g, L, gx + 0.15, gy + 0.15, 0.7, 0.2, 14, boxCols(I.shade(f.color || '#8a5ab8', 0.1))); break;
        case 'rug': poly(g, [L(gx + 0.1, gy + 0.1), L(gx + f.w - 0.1, gy + 0.1), L(gx + f.w - 0.1, gy + 0.9), L(gx + 0.1, gy + 0.9)], f.color || '#c84a5a'); poly(g, [L(gx + 0.25, gy + 0.25), L(gx + f.w - 0.25, gy + 0.25), L(gx + f.w - 0.25, gy + 0.75), L(gx + 0.25, gy + 0.75)], I.lit(f.color || '#c84a5a', 0.3)); break;
        case 'plant': { I.box(g, L, gx + 0.3, gy + 0.3, 0.4, 0.4, 7, boxCols('#c8643e')); const p = up(L(gx + 0.5, gy + 0.5), 14); IS.Sprites.disc(g, Math.round(p.x), Math.round(p.y), 5, '#3f9a4a'); IS.Sprites.disc(g, Math.round(p.x) - 1, Math.round(p.y) - 2, 2, '#8fd65a'); break; }
        case 'counter': I.box(g, L, gx + 0.05, gy + 0.05, f.w - 0.1, 0.55, 14, boxCols('#9a6038', '#efe2cc')); break;
        case 'fireplace': {
          I.box(g, L, gx, gy + 0.05, f.w, 0.45, 28, boxCols('#a89cb8'));
          const A = up(L(gx + 0.5, gy + 0.5), 2), B = up(L(gx + f.w - 0.5, gy + 0.5), 2);
          poly(g, [A, B, up(B, 14), up(A, 14)], '#2a1f30');
          poly(g, [up(A, 1), up(B, 1), up(B, 6), up(A, 6)], '#ff9a40');
          break;
        }
      }
    }
    I.crisp(c);
    I.crisp(front.c);
    return { canvas: c, front: front.c };
  };

  return I;
})();
