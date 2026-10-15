IS.Sim = class {
  constructor() {
    const C = IS.CONFIG;
    this.world = new IS.World();
    this.clock = { abs: (C.startDay - 1) * 1440 + C.startMinute };
    this.updateClock();
    this.weather = 'sunny';
    this.fx = new IS.FX();
    this.conversations = [];
    this.chatCooldown = {};
    this.logEntries = [];
    this.people = IS.ISLANDERS.map((cfg, i) => new IS.Person(cfg, i, this));
    this.events = new IS.Events(this);
    const catLover = this.people.find(p => p.loves.includes('cats'));
    this.cat = new IS.Cat(this, IS.CONFIG.catName || 'Biscuit', catLover ? catLover.homeId : 'house1');
    this.speedIdx = 1;
    this.lastSpeed = 1;
    this.xray = false;
    this.selected = null;
    this.follow = false;
    this.hover = null;
    this.waveTime = 0;
    this.nightFF = false;
    const plaza = this.world.pois.find(p => p.name === 'the plaza');
    this.cam = { x: plaza.x * IS.TILE, y: plaza.y * IS.TILE - 40, zoom: this.defaultZoom() };
  }

  defaultZoom() {
    const w = window.innerWidth;
    return IS.clamp(Math.round(w / (19 * IS.TILE)), 2, 6);
  }

  boot() {
    this.renderer = new IS.Renderer(this, document.getElementById('game'));
    this.ui = new IS.UI(this);
    this.input = new IS.Input(this, document.getElementById('game'));
    window.addEventListener('resize', () => this.renderer.resize());
    this.log(`Welcome to ${IS.CONFIG.islandName}. ${this.people.length} islanders are still asleep.`, 'event');
    this.last = performance.now();
    const loop = now => {
      this.frame(now);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // ---------------------------------------------------------------- time
  updateClock() {
    const c = this.clock;
    c.day = Math.floor(c.abs / 1440) + 1;
    c.min = c.abs % 1440;
    c.hour = Math.floor(c.min / 60);
    c.weekday = this.weekdayOf(c.day);
    c.season = IS.SEASONS[Math.floor((c.day - 1) / 28) % 4];
    c.seasonDay = ((c.day - 1) % 28) + 1;
  }
  weekdayOf(day) { return (day - 1 + 4) % 7; } // day 1 is a Friday
  seasonOf(day) { return IS.SEASONS[Math.floor((day - 1) / 28) % 4]; }
  isBirthday(p, day = this.clock.day) {
    const b = p.cfg.birthday;
    return !!b && b.season === this.seasonOf(day) && b.day === ((day - 1) % 28) + 1;
  }
  isBirthdayAny() { return this.people.some(p => this.isBirthday(p)); }

  speedValue() {
    if (this.speedIdx === 0) return 0;
    const base = IS.CONFIG.speeds[this.speedIdx];
    return this.nightFF ? Math.max(base, IS.CONFIG.nightSpeed) : base;
  }
  setSpeed(i) {
    if (i > 0) this.lastSpeed = i;
    this.speedIdx = IS.clamp(i, 0, IS.CONFIG.speeds.length - 1);
    this.ui && this.ui.syncToggles();
  }
  zoomBy(d, cx, cy) {
    const z0 = this.cam.zoom;
    const z1 = IS.clamp(z0 + d, 1, 6);
    if (z1 === z0) return;
    if (cx !== undefined && this.renderer && !this.follow) {
      const w = this.input.toWorld(cx, cy);
      this.cam.zoom = z1;
      this.renderer.resize();
      const w2 = this.input.toWorld(cx, cy);
      this.cam.x += w.x - w2.x; this.cam.y += w.y - w2.y;
    } else {
      this.cam.zoom = z1;
      this.renderer.resize();
    }
  }

  // ---------------------------------------------------------------- helpers
  byName(name) { return this.people.find(p => p.name === name) || null; }
  select(p) {
    this.selected = p;
    if (!p) this.follow = false;
    this.ui.syncToggles();
    this.ui.panels();
  }
  log(text, kind = 'info', people = []) {
    const c = this.clock;
    const entry = { when: `${IS.WEEKDAYS[c.weekday]} ${IS.fmtTime(c.min)}`, text, kind, people: people.filter(Boolean).map(p => p.name) };
    this.logEntries.push(entry);
    if (this.logEntries.length > 200) this.logEntries.shift();
    if (this.ui) this.ui.addLog(entry);
  }
  toast(text) { if (this.ui) this.ui.toast(text); }

  // Make someone reconsider what they're doing (storms, dolphins, boats)
  nudge(p, prob) {
    const low = ['wander', 'plaza', 'beach', 'read', 'home', 'fish', 'garden', 'forage', 'chop', 'stargaze', 'swim'];
    if (p.mode !== 'normal' || p.chat || !p.action || p.sick) return;
    if (!low.includes(p.action.def.id)) return;
    if (Math.random() < prob) p.cancelAction();
  }

  onGrab(grabbed) {
    for (const o of this.people) {
      if (o === grabbed || o.mode !== 'normal' || o.pose === 'sleep' || o.building) continue;
      if (IS.dist(o.x, o.y, grabbed.x, grabbed.y) > IS.TILE * 12) continue;
      o.emote('exclaim', 1.6);
      if (Math.random() < 0.55) o.say(IS.pick([`${grabbed.name} is FLYING!`, 'Did you see that?!', 'The Sky Hand strikes again!', `Hang on, ${grabbed.name}!`]));
      if (!o.recentMemory('witness', 120)) o.remember(`Saw ${grabbed.name} get lifted into the sky`, { tag: 'witness', about: grabbed.name, news: true });
    }
  }

  // ---------------------------------------------------------------- loop
  frame(now) {
    const rdt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    // Fast-forward the night while everyone is asleep
    const sleeping = this.people.every(p => p.pose === 'sleep' || p.sick);
    this.nightFF = sleeping && (this.clock.min >= 22 * 60 || this.clock.min < 5.75 * 60) && this.people.every(p => p.mode === 'normal');
    const speed = this.speedValue();
    const total = rdt * speed;
    const steps = Math.max(1, Math.ceil(total / 0.5));
    const dt = total / steps;
    for (let i = 0; i < steps; i++) {
      this.clock.abs += dt;
      this.updateClock();
      this.events.update(dt);
      for (const p of this.people) p.update(dt, rdt / steps, this.ctx());
      this.cat.update(dt);
      for (const cv of this.conversations.slice()) cv.update(dt);
      if (dt > 0) IS.Social.update(this, dt);
      this.cropGrowth(dt);
    }
    this.fx.update(rdt);
    this.waveTime += rdt * (1 + Math.min(speed, 5) * 0.15);
    this.ambientFx(rdt);
    this.input.update(rdt);
    for (const b of this.world.buildings) {
      const hover = this.hoverWorld && this.world.buildingAtPx(this.hoverWorld.x, this.hoverWorld.y) === b && !(this.input.press && this.input.press.pan && this.input.press.moved);
      const target = this.xray || hover || (this.selected && this.selected.building === b) || (this.input.press && this.input.press.grabbed && this.hover && this.hover.building === b) ? 1 : 0;
      b.cut += (target - b.cut) * Math.min(1, rdt * 8);
    }
    if (this.follow && this.selected) {
      const p = this.selected;
      this.cam.x += (p.x - this.cam.x) * Math.min(1, rdt * 4);
      this.cam.y += (p.y - 20 - this.cam.y) * Math.min(1, rdt * 4);
    }
    this.renderer.draw(now, rdt);
    this.ui.frame(now);
  }

  ctx() {
    const c = this.clock;
    c.weather = this.weather;
    return c;
  }

  cropGrowth(dt) {
    const rate = this.weather === 'rain' || this.weather === 'storm' ? 0.00034 : 0.00022;
    for (const cr of this.world.crops) cr.growth = Math.min(1, cr.growth + rate * dt);
  }

  ambientFx(rdt) {
    const min = this.clock.min;
    for (const b of this.world.buildings) {
      const cooking = this.people.some(p => p.building === b && p.action && p.action.phase === 'do' && ['cook', 'home', 'eat'].includes(p.action.def.id));
      const evening = (min > 17 * 60 || min < 8 * 60) && this.people.some(p => p.building === b && p.pose !== 'sleep');
      if ((cooking || evening) && Math.random() < rdt * 2.5) this.fx.smoke(b.px + b.ext.w - 29, b.py + 2);
    }
  }
};

window.addEventListener('DOMContentLoaded', () => {
  // Let the loading card paint before the island is generated (takes a moment)
  requestAnimationFrame(() => setTimeout(() => {
    const sim = new IS.Sim();
    window.sim = sim;
    sim.boot();
    document.getElementById('loading').hidden = true;
  }, 30));
});
