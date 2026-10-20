// Particles live in isometric screen space (iso pixels).
IS.FX = class {
  constructor() { this.p = []; }
  add(o) { if (this.p.length < 700) this.p.push(Object.assign({ life: 0, g: 0, size: 1, alpha: 1 }, o)); }
  at(wx, wy, h = 0) { const s = IS.Iso.w2s(wx, wy); return { x: s.x, y: s.y - h }; }
  splash(wx, wy, n = 10) {
    const s = this.at(wx, wy);
    for (let i = 0; i < n; i++) this.add({ x: s.x, y: s.y, vx: IS.rand(-40, 40), vy: IS.rand(-110, -40), g: 300, max: IS.rand(0.4, 0.8), color: Math.random() < 0.5 ? '#ffffff' : '#bff6ff', size: 2 });
    this.add({ x: s.x, y: s.y + 2, kind: 'ring', max: 1.1, color: '#e8fbff' });
  }
  ripple(wx, wy) { const s = this.at(wx, wy); this.add({ x: s.x, y: s.y, kind: 'ring', max: 1.1, color: '#e8fbff' }); }
  drip(wx, wy, h = 14) { const s = this.at(wx, wy, h); this.add({ x: s.x, y: s.y, vx: 0, vy: 10, g: 200, max: 0.35, color: '#7ed6f8', size: 1 }); }
  dust(wx, wy) { const s = this.at(wx, wy); for (let i = 0; i < 8; i++) this.add({ x: s.x + IS.rand(-6, 6), y: s.y - 2, vx: IS.rand(-30, 30), vy: IS.rand(-30, -5), g: 30, max: IS.rand(0.4, 0.7), color: '#f0dcc0', size: 3, fade: true }); }
  chips(wx, wy, h = 22) { const s = this.at(wx, wy, h); this.add({ x: s.x + IS.rand(-4, 4), y: s.y, vx: IS.rand(-50, 50), vy: IS.rand(-90, -40), g: 320, max: 0.6, color: Math.random() < 0.5 ? '#e0a868' : '#9a5a34', size: 2 }); }
  smoke(sx, sy) { this.add({ x: sx + IS.rand(-2, 2), y: sy, vx: IS.rand(4, 10), vy: IS.rand(-14, -8), g: 0, max: IS.rand(2.2, 3.2), color: '#f2ecf8', size: 4, fade: true, grow: true }); }
  spark(sx, sy) { this.add({ x: sx + IS.rand(-5, 5), y: sy, vx: IS.rand(-8, 8), vy: IS.rand(-45, -25), g: 0, max: IS.rand(0.6, 1.2), color: Math.random() < 0.5 ? '#ffe07a' : '#ff8a3a', size: 1, fade: true }); }
  update(rdt) {
    for (const q of this.p) {
      q.life += rdt;
      if (q.kind === 'ring' || q.landed) continue;
      q.vy += q.g * rdt;
      if (q.stick && q.vy > 0 && q.y >= q.gy) { q.y = q.gy; q.landed = true; continue; }
      q.x += q.vx * rdt; q.y += q.vy * rdt;
    }
    this.p = this.p.filter(q => q.life < q.max);
  }
  draw(ctx, ox, oy) {
    for (const q of this.p) {
      const t = q.life / q.max;
      if (q.kind === 'ring') {
        ctx.globalAlpha = 0.7 * (1 - t);
        ctx.strokeStyle = q.color; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(Math.round(q.x - ox) + 0.5, Math.round(q.y - oy) + 0.5, 3 + t * 10, 1.5 + t * 5, 0, 0, Math.PI * 2); ctx.stroke();
        continue;
      }
      ctx.globalAlpha = q.fade ? 0.85 * (1 - t) : q.stick ? Math.min(1, (1 - t) * 4) : 1;
      ctx.fillStyle = q.color;
      const s = q.grow ? Math.round(q.size + t * 5) : q.size;
      ctx.fillRect(Math.round(q.x - ox - s / 2), Math.round(q.y - oy - s / 2), s, s);
    }
    ctx.globalAlpha = 1;
  }
};

