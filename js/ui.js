IS.UI = class {
  constructor(sim) {
    this.sim = sim;
    this.$ = id => document.getElementById(id);
    this.bubbleEls = new Map();
    this.tagEls = new Map();
    this.lastPanel = 0;
    this.showNames = true;
    this.tab = 'now';
    this.makeIcons();
    this.buildRoster();
    this.bind();
    this.renderLog();
  }

  // Small pixel icons for the HUD, drawn in the same style as the game art
  makeIcons() {
    const px = IS.Sprites.px;
    const icon = draw => { const { c, g } = IS.makeCanvas(8, 8); draw(g); return c.toDataURL(); };
    this.icons = {
      food: icon(g => { px(g, 3, 0, 4, 4, '#e8913a'); px(g, 2, 1, 5, 3, '#e8913a'); px(g, 3, 1, 2, 1, '#ffc078'); px(g, 2, 4, 2, 2, '#f4efe6'); px(g, 1, 6, 2, 2, '#f4efe6'); }),
      wood: icon(g => { px(g, 0, 2, 8, 4, '#a8763f'); px(g, 0, 2, 8, 1, '#c4935a'); px(g, 0, 2, 2, 4, '#d9b77e'); px(g, 0, 3, 1, 2, '#a8763f'); }),
      lantern: icon(g => { px(g, 3, 0, 2, 1, '#6b5a7a'); px(g, 2, 1, 4, 6, '#ffc96b'); px(g, 3, 2, 2, 3, '#fff3d0'); px(g, 2, 7, 4, 1, '#6b5a7a'); }),
    };
    this.$('ico-food').src = this.icons.food;
    this.$('ico-wood').src = this.icons.wood;
  }

  bind() {
    const sim = this.sim;
    document.querySelectorAll('[data-speed]').forEach(b => b.addEventListener('click', () => sim.setSpeed(+b.dataset.speed)));
    this.$('btn-roofs').addEventListener('click', () => { sim.xray = !sim.xray; this.syncToggles(); });
    this.$('btn-names').addEventListener('click', () => { this.showNames = !this.showNames; this.syncToggles(); });
    this.$('btn-log').addEventListener('click', () => { this.$('log').hidden = !this.$('log').hidden; this.syncToggles(); });
    this.$('btn-help').addEventListener('click', () => { this.$('help').hidden = !this.$('help').hidden; });
    this.$('help-close').addEventListener('click', () => { this.$('help').hidden = true; });
    this.$('zoom-in').addEventListener('click', () => sim.zoomBy(1));
    this.$('zoom-out').addEventListener('click', () => sim.zoomBy(-1));
    this.$('insp-close').addEventListener('click', () => sim.select(null));
    this.$('insp-follow').addEventListener('click', () => { sim.follow = !sim.follow; this.syncToggles(); });
    document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { this.tab = b.dataset.tab; this.syncToggles(); this.inspector(); }));
    this.$('log-list').addEventListener('click', e => {
      const li = e.target.closest('[data-who]');
      if (!li) return;
      const p = sim.byName(li.dataset.who);
      if (p) { sim.select(p); sim.follow = true; this.syncToggles(); }
    });
    this.$('insp-body').addEventListener('click', e => {
      const row = e.target.closest('[data-person]');
      if (!row) return;
      const p = sim.byName(row.dataset.person);
      if (p) { sim.select(p); sim.follow = true; this.syncToggles(); }
    });
    if (window.innerWidth < 760) this.$('log').hidden = true;
    this.syncToggles();
  }

  syncToggles() {
    const sim = this.sim;
    this.$('btn-roofs').setAttribute('aria-pressed', sim.xray);
    this.$('btn-names').setAttribute('aria-pressed', this.showNames);
    this.$('btn-log').setAttribute('aria-pressed', !this.$('log').hidden);
    this.$('insp-follow').setAttribute('aria-pressed', sim.follow);
    this.$('insp-follow').textContent = sim.follow ? 'Following' : 'Follow';
    document.querySelectorAll('[data-speed]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.speed === sim.speedIdx));
    document.querySelectorAll('[data-tab]').forEach(b => { const on = b.dataset.tab === this.tab; b.setAttribute('aria-pressed', on); b.setAttribute('aria-selected', on); });
  }

  buildRoster() {
    const el = this.$('roster');
    el.innerHTML = '';
    for (const p of this.sim.people) {
      const b = document.createElement('button');
      b.className = 'token';
      b.id = 'chip-' + p.id;
      b.title = `${p.name}: click to follow`;
      b.innerHTML = `<span class="ring" id="chip-ring-${p.id}"><img src="${p.portrait}" alt=""></span><b>${p.name}</b><small id="chip-act-${p.id}">Sleeping</small>`;
      b.addEventListener('click', () => {
        if (this.sim.selected === p) { this.sim.follow = !this.sim.follow; }
        else { this.sim.select(p); this.sim.follow = true; }
        this.syncToggles();
      });
      el.appendChild(b);
    }
  }

  toast(text) {
    const wrap = this.$('toasts');
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<img src="${this.icons.lantern}" alt=""><span></span>`;
    t.querySelector('span').textContent = text;
    wrap.appendChild(t);
    while (wrap.children.length > 3) wrap.firstChild.remove();
    setTimeout(() => t.classList.add('out'), 4200);
    setTimeout(() => t.remove(), 4800);
  }

  addLog(entry) {
    const list = this.$('log-list');
    const li = document.createElement('li');
    li.className = 'log-' + entry.kind;
    if (entry.people.length) li.dataset.who = entry.people[0];
    li.innerHTML = `<time>${entry.when}</time><span></span>`;
    li.querySelector('span').textContent = entry.text;
    list.prepend(li);
    while (list.children.length > 80) list.lastChild.remove();
  }
  renderLog() { this.$('log-list').innerHTML = ''; for (const e of this.sim.logEntries) this.addLog(e); }

  // Called every animation frame: speech bubbles and name tags follow people
  frame(now) {
    const sim = this.sim, r = sim.renderer, z = sim.cam.zoom;
    for (const p of sim.people) {
      let el = this.bubbleEls.get(p);
      if (!el) {
        el = document.createElement('div'); el.className = 'bubble'; el.hidden = true;
        this.$('overlay').appendChild(el); this.bubbleEls.set(p, el);
        const tag = document.createElement('div'); tag.className = 'nametag'; tag.textContent = p.name;
        this.$('overlay').appendChild(tag); this.tagEls.set(p, tag);
      }
      const tag = this.tagEls.get(p);
      const hiddenIndoors = p.building && p.building.cut < 0.3 && p.mode === 'normal';
      const sitDrop = p.pose === 'sit' ? 4 : p.pose === 'sleep' ? 14 : p.pose === 'swim' ? 12 : 0;
      const sp = r.toScreen(p.x, p.y, p.z);
      const sx = sp.x * z, sy = sp.y * z;
      const showBubble = p.bubble && p.bubble.until > now && !hiddenIndoors;
      if (showBubble) {
        if (el.dataset.id !== String(p.bubble.id)) { el.textContent = p.bubble.text; el.dataset.id = p.bubble.id; }
        el.hidden = false;
        el.style.transform = `translate(${Math.round(sx)}px, ${Math.round(sy + (-38 + sitDrop) * z)}px) translate(-50%, -100%)`;
      } else el.hidden = true;
      const showTag = !hiddenIndoors && !showBubble && (this.showNames || sim.hover === p || sim.selected === p);
      tag.hidden = !showTag;
      if (showTag) {
        tag.style.transform = `translate(${Math.round(sx)}px, ${Math.round(sy + 5 * z)}px) translate(-50%, 0)`;
        tag.classList.toggle('sel', sim.selected === p);
      }
    }
    if (now - this.lastPanel > 250) { this.lastPanel = now; this.panels(); }
  }

  moodColor(m) { return m > 62 ? 'var(--good)' : m > 35 ? 'var(--ok)' : 'var(--bad)'; }
  setRing(el, p) {
    const m = p.mood();
    el.style.setProperty('--m', Math.round(m) + '%');
    el.style.setProperty('--c', this.moodColor(m));
  }

  // The day dial: a little sky arc the sun and moon travel across
  drawDial() {
    const c = this.$('dial'), g = c.getContext('2d');
    const W = c.width, H = c.height;
    const min = this.sim.clock.min;
    const amb = this.sim.renderer.ambient(min);
    const day = [124, 196, 240], dusk = [236, 148, 170], night = [44, 32, 86];
    const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
    const top = amb.dark > 0.5 ? mix(dusk, night, (amb.dark - 0.5) * 2) : mix(day, dusk, amb.dark * 2);
    const bot = mix(top, [255, 214, 160], 0.45 * (1 - amb.dark));
    g.clearRect(0, 0, W, H);
    g.save();
    g.beginPath(); g.arc(W / 2, H, W / 2, Math.PI, 0); g.closePath(); g.clip();
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, `rgb(${top})`); gr.addColorStop(1, `rgb(${bot})`);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    if (amb.dark > 0.4) {
      g.fillStyle = `rgba(255, 245, 220, ${amb.dark})`;
      for (const [x, y] of [[8, 14], [14, 6], [22, 10], [31, 5], [38, 12], [27, 17], [17, 15]]) g.fillRect(x, y, 1, 1);
    }
    const isDay = min >= 360 && min < 1080;
    const f = isDay ? (min - 360) / 720 : ((min - 1080 + 1440) % 1440) / 720;
    const ang = Math.PI + f * Math.PI;
    const bx = Math.round(W / 2 + Math.cos(ang) * (W / 2 - 6)), by = Math.round(H + Math.sin(ang) * (H - 6));
    if (isDay) {
      g.fillStyle = 'rgba(255, 220, 120, 0.35)'; g.beginPath(); g.arc(bx, by, 6, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffd56a'; g.fillRect(bx - 2, by - 3, 5, 7); g.fillRect(bx - 3, by - 2, 7, 5);
      g.fillStyle = '#fff3c4'; g.fillRect(bx - 1, by - 2, 2, 2);
    } else {
      g.fillStyle = '#fff3d6'; g.fillRect(bx - 2, by - 3, 5, 7); g.fillRect(bx - 3, by - 2, 7, 5);
      g.fillStyle = `rgb(${top})`; g.fillRect(bx, by - 3, 3, 5);
    }
    g.restore();
    g.fillStyle = 'rgba(255, 236, 214, 0.35)'; g.fillRect(0, H - 1, W, 1);
  }

  panels() {
    const sim = this.sim, c = sim.clock;
    this.$('clock-time').textContent = IS.fmtTime(c.min);
    this.$('clock-date').textContent = `${IS.WEEKDAYS[c.weekday]}, ${c.season} ${c.seasonDay}`;
    const wl = { sunny: 'Sunny', cloudy: 'Cloudy', rain: 'Rain', storm: 'Storm', fog: 'Fog' }[sim.weather];
    const night = c.min < 6 * 60 || c.min >= 20.5 * 60;
    this.$('clock-weather').textContent = night && sim.weather === 'sunny' ? 'Clear night' : wl;
    this.$('stock-food').textContent = sim.world.food;
    this.$('stock-wood').textContent = sim.world.wood;
    this.$('stock-food-wrap').classList.toggle('low', sim.world.food < 6);
    this.$('stock-wood-wrap').classList.toggle('low', sim.world.wood < 3);
    this.$('ff').hidden = !sim.nightFF;
    this.drawDial();
    const nxt = sim.events.nextEvent();
    const act = sim.events.list.find(e => e.state === 'active' && e.day === c.day);
    const ne = this.$('next-event');
    if (act) ne.innerHTML = `<b>${this.esc(act.name)}</b>Happening now at ${this.esc(act.place)}`;
    else if (nxt) ne.innerHTML = `<b>${this.esc(nxt.name)}</b>${nxt.day === c.day ? 'Today' : 'Tomorrow'} at ${IS.fmtTime(nxt.start)}, ${this.esc(nxt.place)}`;
    else ne.innerHTML = '';

    for (const p of sim.people) {
      this.$('chip-act-' + p.id).textContent = p.actionLabel();
      this.setRing(this.$('chip-ring-' + p.id), p);
      this.$('chip-' + p.id).classList.toggle('active', sim.selected === p);
    }
    this.inspector();
  }

  pips(v, n = 10, cls = '') {
    const on = Math.round(IS.clamp(v, 0, 100) / 100 * n);
    let s = '';
    for (let i = 0; i < n; i++) s += `<i class="${i < on ? 'on' : ''}"></i>`;
    return `<span class="pips ${cls}">${s}</span>`;
  }
  needPips(v) { return this.pips(v, 10, v < 25 ? 'low' : v < 50 ? 'mid' : ''); }

  inspector() {
    const sim = this.sim, p = sim.selected;
    const box = this.$('inspector');
    box.hidden = !p;
    if (!p) return;
    this.$('insp-portrait').src = p.portrait;
    this.setRing(this.$('insp-ring'), p);
    this.$('insp-name').textContent = p.name;
    this.$('insp-sub').textContent = `${p.moodWord()}${p.cfg.age ? ', ' + p.cfg.age : ''}${p.sick ? ', has a cold' : ''}`;
    const body = this.$('insp-body');
    const scroll = body.scrollTop;
    if (this.tab === 'now') body.innerHTML = this.tabNow(p);
    else if (this.tab === 'bonds') body.innerHTML = this.tabBonds(p);
    else body.innerHTML = this.tabAbout(p);
    body.scrollTop = scroll;
  }

  tabNow(p) {
    const n = p.needs;
    return `
      <section><div class="doing">${this.esc(p.actionLabel())}</div><div class="thought">${this.esc(p.thought)}</div></section>
      <section><h4>Needs</h4><div class="meters">
        <span>Fullness</span>${this.needPips(n.hunger)}
        <span>Energy</span>${this.needPips(n.energy)}
        <span>Social</span>${this.needPips(n.social)}
        <span>Fun</span>${this.needPips(n.fun)}
        <span>Mood</span>${this.pips(p.mood(), 10, 'warm')}
      </div></section>`;
  }

  tabBonds(p) {
    const others = this.sim.people.filter(o => o !== p);
    const rows = others.map(o => {
      const r = p.relTo(o.name);
      const f = r.friendship;
      const hearts = p.canFallFor(o.name) && r.romance > 0 ? `<span class="hearts">♥ ${Math.round(r.romance)}</span>` : '';
      return `<li class="bond" data-person="${o.name}"><img src="${o.portrait}" alt="">
        <div class="bond-top"><b>${o.name}</b><em>${p.relLabel(o.name)}${r.label ? ', ' + this.esc(r.label) : ''}</em></div>
        <div class="fmeter">${this.pips(Math.abs(f), 10, f < 0 ? 'neg' : '')}${hearts}</div></li>`;
    }).join('');
    const sky = p.skyOpinion;
    const skyWord = sky > 60 ? 'Worships you' : sky > 20 ? 'Fond of you' : sky > -20 ? (p.grabCount ? 'Unsure about you' : 'Unaware of you') : sky > -60 ? 'Wary of you' : p.traits.grumpy > 0.5 ? 'Furious at you' : 'Terrified of you';
    const grabs = p.grabCount ? `Picked up ${p.grabCount} time${p.grabCount > 1 ? 's' : ''}.` : 'Never been picked up.';
    return `
      <section><h4>Friendships</h4><ul class="bonds">${rows}</ul></section>
      <section><h4>The Sky Hand</h4><p class="sky"><b>${skyWord}</b>${grabs}</p></section>`;
  }

  tabAbout(p) {
    const names = { sociable: 'Sociable', energetic: 'Energetic', kind: 'Kind', grumpy: 'Grumpy', curious: 'Curious', hardworking: 'Hardworking', brave: 'Brave' };
    const traits = Object.entries(p.traits).map(([k, v]) => `<span>${names[k] || k}</span>${this.pips(v * 100, 5, 'trait')}`).join('');
    const now = this.sim.clock.abs;
    const ago = m => { const d = Math.max(0, now - m.t); return d < 60 ? `${Math.round(d)} min ago` : d < 1440 ? `${Math.round(d / 60)} h ago` : `${Math.round(d / 1440)} d ago`; };
    const mems = p.memories.slice(0, 6).map(m => `<li><time>${ago(m)}</time>${this.esc(m.text)}</li>`).join('') || '<li class="muted">Nothing memorable yet.</li>';
    const chips = (list, cls) => list.map(x => `<span class="chip ${cls}">${x}</span>`).join('');
    return `
      ${p.cfg.bio ? `<section><p class="bio">${this.esc(p.cfg.bio)}</p></section>` : ''}
      <section><h4>Loves and hates</h4><div class="chips">${chips(p.loves, '')}${chips(p.hates, 'no')}</div></section>
      <section><h4>Personality</h4><div class="meters">${traits}</div></section>
      <section><h4>Recent memories</h4><ul class="mems">${mems}</ul></section>`;
  }

  esc(s) { return String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])); }
};
