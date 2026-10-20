// The island: terrain, buildings, props, activity spots, pathfinding.
IS.TT = { DEEP: 0, SHALLOW: 1, SAND: 2, GRASS: 3, FOREST: 4, PATH: 5, PLAZA: 6, FLOOR: 7, DOCK: 8, FARM: 9, WALL: 10 };

IS.World = class {
  constructor() {
    // The village keeps its old 80x60 corner; the rest is the wild east
    this.W = 160;
    this.H = 120;
    IS.Iso.setup(this);
    this.tiles = new Uint8Array(this.W * this.H);
    this.blocked = new Uint8Array(this.W * this.H);
    this.costExtra = new Float32Array(this.W * this.H);
    this.objects = [];   // depth-sorted props
    this.decals = [];    // flat things baked into the ground
    this.buildings = [];
    this.spots = {};
    this.lamps = [];
    this.pois = [];
    this.crops = [];
    this.food = IS.CONFIG.startFood;
    this.wood = IS.CONFIG.startWood;
    this.generate();
  }

  idx(x, y) { return y * this.W + x; }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.W && y < this.H; }
  tile(x, y) { return this.inb(x, y) ? this.tiles[this.idx(x, y)] : IS.TT.DEEP; }
  setT(x, y, t) { if (this.inb(x, y)) this.tiles[this.idx(x, y)] = t; }
  isWater(x, y) { const t = this.tile(x, y); return t === IS.TT.DEEP || t === IS.TT.SHALLOW; }
  isLand(x, y) { return !this.isWater(x, y); }
  walkable(x, y) {
    if (!this.inb(x, y)) return false;
    const i = this.idx(x, y);
    const t = this.tiles[i];
    if (t === IS.TT.DEEP || t === IS.TT.SHALLOW || t === IS.TT.WALL) return false;
    return !this.blocked[i];
  }
  swimmable(x, y) { return this.inb(x, y) && this.isWater(x, y); }
  cost(x, y) {
    const t = this.tile(x, y);
    const base = { 0: 5, 1: 3, 2: 1.7, 3: 1.5, 4: 2.2, 5: 1, 6: 1, 7: 1.2, 8: 1, 9: 2, 10: 99 }[t];
    return base + this.costExtra[this.idx(x, y)];
  }

  // ------------------------------------------------------------------
  generate() {
    const TT = IS.TT, W = this.W, H = this.H;
    const n1 = IS.makeNoise(7), n2 = IS.makeNoise(19), n3 = IS.makeNoise(31);
    const rng = IS.mulberry32(1234);
    this.rng = rng;

    // Smooth curve through points, used for the trail and the bay's north shore
    const curve = pts => x => {
      if (x <= pts[0][0]) return pts[0][1];
      for (let k = 1; k < pts.length; k++) if (x <= pts[k][0]) {
        const [x0, y0] = pts[k - 1], [x1, y1] = pts[k], t = (1 - Math.cos(Math.PI * (x - x0) / (x1 - x0))) / 2;
        return y0 + (y1 - y0) * t;
      }
      return pts[pts.length - 1][1];
    };
    const ridgeY = curve([[54, 13], [66, 11], [80, 10], [94, 12], [108, 16]]);
    // The north woods join village and wild east into one island; the sea between them is a bay
    const bayN = curve([[50, 13], [62, 16], [72, 19], [86, 21], [100, 26], [114, 30]]);

    // 1. Island shape
    const land = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = (x - 40) / 31, dy = (y - 30) / 23;
      const r = Math.sqrt(dx * dx + dy * dy);
      const n = (n1(x * 0.12, y * 0.12) - 0.5) * 0.28 + (n2(x * 0.3, y * 0.3) - 0.5) * 0.1;
      let isLand = r < 0.9 + n;
      // lighthouse point to the east
      const px = (x - 70) / 6, py = (y - 22) / 3.2;
      if (px * px + py * py < 1) isLand = true;
      if (x >= 12 && x <= 67 && y >= 19 && y <= 43) isLand = true;
      // The wild east: a big landmass, joined to the village by a ridge in the northeast
      const ex = (x - 116) / 42, ey = (y - 60) / 56;
      if (Math.sqrt(ex * ex + ey * ey) < 0.9 + n) isLand = true;
      if (x >= 50 && x <= 114 && y >= 7 && y <= 7 + (bayN(x) - 7) * 1.5 + n * 10) isLand = true;
      if (x < 3 || y < 3 || x > W - 12 || y > H - 12) isLand = false; // the far edges need open sea or the ground smears past the map
      land[y * W + x] = isLand ? 1 : 0;
    }
    // Open sea is the water joined to the map edge; worked out before lakes and rivers are carved, so they never count as sea
    const sea = new Uint8Array(W * H);
    sea[0] = 1;
    const sq = [0];
    while (sq.length) {
      const i = sq.pop(), x = i % W, y = (i / W) | 0;
      for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + ax, ny = y + ay, j = ny * W + nx;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H && !land[j] && !sea[j]) { sea[j] = 1; sq.push(j); }
      }
    }
    this.sea = sea;

    // Lakes and rivers in the wild east
    const nLake = IS.makeNoise(211);
    const dig = (cx, cy, rx, ry) => {
      for (let y = Math.floor(cy - ry - 2); y <= cy + ry + 2; y++) for (let x = Math.floor(cx - rx - 2); x <= cx + rx + 2; x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        if (this.inb(x, y) && dx * dx + dy * dy < 1 + (nLake(x * 0.3, y * 0.3) - 0.5) * 0.6) land[y * W + x] = 0;
      }
    };
    const river = (pts, r) => {
      for (let k = 1; k < pts.length; k++) {
        const [x0, y0] = pts[k - 1], [x1, y1] = pts[k], n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
        for (let s = 0; s <= n; s++) dig(x0 + (x1 - x0) * s / n, y0 + (y1 - y0) * s / n, r, r);
      }
    };
    dig(118, 72, 9, 6); dig(106, 90, 5, 4);
    river([[126, 70], [133, 66], [140, 69], [149, 65]], 1.4); // the big lake drains east to the sea
    river([[122, 38], [118, 47], [121, 55], [117, 65]], 1); // a stream feeds it from the north woods, well away from the bay

    // 2. Distance fields
    const bfs = (sourceIsLand) => {
      const d = new Int16Array(W * H).fill(-1);
      const q = [];
      for (let i = 0; i < W * H; i++) if (land[i] === (sourceIsLand ? 1 : 0)) { d[i] = 0; q.push(i); }
      for (let h = 0; h < q.length; h++) {
        const i = q[h], x = i % W, y = (i / W) | 0;
        for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + ax, ny = y + ay;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx;
          if (d[j] < 0) { d[j] = d[i] + 1; q.push(j); }
        }
      }
      return d;
    };
    this.waterDist = bfs(true);   // for water tiles: distance to land
    const landDist = bfs(false);  // for land tiles: distance to water
    this.landDist = landDist;

    this.cliffy = new Uint8Array(W * H);
    const nCliff = IS.makeNoise(173);
    const nearSea = (x, y) => { for (let b = -5; b <= 5; b++) for (let a = -5; a <= 5; a++) { const xx = x + a, yy = y + b; if (xx >= 0 && yy >= 0 && xx < W && yy < H && sea[yy * W + xx]) return true; } return false; };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!land[i]) { this.tiles[i] = this.waterDist[i] <= 3 ? TT.SHALLOW : TT.DEEP; continue; }
      const ld = landDist[i];
      const highland = (x >= 96 || y >= 64) && nCliff(x * 0.05, y * 0.05) > 0.5 && ld <= 4 && nearSea(x, y);
      if (highland) { this.tiles[i] = TT.GRASS; if (ld <= 2) this.cliffy[i] = 1; }
      else if ((ld <= 1 || (y >= 43 && ld <= 3) || (y >= 46 && ld <= 4)) && (x < 80 && y < 60 || nearSea(x, y))) this.tiles[i] = TT.SAND; // lakes get grassy banks
      else this.tiles[i] = TT.GRASS;
    }
    // Spread the cliff mark two tiles, water included: the drawn shoreline wobbles, and the renderer
    // looks up whatever tile sits under the edge pixel; a gap there turns the cliff face into a comb
    for (let pass = 0; pass < 2; pass++) {
      const cl0 = this.cliffy.slice();
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (cl0[y * W + x - 1] || cl0[y * W + x + 1] || cl0[(y - 1) * W + x] || cl0[(y + 1) * W + x]) this.cliffy[y * W + x] = 1;
    }
    // 3. Forest regions
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (this.tile(x, y) !== TT.GRASS) continue;
      const n = n3(x * 0.15, y * 0.15);
      const north = y < 20 - n * 4;
      const west = x < 19 + n * 3 && y < 38;
      const ne = x > 60 && y < 20 && !(x > 64 && y > 17);
      // The wild east: big forests with open meadows between them
      const wild = (x >= 80 || y >= 60) && n3(x * 0.045 + 40, y * 0.045) > 0.42;
      if (north || west || ne || wild) this.setT(x, y, TT.FOREST);
    }

    // 4. Buildings
    const roofs = ['#e2523f', '#3f86dc', '#3fae5a', '#a95fd6'];
    const walls = ['#fde9c4', '#f9e4cf', '#fff0d2', '#fbe0c8'];
    const houseX = [15, 24, 51, 60];
    for (let i = 0; i < 4; i++) {
      this.addBuilding({ id: 'house' + i, kind: 'house', x0: houseX[i], y0: 26, w: 6, h: 5, doorCols: [2], roof: roofs[i], wall: walls[i], index: i });
    }
    this.addBuilding({ id: 'hall', kind: 'hall', x0: 35, y0: 23, w: 10, h: 7, doorCols: [4, 5], roof: '#c25a3c', wall: '#f4e2bc' });

    // 5. Village ground: plaza, road, connectors
    const paint = (x, y, t, onlyLand = true) => {
      if (!this.inb(x, y)) return;
      const cur = this.tile(x, y);
      if (cur === TT.WALL || cur === TT.FLOOR) return;
      if (onlyLand && this.isWater(x, y)) return;
      this.setT(x, y, t);
    };
    for (let y = 30; y <= 34; y++) for (let x = 33; x <= 46; x++) paint(x, y, TT.PLAZA);
    for (let x = 13; x <= 67; x++) if (this.tile(x, 32) !== TT.PLAZA) paint(x, 32, TT.PATH);
    for (const b of this.buildings) for (const d of b.doors) for (let y = d.y + 1; y < 32; y++) if (this.tile(d.x, y) !== TT.PLAZA) paint(d.x, y, TT.PATH);

    // Decorative buildings fill out the village (not enterable)
    const freeRect = (x0, y0, w, h) => {
      for (let yy = y0 - 1; yy <= y0 + h; yy++) for (let xx = x0 - 1; xx <= x0 + w; xx++) {
        const t = this.tile(xx, yy);
        if (![TT.GRASS, TT.FOREST, TT.SAND].includes(t)) return false;
      }
      return true;
    };
    for (const d of [
      { id: 'cafe', deco: 'cafe', x0: 30, y0: 18, w: 5, h: 4, doorCols: [2], roof: '#e8584a', wall: '#fff0d8' },
      { id: 'boathouse', deco: 'boathouse', x0: 44, y0: 38, w: 4, h: 3, doorCols: [1], roof: '#3f6ad8', wall: '#e8dcc8' },
      { id: 'greenhouse', deco: 'greenhouse', x0: 20, y0: 35, w: 4, h: 3, doorCols: [1], roof: '#9fe0e8', wall: '#dff6f8' },
      { id: 'shed', deco: 'shed', x0: 55, y0: 35, w: 3, h: 3, doorCols: [1], roof: '#b06a3a', wall: '#d8b088' },
      { id: 'store', deco: 'cafe', x0: 55, y0: 18, w: 5, h: 4, doorCols: [2], roof: '#5f4ab8', wall: '#fbe6cc' },
    ]) if (freeRect(d.x0, d.y0, d.w, d.h)) this.addBuilding({ kind: 'deco', ...d });

    // Farm
    this.farm = { x0: 26, y0: 36, x1: 33, y1: 39 };
    for (let y = 36; y <= 39; y++) for (let x = 26; x <= 33; x++) paint(x, y, TT.FARM);
    for (let y = 33; y <= 35; y++) paint(29, y, TT.PATH);

    // Dock: path south from plaza, then planks over water, T-shaped end
    let y = 35, dockRows = 0;
    while (y < H - 2 && dockRows < 8) {
      for (const x of [39, 40]) {
        if (this.isLand(x, y)) paint(x, y, TT.PATH); else { this.setT(x, y, TT.DOCK); }
      }
      if (this.isWater(39, y) || this.tile(39, y) === TT.DOCK) dockRows++;
      y++;
    }
    const dockEnd = y - 1;
    for (let yy = dockEnd - 1; yy <= dockEnd; yy++) for (let x = 36; x <= 43; x++) if (this.isWater(x, yy) || this.tile(x, yy) === TT.DOCK) this.setT(x, yy, TT.DOCK);
    this.dock = { x: 39, endY: dockEnd, startY: dockEnd - dockRows + 1 };

    // Trails: north to the Old Oak clearing, west to the meadow, east to the lighthouse
    const line = (x0, y0, x1, y1, t = TT.PATH) => {
      let x = x0, yy = y0;
      while (x !== x1) { paint(x, yy, t); x += Math.sign(x1 - x); }
      while (yy !== y1) { paint(x, yy, t); yy += Math.sign(y1 - yy); }
      paint(x1, y1, t);
    };
    line(48, 31, 48, 15); line(48, 15, 31, 15); line(31, 15, 31, 13);
    const oak = { x: 28, y: 11 };
    for (let yy = 8; yy <= 15; yy++) for (let x = 24; x <= 34; x++) {
      if ((x - 29) ** 2 / 25 + (yy - 12) ** 2 / 12 <= 1 && this.tile(x, yy) === TT.FOREST) this.setT(x, yy, TT.GRASS);
    }
    line(18, 33, 18, 38);
    // Trail from the north trail along the ridge into the east woods
    // A footpath through waypoints: long straight runs with even sidesteps, so it bends instead of zig-zagging
    const trail = pts => {
      for (let k = 1; k < pts.length; k++) {
        const [x0, y0] = pts[k - 1], [x1, y1] = pts[k];
        const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
        let x = x0, yy = y0;
        paint(x, yy, TT.PATH);
        while (x !== x1 || yy !== y1) {
          if (yy === y1 || (x !== x1 && Math.abs(x - x0) / dx <= Math.abs(yy - y0) / dy)) x += Math.sign(x1 - x); else yy += Math.sign(y1 - yy);
          paint(x, yy, TT.PATH);
        }
      }
    };
    const ridgeTrail = [[48, 15]];
    for (let x = 54; x <= 102; x += 6) ridgeTrail.push([x, Math.round(ridgeY(x))]);
    trail([...ridgeTrail, [104, 16], [105, 21], [104, 26]]);
    // Lighthouse on the eastern point
    let lh = null;
    for (let x = 79; x > 50 && !lh; x--) for (let yy = 19; yy <= 25; yy++) {
      if (this.isLand(x, yy) && landDist[this.idx(x, yy)] >= 2 && landDist[this.idx(x, yy)] <= 3) { lh = { x, y: yy }; break; } // on the shore, not inland
    }
    lh = lh || { x: 70, y: 22 };
    this.lighthouseTile = lh;
    line(67, 32, 67, lh.y + 1); line(67, lh.y + 1, lh.x, lh.y + 1);

    // 6. Fixed props
    const protect = new Uint8Array(W * H); // tiles where scatter must not go
    const prot = (x, y, r = 0) => { for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) if (this.inb(xx, yy)) protect[this.idx(xx, yy)] = 1; };
    for (let yy = 0; yy < H; yy++) for (let x = 0; x < W; x++) {
      const t = this.tile(x, yy);
      if (t === TT.PATH || t === TT.PLAZA || t === TT.FARM || t === TT.DOCK) prot(x, yy, 1);
      if (t === TT.WALL || t === TT.FLOOR) prot(x, yy, 1);
    }
    for (const b of this.buildings) for (const d of b.doors) prot(d.x, d.y + 1, 1);

    // Terraces in the wild east: smooth hills become flat levels nested inside each other, so every
    // wall is one step tall. Walls are walked around; stairs cut into the front faces lead up.
    const STEP = 16; // screen px per level
    const elev = new Uint8Array(W * H), nHill = IS.makeNoise(241);
    // Valley floors stay open so the wild east is always walkable from end to end
    const valley = new Uint8Array(W * H);
    for (const line of [[[104, 26], [104, 40], [112, 52], [118, 62]], [[104, 40], [96, 58], [100, 80], [118, 92], [134, 99]], [[118, 62], [138, 56]]]) {
      for (let k = 1; k < line.length; k++) {
        const [x0, y0] = line[k - 1], [x1, y1] = line[k], n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
        for (let s = 0; s <= n; s++) {
          const cx = Math.round(x0 + (x1 - x0) * s / n), cy = Math.round(y0 + (y1 - y0) * s / n);
          for (let b = -8; b <= 8; b++) for (let a = -8; a <= 8; a++) if (a * a + b * b <= 42 && this.inb(cx + a, cy + b)) valley[(cy + b) * W + cx + a] = 1;
        }
      }
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!land[i] || x < 86 || y < 32 || valley[i]) continue;
      const e = nHill(x * 0.045, y * 0.045) * 0.75 + nHill(x * 0.11 + 9, y * 0.11) * 0.25;
      elev[i] = Math.max(0, Math.min(e > 0.62 ? 3 : e > 0.56 ? 2 : e > 0.5 ? 1 : 0, Math.floor((landDist[i] - 2) / 2)));
    }
    const n8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    for (let pass = 0; pass < 4; pass++) {
      const e0 = elev.slice(); // read the last pass, not this one, or the erosion snowballs
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (!e0[i]) continue;
      let lo = 9, same = 0;
      for (const [a, b] of n8) { const v = e0[i + b * W + a]; if (v >= e0[i]) same++; }
      // rings at least three tiles wide, so a stair always has solid ground in front of it
      for (let b = -3; b <= 3; b++) for (let a = -3; a <= 3; a++) if (this.inb(x + a, y + b)) lo = Math.min(lo, e0[i + b * W + a]);
      if (e0[i] > lo + 1) elev[i] = lo + 1; // one step at a time
      else if (same < 5) elev[i] = e0[i] - 1; // no slivers or lone pillars
      }
    }
    const rim = new Uint8Array(W * H), stairs = new Uint8Array(W * H), hidden = new Uint8Array(W * H);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (elev[i] && (elev[i - 1] < elev[i] || elev[i + 1] < elev[i] || elev[i - W] < elev[i] || elev[i + W] < elev[i])) rim[i] = 1;
    }
    // Stairs: on front faces (stepping down toward +x or +y), between a terrace and the level just below
    const used = [];
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
      const i = y * W + x, L = elev[i];
      if (!rim[i] || IS.hash2(x, y, 77) > 0.6) continue;
      for (const [a, b, dir] of [[1, 0, 1], [0, 1, 2]]) {
        const f = i + b * W + a, back = i - b * W - a;
        if (elev[f] !== L - 1 || rim[f] && elev[f] > 0 || elev[back] !== L || rim[back] || !land[f]) continue;
        if (used.some(u => u.L === L && Math.abs(u.x - x) + Math.abs(u.y - y) < 9)) continue;
        stairs[i] = dir; used.push({ x, y, L });
        break;
      }
    }
    // Ground hidden behind a terrace on screen: nobody can stand there and nothing grows there
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const L = elev[y * W + x];
      if (!L) continue;
      for (let a = 0; a <= 4; a++) for (let b = 0; b <= 4; b++) {
        const xx = x - a, yy = y - b;
        if ((a || b) && Math.abs(a - b) <= 1 && this.inb(xx, yy) && elev[yy * W + xx] < L && a + b <= 2 * (L - elev[yy * W + xx]) + 1) hidden[yy * W + xx] = 1;
      }
    }
    for (let i = 0; i < W * H; i++) {
      if ((rim[i] && !stairs[i]) || hidden[i]) this.blocked[i] = 1;
      if (stairs[i]) { protect[i] = 1; protect[i + (stairs[i] === 1 ? 1 : W)] = 1; protect[i - (stairs[i] === 1 ? 1 : W)] = 1; }
    }
    let maxL = 0;
    for (let i = 0; i < W * H; i++) maxL = Math.max(maxL, elev[i]);
    Object.assign(this, { elev, stairs, hidden, STEP, maxElev: maxL });
    // Everything drawn at a world position is lifted to the ground it stands on
    IS.Iso.lift = (wx, wy) => this.liftAt(wx, wy);
    IS.Iso.levelAt = (x, y) => (this.inb(x, y) ? elev[y * W + x] : 0);
    IS.Iso.maxLevel = maxL; IS.Iso.STEP = STEP;

    const S = IS.Sprites;
    const T = IS.TILE;
    const place = (kind, tx, ty, sprite, ax, ay, opts = {}) => {
      const o = { kind, tx, ty, x: tx * T + 12 + (opts.dx || 0), y: ty * T + (opts.footY ?? 20), sprite, ax, ay, ...opts };
      o.sortY = o.y + (opts.sortBias || 0);
      this.objects.push(o);
      if (opts.block !== false) this.blocked[this.idx(tx, ty)] = 1;
      prot(tx, ty, opts.protect ?? 0);
      return o;
    };
    this.place = place;

    // Lighthouse
    place('lighthouse', lh.x, lh.y, S.lighthouse, 20, 95, { footY: 22, protect: 1 });
    this.blocked[this.idx(lh.x - 1, lh.y)] = 1; this.blocked[this.idx(lh.x + 1, lh.y)] = 1;
    this.lighthouseLight = { x: lh.x * T + 12, y: lh.y * T + 18, h: 80 };

    // Plaza furniture
    place('well', 36, 33, S.well, 15, 35, { footY: 22 });
    place('board', 44, 33, S.noticeBoard, 13, 30, { footY: 21 });
    const benchAt = (x, yy, face, area) => {
      const bp = IS.Iso.bench('x');
      place('bench', x, yy, bp.canvas, bp.ax, bp.ay, { block: false, footY: 18 });
      this.addSpot('bench', x, yy, face, 'sit', { area });
    };
    benchAt(34, 31, 'down', 'plaza'); benchAt(45, 31, 'down', 'plaza');
    benchAt(29, 13, 'down', 'oak');
    // Lamps
    const lampAt = (x, yy) => {
      if (!this.walkable(x, yy) && this.tile(x, yy) !== TT.DOCK) return;
      place('lamp', x, yy, S.lamp, 6, 34, { footY: 20 });
      this.lamps.push({ x: x * T + 12, y: yy * T + 18 });
    };
    [14, 21, 31, 57, 65].forEach(x => lampAt(x, 31));
    lampAt(33, 34); lampAt(46, 34); lampAt(36, dockEnd - 1); lampAt(43, dockEnd - 1);
    lampAt(49, 20); lampAt(47, 26);
    // Dock clutter
    const isoProp = (kind, x, yy, p, opts = {}) => place(kind, x, yy, p.canvas, p.ax, p.ay, { footY: 18, ...opts });
    this.isoProp = isoProp;
    isoProp('crate', 38, 35, IS.Iso.crateStack());
    isoProp('barrel', 41, 35, IS.Iso.barrel());
    isoProp('barrel', 47, 29, IS.Iso.barrel());
    isoProp('crate', 34, 29, IS.Iso.crate());
    isoProp('crate', 42, 35, IS.Iso.crate());
    place('sign', 47, 33, S.signpost, 11, 29, { footY: 21 });

    // Bonfire on the beach
    const bf = this.findNear(53, 47, (x, yy) => this.tile(x, yy) === TT.SAND && landDist[this.idx(x, yy)] >= 2 &&
      [[-2, 0], [2, 0], [-1, -2], [1, -2], [-1, 2], [1, 2], [0, -2], [0, 2]].every(([a, b]) => this.tile(x + a, yy + b) === TT.SAND));
    this.bonfire = { x: bf.x, y: bf.y, lit: false };
    place('firepit', bf.x, bf.y, S.firepit, 15, 12, { footY: 16, protect: 2 });
    for (const [a, b, face] of [[-2, 0, 'right'], [2, 0, 'left'], [-1, -2, 'down'], [1, -2, 'down'], [-1, 2, 'up'], [1, 2, 'up']]) {
      const lp = IS.Iso.logSeat(a !== 0 ? 'y' : 'x');
      place('log', bf.x + a, bf.y + b, lp.canvas, lp.ax, lp.ay, { block: false, footY: 18 });
      this.addSpot('bonfireSeat', bf.x + a, bf.y + b, face, 'sit');
    }
    // A second ring of people standing around the fire
    for (const [a, b, face] of [[-3, 1, 'right'], [3, -1, 'left'], [-3, -1, 'right'], [3, 1, 'left'], [0, -3, 'down'], [0, 3, 'up'], [-2, 3, 'up'], [2, -3, 'down']]) this.addSpot('bonfireSeat', bf.x + a, bf.y + b, face, 'stand', { standing: true });

    // Market stalls and string lights over the plaza
    const free = (x, yy) => this.walkable(x, yy) && ![TT.PATH, TT.DOCK, TT.FARM].includes(this.tile(x, yy));
    if (free(36, 30)) isoProp('stall', 36, 30, IS.Iso.stall(3, '#e8584a'));
    if (free(43, 30)) isoProp('stall', 43, 30, IS.Iso.stall(7, '#4a8ae8'));
    this.stringLights = [
      { a: { gx: 33.5, gy: 30.2 }, b: { gx: 46.5, gy: 30.2 }, h: 40 },
      { a: { gx: 33.5, gy: 34.5 }, b: { gx: 46.5, gy: 34.5 }, h: 34 },
      { a: { gx: 33.5, gy: 30.2 }, b: { gx: 33.5, gy: 34.5 }, h: 37 },
      { a: { gx: 46.5, gy: 30.2 }, b: { gx: 46.5, gy: 34.5 }, h: 37 },
    ];
    for (const [x, yy] of [[33, 30], [46, 30]]) if (this.walkable(x, yy)) place('pole', x, yy, IS.Sprites.pole, 3, 44, { footY: 18 });
    // Gardens in front of every house
    for (const b of this.buildings.filter(b => b.kind === 'house')) {
      const dx = b.x0 + 2;
      for (const x of [dx - 1, dx + 1]) if (free(x, 31)) isoProp('flowers', x, 31, IS.Iso.flowerBed(x * 7, 'x'));
      if (free(dx + 2, 31)) isoProp('mailbox', dx + 2, 31, IS.Iso.mailbox());
    }
    for (const [x, yy] of [[22, 31], [23, 31], [30, 31], [32, 31], [49, 31], [50, 31], [58, 31], [59, 31]]) if (free(x, yy)) isoProp('hedge', x, yy, IS.Iso.hedge(x * 13 + yy, 'x'));
    // Fence around the farm with a gate on the path
    for (let x = 25; x <= 34; x++) for (const yy of [35, 40]) if (!(yy === 35 && x === 29) && free(x, yy)) isoProp('fence', x, yy, IS.Iso.fence('x'));
    for (let yy = 36; yy <= 39; yy++) for (const x of [25, 34]) if (free(x, yy)) isoProp('fence', x, yy, IS.Iso.fence('y'));
    // Planters around the plaza
    for (const [x, yy] of [[34, 34], [45, 34], [33, 32], [46, 32]]) if (free(x, yy)) isoProp('planter', x, yy, IS.Iso.planter(x));

    // Picnic meadow
    this.picnic = { x: 16, y: 40 };
    for (const [a, b, face] of [[-1, 0, 'right'], [2, 0, 'left'], [0, -1, 'down'], [1, 2, 'up'], [0, 2, 'up'], [1, -1, 'down']]) {
      this.addSpot('picnicSeat', this.picnic.x + a, this.picnic.y + b, face, 'sit');
    }
    for (const [a, b, face] of [[-1, 2, 'up'], [2, 2, 'up'], [-1, -1, 'down'], [2, -1, 'down'], [-2, 1, 'right'], [3, 1, 'left']]) this.addSpot('picnicSeat', this.picnic.x + a, this.picnic.y + b, face, 'sit', { extra: true });
    prot(this.picnic.x, this.picnic.y, 3);

    // Beach umbrellas and loungers near the bonfire
    let umb = 0;
    for (const [a, b] of [[-5, 1], [-7, 2], [5, 1], [6, -1], [-9, 0]]) {
      const x = bf.x + a, yy = bf.y + b;
      if (this.tile(x, yy) === TT.SAND && this.walkable(x, yy) && this.tile(x + 1, yy) === TT.SAND && this.walkable(x + 1, yy)) {
        isoProp('umbrella', x, yy, IS.Iso.umbrella(x, umb % 2 ? '#4ab0f0' : '#ff6a7a'));
        isoProp('lounger', x + 1, yy, IS.Iso.lounger(), { block: false });
        umb++;
      }
    }

    // Old Oak
    const bigOak = IS.Sprites.makeOak(77, true);
    place('bigoak', oak.x, oak.y, bigOak, bigOak.ax, bigOak.ay, { footY: 20, protect: 1, big: true });

    // 7. Farm crops
    const kinds = ['tomato', 'carrot', 'cabbage'];
    for (const cy of [36, 38]) for (let x = 26; x <= 33; x++) {
      const crop = { x, y: cy, kind: kinds[(x + cy) % 3], growth: rng() * 0.9 };
      this.crops.push(crop);
      this.costExtra[this.idx(x, cy)] = 3;
      this.addSpot('farm', x, cy + 1, 'up', 'stand', { crop });
    }

    // 8. Scatter nature: trees, bushes and mossy rocks, then lots of ground detail
    const near = (x, yy, t, r) => { for (let b = -r; b <= r; b++) for (let a = -r; a <= r; a++) if (this.tile(x + a, yy + b) === t) return true; return false; };
    const S2 = IS.Sprites;
    const putAnch = (kind, x, yy, spr, opts = {}) => place(kind, x, yy, spr, spr.ax, spr.ay, { footY: 20, ...opts });
    // Boulders: a rock drawn twice the size, pixel for pixel, sitting on a 2x2 footprint
    const boulder = v => wildSprites['boulder' + v] || (wildSprites['boulder' + v] = (() => {
      const r = S2.makeRock(v * 7919 + 55), { c, g } = IS.makeCanvas(r.width * 2, r.height * 2);
      g.imageSmoothingEnabled = false; g.drawImage(r, 0, 0, c.width, c.height);
      c.ax = r.ax * 2 - 12; c.ay = r.ay * 2 - 4;
      return c;
    })());
    const wildSprites = {}, nThick = IS.makeNoise(101), nRock = IS.makeNoise(131), nPine = IS.makeNoise(157);
    for (let yy = 1; yy < H - 1; yy++) for (let x = 1; x < W - 1; x++) {
      const i = this.idx(x, yy);
      if (protect[i] || this.blocked[i]) continue;
      const t = this.tiles[i];
      const h = IS.hash2(x, yy, 5);
      // Village sprites are one of a kind; the wild east reuses 24 of each so the island loads fast
      const wildSeed = (x >= 80 || yy >= 60) ? (x * 131 + yy * 7) % 24 : -1;
      const seed = wildSeed >= 0 ? wildSeed * 7919 + 101 : x * 131 + yy * 7;
      const spr = (fn, ...a) => { if (wildSeed < 0) return S2[fn](seed, ...a); const k = fn + seed + a.join(); return wildSprites[k] || (wildSprites[k] = S2[fn](seed, ...a)); };
      // The wild grows in patches: forests thin out toward their edges, rocks gather in outcrops,
      // pines and oaks grow in their own stands, and meadows keep only the odd lone tree
      if (wildSeed >= 0 && (t === TT.FOREST || t === TT.GRASS)) {
        const forest = t === TT.FOREST;
        const thick = forest ? 0.06 + 0.26 * IS.clamp((nThick(x * 0.06, yy * 0.06) - 0.3) / 0.4, 0, 1) : 0.012;
        const roomy = !this.blocked[this.idx(x - 1, yy)] && !this.blocked[this.idx(x, yy - 1)];
        const big = [[x - 1, yy], [x, yy - 1], [x - 1, yy - 1]].every(([a, b]) => !this.blocked[this.idx(a, b)] && !protect[this.idx(a, b)] && this.tile(a, b) === t);
        if (big && h < 0.06 && (nRock(x * 0.1, yy * 0.1) > 0.72 || this.cliffy[this.idx(x, yy + 3)] || this.cliffy[this.idx(x + 3, yy)])) {
          const bs = boulder(wildSeed % 6);
          place('boulder', x, yy, bs, bs.ax, bs.ay, { footY: 20 });
          for (const [a, b] of [[x - 1, yy], [x, yy - 1], [x - 1, yy - 1]]) this.blocked[this.idx(a, b)] = 1;
        } else if (nRock(x * 0.1, yy * 0.1) > 0.78 && h < 0.16 && roomy && !this.blocked[this.idx(x - 1, yy - 1)]) putAnch('rock', x, yy, spr('makeRock'));
        else if (h < thick && roomy) {
          if (nPine(x * 0.07, yy * 0.07) > 0.55) place('tree', x, yy, spr('makePine'), 18, 59, { footY: 22, tree: true });
          else putAnch('tree', x, yy, spr('makeOak'), { tree: true });
        } else if (h < thick + (forest ? 0.05 : 0.015)) {
          const berries = IS.hash2(x, yy, 3) < 0.5;
          const o = putAnch('bush', x, yy, spr('makeBush', berries));
          if (berries) o.berries = true;
        } else if (forest && h > 0.993) place('stump', x, yy, S2.makeStump(), 10, 14, { footY: 20 });
        continue;
      }
      if (t === TT.FOREST) {
        if (h < 0.36 && !this.blocked[this.idx(x - 1, yy)] && !this.blocked[this.idx(x, yy - 1)]) {
          const pine = yy < 13 || IS.hash2(x, yy, 9) < 0.3;
          if (pine) place('tree', x, yy, spr('makePine'), 18, 59, { footY: 22, tree: true });
          else putAnch('tree', x, yy, spr('makeOak'), { tree: true });
        } else if (h < 0.43) {
          const berries = IS.hash2(x, yy, 3) < 0.5;
          const o = putAnch('bush', x, yy, spr('makeBush', berries));
          if (berries) o.berries = true;
        } else if (h < 0.47) putAnch('rock', x, yy, spr('makeRock'));
        else if (h < 0.49) place('stump', x, yy, S2.makeStump(), 10, 14, { footY: 20 });
      } else if (t === TT.GRASS) {
        if (h < 0.06 && !near(x, yy, TT.PATH, 1) && !near(x, yy, TT.PLAZA, 2)) putAnch('tree', x, yy, spr('makeOak'), { tree: true });
        else if (h < 0.1) putAnch('bush', x, yy, spr('makeBush', h < 0.08));
        else if (h < 0.115) putAnch('rock', x, yy, spr('makeRock'));
      } else if (t === TT.SAND) {
        const ld = landDist[i];
        if (h < 0.05 && ld >= 2 && !near(x, yy, TT.DOCK, 2)) place('tree', x, yy, spr('makePalm'), 24, 59, { footY: 22, tree: true });
        else if (h < 0.065) putAnch('rock', x, yy, spr('makeRock'));
      }
    }
    // Ground detail: several decals per tile, everywhere that isn't paved
    const dr = IS.mulberry32(4242);
    const cache = {};
    const variant = (kind, n) => { const k = kind + (Math.floor(dr() * n)); return cache[k] || (cache[k] = S2[kind](Math.floor(dr() * 9999))); };
    for (let yy = 1; yy < H - 1; yy++) for (let x = 1; x < W - 1; x++) {
      const t = this.tile(x, yy);
      const add = (kind, n) => this.decals.push({ sprite: variant(kind, n), x: x * T + dr() * 16 - 4, y: yy * T + dr() * 16 - 4 });
      const meadow = Math.abs(x - this.picnic.x) < 7 && Math.abs(yy - this.picnic.y) < 5;
      if (t === TT.GRASS) {
        const k = 1 + Math.floor(dr() * 3);
        for (let j = 0; j < k; j++) {
          const v = dr();
          if (v < (meadow ? 0.45 : 0.22)) add('makeFlowers', 10);
          else if (v < 0.75) add('makeTuft', 8);
          else if (v < 0.88) add('makeClover', 4);
        }
        if (near(x, yy, TT.FOREST, 1) && dr() < 0.2) add('makeMushroom', 3);
      } else if (t === TT.FOREST) {
        for (let j = 0; j < 2; j++) {
          const v = dr();
          if (v < 0.35) add('makeFern', 6);
          else if (v < 0.7) add('makeTuft', 8);
          else if (v < 0.8) add('makeMushroom', 3);
          else if (v < 0.9) add('makeFlowers', 10);
        }
      } else if (t === TT.SAND && dr() < 0.08) add('makeTuft', 8);
    }

    // 9. Activity spots
    this.reach = this.computeReach(40, 33);
    const reachable = (x, yy) => this.reach[this.idx(x, yy)] === 1;
    for (let yy = 1; yy < H - 1; yy++) for (let x = 1; x < W - 1; x++) {
      // ponytail: activities stay in the village's old 80x60 corner so nobody hikes across the map for firewood; open the east up when events need it
      if (!reachable(x, yy) || x >= 80 || yy >= 60) continue;
      const t = this.tile(x, yy);
      const h = IS.hash2(x, yy, 41);
      if (t === TT.FOREST && h < 0.12) this.addSpot('forage', x, yy, IS.pick(['up', 'left', 'right']), 'stand');
      // tree directly above = chopping spot
      const above = this.objects.find(o => o.tree && o.tx === x && o.ty === yy - 1);
      if (above && (t === TT.FOREST || t === TT.GRASS) && h < 0.5) this.addSpot('chop', x, yy, 'up', 'stand', { tree: above });
      if (t === TT.SAND && yy >= 42 && h < 0.18 && landDist[this.idx(x, yy)] <= 2) this.addSpot('beach', x, yy, 'down', 'sit');
      if (t === TT.SAND && landDist[this.idx(x, yy)] <= 1 && h < 0.07) this.addSpot('fish', x, yy, this.faceToWater(x, yy), 'stand', { shore: true });
    }
    // Fishing off the dock end
    for (let x = 36; x <= 43; x++) this.addSpot('fish', x, dockEnd, 'down', 'stand');
    this.addSpot('fish', 36, dockEnd - 1, 'left', 'stand');
    this.addSpot('fish', 43, dockEnd - 1, 'right', 'stand');
    // Swimming spots: shallow water next to the south beach
    for (let yy = 40; yy < 60; yy++) for (let x = 1; x < 80; x++) {
      if (this.tile(x, yy) === TT.SHALLOW && this.waterDist[this.idx(x, yy)] <= 2 && Math.abs(x - 39.5) > 5 && IS.hash2(x, yy, 13) < 0.12) this.addSpot('swim', x, yy, 'down', 'swim');
    }
    // Stargazing: beach, dock end, Old Oak clearing, lighthouse
    for (const s of (this.spots.beach || []).slice(0, 8)) this.addSpot('stargaze', s.x, s.y, 'down', 'sit');
    this.addSpot('stargaze', 30, 13, 'down', 'sit');
    this.addSpot('stargaze', lh.x - 1, lh.y + 1, 'right', 'sit');
    this.addSpot('stargaze', 39, dockEnd, 'down', 'sit');
    // Greeting the supply boat
    for (const [x, yy] of [[39, dockEnd - 2], [40, dockEnd - 3], [41, dockEnd], [38, dockEnd], [39, dockEnd - 4]]) this.addSpot('greet', x, yy, 'down', 'stand');
    // Dolphin watching / shore gathering
    for (const s of (this.spots.beach || [])) this.addSpot('shore', s.x, s.y, 'down', 'stand');

    // Points of interest for wandering
    this.pois = [
      { name: 'the lighthouse', x: lh.x - 1, y: lh.y + 2 },
      { name: 'the Old Oak', x: 30, y: 14 },
      { name: 'the north trail', x: 40, y: 15 },
      { name: 'the west meadow', x: 16, y: 38 },
      { name: 'the dock', x: 40, y: dockEnd },
      { name: 'the beach', x: bf.x - 4, y: bf.y },
      { name: 'the plaza', x: 40, y: 33 },
      { name: 'the farm', x: 30, y: 40 },
      { name: 'the east woods', x: 104, y: 26 },
      { name: 'the lake', x: 118, y: 63 },
      ...(() => { // the highest terrace anyone can climb to
        let best = -1;
        for (let k = 0; k < W * H; k++) if (this.reach[k] && this.elev[k] && !this.stairs[k] && (best < 0 || this.elev[k] > this.elev[best] || (this.elev[k] === this.elev[best] && landDist[k] > landDist[best]))) best = k;
        return best < 0 ? [] : [{ name: 'the lookout', x: best % W, y: (best / W) | 0 }];
      })(),
      { name: 'the cliffs', ...this.findNear(132, 100, (x, yy) => this.cliffy[this.idx(x, yy)] === 1 && this.walkable(x, yy) && reachable(x, yy), 30) },
    ].map(p => {
      const t = this.findNear(p.x, p.y, (x, yy) => this.walkable(x, yy) && reachable(x, yy));
      return { ...p, x: t.x, y: t.y };
    });

    // Remove spots that ended up unreachable
    for (const k of Object.keys(this.spots)) {
      this.spots[k] = this.spots[k].filter(s => s.pose === 'swim' ? true : (this.walkable(s.x, s.y) && reachable(s.x, s.y)));
    }

    this.renderGround();
  }

  // Screen px of height at a world position; on stairs it eases down toward the lower side
  liftAt(wx, wy) {
    if (!this.maxElev) return 0;
    const gx = wx / IS.TILE, gy = (wy - 6) / IS.TILE, tx = Math.floor(gx), ty = Math.floor(gy);
    if (!this.inb(tx, ty)) return 0;
    const i = this.idx(tx, ty), L = this.elev[i], st = this.stairs[i];
    if (!st) return L * this.STEP;
    return (L - IS.clamp(st === 1 ? gx - tx : gy - ty, 0, 1)) * this.STEP;
  }

  faceToWater(x, y) {
    if (this.isWater(x, y + 1)) return 'down';
    if (this.isWater(x - 1, y)) return 'left';
    if (this.isWater(x + 1, y)) return 'right';
    return 'up';
  }

  addSpot(kind, x, y, face, pose, extra = {}) {
    (this.spots[kind] = this.spots[kind] || []).push({ kind, x, y, face, pose, takenBy: null, ...extra });
  }

  addBuilding(b) {
    const TT = IS.TT;
    if (b.kind === 'deco') {
      for (let y = b.y0; y < b.y0 + b.h; y++) for (let x = b.x0; x < b.x0 + b.w; x++) this.setT(x, y, TT.WALL);
      b.doors = []; b.furniture = []; b.residents = []; b.noCut = true;
      b.iso = IS.Iso.building(b);
      b.depth = (b.x0 + b.w) + (b.y0 + b.h) - 0.5;
      b.cut = 0;
      this.buildings.push(b);
      return;
    }
    b.doors = b.doorCols.map(c => ({ x: b.x0 + c, y: b.y0 + b.h - 1 }));
    for (let y = b.y0; y < b.y0 + b.h; y++) for (let x = b.x0; x < b.x0 + b.w; x++) {
      const edge = x === b.x0 || x === b.x0 + b.w - 1 || y === b.y0 || y === b.y0 + b.h - 1;
      this.setT(x, y, edge ? TT.WALL : TT.FLOOR);
    }
    for (const d of b.doors) this.setT(d.x, d.y, TT.FLOOR);

    const furniture = [];
    const add = (type, c, r, extra = {}) => furniture.push({ type, c, r, ...extra });
    b.residents = [];
    if (b.kind === 'house') {
      const residents = IS.ISLANDERS.filter(p => p.home === b.index);
      b.residents = residents.map(p => p.name);
      add('rug', 1, 3, { w: 1, color: IS.shade(b.roof, 0.1) });
      add('shelf', 3, 1);
      add('stove', 2, 1);
      add('table', 2, 2, { w: 2 });
      add('armchair', 4, 3, { color: IS.shade(b.roof, -0.1) });
      add('plant', 4, 2);
      const bedCells = [[1, 1], [4, 1]];
      const beds = b.beds || Math.max(1, Math.min(2, residents.length));
      for (let i = 0; i < beds; i++) {
        const [c, r] = bedCells[i];
        const owner = residents[i];
        add('bed', c, r, { color: owner ? IS.shade(owner.look.shirt, -0.1) : '#6a8fc9' });
        this.addSpot('bed', b.x0 + c, b.y0 + r, 'down', 'sleep', { building: b.id, owner: owner ? owner.name : null });
      }
      this.addSpot('eat', b.x0 + 3, b.y0 + 3, 'up', 'stand', { building: b.id });
      this.addSpot('eat', b.x0 + 2, b.y0 + 3, 'up', 'stand', { building: b.id });
      this.addSpot('read', b.x0 + 4, b.y0 + 3, 'down', 'sit', { building: b.id });
      this.addSpot('cookHome', b.x0 + 2, b.y0 + 2, 'up', 'stand', { building: b.id });
      b.wallpaper = IS.mix(b.wall, b.roof, 0.12);
    } else {
      // Purely decorative pieces (drawn by IS.Iso's hall interior); none of them block tiles.
      add('hallRug', 1.6, 1.95, { w: 6.8, d: 3.1, color: '#a8463a' });
      add('hallRug', 4.15, 5.05, { w: 1.7, d: 0.95, color: '#a8463a', runner: true });
      add('kitchen', 1, 1, { w: 3 });
      add('bookcase', 4, 1, { top: 'plant' });
      add('logBasket', 5, 1);
      add('hearth', 6, 1, { w: 2 });
      add('bookcase', 8, 1, { top: 'globe' });
      add('teaTable', 1, 3);
      add('banquet', 2, 3, { w: 6 });
      add('lectern', 8, 3);
      add('bigPlant', 1, 5); add('bigPlant', 8, 5);
      for (let c = 3; c <= 7; c++) { add('hallChair', c, 2, { face: 'down' }); this.addSpot('hallSeat', b.x0 + c, b.y0 + 2, 'down', 'sit', { building: b.id }); }
      for (let c = 2; c <= 7; c++) { add('hallChair', c, 4, { face: 'up' }); this.addSpot('hallSeat', b.x0 + c, b.y0 + 4, 'up', 'sit', { building: b.id }); }
      // Standing room at the back for when the town outgrows the chairs
      for (const c of [3, 4, 5, 6]) this.addSpot('hallSeat', b.x0 + c, b.y0 + 5, 'up', 'stand', { building: b.id, standing: true });
      // Two guest bedrolls for visitors who don't have a house yet
      for (const c of [2, 7]) this.addSpot('bed', b.x0 + c, b.y0 + 5, 'down', 'sleep', { building: b.id, guest: true, owner: null });
      this.addSpot('cook', b.x0 + 2, b.y0 + 2, 'up', 'stand', { building: b.id });
      this.addSpot('read', b.x0 + 8, b.y0 + 2, 'up', 'stand', { building: b.id, hall: true });
      this.addSpot('shelter', b.x0 + 6, b.y0 + 2, 'up', 'stand', { building: b.id });
      this.addSpot('shelter', b.x0 + 1, b.y0 + 4, 'right', 'stand', { building: b.id });
      this.addSpot('shelter', b.x0 + 8, b.y0 + 4, 'left', 'stand', { building: b.id });
    }
    b.furniture = furniture;
    b.flowerBoxes = b.kind === 'hall' || b.index % 2 === 0 || b.deco === 'cafe' || (b.built && b.kind === 'house');
    b.iso = IS.Iso.building(b);
    b.depth = (b.x0 + b.w) + (b.y0 + b.h) - 0.5;
    b.cut = 0;        // 0 = roof on, 1 = cutaway
    b.occupants = 0;
    this.buildings.push(b);
  }

  buildingAt(tx, ty) {
    return this.buildings.find(b => !b.noCut && tx > b.x0 && tx < b.x0 + b.w - 1 && ty > b.y0 && ty < b.y0 + b.h - 1) ||
      this.buildings.find(b => !b.noCut && b.doors.some(d => d.x === tx && d.y === ty)) || null;
  }
  buildingAtPx(x, y) {
    const T = IS.TILE;
    return this.buildings.find(b => x >= b.x0 * T && x < (b.x0 + b.w) * T && y >= b.y0 * T - 18 && y < (b.y0 + b.h) * T) || null;
  }

  findNear(x, y, ok, maxR = 25) {
    for (let r = 0; r <= maxR; r++) {
      for (let b = -r; b <= r; b++) for (let a = -r; a <= r; a++) {
        if (Math.max(Math.abs(a), Math.abs(b)) !== r) continue;
        if (this.inb(x + a, y + b) && ok(x + a, y + b)) return { x: x + a, y: y + b };
      }
    }
    return { x, y };
  }
  nearestWalkable(x, y) {
    return this.findNear(x, y, (a, b) => this.walkable(a, b) && this.reach[this.idx(a, b)] === 1, 60);
  }

  computeReach(sx, sy) {
    const r = new Uint8Array(this.W * this.H);
    const q = [this.idx(sx, sy)];
    r[q[0]] = 1;
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % this.W, y = (i / this.W) | 0;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + a, ny = y + b;
        if (!this.walkable(nx, ny)) continue;
        const j = this.idx(nx, ny);
        if (!r[j]) { r[j] = 1; q.push(j); }
      }
    }
    return r;
  }

  // A* on the tile grid, 4 directions (HGSS style movement).
  findPath(sx, sy, gx, gy, opts = {}) {
    if (sx === gx && sy === gy) return [];
    const W = this.W, swim = !!opts.swim;
    const canEnter = (x, y) => (x === gx && y === gy) || this.walkable(x, y) || (swim && this.swimmable(x, y));
    if (!canEnter(gx, gy)) return null;
    const N = W * this.H;
    if (!this._g || this._g.length !== N) { this._g = new Float32Array(N); this._from = new Int32Array(N); this._stamp = new Uint32Array(N); this._done = new Uint32Array(N); this._gen = 0; }
    const g = this._g, from = this._from, stamp = this._stamp, done = this._done;
    const gen = ++this._gen;
    const start = this.idx(sx, sy), goal = this.idx(gx, gy);
    const heap = new IS.Heap();
    stamp[start] = gen; g[start] = 0; from[start] = -1;
    heap.push(start, 0);
    let expanded = 0;
    while (heap.size) {
      const cur = heap.pop();
      if (cur === goal) break;
      if (done[cur] === gen) continue; // a stale heap entry: this tile was already expanded
      done[cur] = gen;
      if (++expanded > N) return null;
      const cx = cur % W, cy = (cur / W) | 0;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + a, ny = cy + b;
        if (!this.inb(nx, ny) || !canEnter(nx, ny)) continue;
        const ni = this.idx(nx, ny);
        const ng = g[cur] + this.cost(nx, ny);
        if (stamp[ni] !== gen || ng < g[ni]) {
          stamp[ni] = gen; g[ni] = ng; from[ni] = cur;
          heap.push(ni, ng + (Math.abs(nx - gx) + Math.abs(ny - gy)));
        }
      }
    }
    if (stamp[goal] !== gen) return null;
    const path = [];
    for (let i = goal; i !== start; i = from[i]) path.push({ x: i % W, y: (i / W) | 0 });
    return path.reverse();
  }

  freeSpot(kind, filter) {
    const list = (this.spots[kind] || []).filter(s => !s.takenBy && (!filter || filter(s)));
    return list.length ? IS.pick(list) : null;
  }

  // ------------------------------------------------------------------
  // Isometric ground: every screen pixel is mapped back to the grid, so
  // coastlines stay organic and stones, planks and furrows line up with the
  // iso axes. Land is a raised slab; its south-facing edges get cliff faces.
  // ------------------------------------------------------------------
  renderGround() {
    const TT = IS.TT, ISO = IS.Iso;
    const W = ISO.W, H = ISO.H, GW = this.W, GH = this.H;
    // Displacement field on an 1/8-tile grid
    const R = 8, FW = GW * R, FH = GH * R;
    const nA = IS.makeNoise(11), nB = IS.makeNoise(23), nC = IS.makeNoise(37);
    const dX = new Float32Array(FW * FH), dY = new Float32Array(FW * FH), patch = new Float32Array(FW * FH);
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
      const i = y * FW + x, gx = x / R, gy = y / R;
      dX[i] = (nA(gx * 1.5, gy * 1.5) - 0.5) * 0.6 + (nA(gx * 5 + 50, gy * 5) - 0.5) * 0.12;
      dY[i] = (nB(gx * 1.5, gy * 1.5) - 0.5) * 0.6 + (nB(gx * 5, gy * 5 + 50) - 0.5) * 0.12;
      patch[i] = nC(gx * 0.4, gy * 0.4);
    }
    const natural = t => t === TT.DEEP || t === TT.SHALLOW || t === TT.SAND || t === TT.GRASS || t === TT.FOREST;
    const isWaterT = t => t === TT.DEEP || t === TT.SHALLOW;
    const tileAt = (x, y) => {
      if (x < 0 || y < 0 || x >= GW || y >= GH) return TT.DEEP;
      const t = this.tiles[(y | 0) * GW + (x | 0)];
      return t === TT.WALL || t === TT.FLOOR ? TT.GRASS : t;
    };
    const mat = new Uint8Array(W * H);
    const GX = new Float32Array(W * H), GY = new Float32Array(W * H);
    // Terraces: a pixel shows a lifted top if the ground one lift below it is that high,
    // or a wall face if the ground somewhere in that level's step below it is
    const FACE = 31, liftLv = new Uint8Array(W * H), faceK = new Uint8Array(W * H), faceStair = new Uint8Array(W * H), STEP = this.STEP || 16, maxL = this.maxElev || 0;
    // Highest terrace that can reach each ground tile on screen (only those levels get tested)
    const nearMax = new Uint8Array(GW * GH);
    if (maxL) for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { const L = this.elev[y * GW + x]; if (L) for (let b = -8; b <= 1; b++) for (let a = -8; a <= 1; a++) if (this.inb(x + a, y + b) && nearMax[(y + b) * GW + x + a] < L) nearMax[(y + b) * GW + x + a] = L; }
    const lvlXY = (gx, gy) => { const x = Math.floor(gx), y = Math.floor(gy); return this.inb(x, y) ? this.elev[y * GW + x] : 0; };
    const PD = 1 / 16; // one screen px down is +1/16 on both grid axes
    for (let sy = 0; sy < H; sy++) for (let sx = 0; sx < W; sx++) {
      let g = ISO.s2g(sx + 0.5, sy + 0.5);
      const i = sy * W + sx;
      const nm = maxL ? nearMax[IS.clamp(Math.floor(g.gy), 0, GH - 1) * GW + IS.clamp(Math.floor(g.gx), 0, GW - 1)] : 0;
      if (nm) {
        let hit = false;
        for (let L = nm; L >= 1 && !hit; L--) {
          if (lvlXY(g.gx + L * STEP * PD, g.gy + L * STEP * PD) >= L) { g = { gx: g.gx + L * STEP * PD, gy: g.gy + L * STEP * PD }; hit = true; liftLv[i] = L; break; }
          for (let d = L * STEP - 1; d >= (L - 1) * STEP; d--) {
            if (lvlXY(g.gx + d * PD, g.gy + d * PD) >= L) {
              const gf = { gx: g.gx + d * PD, gy: g.gy + d * PD };
              hit = true;
              const fx = Math.floor(gf.gx), fy = Math.floor(gf.gy);
              // A wall whose foot is ground hidden behind the terrace is a step in a diagonal back edge:
              // show it as terrace top, or every step leaves a little wedge of wall
              const hid = (x, y) => this.inb(x, y) && this.hidden[y * GW + x];
              if (hid(fx + 1, fy) || hid(fx, fy + 1)) { g = gf; liftLv[i] = L; break; }
              mat[i] = FACE; faceK[i] = L * STEP - d; GX[i] = gf.gx; GY[i] = gf.gy;
              faceStair[i] = this.inb(fx, fy) && (this.stairs[fy * GW + fx] || this.stairs[IS.clamp(fy - 1, 0, GH - 1) * GW + fx] || this.stairs[fy * GW + IS.clamp(fx - 1, 0, GW - 1)]) ? 1 : 0;
              break;
            }
          }
        }
        if (mat[i] === FACE) continue;
      }
      GX[i] = g.gx; GY[i] = g.gy;
      let t = tileAt(Math.floor(g.gx), Math.floor(g.gy));
      if (natural(t)) {
        const fi = IS.clamp(Math.floor(g.gy * R), 0, FH - 1) * FW + IS.clamp(Math.floor(g.gx * R), 0, FW - 1);
        const t2 = tileAt(Math.floor(g.gx + dX[fi]), Math.floor(g.gy + dY[fi]));
        if (natural(t2)) t = t2;
      }
      mat[i] = t;
    }

    const land = IS.makeCanvas(W, H, false), water = IS.makeCanvas(W, H, false), foam = IS.makeCanvas(W, H, false);
    const li = land.g.createImageData(W, H), wi = water.g.createImageData(W, H), fi2 = foam.g.createImageData(W, H);
    const Ld = li.data, Wd = wi.data, Fd = fi2.data;
    const rgb = h => IS.hexToRgb(h);
    const C = {
      g0: rgb('#62c04a'), g1: rgb('#92d84e'), gd: rgb('#4caa4a'), gl: rgb('#c6ec6c'),
      f0: rgb('#3e9e52'), f1: rgb('#52b058'), fd: rgb('#2f8452'),
      s0: rgb('#f8d088'), s1: rgb('#ffe2a8'), sd: rgb('#eab86a'), swet: rgb('#e4a46c'),
      p0: rgb('#eaa866'), p1: rgb('#dc9a5a'), pe: rgb('#c27e4a'), pp: rgb('#b8704a'), pl: rgb('#ffcf92'),
      mort: rgb('#a888a8'), st: ['#e8c4a4', '#dfb494', '#eecdb0', '#d4a888'].map(rgb),
      soil: rgb('#b4623a'), furrow: rgb('#843f2c'), soilL: rgb('#cc7a48'),
      dk: ['#dc9a5a', '#cc8a4c', '#e6a866'].map(rgb), seam: rgb('#8a4a2c'),
      cliffSand: rgb('#d99858'), cliffDirt: rgb('#9a5838'), cliffDirtD: rgb('#6a3a3a'), cliffStone: rgb('#a898b0'), cliffWood: rgb('#8a5030'),
      lip: rgb('#3f6a2e'),
      grass: ['#5a8a2e', '#76a234', '#9cbc40', '#c6d050'].map(rgb),
      forest: ['#3a5c28', '#4c782c', '#6a9434', '#90ae3e'].map(rgb),
      clumpShade: rgb('#2e4a30'),
    };
    const nG = IS.makeNoise(57), nG2 = IS.makeNoise(83);
    const band = (sx, sy, big) => {
      const v = nG(sx / 7, sy / 4.5) * 0.55 + nG2(sx / 2.5, sy / 2) * 0.17 + big * 0.35;
      return v < 0.4 ? 0 : v < 0.53 ? 1 : v < 0.66 ? 2 : 3;
    };
    const set = (A, i, c, a = 255) => { A[i] = c[0]; A[i + 1] = c[1]; A[i + 2] = c[2]; A[i + 3] = a; };
    const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? TT.DEEP : mat[y * W + x];
    const waterStops = [[0, rgb('#6ff2e0')], [0.9, rgb('#33d4dc')], [2.2, rgb('#1fa8e4')], [4, rgb('#2878d8')], [7, rgb('#3448b8')]];
    const waterColor = d => {
      for (let k = 1; k < waterStops.length; k++) if (d <= waterStops[k][0]) {
        const [d0, c0] = waterStops[k - 1], [d1, c1] = waterStops[k];
        return mixc(c0, c1, (d - d0) / (d1 - d0));
      }
      return waterStops[waterStops.length - 1][1];
    };
    const wd = (gx, gy) => {
      const x0 = IS.clamp(Math.floor(gx - 0.5), 0, GW - 1), y0 = IS.clamp(Math.floor(gy - 0.5), 0, GH - 1);
      const x1 = Math.min(x0 + 1, GW - 1), y1 = Math.min(y0 + 1, GH - 1);
      const tx = IS.clamp(gx - 0.5 - x0, 0, 1), ty = IS.clamp(gy - 0.5 - y0, 0, 1);
      const v = i => Math.max(0, this.waterDist[i]);
      return IS.lerp(IS.lerp(v(y0 * GW + x0), v(y0 * GW + x1), tx), IS.lerp(v(y1 * GW + x0), v(y1 * GW + x1), tx), ty);
    };
    const CLIFF = 9, DOCKH = 5, TALL = 24;

    for (let sy = 0; sy < H; sy++) {
      for (let sx = 0; sx < W; sx++) {
        const i = sy * W + sx, p = i * 4;
        const t = mat[i];
        const gx = GX[i], gy = GY[i];
        const fidx = IS.clamp(Math.floor(gy * R), 0, FH - 1) * FW + IS.clamp(Math.floor(gx * R), 0, FW - 1);
        const hb = IS.hash2(sx >> 1, sy >> 1, 3);
        if (t === FACE) {
          const k = faceK[i];
          let c;
          if (faceStair[i]) c = (k % 4) < 2 ? C.st[1] : mixc(C.st[3], C.cliffDirtD, 0.45); // stone steps
          else c = k <= 2 ? C.lip : mixc(mixc(C.cliffDirt, C.cliffStone, 0.35), C.cliffDirtD, (k - 2) / STEP * 0.6 + (k % 5 === 0 ? 0.15 : 0));
          if (hb > 0.9) c = mixc(c, [255, 230, 200], 0.12);
          set(Ld, p, c);
          continue;
        }
        if (isWaterT(t)) {
          let c = waterColor(wd(gx, gy) + (hb - 0.5) * 0.2);
          // Cliff faces hang below any land directly above this pixel
          let k = 0, above = 0;
          const look = wd(gx, gy) < 3 ? TALL : CLIFF;
          for (let j = 1; j <= look; j++) { const m = at(sx, sy - j); if (!isWaterT(m)) { k = j; above = m; break; } }
          let high = false;
          if (k && (above === TT.GRASS || above === TT.FOREST)) { const q = (sy - k) * W + sx; high = this.cliffy[IS.clamp(Math.floor(GY[q]), 0, GH - 1) * GW + IS.clamp(Math.floor(GX[q]), 0, GW - 1)] === 1; } // beaches and paths keep their short edge
          const faceH = above === TT.DOCK ? DOCKH : high ? TALL : CLIFF;
          if (k && k <= faceH) {
            let cc;
            if (above === TT.DOCK) cc = k >= DOCKH - 1 ? C.cliffDirtD : C.cliffWood;
            else if (above === TT.SAND) cc = mixc(C.cliffSand, C.cliffDirtD, (k / CLIFF) * 0.7);
            else if (above === TT.PATH || above === TT.PLAZA) cc = mixc(C.cliffStone, C.cliffDirtD, k / CLIFF * 0.6);
            else if (high) cc = k <= 2 ? C.lip : mixc(mixc(C.cliffDirt, C.cliffStone, 0.35), C.cliffDirtD, (k - 2) / TALL * 0.75 + (k % 6 === 0 ? 0.18 : 0)); // layered rock
            else cc = k <= 2 ? C.lip : mixc(C.cliffDirt, C.cliffDirtD, (k - 2) / CLIFF);
            if (hb > 0.85) cc = mixc(cc, [255, 230, 200], 0.15);
            set(Ld, p, cc);
            set(Wd, p, c);
            continue;
          }
          if (k && k <= faceH + 3) c = mixc(c, [30, 40, 110], 0.28); // shadow at the foot of the cliff
          set(Wd, p, c);
          // Foam hugging the shoreline
          let n1 = false, n2 = false;
          for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [2, 0], [-2, 0], [0, -faceH - 1], [0, -faceH - 2]]) if (!isWaterT(at(sx + a, sy + b))) { n1 = true; break; }
          if (!n1) for (const [a, b] of [[4, 0], [-4, 0], [0, 3], [5, 1], [-5, 1], [0, -faceH - 4], [0, -faceH - 5], [3, -faceH - 3], [-3, -faceH - 3]]) if (!isWaterT(at(sx + a, sy + b))) { n2 = true; break; }
          if (n1) set(Fd, p, [255, 255, 248], 235);
          else if (n2 && hb > 0.3) set(Fd, p, [230, 252, 255], 120);
          continue;
        }
        let c;
        const wx = gx * IS.TILE, wy = gy * IS.TILE;
        switch (t) {
          case TT.GRASS:
          case TT.FOREST: {
            // Posterized clumps; a clump sitting below a lighter one is shaded
            const ramp = t === TT.GRASS ? C.grass : C.forest;
            const b = band(sx, sy, patch[fidx]);
            const above = band(sx, sy - 1, patch[fidx]);
            c = ramp[b];
            if (above > b) c = mixc(c, C.clumpShade, 0.35);
            if (hb > 0.985) c = mixc(c, [255, 250, 200], 0.4);
            if (at(sx, sy - 1) === FACE || at(sx, sy - 3) === FACE) c = mixc(c, C.clumpShade, 0.45); // foot of a terrace wall
            if (liftLv[i]) { c = mixc(c, [255, 246, 196], 0.06 * liftLv[i]); if (at(sx, sy + 1) === FACE || at(sx, sy + 2) === FACE) c = mixc(c, C.gl, 0.45); } // higher ground catches more sun
            break;
          }
          case TT.SAND: {
            c = mixc(C.s0, C.s1, patch[fidx]);
            if (hb < 0.06) c = C.sd;
            let wet = false;
            for (const [a, b] of [[0, 3], [3, 0], [-3, 0], [0, -3], [0, CLIFF + 2]]) if (isWaterT(at(sx + a, sy + b)) && b !== CLIFF + 2) { wet = true; break; }
            if (wet) c = mixc(c, C.swet, 0.7);
            break;
          }
          case TT.PATH: {
            c = mixc(C.p0, C.p1, patch[fidx]);
            const h1 = IS.hash2(sx, sy, 9);
            if (h1 < 0.03) c = C.pp; else if (h1 > 0.985) c = C.pl;
            for (const [a, b] of [[2, 0], [-2, 0], [0, 1], [0, -1]]) { const m = at(sx + a, sy + b); if (m !== TT.PATH && m !== TT.PLAZA && m !== TT.DOCK) { c = mixc(c, C.pe, 0.7); break; } }
            break;
          }
          case TT.PLAZA: {
            const row = Math.floor(wy / 8), off = (row % 2) * 6;
            const lx = (((wx + off) % 12) + 12) % 12, ly = ((wy % 8) + 8) % 8;
            if (lx < 1.1 || ly < 1.1) c = C.mort;
            else {
              c = C.st[Math.floor(IS.hash2(Math.floor((wx + off) / 12), row, 4) * 4)];
              if (ly < 2.2) c = mixc(c, [255, 248, 230], 0.3);
              if (ly > 6.6) c = mixc(c, C.mort, 0.35);
            }
            break;
          }
          case TT.FARM: c = ((wy % 12) + 12) % 12 < 3.5 ? C.furrow : C.soil; if (hb > 0.92) c = C.soilL; break;
          case TT.DOCK: {
            const lx = ((wx % 8) + 8) % 8, ly = ((wy % 40) + 40) % 40;
            if (lx < 1 || ly < 1) c = C.seam;
            else { c = C.dk[Math.floor(IS.hash2(Math.floor(wx / 8), Math.floor(wy / 40), 6) * 3)]; if (lx < 2) c = mixc(c, [255, 240, 210], 0.25); }
            break;
          }
          default: c = C.g0;
        }
        // Grass meeting sand gets a darker lip
        if ((t === TT.GRASS || t === TT.FOREST)) { const m = at(sx, sy + 2); if (m === TT.SAND) c = mixc(c, C.lip, 0.7); }
        set(Ld, p, c);
      }
    }
    land.g.putImageData(li, 0, 0);
    water.g.putImageData(wi, 0, 0);
    foam.g.putImageData(fi2, 0, 0);

    const g = land.g;
    const P = (x, y) => ISO.w2s(x, y);
    // Soft contact shadows: buildings, trees, props
    g.fillStyle = 'rgba(50, 30, 110, 0.24)';
    for (const b of this.buildings) {
      const pts = [ISO.g2s(b.x0 - 0.2, b.y0 - 0.2), ISO.g2s(b.x0 + b.w + 0.3, b.y0 - 0.2), ISO.g2s(b.x0 + b.w + 0.3, b.y0 + b.h + 0.3), ISO.g2s(b.x0 - 0.2, b.y0 + b.h + 0.3)];
      IS.Iso.poly(g, pts, 'rgba(50, 30, 110, 0.24)');
    }
    for (const o of this.objects) {
      const s = P(o.x, o.y);
      const big = o.kind === 'tree' || o.kind === 'bigoak' || o.kind === 'lighthouse';
      this.shadowEllipse(g, s.x, s.y, big ? (o.big ? 22 : 14) : 9, big ? 7 : 4);
    }
    // Decals: flowers and grass tufts, and fallen leaves under trees
    for (const d of this.decals) { if (this.hidden && this.hidden[this.idx(Math.floor((d.x + 12) / IS.TILE), Math.floor((d.y + 6) / IS.TILE))]) continue; const s = P(d.x + 12, d.y + 12); g.drawImage(d.sprite, Math.round(s.x - d.sprite.width / 2), Math.round(s.y - d.sprite.height + 2)); }
    const r = IS.mulberry32(99);
    for (const o of this.objects) {
      if (o.kind !== 'tree' && o.kind !== 'bigoak') continue;
      const s = P(o.x, o.y);
      for (let k = 0; k < 7; k++) {
        g.fillStyle = ['#ffcf4a', '#f4a63a', '#ffe27a', '#e8843a'][k % 4];
        g.fillRect(Math.round(s.x + (r() - 0.5) * 50), Math.round(s.y + (r() - 0.5) * 22), 2, 1);
      }
    }
    // Picnic blanket
    const pk = ISO.g2s(this.picnic.x, this.picnic.y);
    IS.Iso.plane(g, ISO.g2s(this.picnic.x - 0.4, this.picnic.y - 0.3), ISO.g2s(this.picnic.x + 1.6, this.picnic.y - 0.3), ISO.g2s(this.picnic.x - 0.4, this.picnic.y + 1.4), f => {
      for (let yy = 0; yy < 6; yy++) for (let xx = 0; xx < 6; xx++) { f.fillStyle = (xx + yy) % 2 ? '#fff4e6' : '#ec5a6a'; f.fillRect(xx / 6, yy / 6, 1 / 6 + 0.002, 1 / 6 + 0.002); }
    });
    void pk;

    // Cut the ground into 512px tiles and drop the empty ones. One 4608px-wide canvas is past some
    // GPUs' texture limit and is mostly open sea, which the plain background fill already covers.
    const TS = 512, deep = waterStops[waterStops.length - 1][1];
    const cut = (src, keep) => {
      const out = [];
      for (let ty = 0; ty < H; ty += TS) for (let tx = 0; tx < W; tx += TS) {
        const tw = Math.min(TS, W - tx), th = Math.min(TS, H - ty);
        let used = false;
        for (let y = ty; y < ty + th && !used; y++) for (let x = tx; x < tx + tw; x++) if (keep((y * W + x) * 4)) { used = true; break; }
        if (!used) continue;
        const t = IS.makeCanvas(tw, th, false);
        t.g.drawImage(src, tx, ty, tw, th, 0, 0, tw, th);
        out.push({ x: tx, y: ty, c: t.c });
      }
      return out;
    };
    this.ground = {
      water: cut(water.c, q => Wd[q + 3] && (Math.abs(Wd[q] - deep[0]) > 1 || Math.abs(Wd[q + 1] - deep[1]) > 1 || Math.abs(Wd[q + 2] - deep[2]) > 1)),
      foam: cut(foam.c, q => Fd[q + 3] > 0),
      land: cut(land.c, q => Ld[q + 3] > 0),
    };
    this.pxW = this.W * IS.TILE; this.pxH = this.H * IS.TILE;
  }

  shadowEllipse(g, cx, cy, rx, ry) {
    g.beginPath();
    g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
  }
};