IS.Renderer = class {
  constructor(sim, canvas) {
    this.sim = sim;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.light = IS.makeCanvas(16, 16, false);
    this.shadowStatic = IS.makeCanvas(16, 16, false);
    this.winMask = IS.makeCanvas(16, 16, false);
    this.silCache = new WeakMap();
    this.wave = this.makeWaveTexture();
    this.fog = this.makeFogTexture();
    this.cloud = this.makeCloud();
    this.rain = [];
    this.flash = 0;
    this.nextFlash = 3;
    this.gulls = [];
    const I = IS.Iso;
    this.clouds = Array.from({ length: 6 }, () => ({ x: Math.random() * I.W, y: Math.random() * I.H, s: IS.rand(0.9, 1.6) }));
    this.fireflies = Array.from({ length: 50 }, () => {
      const t = IS.pick(sim.world.spots.forage || [{ x: 30, y: 12 }]);
      return { x: t.x * IS.TILE + IS.rand(0, 24), y: t.y * IS.TILE + IS.rand(-20, 10), ph: Math.random() * 10 };
    });
    for (const b of sim.world.buildings) {
      const c = b.iso.canvas;
      b.iso.alpha = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    }
    this.prepObjects();
    this.resize();
  }

  // Static depth keys, nudged so things in front of a building draw after it
  prepObjects() {
    for (const o of this.sim.world.objects) {
      const gx = o.x / IS.TILE, gy = (o.y - 6) / IS.TILE;
      o.s = IS.Iso.w2s(o.x, o.y);
      o.depth = this.depthAt(gx, gy);
    }
  }
  depthAt(gx, gy) {
    let key = gx + gy;
    for (const b of this.sim.world.buildings.concat(IS.Build.sites(this.sim))) {
      if (gx < b.x0 - 2 || gx > b.x0 + b.w + 2 || gy < b.y0 - 2 || gy > b.y0 + b.h + 2) continue;
      const inside = gx >= b.x0 && gx <= b.x0 + b.w && gy >= b.y0 && gy <= b.y0 + b.h;
      if (inside) key = Math.min(key, b.depth - 0.02);
      else if (gy >= b.y0 + b.h || gx >= b.x0 + b.w) key = Math.max(key, b.depth + 0.02);
      else key = Math.min(key, b.depth - 0.02);
    }
    return key;
  }

  resize() {
    this.quality = null; // re-measure at the new size
    const wrap = this.canvas.parentElement;
    const cw = wrap.clientWidth, ch = wrap.clientHeight;
    const z = this.sim.cam.zoom;
    const vw = Math.ceil(cw / z), vh = Math.ceil(ch / z);
    this.canvas.width = vw; this.canvas.height = vh;
    this.canvas.style.width = vw * z + 'px';
    this.canvas.style.height = vh * z + 'px';
    this.light.c.width = vw; this.light.c.height = vh;
    this.shadowStatic.c.width = vw; this.shadowStatic.c.height = vh;
    this.winMask.c.width = vw; this.winMask.c.height = vh;
    this.bloomA = IS.makeCanvas(Math.ceil(vw / 4), Math.ceil(vh / 4), false);
    this.bloomB = IS.makeCanvas(Math.ceil(vw / 12), Math.ceil(vh / 12), false);
    this.bloomC = IS.makeCanvas(Math.ceil(vw / 40), Math.ceil(vh / 40), false);
    this.bloomS = IS.makeCanvas(Math.ceil(vw / 48), Math.ceil(vh / 4), false);
    const vg = IS.makeCanvas(vw, vh, false);
    const rad = Math.hypot(vw, vh) / 2;
    const gr = vg.g.createRadialGradient(vw / 2, vh / 2, rad * 0.5, vw / 2, vh / 2, rad);
    gr.addColorStop(0, 'rgba(40, 20, 80, 0)');
    gr.addColorStop(1, 'rgba(40, 20, 80, 0.38)');
    vg.g.fillStyle = gr; vg.g.fillRect(0, 0, vw, vh);
    this.vignette = vg.c;
    // Directional light: warm from the upper left, cool toward the lower right
    const dl = IS.makeCanvas(vw, vh, false);
    const lg = dl.g.createLinearGradient(0, 0, vw, vh);
    lg.addColorStop(0, 'rgba(255, 200, 120, 1)'); lg.addColorStop(0.55, 'rgba(255, 220, 190, 0.2)'); lg.addColorStop(1, 'rgba(90, 100, 220, 1)');
    dl.g.fillStyle = lg; dl.g.fillRect(0, 0, vw, vh);
    this.dirLight = dl.c;
    this.ctx.imageSmoothingEnabled = false;
    this.vw = vw; this.vh = vh;
    this.waveA = this.ctx.createPattern(this.wave, 'repeat');
  }

  // World px (ground) -> canvas px
  toScreen(x, y, z = 0) {
    const s = IS.Iso.w2s(x, y);
    return { x: s.x - this.ox, y: s.y - this.oy - z };
  }

  buildingAtIso(ix, iy) {
    for (const b of this.sim.world.buildings) {
      if (b.noCut) continue;
      const lx = Math.floor(ix - b.iso.ox), ly = Math.floor(iy - b.iso.oy);
      if (lx < 0 || ly < 0 || lx >= b.iso.w || ly >= b.iso.h) continue;
      if (b.iso.alpha[(ly * b.iso.canvas.width + lx) * 4 + 3] > 0) return b;
    }
    return null;
  }

  makeWaveTexture() {
    const { c, g } = IS.makeCanvas(96, 96);
    const r = IS.mulberry32(5);
    for (let i = 0; i < 30; i++) {
      const x = Math.floor(r() * 96), y = Math.floor(r() * 96), len = 2 + Math.floor(r() * 5);
      g.fillStyle = r() < 0.7 ? 'rgba(220, 252, 255, 0.6)' : 'rgba(255,255,255,0.9)';
      g.fillRect(x, y, len, 1);
      if (len > 4) g.fillRect(x + 1, y - 1, len - 2, 1);
    }
    return c;
  }
  makeFogTexture() {
    const { c, g } = IS.makeCanvas(256, 256);
    const n = IS.makeNoise(99);
    const img = g.createImageData(256, 256);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const v = (n(x / 40, y / 40) + n(x / 15, y / 15) * 0.4) / 1.4;
      const i = (y * 256 + x) * 4;
      img.data[i] = 235; img.data[i + 1] = 236; img.data[i + 2] = 250; img.data[i + 3] = Math.max(0, v - 0.35) * 260;
    }
    g.putImageData(img, 0, 0);
    return c;
  }
  makeCloud() {
    const { c, g } = IS.makeCanvas(300, 170);
    for (let i = 0; i < 7; i++) {
      const gr = g.createRadialGradient(60 + i * 28, 85 + Math.sin(i) * 20, 0, 60 + i * 28, 85 + Math.sin(i) * 20, 64);
      gr.addColorStop(0, 'rgba(40, 30, 110, 0.12)');
      gr.addColorStop(1, 'rgba(40, 30, 110, 0)');
      g.fillStyle = gr; g.fillRect(0, 0, 300, 170);
    }
    return c;
  }

  // Ambient light by time of day: a tint and how strongly it applies (multiply).
  ambient(min) {
    const K = [
      [0, [50, 38, 120], 0.76], [300, [50, 38, 120], 0.74], [345, [110, 80, 170], 0.58], [390, [255, 150, 170], 0.34],
      [450, [255, 188, 150], 0.22], [540, [255, 214, 170], 0.13], [660, [255, 230, 196], 0.08], [900, [255, 230, 196], 0.08], [1010, [255, 180, 120], 0.24],
      [1065, [245, 130, 160], 0.38], [1120, [170, 115, 220], 0.54], [1190, [110, 80, 195], 0.66], [1290, [50, 38, 120], 0.76],
      [1440, [50, 38, 120], 0.76],
    ];
    let i = 1;
    while (i < K.length - 1 && K[i][0] <= min) i++;
    const [m0, c0, k0] = K[i - 1], [m1, c1, k1] = K[i];
    const t = IS.clamp((min - m0) / (m1 - m0), 0, 1);
    let tint = c0.map((v, j) => IS.lerp(v, c1[j], t));
    let k = IS.lerp(k0, k1, t);
    const w = this.sim.weather;
    const toward = (c, f) => { tint = tint.map((v, j) => IS.lerp(v, c[j], f)); };
    if (w === 'cloudy') { k += 0.07; toward([190, 190, 225], 0.4); }
    if (w === 'rain') { k += 0.2; toward([110, 120, 180], 0.7); }
    if (w === 'storm') { k += 0.32; toward([80, 84, 150], 0.85); }
    if (w === 'fog') { k += 0.05; toward([220, 214, 240], 0.4); }
    k = Math.min(0.85, k);
    const mult = tint.map(v => Math.round(IS.lerp(255, v, k)));
    return { tint, k, mult, dark: IS.clamp((k - 0.16) / 0.42, 0, 1) };
  }

  // ------------------------------------------------------------------
  // Effects quality: after a resize or zoom, time the first frames with every effect on. If they are
  // slow (Chrome drawing this canvas on the CPU), drop the purely decorative full-screen layers at that size.
  draw(now, rdt) {
    const t0 = performance.now();
    this.drawFrame(now, rdt);
    const q = this.quality || (this.quality = { n: 0, ms: 0, low: false });
    if (q.n < 60) { q.ms += performance.now() - t0; if (++q.n === 60) q.low = q.ms / 60 > 14; }
  }

  drawFrame(now, rdt) {
    const sim = this.sim, w = sim.world, ctx = this.ctx, I = IS.Iso, T = IS.TILE;
    const vw = this.vw, vh = this.vh, cam = sim.cam;
    cam.x = vw >= I.W ? I.W / 2 : IS.clamp(cam.x, vw / 2, I.W - vw / 2);
    cam.y = vh >= I.H ? I.H / 2 : IS.clamp(cam.y, vh / 2, I.H - vh / 2);
    const shk = sim.shake || 0;
    const ox = Math.round(cam.x - vw / 2 + (shk ? IS.rand(-shk, shk) : 0)), oy = Math.round(cam.y - vh / 2 + (shk ? IS.rand(-shk, shk) : 0));
    this.ox = ox; this.oy = oy;
    const t = now / 1000;
    const amb = this.ambient(sim.clock.min);

    ctx.fillStyle = '#3448b8';
    ctx.fillRect(0, 0, vw, vh);
    const tiles = (list, dy = 0) => { for (const g of list) if (g.x < ox + vw && g.x + g.c.width > ox && g.y + dy < oy + vh && g.y + g.c.height + dy > oy) ctx.drawImage(g.c, g.x - ox, g.y - oy + dy); };
    tiles(w.ground.water);
    const wt = sim.waveTime;
    for (const [dx, dy, a] of [[wt * 6, wt * 3, 0.55], [-wt * 4 + 40, wt * 2 + 20, 0.35]]) {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(Math.round(-ox + dx), Math.round(-oy + dy));
      ctx.fillStyle = this.waveA;
      ctx.fillRect(Math.round(ox - dx), Math.round(oy - dy), vw, vh);
      ctx.restore();
    }
    ctx.globalAlpha = 0.6 + 0.35 * Math.sin(t * 1.4);
    tiles(w.ground.foam);
    ctx.globalAlpha = 1;
    this.drawDolphins(ctx, ox, oy, now);
    IS.Content.drawSea(this, ctx, ox, oy, now);
    tiles(w.ground.land);
    IS.Build.drawGround(this, ctx, ox, oy, t);

    const inView = (x, y, m = 80) => x > ox - m && x < ox + vw + m && y > oy - m && y < oy + vh + m * 2;
    for (const cr of w.crops) {
      const s = I.g2s(cr.x + 0.5, cr.y + 0.5);
      if (!inView(s.x, s.y)) continue;
      const st = cr.growth >= 1 ? 3 : cr.growth < 0.15 ? 0 : cr.growth < 0.55 ? 1 : 2;
      ctx.drawImage(IS.Sprites.crops[cr.kind][st], Math.round(s.x - 9 - ox), Math.round(s.y - 14 - oy));
    }
    IS.Gods.drawDecals(this, ctx, ox, oy, t);
    const bot = sim.events.bottle;
    if (bot) {
      const s = I.g2s(bot.tx + 0.5, bot.ty + 0.5);
      const bx = Math.round(s.x - 6 - ox), by = Math.round(s.y - 8 - oy + Math.sin(t * 2));
      ctx.drawImage(IS.Sprites.bottle, bx, by);
      if (Math.sin(t * 3) > 0.8) { ctx.fillStyle = '#ffffff'; ctx.fillRect(bx + 4, by - 2, 1, 1); ctx.fillRect(bx + 3, by - 1, 3, 1); }
    }
    for (const b of w.buildings) {
      if (b.cut > 0.01 && b.iso.interior) {
        ctx.globalAlpha = b.cut;
        ctx.drawImage(b.iso.interior.canvas, Math.round(b.iso.ox - ox), Math.round(b.iso.oy - oy));
        this.drawInteriorLive(ctx, b, ox, oy, t);
        ctx.globalAlpha = 1;
      }
    }
    const sel = sim.selected;
    if (sel && sel.mode !== 'carried' && sel.mode !== 'air') {
      const s = this.toScreen(sel.x, sel.y);
      ctx.strokeStyle = '#ffd27a';
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 5);
      ctx.beginPath(); ctx.ellipse(Math.round(s.x) + 0.5, Math.round(s.y) + 0.5, 11, 5, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (sim.weather === 'sunny' || sim.weather === 'cloudy') {
      for (const cl of this.clouds) {
        cl.x += rdt * 7 * Math.max(1, sim.speedValue() * 0.3);
        if (cl.x > I.W + 300) { cl.x = -320; cl.y = Math.random() * I.H; }
        if (!inView(cl.x, cl.y, 340)) continue;
        ctx.globalAlpha = sim.weather === 'cloudy' ? 1 : 0.7;
        ctx.drawImage(this.cloud, Math.round(cl.x - ox), Math.round(cl.y - oy), 300 * cl.s, 170 * cl.s);
      }
      ctx.globalAlpha = 1;
    }

    this.drawCastShadows(ctx, ox, oy, inView);

    // Depth-sorted pass
    const list = [];
    for (const o of w.objects) if (inView(o.s.x, o.s.y, 90)) list.push({ d: o.depth, o, kind: 'obj' });
    for (const b of w.buildings) if (inView(b.iso.ox + b.iso.w / 2, b.iso.oy + b.iso.h / 2, b.iso.w)) list.push({ d: b.depth, b, kind: 'bld' });
    for (const s of IS.Build.sites(sim)) list.push({ d: s.depth, s, kind: 'site' });
    for (const p of sim.people) {
      const gx = p.x / T, gy = (p.y - 6) / T;
      list.push({ d: (p.mode === 'carried' || p.mode === 'air' || p.mode === 'hop') ? 1e6 : this.depthAt(gx, gy), p, kind: 'person' });
    }
    for (const g of sim.graves) if (g.stage !== 'lost') list.push({ d: this.depthAt(g.x / T, (g.y - 6) / T), g, kind: 'grave' });
    const boat = sim.events.boat;
    if (boat) list.push({ d: boat.x / T + (boat.y - 6) / T, kind: 'boat' });
    if (sim.cat) list.push({ d: this.depthAt(sim.cat.x / T, (sim.cat.y - 6) / T), kind: 'cat' });
    if (sim.kitten) list.push({ d: this.depthAt(sim.kitten.x / T, (sim.kitten.y - 6) / T), kind: 'kitten' });
    for (const o of IS.Content.objects(sim)) list.push({ d: this.depthAt(o.x / T, (o.y - 6) / T) - 0.05, o, kind: 'cobj' });
    list.sort((a, b) => a.d - b.d);
    // Lit window panes go into their own layer as each building is drawn, and whatever is drawn in
    // front of that building erases its shape from it. The lighting pass lays the layer on top, so
    // panes stay bright through the night darkness without shining through trees and people.
    const WM = this.winMask.g, winBoxes = [];
    if (this.winUsed) WM.clearRect(0, 0, this.vw, this.vh);
    this.winUsed = w.buildings.some(b => b.lit);
    const hide = (img, x, y, sw, sh) => {
      if (!winBoxes.length) return;
      const w2 = sw || img.width, h2 = sh || img.height;
      if (!winBoxes.some(r => x < r.x + r.w && x + w2 > r.x && y < r.y + r.h && y + h2 > r.y)) return;
      WM.globalCompositeOperation = 'destination-out';
      if (sw) WM.drawImage(img, 0, 0, sw, sh, x, y, sw, sh); else WM.drawImage(img, x, y);
      WM.globalCompositeOperation = 'source-over';
    };
    for (const it of list) {
      if (it.kind === 'obj') {
        const o = it.o;
        ctx.drawImage(o.sprite, Math.round(o.s.x - o.ax - ox), Math.round(o.s.y - o.ay - oy));
        hide(o.sprite, Math.round(o.s.x - o.ax - ox), Math.round(o.s.y - o.ay - oy));
        if (o.kind === 'firepit' && w.bonfire.lit) this.drawFire(ctx, o.s.x - ox, o.s.y - oy - 4, t);
      } else if (it.kind === 'bld') {
        const b = it.b;
        if (b.cut < 0.99) {
          ctx.globalAlpha = 1 - b.cut;
          ctx.drawImage(b.iso.canvas, Math.round(b.iso.ox - ox), Math.round(b.iso.oy - oy));
          ctx.globalAlpha = 1;
          if (b.cut < 0.5) hide(b.iso.canvas, Math.round(b.iso.ox - ox), Math.round(b.iso.oy - oy));
        }
        if (b.cut > 0.01 && b.iso.interior) {
          ctx.globalAlpha = b.cut;
          ctx.drawImage(b.iso.interior.front, Math.round(b.iso.ox - ox), Math.round(b.iso.oy - oy));
          ctx.globalAlpha = 1;
        }
        if (b.lit && b.cut < 0.6) {
          WM.globalAlpha = 1 - b.cut;
          for (const win of b.iso.windows) {
            const pts = win.pts.map(q => ({ x: q.x - ox, y: q.y - oy }));
            IS.Iso.poly(WM, pts, win.glass ? '#fff0c0' : '#ffdf96');
            IS.Iso.poly(WM, [pts[0], pts[1], { x: pts[1].x, y: pts[1].y - 3 }, { x: pts[0].x, y: pts[0].y - 3 }], '#fff8e0');
          }
          WM.globalAlpha = 1;
          winBoxes.push({ x: b.iso.ox - ox, y: b.iso.oy - oy, w: b.iso.w, h: b.iso.h });
        }
      } else if (it.kind === 'person') {
        this.drawPerson(ctx, it.p, ox, oy, t);
        const p = it.p;
        if (winBoxes.length && p.mode === 'normal' && (p.pose !== 'sleep' && p.pose !== 'swim') && !(p.building && p.building.cut < 0.99)) {
          const s = IS.Iso.w2s(p.x, p.y), img = p.frames[p.dir][p.pose === 'walk' ? [1, 0, 2, 0][Math.floor(p.anim / 6) % 4] : 0];
          if (p.pose === 'sit') hide(img, Math.round(s.x - ox) - 11, Math.round(s.y - oy) - 30, 22, 30); else hide(img, Math.round(s.x - ox) - 11, Math.round(s.y - oy) - 34);
        }
      } else if (it.kind === 'grave') {
        IS.Gods.drawGrave(this, ctx, it.g, ox, oy, t);
      } else if (it.kind === 'cat') {
        sim.cat.draw(ctx, ox, oy, now);
      } else if (it.kind === 'kitten') {
        sim.kitten.draw(ctx, ox, oy, now);
      } else if (it.kind === 'site') {
        IS.Build.drawSite(this, ctx, it.s, ox, oy, t);
      } else if (it.kind === 'cobj') {
        IS.Content.drawObj(this, ctx, it.o, ox, oy, t);
      } else if (it.kind === 'boat') {
        const s = I.w2s(boat.x, boat.y);
        ctx.drawImage(IS.Sprites.boat, Math.round(s.x - 40 - ox), Math.round(s.y - 60 - oy + Math.sin(t * 1.5) * 1.5));
      }
    }
    IS.Build.drawGhost(this, ctx, ox, oy);
    sim.fx.draw(ctx, ox, oy);
    IS.Gods.drawFx(this, ctx, ox, oy, now);
    IS.Gods.drawReticle(this, ctx, ox, oy, t);
    this.drawPendants(ctx, ox, oy);
    this.drawStringLights(ctx, ox, oy, t);
    this.drawGulls(ctx, ox, oy, rdt, t);

    const lowFx = this.quality && this.quality.low;
    if (amb.dark < 1 && !lowFx) {
      ctx.globalCompositeOperation = 'soft-light';
      ctx.globalAlpha = 0.3 * (1 - amb.dark);
      ctx.drawImage(this.dirLight, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    if (!lowFx) this.drawClouds(ctx, ox, oy, t, amb);
    this.drawGlints(ctx, ox, oy, t, amb);
    this.drawLighting(ctx, amb, ox, oy, t);
    this.drawWeather(ctx, rdt, t, amb);
    if (!lowFx) this.drawRays(ctx, ox, oy, t);
    this.drawMotes(ctx, ox, oy, t, amb);
    if (!lowFx) this.drawBloom(ctx, amb);
    this.drawStars(ctx, now);
    IS.Content.drawSky(this, ctx, now);
    if (!lowFx) ctx.drawImage(this.vignette, 0, 0);
    for (const p of sim.people) this.drawEmote(ctx, p, ox, oy, now);
  }

  pendantSpots(b) {
    return b.kind === 'hall' ? [[3.5, 3.5], [6.5, 3.5]] : [[3, 2.5]];
  }

  drawInteriorLive(ctx, b, ox, oy, t) {
    const I = IS.Iso, sim = this.sim;
    if (b.kind !== 'hall') return;
    const ev = sim.events.list.find(e => e.state === 'active' && e.seat === 'hallSeat');
    if (!ev) return;
    for (let c = 2; c <= 7; c++) {
      const s = I.up(I.g2s(b.x0 + c + 0.5, b.y0 + 3.5), 10);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(s.x - ox) - 3, Math.round(s.y - oy) - 1, 6, 3);
      ctx.fillStyle = ev.feast === false ? '#d8b07a' : ['#ff5a5a', '#ffc84a', '#7ad050'][c % 3]; ctx.fillRect(Math.round(s.x - ox) - 1, Math.round(s.y - oy) - 1, 3, 2);
    }
    if (ev.birthday) {
      const s = I.up(I.g2s(b.x0 + 5, b.y0 + 3.5), 10);
      const x = Math.round(s.x - ox), y = Math.round(s.y - oy);
      ctx.fillStyle = '#fff4e6'; ctx.fillRect(x - 5, y - 8, 10, 8);
      ctx.fillStyle = '#ff8ab8'; ctx.fillRect(x - 5, y - 8, 10, 2);
      ctx.fillStyle = '#ffe07a'; ctx.fillRect(x, y - 12 - Math.round(Math.sin(t * 10)), 1, 3);
    }
  }

  drawPendants(ctx, ox, oy) {
    const I = IS.Iso;
    for (const b of this.sim.world.buildings) {
      if (b.cut < 0.05 || !b.iso.interior) continue;
      ctx.globalAlpha = b.cut;
      for (const [c, r] of this.pendantSpots(b)) {
        const s = I.up(I.g2s(b.x0 + c, b.y0 + r), 28);
        const x = Math.round(s.x - ox), y = Math.round(s.y - oy);
        ctx.fillStyle = '#3b3346'; ctx.fillRect(x, y - 16, 1, 12);
        ctx.fillStyle = '#8a3a2a'; ctx.fillRect(x - 6, y - 5, 13, 2);
        ctx.fillStyle = '#ff7a3a'; ctx.fillRect(x - 5, y - 4, 11, 4); ctx.fillRect(x - 6, y, 13, 2);
        ctx.fillStyle = '#ffe07a'; ctx.fillRect(x - 3, y + 2, 7, 1);
        ctx.fillStyle = '#fff8d8'; ctx.fillRect(x - 1, y + 2, 3, 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  stringPoints(s) {
    const I = IS.Iso;
    const a = I.g2s(s.a.gx, s.a.gy), b = I.g2s(s.b.gx, s.b.gy);
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(2, Math.floor(len / 9));
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      pts.push({ x: IS.lerp(a.x, b.x, u), y: IS.lerp(a.y, b.y, u) - s.h + Math.sin(u * Math.PI) * 9 });
    }
    return pts;
  }
  drawStringLights(ctx, ox, oy) {
    const strings = this.sim.world.stringLights || [];
    const cols = ['#ffd27a', '#ff9a6a', '#fff0b0', '#ffb8d8'];
    for (const s of strings) {
      const pts = this.stringPoints(s);
      ctx.strokeStyle = '#3a2a48'; ctx.lineWidth = 1;
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x - ox, p.y - oy) : ctx.moveTo(p.x - ox, p.y - oy)));
      ctx.stroke();
      pts.forEach((p, i) => {
        if (i === 0 || i === pts.length - 1) return;
        ctx.fillStyle = cols[i % cols.length];
        ctx.fillRect(Math.round(p.x - ox) - 1, Math.round(p.y - oy) + 1, 2, 2);
      });
    }
  }

  drawFire(ctx, x, y, t) {
    x = Math.round(x); y = Math.round(y);
    const f = k => Math.round(Math.sin(t * (7 + k) + k * 2) * 2);
    ctx.fillStyle = '#e8343f'; ctx.fillRect(x - 7, y - 6 + f(1), 14, 8);
    ctx.fillStyle = '#ff8a3a'; ctx.fillRect(x - 5, y - 11 + f(2), 10, 12); ctx.fillRect(x - 8, y - 4, 3, 5);
    ctx.fillStyle = '#ffd56a'; ctx.fillRect(x - 3, y - 14 + f(3), 6, 13);
    ctx.fillStyle = '#fff4c8'; ctx.fillRect(x - 1, y - 9 + f(4), 2, 7);
    if (Math.random() < 0.3) this.sim.fx.spark(x + this.ox, y - 12 + this.oy);
  }

  drawPerson(ctx, p, ox, oy, t) {
    const s = IS.Iso.w2s(p.x, p.y);
    const sx = Math.round(s.x - ox), sy = Math.round(s.y - oy);
    if (sx < -40 || sy < -60 || sx > this.vw + 40 || sy > this.vh + 80) return;
    const frames = p.frames[p.dir];
    let f = 0;
    if (p.pose === 'walk') f = [1, 0, 2, 0][Math.floor(p.anim / 6) % 4];
    else if (p.pose === 'work') f = Math.floor(p.anim) % 2 ? 3 : 0;
    else if (p.pose === 'carry') f = 4 + (Math.floor(p.anim) % 2);
    else if (p.pose === 'swim') f = Math.floor(p.anim / 8) % 2 ? 1 : 2;
    const img = frames[f];

    if (p.building && p.building.cut < 0.05 && p.mode === 'normal') return;
    if (p.building && p.building.cut < 0.99 && p.mode === 'normal') ctx.globalAlpha = p.building.cut;

    if (p.mode === 'carried' || p.mode === 'air' || p.mode === 'hop') {
      const z = Math.round(p.z);
      const shrink = IS.clamp(1 - z / 120, 0.4, 1);
      ctx.fillStyle = 'rgba(40, 20, 90, 0.32)';
      ctx.beginPath(); ctx.ellipse(sx, sy, 8 * shrink, 3.5 * shrink, 0, 0, Math.PI * 2); ctx.fill();
      if (p.mode === 'carried') {
        const gr = ctx.createRadialGradient(sx, sy - z - 14, 2, sx, sy - z - 14, 28);
        gr.addColorStop(0, 'rgba(255, 236, 170, 0.45)'); gr.addColorStop(1, 'rgba(255, 236, 170, 0)');
        ctx.fillStyle = gr; ctx.fillRect(sx - 32, sy - z - 46, 64, 64);
      }
      ctx.save();
      ctx.translate(sx, sy - z - 22);
      ctx.rotate(p.swing);
      ctx.drawImage(img, -11, -12);
      ctx.restore();
      if (p.mode === 'carried' && Math.random() < 0.35) { ctx.fillStyle = '#fff6c8'; ctx.fillRect(sx + IS.randi(-14, 14), sy - z - IS.randi(10, 40), 1, 1); }
      ctx.globalAlpha = 1;
      IS.Gods.drawOnPerson(this, ctx, p, sx, sy - z, t);
      return;
    }
    if (p.pose === 'sleep') {
      const I = IS.Iso;
      const tx = Math.floor(p.x / IS.TILE), ty = Math.floor((p.y - 6) / IS.TILE);
      const head = I.up(I.g2s(tx + 0.5, ty + 0.35), 9);
      ctx.drawImage(img, 0, 0, 22, 20, Math.round(head.x - ox) - 11, Math.round(head.y - oy) - 15, 22, 20);
      const col = IS.shade(p.cfg.look.shirt, -0.05);
      const L = (gx, gy) => { const q = I.up(I.g2s(gx, gy), 9); return { x: q.x - ox, y: q.y - oy }; };
      I.poly(ctx, [L(tx + 0.14, ty + 0.62), L(tx + 0.86, ty + 0.62), L(tx + 0.86, ty + 1.88), L(tx + 0.14, ty + 1.88)], col);
      I.poly(ctx, [L(tx + 0.14, ty + 0.62), L(tx + 0.86, ty + 0.62), L(tx + 0.86, ty + 0.75), L(tx + 0.14, ty + 0.75)], IS.shade(col, 0.3));
      ctx.globalAlpha = 1;
      return;
    }
    if (p.pose === 'swim') {
      ctx.drawImage(img, 0, 0, 22, 22, sx - 11, sy - 34 + 12, 22, 22);
      ctx.strokeStyle = 'rgba(232, 251, 255, 0.85)';
      ctx.beginPath(); ctx.ellipse(sx + 0.5, sy - 1.5, 11 + Math.sin(t * 4), 4, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
      return;
    }
    ctx.fillStyle = 'rgba(40, 20, 90, 0.28)';
    ctx.beginPath(); ctx.ellipse(sx, sy, 8, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    if (p.pose === 'sit') ctx.drawImage(img, 0, 0, 22, 30, sx - 11, sy - 34 + 4, 22, 30);
    else ctx.drawImage(img, sx - 11, sy - 34);
    const a = p.action;
    if (a && a.phase === 'do' && p.pose === 'sit' && a.def.id === 'read' && p.dir === 'down') {
      ctx.fillStyle = '#e8584a'; ctx.fillRect(sx - 4, sy - 13, 8, 5);
      ctx.fillStyle = '#fff4e6'; ctx.fillRect(sx - 3, sy - 13, 6, 1);
    }
    if (p.pose === 'fish' && !p.chat) this.drawRod(ctx, p, sx, sy, t);
    ctx.globalAlpha = 1;
    IS.Content.drawProp(this, ctx, p, sx, sy, t);
    IS.Gods.drawOnPerson(this, ctx, p, sx, sy, t);
  }

  drawRod(ctx, p, sx, sy, t) {
    const d = p.dir;
    const hand = { right: [6, -14], left: [-6, -14], down: [7, -12], up: [6, -18] }[d];
    const tipOff = { right: [14, -12], left: [-14, -12], down: [5, -14], up: [3, -16] }[d];
    const hx = sx + hand[0], hy = sy + hand[1];
    const tx = hx + tipOff[0], ty = hy + tipOff[1];
    const b = this.toScreen(p.bobberX(), p.bobberY());
    const bx = Math.round(b.x), by = Math.round(b.y + Math.sin(t * 3) * 1.2);
    this.pixLine(ctx, hx, hy, tx, ty, '#7a4a2c');
    ctx.strokeStyle = 'rgba(240, 240, 255, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(tx + 0.5, ty + 0.5);
    ctx.quadraticCurveTo((tx + bx) / 2, Math.max(ty, by) + 6, bx + 0.5, by + 0.5);
    ctx.stroke();
    ctx.fillStyle = '#ff4a5a'; ctx.fillRect(bx - 1, by - 2, 3, 2);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(bx - 1, by, 3, 1);
  }

  pixLine(ctx, x0, y0, x1, y1, col) {
    ctx.fillStyle = col;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let i = 0; i < 200; i++) {
      ctx.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  drawEmote(ctx, p, ox, oy, now) {
    const e = p.emoteData;
    if (!e || e.until < now) return;
    if (p.building && p.building.cut < 0.3 && p.mode === 'normal') return;
    const age = (now - e.t0) / 1000;
    const pop = age < 0.12 ? Math.round((0.12 - age) * 40) : 0;
    const drop = p.pose === 'sit' ? 4 : p.pose === 'sleep' ? 14 : p.pose === 'swim' ? 12 : 0;
    const s = this.toScreen(p.x, p.y, p.z);
    ctx.drawImage(IS.Sprites.emotes[e.icon] || IS.Sprites.emotes.exclaim, Math.round(s.x) - 7, Math.round(s.y) - 52 + drop + pop + Math.round(Math.sin(now / 200)));
  }

  drawDolphins(ctx, ox, oy, now) {
    const d = this.sim.events.dolphins;
    if (!d) return;
    for (let i = 0; i < 3; i++) {
      const cyc = ((now - d.t0) / 1000 / 2.4 + i * 0.33) % 1;
      const s = IS.Iso.g2s(d.tx + 0.5 + i * 1.2 - 1.2, d.ty + 0.5 + (i % 2) * 0.6);
      const baseX = s.x - ox, baseY = s.y - oy;
      if (cyc < 0.5) {
        const k = cyc / 0.5;
        const x = baseX - 14 + k * 28, y = baseY - Math.sin(k * Math.PI) * 14;
        const fr = k < 0.33 ? 0 : k < 0.66 ? 1 : 2;
        ctx.drawImage(IS.Sprites.dolphin[fr], Math.round(x - 11), Math.round(y - 8));
        if (k < 0.08 || k > 0.92) { ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x) - 3, Math.round(baseY) - 1, 6, 2); }
      } else {
        ctx.strokeStyle = 'rgba(232,251,255,0.6)';
        ctx.beginPath(); ctx.ellipse(Math.round(baseX + 14) + 0.5, Math.round(baseY) + 0.5, 4 + (cyc - 0.5) * 16, 2 + (cyc - 0.5) * 5, 0, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }

  drawGulls(ctx, ox, oy, rdt, t) {
    const sim = this.sim;
    const day = sim.clock.min > 6 * 60 && sim.clock.min < 19 * 60 && sim.weather !== 'storm' && sim.weather !== 'rain';
    if (day && this.gulls.length < 3 && Math.random() < rdt * 0.08) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      this.gulls.push({ x: dir > 0 ? ox - 30 : ox + this.vw + 30, y: oy + IS.rand(20, this.vh - 60), vx: dir * IS.rand(30, 50), vy: IS.rand(-6, 6), ph: Math.random() * 6 });
    }
    for (const g of this.gulls) {
      g.x += g.vx * rdt; g.y += g.vy * rdt;
      const fr = Math.floor(t * 5 + g.ph) % 2;
      ctx.fillStyle = 'rgba(40, 20, 90, 0.2)';
      ctx.fillRect(Math.round(g.x - ox) - 4, Math.round(g.y - oy) + 40, 9, 2);
      const spr = IS.Sprites.gull[fr];
      ctx.save();
      if (g.vx < 0) { ctx.translate(Math.round(g.x - ox), 0); ctx.scale(-1, 1); ctx.drawImage(spr, -7, Math.round(g.y - oy) - 4); }
      else ctx.drawImage(spr, Math.round(g.x - ox) - 7, Math.round(g.y - oy) - 4);
      ctx.restore();
    }
    this.gulls = this.gulls.filter(g => g.x > ox - 80 && g.x < ox + this.vw + 80);
  }

  // ---------------------------------------------------------------- shadows
  sun() {
    const min = this.sim.clock.min;
    const t = (min - 360) / 720;
    if (t <= 0 || t >= 1) return null;
    const edge = Math.abs(t - 0.5) * 2;
    let a = Math.min(1, t / 0.08, (1 - t) / 0.1);
    a *= { sunny: 1, cloudy: 0.45, fog: 0.3, rain: 0.2, storm: 0.1 }[this.sim.weather];
    return { k: IS.lerp(-1.2, 1.2, t) + 0.7, len: 0.3 + edge * 0.4, a };
  }
  silhouette(img) {
    let s = this.silCache.get(img);
    if (!s) {
      const { c, g } = IS.makeCanvas(img.width, img.height, false);
      g.drawImage(img, 0, 0);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = '#3a2690'; g.fillRect(0, 0, img.width, img.height); // already in the shadow colour
      this.silCache.set(img, c);
      s = c;
    }
    return s;
  }
  drawCastShadows(ctx, ox, oy, inView) {
    const sun = this.sun();
    if (!sun || sun.a < 0.02) return;
    const sim = this.sim;
    let G = ctx;
    const cast = (img, ax, ay, x, y, scale = 1) => {
      G.setTransform(1, 0, -sun.k * sun.len * scale, -sun.len * scale, Math.round(x - ox), Math.round(y - oy));
      G.drawImage(this.silhouette(img), -ax, -ay);
    };
    // Trees, rocks and buildings stand still: their shadows are redrawn only when the camera or the sun moves
    const key = [ox, oy, this.vw, this.vh, Math.round(sun.k * 100), Math.round(sun.len * 100), sim.world.objects.length, sim.world.buildings.map(b => (b.cut > 0.5 ? 1 : 0)).join('')].join();
    if (key !== this.shadowKey) {
      this.shadowKey = key;
      G = this.shadowStatic.g;
      G.setTransform(1, 0, 0, 1, 0, 0);
      G.clearRect(0, 0, this.vw, this.vh);
      for (const o of sim.world.objects) {
        if (o.kind === 'log' || o.kind === 'bench' || o.kind === 'flowers' || o.kind === 'lounger' || !inView(o.s.x, o.s.y, 140)) continue;
        cast(o.sprite, o.ax, o.ay, o.s.x, o.s.y, o.kind === 'tree' || o.kind === 'bigoak' ? 0.85 : 1);
      }
      for (const b of sim.world.buildings) {
        if (b.cut > 0.5) continue;
        const base = IS.Iso.g2s(b.x0 + b.w, b.y0 + b.h);
        cast(b.iso.canvas, base.x - b.iso.ox, base.y - b.iso.oy, base.x, base.y, 0.5);
      }
      G.setTransform(1, 0, 0, 1, 0, 0);
      G = ctx;
    }
    ctx.globalAlpha = 0.3 * sun.a;
    ctx.drawImage(this.shadowStatic.c, 0, 0);
    for (const p of sim.people) {
      if (p.mode !== 'normal' || p.building || p.pose === 'swim' || p.pose === 'sleep') continue;
      const s = IS.Iso.w2s(p.x, p.y);
      const f = p.frames[p.dir][p.pose === 'walk' ? [1, 0, 2, 0][Math.floor(p.anim / 6) % 4] : 0];
      cast(f, 11, 34, s.x, s.y);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- lighting
  collectLights(amb, t) {
    const sim = this.sim, w = sim.world, I = IS.Iso, dark = amb.dark;
    const lights = [];
    const min = sim.clock.min;
    const evening = min >= 16.5 * 60 || min < 7.5 * 60;
    const lateNight = min >= 22.5 * 60 || min < 5 * 60;
    for (const l of w.lamps) { const s = I.w2s(l.x, l.y); lights.push({ x: s.x, y: s.y - 30, gy: s.y, r: 60, s: 0.9 * dark, warm: 0.4 }); }
    for (const st of w.stringLights || []) this.stringPoints(st).forEach((p, i) => { if (i % 3 === 1) lights.push({ x: p.x, y: p.y + 14, r: 22, s: 0.35 * dark, warm: 0.12 }); });
    for (const bld of w.buildings) {
      bld.lit = false;
      const awake = sim.people.some(p => p.building === bld && p.pose !== 'sleep');
      const hallEv = bld.kind === 'hall' && sim.events.list.some(e => e.state === 'active' && e.seat === 'hallSeat');
      const lit = evening && (awake || hallEv || !lateNight || (bld.kind === 'deco' && min < 23 * 60));
      if (bld.cut > 0.3 && bld.iso.interior) {
        for (const [c, r] of this.pendantSpots(bld)) { const s = I.g2s(bld.x0 + c, bld.y0 + r); lights.push({ x: s.x, y: s.y - 10, r: 66, s: 0.8 * dark * bld.cut, warm: 0.45 }); }
      }
      if (!lit) continue;
      bld.lit = true;
      bld.iso.windows.forEach((win, wi) => {
        const cx = (win.pts[0].x + win.pts[2].x) / 2, cy = (win.pts[0].y + win.pts[2].y) / 2;
        // every window glows; only some cast light, so big buildings don't blow out
        const casts = wi % 2 === 0;
        lights.push({ x: cx + (win.face === 's' ? -6 : 6), y: cy + 16, r: casts ? 34 : 0, s: casts ? 0.6 * dark * (1 - bld.cut) : 0, warm: casts ? 0.22 : 0, win, cut: bld.cut });
      });
      for (const lt of bld.iso.lanterns || []) lights.push({ x: lt.x, y: lt.y + 4, r: 34, s: 0.8 * dark, warm: 0.4, lantern: lt });
    }
    if (w.bonfire.lit) {
      const fl = 1 + Math.sin(t * 13) * 0.06 + Math.sin(t * 7.3) * 0.05;
      const s = I.g2s(w.bonfire.x + 0.5, w.bonfire.y + 0.5);
      lights.push({ x: s.x, y: s.y - 6, r: 110 * fl, s: dark, warm: 0.75 });
    }
    { const s = I.w2s(w.lighthouseLight.x, w.lighthouseLight.y); lights.push({ x: s.x, y: s.y - w.lighthouseLight.h, r: 50, s: dark, warm: 0.5, lighthouse: true }); }
    if (sim.weather !== 'rain' && sim.weather !== 'storm') {
      for (const ff of this.fireflies) {
        const s = I.w2s(ff.x + Math.sin(t * 0.7 + ff.ph) * 14, ff.y + Math.cos(t * 0.5 + ff.ph * 2) * 10);
        if (Math.sin(t * 2 + ff.ph * 3) > 0.2) lights.push({ x: s.x, y: s.y - 10 - Math.sin(t + ff.ph) * 4, r: 10, s: dark * 0.8, warm: 0, ff: true });
      }
    }
    return lights;
  }

  drawLighting(ctx, amb, ox, oy, t) {
    const vw = this.vw, vh = this.vh, L = this.light.g, dark = amb.dark;
    if (amb.k < 0.01) return;
    const lights = this.collectLights(amb, t);
    const vis = l => { const x = l.x - ox, y = l.y - oy; return !(x < -l.r || y < -l.r || x > vw + l.r || y > vh + l.r); };

    // Darkness as a multiply layer with soft holes where light falls
    L.globalCompositeOperation = 'source-over';
    L.fillStyle = `rgb(${amb.mult[0]},${amb.mult[1]},${amb.mult[2]})`;
    L.fillRect(0, 0, vw, vh);
    if (dark > 0) {
      L.globalCompositeOperation = 'destination-out';
      for (const l of lights) {
        if (!vis(l) || !l.r) continue;
        const x = l.x - ox, y = (l.gy !== undefined ? l.gy : l.y) - oy;
        // Light lying on the ground is a flattened ellipse, the way a floor reads in isometric view
        const flat = l.gy !== undefined || l.win;
        L.setTransform(1, 0, 0, flat ? 0.55 : 1, x, y);
        const gr = L.createRadialGradient(0, 0, 0, 0, 0, l.r * (flat ? 1.25 : 1));
        gr.addColorStop(0, `rgba(0,0,0,${l.s})`);
        gr.addColorStop(0.45, `rgba(0,0,0,${l.s * 0.6})`);
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        L.fillStyle = gr;
        L.fillRect(-l.r * 1.25, -l.r * 1.25, l.r * 2.5, l.r * 2.5);
        L.setTransform(1, 0, 0, 1, 0, 0);
      }
      const lh = lights.find(l => l.lighthouse);
      if (lh) {
        L.save();
        L.translate(lh.x - ox, lh.y - oy); L.rotate(t * 0.6);
        const bg = L.createLinearGradient(0, 0, 460, 0);
        bg.addColorStop(0, `rgba(0,0,0,${0.75 * dark})`); bg.addColorStop(1, 'rgba(0,0,0,0)');
        L.fillStyle = bg;
        L.beginPath(); L.moveTo(0, 0); L.lineTo(460, -44); L.lineTo(460, 44); L.closePath(); L.fill();
        L.restore();
      }
      L.globalCompositeOperation = 'source-over';
    }
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(this.light.c, 0, 0);
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = `rgba(${amb.tint[0] * 0.45 | 0}, ${amb.tint[1] * 0.35 | 0}, ${amb.tint[2] * 0.6 | 0}, ${0.16 * dark})`;
    ctx.fillRect(0, 0, vw, vh);
    ctx.globalCompositeOperation = 'source-over';

    // Glowing windows: cream panes from late afternoon on (the pane layer built in the depth pass)
    const winA = IS.clamp(0.3 + dark * 1.2, 0, 1);
    if (this.winUsed) { ctx.globalAlpha = winA; ctx.drawImage(this.winMask.c, 0, 0); ctx.globalAlpha = 1; }
    for (const l of lights) {
      if (l.lantern) {
        ctx.globalAlpha = winA;
        ctx.fillStyle = '#ffe9a8'; ctx.fillRect(Math.round(l.lantern.x - ox) - 1, Math.round(l.lantern.y - oy) - 2, 3, 5);
      }
    }
    ctx.globalAlpha = 1;
    // Halos and spill: light bleeding past window frames, down the wall and onto the ground
    if (dark > 0.05) {
      const H = this.halo || (this.halo = this.makeHalo());
      const glow = (x, y, w, h, a) => { if (a > 0.01) { ctx.globalAlpha = Math.min(1, a); ctx.drawImage(H, Math.round(x - w / 2), Math.round(y - h / 2), Math.round(w), Math.round(h)); } };
      ctx.globalCompositeOperation = 'lighter';
      for (const l of lights) {
        if (l.win) {
          if ((l.cut || 0) > 0.6 || !vis({ x: l.x, y: l.y, r: 40 })) continue;
          const p = l.win.pts, cx = (p[0].x + p[2].x) / 2 - ox, cy = (p[0].y + p[2].y) / 2 - oy, k = dark * (1 - (l.cut || 0));
          glow(cx, cy, 30, 30, 0.32 * k); // halo around the pane
          glow(cx, cy + 22, 26, 44, 0.16 * k); // spill down the wall to the ground
          if (l.win.h !== undefined) { // the window's shape thrown onto the ground in front of the wall
            const a = { x: p[0].x - ox, y: p[0].y - oy + l.win.h }, b = { x: p[1].x - ox, y: p[1].y - oy + l.win.h };
            const n = l.win.face === 's' ? { x: -20, y: 10 } : { x: 20, y: 10 };
            ctx.globalAlpha = Math.min(1, 0.22 * k);
            ctx.setTransform(b.x - a.x, b.y - a.y, n.x, n.y, a.x, a.y);
            ctx.drawImage(this.beam || (this.beam = this.makeBeam()), 0, 0, 1, 1);
            ctx.setTransform(1, 0, 0, 1, 0, 0);
          }
        } else if (l.lantern) glow(l.lantern.x - ox, l.lantern.y - oy, 26, 26, 0.4 * dark);
      }
      for (const l of this.sim.world.lamps) {
        const s = IS.Iso.w2s(l.x, l.y), x = s.x - ox, y = s.y - oy;
        if (x < -60 || y < -60 || x > vw + 60 || y > vh + 60) continue;
        glow(x + 0.5, y - 30, 36, 36, 0.3 * dark); // around the lamp head
        glow(x, y, 64, 30, 0.12 * dark); // the pool it throws on the ground
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    if (dark <= 0) return;
    for (const l of this.sim.world.lamps) {
      const s = IS.Iso.w2s(l.x, l.y);
      ctx.fillStyle = `rgba(255, 244, 200, ${dark})`;
      ctx.fillRect(Math.round(s.x - ox) - 2, Math.round(s.y - oy) - 32, 5, 5);
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      if (!vis(l) || !l.r) continue;
      const x = l.x - ox, y = l.y - oy;
      if (l.ff) { ctx.fillStyle = `rgba(230, 255, 150, ${dark})`; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); continue; }
      if (!l.warm) continue;
      const gr = ctx.createRadialGradient(x, y, 0, x, y, l.r * 0.8);
      gr.addColorStop(0, `rgba(255, 150, 60, ${l.warm * 0.32 * l.s})`);
      gr.addColorStop(1, 'rgba(255, 150, 60, 0)');
      ctx.fillStyle = gr;
      ctx.fillRect(x - l.r, y - l.r, l.r * 2, l.r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // One soft warm glow sprite, stretched and faded for every halo
  makeHalo() {
    const { c, g } = IS.makeCanvas(64, 64, false);
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255, 214, 150, 1)');
    gr.addColorStop(0.3, 'rgba(255, 180, 100, 0.55)');
    gr.addColorStop(0.65, 'rgba(255, 150, 80, 0.16)');
    gr.addColorStop(1, 'rgba(255, 140, 70, 0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return c;
  }

  // Sun shafts: soft slanted beams along the sun's direction, strongest at golden hour, drifting slowly.
  // They sit under the bloom, which softens them further.
  drawRays(ctx, ox, oy, t) {
    const sun = this.sun();
    if (!sun || sun.a < 0.05) return;
    const min = this.sim.clock.min, noon = 1 - Math.min(1, Math.abs(min - 13 * 60) / 330); // 1 at midday, 0 at golden hour
    const strength = sun.a * (0.45 + 0.55 * (1 - noon));
    const R = this.rayTex || (this.rayTex = this.makeRay());
    const ang = IS.clamp(-sun.k * 0.35, -0.6, 0.6); // lean with the sun, like the shadows
    const span = this.vw + this.vh;
    ctx.globalCompositeOperation = 'screen';
    // A few huge, faint shafts behind the small ones, drifting slower, so the light has depth
    for (let i = 0; i < 3; i++) {
      const wid = 260 + i * 90, x = ((i * 523 + 140 - ox * 0.2 + Math.sin(t * 0.03 + i * 2.4) * 50) % span + span) % span - this.vh * 0.3;
      ctx.globalAlpha = strength * (0.11 + 0.05 * Math.sin(t * 0.11 + i * 1.3));
      ctx.setTransform(Math.cos(ang), Math.sin(ang), -Math.sin(ang), Math.cos(ang), x, -40);
      ctx.drawImage(R, -wid / 2, 0, wid, this.vh * 1.6);
    }
    for (let i = 0; i < 7; i++) {
      const wid = 70 + ((i * 53) % 110), drift = Math.sin(t * 0.07 + i * 1.7) * 30;
      const x = ((i * 337 - ox * 0.35 + drift) % span + span) % span - this.vh * 0.3;
      ctx.globalAlpha = strength * (0.24 + 0.1 * Math.sin(t * 0.23 + i * 2.1));
      ctx.setTransform(Math.cos(ang), Math.sin(ang), -Math.sin(ang), Math.cos(ang), x, -20);
      ctx.drawImage(R, -wid / 2, 0, wid, this.vh * 1.4);
      // Dust specks drifting down through the shaft, twinkling as they turn in the light
      ctx.fillStyle = '#fff6dc';
      ctx.globalCompositeOperation = 'source-over';
      const a0 = ctx.globalAlpha * 4;
      for (let k = 0; k < 14; k++) {
        const r = Math.sin(i * 91.7 + k * 37.3) * 0.5 + 0.5, r2 = Math.sin(i * 13.1 + k * 71.9) * 0.5 + 0.5;
        const len = this.vh * 1.4, y = (r * len + t * (4 + r2 * 6)) % len;
        const dx = (r2 - 0.5) * wid * 0.6 + Math.sin(t * 0.6 + k) * 4;
        const tw = Math.sin(t * (1.5 + r2 * 2) + k * 2.3);
        if (tw < 0) continue;
        ctx.globalAlpha = Math.min(1, a0 * tw * (1 - y / len));
        ctx.fillRect(Math.round(dx), Math.round(y), 1, 1);
      }
      ctx.globalCompositeOperation = 'screen';
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  // Floating life in the air: pollen catching the light by day, gold at sunset, fireflies over land at night.
  // Each 256px block of the world holds the same few motes, so they stay put as the camera moves.
  drawMotes(ctx, ox, oy, t, amb) {
    const w = this.sim.weather;
    if (w === 'rain' || w === 'storm') return;
    const night = IS.clamp((amb.dark - 0.35) / 0.3, 0, 1), day = 1 - night, Z = 256;
    const F = this.fly || (this.fly = this.makeFly());
    const gold = this.sim.clock.min > 960 && night < 1;
    for (let by = Math.floor(oy / Z) * Z; by < oy + this.vh; by += Z) for (let bx = Math.floor(ox / Z) * Z; bx < ox + this.vw; bx += Z) {
      const seed = (bx / Z) * 7919 + (by / Z) * 104729;
      for (let k = 0; k < 10; k++) {
        const r = (n) => { const v = Math.sin(seed + k * 12.9898 + n * 78.233) * 43758.5453; return v - Math.floor(v); };
        const ph = r(3) * 6.28;
        let x = bx + ((r(1) * Z + t * (3 + r(4) * 4)) % Z) + Math.sin(t * 0.4 + ph) * 8, y = by + ((r(2) * Z + Math.sin(t * 0.25 + ph) * 14) % Z);
        if (day > 0 && k < 7) {
          const tw = Math.sin(t * (0.8 + r(5)) + ph);
          if (tw > 0) {
            ctx.globalAlpha = day * tw * (gold ? 0.75 : 0.5);
            ctx.fillStyle = gold ? '#ffd58a' : '#fffbe6';
            ctx.fillRect(Math.round(x - ox), Math.round(y - oy - t * 2 % 4), 1, 1);
          }
        }
        if (night > 0 && k >= 3) {
          x += Math.sin(t * 0.7 + ph * 2) * 10; y += Math.cos(t * 0.5 + ph) * 6;
          const g = IS.Iso.s2g(x, y);
          if (this.sim.world.isWater(Math.floor(g.gx), Math.floor(g.gy))) continue;
          const blink = Math.pow(Math.max(0, Math.sin(t * (0.6 + r(6) * 0.5) + ph)), 3);
          if (blink < 0.02) continue;
          ctx.globalAlpha = night * blink;
          ctx.globalCompositeOperation = 'lighter';
          ctx.drawImage(F, Math.round(x - ox) - 4, Math.round(y - oy) - 4);
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = '#f6ffc8'; ctx.fillRect(Math.round(x - ox), Math.round(y - oy), 1, 1);
        }
      }
    }
    ctx.globalAlpha = 1;
  }
  // Shadows of passing clouds sliding over the island by day: more of them when it's cloudy
  drawClouds(ctx, ox, oy, t, amb) {
    const sun = this.sun(), w = this.sim.weather;
    if (!sun || w === 'rain' || w === 'storm' || w === 'fog') return;
    const C = this.cloud || (this.cloud = this.makeCloud());
    const Z = 1000, cover = w === 'cloudy' ? 0.5 : 0.32;
    ctx.globalCompositeOperation = 'multiply';
    for (let by = Math.floor((oy - 200) / Z) * Z; by < oy + this.vh + 200; by += Z) for (let bx = Math.floor((ox - 600) / Z) * Z; bx < ox + this.vw + 300; bx += Z) {
      for (let k = 0; k < 3; k++) {
        const r = n => { const v = Math.sin(bx * 0.013 + by * 0.029 + k * 17.1 + n * 3.7) * 43758.5; return v - Math.floor(v); };
        const sc = 1.6 + r(3) * 1.6, x = bx + ((r(1) * Z + t * 9) % Z), y = by + r(2) * Z + Math.sin(t * 0.05 + k) * 20;
        ctx.globalAlpha = cover * Math.min(1, sun.a * 1.5) * (0.7 + r(4) * 0.5);
        ctx.drawImage(C, Math.round(x - ox - C.width * sc / 2), Math.round(y - oy - C.height * sc / 2), C.width * sc, C.height * sc);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  makeCloud() {
    const { c, g } = IS.makeCanvas(320, 160, false);
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 320, 160);
    for (let i = 0; i < 9; i++) {
      const x = 70 + Math.random() * 180, y = 55 + Math.random() * 50, r = 35 + Math.random() * 40;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(70, 62, 140, 0.8)'); gr.addColorStop(1, 'rgba(70, 62, 140, 0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    return c;
  }
  // Sun (or moon) catching the water: short twinkling streaks on the sea and lakes
  drawGlints(ctx, ox, oy, t, amb) {
    const sun = this.sun(), w = this.sim.world, Z = 128;
    const day = sun ? sun.a : 0, moon = this.sim.weather === 'sunny' ? amb.dark * 0.6 : 0;
    if (day < 0.1 && moon < 0.1) return;
    ctx.fillStyle = day > 0.1 ? '#fffbe8' : '#d8e4ff';
    for (let by = Math.floor(oy / Z) * Z; by < oy + this.vh; by += Z) for (let bx = Math.floor(ox / Z) * Z; bx < ox + this.vw; bx += Z) {
      for (let k = 0; k < 14; k++) {
        const r = n => { const v = Math.sin(bx * 0.071 + by * 0.113 + k * 9.73 + n * 1.91) * 43758.5; return v - Math.floor(v); };
        const tw = Math.sin(t * (1.2 + r(3) * 1.6) + r(4) * 6.28);
        if (tw < 0.55) continue;
        const x = bx + r(1) * Z, y = by + r(2) * Z, g = IS.Iso.s2g(x, y);
        const tx = Math.floor(g.gx), ty = Math.floor(g.gy);
        if (!w.isWater(tx, ty) || !w.isWater(tx + 1, ty) || !w.isWater(tx, ty + 1)) continue;
        ctx.globalAlpha = Math.max(day, moon) * (tw - 0.55) * 2.2;
        const len = 1 + Math.round((tw - 0.55) * 8);
        ctx.fillRect(Math.round(x - ox - len / 2), Math.round(y - oy), len, 1);
      }
    }
    ctx.globalAlpha = 1;
  }
  makeFly() {
    const { c, g } = IS.makeCanvas(9, 9, false);
    const gr = g.createRadialGradient(4.5, 4.5, 0, 4.5, 4.5, 4.5);
    gr.addColorStop(0, 'rgba(210, 255, 120, 0.9)'); gr.addColorStop(0.4, 'rgba(170, 240, 90, 0.35)'); gr.addColorStop(1, 'rgba(150, 220, 80, 0)');
    g.fillStyle = gr; g.fillRect(0, 0, 9, 9);
    return c;
  }
  makeRay() {
    const { c, g } = IS.makeCanvas(32, 128, false);
    const across = g.createLinearGradient(0, 0, 32, 0);
    across.addColorStop(0, 'rgba(255, 236, 190, 0)'); across.addColorStop(0.5, 'rgba(255, 236, 190, 1)'); across.addColorStop(1, 'rgba(255, 236, 190, 0)');
    g.fillStyle = across; g.fillRect(0, 0, 32, 128);
    g.globalCompositeOperation = 'destination-in';
    const along = g.createLinearGradient(0, 0, 0, 128);
    along.addColorStop(0, 'rgba(0,0,0,1)'); along.addColorStop(0.7, 'rgba(0,0,0,0.5)'); along.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = along; g.fillRect(0, 0, 32, 128);
    return c;
  }

  // Warm light fading away from its source, stretched onto the ground under each lit window
  makeBeam() {
    const { c, g } = IS.makeCanvas(16, 32, false);
    const gr = g.createLinearGradient(0, 0, 0, 32);
    gr.addColorStop(0, 'rgba(255, 200, 120, 0.9)');
    gr.addColorStop(0.5, 'rgba(255, 170, 90, 0.35)');
    gr.addColorStop(1, 'rgba(255, 150, 80, 0)');
    g.fillStyle = gr; g.fillRect(0, 0, 16, 32);
    return c;
  }

  // Bloom: everything bright on screen glows. The frame is shrunk, everything
  // below a brightness threshold is dropped, and the rest is blurred back on top.
  // The threshold is a canvas filter so it stays on the GPU: reading pixels back
  // every frame makes Chrome move the game canvas off the GPU after a while,
  // and then drawing the big island ground drops the game to a few fps.
  drawBloom(ctx, amb) {
    const A = this.bloomA, B = this.bloomB, C = this.bloomC, S = this.bloomS;
    if (typeof A.g.filter !== 'string') return; // no canvas filters (older Safari): no glow
    const aw = A.c.width, ah = A.c.height;
    // brightness(b) then contrast(c) maps thr -> 0 and 1 -> 1. A low threshold makes it ambient:
    // most lit surfaces glow a little and bright ones a lot, like light bouncing around the scene.
    const thr = IS.lerp(0.5, 0.42, amb.dark), c = (1 + thr) / (1 - thr), b = 0.5 + 0.5 / c;
    // The glow barely changes between frames: rebuild it every third frame and reuse it in between
    const fresh = (this.bloomN = (this.bloomN || 0) + 1) % 3 === 1;
    if (fresh) {
      A.g.imageSmoothingEnabled = true;
      A.g.clearRect(0, 0, aw, ah);
      A.g.filter = `brightness(${b}) contrast(${c}) sepia(0.15)`;
      A.g.drawImage(this.canvas, 0, 0, aw, ah);
      A.g.filter = 'none';
      B.g.imageSmoothingEnabled = true;
      B.g.clearRect(0, 0, B.c.width, B.c.height);
      B.g.filter = 'blur(1px)';
      B.g.drawImage(A.c, 0, 0, B.c.width, B.c.height);
      B.g.filter = 'none';
      // a very wide haze, tinted with the hour (gold at sunset, violet at night)
      C.g.imageSmoothingEnabled = true;
      C.g.filter = 'blur(1px)';
      C.g.drawImage(B.c, 0, 0, C.c.width, C.c.height);
      C.g.filter = 'none';
      C.g.globalCompositeOperation = 'multiply';
      C.g.fillStyle = `rgb(${amb.tint.map(v => Math.round(IS.lerp(v, 255, 0.35))).join(',')})`;
      C.g.fillRect(0, 0, C.c.width, C.c.height);
      C.g.globalCompositeOperation = 'source-over';
      // squeezed sideways only: bright points smear into soft horizontal flares
      if (amb.dark > 0.2) { S.g.imageSmoothingEnabled = true; S.g.drawImage(A.c, 0, 0, S.c.width, S.c.height); }
      // both go into the small glow layer, so the screen still takes just two full-size draws
      B.g.globalCompositeOperation = 'screen';
      B.g.globalAlpha = 0.6; B.g.drawImage(C.c, 0, 0, B.c.width, B.c.height);
      if (amb.dark > 0.2) { B.g.globalAlpha = 0.7 * (amb.dark - 0.2); B.g.drawImage(S.c, 0, 0, B.c.width, B.c.height); }
      B.g.globalAlpha = 1; B.g.globalCompositeOperation = 'source-over';
    }
    // 'screen' brightens without blowing out to white: a wide soft haze plus a tighter glow
    ctx.imageSmoothingEnabled = true;
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.5 + 0.2 * amb.dark;
    ctx.drawImage(B.c, 0, 0, this.vw, this.vh);
    ctx.globalAlpha = 0.3 + 0.1 * amb.dark;
    ctx.drawImage(A.c, 0, 0, this.vw, this.vh);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = false;
  }

  drawWeather(ctx, rdt, t) {
    const sim = this.sim, vw = this.vw, vh = this.vh;
    const w = sim.weather;
    const target = w === 'rain' ? 160 : w === 'storm' ? 300 : 0;
    while (this.rain.length < target) this.rain.push({ x: Math.random() * (vw + 60), y: Math.random() * vh, s: IS.rand(220, 320), l: IS.randi(4, 8) });
    if (this.rain.length > target) this.rain.length = target;
    if (target) {
      const slant = w === 'storm' ? 0.35 : 0.15;
      ctx.strokeStyle = w === 'storm' ? 'rgba(200, 210, 250, 0.55)' : 'rgba(190, 205, 250, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const d of this.rain) {
        d.y += d.s * rdt; d.x -= d.s * slant * rdt;
        if (d.y > vh) { d.y = -10; d.x = Math.random() * (vw + 60); }
        if (d.x < -10) d.x = vw + 10;
        ctx.moveTo(Math.round(d.x) + 0.5, Math.round(d.y));
        ctx.lineTo(Math.round(d.x + d.l * slant) + 0.5, Math.round(d.y - d.l));
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(220, 235, 255, 0.5)';
      for (let i = 0; i < (w === 'storm' ? 10 : 5); i++) ctx.fillRect(Math.random() * vw | 0, Math.random() * vh | 0, 2, 1);
    }
    if (w === 'storm') {
      this.nextFlash -= rdt;
      if (this.nextFlash <= 0) { this.flash = 1; this.nextFlash = IS.rand(4, 11); }
    }
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(235, 240, 255, ${this.flash * 0.55})`;
      ctx.fillRect(0, 0, vw, vh);
      this.flash = Math.max(0, this.flash - rdt * 2.5);
    }
    if (w === 'fog') {
      const off = (t * 8) % 256;
      ctx.globalAlpha = 0.55;
      for (let y = -256; y < vh + 256; y += 256) for (let x = -256; x < vw + 256; x += 256) ctx.drawImage(this.fog, Math.round(x + off - (this.ox % 256)), Math.round(y - (this.oy % 256)));
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(232, 232, 250, 0.16)';
      ctx.fillRect(0, 0, vw, vh);
    }
  }

  drawStars(ctx, now) {
    const ev = this.sim.events;
    ev.stars = ev.stars.filter(s => now - s.t0 < 1400);
    for (const s of ev.stars) {
      const k = (now - s.t0) / 1400;
      const x = s.x * this.vw + k * 160, y = s.y * this.vh + k * 60;
      const gr = ctx.createLinearGradient(x - 50, y - 19, x, y);
      gr.addColorStop(0, 'rgba(255,255,255,0)');
      gr.addColorStop(1, `rgba(255,255,230,${1 - k})`);
      ctx.strokeStyle = gr; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x - 50, y - 19); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${1 - k})`;
      ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
    }
  }
};
