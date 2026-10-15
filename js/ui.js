IS.UI = class {
  constructor(sim) {
    this.sim = sim;
    this.$ = id => document.getElementById(id);
    this.bubbleEls = new Map();
    this.tagEls = new Map();
    this.lastPanel = 0;
    this.showNames = true;
    this.buildRoster();
    this.bind();
    this.renderLog();
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
    this.$('log-list').addEventListener('click', e => {
      const li = e.target.closest('[data-who]');
      if (!li) return;
      const p = sim.byName(li.dataset.who);
      if (p) { sim.select(p); sim.follow = true; this.syncToggles(); }
    });
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
  }

  buildRoster() {
    const el = this.$('roster');
    el.innerHTML = '';
    for (const p of this.sim.people) {
      const b = document.createElement('button');
      b.className = 'chip';
      b.id = 'chip-' + p.id;
      b.innerHTML = `<img src="${p.portrait}" alt=""><span class="chip-text"><b>${p.name}</b><small id="chip-act-${p.id}">Sleeping</small></span><i class="mood-dot" id="chip-mood-${p.id}"></i>`;
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
    t.textContent = text;
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
  renderLog() { this.$('log-list').innerHTML = ''; for (const e of this.sim.logEntries.slice().reverse()) this.addLog(e); }

  // Called every animation frame
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
      const sx = (p.x - r.ox) * z, sy = (p.y - p.z - r.oy) * z;
      const showBubble = p.bubble && p.bubble.until > now && !hiddenIndoors;
      if (showBubble) {
        if (el.dataset.id !== String(p.bubble.id)) { el.textContent = p.bubble.text; el.dataset.id = p.bubble.id; }
        el.hidden = false;
        el.style.transform = `translate(${Math.round(sx)}px, ${Math.round(sy + (-36 + sitDrop) * z)}px) translate(-50%, -100%)`;
      } else el.hidden = true;
      const showTag = !hiddenIndoors && !showBubble && (this.showNames || sim.hover === p || sim.selected === p);
      tag.hidden = !showTag;
      if (showTag) {
        tag.style.transform = `translate(${Math.round(sx)}px, ${Math.round(sy + 4 * z)}px) translate(-50%, 0)`;
        tag.classList.toggle('sel', sim.selected === p);
      }
    }
    if (now - this.lastPanel > 250) { this.lastPanel = now; this.panels(); }
  }

  panels() {
    const sim = this.sim, c = sim.clock;
    this.$('clock-time').textContent = IS.fmtTime(c.min);
    this.$('clock-date').textContent = `${IS.WEEKDAYS[c.weekday]} · ${c.season} ${c.seasonDay}`;
    const wl = { sunny: 'Sunny', cloudy: 'Cloudy', rain: 'Rain', storm: 'Storm', fog: 'Fog' }[sim.weather];
    const night = c.min < 6 * 60 || c.min >= 20.5 * 60;
    this.$('clock-weather').textContent = night && sim.weather === 'sunny' ? 'Clear night' : wl;
    this.$('clock-weather').dataset.w = sim.weather;
    this.$('stock-food').textContent = sim.world.food;
    this.$('stock-wood').textContent = sim.world.wood;
    const ff = sim.nightFF;
    this.$('ff').hidden = !ff;
    const nxt = sim.events.nextEvent();
    const act = sim.events.list.find(e => e.state === 'active' && e.day === c.day);
    this.$('next-event').textContent = act ? `Now: ${act.name}` : nxt ? `Next: ${nxt.name} · ${nxt.day === c.day ? 'today' : 'tomorrow'} ${IS.fmtTime(nxt.start)}` : '';

    for (const p of sim.people) {
      this.$('chip-act-' + p.id).textContent = p.actionLabel();
      const m = p.mood();
      this.$('chip-mood-' + p.id).style.background = m > 62 ? 'var(--good)' : m > 35 ? 'var(--ok)' : 'var(--bad)';
      this.$('chip-' + p.id).classList.toggle('active', sim.selected === p);
    }
    this.inspector();
  }

  inspector() {
    const sim = this.sim, p = sim.selected;
    const box = this.$('inspector');
    box.hidden = !p;
    if (!p) return;
    this.$('insp-portrait').src = p.portrait;
    this.$('insp-name').textContent = p.name;
    this.$('insp-sub').textContent = `${p.cfg.age ? p.cfg.age + ' · ' : ''}${p.moodWord()}${p.sick ? ' · has a cold' : ''}`;
    const bar = (v, cls = '') => `<span class="bar ${cls}"><i style="width:${Math.round(IS.clamp(v, 0, 100))}%"></i></span>`;
    const now = sim.clock.abs;
    const ago = m => { const d = Math.max(0, now - m.t); return d < 60 ? `${Math.round(d)}m ago` : d < 1440 ? `${Math.round(d / 60)}h ago` : `${Math.round(d / 1440)}d ago`; };
    const sky = p.skyOpinion;
    const skyWord = sky > 60 ? 'Worships you' : sky > 20 ? 'Fond of you' : sky > -20 ? (p.grabCount ? 'Unsure about you' : 'Unaware of you') : sky > -60 ? 'Wary of you' : p.traits.grumpy > 0.5 ? 'Furious at you' : 'Terrified of you';
    const others = sim.people.filter(o => o !== p);
    const rels = others.map(o => {
      const r = p.relTo(o.name);
      const f = r.friendship;
      const romance = p.canFallFor(o.name) ? `<span class="heart" title="Romance ${Math.round(r.romance)}">♥ ${Math.round(r.romance)}</span>` : '';
      return `<li><span class="rel-name">${o.name}</span><span class="rel-label">${p.relLabel(o.name)}${r.label ? ' · ' + r.label : ''}</span>
        <span class="dbar"><i style="${f >= 0 ? `left:50%;width:${f / 2}%` : `left:${50 + f / 2}%;width:${-f / 2}%`}" class="${f >= 0 ? 'pos' : 'neg'}"></i></span>${romance}</li>`;
    }).join('');
    const traitNames = { sociable: 'Sociable', energetic: 'Energetic', kind: 'Kind', grumpy: 'Grumpy', curious: 'Curious', hardworking: 'Hardworking', brave: 'Brave' };
    const traits = Object.entries(p.traits).map(([k, v]) => `<li><span>${traitNames[k] || k}</span>${bar(v * 100, 'trait')}</li>`).join('');
    const mems = p.memories.slice(0, 6).map(m => `<li><time>${ago(m)}</time> ${this.esc(m.text)}</li>`).join('') || '<li class="muted">Nothing memorable yet.</li>';
    const n = p.needs;
    this.$('insp-body').innerHTML = `
      <section class="now"><b>${this.esc(p.actionLabel())}</b><em>“${this.esc(p.thought)}”</em></section>
      <section><h4>Needs</h4><ul class="needs">
        <li><span>Fullness</span>${bar(n.hunger)}</li><li><span>Energy</span>${bar(n.energy)}</li>
        <li><span>Social</span>${bar(n.social)}</li><li><span>Fun</span>${bar(n.fun)}</li>
        <li><span>Mood</span>${bar(p.mood(), 'mood')}</li></ul></section>
      <section><h4>Relationships</h4><ul class="rels">${rels}</ul></section>
      <section><h4>The Sky Hand</h4><p class="sky">${skyWord} <small>(grabbed ${p.grabCount}×)</small></p></section>
      <section><h4>Personality</h4><ul class="traits">${traits}</ul>
        <p class="likes"><span class="love">Loves: ${p.loves.join(', ') || 'nothing in particular'}</span><span class="hate">Hates: ${p.hates.join(', ') || 'nothing'}</span></p></section>
      <section><h4>Recent memories</h4><ul class="mems">${mems}</ul></section>
      ${p.cfg.bio ? `<section><p class="bio">${this.esc(p.cfg.bio)}</p></section>` : ''}`;
  }

  esc(s) { return String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])); }
};
