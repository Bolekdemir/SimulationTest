// Particles
IS.FX = class {
  constructor() { this.p = []; }
  add(o) { if (this.p.length < 600) this.p.push(Object.assign({ life: 0, g: 0, size: 1, alpha: 1 }, o)); }
  splash(x, y, n = 10) {
    for (let i = 0; i < n; i++) this.add({ x, y, vx: IS.rand(-40, 40), vy: IS.rand(-110, -40), g: 300, max: IS.rand(0.4, 0.8), color: Math.random() < 0.5 ? '#ffffff' : '#bfe8f2', size: 2 });
    this.ripple(x, y + 2);
  }
  ripple(x, y) { this.add({ x, y, kind: 'ring', max: 1.1, color: '#e8fbff' }); }
  drip(x, y) { this.add({ x, y, vx: 0, vy: 10, g: 200, max: 0.35, color: '#7ec6e8', size: 1 }); }
  dust(x, y) { for (let i = 0; i < 8; i++) this.add({ x: x + IS.rand(-6, 6), y: y - 2, vx: IS.rand(-30, 30), vy: IS.rand(-30, -5), g: 30, max: IS.rand(0.4, 0.7), color: '#d9c8a8', size: 3, fade: true }); }
  chips(x, y) { this.add({ x: x + IS.rand(-4, 4), y, vx: IS.rand(-50, 50), vy: IS.rand(-90, -40), g: 320, max: 0.6, color: Math.random() < 0.5 ? '#c49a63' : '#8a5a34', size: 2 }); }
  smoke(x, y) { this.add({ x: x + IS.rand(-2, 2), y, vx: IS.rand(4, 10), vy: IS.rand(-14, -8), g: 0, max: IS.rand(2.2, 3.2), color: '#e8e4ee', size: 4, fade: true, grow: true }); }
  spark(x, y) { this.add({ x: x + IS.rand(-5, 5), y, vx: IS.rand(-8, 8), vy: IS.rand(-45, -25), g: 0, max: IS.rand(0.6, 1.2), color: Math.random() < 0.5 ? '#ffd56a' : '#ff8a3a', size: 1, fade: true }); }
  update(rdt) {
    for (const q of this.p) {
      q.life += rdt;
      if (q.kind === 'ring') continue;
      q.vy += q.g * rdt;
      q.x += q.vx * rdt; q.y += q.vy * rdt;
    }
    this.p = this.p.filter(q => q.life < q.max);
  }
  draw(ctx, ox, oy) {
    for (const q of this.p) {
      const t = q.life / q.max;
      if (q.kind === 'ring') {
        ctx.globalAlpha = 0.7 * (1 - t);
        ctx.strokeStyle = q.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(Math.round(q.x - ox) + 0.5, Math.round(q.y - oy) + 0.5, 3 + t * 10, 1.5 + t * 4, 0, 0, Math.PI * 2);
        ctx.stroke();
        continue;
      }
      ctx.globalAlpha = q.fade ? 0.85 * (1 - t) : 1;
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
    this.wave = this.makeWaveTexture();
    this.fog = this.makeFogTexture();
    this.cloud = this.makeCloud();
    this.rain = [];
    this.flash = 0;
    this.nextFlash = 3;
    this.gulls = [];
    this.clouds = Array.from({ length: 5 }, () => ({ x: Math.random() * sim.world.pxW, y: Math.random() * sim.world.pxH, s: IS.rand(0.8, 1.5) }));
    this.fireflies = Array.from({ length: 40 }, () => {
      const t = IS.pick(sim.world.spots.forage || [{ x: 30, y: 12 }]);
      return { x: t.x * IS.TILE + IS.rand(0, 24), y: t.y * IS.TILE + IS.rand(-20, 10), ph: Math.random() * 10 };
    });
    this.resize();
  }

  resize() {
    const wrap = this.canvas.parentElement;
    const cw = wrap.clientWidth, ch = wrap.clientHeight;
    const z = this.sim.cam.zoom;
    const vw = Math.ceil(cw / z), vh = Math.ceil(ch / z);
    this.canvas.width = vw; this.canvas.height = vh;
    this.canvas.style.width = vw * z + 'px';
    this.canvas.style.height = vh * z + 'px';
    this.light.c.width = vw; this.light.c.height = vh;
    this.ctx.imageSmoothingEnabled = false;
    this.vw = vw; this.vh = vh;
    this.waveA = this.ctx.createPattern(this.wave, 'repeat');
  }

  makeWaveTexture() {
    const { c, g } = IS.makeCanvas(96, 96);
    const r = IS.mulberry32(5);
    for (let i = 0; i < 26; i++) {
      const x = Math.floor(r() * 96), y = Math.floor(r() * 96), len = 2 + Math.floor(r() * 5);
      g.fillStyle = r() < 0.7 ? 'rgba(220, 248, 252, 0.55)' : 'rgba(255,255,255,0.8)';
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
      // tileable-ish noise via wrapped sampling
      const v = (n(x / 40, y / 40) + n((x + 256) / 40, y / 40) * 0 + n(x / 15, y / 15) * 0.4) / 1.4;
      const i = (y * 256 + x) * 4;
      img.data[i] = 235; img.data[i + 1] = 240; img.data[i + 2] = 245; img.data[i + 3] = Math.max(0, v - 0.35) * 260;
    }
    g.putImageData(img, 0, 0);
    return c;
  }
  makeCloud() {
    const { c, g } = IS.makeCanvas(260, 160);
    for (let i = 0; i < 7; i++) {
      const gr = g.createRadialGradient(60 + i * 24, 80 + Math.sin(i) * 20, 0, 60 + i * 24, 80 + Math.sin(i) * 20, 60);
      gr.addColorStop(0, 'rgba(20, 30, 60, 0.10)');
      gr.addColorStop(1, 'rgba(20, 30, 60, 0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 260, 160);
    }
    return c;
  }

  // Ambient tint by time of day, as [r, g, b, alpha]
  ambient(min) {
    const K = [
      [0, [18, 10, 58, 0.72]], [300, [18, 10, 58, 0.7]], [360, [70, 50, 100, 0.38]], [420, [255, 170, 120, 0.1]],
      [480, [255, 220, 180, 0]], [1020, [255, 200, 150, 0]], [1110, [255, 120, 50, 0.2]], [1170, [150, 50, 120, 0.34]],
      [1230, [40, 22, 90, 0.58]], [1320, [18, 10, 58, 0.72]], [1440, [18, 10, 58, 0.72]],
    ];
    let i = 1;
    while (i < K.length - 1 && K[i][0] <= min) i++;
    const [m0, a] = K[i - 1], [m1, b] = K[i];
    const t = IS.clamp((min - m0) / (m1 - m0), 0, 1);
    const out = a.map((v, k) => IS.lerp(v, b[k], t));
    const w = this.sim.weather;
    if (w === 'cloudy') out[3] += 0.06;
    if (w === 'rain') { out[3] += 0.22; out[0] = IS.lerp(out[0], 45, 0.8); out[1] = IS.lerp(out[1], 58, 0.8); out[2] = IS.lerp(out[2], 85, 0.8); }
    if (w === 'storm') { out[3] += 0.4; out[0] = IS.lerp(out[0], 28, 0.9); out[1] = IS.lerp(out[1], 34, 0.9); out[2] = IS.lerp(out[2], 62, 0.9); }
    if (w === 'fog') out[3] += 0.04;
    out[3] = Math.min(0.8, out[3]);
    return out;
  }

  // ------------------------------------------------------------------
  draw(now, rdt) {
    const sim = this.sim, w = sim.world, ctx = this.ctx, T = IS.TILE;
    const vw = this.vw, vh = this.vh;
    const cam = sim.cam;
    cam.x = vw >= w.pxW ? w.pxW / 2 : IS.clamp(cam.x, vw / 2, w.pxW - vw / 2);
    cam.y = vh >= w.pxH ? w.pxH / 2 : IS.clamp(cam.y, vh / 2, w.pxH - vh / 2);
    const ox = Math.round(cam.x - vw / 2), oy = Math.round(cam.y - vh / 2);
    this.ox = ox; this.oy = oy;
    const t = now / 1000;

    ctx.fillStyle = '#2d66a6';
    ctx.fillRect(0, 0, vw, vh);
    // Water, moving sparkles, foam, then land on top
    const sx = Math.max(0, ox), sy = Math.max(0, oy);
    const sw = Math.min(w.pxW - sx, vw - (sx - ox)), sh = Math.min(w.pxH - sy, vh - (sy - oy));
    ctx.drawImage(w.waterCanvas, sx, sy, sw, sh, sx - ox, sy - oy, sw, sh);
    const wt = sim.waveTime;
    for (const [dx, dy, a] of [[wt * 6, wt * 2, 0.55], [-wt * 4 + 40, wt * 3 + 20, 0.35]]) {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(Math.round(-ox + dx), Math.round(-oy + dy));
      ctx.fillStyle = this.waveA;
      ctx.fillRect(Math.round(ox - dx), Math.round(oy - dy), vw, vh);
      ctx.restore();
    }
    ctx.globalAlpha = 0.55 + 0.35 * Math.sin(t * 1.4);
    ctx.drawImage(w.foamCanvas, sx, sy, sw, sh, sx - ox, sy - oy, sw, sh);
    ctx.globalAlpha = 0.35 + 0.3 * Math.sin(t * 1.4 + 2);
    ctx.drawImage(w.foamCanvas, sx, sy, sw, sh, sx - ox, sy - oy + 1, sw, sh);
    ctx.globalAlpha = 1;
    this.drawDolphins(ctx, ox, oy, now);
    ctx.drawImage(w.landCanvas, sx, sy, sw, sh, sx - ox, sy - oy, sw, sh);

    // Flat things on the ground
    const inView = (x, y, m = 60) => x > ox - m && x < ox + vw + m && y > oy - m && y < oy + vh + m * 2;
    for (const cr of w.crops) {
      if (!inView(cr.x * T, cr.y * T)) continue;
      const st = cr.growth >= 1 ? 3 : cr.growth < 0.15 ? 0 : cr.growth < 0.55 ? 1 : 2;
      ctx.drawImage(IS.Sprites.crops[cr.kind][st], cr.x * T + 3 - ox, cr.y * T + 2 - oy);
    }
    const bot = sim.events.bottle;
    if (bot) {
      const bx = bot.tx * T + 6 - ox, by = bot.ty * T + 12 - oy + Math.round(Math.sin(t * 2) * 1);
      ctx.drawImage(IS.Sprites.bottle, bx, by);
      if (Math.sin(t * 3) > 0.8) { ctx.fillStyle = '#ffffff'; ctx.fillRect(bx + 4, by - 2, 1, 1); ctx.fillRect(bx + 3, by - 1, 3, 1); }
    }
    for (const b of w.buildings) {
      if (b.cut > 0.01) {
        ctx.globalAlpha = b.cut;
        ctx.drawImage(b.int.canvas, b.px - ox, b.py - oy);
        this.drawInteriorLive(ctx, b, ox, oy, t);
        ctx.globalAlpha = 1;
      }
    }
    // Selection ring
    const sel = sim.selected;
    if (sel && sel.mode !== 'carried' && sel.mode !== 'air') {
      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 5);
      ctx.beginPath();
      ctx.ellipse(Math.round(sel.x - ox) + 0.5, Math.round(sel.y - oy) - 0.5, 9, 3.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // Cloud shadows drift over everything on the ground
    if (sim.weather === 'sunny' || sim.weather === 'cloudy') {
      for (const cl of this.clouds) {
        cl.x += rdt * 6 * Math.max(1, sim.speedValue() * 0.3);
        if (cl.x > w.pxW + 200) { cl.x = -260; cl.y = Math.random() * w.pxH; }
        if (!inView(cl.x, cl.y, 300)) continue;
        ctx.globalAlpha = sim.weather === 'cloudy' ? 1 : 0.7;
        ctx.drawImage(this.cloud, Math.round(cl.x - ox), Math.round(cl.y - oy), 260 * cl.s, 160 * cl.s);
      }
      ctx.globalAlpha = 1;
    }

    // Depth-sorted pass
    const list = [];
    for (const o of w.objects) if (inView(o.x, o.y, 80)) list.push({ y: o.sortY, o, kind: 'obj' });
    for (const b of w.buildings) list.push({ y: b.sortY, b, kind: 'bld' });
    for (const p of sim.people) list.push({ y: p.y + (p.mode === 'carried' || p.mode === 'air' ? 1000 : 0), p, kind: 'person' });
    const boat = sim.events.boat;
    if (boat) list.push({ y: boat.y, kind: 'boat' });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) {
      if (it.kind === 'obj') {
        const o = it.o;
        ctx.drawImage(o.sprite, Math.round(o.x - o.ax - ox), Math.round(o.y - o.ay - oy));
        if (o.kind === 'firepit' && w.bonfire.lit) this.drawFire(ctx, o.x - ox, o.y - oy - 6, t);
      } else if (it.kind === 'bld') {
        const b = it.b;
        if (b.cut < 0.99) {
          ctx.globalAlpha = 1 - b.cut;
          ctx.drawImage(b.ext.canvas, b.px - ox, b.py - oy);
          ctx.globalAlpha = 1;
        }
        if (b.cut > 0.01) {
          ctx.globalAlpha = b.cut;
          ctx.drawImage(b.int.front, b.px - ox, (b.y0 + b.h - 1) * T - 6 - oy);
          ctx.globalAlpha = 1;
        }
      } else if (it.kind === 'person') {
        this.drawPerson(ctx, it.p, ox, oy, t);
      } else if (it.kind === 'boat') {
        const bob = Math.round(Math.sin(t * 1.5) * 1.5);
        ctx.drawImage(IS.Sprites.boat, Math.round(boat.x - 40 - ox), Math.round(boat.y - 60 - oy + bob));
      }
    }
    sim.fx.draw(ctx, ox, oy);
    this.drawGulls(ctx, ox, oy, rdt, t);

    // Cozy colour grade: a warm soft-light wash adds saturation and depth
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = 'rgba(255, 186, 120, 0.2)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.globalCompositeOperation = 'source-over';

    // Lighting
    const amb = this.ambient(sim.clock.min);
    this.drawLighting(ctx, amb, ox, oy, t);
    this.drawWeather(ctx, rdt, t, amb);
    this.drawStars(ctx, now);

    // Emotes after lighting so they stay readable at night
    for (const p of sim.people) this.drawEmote(ctx, p, ox, oy, now);
  }

  drawInteriorLive(ctx, b, ox, oy, t) {
    const T = IS.TILE;
    const sim = this.sim;
    if (b.kind === 'hall') {
      const ev = sim.events.list.find(e => e.state === 'active' && (e.seat === 'hallSeat'));
      // fireplace flicker
      const fx = (b.x0 + 6) * T - ox, fy = (b.y0 + 1) * T - oy;
      ctx.fillStyle = '#ff8a3a'; ctx.fillRect(fx + 12, fy + 2 - Math.round(Math.sin(t * 9) * 2), 24, 8);
      ctx.fillStyle = '#ffd56a'; ctx.fillRect(fx + 18, fy + 4 - Math.round(Math.sin(t * 7) * 2), 12, 6);
      if (ev) {
        const ty = (b.y0 + 3) * T + 5 - oy;
        for (let c = 2; c <= 7; c++) {
          const x = (b.x0 + c) * T + 6 - ox;
          ctx.fillStyle = '#ffffff'; ctx.fillRect(x, ty, 12, 6);
          ctx.fillStyle = ev.feast === false ? '#c9b07a' : ['#e0405a', '#f2b82e', '#5fae4a'][c % 3]; ctx.fillRect(x + 3, ty + 1, 6, 3);
        }
        if (ev.birthday) {
          const cx = (b.x0 + 5) * T - ox, cy = (b.y0 + 3) * T - oy;
          ctx.fillStyle = '#f4efe6'; ctx.fillRect(cx - 7, cy + 2, 14, 10);
          ctx.fillStyle = '#f28aa8'; ctx.fillRect(cx - 7, cy + 2, 14, 3);
          ctx.fillStyle = '#ffd56a'; ctx.fillRect(cx - 1, cy - 3 - Math.round(Math.sin(t * 10)), 2, 3);
        }
      }
    }
  }

  drawFire(ctx, x, y, t) {
    x = Math.round(x); y = Math.round(y);
    const f = k => Math.round(Math.sin(t * (7 + k) + k * 2) * 2);
    ctx.fillStyle = '#d9343f'; ctx.fillRect(x - 7, y - 6 + f(1), 14, 8);
    ctx.fillStyle = '#ff8a3a'; ctx.fillRect(x - 5, y - 11 + f(2), 10, 12); ctx.fillRect(x - 8, y - 4, 3, 5);
    ctx.fillStyle = '#ffd56a'; ctx.fillRect(x - 3, y - 14 + f(3), 6, 13);
    ctx.fillStyle = '#fff4c8'; ctx.fillRect(x - 1, y - 9 + f(4), 2, 7);
    if (Math.random() < 0.3) this.sim.fx.spark(x + this.ox, y - 12 + this.oy);
  }

  drawPerson(ctx, p, ox, oy, t) {
    const sx = Math.round(p.x - ox), sy = Math.round(p.y - oy);
    if (sx < -40 || sy < -60 || sx > this.vw + 40 || sy > this.vh + 80) return;
    const frames = p.frames[p.dir];
    let f = 0;
    if (p.pose === 'walk') f = [1, 0, 2, 0][Math.floor(p.anim / 6) % 4];
    else if (p.pose === 'work') f = Math.floor(p.anim) % 2 ? 3 : 0;
    else if (p.pose === 'carry') f = 4 + (Math.floor(p.anim) % 2);
    else if (p.pose === 'swim') f = Math.floor(p.anim / 8) % 2 ? 1 : 2;
    const img = frames[f];

    // Hidden indoors under a roof
    if (p.building && p.building.cut < 0.05 && p.mode === 'normal') return;
    if (p.building && p.building.cut < 0.99 && p.mode === 'normal') ctx.globalAlpha = p.building.cut;

    if (p.mode === 'carried' || p.mode === 'air' || p.mode === 'hop') {
      const z = Math.round(p.z);
      const shrink = IS.clamp(1 - z / 120, 0.4, 1);
      ctx.fillStyle = 'rgba(20, 20, 40, 0.3)';
      ctx.beginPath(); ctx.ellipse(sx, sy - 1, 7 * shrink, 2.5 * shrink, 0, 0, Math.PI * 2); ctx.fill();
      if (p.mode === 'carried') {
        // soft divine glow around the held person
        const gr = ctx.createRadialGradient(sx, sy - z - 14, 2, sx, sy - z - 14, 26);
        gr.addColorStop(0, 'rgba(255, 240, 180, 0.35)'); gr.addColorStop(1, 'rgba(255, 240, 180, 0)');
        ctx.fillStyle = gr; ctx.fillRect(sx - 30, sy - z - 44, 60, 60);
      }
      ctx.save();
      ctx.translate(sx, sy - z - 22);
      ctx.rotate(p.swing);
      ctx.drawImage(img, -11, -10);
      ctx.restore();
      if (p.mode === 'carried' && Math.random() < 0.3) {
        ctx.fillStyle = '#fff4c8';
        ctx.fillRect(sx + IS.randi(-14, 14), sy - z - IS.randi(10, 40), 1, 1);
      }
      ctx.globalAlpha = 1;
      return;
    }

    if (p.pose === 'sleep') {
      const top = sy - 18;
      ctx.drawImage(img, 0, 0, 22, 18, sx - 11, top - 9, 22, 18);
      const col = p.bedSpot ? IS.shade(p.cfg.look.shirt, -0.1) : '#6a8fc9';
      ctx.fillStyle = col; ctx.fillRect(sx - 9, top + 7, 18, 32);
      ctx.fillStyle = IS.shade(col, 0.25); ctx.fillRect(sx - 9, top + 7, 18, 3);
      ctx.fillStyle = IS.shade(col, -0.2); ctx.fillRect(sx - 9, top + 18, 18, 1); ctx.fillRect(sx - 9, top + 26, 18, 1);
      ctx.globalAlpha = 1;
      return;
    }
    if (p.pose === 'swim') {
      ctx.drawImage(img, 0, 0, 22, 20, sx - 11, sy - 32 + 12, 22, 20);
      ctx.strokeStyle = 'rgba(232, 251, 255, 0.85)';
      ctx.beginPath(); ctx.ellipse(sx + 0.5, sy - 2.5, 10 + Math.sin(t * 4), 3, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
      return;
    }
    // ground shadow
    ctx.fillStyle = 'rgba(20, 20, 40, 0.25)';
    ctx.beginPath(); ctx.ellipse(sx, sy - 1, 7, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    if (p.pose === 'sit') {
      ctx.drawImage(img, 0, 0, 22, 28, sx - 11, sy - 32 + 4, 22, 28);
    } else {
      ctx.drawImage(img, sx - 11, sy - 32);
    }
    const a = p.action;
    if (a && a.phase === 'do' && p.pose === 'sit' && a.def.id === 'read' && p.dir === 'down') {
      ctx.fillStyle = '#c9534f'; ctx.fillRect(sx - 4, sy - 13, 8, 5);
      ctx.fillStyle = '#f4efe6'; ctx.fillRect(sx - 3, sy - 13, 6, 1);
    }
    if (p.pose === 'fish' && !p.chat) this.drawRod(ctx, p, sx, sy, t);
    ctx.globalAlpha = 1;
  }

  drawRod(ctx, p, sx, sy, t) {
    const d = p.dir;
    const hand = { right: [6, -14], left: [-6, -14], down: [7, -12], up: [6, -18] }[d];
    const tipOff = { right: [14, -12], left: [-14, -12], down: [5, -14], up: [3, -16] }[d];
    const hx = sx + hand[0], hy = sy + hand[1];
    const tx = hx + tipOff[0], ty = hy + tipOff[1];
    const bx = Math.round(p.bobberX() - this.ox), by = Math.round(p.bobberY() - this.oy + Math.sin(t * 3) * 1.2);
    this.pixLine(ctx, hx, hy, tx, ty, '#6e4a2c');
    ctx.strokeStyle = 'rgba(240, 240, 255, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(tx + 0.5, ty + 0.5);
    ctx.quadraticCurveTo((tx + bx) / 2, Math.max(ty, by) + 6, bx + 0.5, by + 0.5);
    ctx.stroke();
    ctx.fillStyle = '#e0405a'; ctx.fillRect(bx - 1, by - 2, 3, 2);
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
    const sitDrop = p.pose === 'sit' ? 4 : p.pose === 'sleep' ? 14 : p.pose === 'swim' ? 12 : 0;
    const x = Math.round(p.x - ox) - 7;
    const y = Math.round(p.y - oy - p.z) - 50 + sitDrop + pop + Math.round(Math.sin(now / 200) * 1);
    ctx.drawImage(IS.Sprites.emotes[e.icon] || IS.Sprites.emotes.exclaim, x, y);
  }

  drawDolphins(ctx, ox, oy, now) {
    const d = this.sim.events.dolphins;
    if (!d) return;
    const T = IS.TILE;
    for (let i = 0; i < 3; i++) {
      const cyc = ((now - d.t0) / 1000 / 2.4 + i * 0.33) % 1;
      const baseX = d.tx * T + i * 30 - 30 - ox, baseY = d.ty * T + (i % 2) * 14 - oy;
      if (cyc < 0.5) {
        const k = cyc / 0.5;
        const x = baseX - 14 + k * 28, y = baseY - Math.sin(k * Math.PI) * 14;
        const fr = k < 0.33 ? 0 : k < 0.66 ? 1 : 2;
        ctx.drawImage(IS.Sprites.dolphin[fr], Math.round(x - 11), Math.round(y - 8));
        if (k < 0.08 || k > 0.92) { ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x) - 3, Math.round(baseY) - 1, 6, 2); }
      } else {
        ctx.strokeStyle = 'rgba(232,251,255,0.6)';
        ctx.beginPath(); ctx.ellipse(Math.round(baseX + 14) + 0.5, Math.round(baseY) + 0.5, 4 + (cyc - 0.5) * 16, 2 + (cyc - 0.5) * 4, 0, 0, Math.PI * 2); ctx.stroke();
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
      ctx.fillStyle = 'rgba(20, 20, 40, 0.18)';
      ctx.fillRect(Math.round(g.x - ox) - 4, Math.round(g.y - oy) + 36, 9, 2);
      const spr = IS.Sprites.gull[fr];
      ctx.save();
      if (g.vx < 0) { ctx.translate(Math.round(g.x - ox), 0); ctx.scale(-1, 1); ctx.drawImage(spr, -7, Math.round(g.y - oy) - 4); }
      else ctx.drawImage(spr, Math.round(g.x - ox) - 7, Math.round(g.y - oy) - 4);
      ctx.restore();
    }
    this.gulls = this.gulls.filter(g => g.x > ox - 80 && g.x < ox + this.vw + 80);
  }

  drawLighting(ctx, amb, ox, oy, t) {
    const [r, g, b, a] = amb;
    if (a < 0.01) return;
    const sim = this.sim, w = sim.world, T = IS.TILE;
    const L = this.light.g, vw = this.vw, vh = this.vh;
    const dark = IS.clamp((a - 0.12) / 0.45, 0, 1);
    L.globalCompositeOperation = 'source-over';
    L.clearRect(0, 0, vw, vh);
    L.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${a})`;
    L.fillRect(0, 0, vw, vh);
    const lights = [];
    if (dark > 0) {
      for (const l of w.lamps) lights.push({ x: l.x, y: l.y + 6, r: 56, s: 0.95 * dark, warm: 0.55 });
      const min = sim.clock.min;
      const evening = min >= 17.5 * 60 || min < 7.5 * 60;
      for (const bld of w.buildings) {
        const inside = sim.people.some(p => p.building === bld && p.pose !== 'sleep');
        const hallEv = bld.kind === 'hall' && sim.events.list.some(e => e.state === 'active' && e.seat === 'hallSeat');
        if (bld.kind === 'hall' && bld.cut > 0.3 && !(evening && (inside || hallEv))) {
          lights.push({ x: (bld.x0 + 7) * T, y: (bld.y0 + 1.6) * T, r: 60, s: dark * bld.cut * 0.8, warm: 0.6 });
          continue;
        }
        if (!(evening && (inside || hallEv))) continue;
        bld.lit = true;
        for (const win of bld.ext.windows) lights.push({ x: bld.px + win.x + 7, y: bld.py + win.y + 6, r: 30, s: 0.8 * dark, warm: 0.5, win: { x: bld.px + win.x, y: bld.py + win.y, w: win.w, h: win.h }, cut: bld.cut });
        if (bld.kind === 'hall' && bld.cut > 0.3) lights.push({ x: (bld.x0 + 7) * T, y: (bld.y0 + 1.6) * T, r: 70, s: dark * bld.cut, warm: 0.7 });
        if (bld.cut > 0.3) lights.push({ x: (bld.x0 + bld.w / 2) * T, y: (bld.y0 + bld.h / 2) * T, r: bld.w * 14, s: 0.8 * dark * bld.cut, warm: 0.3 });
      }
      if (w.bonfire.lit) {
        const fl = 1 + Math.sin(t * 13) * 0.06 + Math.sin(t * 7.3) * 0.05;
        lights.push({ x: w.bonfire.x * T + 12, y: w.bonfire.y * T + 10, r: 95 * fl, s: dark, warm: 0.6 });
      }
      lights.push({ x: w.lighthouseLight.x, y: w.lighthouseLight.y, r: 40, s: dark, warm: 0.4 });
      for (const ff of this.fireflies) {
        const fx = ff.x + Math.sin(t * 0.7 + ff.ph) * 14, fy = ff.y + Math.cos(t * 0.5 + ff.ph * 2) * 10;
        const on = Math.sin(t * 2 + ff.ph * 3) > 0.2;
        ff.cx = fx; ff.cy = fy; ff.on = on;
        if (on && sim.weather !== 'rain' && sim.weather !== 'storm') lights.push({ x: fx, y: fy, r: 8, s: dark * 0.8, warm: 0, ff: true });
      }
    }
    L.globalCompositeOperation = 'destination-out';
    for (const l of lights) {
      const x = l.x - ox, y = l.y - oy;
      if (x < -l.r || y < -l.r || x > vw + l.r || y > vh + l.r) continue;
      const gr = L.createRadialGradient(x, y, 0, x, y, l.r);
      gr.addColorStop(0, `rgba(0,0,0,${l.s})`);
      gr.addColorStop(0.5, `rgba(0,0,0,${l.s * 0.6})`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      L.fillStyle = gr;
      L.fillRect(x - l.r, y - l.r, l.r * 2, l.r * 2);
    }
    // Lighthouse beam sweeping over the sea
    if (dark > 0) {
      const lx = w.lighthouseLight.x - ox, ly = w.lighthouseLight.y - oy;
      const ang = t * 0.6;
      L.save();
      L.translate(lx, ly);
      L.rotate(ang);
      const bg = L.createLinearGradient(0, 0, 420, 0);
      bg.addColorStop(0, `rgba(0,0,0,${0.75 * dark})`); bg.addColorStop(1, 'rgba(0,0,0,0)');
      L.fillStyle = bg;
      L.beginPath(); L.moveTo(0, 0); L.lineTo(420, -40); L.lineTo(420, 40); L.closePath(); L.fill();
      L.restore();
    }
    L.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.light.c, 0, 0);
    // Warm glow pass
    if (dark > 0) {
      ctx.globalCompositeOperation = 'lighter';
      for (const l of lights) {
        const x = l.x - ox, y = l.y - oy;
        if (x < -l.r || y < -l.r || x > vw + l.r || y > vh + l.r) continue;
        if (l.ff) {
          ctx.fillStyle = `rgba(220, 255, 140, ${0.9 * dark})`;
          ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
          continue;
        }
        if (l.win && (l.cut || 0) < 0.6) {
          ctx.fillStyle = `rgba(255, 190, 90, ${0.55 * dark})`;
          ctx.fillRect(l.win.x - ox, l.win.y - oy, l.win.w, l.win.h);
        }
        if (!l.warm) continue;
        const gr = ctx.createRadialGradient(x, y, 0, x, y, l.r * 0.8);
        gr.addColorStop(0, `rgba(255, 165, 60, ${l.warm * 0.5 * l.s})`);
        gr.addColorStop(1, 'rgba(255, 170, 70, 0)');
        ctx.fillStyle = gr;
        ctx.fillRect(x - l.r, y - l.r, l.r * 2, l.r * 2);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  drawWeather(ctx, rdt, t, amb) {
    const sim = this.sim, vw = this.vw, vh = this.vh;
    const w = sim.weather;
    const target = w === 'rain' ? 160 : w === 'storm' ? 300 : 0;
    while (this.rain.length < target) this.rain.push({ x: Math.random() * (vw + 60), y: Math.random() * vh, s: IS.rand(220, 320), l: IS.randi(4, 8) });
    if (this.rain.length > target) this.rain.length = target;
    if (target) {
      const slant = w === 'storm' ? 0.35 : 0.15;
      ctx.strokeStyle = w === 'storm' ? 'rgba(200, 215, 240, 0.55)' : 'rgba(190, 210, 240, 0.5)';
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
      ctx.fillStyle = 'rgba(230, 236, 242, 0.18)';
      ctx.fillRect(0, 0, vw, vh);
    }
  }

  drawStars(ctx, now) {
    const ev = this.sim.events;
    ev.stars = ev.stars.filter(s => now - s.t0 < 1400);
    for (const s of ev.stars) {
      const k = (now - s.t0) / 1400;
      const x0 = s.x * this.vw, y0 = s.y * this.vh;
      const x = x0 + k * 160, y = y0 + k * 60;
      const gr = ctx.createLinearGradient(x - 50, y - 19, x, y);
      gr.addColorStop(0, 'rgba(255,255,255,0)');
      gr.addColorStop(1, `rgba(255,255,230,${1 - k})`);
      ctx.strokeStyle = gr;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x - 50, y - 19); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${1 - k})`;
      ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
    }
  }
};
