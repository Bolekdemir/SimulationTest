// The island cat. Wanders around its home, naps in the sun, sleeps indoors
// at night, and sits still for anyone who wants to pet it.
IS.Cat = class {
  constructor(sim, name, homeId) {
    this.sim = sim;
    this.world = sim.world;
    this.name = name;
    this.home = this.world.buildings.find(b => b.id === homeId) || this.world.buildings[0];
    const door = this.home.doors[0];
    this.x = door.x * IS.TILE + 12; this.y = (door.y + 2) * IS.TILE + 18;
    this.dir = 'right';
    this.path = [];
    this.state = 'sit';
    this.timer = 5;
    this.anim = 0;
    this.reserved = null;
    this.pettedBy = null;
    this.heartUntil = 0;
    this.frames = IS.Cat.sprites();
  }

  get tx() { return Math.floor(this.x / IS.TILE); }
  get ty() { return Math.floor((this.y - 6) / IS.TILE); }
  get building() { return this.world.buildingAt(this.tx, this.ty); }

  purr() { this.heartUntil = performance.now() + 1400; }

  update(dt) {
    if (this.reserved) {
      this.path = [];
      this.state = this.pettedBy ? 'sit' : this.state === 'nap' ? 'nap' : 'sit';
      if (this.pettedBy) this.dir = this.pettedBy.x < this.x ? 'left' : 'right';
      return;
    }
    if (this.path.length) { this.walk(dt); return; }
    this.timer -= dt;
    if (this.timer > 0) return;
    const min = this.sim.clock.min;
    const night = min >= 22 * 60 || min < 6 * 60;
    const wet = this.sim.weather === 'rain' || this.sim.weather === 'storm';
    if ((night || wet) && this.building !== this.home) {
      const spot = { x: this.home.x0 + 1, y: this.home.y0 + 3 };
      this.goTo(spot.x, spot.y);
      return;
    }
    if (night || (wet && Math.random() < 0.7)) { this.state = 'nap'; this.timer = IS.rand(60, 180); return; }
    if (Math.random() < 0.4) { this.state = 'nap'; this.timer = IS.rand(30, 100); return; }
    // Wander somewhere sunny near home
    const d = this.home.doors[0];
    for (let i = 0; i < 12; i++) {
      const x = d.x + IS.randi(-9, 9), y = d.y + IS.randi(1, 8);
      if (this.world.walkable(x, y) && this.world.reach[this.world.idx(x, y)] && !this.world.buildingAt(x, y)) { this.goTo(x, y); return; }
    }
    this.timer = 10;
  }

  goTo(x, y) {
    const path = this.world.findPath(this.tx, this.ty, x, y);
    if (path && path.length) { this.path = path; this.state = 'walk'; }
    else { this.state = 'sit'; this.timer = IS.rand(10, 30); }
  }

  walk(dt) {
    const T = IS.TILE;
    let remaining = 1.6 * T * dt;
    while (remaining > 0 && this.path.length) {
      const n = this.path[0];
      const tx = n.x * T + 12, ty = n.y * T + 18;
      const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy);
      if (Math.abs(dx) > 0.5) this.dir = dx > 0 ? 'right' : 'left';
      if (d <= remaining) { this.x = tx; this.y = ty; remaining -= d; this.path.shift(); this.anim += d; }
      else { this.x += (dx / d) * remaining; this.y += (dy / d) * remaining; this.anim += remaining; remaining = 0; }
    }
    if (!this.path.length) { this.state = 'sit'; this.timer = IS.rand(8, 30); }
  }

  draw(ctx, ox, oy, now) {
    const b = this.building;
    if (b && b.cut < 0.05) return;
    const sx = Math.round(this.x - ox), sy = Math.round(this.y - oy);
    const key = this.state === 'nap' ? 'nap' : this.state === 'walk' ? (Math.floor(this.anim / 5) % 2 ? 'walk1' : 'walk2') : 'sit';
    const img = this.frames[this.dir][key];
    if (b) ctx.globalAlpha = b.cut;
    ctx.fillStyle = 'rgba(20, 20, 40, 0.25)';
    ctx.beginPath(); ctx.ellipse(sx, sy - 1, 6, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(img, sx - 9, sy - 14);
    if (this.state === 'nap' && Math.floor(now / 900) % 2 === 0) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx + 6, sy - 18, 3, 1); ctx.fillRect(sx + 7, sy - 17, 1, 1); ctx.fillRect(sx + 6, sy - 16, 3, 1);
    }
    if (this.heartUntil > now) ctx.drawImage(IS.Sprites.emotes.heart, sx - 7, sy - 32 + Math.round(Math.sin(now / 150)));
    ctx.globalAlpha = 1;
  }
};

