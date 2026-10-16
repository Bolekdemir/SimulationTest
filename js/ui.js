IS.UI = class {
  constructor(sim) {
    this.sim = sim;
    this.$ = id => document.getElementById(id);
    this.bubbleEls = new Map();
    this.tagEls = new Map();
    this.lastPanel = 0;
    this.showNames = IS.Settings.get('names');
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
    const grid = (rows, pal) => icon(g => rows.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch]) px(g, x, y, 1, 1, pal[ch]); })));
    const K = { k: '#2e1a10' };
    this.icons = {
      food: icon(g => { px(g, 3, 0, 4, 4, '#e8913a'); px(g, 2, 1, 5, 3, '#e8913a'); px(g, 3, 1, 2, 1, '#ffc078'); px(g, 2, 4, 2, 2, '#f4efe6'); px(g, 1, 6, 2, 2, '#f4efe6'); }),
      wood: icon(g => { px(g, 0, 2, 8, 4, '#a8763f'); px(g, 0, 2, 8, 1, '#c4935a'); px(g, 0, 2, 2, 4, '#d9b77e'); px(g, 0, 3, 1, 2, '#a8763f'); }),
      lantern: icon(g => { px(g, 3, 0, 2, 1, '#6b5a7a'); px(g, 2, 1, 4, 6, '#ffc96b'); px(g, 3, 2, 2, 3, '#fff3d0'); px(g, 2, 7, 4, 1, '#6b5a7a'); }),
      pause: grid(['........', '.kk..kk.', '.kk..kk.', '.kk..kk.', '.kk..kk.', '.kk..kk.', '.kk..kk.', '........'], K),
      minus: grid(['........', '........', '........', '.kkkkkk.', '.kkkkkk.', '........', '........', '........'], K),
      plus: grid(['........', '...kk...', '...kk...', '.kkkkkk.', '.kkkkkk.', '...kk...', '...kk...', '........'], K),
      roof: grid(['...kk...', '..kkkk..', '.kkkkkk.', 'kkkkkkkk', '.k....k.', '.k.kk.k.', '.k.kk.k.', '.kkkkkk.'], K),
      tag: grid(['........', 'kkkkkk..', 'k.....k.', 'k.kkk..k', 'k.....k.', 'kkkkkk..', '........', '........'], K),
      book: grid(['.kkkkkk.', '.k....kk', '.k.kk.kk', '.k....kk', '.k.kk.kk', '.k....kk', '.kkkkkkk', '..kkkkkk'], K),
      full: grid(['kkk..kkk', 'k......k', 'k......k', '........', '........', 'k......k', 'k......k', 'kkk..kkk'], K),
      help: grid(['..kkkk..', '.kk..kk.', '.....kk.', '....kk..', '...kk...', '........', '...kk...', '...kk...'], K),
      heart: grid(['........', '.rr.rr..', 'rrrrrrr.', 'rrrrrrr.', '.rrrrr..', '..rrr...', '...r....', '........'], { r: '#c94a73' }),
      menu: grid(['........', 'kkkkkkkk', 'kkkkkkkk', '........', 'kkkkkkkk', '........', 'kkkkkkkk', '........'], K),
      'p-hand': grid(['...k.k..', '..kwkwk.', '..kwkwkk', '.kkwwwwk', 'kwkwwwwk', 'kwwwwwk.', '.kwwwwk.', '..kkkk..'], { k: '#2e1a10', w: '#f2d3b0' }),
      'p-smite': grid(['....yyk.', '...yyk..', '..yyk...', '.yyyyyk.', '...yyk..', '..yyk...', '.yyk....', '.yk.....'], { y: '#f2b82e', k: '#2e1a10' }),
      'p-meteor': grid(['oo......', '.oo.....', '..ooo...', '...okkk.', '....kkkk', '....kkrk', '....kkkk', '.....kk.'], { o: '#ff8a3a', k: '#3a2a22', r: '#e8343f' }),
      'p-fire': grid(['...r....', '...rr...', '..rrr.r.', '.rryrrr.', '.ryyyrr.', 'rryyyyrr', 'rryyyyrr', '.rrrrrr.'], { r: '#e8343f', y: '#ffd56a' }),
      'p-bless': grid(['..yyyy..', '.y....y.', '..yyyy..', '...ww...', '..wwww..', '.w.ww.w.', '...ww...', '..w..w..'], { y: '#f2b82e', w: '#8f7565' }),
      'p-revive': grid(['..kkkk..', '.kggggk.', 'kgkggkgk', 'kggggggk', 'kgggkggk', '.kggggk.', '..kggk..', '..k..k..'], { k: '#2e1a10', g: '#bfe8d0' }),
      town: grid(['...kf...', '...kff..', '..kk....', '.kkkkkk.', 'kkkkkkkk', '.kwwkwk.', '.kwwkwk.', '.kkkkkk.'], { k: '#2e1a10', f: '#e0405a', w: '#f2b82e' }),
      chest: grid(['........', '.kkkkkk.', 'kyyyyyyk', 'kkkkkkkk', 'kbbybbbk', 'kbbbbbbk', 'kkkkkkkk', '........'], { k: '#2e1a10', y: '#f2b82e', b: '#a8763f' }),
      friend: grid(['...kk...', '..kkkk..', '..kkkk..', '...kk...', '.kkkkkk.', 'kkkkkkkk', 'kkkkkkkk', '........'], { k: '#8f7565' }),
    };
    this.$('ico-food').src = this.icons.food;
    this.$('ico-wood').src = this.icons.wood;
    this.$('ico-pause').src = this.icons.pause;
    document.querySelectorAll('img[data-icon]').forEach(img => { img.src = this.icons[img.dataset.icon]; });
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
    this.$('btn-powers').addEventListener('click', () => this.togglePowers());
    this.$('btn-collection').addEventListener('click', () => this.showCollection(this.$('collection').hidden));
    this.$('collection-close').addEventListener('click', () => this.showCollection(false));
    this.$('btn-town').addEventListener('click', () => this.showTown(this.$('town').hidden));
    this.$('town-close').addEventListener('click', () => this.showTown(false));
    this.$('town-x').addEventListener('click', () => this.showTown(false));
    this.$('town').addEventListener('click', e => { if (e.target.id === 'town') this.showTown(false); });
    this.$('town-tabs').addEventListener('click', e => { const t = e.target.closest('[data-tab]'); if (t) { this.townTab = t.dataset.tab; this.renderTown(); } });
    this.$('collection-x').addEventListener('click', () => this.showCollection(false));
    this.$('collection').addEventListener('click', e => { if (e.target.id === 'collection') this.showCollection(false); });
    this.togglePowers(!!IS.Settings.get('powers'));
    document.querySelectorAll('[data-power]').forEach(b => b.addEventListener('click', () => IS.Gods.setPower(sim, b.dataset.power)));
    // Whispers from the sky
    const form = this.$('cmd'), input = this.$('cmd-in');
    const send = text => {
      const p = sim.selected;
      if (!p) return;
      const r = IS.Command.run(sim, p, text);
      const out = this.$('cmd-out');
      out.textContent = r.text;
      out.classList.toggle('err', !r.ok);
      if (r.ok) { input.value = ''; this.ideas(p, true); }
    };
    form.addEventListener('submit', e => { e.preventDefault(); send(input.value); });
    this.$('cmd-ideas').addEventListener('click', e => { const b = e.target.closest('.idea'); if (b) send(b.textContent); });
    if (!IS.Settings.get('journal')) this.$('log').hidden = true;
    this.syncToggles();
  }

  ideas(p, force) {
    if (!force && this.ideasFor === p) return;
    this.ideasFor = p;
    this.$('cmd-in').placeholder = `Tell or ask ${p.name} anything…`;
    this.$('cmd-label').textContent = `Whisper to ${p.name}`;
    if (!force) this.$('cmd-out').textContent = '';
    this.$('cmd-ideas').innerHTML = IS.Command.suggestions(p).map(t => `<button type="button" class="idea">${this.esc(t)}</button>`).join('');
  }

  syncToggles() {
    const sim = this.sim;
    this.$('btn-roofs').setAttribute('aria-pressed', sim.xray);
    this.$('btn-names').setAttribute('aria-pressed', this.showNames);
    this.$('btn-log').setAttribute('aria-pressed', !this.$('log').hidden);
    this.$('insp-follow').setAttribute('aria-pressed', sim.follow);
    this.$('insp-follow').textContent = sim.follow ? 'Following' : 'Follow';
    document.querySelectorAll('[data-speed]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.speed === sim.speedIdx));
    document.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === this.tab));
    document.querySelectorAll('[data-power]').forEach(b => b.setAttribute('aria-pressed', b.dataset.power === sim.power));
    this.$('btn-powers').setAttribute('aria-pressed', !this.$('powers').hidden);
    document.body.classList.toggle('casting', sim.power !== 'hand');
  }

  // The god powers toolbar is tucked away until you ask for it
  togglePowers(on = this.$('powers').hidden) {
    this.$('powers').hidden = !on;
    IS.Settings.set('powers', on);
    if (!on && this.sim.power && this.sim.power !== 'hand') IS.Gods.setPower(this.sim, 'hand');
    this.syncToggles();
  }

  // The town book: how the island is doing, who's visiting, what to build
  showTown(on) {
    const box = this.$('town');
    box.hidden = !on;
    clearInterval(this.townTimer);
    if (!on) { if (IS.Build && IS.Build.cancelPlacing) IS.Build.cancelPlacing(this.sim); return; }
    this.townTab = this.townTab || 'overview';
    this.renderTown();
    this.townTimer = setInterval(() => { if (!box.hidden && this.townTab === 'overview') this.renderTown(); }, 1500);
  }
  renderTown() {
    const sim = this.sim, Tn = IS.Town, e = s => this.esc(s);
    for (const b of this.$('town-tabs').querySelectorAll('[data-tab]')) b.setAttribute('aria-pressed', String(b.dataset.tab === this.townTab));
    const pop = Tn.residents(sim).length, cap = IS.Build ? IS.Build.popCap(sim) : 16;
    this.$('town-sub').textContent = `${pop} islander${pop === 1 ? '' : 's'} · ${Tn.freeHomes(sim)} home${Tn.freeHomes(sim) === 1 ? '' : 's'} with room · room for up to ${cap} people right now`;
    const body = this.$('town-body');
    const scroll = body.parentElement.scrollTop;
    if (this.townTab === 'build' && IS.Build) { body.innerHTML = IS.Build.panelHTML(sim, this); IS.Build.bindPanel(sim, this, body); return; }
    const r = Tn.rating(sim);
    const tier = Tn.tier(sim), next = Tn.nextTier(sim), st0 = Tn.state(sim);
    const goalLine = st0.isTown ? 'Tidewhistle is a real town. Keep growing it however you like.' : `Goal: grow Tidewhistle into a real town of ${Tn.GOAL} islanders.`;
    let h = `<h3>${e(tier.name)} <small>${pop}/${next ? next.n : pop} islanders</small></h3><p class="sub">${e(goalLine)} ${next ? `Next: ${e(next.name)} at ${next.n}.` : ''}</p><div class="meter"><i style="width:${Math.min(100, pop / Tn.GOAL * 100)}%"></i></div>
      <h3>Island Rating</h3><div class="rating"><big>${r.score}</big><span>${r.word}</span></div>
      <div class="meter"><i style="width:${r.score}%"></i><b style="left:50%" title="Visitors start coming at 50"></b></div>
      <p class="sub">${r.score >= 50 ? 'Visitors are coming. The happier the island, the more often they come.' : 'Visitors only come once the rating reaches 50.'}</p>
      <dl class="parts">` + r.parts.map(p => `<dt>${e(p.label)}</dt><dd>${e(p.note)}</dd><span class="num">${p.value > 0 && p.key !== 'charm' ? '+' : ''}${p.value}${p.max ? '/' + p.max : ''}</span>`).join('') + '</dl>';
    const v = Tn.visitor(sim), st = Tn.state(sim);
    h += '<h3>Visitors</h3>';
    if (v) {
      const t = v.town, j = Tn.judgeVisit(sim, v);
      const left = t.status === 'visitor' ? Math.max(0, Math.ceil((t.decideAt - sim.clock.abs) / 60)) : t.status === 'waiting' ? Math.max(0, Math.ceil((t.waitUntil - sim.clock.abs) / 1440 * 10) / 10) : 0;
      const status = t.status === 'visitor' ? `Visiting. Decides in about ${left} hour${left === 1 ? '' : 's'}.` : t.status === 'waiting' ? `Wants to stay but needs a home. Leaves in ${left} day${left === 1 ? '' : 's'} if nobody builds one.` : 'Leaving on the next boat.';
      const feel = t.status !== 'visitor' ? '' : j.score >= 0.65 ? 'Loving it here.' : j.score >= 0.55 ? 'Leaning towards staying.' : j.score >= 0.45 ? 'On the fence.' : 'Not impressed so far.';
      const rs = j.reasons.slice(0, 3).map(x => `<span class="${x.good ? 'good' : 'bad'}">${x.good ? '+' : '−'} ${e(x.text)}</span>`).join('<br>');
      h += `<div class="card"><img src="${v.portrait}" alt=""><div><b>${e(v.name)}</b> · ${e(v.cfg.archetype)}<br>${e(status)} ${feel}<br>${rs || 'Still settling in.'}<br><em>${e(v.cfg.bio)}</em></div></div>`;
    } else if (st.pending) h += '<p class="sub">Someone is on their way by boat today!</p>';
    else h += `<p class="sub">Nobody visiting right now.${r.score >= 50 ? ' Someone might come any morning.' : ''}</p>`;
    if (st.lastDecision) { const d = st.lastDecision; h += `<p class="sub">Last visitor: ${e(d.name)} ${d.stay ? 'decided to stay' : 'left'}${(d.stay ? d.good : d.bad).length ? ' (' + e((d.stay ? d.good : d.bad).join(', ')) + ')' : ''}.</p>`; }
    const sad = Tn.residents(sim).filter(p => p.town && p.town.considering);
    if (sad.length) h += '<h3>Thinking of leaving</h3>' + sad.map(p => `<div class="card"><img src="${p.portrait}" alt=""><div><b>${e(p.name)}</b><br><span class="bad">${e((p.town.whyLeave || []).slice(0, 2).join(', and '))}</span><br>Cheer them up, or whisper “please stay”. Friends will try too.</div></div>`).join('');
    const gone = (sim.leftIsland || []).slice(-3).reverse();
    if (gone.length) h += `<p class="sub">Sailed away: ${gone.map(x => e(x.name)).join(', ')}.</p>`;
    body.innerHTML = h;
    body.parentElement.scrollTop = scroll;
  }

  // The island's finds book
  showCollection(on) {
    const box = this.$('collection');
    box.hidden = !on;
    if (!on) return;
    const sim = this.sim, C = IS.Content, have = sim.collection || {};
    const found = C.ITEMS.filter(i => have[i.id]).length;
    this.$('collection-sub').textContent = `${found} of ${C.ITEMS.length} finds discovered. Rare ones have a star.`;
    let html = '';
    for (const [cat, title] of Object.entries(C.CATS)) {
      if (cat === 'art') continue;
      const items = C.ITEMS.filter(i => i.cat === cat);
      const n = items.filter(i => have[i.id]).length;
      html += `<h3>${title} <small>${n}/${items.length}</small></h3><ul class="finds">` + items.map(i => {
        const h = have[i.id];
        return h ? `<li class="${i.w <= 4 ? 'rare' : ''}"><b>${this.esc(i.name)}</b><span>Found by ${this.esc(h.by)}, ${h.season} ${((h.day - 1) % 28) + 1}</span></li>` : `<li class="unknown"><b>???</b><span>${{ beach: 'Somewhere on the shore', forage: 'Deep in the woods', fish: 'Something in the water', bugs: 'Flitting through the meadow', bugsNight: 'Only comes out at night', treasure: 'Buried somewhere...' }[i.src] || 'Not found yet'}</span></li>`;
      }).join('') + '</ul>';
    }
    const ps = (sim.paintings || []).slice().reverse();
    html += `<h3>Paintings <small>${ps.length}</small></h3>` + (ps.length ? `<ul class="finds">${ps.slice(0, 18).map(p => `<li class="${p.quality === 'masterpiece' ? 'rare' : ''}"><b>“${this.esc(p.name)}”</b><span>by ${this.esc(p.by)}, ${p.quality}</span></li>`).join('')}</ul>` : '<p class="sub">Nobody has painted anything yet.</p>');
    this.$('collection-body').innerHTML = html;
  }

  // Someone died: hide their speech bubble and name tag
  forget(p) {
    const el = this.bubbleEls.get(p), tag = this.tagEls.get(p);
    if (el) el.hidden = true;
    if (tag) tag.hidden = true;
  }

  buildRoster() {
    const el = this.$('roster');
    el.innerHTML = '';
    for (const p of this.sim.everyone) {
      const b = document.createElement('button');
      b.className = 'token';
      b.id = 'chip-' + p.id;
      b.title = `${p.name}: click to follow`;
      b.innerHTML = `<span class="face"><img src="${p.portrait}" alt=""></span><span class="mood" id="chip-mood-${p.id}"></span><b>${p.name}</b><small id="chip-act-${p.id}">Sleeping</small>`;
      b.addEventListener('click', () => {
        if (p.dead) {
          const g = this.sim.graves.find(x => x.p === p);
          if (g) { const s = IS.Iso.w2s(g.x, g.y); this.sim.follow = false; this.sim.cam.x = s.x; this.sim.cam.y = s.y - 20; this.toast(`${p.name} rests here. ${IS.Gods.causeWord(g.cause)}, ${g.season} ${((g.day - 1) % 28) + 1}.`); }
          this.syncToggles();
          return;
        }
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
    const shown = [];
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
        if (el.dataset.mid !== el.dataset.id) { el.dataset.mid = el.dataset.id; el._w = el.offsetWidth; el._h = el.offsetHeight; }
        shown.push({ el, x: sx, y: sy + (-38 + sitDrop) * z });
      } else { el.hidden = true; el._off = 0; }
      const showTag = !hiddenIndoors && !showBubble && (this.showNames || sim.hover === p || sim.selected === p);
      tag.hidden = !showTag;
      if (showTag) {
        tag.style.transform = `translate(${Math.round(sx)}px, ${Math.round(sy + 5 * z)}px) translate(-50%, 0)`;
        tag.classList.toggle('sel', sim.selected === p);
      }
    }
    // Headstones get a name plate when names are on, or under the cursor
    const hg = sim.hoverIso && IS.Gods.graveAt(sim, sim.hoverIso, 1);
    this.graveEls = this.graveEls || new Map();
    for (const [g, el] of this.graveEls) if (!sim.graves.includes(g)) { el.remove(); this.graveEls.delete(g); }
    for (const g of sim.graves) {
      let el = this.graveEls.get(g);
      if (!el) { el = document.createElement('div'); el.className = 'nametag grave'; this.$('overlay').appendChild(el); this.graveEls.set(g, el); }
      const show = g.stage !== 'lost' && (this.showNames || hg === g) && !(g.building && g.building.cut < 0.3);
      el.hidden = !show;
      if (!show) continue;
      el.textContent = g.stage === 'grave' ? `Here lies ${g.name}` : g.name;
      const sp = r.toScreen(g.x, g.y, 0);
      el.style.transform = `translate(${Math.round(sp.x * z)}px, ${Math.round(sp.y * z + 5 * z)}px) translate(-50%, 0)`;
    }
    // Crowded scenes: stack bubbles upward instead of letting them overlap
    shown.sort((a, b) => b.y - a.y);
    const placed = [];
    for (const b of shown) {
      const w = b.el._w, h = b.el._h;
      let bottom = b.y;
      for (let pass = 0; pass < 6; pass++) {
        const hit = placed.find(o => Math.abs(o.x - b.x) < (o.w + w) / 2 + 4 && bottom > o.top - 4 && bottom - h < o.bottom);
        if (!hit) break;
        bottom = hit.top - 6;
      }
      placed.push({ x: b.x, w, top: bottom - h, bottom });
      const target = bottom - b.y;
      b.el._off = b.el._off === undefined ? target : b.el._off + (target - b.el._off) * 0.3;
      b.el.style.transform = `translate(${Math.round(b.x)}px, ${Math.round(b.y + b.el._off)}px) translate(-50%, -100%)`;
    }
    if (now - this.lastPanel > 250) { this.lastPanel = now; this.panels(); }
  }

  // Mood as five pixel segments under the portrait
  setMood(el, p) {
    const m = p.mood();
    const on = Math.max(1, Math.round(m / 20));
    const tone = m > 62 ? 'good' : m > 35 ? 'ok' : 'bad';
    const key = on + tone;
    if (el.dataset.k === key) return;
    el.dataset.k = key; el.dataset.tone = tone;
    el.innerHTML = '<i class="on"></i>'.repeat(on) + '<i></i>'.repeat(5 - on);
    el.title = `Mood: ${p.moodWord()}`;
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
    document.body.classList.toggle('dusk', sim.renderer.ambient(c.min).dark > 0.45);
    const nxt = sim.events.nextEvent();
    const act = sim.events.list.find(e => e.state === 'active' && e.day === c.day);
    const ne = this.$('next-event');
    if (act) ne.innerHTML = `<b>${this.esc(act.name)}</b>Happening now at ${this.esc(act.place)}`;
    else if (nxt) ne.innerHTML = `<b>${this.esc(nxt.name)}</b>${nxt.day === c.day ? 'Today' : 'Tomorrow'} at ${IS.fmtTime(nxt.start)}, ${this.esc(nxt.place)}`;
    else ne.innerHTML = '';

    for (const p of sim.everyone) {
      const chip = this.$('chip-' + p.id);
      chip.classList.toggle('dead', !!p.dead);
      if (p.dead) {
        const g = sim.graves.find(x => x.p === p);
        this.$('chip-act-' + p.id).textContent = g && g.stage === 'grave' ? 'Resting in peace' : 'Dead';
        continue;
      }
      this.$('chip-act-' + p.id).textContent = p.actionLabel();
      this.setMood(this.$('chip-mood-' + p.id), p);
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
    this.setMood(this.$('insp-mood'), p);
    this.$('insp-name').textContent = p.name;
    this.$('insp-mood-word').textContent = `${p.moodWord()}${p.cfg.age ? ', ' + p.cfg.age : ''}${p.sick ? ', has a cold' : ''}`;
    this.ideas(p);
    const body = this.$('insp-body');
    const scroller = body.parentElement;
    const scroll = scroller.scrollTop;
    // While they're talking, the left page shows the conversation as it happens
    const tr = p.chat ? p.chat.transcript.slice(-6) : null;
    const nowHtml = `<div class="doing">${this.esc(p.actionLabel())}</div>` + (tr && tr.length
      ? `<ol class="transcript">${tr.map(l => `<li class="${l.who === p.name ? 'me' : ''}"><b>${this.esc(l.who)}</b>${this.esc(l.text)}</li>`).join('')}</ol>`
      : `<div class="thought">${this.esc(p.thought)}</div>`);
    if (this.$('insp-now').innerHTML !== nowHtml) this.$('insp-now').innerHTML = nowHtml;
    if (this.tab === 'now') body.innerHTML = this.tabNow(p);
    else if (this.tab === 'bonds') body.innerHTML = this.tabBonds(p);
    else body.innerHTML = this.tabAbout(p);
    scroller.scrollTop = scroll;
  }

  tabNow(p) {
    const n = p.needs;
    const feel = IS.Mind.feelingLabel(p);
    const plans = (p.plans || []).map(pl => `<li class="${pl.done ? 'done' : ''}${pl.gaveUp ? ' gaveup' : ''}"><i></i>${this.esc(pl.text)}</li>`).join('') || '<li class="muted">No plans. Just vibes.</li>';
    return `
      ${feel ? `<section><p class="feeling feel-${p.emotion.type}">${this.esc(feel)}</p></section>` : ''}
      <section><h4>Today's plans</h4><ul class="todo">${plans}</ul></section>
      <section><h4>How they're doing</h4><div class="meters">
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
      const hearts = p.canFallFor(o.name) ? `<div class="fmeter" title="Romance ${Math.round(r.romance)}"><img src="${this.icons.heart}" alt="Romance">${this.pips(r.romance, 10, 'love')}</div>` : '';
      return `<li class="bond" data-person="${o.name}"><span class="face"><img src="${o.portrait}" alt=""></span>
        <div class="bond-top"><b>${o.name}</b><em>${p.relLabel(o.name)}${r.label ? ', ' + this.esc(r.label) : ''}${this.ledgerNote(p, o)}</em></div>
        <div class="fmeter" title="Friendship ${Math.round(f)}"><img src="${this.icons.friend}" alt="Friendship">${this.pips(Math.abs(f), 10, f < 0 ? 'neg' : '')}</div>${hearts}</li>`;
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
      <section><h4>Island reputation</h4><p class="bio">${IS.Mind.reputation(this.sim, p).word}</p></section>
      ${p.cfg.into ? `<section><h4>Type</h4><p class="bio">${this.esc(this.typeLine(p))}</p></section>` : ''}
      <section><h4>Loves and hates</h4><div class="chips">${chips(p.loves, '')}${chips(p.hates, 'no')}</div></section>
      <section><h4>Personality</h4><div class="meters">${traits}</div></section>
      ${this.skillsHtml(p)}
      <section><h4>Recent memories</h4><ul class="mems">${mems}</ul></section>`;
  }

  skillsHtml(p) {
    const C = IS.Content, sk = p.skills || {};
    const rows = Object.entries(C.SKILLS).filter(([k]) => (sk[k] || 0) >= 5).sort((a, b) => (sk[b[0]] || 0) - (sk[a[0]] || 0))
      .map(([k, s]) => { const l = C.lvl(p, k), next = Math.pow(l + 1, 2) * 25, prev = Math.pow(l, 2) * 25; return `<span>${s.name}</span>${this.pips(((sk[k] - prev) / (next - prev)) * 100, 10, 'trait')}<em>Lv ${l} · ${C.title(p, k)}</em>`; });
    return `<section><h4>Skills</h4>${rows.length ? `<div class="skills">${rows.join('')}</div>` : '<p class="bio">Hasn\'t practised anything yet.</p>'}</section>`;
  }

  ledgerNote(p, o) {
    const g = p.ledger && p.ledger[o.name];
    const e = IS.Mind.feeling(p);
    if (e && e.type === 'jealous' && e.about === o.name) return ', jealous';
    if (g && g.grudge > 12) return ', holds a grudge';
    if (g && g.thanks > 10) return ', grateful';
    return '';
  }

  typeLine(p) {
    const words = { looks: 'looks', smarts: 'brains', funny: 'a sense of humour', kind: 'kindness', drive: 'drive', confidence: 'confidence' };
    const parts = Object.entries(p.cfg.into).sort((a, b) => b[1] - a[1]).map(([k]) => words[k] || k);
    const lead = Object.values(p.cfg.into).sort((a, b) => b - a)[0] >= 0.6 ? `Mostly about ${parts[0]}` : `Falls for ${parts[0]}`;
    const rest = parts.slice(1);
    return rest.length ? `${lead}, then ${rest.slice(0, -1).join(', ')}${rest.length > 1 ? ' and ' : ''}${rest[rest.length - 1]}.` : lead + '.';
  }

  esc(s) { return String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])); }
};
