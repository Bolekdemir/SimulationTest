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
    if (b.kind === 'hall') return hallBuilding(b);
    const hall = b.kind === 'hall';
    const deco = b.deco;
    const WH0 = hall ? 46 : deco === 'shed' ? 26 : 36;
    const WH = b.wallH ? Math.max(3, Math.round(WH0 * b.wallH)) : WH0; // half-built walls (build.js)
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
      plane(g, A0, A1, A3, f => { for (let i = 0; i < 9; i++) { f.fillStyle = i % 2 ? '#fff2dc' : (b.awning || '#3fa88a'); f.fillRect(i / 9, 0, 0.112, 1); } });
      const F0 = up(L(x0 + 0.3, y1 + 0.6), 21), F1 = up(L(x1 - 0.3, y1 + 0.6), 21);
      plane(g, F0, F1, { x: F0.x, y: F0.y + 4 }, f => { for (let i = 0; i < 9; i++) { f.fillStyle = i % 2 ? '#fff2dc' : (b.awning ? I.shade(b.awning, 0.15) : '#2f8a70'); f.fillRect(i / 9, 0, 0.112, 1); } });
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
    if (b.kind === 'hall') return hallInterior(b, L, cw, ch, WH);
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

  // ---------------------------------------------------------------- the Hall
  // The community hall gets its own hand-built exterior and interior. Most of
  // it is painted column by column on vertical faces so every line stays a
  // crisp 2:1 pixel staircase instead of an anti-aliased smear.

  // Fill a vertical face standing on the ground line A->B (A is the left end).
  // h0/h1 are heights in px, or functions of t (0..1 along the span).
  const faceFill = (g, A, B, h0, h1, col) => {
    const xa = Math.round(A.x), xb = Math.round(B.x);
    if (xb <= xa) return;
    const k = (B.y - A.y) / (B.x - A.x);
    g.fillStyle = col;
    for (let X = xa; X < xb; X++) {
      const t = (X + 0.5 - A.x) / (B.x - A.x);
      const y = A.y + (X - A.x) * k;
      const lo = typeof h0 === 'function' ? h0(t) : h0, hi = typeof h1 === 'function' ? h1(t) : h1;
      const top = Math.round(y - hi), bot = Math.round(y - lo);
      if (bot > top) g.fillRect(X, top, 1, bot - top);
    }
  };
  // 1px (or w px) pixel line
  const pline = (g, A, B, col, w = 1) => {
    const n = Math.max(1, Math.round(Math.max(Math.abs(B.x - A.x), Math.abs(B.y - A.y))));
    g.fillStyle = col;
    for (let i = 0; i <= n; i++) g.fillRect(Math.round(A.x + (B.x - A.x) * i / n), Math.round(A.y + (B.y - A.y) * i / n), w, w);
  };
  const archT = (h, a) => t => h + a * Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2));
  const GLYPHS = { H: [5, 5, 7, 5, 5], A: [2, 5, 7, 5, 5], L: [4, 4, 4, 4, 7] };
  // Tiny 3x5 letters painted onto a face, following its slope
  const faceText = (g, A, B, str, x, hTop, col) => {
    const k = (B.y - A.y) / (B.x - A.x);
    g.fillStyle = col;
    let cx = x;
    for (const chr of str) {
      const rows = GLYPHS[chr];
      const top = Math.round(A.y + (cx + 1 - A.x) * k - hTop);
      for (let j = 0; j < 3; j++) for (let r = 0; r < 5; r++) if (rows[r] & (4 >> j)) g.fillRect(cx + j, top + r, 1, 1);
      cx += 4;
    }
  };
  // Bunting: a sagging string from A to B with little pennants
  const FLAGS = ['#e8584a', '#ffd060', '#3fa89a', '#fff2dc', '#6a8fd8', '#ff8ab0'];
  const bunting = (g, A, B, segs, sag, flagEvery = 5) => {
    const xa = Math.round(A.x), xb = Math.round(B.x), k = (B.y - A.y) / (B.x - A.x);
    let fi = 0;
    for (let X = xa; X <= xb; X++) {
      const t = (X - A.x) / (B.x - A.x), ft = ((t * segs) % 1 + 1) % 1;
      const y = Math.round(A.y + (X - A.x) * k + sag * Math.sin(Math.PI * ft));
      g.fillStyle = '#4a3040'; g.fillRect(X, y, 1, 1);
      if ((X - xa) % flagEvery === 2 && ft > 0.08 && ft < 0.92 && X + 2 <= xb) {
        g.fillStyle = FLAGS[fi++ % FLAGS.length];
        g.fillRect(X, y + 1, 3, 2); g.fillRect(X + 1, y + 3, 1, 1);
      }
    }
  };

  const hallBuilding = b => {
    const WH = 46, RH = 34, ov = 0.3;
    const x0 = b.x0, y0 = b.y0, x1 = b.x0 + b.w, y1 = b.y0 + b.h; // exclusive far edges
    const g2s = I.g2s;
    const minX = Math.floor(g2s(x0 - ov, y1 + ov).x - 8), maxX = Math.ceil(g2s(x1 + ov, y0 - ov).x + 8);
    const minY = Math.floor(g2s(x0 - ov, y0 - ov).y - WH - RH - 40), maxY = Math.ceil(g2s(x1 + ov, y1 + ov).y + 8);
    const cw = maxX - minX, ch = maxY - minY;
    const L = (gx, gy) => { const p = g2s(gx, gy); return { x: p.x - minX, y: p.y - minY }; };
    const P = (gx, gy, h) => up(L(gx, gy), h);
    const W2 = p => ({ x: p.x + minX, y: p.y + minY });
    const out = { ox: minX, oy: minY, w: cw, h: ch, windows: [], doors: [], lanterns: [], WH };
    const { c: ext, g } = IS.makeCanvas(cw, ch);
    const rnd = IS.mulberry32(1907);
    const doorCols = b.doorCols || [4, 5];
    const dc0 = doorCols[0], dc1 = doorCols[doorCols.length - 1];

    const plaster = b.wall;
    const timber = '#6b3f2c', timberLit = '#8f5c3c';
    const stone = '#a99db6', stoneTop = '#cfc6da', mortar = '#766b92';
    const glass = '#4c5c9c', glassHi = '#7890cc', frameCol = '#fbf0d8';
    const roof = b.roof, roofLo = I.shade(roof, 0.22), roofHi = I.lit(roof, 0.24), roofVarHi = I.lit(roof, 0.12), roofVarLo = I.shade(roof, 0.12), roofLine = I.deep(roof, 0.42), roofDeep = I.deep(roof, 0.38);
    const STONE = 9;

    // u runs along the face in tiles from its left end (south: west->east, east: south->north)
    const sF = (u0, u1, h0, h1, col) => faceFill(g, L(x0 + u0, y1), L(x0 + u1, y1), h0, h1, col);
    const eF = (u0, u1, h0, h1, col) => faceFill(g, L(x1, y1 - u0), L(x1, y1 - u1), h0, h1, col);
    const sP = (u, h) => P(x0 + u, y1, h);
    const eP = (u, h) => P(x1, y1 - u, h);

    // ---- walls: plaster over a stone footing, timber frame
    const wallFace = (F, len, sh, posts) => {
      const S = col => sh ? I.shade(col, 0.32) : col;
      F(0, len, 0, WH, S(plaster));
      for (let i = 0; i < len * 7; i++) { const u = rnd() * len, h = STONE + 4 + rnd() * (WH - STONE - 10); F(u, u + 0.07 + rnd() * 0.1, h, h + 1, S(I.shade(plaster, 0.07))); }
      F(0, len, 0, STONE, S(stone));
      for (let r = 0; r < 3; r++) {
        F(0, len, r * 3 + 2, r * 3 + 3, S(mortar));
        for (let u = (r % 2) * 0.22 + rnd() * 0.05; u < len; u += 0.38 + rnd() * 0.12) F(u, u + 0.065, r * 3, r * 3 + 2, S(mortar));
      }
      for (let i = 0; i < len * 3; i++) { const u = rnd() * len, r = Math.floor(rnd() * 3); F(u, u + 0.12, r * 3 + 1, r * 3 + 2, S(I.lit(stone, 0.25))); }
      F(0, len, STONE - 1, STONE, S(stoneTop));
      F(0, len, STONE, STONE + 2, S(timber));
      F(0, len, WH - 4, WH, S(timber));
      F(0, len, WH - 4, WH - 3, S(timberLit));
      for (const u of posts) F(u - 0.06, u + 0.06, STONE, WH, S(timber));
    };
    const archWin = (F, PT, u0, u1, h0, h1, sh, face) => {
      const S = col => sh ? I.shade(col, 0.32) : col;
      const aH = Math.min(5, Math.round((u1 - u0) * 8));
      F(u0 - 0.07, u1 + 0.07, h0 - 1, archT(h1 + 1, aH), S(frameCol));
      F(u0, u1, h0, archT(h1, aH), S(glass));
      F(u0, u1, h1 - 4, archT(h1, aH), S(glassHi));
      F(u0 + (u1 - u0) * 0.15, u0 + (u1 - u0) * 0.3, h0 + 4, h0 + 9, S(glassHi));
      const um = (u0 + u1) / 2;
      F(um - 0.03, um + 0.035, h0, archT(h1, aH), S(frameCol));
      F(u0, u1, h1 - 6, h1 - 5, S(frameCol));
      F(u0 - 0.12, u1 + 0.12, h0 - 3, h0 - 1, S(timberLit));
      const pts = [PT(u0, h0), PT(u1, h0), PT(u1, h1)];
      for (let i = 1; i < 6; i++) { const t = 1 - i / 6; pts.push(PT(u0 + (u1 - u0) * t, archT(h1, aH)(t))); }
      pts.push(PT(u0, h1));
      out.windows.push({ pts: pts.map(W2), face });
    };

    const sPosts = [], ePosts = [];
    for (let u = 1; u < b.w; u++) if (!(u > dc0 && u <= dc1)) sPosts.push(u);
    for (let u = 1; u < b.h; u++) ePosts.push(u);
    wallFace(sF, b.w, false, sPosts);
    wallFace(eF, b.h, true, ePosts);
    // diagonal braces in the east corner bays
    for (const [u0, u1] of [[0.12, 0.9], [b.h - 0.12, b.h - 0.9]]) pline(g, eP(u0, STONE + 2), eP(u1, WH - 4), I.shade(timber, 0.32), 2);
    // corner posts
    for (const p of [L(x0, y1), L(x1, y1), L(x1, y0)]) { g.fillStyle = timber; g.fillRect(Math.round(p.x) - 1, Math.round(p.y) - WH, 3, WH - STONE + 1); }

    // tall arched windows
    const wb = 14, wt = 32;
    for (let c = 1; c < b.w - 1; c++) {
      if (doorCols.includes(c)) continue;
      archWin(sF, sP, c + 0.25, c + 0.75, wb, wt, false, 's');
      // flower box with blooms
      sF(c + 0.14, c + 0.86, wb - 8, wb - 3, '#8a4a30');
      sF(c + 0.14, c + 0.86, wb - 4, wb - 3, '#a8603c');
      for (let i = 0; i < 6; i++) {
        const p = sP(c + 0.2 + i * 0.12, wb - 3);
        g.fillStyle = '#3f8a3a'; g.fillRect(Math.round(p.x), Math.round(p.y) - 2, 2, 2);
        g.fillStyle = FLAGS[(c + i) % 6 === 2 ? 0 : (c * 3 + i) % 6]; g.fillRect(Math.round(p.x) + (i % 2), Math.round(p.y) - 3 - (i % 2), 2, 2);
      }
    }
    for (let r = 1; r < b.h - 1; r++) archWin(eF, eP, r + 0.25, r + 0.75, wb, wt, true, 'e');

    // banners in the south corner bays
    for (const u of [0.5, b.w - 0.5]) {
      sF(u - 0.3, u + 0.3, 37, 38, timber);
      sF(u - 0.24, u + 0.24, t => 17 + 4 * (1 - Math.abs(2 * t - 1)), 37, '#c8443a');
      sF(u - 0.24, u + 0.24, 33, 34, '#ffd060');
      sF(u - 0.24, u - 0.18, t => 17 + 4 * t, 37, '#9a3030');
      const e = sP(u, 26); g.fillStyle = '#ffd060';
      g.fillRect(Math.round(e.x) - 1, Math.round(e.y) - 3, 3, 4); g.fillRect(Math.round(e.x) - 2, Math.round(e.y), 5, 1); g.fillRect(Math.round(e.x), Math.round(e.y) + 1, 1, 1);
    }

    // double door under a stone arch
    {
      const d0 = dc0 + 0.1, d1 = dc1 + 0.9, dm = (d0 + d1) / 2, dH = 21, dA = 5;
      sF(d0 - 0.14, d1 + 0.14, 0, archT(dH + 2, dA + 1), stoneTop);
      sF(d0 - 0.14, d1 + 0.14, 0, 1, mortar);
      sF(d0, d1, 0, archT(dH, dA), '#2a1c2a');
      sF(d0 + 0.05, d1 - 0.05, dH - 1, archT(dH, dA - 1), glass);
      sF(d0 + 0.05, d1 - 0.05, dH - 1, dH, frameCol);
      for (const t of [0.25, 0.5, 0.75]) { const u = d0 + (d1 - d0) * t; sF(u - 0.03, u + 0.035, dH, archT(dH, dA - 1)((u - d0 - 0.05) / (d1 - d0 - 0.1)), frameCol); }
      for (const [a, z] of [[d0 + 0.05, dm - 0.02], [dm + 0.02, d1 - 0.05]]) {
        sF(a, z, 0, dH - 2, '#2f7c70');
        for (let u = a + 0.14; u < z - 0.05; u += 0.16) sF(u, u + 0.06, 0, dH - 2, '#276a60');
        sF(a, z, 4, 6, '#3a2a30'); sF(a, z, 14, 16, '#3a2a30');
        sF(a, z, dH - 3, dH - 2, '#4a9a8a');
      }
      for (const u of [dm - 0.12, dm + 0.08]) { const k = sP(u, 11); g.fillStyle = '#ffd060'; g.fillRect(Math.round(k.x), Math.round(k.y), 2, 2); }
      out.doors.push({ pts: [sP(d0, 0), sP(d1, 0), sP(d1, dH), sP(d0, dH)].map(W2) });
    }

    // ---- roof
    const ym = (y0 + y1) / 2, Hr = WH + RH, eH = WH - 2;
    const xa = x0 - ov, xb = x1 + ov, ga = y1 + ov, gb = y0 - ov;
    poly(g, [P(xa, gb, eH), P(xb, gb, eH), P(xb, ym, Hr), P(xa, ym, Hr)], roofDeep);
    // brick chimney on the back slope
    {
      const cx = x1 - 1.9, cy = y0 + 0.9, cs = 0.55;
      const zb = eH + (cy - gb) / (ym - gb) * (Hr - eH) - 2, top = Hr + 7;
      const brick = '#b4563e';
      I.box(g, L, cx, cy, cs, cs, top - zb, boxCols(brick), zb);
      for (let h = zb + 2; h < top - 1; h += 3) {
        pline(g, P(cx, cy + cs, h), P(cx + cs, cy + cs, h), '#8a3a34');
        pline(g, P(cx + cs, cy + cs, h), P(cx + cs, cy, h), I.shade('#8a3a34', 0.3));
      }
      I.box(g, L, cx - 0.07, cy - 0.07, cs + 0.14, cs + 0.14, 3, boxCols('#6a5a72'), top);
      I.box(g, L, cx + 0.14, cy + 0.14, 0.27, 0.27, 4, boxCols('#c8784a'), top + 3);
      out.chimney = P(cx + cs / 2, cy + cs / 2, top + 8);
    }
    // east gable: timber framed, with an attic window
    {
      const gH = t => WH + (Hr - WH) * (1 - Math.abs(2 * t - 1));
      const sh = c => I.shade(c, 0.32), hm = b.h / 2;
      eF(0, b.h, WH - 1, gH, sh(plaster));
      eF(0, b.h, WH - 1, WH + 1, sh(timber));
      eF(hm - 0.07, hm + 0.07, WH, WH + 5, sh(timber));
      eF(hm - 0.07, hm + 0.07, WH + 18, Hr - 2, sh(timber));
      pline(g, eP(hm - 0.6, WH + 1), eP(hm - 1.9, WH + 13), sh(timber), 2);
      pline(g, eP(hm + 0.6, WH + 1), eP(hm + 1.9, WH + 13), sh(timber), 2);
      archWin(eF, eP, hm - 0.38, hm + 0.38, WH + 6, WH + 13, true, 'e');
    }
    // front slope: clay tile courses
    const RP = (gx, s) => P(gx, ga + (ym - ga) * s, eH + (Hr - eH) * s);
    poly(g, [RP(xa, 0), RP(xb, 0), RP(xb, 1), RP(xa, 1)], roof);
    const N = 11;
    for (let i = 0; i < N; i++) {
      const s0 = i / N, s1 = (i + 1) / N, off = (i % 2) * 0.25;
      for (let u = xa - off; u < xb; u += 0.5) {
        const ua = Math.max(xa, u), ub = Math.min(xb, u + 0.5), v = rnd();
        const col = v < 0.12 ? roofVarHi : v > 0.88 ? roofVarLo : null;
        if (col) poly(g, [RP(ua + 0.04, s0 + 0.01), RP(ub - 0.04, s0 + 0.01), RP(ub - 0.04, s1 - 0.01), RP(ua + 0.04, s1 - 0.01)], col);
        if (u > xa) pline(g, RP(u, s0), RP(u, s1), roofLine);
      }
      if (i > 0) { pline(g, up(RP(xa, s0), 1), up(RP(xb, s0), 1), roofHi); pline(g, RP(xa, s0), RP(xb, s0), roofLine); }
    }
    // a few moss tufts
    for (let i = 0; i < 9; i++) {
      const p = RP(xa + 0.5 + rnd() * (xb - xa - 1), 0.05 + rnd() * 0.5);
      g.fillStyle = '#7a9a4a'; g.fillRect(Math.round(p.x), Math.round(p.y), 2, 1);
      g.fillStyle = '#a8c060'; g.fillRect(Math.round(p.x), Math.round(p.y) - 1, 1, 1);
    }
    // dormers
    const dormer = xc => {
      const hw = 0.58, sf = 0.18, sfh = eH + (Hr - eH) * sf, gf = ga + (ym - ga) * sf;
      const wallH = 12, apx = 8;
      const gyAt = h => ga + (ym - ga) * ((h - eH) / (Hr - eH));
      const gE = gyAt(sfh + wallH - 1), gR = gyAt(sfh + wallH + apx);
      const xl = xc - hw, xr = xc + hw, ah = sfh + wallH + apx;
      poly(g, [P(xr, gf, sfh), P(xr, gf, sfh + wallH), P(xr, gE, sfh + wallH - 1)], I.shade(plaster, 0.32));
      poly(g, [P(xl - 0.12, gf + 0.12, sfh + wallH - 1), P(xc, gf + 0.12, ah), P(xc, gR, ah), P(xl - 0.12, gE, sfh + wallH - 1)], roofHi);
      poly(g, [P(xc, gf + 0.12, ah), P(xr + 0.12, gf + 0.12, sfh + wallH - 1), P(xr + 0.12, gE, sfh + wallH - 1), P(xc, gR, ah)], roofLo);
      for (let s = 0.25; s < 0.99; s += 0.25) {
        const hW = sfh + wallH - 1 + (ah - sfh - wallH + 1) * s;
        const gW = gE + (gR - gE) * s, gw = xl - 0.12 + (xc - xl + 0.12) * s, ge = xr + 0.12 - (xr + 0.12 - xc) * s;
        pline(g, P(gw, gf + 0.12, hW), P(gw, gW, hW), roofLine);
        pline(g, P(ge, gf + 0.12, hW), P(ge, gW, hW), I.deep(roof, 0.55));
      }
      pline(g, P(xc, gf + 0.12, ah), P(xc, gR, ah), roofLine);
      const dF = (u0, u1, h0, h1, col) => faceFill(g, L(xl + u0, gf), L(xl + u1, gf), h0, h1, col);
      dF(0, hw * 2, sfh - 1, t => sfh + wallH + apx * (1 - Math.abs(2 * t - 1)) - 1, plaster);
      dF(0, hw * 2, sfh - 1, sfh + 1, timber);
      archWin(dF, (u, h) => P(xl + u, gf, h), hw - 0.26, hw + 0.26, sfh + 3, sfh + 8, false, 's');
      pline(g, P(xl - 0.12, gf + 0.12, sfh + wallH - 1), P(xc, gf + 0.12, ah + 1), timber, 2);
      pline(g, P(xc, gf + 0.12, ah + 1), P(xr + 0.12, gf + 0.12, sfh + wallH - 1), timber, 2);
    };
    dormer(x0 + 2.0);
    dormer(x1 - 2.0);
    // ridge cap, eave fascia, barge boards
    const Rw = P(xa, ym, Hr), Re = P(xb, ym, Hr);
    pline(g, up(Rw, 2), up(Re, 2), roofHi);
    pline(g, up(Rw, 1), up(Re, 1), I.shade(roof, 0.12));
    pline(g, Rw, Re, I.shade(roof, 0.3));
    pline(g, { x: Rw.x, y: Rw.y + 1 }, { x: Re.x, y: Re.y + 1 }, roofLine);
    for (let u = xa + 0.5; u < xb; u += 0.5) { const p = RP(u, 1); g.fillStyle = roofLine; g.fillRect(Math.round(p.x), Math.round(p.y) - 2, 1, 3); }
    const F0 = RP(xa, 0), F1 = RP(xb, 0);
    pline(g, F0, F1, roofLine);
    pline(g, { x: F0.x, y: F0.y + 1 }, { x: F1.x, y: F1.y + 1 }, timberLit);
    pline(g, { x: F0.x, y: F0.y + 2 }, { x: F1.x, y: F1.y + 2 }, timber);
    pline(g, F1, Re, timber, 2);
    pline(g, Re, P(xb, gb, eH), I.shade(timber, 0.2), 2);

    // ---- cupola with a bell, a clock and a copper roof
    {
      const xm = x0 + b.w / 2, cs = 0.44, cz = Hr - 6;
      I.box(g, L, xm - cs, ym - cs, cs * 2, cs * 2, 15, { top: timber, left: plaster, right: I.shade(plaster, 0.32) }, cz);
      faceFill(g, L(xm - cs, ym + cs), L(xm + cs, ym + cs), cz, cz + 3, timber);
      faceFill(g, L(xm + cs, ym + cs), L(xm + cs, ym - cs), cz, cz + 3, I.shade(timber, 0.3));
      const cc = P(xm, ym + cs, cz + 9);
      const ccx = Math.round(cc.x) - 2, ccy = Math.round(cc.y) + 2;
      IS.Sprites.disc(g, ccx, ccy, 4, timber);
      IS.Sprites.disc(g, ccx, ccy, 3, '#fff6e0');
      g.fillStyle = '#3a2a40'; g.fillRect(ccx, ccy - 2, 1, 3); g.fillRect(ccx, ccy, 2, 1);
      const bz = cz + 15, bh = 13;
      I.box(g, L, xm - cs + 0.06, ym - cs + 0.06, cs * 2 - 0.12, cs * 2 - 0.12, bh, { top: '#2a1f30', left: '#3a2838', right: '#2a1f30' }, bz);
      // bell on a yoke
      const bc = P(xm, ym, bz + 8), bx = Math.round(bc.x), by = Math.round(bc.y);
      const rows = [2, 4, 4, 4, 6, 6, 8];
      rows.forEach((w, i) => { g.fillStyle = i === rows.length - 1 ? '#c88a2a' : '#ffc94a'; g.fillRect(bx - w / 2, by + i, w, 1); g.fillStyle = '#fff0a0'; if (i > 0 && i < 6) g.fillRect(bx - w / 2 + 1, by + i, 1, 1); });
      g.fillStyle = '#a86a2a'; g.fillRect(bx, by + 7, 1, 2);
      g.fillStyle = '#5a3a2a'; g.fillRect(bx - 4, by - 2, 9, 2);
      // arched openings: wall band above, sill below, corner posts
      faceFill(g, L(xm - cs, ym + cs), L(xm + cs, ym + cs), t => bz + bh - 4 + 3 * Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2)), bz + bh, plaster);
      faceFill(g, L(xm + cs, ym + cs), L(xm + cs, ym - cs), t => bz + bh - 4 + 3 * Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2)), bz + bh, I.shade(plaster, 0.32));
      faceFill(g, L(xm - cs, ym + cs), L(xm + cs, ym + cs), bz, bz + 2, timberLit);
      faceFill(g, L(xm + cs, ym + cs), L(xm + cs, ym - cs), bz, bz + 2, I.shade(timberLit, 0.3));
      for (const [px, py] of [[xm - cs, ym + cs - 0.1], [xm + cs - 0.1, ym + cs - 0.1], [xm + cs - 0.1, ym - cs]]) I.box(g, L, px, py, 0.1, 0.1, bh, boxCols(frameCol), bz);
      // pyramid roof in verdigris copper with a weathervane
      const rz = bz + bh, ro = cs + 0.14, apexP = P(xm, ym, rz + 17);
      const cW = P(xm - ro, ym + ro, rz), cS = P(xm + ro, ym + ro, rz), cE = P(xm + ro, ym - ro, rz);
      poly(g, [cW, cS, apexP], '#5ab0a0');
      poly(g, [cS, cE, apexP], '#3a7a7a');
      for (let i = 1; i < 4; i++) {
        const t = i / 4;
        pline(g, apexP, { x: cW.x + (cS.x - cW.x) * t, y: cW.y + (cS.y - cW.y) * t }, '#4a9a8c');
        pline(g, apexP, { x: cS.x + (cE.x - cS.x) * t, y: cS.y + (cE.y - cS.y) * t }, '#2e6466');
      }
      pline(g, cW, cS, '#8ad8c4'); pline(g, cS, cE, '#2e6466');
      pline(g, apexP, cS, '#8ad8c4');
      const ax = Math.round(apexP.x), ay = Math.round(apexP.y);
      g.fillStyle = '#3a2a40'; g.fillRect(ax, ay - 14, 1, 14);
      g.fillStyle = '#ffd060'; g.fillRect(ax - 1, ay - 2, 3, 2); g.fillRect(ax - 1, ay - 16, 3, 2);
      // a little red pennant flying east
      g.fillStyle = '#e8584a'; g.fillRect(ax + 1, ay - 14, 7, 2); g.fillRect(ax + 1, ay - 12, 4, 1); g.fillRect(ax + 8, ay - 13, 2, 1);
      g.fillStyle = '#ff8a7a'; g.fillRect(ax + 1, ay - 14, 5, 1);
    }

    // bunting under the front eave
    bunting(g, { x: F0.x + 6, y: F0.y + 3 }, { x: F1.x - 6, y: F1.y + 3 }, 6, 4);

    // ---- porch: steps, posts, a little gable with the HALL sign, lanterns
    {
      const pxa = x0 + dc0 - 0.3, pxb = x0 + dc1 + 1.3, pxc = (pxa + pxb) / 2, pf = y1 + 0.8, pe = 35, pa = 50;
      I.box(g, L, pxa + 0.1, y1, pxb - pxa - 0.2, 0.62, 2, boxCols(stone, stoneTop));
      I.box(g, L, pxa + 0.25, y1, pxb - pxa - 0.5, 0.36, 4, boxCols(stone, stoneTop));
      const postX = [pxa + 0.08, pxb - 0.18];
      for (const px of postX) {
        I.box(g, L, px - 0.03, pf - 0.17, 0.16, 0.16, 3, boxCols(stone, stoneTop));
        I.box(g, L, px, pf - 0.14, 0.1, 0.1, pe, boxCols('#f2e4c8'));
        I.box(g, L, px - 0.03, pf - 0.17, 0.16, 0.16, 2, boxCols('#f2e4c8'), pe - 6);
      }
      const pr = 0.12; // roof overhang past the gable
      const cuLit = '#5ab0a0', cuLo = '#3a7a7a', cuLine = '#2e5a60', cuHi = '#8ad8c4';
      poly(g, [P(pxa - pr, pf + pr, pe - 1), P(pxc, pf + pr, pa), P(pxc, y1, pa), P(pxa - pr, y1, pe - 1)], cuLit);
      poly(g, [P(pxc, pf + pr, pa), P(pxb + pr, pf + pr, pe - 1), P(pxb + pr, y1, pe - 1), P(pxc, y1, pa)], cuLo);
      // standing seams running down the copper
      for (const gy of [y1 + 0.2, y1 + 0.45, y1 + 0.7]) {
        pline(g, P(pxa - pr, gy, pe - 1), P(pxc, gy, pa), cuHi);
        pline(g, P(pxc, gy, pa), P(pxb + pr, gy, pe - 1), cuLine);
      }
      pline(g, P(pxc, pf + pr, pa), P(pxc, y1 - 0.2, pa), cuHi);
      pline(g, { x: P(pxc, pf + pr, pa).x + 1, y: P(pxc, pf + pr, pa).y }, { x: P(pxc, y1 - 0.2, pa).x + 1, y: P(pxc, y1 - 0.2, pa).y }, cuLine);
      pline(g, P(pxa - pr, pf + pr, pe - 1), P(pxa - pr, y1, pe - 1), cuLine, 2);
      pline(g, P(pxb + pr, pf + pr, pe - 1), P(pxb + pr, y1, pe - 1), cuLine, 2);
      const gF = t => pe + (pa - pe) * (1 - Math.abs(2 * t - 1)) - 1;
      faceFill(g, L(pxa + 0.06, pf), L(pxb - 0.06, pf), pe - 4, gF, plaster);
      faceFill(g, L(pxa + 0.06, pf), L(pxb - 0.06, pf), pe - 4, pe - 1, timber);
      faceFill(g, L(pxa + 0.06, pf), L(pxb - 0.06, pf), pe - 2, pe - 1, timberLit);
      // little fan of timber in the gable apex
      pline(g, P(pxc, pf, pa - 3), P(pxc, pf, pe + 10), timber);
      pline(g, P(pxa - pr, pf + pr, pe - 2), P(pxc, pf + pr, pa + 1), timber, 2);
      pline(g, P(pxc, pf + pr, pa + 1), P(pxb + pr, pf + pr, pe - 2), timber, 2);
      pline(g, P(pxa - pr, pf + pr, pe), P(pxc, pf + pr, pa + 3), timberLit);
      const sA = L(pxc - 0.6, pf), sB = L(pxc + 0.6, pf);
      faceFill(g, sA, sB, pe + 1, pe + 10, '#5a3424');
      faceFill(g, L(pxc - 0.55, pf), L(pxc + 0.55, pf), pe + 2, pe + 9, '#fbe6b0');
      faceText(g, sA, sB, 'HALL', Math.round(L(pxc, pf).x) - 7, pe + 8, '#a82a2a');
      for (const px of postX) {
        const lp = P(px + 0.05, pf + 0.04, 25), lx = Math.round(lp.x) + (px === postX[0] ? -3 : 3), ly = Math.round(lp.y);
        g.fillStyle = '#3a2a40';
        g.fillRect(Math.min(lx, Math.round(lp.x)), ly - 6, Math.abs(lx - Math.round(lp.x)) + 1, 1);
        g.fillRect(lx, ly - 6, 1, 2);
        g.fillRect(lx - 2, ly - 4, 5, 1); g.fillRect(lx - 2, ly - 3, 5, 6); g.fillRect(lx - 1, ly + 3, 3, 1);
        g.fillStyle = '#e8c87a'; g.fillRect(lx - 1, ly - 2, 3, 4);
        g.fillStyle = '#fff2c0'; g.fillRect(lx - 1, ly - 2, 1, 1);
        out.lanterns.push(W2({ x: lx, y: ly }));
      }
    }

    I.crisp(ext);
    out.canvas = ext;
    out.ridge = { a: Rw, b: Re, along: 'x' };
    out.interior = hallInterior(b, L, cw, ch, WH);
    return out;
  };

  // Cozy cutaway of the hall: plank floor, panelled and papered walls, a brick
  // hearth, a dressed banquet table, real chairs, books, a kitchen corner and
  // a little story lectern.
  const hallInterior = (b, L, cw, ch, WH) => {
    const { c, g } = IS.makeCanvas(cw, ch);
    const front = IS.makeCanvas(cw, ch);
    const x0 = b.x0, y0 = b.y0, x1 = b.x0 + b.w - 1, y1 = b.y0 + b.h - 1;
    const P = (gx, gy, h) => up(L(gx, gy), h);
    const rnd = IS.mulberry32(4242);
    const tmp = IS.makeCanvas(cw, ch, true);
    const piece = draw => { tmp.g.clearRect(0, 0, cw, ch); draw(tmp.g); I.crisp(tmp.c, '#2a1f40'); g.drawImage(tmp.c, 0, 0); };
    const px = (G, p, dx, dy, w, h, col) => { G.fillStyle = col; G.fillRect(Math.round(p.x) + dx, Math.round(p.y) + dy, w, h); };

    // ---- floor: honey planks running east-west
    const planks = ['#c98b52', '#c08049', '#d29a5e', '#b97a45', '#cc9156'];
    const seam = '#8a5638', joints = [];
    for (let y = y0; y <= y1; y++) for (let k = 0; k < 4; k++) {
      const gy = y + k * 0.25;
      let gx = x0 - rnd() * 1.5;
      while (gx < x1 + 1) {
        const len = 1.25 + rnd() * 1.75, a = Math.max(x0, gx), z = Math.min(x1 + 1, gx + len);
        poly(g, [L(a, gy), L(z, gy), L(z, gy + 0.25), L(a, gy + 0.25)], planks[Math.floor(rnd() * planks.length)]);
        if (gx > x0) joints.push([gx, gy]);
        gx += len;
      }
    }
    for (let y = y0; y <= y1; y++) for (let k = 0; k < 4; k++) pline(g, L(x0, y + k * 0.25), L(x1 + 1, y + k * 0.25), seam);
    for (const [gx, gy] of joints) { pline(g, L(gx, gy), L(gx, gy + 0.25), seam); const n = L(gx + 0.12, gy + 0.12); px(g, n, 0, 0, 1, 1, '#6a4030'); }
    for (let i = 0; i < 60; i++) { const p = L(x0 + 1 + rnd() * (b.w - 2), y0 + 1 + rnd() * (b.h - 2)); px(g, p, 0, 0, 3, 1, '#d8a468'); }

    // ---- rugs lie flat, so they go down first
    const rug = f => {
      const gx = x0 + f.c, gy = y0 + f.r, w = f.w, d = f.d || 1, col = f.color || '#a8463a';
      const R = (a, z) => L(gx + a, gy + z);
      poly(g, [R(0, 0), R(w, 0), R(w, d), R(0, d)], I.shade(col, 0.4));
      poly(g, [R(0.1, 0.1), R(w - 0.1, 0.1), R(w - 0.1, d - 0.1), R(0.1, d - 0.1)], col);
      const gold = '#e8b050', i0 = 0.2;
      pline(g, R(i0, i0), R(w - i0, i0), gold); pline(g, R(w - i0, i0), R(w - i0, d - i0), gold);
      pline(g, R(w - i0, d - i0), R(i0, d - i0), gold); pline(g, R(i0, d - i0), R(i0, i0), gold);
      for (let u = 0.6; u < w - 0.4; u += 0.6) {
        const m = R(u, d / 2);
        px(g, m, -1, -1, 3, 3, f.runner ? '#e8b050' : '#7a2a40'); px(g, m, 0, -2, 1, 5, f.runner ? '#e8b050' : '#7a2a40'); px(g, m, -2, 0, 5, 1, f.runner ? '#e8b050' : '#7a2a40');
        px(g, m, 0, 0, 1, 1, '#ffe0a0');
      }
      for (let u = 0.15; u < w; u += 0.3) { px(g, R(u, 0.32), 0, 0, 1, 1, '#ffe0a0'); px(g, R(u, d - 0.32), 0, 0, 1, 1, '#ffe0a0'); }
      const edge = I.deep(col, 0.55);
      pline(g, R(0, 0), R(w, 0), edge); pline(g, R(w, 0), R(w, d), edge); pline(g, R(w, d), R(0, d), edge); pline(g, R(0, d), R(0, 0), edge);
      if (!f.runner) for (let z = 0.1; z < d; z += 0.14) { const p = R(0, z), q = R(w, z); px(g, p, -2, 0, 2, 1, '#f4e6c8'); px(g, q, 1, 0, 2, 1, '#f4e6c8'); }
    };
    const items = b.furniture || [];
    for (const f of items) if (f.type === 'hallRug') rug(f);

    // ---- back walls: wainscot, wallpaper and a crown beam
    const timber = '#6b3f2c';
    const back = { top: '#9a6a48', left: timber, right: I.shade(timber, 0.25) };
    for (let x = x0; x <= x1; x++) I.box(g, L, x, y0, 1, 1, WH, back);
    for (let y = y0 + 1; y <= y1; y++) I.box(g, L, x0, y, 1, 1, WH, back);
    // board seams and a lit inner edge on the cut wall tops
    for (const v of [0.33, 0.66]) {
      pline(g, P(x0 + v, y0 + v, WH), P(x1 + 1, y0 + v, WH), '#7a4e34');
      pline(g, P(x0 + v, y0 + v, WH), P(x0 + v, y1 + 1, WH), '#7a4e34');
    }
    pline(g, P(x0 + 1, y0 + 1, WH), P(x1 + 1, y0 + 1, WH), '#c8946a');
    pline(g, P(x0 + 1, y0 + 1, WH), P(x0 + 1, y1 + 1, WH), '#c8946a');
    // north wall face (lit) and west wall face (shaded); a/z are columns or rows from the hall origin
    const nF = (a, z, h0, h1, col) => faceFill(g, L(x0 + a, y0 + 1), L(x0 + z, y0 + 1), h0, h1, col);
    const wF = (a, z, h0, h1, col) => faceFill(g, L(x0 + 1, y0 + z), L(x0 + 1, y0 + a), h0, h1, col);
    const nP = (a, h) => P(x0 + a, y0 + 1, h);
    const wP = (a, h) => P(x0 + 1, y0 + a, h);
    const WAIN = 15, RAIL = 17, CROWN = 39;
    const paintWall = (F, PT, a, z, sh) => {
      const S = col => sh ? I.shade(col, 0.2) : col;
      F(a, z, 0, WH, S('#efc68e'));
      for (let u = a + 0.125; u < z; u += 0.25) F(u, u + 0.0625, RAIL, CROWN, S('#e3b27a'));
      let k = 0;
      for (let u = a + 0.25; u < z - 0.05; u += 0.25, k++) {
        const p = PT(u, k % 2 ? 23 : 32);
        px(g, p, -1, 0, 3, 1, S('#d0705a')); px(g, p, 0, -1, 1, 3, S('#d0705a')); px(g, p, 0, 0, 1, 1, S('#ffe6a8'));
        px(g, p, 1, 2, 1, 1, S('#7aa058'));
      }
      F(a, z, 0, WAIN, S('#8c5634'));
      for (let u = a; u < z - 0.01; u += 0.5) { F(u + 0.06, u + 0.44, 3, WAIN - 2, S('#74462a')); F(u + 0.1, u + 0.4, 4, WAIN - 3, S('#9c6440')); F(u + 0.1, u + 0.4, WAIN - 4, WAIN - 3, S('#b07a4c')); }
      F(a, z, 0, 2, S('#5e3624'));
      F(a, z, WAIN, RAIL, S('#c88c56')); F(a, z, RAIL - 1, RAIL, S('#e4ae70'));
      F(a, z, CROWN, WH, S(timber)); F(a, z, CROWN, CROWN + 1, S('#4e2e20')); F(a, z, WH - 2, WH, S('#8a5a3c'));
      for (let u = a; u <= z + 0.01; u += 3) F(u - 0.05, u + 0.07, 0, WH, S('#5e3624'));
    };
    paintWall(nF, nP, 1, b.w, false);
    paintWall(wF, wP, 1, b.h, true);

    // interior window: sky, a hill, curtains
    const inWin = (F, PT, u0, u1, h0, h1, sh) => {
      const S = col => sh ? I.shade(col, 0.2) : col;
      F(u0 - 0.06, u1 + 0.06, h0 - 1, archT(h1 + 1, 4), S('#fbf0d8'));
      F(u0, u1, h0, archT(h1, 4), S('#a8dcf4'));
      F(u0, u1, h0, h0 + 4, S('#8ac060'));
      F(u0, u1, h0 + 4, h0 + 5, S('#b8e070'));
      F(u0, u1, h1 - 3, archT(h1, 4), S('#d4f0fc'));
      const cp = PT(u0 + (u1 - u0) * 0.6, h0 + 11); px(g, cp, -2, 0, 5, 1, '#ffffff'); px(g, cp, -1, -1, 3, 1, '#ffffff');
      const um = (u0 + u1) / 2;
      F(um - 0.03, um + 0.035, h0, archT(h1, 4), S('#fbf0d8'));
      F(u0, u1, h1 - 6, h1 - 5, S('#fbf0d8'));
      F(u0 - 0.12, u1 + 0.12, h0 - 3, h0 - 1, S('#b07a4c'));
      // curtains with tie-backs and a valance
      F(u0 - 0.16, u0 + 0.06, h0 - 1, h1 + 5, S('#b8443a')); F(u1 - 0.06, u1 + 0.16, h0 - 1, h1 + 5, S('#b8443a'));
      F(u0 - 0.16, u0 - 0.1, h0 - 1, h1 + 5, S('#d8604a')); F(u1 - 0.06, u1 + 0.0, h0 - 1, h1 + 5, S('#d8604a'));
      F(u0 - 0.16, u0 + 0.06, h0 + 7, h0 + 8, S('#ffd060')); F(u1 - 0.06, u1 + 0.16, h0 + 7, h0 + 8, S('#ffd060'));
      F(u0 - 0.2, u1 + 0.2, h1 + 5, h1 + 7, S('#7a4a2e'));
    };
    inWin(nF, nP, 5.25, 5.75, 20, 32, false);
    inWin(wF, wP, 2.25, 2.75, 20, 32, true);
    inWin(wF, wP, 4.25, 4.75, 20, 32, true);
    // notice board between the west windows
    {
      wF(3.05, 3.95, 17, 34, I.shade('#7a4a2c', 0.2));
      wF(3.1, 3.9, 18, 33, I.shade('#c8965a', 0.2));
      const notes = [[3.15, 3.42, 24, 31, '#fff4dc'], [3.48, 3.72, 26, 32, '#f8c8d0'], [3.55, 3.85, 19, 24, '#cfe4f4'], [3.18, 3.45, 19, 22, '#fff0a8'], [3.75, 3.86, 26, 31, '#d8f0c0']];
      for (const [a, z, h0, h1, col] of notes) {
        wF(a, z, h0, h1, I.shade(col, 0.15));
        for (let h = h1 - 3; h > h0 + 1; h -= 2) wF(a + 0.04, z - 0.05, h, h + 1, I.shade('#8a7a90', 0.2));
        px(g, wP((a + z) / 2, h1), 0, 0, 1, 1, '#d83a3a');
      }
    }
    // kitchen wall: tiled splashback, plate rack with Delft plates, copper pans
    {
      nF(1, 4, 14, 23, '#f2ead8');
      for (let h = 17; h < 23; h += 3) nF(1, 4, h, h + 1, '#c8d4dc');
      for (let u = 1.25; u < 4; u += 0.25) nF(u, u + 0.0625, 14, 23, '#c8d4dc');
      for (let u = 1.375; u < 4; u += 0.5) { const p = nP(u, 20); px(g, p, 0, 0, 1, 1, '#5a8ac8'); }
      nF(1.08, 3.92, 30, 32, '#9a6038'); nF(1.08, 3.92, 31, 32, '#c08050');
      for (let u = 1.3; u < 3.8; u += 0.3) { const p = nP(u, 36); IS.Sprites.disc(g, Math.round(p.x), Math.round(p.y), 2, '#3a6aa8'); IS.Sprites.disc(g, Math.round(p.x), Math.round(p.y), 1, '#f8f4ea'); }
      for (const [u, r] of [[2.0, 3], [2.55, 2], [3.1, 3]]) {
        const hk = nP(u, 29), pc = nP(u, 23);
        px(g, hk, 0, 0, 1, 2, '#3a2a40');
        px(g, hk, 0, 2, 1, Math.round(pc.y - hk.y) - r - 2, '#8a4a24');
        IS.Sprites.disc(g, Math.round(pc.x), Math.round(pc.y), r, '#5a2a20');
        IS.Sprites.disc(g, Math.round(pc.x), Math.round(pc.y), r - 1, '#d07a3a');
        px(g, pc, -1, -1, 1, 1, '#f8c080');
      }
    }
    // bunting along the top of both walls
    bunting(g, up(nP(1.1, 0), CROWN - 1), up(nP(b.w - 0.1, 0), CROWN - 1), 5, 3);
    bunting(g, up(wP(b.h - 0.6, 0), CROWN - 1), up(wP(1.1, 0), CROWN - 1), 3, 3);

    // ---- furniture, back rows first
    const BOOKS = ['#c8443a', '#3f7ac8', '#e8b040', '#4a9a5a', '#8a4ab0', '#e07a4a', '#f0e0c0', '#2f6a7a', '#a83a6a'];
    const sorted = items.filter(f => f.type !== 'hallRug').sort((a, z) => (a.r - z.r) || (a.c - z.c));
    for (const f of sorted) {
      const X = x0 + f.c, Y = y0 + f.r;
      switch (f.type) {
        case 'kitchen': piece(G => {
          const gy = Y + 0.02, d = 0.6, h = 14;
          // iron range with a soup pot
          I.box(G, L, X + 0.04, gy, 0.92, d, h + 1, boxCols('#3e3650', '#5a5070'));
          faceFill(G, L(X + 0.16, gy + d), L(X + 0.84, gy + d), 3, 10, '#2a2238');
          faceFill(G, L(X + 0.2, gy + d), L(X + 0.8, gy + d), 9, 10, '#c8b8a0');
          faceFill(G, L(X + 0.22, gy + d), L(X + 0.78, gy + d), 4, 8, '#ff9a40');
          faceFill(G, L(X + 0.22, gy + d), L(X + 0.78, gy + d), 4, 5, '#ffd060');
          const pt = P(X + 0.48, gy + 0.3, h + 1), ptx = Math.round(pt.x), pty = Math.round(pt.y);
          G.fillStyle = '#2a2238'; G.fillRect(ptx - 5, pty - 6, 11, 6);
          G.fillStyle = '#4a4460'; G.fillRect(ptx - 4, pty - 6, 9, 5);
          G.fillStyle = '#6a6488'; G.fillRect(ptx - 4, pty - 6, 2, 5);
          IS.Sprites.ellipse(G, ptx, pty - 7, 5, 1, '#5a5478');
          IS.Sprites.ellipse(G, ptx, pty - 7, 4, 1, '#e8a050');
          G.fillStyle = '#2a2238'; G.fillRect(ptx - 7, pty - 5, 2, 1); G.fillRect(ptx + 6, pty - 5, 2, 1);
          G.fillStyle = '#f4f0f8'; G.fillRect(ptx - 1, pty - 11, 1, 2); G.fillRect(ptx, pty - 13, 1, 2); G.fillRect(ptx + 2, pty - 12, 1, 2); G.fillRect(ptx + 1, pty - 15, 1, 2);
          // cabinets and worktop
          I.box(G, L, X + 1, gy, f.w - 1.04, d, h - 2, { top: '#c08a58', left: '#a8703f', right: I.shade('#a8703f', 0.3) });
          for (let u = 1.06; u < f.w - 0.1; u += 0.5) {
            faceFill(G, L(X + u, gy + d), L(X + u + 0.42, gy + d), 2, h - 4, '#8e5a34');
            faceFill(G, L(X + u + 0.04, gy + d), L(X + u + 0.38, gy + d), 3, h - 5, '#b47a46');
            px(G, P(X + u + 0.32, gy + d, 8), 0, 0, 1, 2, '#ffd060');
          }
          I.box(G, L, X + 0.98, gy - 0.01, f.w - 1.0, d + 0.06, 2, { top: '#efe4cc', left: '#d8c8a8', right: I.shade('#d8c8a8', 0.3) }, h - 2);
          // bread board, loaf and carrots
          I.box(G, L, X + 1.2, gy + 0.12, 0.55, 0.36, 1, boxCols('#d49a5a'), h);
          const lf = P(X + 1.45, gy + 0.3, h + 1); IS.Sprites.ellipse(G, Math.round(lf.x), Math.round(lf.y) - 2, 4, 2, '#d89048'); px(G, lf, -2, -3, 3, 1, '#f0b868');
          px(G, lf, 5, 0, 3, 1, '#ff8a3a'); px(G, lf, 6, 1, 3, 1, '#ff8a3a'); px(G, lf, 8, -1, 1, 1, '#5aa040');
          // jars and a fruit basket
          [['#e85a4a', 2.15], ['#ffd060', 2.35], ['#8ad050', 2.55]].forEach(([col, u]) => {
            I.box(G, L, X + u, gy + 0.18, 0.14, 0.14, 5, boxCols('#d8eef0'), h);
            I.box(G, L, X + u + 0.01, gy + 0.19, 0.12, 0.12, 3, boxCols(col), h);
            I.box(G, L, X + u - 0.01, gy + 0.17, 0.16, 0.16, 1, boxCols('#8a5a3a'), h + 5);
          });
          const fb = P(X + 2.75, gy + 0.3, h);
          IS.Sprites.ellipse(G, Math.round(fb.x), Math.round(fb.y) - 1, 4, 2, '#b8884a');
          px(G, fb, -2, -4, 2, 2, '#e8483a'); px(G, fb, 0, -4, 2, 2, '#ffb040'); px(G, fb, 1, -5, 2, 2, '#8ad050');
        }); break;
        case 'bookcase': piece(G => {
          const gx = X + 0.08, gy = Y, w = 0.84, d = 0.4, h = 32;
          I.box(G, L, gx, gy, w, d, h, boxCols('#7a4a2e'));
          const fF = (u0, u1, h0, h1, col) => faceFill(G, L(gx + u0, gy + d), L(gx + u1, gy + d), h0, h1, col);
          fF(0.07, w - 0.07, 2, h - 2, '#3a2430');
          for (const hs of [2, 9, 16, 23]) {
            fF(0.07, w - 0.07, hs, hs + 1, '#a06a42');
            let u = 0.08;
            while (u < w - 0.12) {
              const bw = rnd() < 0.6 ? 0.0625 : 0.125, bh = 4 + Math.floor(rnd() * 3);
              if (rnd() < 0.08) { u += 0.0625; continue; }
              const col = BOOKS[Math.floor(rnd() * BOOKS.length)];
              fF(u, u + bw, hs + 1, hs + 1 + bh, col);
              fF(u, u + bw, hs + bh, hs + 1 + bh, I.lit(col, 0.35));
              u += bw;
            }
          }
          I.box(G, L, gx - 0.04, gy, w + 0.08, d + 0.05, 2, boxCols('#8a5634', '#a87048'), h);
          const tp = P(gx + w / 2, gy + d / 2, h + 2);
          if (f.top === 'globe') {
            px(G, tp, -1, -2, 3, 2, '#6a4030');
            IS.Sprites.disc(G, Math.round(tp.x), Math.round(tp.y) - 6, 3, '#4a8ad0');
            px(G, tp, -2, -8, 2, 2, '#6ac060'); px(G, tp, 1, -6, 2, 2, '#6ac060');
          } else {
            px(G, tp, -2, -4, 5, 4, '#c8643e');
            IS.Sprites.disc(G, Math.round(tp.x), Math.round(tp.y) - 6, 3, '#3f9a4a');
            px(G, tp, 2, -4, 1, 6, '#3f9a4a'); px(G, tp, 3, 1, 1, 4, '#3f9a4a'); px(G, tp, -3, -3, 1, 5, '#3f9a4a');
            px(G, tp, -1, -8, 2, 2, '#8fd65a');
          }
        }); break;
        case 'logBasket': piece(G => {
          I.box(G, L, X + 0.15, Y + 0.12, 0.6, 0.42, 6, boxCols('#b8884a', '#9a6a3a'));
          faceFill(G, L(X + 0.15, Y + 0.54), L(X + 0.75, Y + 0.54), 3, 4, '#8a5a30');
          for (const [u, v, z] of [[0.3, 0.3, 6], [0.5, 0.3, 6], [0.4, 0.3, 9], [0.62, 0.32, 7]]) {
            const p = P(X + u, Y + v, z); IS.Sprites.disc(G, Math.round(p.x), Math.round(p.y), 2, '#8a5434'); px(G, p, 0, 0, 1, 1, '#e0b070');
          }
        }); break;
        case 'hearth': piece(G => {
          const gx = X + 0.02, gy = Y, w = f.w - 0.04, d = 0.42;
          const brick = '#b45a40', mort = '#8a3e34';
          I.box(G, L, gx, gy, w, d, WH, boxCols(brick));
          for (let h = 2, i = 0; h < WH - 1; h += 3, i++) {
            pline(G, P(gx, gy + d, h), P(gx + w, gy + d, h), mort);
            pline(G, P(gx + w, gy + d, h), P(gx + w, gy, h), I.shade(mort, 0.3));
            for (let u = (i % 2) * 0.125 + 0.06; u < w; u += 0.25) faceFill(G, L(gx + u, gy + d), L(gx + u + 0.0625, gy + d), h + 1, h + 3, mort);
          }
          for (let i = 0; i < 16; i++) { const u = rnd() * (w - 0.2), h = 3 + Math.floor(rnd() * 13) * 3; faceFill(G, L(gx + u, gy + d), L(gx + u + 0.18, gy + d), h, h + 2, rnd() < 0.5 ? '#c86a4a' : '#a04a3a'); }
          // stone arch and firebox with logs and flames
          const fa = gx + 0.42, fb = gx + w - 0.42, fF = (u0, u1, h0, h1, col) => faceFill(G, L(u0, gy + d), L(u1, gy + d), h0, h1, col);
          fF(fa - 0.12, fb + 0.12, 0, archT(16, 4), '#d8ccc0');
          fF(fa - 0.12, fb + 0.12, 0, 1, '#a89cb8');
          const kp = P((fa + fb) / 2, gy + d, 20); px(G, kp, -1, -1, 3, 2, '#efe6dc');
          fF(fa, fb, 1, archT(14, 3), '#2a1824');
          fF(fa, fb, 1, 9, '#5a2a24');
          fF(fa, fb, 1, 4, '#8a3a24');
          const fl = [[0.15, 7], [0.3, 11], [0.45, 9], [0.6, 12], [0.75, 8], [0.88, 6]];
          for (const [t, hh] of fl) {
            const u = fa + (fb - fa) * t;
            fF(u - 0.06, u + 0.06, 3, hh, '#ff7a2a');
            fF(u - 0.03, u + 0.04, 3, hh - 3, '#ffd060');
          }
          fF(fa + 0.08, fb - 0.08, 1, 3, '#6a3a24');
          fF(fa + 0.2, fb - 0.3, 2, 4, '#8a5434');
          fF(fa + 0.1, fb - 0.1, 3, 4, '#ffb040');
          // hearth slab and glow
          I.box(G, L, gx - 0.12, gy + d, w + 0.24, 0.36, 2, boxCols('#b8aec4', '#d4cce0'));
          for (let i = 0; i < 6; i++) px(G, P(fa + (fb - fa) * (i / 5), gy + d + 0.15, 2), 0, 0, 2, 1, '#f0b890');
          // fire irons
          px(G, P(gx + 0.12, gy + d + 0.18, 0), 0, -12, 1, 12, '#3a2a40'); px(G, P(gx + 0.12, gy + d + 0.18, 0), -1, -13, 3, 1, '#3a2a40');
          // mantel shelf with candles, a jar and a small clock
          I.box(G, L, gx - 0.1, gy + d - 0.06, w + 0.2, 0.22, 3, boxCols('#7a4a2e', '#a06a42'), 22);
          for (const u of [0.1, w - 0.15]) { const p = P(gx + u, gy + d + 0.05, 25); px(G, p, -1, -1, 3, 1, '#d8a040'); px(G, p, 0, -5, 1, 4, '#fff4dc'); px(G, p, 0, -7, 1, 2, '#ffb040'); }
          const mc = P(gx + w / 2, gy + d + 0.04, 25); px(G, mc, -3, -6, 7, 6, '#7a4a2e'); px(G, mc, -2, -5, 5, 4, '#fff6e0'); px(G, mc, 0, -4, 1, 2, '#3a2a40'); px(G, mc, 0, -3, 2, 1, '#3a2a40');
          const vj = P(gx + w * 0.28, gy + d + 0.05, 25); px(G, vj, -1, -4, 3, 4, '#5a8ac8'); px(G, vj, -2, -6, 2, 2, '#ff7aa8'); px(G, vj, 1, -7, 2, 2, '#ffd060');
          // painting of the island and its lighthouse
          const pa = gx + 0.36, pb = gx + w - 0.36, pF = (u0, u1, h0, h1, col) => faceFill(G, L(pa + (pb - pa) * u0, gy + d), L(pa + (pb - pa) * u1, gy + d), h0, h1, col);
          pF(-0.04, 1.04, 28, 42, '#d8a040'); pF(-0.04, 1.04, 28, 29, '#a87020');
          pF(0, 1, 29, 41, '#ffc890'); pF(0, 1, 34, 41, '#98d0f0'); pF(0, 1, 38, 41, '#c8e8fa');
          pF(0, 1, 29, 32, '#3f6ab0'); pF(0, 1, 31, 32, '#7aa8e0');
          pF(0.1, 0.62, 31, t => 33 + 3 * Math.sin(Math.PI * t), '#5aa048');
          pF(0.45, 0.52, 34, 39, '#fff4ec'); pF(0.45, 0.52, 36, 37, '#d84a3a'); pF(0.45, 0.52, 39, 40, '#ffd060');
          pF(0.75, 0.85, 33, 34, '#ffffff');
        }); break;
        case 'teaTable': piece(G => {
          const gx = X + 0.1, gy = Y + 0.18, w = 0.5, d = 0.64;
          for (const [a, z] of [[0, d - 0.07], [w - 0.07, d - 0.07], [w - 0.07, 0]]) I.box(G, L, gx + a, gy + z, 0.07, 0.07, 9, boxCols('#6e3e26'));
          I.box(G, L, gx, gy, w, d, 2, boxCols('#9a5a34', '#c08050'), 9);
          I.box(G, L, gx + 0.1, gy + 0.12, 0.26, 0.26, 7, boxCols('#c87a3a', '#e8a060'), 11);
          I.box(G, L, gx + 0.14, gy + 0.16, 0.18, 0.18, 2, boxCols('#a85a2a'), 18);
          const tp = P(gx + 0.36, gy + 0.38, 13); px(G, tp, 0, 0, 2, 1, '#3a2a40');
          for (const v of [0.48, 0.58]) { const p = P(gx + 0.25, gy + v, 11); px(G, p, -1, -2, 3, 2, '#fff4ec'); px(G, p, -1, -2, 3, 1, '#e86a5a'); }
        }); break;
        case 'banquet': piece(G => {
          const gx = X + 0.06, gy = Y + 0.08, w = f.w - 0.12, d = 0.84, h = 10;
          const cloth = '#f8ecd6', clothS = '#ead8bc', clothE = I.shade('#ead8bc', 0.28);
          for (const u of [0.1, w / 2, w - 0.18]) I.box(G, L, gx + u, gy + d - 0.14, 0.08, 0.08, h - 4, boxCols('#6e3e26'));
          I.box(G, L, gx + w - 0.18, gy + 0.08, 0.08, 0.08, h - 4, boxCols('#6e3e26'));
          I.box(G, L, gx, gy, w, d, 5, { top: cloth, left: clothS, right: clothE }, h - 5);
          // scalloped hem
          for (let u = 0; u < w - 0.05; u += 0.25) faceFill(G, L(gx + u + 0.04, gy + d), L(gx + u + 0.21, gy + d), h - 6, h - 5, clothS);
          for (let v = 0; v < d - 0.05; v += 0.28) faceFill(G, L(gx + w, gy + d - v - 0.04), L(gx + w, gy + d - v - 0.22), h - 6, h - 5, clothE);
          // red runner down the middle, hanging over the east end
          poly(G, [P(gx, gy + 0.34, h), P(gx + w, gy + 0.34, h), P(gx + w, gy + 0.5, h), P(gx, gy + 0.5, h)], '#b8403a');
          pline(G, P(gx, gy + 0.34, h), P(gx + w, gy + 0.34, h), '#e8b050');
          faceFill(G, L(gx + w, gy + 0.5), L(gx + w, gy + 0.34), h - 7, h, '#8a3030');
          // candelabras, bread, flowers, fruit
          const T = (gxx, dy = 0) => P(x0 + gxx, gy + 0.42, h + dy);
          for (const cx of [f.c + 1.0, f.c + 5.0]) {
            const p = T(cx);
            px(G, p, -2, -1, 5, 1, '#c89030'); px(G, p, 0, -4, 1, 3, '#c89030'); px(G, p, -2, -5, 5, 1, '#c89030');
            for (const dx of [-2, 0, 2]) { px(G, p, dx, -9 - (dx === 0 ? 1 : 0), 1, 4 + (dx === 0 ? 1 : 0), '#fff4dc'); px(G, p, dx, -11 - (dx === 0 ? 1 : 0), 1, 2, '#ffb040'); }
          }
          { const p = T(f.c + 2.0); IS.Sprites.ellipse(G, Math.round(p.x), Math.round(p.y) - 1, 3, 1, '#b8884a'); px(G, p, -2, -3, 4, 2, '#e0a050'); px(G, p, -1, -4, 2, 1, '#f0c070'); }
          { const p = T(f.c + 3.0); px(G, p, -1, -4, 3, 4, '#4a7ac8'); px(G, p, -1, -4, 1, 4, '#7aa0e0');
            for (const [dx, dy, col] of [[-3, -7, '#ff6a7a'], [-1, -9, '#ffd060'], [1, -8, '#ffffff'], [2, -6, '#ff8ab0'], [-2, -5, '#c58aff'], [0, -11, '#ff6a7a']]) px(G, p, dx, dy, 2, 2, col);
            px(G, p, -4, -5, 1, 2, '#4a9a4a'); px(G, p, 3, -4, 1, 2, '#4a9a4a'); }
          { const p = T(f.c + 4.0); IS.Sprites.ellipse(G, Math.round(p.x), Math.round(p.y) - 1, 3, 1, '#f4f0e8'); px(G, p, -2, -3, 2, 2, '#e8483a'); px(G, p, 0, -3, 2, 2, '#8ad050'); px(G, p, -1, -4, 2, 2, '#ffb040'); }
        }); break;
        case 'hallChair': piece(G => {
          const wood = '#b87442', woodLit = '#dc9a5c', cushion = f.cushion || '#3f8a7a';
          const sx = X + 0.25, sw = 0.5, sy = Y + 0.27, sd = 0.46, legC = boxCols('#8a5232');
          const backN = f.face === 'down';
          const backrest = by => {
            I.box(G, L, sx, by, 0.07, 0.07, 15, boxCols(wood));
            I.box(G, L, sx + sw - 0.07, by, 0.07, 0.07, 15, boxCols(wood));
            I.box(G, L, sx, by, sw, 0.07, 3, boxCols(wood, woodLit), 12);
          };
          for (const [a, z] of [[0, 0], [sw - 0.07, 0], [0, sd - 0.07], [sw - 0.07, sd - 0.07]]) I.box(G, L, sx + a, sy + z, 0.07, 0.07, 5, legC);
          if (backN) backrest(sy);
          I.box(G, L, sx, sy, sw, sd, 2, boxCols(wood, woodLit), 5);
          I.box(G, L, sx + 0.05, sy + 0.05, sw - 0.1, sd - 0.1, 1, boxCols(cushion, I.lit(cushion, 0.2)), 7);
          if (!backN) backrest(sy + sd - 0.07);
        }); break;
        case 'lectern': piece(G => {
          I.box(G, L, X + 0.06, Y - 0.16, 0.88, 1.32, 3, boxCols('#8a5634', '#b07a48'));
          faceFill(G, L(X + 0.06, Y + 1.16), L(X + 0.94, Y + 1.16), 1, 2, '#e8b050');
          I.box(G, L, X + 0.3, Y + 0.3, 0.4, 0.4, 2, boxCols('#6e3e26'), 3);
          I.box(G, L, X + 0.43, Y + 0.43, 0.14, 0.14, 11, boxCols('#7a4a2e'), 5);
          I.box(G, L, X + 0.26, Y + 0.28, 0.48, 0.44, 3, boxCols('#8a5634', '#a87048'), 16);
          const bk = P(X + 0.5, Y + 0.5, 19); px(G, bk, -3, -1, 3, 2, '#fff4dc'); px(G, bk, 1, -2, 3, 2, '#fff4dc'); px(G, bk, 0, -1, 1, 2, '#c8a070'); px(G, bk, -2, 1, 6, 1, '#c8443a');
          const cd = P(X + 0.3, Y + 0.32, 19); px(G, cd, 0, -4, 1, 4, '#fff4dc'); px(G, cd, 0, -6, 1, 2, '#ffb040');
        }); break;
        case 'bigPlant': piece(G => {
          const gx = X + 0.5, gy = Y + 0.45;
          I.box(G, L, gx - 0.24, gy - 0.24, 0.48, 0.48, 9, boxCols('#c8643e'));
          I.box(G, L, gx - 0.28, gy - 0.28, 0.56, 0.56, 2, boxCols('#d87a50', '#7a4a30'), 9);
          faceFill(G, L(gx - 0.24, gy + 0.24), L(gx + 0.24, gy + 0.24), 4, 5, '#e8a070');
          const base = P(gx, gy, 11), bx = Math.round(base.x), by = Math.round(base.y);
          const r = IS.mulberry32(f.c * 7 + f.r);
          for (let i = 0; i < 9; i++) {
            const a = -Math.PI / 2 + (i - 4) * 0.36, len = 10 + r() * 9;
            const tx = bx + Math.cos(a) * len * 0.8, ty = by + Math.sin(a) * len;
            pline(G, { x: bx, y: by }, { x: tx, y: ty }, '#2f6a3a');
            IS.Sprites.ellipse(G, Math.round(tx), Math.round(ty), 3, 2, i % 2 ? '#3f9a4a' : '#358a42');
            G.fillStyle = '#8fd65a'; G.fillRect(Math.round(tx) - 1, Math.round(ty) - 1, 2, 1);
          }
          IS.Sprites.disc(G, bx, by - 6, 4, '#3f9a4a'); G.fillStyle = '#8fd65a'; G.fillRect(bx - 2, by - 8, 2, 1);
        }); break;
      }
    }

    // ---- front stub walls: panelled wainscot
    const doors = (b.doorCols || []).map(cIdx => b.x0 + cIdx);
    const stub = { top: '#c88c56', left: '#8c5634', right: I.shade('#8c5634', 0.3) };
    for (let x = x0 + 1; x <= x1; x++) if (!doors.includes(x)) {
      I.box(front.g, L, x, y1, 1, 1, 9, stub);
      for (const u of [0.1, 0.55]) faceFill(front.g, L(x + u, y1 + 1), L(x + u + 0.35, y1 + 1), 2, 7, '#74462a');
    }
    for (let y = y0 + 1; y < y1; y++) {
      I.box(front.g, L, x1, y, 1, 1, 9, stub);
      for (const u of [0.1, 0.55]) faceFill(front.g, L(x1 + 1, y + 1 - u), L(x1 + 1, y + 1 - u - 0.35), 2, 7, I.shade('#74462a', 0.3));
    }
    I.crisp(c);
    I.crisp(front.c);
    return { canvas: c, front: front.c };
  };

  return I;
})();
