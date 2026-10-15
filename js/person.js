IS.Person = class {
  constructor(cfg, id, sim) {
    const T = IS.TILE;
    this.sim = sim;
    this.world = sim.world;
    this.id = id;
    this.cfg = cfg;
    this.name = cfg.name;
    this.traits = Object.assign({ sociable: 0.5, energetic: 0.5, kind: 0.5, grumpy: 0.3, curious: 0.5, hardworking: 0.5, brave: 0.5 }, cfg.traits);
    this.loves = cfg.loves || [];
    this.hates = cfg.hates || [];
    const spr = IS.Sprites.makePerson(cfg.look);
    this.frames = spr.frames;
    this.portrait = spr.portrait;
    this.homeId = 'house' + (cfg.home ?? id);
    this.bedSpot = (this.world.spots.bed || []).find(s => s.owner === this.name) ||
      (this.world.spots.bed || []).find(s => s.building === this.homeId);

    const t = this.traits;
    this.bedMin = 22 * 60 + Math.round((t.energetic - 0.5) * 120) + (t.curious > 0.7 ? 30 : 0);
    this.wakeMin = 6 * 60 + Math.round((1 - t.hardworking) * 90) + (t.energetic < 0.3 ? 30 : 0);

    this.needs = { hunger: IS.rand(58, 75), energy: IS.rand(72, 86), social: IS.rand(50, 75), fun: IS.rand(50, 75) };
    this.moodMods = [];
    this.memories = [];
    this.rel = {};
    for (const [name, b] of Object.entries(cfg.bonds || {})) {
      this.rel[name] = { friendship: b.friendship || 0, romance: b.romance || 0, label: b.label || '', partner: false };
    }
    this.skyOpinion = 0;
    this.grabCount = 0;
    this.avoid = {};
    this.failUntil = {};
    this.history = [];
    this.visitedBy = new Set();
    this.sick = false;
    this.wetUntil = 0;

    this.x = 0; this.y = 0; this.z = 0;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.dir = 'down';
    this.path = [];
    this.mode = 'normal';
    this.pose = 'stand';
    this.anim = 0;
    this.swing = 0;
    this.action = null;
    this.chat = null;
    this.thought = 'Zzz...';
    this.bubble = null;
    this.emoteData = null;
    this.building = null;
    IS.Mind.init(this);
    if (this.bedSpot) this.setTile(this.bedSpot.x, this.bedSpot.y);
    else this.setTile(40, 33);
  }

  get tx() { return Math.floor(this.x / IS.TILE); }
  get ty() { return Math.floor((this.y - 6) / IS.TILE); }
  setTile(tx, ty) { this.x = tx * IS.TILE + 12; this.y = ty * IS.TILE + 18; }

  // ---------------------------------------------------------------- state
  isBedtime(min) {
    const since = (min - 1080 + 1440) % 1440;
    const bed = (this.bedMin - 1080 + 1440) % 1440;
    const wake = (this.wakeMin - 1080 + 1440) % 1440;
    return since >= bed && since < wake;
  }
  minutesUntilWake(min) { return (this.wakeMin - min + 1440) % 1440; }
  isAsleep() { return this.pose === 'sleep' && !this.sick; }
  isAvoiding(o) { return (this.avoid[o.name] || 0) > this.sim.clock.abs; }

  mood() {
    const n = this.needs;
    let m = (n.hunger + n.energy + n.social + n.fun) / 4;
    for (const mm of this.moodMods) m += mm.value;
    if (this.sick) m -= 18;
    if (this.wetUntil > this.sim.clock.abs) m -= 6;
    return IS.clamp(m, 0, 100);
  }
  moodWord() {
    const m = this.mood();
    return m > 80 ? 'Joyful' : m > 62 ? 'Happy' : m > 45 ? 'Content' : m > 30 ? 'Meh' : m > 15 ? 'Upset' : 'Miserable';
  }
  addMood(label, value, duration) {
    this.moodMods = this.moodMods.filter(m => m.label !== label);
    this.moodMods.push({ label, value, until: this.sim.clock.abs + duration });
  }

  relTo(name) {
    if (!this.rel[name]) this.rel[name] = { friendship: 0, romance: 0, label: '', partner: false };
    return this.rel[name];
  }
  canFallFor(name) { return (this.cfg.canFallFor || []).includes(name); }
  changeRel(name, df, dr = 0) {
    const r = this.relTo(name);
    r.friendship = IS.clamp(r.friendship + df, -100, 100);
    if (dr && this.canFallFor(name)) r.romance = IS.clamp(r.romance + dr, 0, 100);
  }
  partner() {
    for (const [name, r] of Object.entries(this.rel)) if (r.partner) return this.sim.byName(name);
    return null;
  }
  relLabel(name) {
    const r = this.relTo(name);
    if (r.partner) return 'Partner';
    const f = r.friendship;
    let l = f >= 70 ? 'Best friend' : f >= 35 ? 'Friend' : f >= 10 ? 'Friendly' : f > -10 ? 'Acquaintance' : f > -40 ? 'Rival' : 'Enemy';
    if (r.romance >= 40) l += ' · crush';
    return l;
  }

  remember(text, opts = {}) {
    const m = { t: this.sim.clock.abs, text, tag: opts.tag || 'misc', about: opts.about || null, news: !!opts.news, detail: opts.detail, toldTo: new Set() };
    this.memories.unshift(m);
    if (this.memories.length > 40) this.memories.pop();
    if (opts.mood) this.addMood(text, opts.mood, opts.moodDuration || 360);
    return m;
  }
  recentMemory(tag, withinMin = 1440, notToldTo) {
    const now = this.sim.clock.abs;
    return this.memories.find(m => m.tag === tag && now - m.t <= withinMin && (!notToldTo || !m.toldTo.has(notToldTo)));
  }

  say(text, seconds) {
    const sp = this.sim.speedValue();
    const dur = seconds || IS.clamp(3.4 / Math.max(1, sp / 2), 1.2, 3.6);
    this.bubble = { text, until: performance.now() + dur * 1000, id: Math.random() };
  }
  emote(icon, seconds = 1.8) {
    this.emoteData = { icon, until: performance.now() + seconds * 1000, t0: performance.now() };
  }

  canChat() {
    if (this.mode !== 'normal' || this.chat) return false;
    if (this.pose === 'sleep') return false;
    const a = this.action;
    if (!a) return true;
    if (a.phase === 'travel') return true;
    return !!a.def.chatOK;
  }
  canBeVisited(by) {
    if (this.mode !== 'normal' || this.sick) return false;
    if (this.pose === 'sleep') return false;
    if (this.action && (this.action.def.id === 'swim' || this.action.def.id === 'cook')) return false;
    if (this.isAvoiding(by) || by.isAvoiding(this)) return false;
    return true;
  }

  // ---------------------------------------------------------------- brain
  decide(c) {
    const opts = [];
    const outdoorNight = c.min >= 21.5 * 60 || c.min < 5.5 * 60;
    for (const def of IS.Actions.list) {
      if (this.sick && def.id !== 'sleep') continue;
      if ((this.failUntil[def.id] || 0) > c.abs) continue;
      if (def.can && !def.can(this, c)) continue;
      let s = def.score(this, c);
      if (!(s > 0)) continue;
      if (def.outdoor) {
        if (c.weather === 'storm') s *= this.traits.brave > 0.8 ? 0.15 : 0.02;
        else if (c.weather === 'rain') s *= 0.45 + this.traits.brave * 0.3;
        if (outdoorNight && def.id !== 'stargaze') s *= 0.3;
      }
      if (def.social && c.weather === 'storm') s *= 0.25;
      // Boredom pushes people toward the things they love
      if (def.love && this.loves.includes(def.love)) s += Math.pow((100 - this.needs.fun) / 100, 2) * 1.6;
      s += IS.Mind.planBonus(this, def);
      if (this.history.slice(-2).includes(def.id) && !['sleep', 'eat', 'attend', 'cook'].includes(def.id)) s -= 0.3;
      s += Math.random() * 0.2;
      if (s > 0.05) opts.push({ def, s });
    }
    opts.sort((a, b) => b.s - a.s);
    const top = opts.slice(0, 3);
    const order = [];
    if (top.length) {
      const first = IS.weightedPick(top.map(o => ({ ...o, w: Math.pow(o.s, 3) })));
      order.push(first, ...opts.filter(o => o !== first && o.def !== first.def));
    }
    for (const o of order) if (this.startAction(o.def, c)) return;
    this.idleUntil = c.abs + 3;
    this.thought = 'Hmm... what to do.';
  }

  startAction(def, c) {
    const plan = def.plan ? def.plan(this, c) : {};
    if (!plan) { this.failUntil[def.id] = c.abs + 20; return false; }
    // Joining a friend: take the free spot closest to theirs
    if (this.joinNear) {
      const jn = this.joinNear;
      if (plan.spot) {
        const near = (this.world.spots[plan.spot.kind] || []).filter(s => !s.takenBy && IS.dist(s.x, s.y, jn.x, jn.y) < 7).sort((a, b) => IS.dist(a.x, a.y, jn.x, jn.y) - IS.dist(b.x, b.y, jn.x, jn.y))[0];
        if (near) plan.spot = near;
      } else if (plan.tx !== undefined) {
        const g = this.world.findNear(jn.x, jn.y, (x, y) => this.world.walkable(x, y) && !(x === jn.x && y === jn.y), 3);
        if (g) { plan.tx = g.x; plan.ty = g.y; }
      }
    }
    const a = { def, ...plan, elapsed: 0, phase: 'travel', started: c.abs };
    if (plan.spot) {
      a.tx = plan.spot.x; a.ty = plan.spot.y;
      a.face = plan.face || plan.spot.face;
      a.pose = def.pose === 'fish' || def.pose === 'work' ? def.pose : plan.spot.pose;
    } else {
      a.pose = def.pose || 'stand';
    }
    if (!plan.follow) {
      const swim = plan.swim || (plan.spot && plan.spot.pose === 'swim');
      const path = this.world.findPath(this.tx, this.ty, a.tx, a.ty, { swim });
      if (path === null) { this.failUntil[def.id] = c.abs + 30; if (def.cancel) def.cancel(this); return false; }
      this.path = path;
    } else {
      this.path = [];
      a.repath = 0;
    }
    if (plan.spot) plan.spot.takenBy = this;
    this.action = a;
    this.thought = def.thought ? def.thought(this, a, c) : def.label;
    if (!this.joinNear) IS.Mind.onStart(this.sim, this, a);
    return true;
  }

  actionLabel() {
    if (this.mode === 'carried') return 'Being carried by the Sky Hand';
    if (this.mode === 'air') return 'Flying!';
    if (this.mode === 'swim') return 'Swimming back to shore';
    if (this.mode === 'recover') return 'Recovering';
    if (this.chat) return `Talking with ${this.chat.other(this).name}`;
    const a = this.action;
    if (!a) return 'Idle';
    const label = a.def.label2 ? a.def.label2(this, a) : a.def.label;
    if (a.phase === 'travel') return (a.follow ? `Heading to ${a.follow.name}` : `On the way: ${label.toLowerCase()}`);
    if (a.date && a.with) return `On a date with ${a.with}`;
    if (a.with) return `${label} with ${a.with}`;
    return label;
  }

  releaseSpot() {
    if (this.action && this.action.spot && this.action.spot.takenBy === this) this.action.spot.takenBy = null;
  }
  finishAction(c) {
    const a = this.action;
    if (!a) return;
    if (a.def.finish) a.def.finish(this, a, c);
    IS.Mind.onFinish(this, a);
    this.releaseSpot();
    this.history.push(a.def.id);
    if (this.history.length > 8) this.history.shift();
    this.action = null;
    this.pose = 'stand';
  }
  cancelAction() {
    const a = this.action;
    if (!a) return;
    if (a.def.cancel) a.def.cancel(this, a);
    this.releaseSpot();
    this.action = null;
    this.path = [];
    this.pose = 'stand';
  }

  // ---------------------------------------------------------------- update
  update(dt, rdt, c) {
    this.decayNeeds(dt);
    this.moodMods = this.moodMods.filter(m => m.until > c.abs);
    if (this.wetUntil > c.abs && Math.random() < rdt * 3) this.sim.fx.drip(this.x + IS.rand(-5, 5), this.y, 14);

    switch (this.mode) {
      case 'carried': this.anim += rdt * 10; this.carriedTalk(rdt); break;
      case 'air': this.updateAir(rdt, c); break;
      case 'hop': this.updateHop(rdt, c); break;
      case 'swim': this.updateSwim(dt, c); break;
      case 'recover':
        this.pose = this.isWaterHere() ? 'swim' : 'stand';
        if (c.abs >= this.recoverUntil) { this.mode = 'normal'; }
        break;
      default: this.updateNormal(dt, c);
    }
    this.building = this.world.buildingAt(this.tx, this.ty);
  }

  decayNeeds(dt) {
    const n = this.needs, t = this.traits;
    const asleep = this.pose === 'sleep';
    n.hunger -= (asleep ? 0.035 : 0.085) * dt;
    if (!asleep) n.energy -= 0.052 * (1 + t.energetic * 0.3) * dt * (this.sick ? 1.4 : 1);
    if (!asleep && !this.chat) n.social -= 0.06 * (0.4 + t.sociable) * dt;
    if (!asleep) n.fun -= 0.085 * dt;
    for (const k in n) n[k] = IS.clamp(n[k], 0, 100);
  }

  isWaterHere() { return this.world.isWater(this.tx, this.ty); }

  updateNormal(dt, c) {
    if (this.chat) {
      const o = this.chat.other(this);
      if (this.pose !== 'sit' && this.pose !== 'sleep') this.faceToward(o.x, o.y);
      if (this.pose === 'walk') this.pose = 'stand';
      return;
    }
    if (!this.action) {
      if ((this.idleUntil || 0) > c.abs) { this.pose = this.isWaterHere() ? 'swim' : 'stand'; return; }
      this.decide(c);
      if (!this.action) return;
    }
    const a = this.action;
    if (a.phase === 'travel') {
      if (a.follow) { this.updateFollow(a, dt, c); return; }
      if (this.path.length) {
        this.moveAlong(dt);
      } else {
        this.arrive(a, c);
      }
    } else {
      a.elapsed += dt;
      if (a.def.tick) a.def.tick(this, a, dt, c);
      if (a.pose === 'work') this.anim += dt * 6;
      if (a.elapsed >= a.duration || a.done) this.finishAction(c);
    }
  }

  arrive(a, c) {
    a.phase = 'do';
    if (a.face) this.dir = a.face;
    this.pose = this.isWaterHere() ? 'swim' : (a.pose || 'stand');
    if (a.spot) { this.x = a.spot.x * IS.TILE + 12; this.y = a.spot.y * IS.TILE + 18; }
    if (a.def.start) a.def.start(this, a, c);
  }

  updateFollow(a, dt, c) {
    const o = a.follow;
    const ok = a.care ? (o.sick && o.mode === 'normal') : o.canBeVisited(this);
    if (!ok) { this.cancelAction(); this.idleUntil = c.abs + 2; return; }
    const d = IS.dist(this.x, this.y, o.x, o.y);
    if (d <= IS.TILE * (a.near ? 3.2 : 1.6)) {
      this.faceToward(o.x, o.y);
      const started = IS.Social.start(this.sim, this, o, a.care ? { topic: 'sickVisit', stationaryB: true } : a.topic ? { topic: a.topic, forced: true } : { forced: true });
      if (started) { this.finishAction(c); return; }
      this.pose = 'stand';
      a.wait = (a.wait || 0) + dt;
      if (a.wait > (a.forced ? 45 : 15)) { this.cancelAction(); this.idleUntil = c.abs + 5; }
      return;
    }
    a.repath -= dt;
    if (a.repath <= 0 || !this.path.length) {
      a.repath = 1.5;
      // Stand next to them; if that's blocked (crops, furniture), get as close as possible
      let path = null;
      for (const reach of [1, 2, 3]) {
        const goal = this.world.findNear(o.tx, o.ty, (x, y) => this.world.walkable(x, y) && !(x === o.tx && y === o.ty) && Math.abs(x - o.tx) + Math.abs(y - o.ty) <= reach, reach + 1);
        if (goal) path = this.world.findPath(this.tx, this.ty, goal.x, goal.y);
        if (path) { a.near = reach > 1; break; }
      }
      if (path === null) { this.cancelAction(); this.failUntil.socialize = c.abs + 30; return; }
      this.path = path;
    }
    if (this.path.length) this.moveAlong(dt); else this.pose = 'stand';
    a.elapsed += dt;
    if (a.elapsed > 90) this.cancelAction();
  }

  speedTiles() {
    let s = 2.6 + this.traits.energetic * 0.8;
    if (this.sick) s *= 0.6;
    if (this.isWaterHere()) s = 1.3;
    return s;
  }

  moveAlong(dt) {
    const T = IS.TILE;
    let remaining = this.speedTiles() * T * dt;
    let moved = 0;
    while (remaining > 0 && this.path.length) {
      const n = this.path[0];
      const tx = n.x * T + 12, ty = n.y * T + 18;
      const dx = tx - this.x, dy = ty - this.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.01) this.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      if (d <= remaining) {
        this.x = tx; this.y = ty; remaining -= d; moved += d;
        this.path.shift();
      } else {
        this.x += (dx / d) * remaining; this.y += (dy / d) * remaining; moved += remaining; remaining = 0;
      }
    }
    this.anim += moved;
    this.pose = this.isWaterHere() ? 'swim' : 'walk';
  }

  faceToward(x, y) {
    const dx = x - this.x, dy = y - this.y;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
    this.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  }

  // Fishing line end point
  bobberX() { return this.x + ({ left: -34, right: 34, down: 0, up: 0 }[this.dir]); }
  bobberY() { return this.y + ({ left: 6, right: 6, down: 30, up: -8 }[this.dir]); }

  // ---------------------------------------------------------------- Sky Hand
  grab() {
    if (this.chat) this.chat.abort(this);
    this.cancelAction();
    this.mode = 'carried';
    this.pose = 'carry';
    this.z = 26;
    this.swing = 0;
    this.grabCount++;
    this.talkTimer = 0.4;
    const t = this.traits;
    const delta = t.brave > 0.65 ? 3 : t.grumpy > 0.55 ? -5 : -1;
    this.skyOpinion = IS.clamp(this.skyOpinion + delta, -100, 100);
    this.emote(t.brave > 0.65 ? 'sparkle' : 'exclaim', 1.5);
    this.say(this.grabLine());
    if (this.grabCount === 1) this.sim.log(`The Sky Hand picked up ${this.name}!`, 'sky', [this]);
    this.sim.onGrab(this);
  }
  grabLine() {
    const t = this.traits;
    if (this.grabCount > 3 && Math.random() < 0.5) return IS.pick(t.brave > 0.6 ? ['Again?! YES!', 'I\'m getting used to this.', 'Frequent flyer, coming through!'] : ['Not again...', 'Seriously?! AGAIN?', 'Why is it always me?!']);
    if (t.brave > 0.65) return IS.pick(['Wheeee!', 'Higher! HIGHER!', 'Am I... flying?!', 'Best. Day. Ever.']);
    if (t.grumpy > 0.55) return IS.pick(['Put me DOWN!', 'Hey! HEY!', 'Unhand me, you giant... hand!', 'I have WORK to do!']);
    if (t.kind > 0.6) return IS.pick(['Oh my! Oh my my my!', 'Please be gentle...', 'Is that you, Sky Hand?']);
    return IS.pick(['Whoa whoa whoa!', 'AAAAH!', 'What is happening?!']);
  }
  carriedTalk(rdt) {
    this.talkTimer -= rdt;
    if (this.talkTimer <= 0 && (!this.bubble || this.bubble.until < performance.now())) {
      this.talkTimer = IS.rand(3, 6);
      if (Math.random() < 0.6) this.say(this.grabLine(), 2.4);
    }
  }
  dragTo(wx, wy, mvx) {
    this.x = IS.clamp(wx, 8, this.world.pxW - 8);
    this.y = IS.clamp(wy, 30, this.world.pxH - 4);
    this.swing = IS.lerp(this.swing, IS.clamp(-mvx * 0.0012, -0.7, 0.7), 0.25);
  }
  release(vx, vy) {
    this.mode = 'air';
    const sp = Math.hypot(vx, vy);
    const k = sp > 900 ? 900 / sp : 1;
    this.vx = vx * k; this.vy = vy * k;
    this.vz = 40 + Math.min(260, sp * 0.22);
    this.bounces = 0;
    this.hardLanding = false;
    this.thrown = sp > 350;
  }
  updateAir(rdt, c) {
    this.vz -= 1100 * rdt;
    this.x += this.vx * rdt; this.y += this.vy * rdt; this.z += this.vz * rdt;
    this.swing *= 0.95;
    const W = this.world.pxW, H = this.world.pxH;
    if (this.x < 8 || this.x > W - 8) { this.vx = -this.vx * 0.5; this.x = IS.clamp(this.x, 8, W - 8); }
    if (this.y < 30 || this.y > H - 4) { this.vy = -this.vy * 0.5; this.y = IS.clamp(this.y, 30, H - 4); }
    if (this.z <= 0) {
      const impact = -this.vz;
      this.z = 0;
      const water = this.isWaterHere();
      if (!water && impact > 380 && this.bounces < 2) {
        this.vz = impact * 0.35; this.vx *= 0.45; this.vy *= 0.45; this.bounces++;
        this.hardLanding = true;
        this.sim.fx.dust(this.x, this.y);
        return;
      }
      this.land(c, impact);
    }
  }
  land(c, impact) {
    const t = this.traits;
    this.swing = 0;
    this.pose = 'stand';
    if (this.isWaterHere()) {
      this.sim.fx.splash(this.x, this.y, 14);
      this.mode = 'swim';
      const goal = this.world.findNear(this.tx, this.ty, (x, y) => this.world.walkable(x, y) && this.world.reach[this.world.idx(x, y)] === 1, 60);
      this.swimTarget = goal;
      this.wetUntil = c.abs + 60;
      this.skyOpinion = IS.clamp(this.skyOpinion + (t.brave > 0.7 ? 1 : -6), -100, 100);
      this.say(IS.pick(t.brave > 0.7 ? ['*splash* Refreshing!', 'Cannonball!!', 'Again! Again!'] : ['*splash* BLEH!', 'The water is COLD!', 'Why the SEA?!', '*glub glub*']));
      this.emote(t.brave > 0.7 ? 'note' : 'sweat', 2);
      this.remember('Got dropped in the sea by the Sky Hand', { tag: 'sea', mood: t.brave > 0.7 ? 6 : -12, news: true });
      this.sim.log(`${this.name} got dunked in the sea!`, 'sky', [this]);
      IS.Mind.rally(this.sim, this);
      return;
    }
    if (!this.world.walkable(this.tx, this.ty)) {
      const goal = this.world.nearestWalkable(this.tx, this.ty);
      this.mode = 'hop';
      this.hop = { fx: this.x, fy: this.y, tx: goal.x * IS.TILE + 12, ty: goal.y * IS.TILE + 18, t: 0 };
      return;
    }
    this.afterLanding(c);
  }
  updateHop(rdt, c) {
    const h = this.hop;
    h.t = Math.min(1, h.t + rdt * 3);
    this.x = IS.lerp(h.fx, h.tx, h.t);
    this.y = IS.lerp(h.fy, h.ty, h.t);
    this.z = Math.sin(h.t * Math.PI) * 14;
    if (h.t >= 1) { this.z = 0; this.afterLanding(c); }
  }
  afterLanding(c) {
    const t = this.traits;
    this.mode = 'recover';
    this.recoverUntil = c.abs + IS.rand(2, 4);
    this.sim.fx.dust(this.x, this.y);
    if (this.hardLanding || this.thrown) {
      this.emote('dizzy', 2.2);
      this.say(IS.pick(t.brave > 0.65 ? ['Again! AGAIN!', 'That was AMAZING!', 'Ten out of ten.'] : ['Ow...', 'My everything hurts.', 'The world is spinning...']));
      this.skyOpinion = IS.clamp(this.skyOpinion + (t.brave > 0.65 ? 2 : -4), -100, 100);
      this.remember('Got thrown across the island by the Sky Hand', { tag: 'grabbed', mood: t.brave > 0.65 ? 8 : -10, news: true });
      IS.Mind.rally(this.sim, this);
    } else {
      this.say(IS.pick(['...where am I?', 'Huh. That was weird.', 'Okay. Back to it, I guess.', 'Did that just happen?']));
      this.skyOpinion = IS.clamp(this.skyOpinion + 1, -100, 100);
      this.remember('Got carried around by the Sky Hand', { tag: 'grabbed', mood: t.brave > 0.65 ? 5 : -3, news: true });
    }
  }
  updateSwim(dt, c) {
    const T = IS.TILE;
    const g = this.swimTarget;
    const tx = g.x * T + 12, ty = g.y * T + 18;
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    const step = 1.5 * T * dt;
    this.pose = this.isWaterHere() ? 'swim' : 'walk';
    this.faceToward(tx, ty);
    this.anim += Math.min(d, step);
    if (d <= step) {
      this.x = tx; this.y = ty;
      this.mode = 'recover';
      this.recoverUntil = c.abs + 2;
      this.pose = 'stand';
      this.emote('sweat', 1.5);
      this.say(IS.pick(['Made it...', '*pant pant*', 'Land! Sweet land!']));
    } else {
      this.x += (dx / d) * step; this.y += (dy / d) * step;
      if (Math.random() < dt * 0.8) this.sim.fx.ripple(this.x, this.y);
    }
  }
};
