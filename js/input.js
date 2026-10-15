// Mouse / touch / keyboard. Click a person to inspect them, press and hold
// (or drag) to pick them up with the Sky Hand, flick to throw.
IS.Input = class {
  constructor(sim, canvas) {
    this.sim = sim;
    this.canvas = canvas;
    this.keys = new Set();
    this.press = null;
    this.trail = [];
    canvas.addEventListener('pointerdown', e => this.down(e));
    window.addEventListener('pointermove', e => this.move(e));
    window.addEventListener('pointerup', e => this.up(e));
    window.addEventListener('pointercancel', e => this.up(e));
    canvas.addEventListener('wheel', e => { e.preventDefault(); this.sim.zoomBy(e.deltaY < 0 ? 1 : -1, e.clientX, e.clientY); }, { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown', e => this.key(e, true));
    window.addEventListener('keyup', e => this.key(e, false));
  }

  toWorld(cx, cy) {
    const r = this.sim.renderer;
    const rect = this.canvas.getBoundingClientRect();
    const z = this.sim.cam.zoom;
    return { x: (cx - rect.left) / z + r.ox, y: (cy - rect.top) / z + r.oy };
  }

  personAt(wx, wy) {
    let best = null;
    for (const p of this.sim.people) {
      if (p.mode === 'carried') continue;
      if (p.building && p.building.cut < 0.3 && p.mode === 'normal') continue;
      const top = p.pose === 'sleep' ? p.y - 30 : p.y - p.z - 32;
      const bottom = p.pose === 'sleep' ? p.y + 20 : p.y - p.z + 2;
      if (wx >= p.x - 10 && wx <= p.x + 10 && wy >= top && wy <= bottom) {
        if (!best || p.y > best.y) best = p;
      }
    }
    return best;
  }

  down(e) {
    if (e.button === 2 || e.button === 1) { this.press = { pan: true, cx: e.clientX, cy: e.clientY, camX: this.sim.cam.x, camY: this.sim.cam.y }; return; }
    const w = this.toWorld(e.clientX, e.clientY);
    this.sim.hoverWorld = w;
    const p = this.personAt(w.x, w.y);
    this.canvas.setPointerCapture?.(e.pointerId);
    if (p) {
      this.press = { person: p, cx: e.clientX, cy: e.clientY, t: performance.now(), grabbed: false };
    } else {
      this.press = { pan: true, cx: e.clientX, cy: e.clientY, camX: this.sim.cam.x, camY: this.sim.cam.y, moved: false };
    }
  }

  move(e) {
    const sim = this.sim;
    const w = this.toWorld(e.clientX, e.clientY);
    sim.hoverWorld = w;
    sim.hover = this.press && this.press.grabbed ? this.press.person : this.personAt(w.x, w.y);
    const pr = this.press;
    if (!pr) { this.canvas.style.cursor = sim.hover ? 'grab' : 'default'; return; }
    if (pr.pan) {
      const z = sim.cam.zoom;
      const dx = e.clientX - pr.cx, dy = e.clientY - pr.cy;
      if (Math.abs(dx) + Math.abs(dy) > 4) { pr.moved = true; sim.follow = false; sim.ui.syncToggles(); }
      sim.cam.x = pr.camX - dx / z;
      sim.cam.y = pr.camY - dy / z;
      this.canvas.style.cursor = 'move';
      return;
    }
    if (!pr.grabbed && Math.hypot(e.clientX - pr.cx, e.clientY - pr.cy) > 5) this.startGrab();
    if (pr.grabbed) this.drag(w);
  }

  startGrab() {
    const pr = this.press;
    pr.grabbed = true;
    this.trail = [];
    pr.person.grab();
    this.canvas.style.cursor = 'grabbing';
  }

  drag(w) {
    const now = performance.now();
    this.trail.push({ x: w.x, y: w.y, t: now });
    while (this.trail.length > 2 && now - this.trail[0].t > 90) this.trail.shift();
    let vx = 0;
    if (this.trail.length > 1) {
      const a = this.trail[0], b = this.trail[this.trail.length - 1];
      vx = (b.x - a.x) / Math.max(0.016, (b.t - a.t) / 1000);
    }
    this.press.person.dragTo(w.x, w.y, vx);
  }

  up(e) {
    const pr = this.press;
    this.press = null;
    if (!pr) return;
    const sim = this.sim;
    if (pr.pan) {
      if (!pr.moved && e.type === 'pointerup' && e.button === 0) sim.select(null);
      this.canvas.style.cursor = 'default';
      return;
    }
    if (pr.grabbed) {
      const now = performance.now();
      const pts = this.trail.filter(p => now - p.t < 100);
      let vx = 0, vy = 0;
      if (pts.length > 1) {
        const a = pts[0], b = pts[pts.length - 1];
        const dt = Math.max(0.016, (b.t - a.t) / 1000);
        vx = (b.x - a.x) / dt; vy = (b.y - a.y) / dt;
      }
      pr.person.release(vx, vy);
      this.canvas.style.cursor = 'grab';
      return;
    }
    // Quick click on a person: inspect
    sim.select(pr.person);
  }

  key(e, isDown) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const k = e.key.toLowerCase();
    if (isDown) this.keys.add(k); else this.keys.delete(k);
    if (!isDown) return;
    const sim = this.sim;
    if (k === ' ') { e.preventDefault(); sim.setSpeed(sim.speedIdx === 0 ? (sim.lastSpeed || 1) : 0); }
    if (k >= '1' && k <= '5') sim.setSpeed(+k - 1);
    if (k === 'r') { sim.xray = !sim.xray; sim.ui.syncToggles(); }
    if (k === 'n') { sim.ui.showNames = !sim.ui.showNames; sim.ui.syncToggles(); }
    if (k === 'l') { const l = document.getElementById('log'); l.hidden = !l.hidden; sim.ui.syncToggles(); }
    if (k === 'f' && sim.selected) { sim.follow = !sim.follow; sim.ui.syncToggles(); }
    if (k === 'escape') sim.select(null);
    if (k === '+' || k === '=') sim.zoomBy(1);
    if (k === '-') sim.zoomBy(-1);
    if (k === 'tab') {
      e.preventDefault();
      const ppl = sim.people;
      const i = sim.selected ? ppl.indexOf(sim.selected) : -1;
      sim.select(ppl[(i + 1) % ppl.length]); sim.follow = true; sim.ui.syncToggles();
    }
  }

  update(rdt) {
    const sim = this.sim;
    const sp = 260 * rdt;
    let dx = 0, dy = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) dx -= sp;
    if (this.keys.has('d') || this.keys.has('arrowright')) dx += sp;
    if (this.keys.has('w') || this.keys.has('arrowup')) dy -= sp;
    if (this.keys.has('s') || this.keys.has('arrowdown')) dy += sp;
    if (dx || dy) { sim.cam.x += dx; sim.cam.y += dy; if (sim.follow) { sim.follow = false; sim.ui.syncToggles(); } }
    // Press and hold also picks someone up
    const pr = this.press;
    if (pr && pr.person && !pr.grabbed && performance.now() - pr.t > 220) {
      this.startGrab();
      if (sim.hoverWorld) this.drag(sim.hoverWorld);
    }
  }
};