IS.Cat.sprites = (() => {
  let cache = null;
  return () => {
    if (cache) return cache;
    const px = IS.Sprites.px;
    const fur = '#ec9440', furD = '#c4662a', furL = '#ffc078', white = '#fff4e6', eye = '#1d1424', pink = '#f28aa8';
    const make = kind => {
      const { c, g } = IS.makeCanvas(18, 15);
      if (kind === 'nap') {
        IS.Sprites.ellipse(g, 9, 10, 6, 3, fur);
        px(g, 5, 8, 2, 1, furD); px(g, 8, 7, 2, 1, furD); px(g, 11, 8, 2, 1, furD);
        px(g, 3, 9, 4, 3, fur); px(g, 3, 8, 1, 1, fur); px(g, 6, 8, 1, 1, fur); // tucked head and ears
        px(g, 4, 10, 2, 1, eye);
        px(g, 12, 12, 5, 1, furD); px(g, 4, 12, 2, 1, white);
      } else if (kind === 'sit') {
        px(g, 6, 7, 6, 6, fur); px(g, 7, 9, 3, 4, furL); px(g, 6, 12, 2, 1, white); px(g, 10, 12, 2, 1, white);
        px(g, 6, 2, 7, 5, fur); px(g, 6, 1, 1, 1, fur); px(g, 12, 1, 1, 1, fur); px(g, 7, 2, 1, 1, pink); px(g, 11, 2, 1, 1, pink);
        px(g, 8, 4, 1, 1, eye); px(g, 11, 4, 1, 1, eye); px(g, 9, 5, 2, 1, pink);
        px(g, 7, 3, 1, 1, furD); px(g, 12, 6, 1, 1, furD); px(g, 6, 8, 1, 2, furD);
        px(g, 12, 11, 4, 2, fur); px(g, 15, 9, 1, 3, fur); // tail
      } else {
        const step = kind === 'walk1';
        px(g, 3, 6, 10, 4, fur); px(g, 4, 9, 8, 1, furL);
        px(g, 5, 6, 1, 2, furD); px(g, 8, 6, 1, 2, furD); px(g, 11, 6, 1, 2, furD);
        px(g, 12, 2, 5, 5, fur); px(g, 12, 1, 1, 1, fur); px(g, 16, 1, 1, 1, fur);
        px(g, 15, 3, 1, 1, eye); px(g, 16, 5, 1, 1, pink);
        px(g, step ? 4 : 5, 10, 1, 2, fur); px(g, step ? 7 : 6, 10, 1, 2, fur); px(g, step ? 10 : 11, 10, 1, 2, fur); px(g, step ? 12 : 11, 10, 1, 2, fur);
        px(g, step ? 4 : 5, 12, 1, 1, white); px(g, step ? 12 : 11, 12, 1, 1, white);
        px(g, 1, 3, 2, 1, fur); px(g, 1, 4, 1, 2, fur); px(g, 2, 5, 1, 1, fur); // tail up
      }
      IS.outline(c, '#2a2135');
      return c;
    };
    const right = { sit: make('sit'), walk1: make('walk1'), walk2: make('walk2'), nap: make('nap') };
    const mirror = src => {
      const { c, g } = IS.makeCanvas(src.width, src.height);
      g.translate(src.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0);
      return c;
    };
    const left = {};
    for (const k in right) left[k] = mirror(right[k]);
    cache = { right, left };
    return cache;
  };
})();
