// The island: terrain, buildings, props, activity spots, pathfinding.
IS.TT = { DEEP: 0, SHALLOW: 1, SAND: 2, GRASS: 3, FOREST: 4, PATH: 5, PLAZA: 6, FLOOR: 7, DOCK: 8, FARM: 9, WALL: 10 };

IS.World = class {
  constructor() {
    this.W = 80;
    this.H = 60;
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
      if (x < 3 || y < 3 || x > W - 4 || y > H - 4) isLand = false;
      land[y * W + x] = isLand ? 1 : 0;
    }
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

    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!land[i]) { this.tiles[i] = this.waterDist[i] <= 3 ? TT.SHALLOW : TT.DEEP; continue; }
      const ld = landDist[i];
      if (ld <= 1 || (y >= 43 && ld <= 3) || (y >= 46 && ld <= 4)) this.tiles[i] = TT.SAND;
      else this.tiles[i] = TT.GRASS;
    }
    // 3. Forest regions
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (this.tile(x, y) !== TT.GRASS) continue;
      const n = n3(x * 0.15, y * 0.15);
      const north = y < 20 - n * 4;
      const west = x < 19 + n * 3 && y < 38;
      const ne = x > 60 && y < 20 && !(x > 64 && y > 17);
      if (north || west || ne) this.setT(x, y, TT.FOREST);
    }

    // 4. Buildings
    const roofs = ['#c95a4a', '#4f7fb8', '#5f9a5a', '#9a6ab8'];
    const walls = ['#f2e2c4', '#e9dcc9', '#f4e8d0', '#efdcc8'];
    const houseX = [15, 24, 51, 60];
    for (let i = 0; i < 4; i++) {
      this.addBuilding({ id: 'house' + i, kind: 'house', x0: houseX[i], y0: 26, w: 6, h: 5, doorCols: [2], roof: roofs[i], wall: walls[i], index: i });
    }
    this.addBuilding({ id: 'hall', kind: 'hall', x0: 35, y0: 23, w: 10, h: 7, doorCols: [4, 5], roof: '#b8603c', wall: '#e8d0a8' });

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
    // Lighthouse on the eastern point
    let lh = null;
    for (let x = W - 2; x > 50 && !lh; x--) for (let yy = 19; yy <= 25; yy++) {
      if (this.isLand(x, yy) && landDist[this.idx(x, yy)] >= 2) { lh = { x, y: yy }; break; }
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
    this.lighthouseLight = { x: lh.x * T + 12, y: lh.y * T + 22 - 80 };

    // Plaza furniture
    place('well', 36, 33, S.well, 15, 35, { footY: 22 });
    place('board', 44, 33, S.noticeBoard, 13, 30, { footY: 21 });
    const benchAt = (x, yy, face, area) => {
      place('bench', x, yy, S.bench, 14, 17, { block: false, footY: 18, sortBias: -6 });
      this.addSpot('bench', x, yy, face, 'sit', { area });
    };
    benchAt(34, 31, 'down', 'plaza'); benchAt(45, 31, 'down', 'plaza');
    benchAt(29, 13, 'down', 'oak');
    // Lamps
    const lampAt = (x, yy) => {
      if (!this.walkable(x, yy) && this.tile(x, yy) !== TT.DOCK) return;
      place('lamp', x, yy, S.lamp, 6, 34, { footY: 20 });
      this.lamps.push({ x: x * T + 12, y: yy * T + 20 - 28 });
    };
    [14, 21, 31, 57, 65].forEach(x => lampAt(x, 31));
    lampAt(33, 34); lampAt(46, 34); lampAt(36, dockEnd - 1); lampAt(43, dockEnd - 1);
    lampAt(49, 20); lampAt(47, 26);
    // Dock clutter
    place('crate', 38, 35, S.crate, 8, 15, { footY: 20 });
    place('barrel', 41, 35, S.barrel, 7, 17, { footY: 20 });
    place('barrel', 47, 29, S.barrel, 7, 17, { footY: 20 });
    place('crate', 34, 29, S.crate, 8, 15, { footY: 20 });
    place('sign', 47, 33, S.signpost, 11, 29, { footY: 21 });

    // Bonfire on the beach
    const bf = this.findNear(53, 47, (x, yy) => this.tile(x, yy) === TT.SAND && landDist[this.idx(x, yy)] >= 2 &&
      [[-2, 0], [2, 0], [-1, -2], [1, -2], [-1, 2], [1, 2], [0, -2], [0, 2]].every(([a, b]) => this.tile(x + a, yy + b) === TT.SAND));
    this.bonfire = { x: bf.x, y: bf.y, lit: false };
    place('firepit', bf.x, bf.y, S.firepit, 15, 12, { footY: 16, protect: 2 });
    for (const [a, b, face] of [[-2, 0, 'right'], [2, 0, 'left'], [-1, -2, 'down'], [1, -2, 'down'], [-1, 2, 'up'], [1, 2, 'up']]) {
      place('log', bf.x + a, bf.y + b, S.logSeat, 13, 8, { block: false, footY: 18, sortBias: -8 });
      this.addSpot('bonfireSeat', bf.x + a, bf.y + b, face, 'sit');
    }

    // Picnic meadow
    this.picnic = { x: 16, y: 40 };
    for (const [a, b, face] of [[-1, 0, 'right'], [2, 0, 'left'], [0, -1, 'down'], [1, 2, 'up'], [0, 2, 'up'], [1, -1, 'down']]) {
      this.addSpot('picnicSeat', this.picnic.x + a, this.picnic.y + b, face, 'sit');
    }
    prot(this.picnic.x, this.picnic.y, 3);

    // Old Oak
    place('bigoak', oak.x, oak.y, IS.Sprites.makeOak(77), 23, 55, { footY: 22, protect: 1, big: true });

    // 7. Farm crops
    const kinds = ['tomato', 'carrot', 'cabbage'];
    for (const cy of [36, 38]) for (let x = 26; x <= 33; x++) {
      const crop = { x, y: cy, kind: kinds[(x + cy) % 3], growth: rng() * 0.9 };
      this.crops.push(crop);
      this.costExtra[this.idx(x, cy)] = 3;
      this.addSpot('farm', x, cy + 1, 'up', 'stand', { crop });
    }

    // 8. Scatter nature
    const near = (x, yy, t, r) => { for (let b = -r; b <= r; b++) for (let a = -r; a <= r; a++) if (this.tile(x + a, yy + b) === t) return true; return false; };
    for (let yy = 1; yy < H - 1; yy++) for (let x = 1; x < W - 1; x++) {
      const i = this.idx(x, yy);
      if (protect[i] || this.blocked[i]) continue;
      const t = this.tiles[i];
      const h = IS.hash2(x, yy, 5);
      const seed = x * 131 + yy * 7;
      if (t === TT.FOREST) {
        if (h < 0.36 && !this.blocked[this.idx(x - 1, yy)] && !this.blocked[this.idx(x, yy - 1)]) {
          const pine = yy < 14 || IS.hash2(x, yy, 9) < 0.35;
          if (pine) place('tree', x, yy, IS.Sprites.makePine(seed), 18, 59, { footY: 22, tree: true });
          else place('tree', x, yy, IS.Sprites.makeOak(seed), 23, 55, { footY: 22, tree: true });
        } else if (h < 0.42) {
          const berries = IS.hash2(x, yy, 3) < 0.5;
          const o = place('bush', x, yy, IS.Sprites.makeBush(seed, berries), 14, 18, { footY: 20 });
          if (berries) o.berries = true;
        } else if (h < 0.44) {
          place('stump', x, yy, IS.Sprites.makeStump(), 10, 14, { footY: 20 });
        } else if (h < 0.55) {
          this.decals.push({ sprite: IS.Sprites.makeTuft(seed), x: x * T + 6 + (h * 97 % 10), y: yy * T + 10 });
        }
      } else if (t === TT.GRASS) {
        if (h < 0.035 && !near(x, yy, TT.PATH, 2)) place('tree', x, yy, IS.Sprites.makeOak(seed), 23, 55, { footY: 22, tree: true });
        else if (h < 0.05) place('bush', x, yy, IS.Sprites.makeBush(seed, false), 14, 18, { footY: 20 });
        else if (h < 0.06) place('rock', x, yy, IS.Sprites.makeRock(seed), 11, 15, { footY: 20 });
        else if (h < 0.16 || (Math.abs(x - this.picnic.x) < 6 && Math.abs(yy - this.picnic.y) < 5 && h < 0.4)) {
          this.decals.push({ sprite: IS.Sprites.makeFlowers(seed), x: x * T, y: yy * T });
        } else if (h < 0.3) {
          this.decals.push({ sprite: IS.Sprites.makeTuft(seed), x: x * T + 4 + (h * 97 % 12), y: yy * T + 6 + (h * 53 % 10) });
        }
      } else if (t === TT.SAND) {
        const ld = landDist[i];
        if (h < 0.05 && ld >= 2 && !near(x, yy, TT.DOCK, 2)) place('tree', x, yy, IS.Sprites.makePalm(seed), 24, 59, { footY: 22, tree: true });
        else if (h < 0.065) place('rock', x, yy, IS.Sprites.makeRock(seed), 11, 15, { footY: 20 });
      }
    }

    // 9. Activity spots
    this.reach = this.computeReach(40, 33);
    const reachable = (x, yy) => this.reach[this.idx(x, yy)] === 1;
    for (let yy = 1; yy < H - 1; yy++) for (let x = 1; x < W - 1; x++) {
      if (!reachable(x, yy)) continue;
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
    for (let yy = 40; yy < H - 1; yy++) for (let x = 1; x < W - 1; x++) {
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
      const beds = Math.max(1, Math.min(2, residents.length));
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
      add('counter', 1, 1, { w: 3 });
      add('fireplace', 6, 1, { w: 2 });
      add('shelf', 8, 1);
      add('shelf', 4, 1);
      add('table', 2, 3, { w: 6, cloth: true });
      add('plant', 1, 5); add('plant', 8, 5);
      add('rug', 3, 5, { w: 4, color: '#a8463a' });
      for (let c = 3; c <= 7; c++) { add('chair', c, 2); this.addSpot('hallSeat', b.x0 + c, b.y0 + 2, 'down', 'sit', { building: b.id }); }
      for (let c = 2; c <= 7; c++) { add('chair', c, 4); this.addSpot('hallSeat', b.x0 + c, b.y0 + 4, 'up', 'sit', { building: b.id }); }
      this.addSpot('cook', b.x0 + 2, b.y0 + 2, 'up', 'stand', { building: b.id });
      this.addSpot('read', b.x0 + 8, b.y0 + 2, 'up', 'stand', { building: b.id, hall: true });
      this.addSpot('shelter', b.x0 + 6, b.y0 + 2, 'up', 'stand', { building: b.id });
      this.addSpot('shelter', b.x0 + 1, b.y0 + 4, 'right', 'stand', { building: b.id });
      this.addSpot('shelter', b.x0 + 8, b.y0 + 4, 'left', 'stand', { building: b.id });
    }
    b.furniture = furniture;
    const ext = IS.Sprites.makeBuilding({
      w: b.w, h: b.h, roof: b.roof, wall: b.wall, doors: b.doorCols,
      windows: b.kind === 'hall' ? [1, 2, 7, 8] : [1, 4],
      chimney: true, bell: b.kind === 'hall', sign: b.kind === 'hall', flowerBoxes: b.kind === 'hall' || b.index % 2 === 0, stone: b.kind === 'hall',
    });
    b.ext = ext;
    b.int = IS.Sprites.makeInterior(b, furniture);
    b.px = b.x0 * IS.TILE - 4;
    b.py = b.y0 * IS.TILE - 18;
    b.sortY = (b.y0 + b.h) * IS.TILE;
    b.cut = 0;        // 0 = roof on, 1 = cutaway
    b.occupants = 0;
    this.buildings.push(b);
  }

  buildingAt(tx, ty) {
    return this.buildings.find(b => tx > b.x0 && tx < b.x0 + b.w - 1 && ty > b.y0 && ty < b.y0 + b.h - 1) ||
      this.buildings.find(b => b.doors.some(d => d.x === tx && d.y === ty)) || null;
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
    if (!this._g || this._g.length !== N) { this._g = new Float32Array(N); this._from = new Int32Array(N); this._stamp = new Uint32Array(N); this._gen = 0; }
    const g = this._g, from = this._from, stamp = this._stamp;
    const gen = ++this._gen;
    const start = this.idx(sx, sy), goal = this.idx(gx, gy);
    const heap = new IS.Heap();
    stamp[start] = gen; g[start] = 0; from[start] = -1;
    heap.push(start, 0);
    let expanded = 0;
    while (heap.size) {
      const cur = heap.pop();
      if (cur === goal) break;
      if (++expanded > 9000) return null;
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
  // Ground pre-render: per-pixel terrain with organic, noise-displaced
  // coastlines, baked decals and shadows.
  // ------------------------------------------------------------------
  renderGround() {
    const TT = IS.TT, T = IS.TILE, W = this.W * T, H = this.H * T;
    const SW = Math.ceil(W / 3), SH = Math.ceil(H / 3);
    const nA = IS.makeNoise(11), nB = IS.makeNoise(23), nC = IS.makeNoise(37);
    const dX = new Float32Array(SW * SH), dY = new Float32Array(SW * SH), patch = new Float32Array(SW * SH);
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
      const px = x * 3, py = y * 3, i = y * SW + x;
      dX[i] = (nA(px / 16, py / 16) - 0.5) * 14 + (nA(px / 5 + 50, py / 5) - 0.5) * 3;
      dY[i] = (nB(px / 16, py / 16) - 0.5) * 14 + (nB(px / 5, py / 5 + 50) - 0.5) * 3;
      patch[i] = nC(px / 60, py / 60);
    }
    const natural = t => t === TT.DEEP || t === TT.SHALLOW || t === TT.SAND || t === TT.GRASS || t === TT.FOREST || t === TT.FARM;
    const isWaterT = t => t === TT.DEEP || t === TT.SHALLOW;
    const mat = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      const ty = (y / T) | 0;
      for (let x = 0; x < W; x++) {
        const tx = (x / T) | 0;
        let t = this.tiles[ty * this.W + tx];
        if (t === TT.WALL || t === TT.FLOOR) t = TT.GRASS;
        if (natural(t) && t !== TT.FARM) {
          const si = ((y / 3) | 0) * SW + ((x / 3) | 0);
          const dx = IS.clamp(((x + dX[si]) / T) | 0, 0, this.W - 1), dy = IS.clamp(((y + dY[si]) / T) | 0, 0, this.H - 1);
          let t2 = this.tiles[dy * this.W + dx];
          if (t2 === TT.WALL || t2 === TT.FLOOR) t2 = TT.GRASS;
          if (natural(t2) && t2 !== TT.FARM) t = t2;
        }
        mat[y * W + x] = t;
      }
    }

    const land = IS.makeCanvas(W, H, false), water = IS.makeCanvas(W, H, false), foam = IS.makeCanvas(W, H, false);
    const li = land.g.createImageData(W, H), wi = water.g.createImageData(W, H), fi = foam.g.createImageData(W, H);
    const L = li.data, Wd = wi.data, F = fi.data;
    const rgb = h => IS.hexToRgb(h);
    const C = {
      g0: rgb('#72ba5b'), g1: rgb('#86c867'), gd: rgb('#64ab50'), gl: rgb('#94d072'), glip: rgb('#4f8c41'),
      f0: rgb('#4a8746'), f1: rgb('#58974e'), fd: rgb('#3f793c'),
      s0: rgb('#f0dba0'), s1: rgb('#f7e7b8'), sd: rgb('#e3cb8d'), swet: rgb('#d8bf84'),
      p0: rgb('#cfa772'), p1: rgb('#c69d68'), pe: rgb('#b08856'), pp: rgb('#a8865a'), pl: rgb('#e2c08e'),
      mort: rgb('#9b9384'), st: ['#d3ccbb', '#c9c1af', '#dcd5c6', '#c2baa7'].map(rgb),
      soil: rgb('#8e5c3b'), furrow: rgb('#6f4530'), soilL: rgb('#a06a46'),
      dk: ['#b98250', '#ad7645', '#c08a57'].map(rgb), seam: rgb('#6e4a2c'), dside: rgb('#7a5232'), dside2: rgb('#5c3d24'),
    };
    const set = (A, i, c, a = 255) => { A[i] = c[0]; A[i + 1] = c[1]; A[i + 2] = c[2]; A[i + 3] = a; };
    const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? TT.DEEP : mat[y * W + x];

    const waterStops = [[0, rgb('#8fe0d8')], [1.0, rgb('#62c8d4')], [2.4, rgb('#45a6cf')], [4.2, rgb('#3884c2')], [7, rgb('#2d66a6')]];
    const waterColor = d => {
      for (let k = 1; k < waterStops.length; k++) {
        if (d <= waterStops[k][0]) {
          const [d0, c0] = waterStops[k - 1], [d1, c1] = waterStops[k];
          return mixc(c0, c1, (d - d0) / (d1 - d0));
        }
      }
      return waterStops[waterStops.length - 1][1];
    };
    const wdAt = (fx, fy) => {
      const x0 = IS.clamp(Math.floor(fx), 0, this.W - 1), y0 = IS.clamp(Math.floor(fy), 0, this.H - 1);
      const x1 = Math.min(x0 + 1, this.W - 1), y1 = Math.min(y0 + 1, this.H - 1);
      const tx = fx - x0, ty = fy - y0;
      const v = i => Math.max(0, this.waterDist[i]);
      return IS.lerp(IS.lerp(v(y0 * this.W + x0), v(y0 * this.W + x1), tx), IS.lerp(v(y1 * this.W + x0), v(y1 * this.W + x1), tx), ty);
    };

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x, p = i * 4;
        const t = mat[i];
        const si = ((y / 3) | 0) * SW + ((x / 3) | 0);
        const hb = IS.hash2(x >> 1, y >> 1, 3);
        if (isWaterT(t)) {
          const d = wdAt((x + dX[si] * 0.6) / T - 0.5, (y + dY[si] * 0.6) / T - 0.5);
          const c = waterColor(d + (hb - 0.5) * 0.25);
          set(Wd, p, c);
          // dock side boards and pilings
          let dockAbove = 0;
          for (let k = 1; k <= 5; k++) if (at(x, y - k) === TT.DOCK) { dockAbove = k; break; }
          if (dockAbove) {
            set(L, p, dockAbove >= 4 ? C.dside2 : C.dside);
          } else {
            // foam: land within 2px = bright band, within 5px = faint band
            let near1 = false, near2 = false;
            for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) if (!isWaterT(at(x + a, y + b))) { near1 = true; break; }
            if (!near1) for (const [a, b] of [[4, 0], [-4, 0], [0, 4], [0, -4], [3, 3], [-3, 3], [3, -3], [-3, -3], [5, 0], [-5, 0], [0, 5], [0, -5]]) if (!isWaterT(at(x + a, y + b))) { near2 = true; break; }
            if (near1) set(F, p, [255, 255, 250], 230);
            else if (near2 && hb > 0.35) set(F, p, [235, 250, 250], 110);
          }
          continue;
        }
        let c;
        switch (t) {
          case TT.GRASS: {
            c = mixc(C.g0, C.g1, patch[si]);
            if (hb < 0.18) c = mixc(c, C.gd, 0.6); else if (hb > 0.93) c = mixc(c, C.gl, 0.7);
            const below1 = at(x, y + 1), below2 = at(x, y + 2), below3 = at(x, y + 3);
            if ((below1 !== TT.GRASS && below1 !== TT.FOREST) || (below2 !== TT.GRASS && below2 !== TT.FOREST && below2 !== TT.PATH && below2 !== TT.PLAZA)) {
              if (below1 === TT.SAND || isWaterT(below1) || below2 === TT.SAND || isWaterT(below2)) c = C.glip;
            } else if (below3 === TT.SAND) c = mixc(c, C.glip, 0.4);
            break;
          }
          case TT.FOREST: {
            c = mixc(C.f0, C.f1, patch[si]);
            if (hb < 0.2) c = C.fd;
            const b1 = at(x, y + 1), b2 = at(x, y + 2);
            if (b1 === TT.SAND || b2 === TT.SAND || isWaterT(b1)) c = C.glip;
            break;
          }
          case TT.SAND: {
            c = mixc(C.s0, C.s1, patch[si]);
            if (hb < 0.06) c = C.sd;
            let wet = false;
            for (const [a, b] of [[0, 3], [0, 2], [3, 0], [-3, 0], [0, -3], [2, 2], [-2, 2]]) if (isWaterT(at(x + a, y + b))) { wet = true; break; }
            if (wet) c = mixc(c, C.swet, 0.8);
            break;
          }
          case TT.PATH: {
            c = mixc(C.p0, C.p1, patch[si]);
            const h1 = IS.hash2(x, y, 9);
            if (h1 < 0.025) c = C.pp; else if (h1 > 0.985) c = C.pl;
            let edge = false;
            for (const [a, b] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) { const m = at(x + a, y + b); if (m !== TT.PATH && m !== TT.PLAZA && m !== TT.DOCK) { edge = true; break; } }
            if (edge) c = mixc(c, C.pe, 0.7);
            break;
          }
          case TT.PLAZA: {
            const row = (y / 8) | 0, off = (row % 2) * 6;
            const lx = (x + off) % 12, ly = y % 8;
            if (lx === 0 || ly === 0) c = C.mort;
            else {
              c = C.st[Math.floor(IS.hash2(((x + off) / 12) | 0, row, 4) * 4)];
              if (ly === 1 || lx === 1) c = mixc(c, [255, 252, 240], 0.25);
              if (ly === 7) c = mixc(c, C.mort, 0.4);
            }
            break;
          }
          case TT.FARM: {
            c = (y % 12) < 3 ? C.furrow : C.soil;
            if (hb > 0.92) c = C.soilL;
            break;
          }
          case TT.DOCK: {
            const lx = x % 8, ly = y % 40;
            if (lx === 0 || ly === 0) c = C.seam;
            else {
              c = C.dk[Math.floor(IS.hash2((x / 8) | 0, (y / 40) | 0, 6) * 3)];
              if ((lx === 2 || lx === 6) && ly === 3) c = C.dside2;
              if (lx === 1) c = mixc(c, [255, 240, 210], 0.2);
            }
            break;
          }
          default: c = C.g0;
        }
        set(L, p, c);
        // a few water pixels show through the land canvas are already alpha 0
      }
    }
    land.g.putImageData(li, 0, 0);
    water.g.putImageData(wi, 0, 0);
    foam.g.putImageData(fi, 0, 0);

    // Bake decals and soft shadows
    const g = land.g;
    for (const d of this.decals) g.drawImage(d.sprite, Math.round(d.x), Math.round(d.y));
    g.fillStyle = 'rgba(30, 40, 50, 0.22)';
    for (const o of this.objects) {
      if (o.kind === 'tree' || o.kind === 'bigoak') { this.shadowEllipse(g, o.x, o.y - 1, o.big ? 22 : 15, 5); }
      else if (o.kind === 'lighthouse') this.shadowEllipse(g, o.x, o.y - 2, 18, 6);
      else if (o.kind !== 'log' && o.kind !== 'bench') this.shadowEllipse(g, o.x, o.y - 1, 8, 3);
    }
    for (const b of this.buildings) {
      g.fillStyle = 'rgba(30, 40, 50, 0.22)';
      g.fillRect(b.x0 * T + 6, (b.y0 + b.h) * T, b.w * T - 4, 5);
    }
    // Dock pilings
    g.fillStyle = '#4a3220';
    for (let y = this.dock.startY; y <= this.dock.endY; y++) {
      if (this.tile(38, y) !== TT.DOCK) { g.fillRect(39 * T - 2, y * T + 8, 3, 8); g.fillRect(41 * T - 1, y * T + 8, 3, 8); }
    }
    // Picnic blanket
    g.drawImage(IS.Sprites.blanket, this.picnic.x * T - 4, this.picnic.y * T - 8);

    this.landCanvas = land.c;
    this.waterCanvas = water.c;
    this.foamCanvas = foam.c;
    this.pxW = W; this.pxH = H;
  }

  shadowEllipse(g, cx, cy, rx, ry) {
    g.beginPath();
    g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
  }
};
