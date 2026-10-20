// Sound, all made on the fly with Web Audio: no files to load.
// Ambience (sea, wind, rain, birds by day, crickets at night), a soft generative tune,
// and little effects for the god powers, events, splashes and the interface.
// Browsers only allow sound after a click or key press, so nothing starts before that.
IS.Audio = (() => {
  const A = {};
  let ac = null, sim = null, verb = null;
  const bus = {}, loops = {};
  A.bus = bus; A.ctx = () => ac;
  const LEVEL = [0, 0.3, 0.65, 1];
  const level = k => LEVEL[IS.Settings.get(k) ?? 2] ?? 0.65;

  const noise = (kind, sec = 4) => {
    const n = ac.sampleRate * sec, buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
    let b = 0, p0 = 0, p1 = 0, p2 = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') { b = (b + 0.02 * w) / 1.02; d[i] = b * 3.5; }
      else if (kind === 'pink') { p0 = 0.997 * p0 + 0.03 * w; p1 = 0.985 * p1 + 0.03 * w; p2 = 0.95 * p2 + 0.1 * w; d[i] = (p0 + p1 + p2 + w * 0.05) * 1.6; }
      else d[i] = w;
    }
    return buf;
  };
  const filt = (type, f, q = 0.7) => { const x = ac.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; return x; };
  const gain = v => { const g = ac.createGain(); g.gain.value = v; return g; };
  const chain = (...n) => { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; };
  const loop = (buf, ...nodes) => {
    const s = ac.createBufferSource(); s.buffer = buf; s.loop = true;
    const g = gain(0);
    chain(s, ...nodes, g, bus.amb); s.start();
    return g;
  };
  const set = (g, v, tc = 0.4) => g.gain.setTargetAtTime(v, ac.currentTime, tc);

  // A short sound: osc of a type gliding f0 -> f1, with an attack/decay envelope
  const tone = (out, type, f0, f1, t, dur, vol, atk = 0.005) => {
    const o = ac.createOscillator(), g = gain(0);
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + atk); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
    return g;
  };
  const burst = (out, buf, type, f, t, dur, vol, q = 0.8, fEnd) => {
    const s = ac.createBufferSource(); s.buffer = buf;
    const fl = filt(type, f, q), g = gain(0);
    if (fEnd) fl.frequency.exponentialRampToValueAtTime(fEnd, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    chain(s, fl, g, out); s.start(t, Math.random() * 2); s.stop(t + dur + 0.05);
  };

  const build = () => {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ac.createDynamicsCompressor();
    bus.master = gain(1); chain(bus.master, comp, ac.destination);
    for (const k of ['amb', 'sfx', 'mus']) { bus[k] = gain(0); bus[k].connect(bus.master); }
    // A small hall reverb from decaying noise, for music, bells and magic
    verb = ac.createConvolver();
    const n = ac.sampleRate * 2.6, ir = ac.createBuffer(2, n, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3); }
    verb.buffer = ir; bus.verb = gain(0.35); chain(bus.verb, verb, bus.master);
    bus.white = noise('white'); bus.brown = noise('brown'); bus.pink = noise('pink');
    loops.sea = loop(bus.brown, filt('lowpass', 520));
    loops.surf = loop(bus.pink, filt('bandpass', 900, 0.6));
    loops.wind = loop(bus.pink, filt('bandpass', 420, 0.9));
    loops.rain = loop(bus.white, filt('highpass', 1400), filt('lowpass', 7000));
    loops.fire = loop(bus.white, filt('bandpass', 2600, 1.2));
    A.levels();
  };

  A.levels = () => {
    if (!ac) return;
    set(bus.amb, 1.3 * level('sound'), 0.2); set(bus.sfx, 0.9 * level('sound'), 0.2); set(bus.mus, 0.55 * level('music'), 0.3);
  };

  A.init = s => {
    sim = s;
    const go = () => { try { if (!ac) build(); if (ac.state === 'suspended') ac.resume(); } catch (e) { /* no audio here */ } };
    for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, go, { passive: true });
    document.addEventListener('visibilitychange', () => { if (!ac) return; if (document.hidden) ac.suspend(); else ac.resume(); });
    // Little hooks into the rest of the game
    document.addEventListener('click', e => { if (e.target.closest('button')) A.click(); }, true);
    const toast = s.ui.toast.bind(s.ui);
    s.ui.toast = text => { A.chime(); return toast(text); };
    const start = s.events.startEvent.bind(s.events);
    s.events.startEvent = ev => { const r = start(ev); if (ev.state === 'active') A.bell(); return r; };
    const splash = s.fx.splash.bind(s.fx);
    s.fx.splash = (...a) => { A.splash(); return splash(...a); };
  };

  const ready = () => ac && ac.state === 'running';
  const lim = {};
  const rate = (k, sec) => { const t = performance.now(); if (lim[k] && t - lim[k] < sec * 1000) return false; lim[k] = t; return true; };

  A.click = () => { if (ready() && rate('click', 0.05)) tone(bus.sfx, 'triangle', 1500, 1100, ac.currentTime, 0.05, 0.05); };
  A.chime = () => {
    if (!ready() || !rate('chime', 0.6)) return;
    const t = ac.currentTime;
    tone(bus.sfx, 'sine', 1046, 1046, t, 0.5, 0.05); tone(bus.sfx, 'sine', 1568, 1568, t + 0.08, 0.6, 0.04);
  };
  A.shutter = () => { if (ready()) { const t = ac.currentTime; burst(bus.sfx, bus.white, 'highpass', 3000, t, 0.05, 0.3); burst(bus.sfx, bus.white, 'bandpass', 2000, t + 0.09, 0.07, 0.25, 1.5); } };
  A.splash = () => { if (ready() && rate('splash', 0.15)) burst(bus.sfx, bus.white, 'bandpass', 1400, ac.currentTime, 0.45, 0.25, 0.7, 500); };
  // The Hall's bell: inharmonic partials, three strikes
  A.bell = () => {
    if (!ready() || !rate('bell', 3)) return;
    for (let k = 0; k < 3; k++) {
      const t = ac.currentTime + k * 1.3;
      for (const [m, v] of [[1, 0.09], [2, 0.05], [2.4, 0.035], [3, 0.03], [4.2, 0.02]]) {
        const g = tone(bus.sfx, 'sine', 392 * m, 392 * m, t, 3.2 / Math.sqrt(m), v, 0.003);
        g.connect(bus.verb);
      }
    }
  };
  A.thunder = (near) => {
    if (!ready()) return;
    const t = ac.currentTime + (near ? 0 : 0.3 + Math.random() * 1.2);
    if (near) burst(bus.sfx, bus.white, 'highpass', 1800, t, 0.25, 0.5, 0.5);
    burst(bus.sfx, bus.brown, 'lowpass', near ? 900 : 400, t + 0.02, 3.4, near ? 0.9 : 0.6, 0.6, 60);
  };
  A.boom = () => {
    if (!ready()) return;
    const t = ac.currentTime;
    tone(bus.sfx, 'sine', 120, 35, t, 1.2, 0.6);
    burst(bus.sfx, bus.brown, 'lowpass', 1600, t, 2.2, 1, 0.5, 80);
  };
  A.whistle = () => { if (ready()) { const t = ac.currentTime; tone(bus.sfx, 'sine', 2200, 280, t, 1.1, 0.06, 0.4); burst(bus.sfx, bus.pink, 'bandpass', 3000, t, 1.1, 0.12, 2, 600); } };
  A.magic = (big) => {
    if (!ready() || !rate('magic', 0.3)) return;
    const t = ac.currentTime, notes = big ? [523, 659, 784, 1046, 1318, 1568] : [784, 988, 1175, 1568];
    notes.forEach((f, i) => tone(bus.sfx, 'sine', f, f, t + i * 0.07, 1.4, 0.05).connect(bus.verb));
  };
  A.ghost = () => { if (ready()) { const t = ac.currentTime; for (const d of [0, 7]) tone(bus.sfx, 'sine', 330 + d, 220 + d, t, 2.6, 0.05, 0.6).connect(bus.verb); } };

  // Voices: a quick babble of syllables when someone on screen speaks. Everyone has their own pitch.
  const voice = p => {
    if (!p._voice) {
      let h = 0; for (const c of p.name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
      const low = p.cfg.pronoun === 'he';
      p._voice = { f: (low ? 150 : 250) + (h % 90), wave: ['square', 'triangle', 'sawtooth'][h % 3], speed: 0.065 + (h % 5) * 0.006 };
    }
    return p._voice;
  };
  const babble = (p, text) => {
    const v = voice(p), t0 = ac.currentTime, n = IS.clamp(Math.round(text.length / 4), 2, 10);
    const ask = /\?\s*$/.test(text), shout = /!\s*$/.test(text);
    for (let i = 0; i < n; i++) {
      const t = t0 + i * v.speed * (0.85 + Math.random() * 0.3), last = i === n - 1;
      const f = v.f * (1 + (Math.random() - 0.5) * 0.35) * (last && ask ? 1.35 : 1) * (shout ? 1.12 : 1);
      const o = ac.createOscillator(), g = gain(0), bp = filt('bandpass', 700 + Math.random() * 1300, 2.2);
      o.type = v.wave; o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * (last && ask ? 1.25 : 0.93), t + v.speed);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(shout ? 0.11 : 0.08, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + v.speed * 0.9);
      chain(o, bp, g, bus.sfx); o.start(t); o.stop(t + v.speed);
    }
  };
  let lastTalk = 0;
  const voices = () => {
    if (sim.cam.zoom < 2 || sim.speedValue() > 5 || sim.menuOpen) return;
    const r = sim.renderer, now = performance.now();
    for (const p of sim.people) {
      const b = p.bubble;
      if (!b || b.id === p._heard) continue;
      p._heard = b.id;
      if (now - lastTalk < 220 || (p.building && p.building.cut < 0.5)) continue;
      const s = IS.Iso.w2s(p.x, p.y);
      if (s.x < r.ox || s.x > r.ox + r.vw || s.y < r.oy || s.y > r.oy + r.vh + 30) continue;
      lastTalk = now;
      babble(p, b.text || '');
    }
  };

  // Birds: a few quick rising/falling chirps
  const bird = () => {
    const t = ac.currentTime, base = 2200 + Math.random() * 1800, n = 2 + Math.floor(Math.random() * 4), up = Math.random() < 0.5;
    for (let i = 0; i < n; i++) {
      const f = base * (1 + (Math.random() - 0.5) * 0.2);
      tone(bus.amb, 'sine', up ? f * 0.8 : f * 1.25, up ? f * 1.25 : f * 0.8, t + i * (0.09 + Math.random() * 0.05), 0.07, 0.03);
    }
  };
  const cricket = () => {
    const t = ac.currentTime, f = 4200 + Math.random() * 600;
    for (let i = 0; i < 3; i++) tone(bus.amb, 'sine', f, f, t + i * 0.045, 0.03, 0.012, 0.004);
  };
  const gull = () => { const t = ac.currentTime; for (let i = 0; i < 2; i++) tone(bus.amb, 'sawtooth', 1300, 900, t + i * 0.28, 0.25, 0.006, 0.03); };

  // ------------------------------------------------------------ the tune
  // Gentle plucks over a slow chord loop: brighter by day, sparser and lower at night.
  const M = { next: 0, step: 0, chord: 0 };
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  const DAY = [[60, 64, 67, 72], [57, 60, 64, 69], [53, 57, 60, 65], [55, 59, 62, 67]]; // C Am F G
  const NIGHT = [[57, 60, 64, 69], [53, 57, 60, 65], [60, 64, 67, 72], [55, 59, 62, 67]]; // Am F C G
  const PENTA = [0, 2, 4, 7, 9];
  const pluck = (f, t, v, dur = 1.6) => {
    const o = ac.createOscillator(), o2 = ac.createOscillator(), g = gain(0), lp = filt('lowpass', 2400);
    o.type = 'triangle'; o2.type = 'sine'; o.frequency.value = f; o2.frequency.value = f * 2.001;
    const g2 = gain(0.25); o2.connect(g2); g2.connect(lp);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(g); g.connect(bus.mus); g.connect(bus.verb);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  };
  const pad = (notes, t, dur, v) => {
    for (const n of notes) for (const det of [-4, 4]) {
      const o = ac.createOscillator(), g = gain(0);
      o.type = 'sine'; o.frequency.value = midi(n - 12); o.detune.value = det;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + dur * 0.4); g.gain.linearRampToValueAtTime(0, t + dur);
      o.connect(g); g.connect(bus.mus); o.start(t); o.stop(t + dur + 0.05);
    }
  };
  const music = () => {
    const min = sim.clock.min, night = min < 6 * 60 || min >= 20 * 60;
    const beat = night ? 0.46 : 0.36; // seconds per eighth note
    if (M.next < ac.currentTime) M.next = ac.currentTime + 0.1;
    while (M.next < ac.currentTime + 0.3) {
      const t = M.next, bar = Math.floor(M.step / 8), inBar = M.step % 8;
      const prog = night ? NIGHT : DAY, chord = prog[Math.floor(bar / 2) % 4];
      if (inBar === 0 && bar % 2 === 0) { pad(chord.slice(0, 3), t, beat * 16, night ? 0.018 : 0.014); pluck(midi(chord[0] - 24), t, 0.09, 2.4); }
      const restP = night ? 0.62 : 0.45;
      if (Math.random() > restP || inBar === 0) {
        const root = chord[0], useChord = inBar % 4 === 0 || Math.random() < 0.5;
        const n = useChord ? IS.pick(chord) : root + IS.pick(PENTA) + (Math.random() < 0.3 ? 12 : 0);
        pluck(midi(n + (night ? 0 : 12)), t, night ? 0.06 : 0.07);
      }
      M.step++; M.next += beat * (inBar % 2 ? 0.92 : 1.08); // a little swing
    }
  };

  // Called every frame: ambience levels follow the weather, time and zoom
  let tick = 0, lastFlash = 0;
  A.update = rdt => {
    if (!ready() || !sim) return;
    const t = ac.currentTime, min = sim.clock.min, w = sim.weather, rain = w === 'rain' ? 1 : w === 'storm' ? 1.6 : 0;
    const day = min > 5.5 * 60 && min < 20 * 60, night = !day;
    // weather and fire are checked a few times a second, birds and crickets roll their dice every frame
    if ((tick += rdt) > 0.2) {
      tick = 0;
      const zoomOut = IS.clamp((5 - sim.cam.zoom) / 3, 0.3, 1);
      set(loops.sea, (0.16 + 0.07 * Math.sin(t * 0.7) + rain * 0.03) * zoomOut, 0.6);
      set(loops.surf, (0.035 + 0.035 * Math.max(0, Math.sin(t * 0.7 - 0.6))) * zoomOut, 0.3);
      set(loops.wind, 0.035 + 0.02 * Math.sin(t * 0.13) + (w === 'storm' ? 0.22 : w === 'rain' ? 0.06 : 0), 1);
      set(loops.rain, rain * 0.1, 1.5);
      set(loops.fire, sim.people.some(p => p.burning) || (sim.world.bonfire && sim.world.bonfire.lit) ? 0.035 + Math.random() * 0.04 : 0, 0.05);
      A.levels();
    }
    if (!rain && day && Math.random() < rdt * (min < 10 * 60 ? 0.9 : 0.35)) bird();
    if (!rain && day && Math.random() < rdt * 0.05) gull();
    if (w !== 'storm' && night && Math.random() < rdt * 1.6) cricket();
    // thunder follows the storm's flashes
    const fl = sim.renderer.flash || 0;
    if (fl > lastFlash + 0.5) A.thunder(false);
    lastFlash = fl;
    // god powers: each new effect plays once
    for (const f of sim.godFx) {
      if (f.snd) continue;
      f.snd = true;
      if (f.kind === 'bolt') A.thunder(true);
      else if (f.kind === 'meteor') A.whistle();
      else if (f.kind === 'boom') A.boom();
      else if (f.kind === 'beam') A.magic(!!f.grave);
      else if (f.kind === 'ghost') A.ghost();
    }
    voices();
    if (level('music') > 0) music();
  };

  return A;
})();
