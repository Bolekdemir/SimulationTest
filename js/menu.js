// Title screen and pause menu: a closed journal lying over the living
// island. Continue picks up the autosave; New island starts fresh.
IS.Menu = class {
  constructor(sim, { save, autoStart }) {
    this.sim = sim;
    this.$ = id => document.getElementById(id);
    this.save = save || null;
    this.mode = 'title';
    this.confirming = false;
    this.$('m-primary').addEventListener('click', () => this.primary());
    this.$('m-new').addEventListener('click', () => this.newIsland());
    this.$('m-cast').addEventListener('click', () => this.showCast(true));
    this.$('m-help').addEventListener('click', () => { this.$('help').hidden = false; });
    this.$('cast-close').addEventListener('click', () => this.showCast(false));
    this.$('btn-menu').addEventListener('click', () => this.open('pause'));
    this.buildCast();
    // Keep the journal safe when the tab goes away
    const autosave = () => { if (sim.started) IS.Save.save(sim); };
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') autosave(); });
    window.addEventListener('pagehide', autosave);
    if (autoStart) this.start();
    else this.open('title');
  }

  get isOpen() { return !this.$('menu').hidden; }

  open(mode) {
    const sim = this.sim;
    this.mode = mode;
    this.confirming = false;
    const pause = mode === 'pause';
    if (pause) { this.resumeSpeed = sim.speedIdx || sim.lastSpeed || 1; sim.setSpeed(0); IS.Save.save(sim); this.save = IS.Save.load(); }
    const p = this.$('m-primary');
    if (pause) { p.querySelector('b').textContent = 'Resume'; this.$('m-primary-meta').textContent = this.save ? `Saved · ${IS.Save.describe(this.save)}` : 'Back to the island'; }
    else if (this.save) { p.querySelector('b').textContent = 'Continue'; this.$('m-primary-meta').textContent = IS.Save.describe(this.save); }
    else { p.querySelector('b').textContent = 'Begin'; this.$('m-primary-meta').textContent = 'Six islanders, one cat, no WiFi'; }
    this.$('m-new').hidden = !this.save && !pause;
    this.$('m-new').querySelector('b').textContent = 'New island';
    this.$('m-new-meta').textContent = 'Start the journal over';
    this.$('menu').hidden = false;
    this.showCast(false);
    document.body.classList.add('menu-open');
    sim.menuOpen = true;
    sim.select(null);
  }

  close() {
    this.$('menu').hidden = true;
    document.body.classList.remove('menu-open');
    this.sim.menuOpen = false;
  }

  primary() {
    if (this.mode === 'pause') { this.close(); this.sim.setSpeed(this.resumeSpeed || 1); return; }
    this.start();
  }

  start() {
    const sim = this.sim;
    this.close();
    if (!sim.started) {
      sim.started = true;
      sim.lastSaveHour = Math.floor(sim.clock.abs / 60);
      if (!this.save) sim.toast('Welcome to Tidewhistle Isle. Click an islander to open their page.');
      else sim.toast('Welcome back. The island kept going without you.');
    }
    sim.setSpeed(1);
  }

  newIsland() {
    const b = this.$('m-new');
    if (!this.confirming && (this.save || this.sim.started)) {
      this.confirming = true;
      b.querySelector('b').textContent = 'Really start over?';
      this.$('m-new-meta').textContent = 'Click again. This island will be gone for good.';
      return;
    }
    IS.Save.clear();
    try { sessionStorage.setItem('tw-new', '1'); } catch (e) { /* fine, we'll just show the menu */ }
    this.sim.started = false;
    location.reload();
  }

  buildCast() {
    const card = cfg => {
      const p = this.sim.byName(cfg.name);
      const loves = (cfg.loves || []).map(l => `<span class="chip">${l}</span>`).join('') + (cfg.hates || []).map(l => `<span class="chip no">${l}</span>`).join('');
      return `<article class="cast-card"><span class="face"><img src="${p.portrait}" alt=""></span>
        <div><h3>${cfg.name}</h3><p class="bio">${this.sim.ui.esc(cfg.bio || '')}</p>
        ${cfg.into ? `<p class="cast-type">${this.sim.ui.esc(this.sim.ui.typeLine(p))}</p>` : ''}
        <div class="chips">${loves}</div></div></article>`;
    };
    const all = IS.ISLANDERS;
    const half = Math.ceil(all.length / 2);
    this.$('cast-left').innerHTML = `<h2>The islanders</h2>` + all.slice(0, half).map(card).join('');
    this.$('cast-right').innerHTML = all.slice(half).map(card).join('');
  }

  showCast(on) {
    this.$('cast').hidden = !on;
    this.$('menu-book').hidden = on;
  }
};
