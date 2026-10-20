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
    this.$('m-settings').addEventListener('click', () => this.showPanel('settings'));
    this.$('settings-close').addEventListener('click', () => this.showPanel(null));
    this.$('m-install').addEventListener('click', () => this.install());
    this.$('erase').addEventListener('click', () => this.erase());
    document.addEventListener('tw-installable', () => this.refreshInstall());
    window.addEventListener('appinstalled', () => { IS.installPrompt = null; this.refreshInstall(); });
    this.bindSettings();
    this.refreshInstall();
    this.buildCast();
    // Keep the journal safe when the tab goes away
    const autosave = () => { if (sim.started && IS.Settings.get('autosave')) IS.Save.save(sim); };
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
      sim.ui.showNames = IS.Settings.get('names'); sim.ui.syncToggles();
      if (!this.save) sim.toast('Welcome to Tidewhistle Isle. Click an islander to open their page.');
      else sim.toast('Welcome back. The island kept going without you.');
    }
    sim.setSpeed(IS.Settings.get('speed') || 1);
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
      const p = this.sim.everyone.find(x => x.name === cfg.name);
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

  showCast(on) { this.showPanel(on ? 'cast' : null); }

  // One thing at a time on the menu: the closed book, the cast, or settings
  showPanel(which) {
    this.$('cast').hidden = which !== 'cast';
    this.$('settings').hidden = which !== 'settings';
    this.$('menu-book').hidden = !!which;
    this.erasing = false;
    this.$('erase-meta').textContent = this.save ? 'Deletes your save on this device' : 'Nothing saved yet';
  }

  bindSettings() {
    const sync = () => {
      document.querySelectorAll('#settings .switch').forEach(b => b.setAttribute('aria-checked', !!IS.Settings.get(b.dataset.opt)));
      document.querySelectorAll('#settings .seg button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.v === IS.Settings.get(b.parentElement.dataset.opt)));
    };
    document.querySelectorAll('#settings .switch').forEach(b => {
      b.setAttribute('role', 'switch');
      b.addEventListener('click', () => {
        const k = b.dataset.opt, v = !IS.Settings.get(k);
        IS.Settings.set(k, v);
        if (k === 'names') { this.sim.ui.showNames = v; this.sim.ui.syncToggles(); }
        if (k === 'journal') { this.$('log').hidden = !v; this.sim.ui.syncToggles(); }
        sync();
      });
    });
    document.querySelectorAll('#settings .seg button').forEach(b => b.addEventListener('click', () => {
      const k = b.parentElement.dataset.opt;
      IS.Settings.set(k, +b.dataset.v);
      if (k === 'speed' && this.mode === 'pause') this.resumeSpeed = +b.dataset.v;
      if (k === 'sound' || k === 'music') IS.Audio.levels();
      if (k === 'fx') this.sim.renderer.quality = null;
      sync();
    }));
    sync();
  }

  erase() {
    if (!this.save) return;
    if (!this.erasing) { this.erasing = true; this.$('erase-meta').textContent = 'Click again to delete it for good.'; return; }
    IS.Save.clear();
    this.save = null;
    this.erasing = false;
    this.$('erase-meta').textContent = 'Erased. Starts fresh next time.';
  }

  // Installable from GitHub Pages; iPhone needs the Share menu instead
  refreshInstall() {
    const btn = this.$('m-install');
    const installed = matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone;
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) && /^https:/.test(location.protocol) && !/claude/.test(location.hostname);
    this.iosInstall = !IS.installPrompt && ios && !installed;
    btn.hidden = installed || !(IS.installPrompt || this.iosInstall);
  }

  install() {
    if (this.iosInstall) { this.$('m-install-meta').textContent = 'Tap the Share button, then “Add to Home Screen”.'; return; }
    const p = IS.installPrompt;
    if (!p) return;
    p.prompt();
    Promise.resolve(p.userChoice).then(() => { IS.installPrompt = null; this.refreshInstall(); }).catch(() => {});
  }
};
