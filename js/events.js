// Island calendar, weather and random happenings.
//  Mon  quiet day
//  Tue  Fishing Contest at the dock (15:00)
//  Wed  Supply boat arrives (morning)
//  Thu  Story Night at the Hall (20:00)
//  Fri  Community Dinner at the Hall (19:00), someone cooks from 17:15
//  Sat  Beach Bonfire (20:00), Game Night at the Hall if it rains
//  Sun  Picnic in the west meadow (12:00), indoors if it rains
//  + birthdays, storms, dolphins, shooting stars, bottles, colds
IS.WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
IS.SEASONS = ['Spring', 'Summer', 'Fall', 'Winter'];

IS.Events = class {
  constructor(sim) {
    this.sim = sim;
    this.list = [];
    this.boat = null;
    this.dolphins = null;
    this.bottle = null;
    this.stars = [];
    this.scheduled = new Set();
    this.lastDolphinDay = -9;
    this.lastMinute = -1;
  }

  // ------------------------------------------------------------ schedule
  scheduleDay(day) {
    if (this.scheduled.has(day)) return;
    this.scheduled.add(day);
    const sim = this.sim;
    const wd = sim.weekdayOf(day);
    const H = h => Math.round(h * 60);
    const mk = (o) => {
      const ev = Object.assign({ id: o.kind + '-' + day, day, state: 'upcoming', attendees: new Map(), scores: {}, announced: false }, o);
      ev.thought = p => this.thoughtFor(ev, p);
      this.list.push(ev);
      return ev;
    };
    const bdays = sim.people.filter(p => sim.isBirthday(p, day));
    let dinner = null;
    if (wd === 4) {
      dinner = mk({ kind: 'dinner', name: 'Friday Dinner', start: H(19), end: H(21.25), seat: 'hallSeat', place: 'the Hall', cookStart: H(17.25) });
    }
    if (wd === 1) mk({ kind: 'contest', name: 'Fishing Contest', start: H(15), end: H(17), seat: 'fish', seatFilter: s => !s.shore, place: 'the dock' });
    if (wd === 2) mk({ kind: 'boatDay', name: 'Supply Boat', start: H(9.5), end: H(12), place: 'the dock', noSeats: true });
    if (wd === 3) mk({ kind: 'story', name: 'Story Night', start: H(20), end: H(21.5), seat: 'hallSeat', place: 'the Hall' });
    if (wd === 5) mk({ kind: 'bonfire', name: 'Beach Bonfire', start: H(20), end: H(23), seat: 'bonfireSeat', place: 'the beach', outdoor: true });
    if (wd === 6) mk({ kind: 'picnic', name: 'Sunday Picnic', start: H(12), end: H(14), seat: 'picnicSeat', place: 'the west meadow', outdoor: true });
    for (const b of bdays) {
      if (dinner) { dinner.name = `${b.name}'s Birthday Dinner`; dinner.birthday = b.name; continue; }
      const early = wd === 3 || wd === 5;
      mk({ kind: 'party', name: `${b.name}'s Birthday Party`, start: early ? H(17.5) : H(18.5), end: early ? H(19.5) : H(20.5), seat: 'hallSeat', place: 'the Hall', birthday: b.name, cookStart: early ? H(16) : H(17) });
    }
  }

  decideAttendance(ev) {
    for (const p of this.sim.people) {
      if (ev.noSeats) continue;
      const t = p.traits;
      const avgF = Object.values(p.rel).reduce((s, r) => s + r.friendship, 0) / Math.max(1, Object.keys(p.rel).length);
      let pr = 0.3 + t.sociable * 0.45 + avgF / 250 - t.grumpy * 0.15;
      if (ev.kind === 'dinner') pr += 0.3;
      if (ev.kind === 'party') pr += 0.35;
      if (ev.kind === 'contest') pr += (p.loves.includes('fishing') ? 0.4 : -0.1) + t.hardworking * 0.1;
      if (ev.kind === 'story') pr += 0.1 + (1 - t.energetic) * 0.2;
      if (ev.kind === 'bonfire') pr += (p.loves.includes('stargazing') || p.loves.includes('beach') ? 0.2 : 0);
      if (ev.kind === 'picnic') pr += 0.1;
      pr = IS.clamp(pr, 0.05, 0.97);
      let go = Math.random() < pr;
      if (ev.birthday === p.name || ev.host === p.name) go = true;
      if (ev.birthday && ev.birthday !== p.name && p.relTo(ev.birthday).friendship > 20) go = true;
      ev.attendees.set(p.name, go);
    }
    if ((ev.kind === 'dinner' || ev.kind === 'party') && !ev.host) {
      const cands = this.sim.people.filter(p => ev.attendees.get(p.name) && p.name !== ev.birthday && !p.sick);
      if (cands.length) {
        const host = cands.map(p => ({ p, w: 0.2 + p.traits.hardworking + (p.loves.includes('cooking') ? 1 : 0) + p.traits.kind * 0.5 })).sort((a, b) => b.w - a.w);
        const week = Math.floor(this.sim.clock.day / 7);
        ev.host = host[week % Math.min(2, host.length)].p.name;
      }
    }
    if (ev.kind === 'story') {
      const att = this.sim.people.filter(p => ev.attendees.get(p.name));
      ev.storyteller = att.sort((a, b) => (b.cfg.age || 30) / 100 + b.traits.sociable - ((a.cfg.age || 30) / 100 + a.traits.sociable))[0]?.name;
    }
  }

  today() { return this.list.filter(e => e.day === this.sim.clock.day); }
  nextEvent() {
    const { day, min } = this.sim.clock;
    return this.list.filter(e => (e.day === day && e.start > min) || e.day === day + 1).sort((a, b) => a.day - b.day || a.start - b.start)[0] || null;
  }
  eventFor(p) {
    const { day, min } = this.sim.clock;
    for (const e of this.list) {
      if (e.day !== day || e.state === 'done' || e.noSeats) continue;
      if (!e.attendees.get(p.name)) continue;
      if (p.sick) continue;
      if (e.host === p.name && e.cookStart !== undefined && min < e.start - 5) continue;
      if (min >= e.start - 35 && min < e.end - 10) return e;
    }
    return null;
  }
  cookingFor(p) {
    const { day, min } = this.sim.clock;
    return this.list.find(e => e.day === day && e.host === p.name && e.cookStart !== undefined && min >= e.cookStart && min < e.start - 8 && e.state !== 'done') || null;
  }

  thoughtFor(ev, p) {
    switch (ev.kind) {
      case 'dinner': return ev.birthday === p.name ? 'A birthday dinner, just for me!' : 'Friday dinner with everyone. Best night of the week.';
      case 'party': return ev.birthday === p.name ? 'It\'s my party! Cake time!' : `Happy birthday, ${ev.birthday}!`;
      case 'contest': return 'This year the trophy is MINE.';
      case 'story': return ev.storyteller === p.name ? 'Gather round, I have a tale for you.' : 'Story time! I hope it\'s the squid one.';
      case 'bonfire': return ev.indoor ? 'Rained out... game night it is!' : 'Fire, stars, and friends.';
      case 'picnic': return ev.indoor ? 'Picnic indoors. Still counts.' : 'Sandwiches in the sunshine!';
      default: return 'Fun times!';
    }
  }

  // ------------------------------------------------------------ attendees
  onArrive(p, ev) {
    if (ev.kind === 'contest') { p.pose = 'fish'; if (p.action) p.action.pose = 'fish'; }
    if (ev.birthday && ev.birthday !== p.name && !ev['gift_' + p.name]) {
      const b = this.sim.byName(ev.birthday);
      if (b) {
        ev['gift_' + p.name] = true;
        p.emote('gift', 2.5);
        b.changeRel(p.name, 6); p.changeRel(b.name, 3);
        b.addMood('Birthday gifts', 5, 600);
      }
    }
    if (Math.random() < 0.4) p.emote(IS.pick(['note', 'heart', 'sparkle']), 1.8);
  }

  tickAttendee(p, ev, dt) {
    const { min } = this.sim.clock;
    if (min < ev.start) return;
    p.needs.social = Math.min(100, p.needs.social + 0.07 * dt);
    p.needs.fun = Math.min(100, p.needs.fun + 0.05 * dt);
    if ((ev.kind === 'dinner' || ev.kind === 'party' || ev.kind === 'picnic') && p.needs.hunger < 100) {
      p.needs.hunger = Math.min(100, p.needs.hunger + 0.9 * dt);
    }
    if (ev.kind === 'contest') {
      p.acc = (p.acc || 0) + dt;
      if (p.acc >= 12) {
        p.acc = 0;
        if (Math.random() < 0.42 + (p.loves.includes('fishing') ? 0.15 : 0)) {
          ev.scores[p.name] = (ev.scores[p.name] || 0) + 1;
          this.sim.world.food++;
          p.emote('fish', 1.6);
          this.sim.fx.splash(p.bobberX(), p.bobberY(), 5);
        }
      }
    }
    if (ev.kind === 'story' && ev.storyteller === p.name) {
      ev.storyAcc = (ev.storyAcc || 0) + dt;
      if (ev.storyAcc >= 5) {
        ev.storyAcc = 0;
        const lines = [...(p.cfg.catchphrases || []), '...and THAT\'s when the squid grabbed the anchor!', 'The fog was so thick you could slice it like bread.', 'Legend says the old keeper still walks the cliffs.', 'We sailed nine days with nothing but a cabbage.', 'And the wave was THIS tall. Taller, actually.'];
        p.say(IS.pick(lines));
        for (const o of this.sim.people) if (o !== p && o.action && o.action.event === ev && Math.random() < 0.5) o.emote(IS.pick(['note', 'exclaim', 'sparkle']), 1.5);
      }
    }
    if (ev.kind === 'bonfire' && !ev.indoor && Math.random() < dt * 0.02) p.emote('note', 1.5);
  }

  // ------------------------------------------------------------ main loop
  update(dt) {
    const sim = this.sim, c = sim.clock;
    if (!this.scheduled.has(c.day) || !this.scheduled.has(c.day + 1)) {
      this.list = this.list.filter(e => e.day >= c.day - 1);
      this.scheduleDay(c.day);
      this.scheduleDay(c.day + 1);
    }

    const minute = Math.floor(c.abs);
    if (minute === this.lastMinute) { this.updateBoat(dt); return; }
    const steps = this.lastMinute < 0 ? 1 : Math.min(30, minute - this.lastMinute);
    for (let s = steps - 1; s >= 0; s--) this.onMinute(minute - s);
    this.lastMinute = minute;
    this.updateBoat(dt);
  }

  onMinute(absMin) {
    const sim = this.sim;
    const day = Math.floor(absMin / 1440) + 1;
    const min = absMin % 1440;
    if (day !== sim.clock.day) return;

    if (min === 0) this.newDay();
    if (min === 5 * 60) this.rollWeather(true);
    if (min === 13 * 60 && Math.random() < 0.3) this.rollWeather(false);
    if (min === 9 * 60 + 30 && sim.weather === 'fog') this.setWeather(Math.random() < 0.6 ? 'sunny' : 'cloudy');
    if (min === 6 * 60) this.morningChecks();

    for (const ev of this.list) {
      if (ev.day !== day) continue;
      if (!ev.announced && min >= 7 * 60) {
        ev.announced = true;
        this.decideAttendance(ev);
        sim.toast(`Today: ${ev.name} at ${ev.place}, ${IS.fmtTime(ev.start)}`);
      }
      if (ev.cookStart !== undefined && min === ev.cookStart && ev.host) {
        sim.log(`${ev.host} is cooking for the ${ev.name}.`, 'event', [sim.byName(ev.host)]);
      }
      if (!ev.noSeats && ev.announced && ev.state !== 'done' && min >= ev.start - 35 && min < ev.end - 15 && min % 5 === 0) this.callAttendees(ev);
      if (ev.state === 'upcoming' && min >= ev.start) this.startEvent(ev);
      if (ev.state === 'active' && min >= ev.end) this.endEvent(ev);
    }
    if (min % 60 === 0) this.hourly(min / 60);
    if (this.dolphins && absMin >= this.dolphins.until) { this.dolphins = null; }
  }

  callAttendees(ev) {
    for (const p of this.sim.people) {
      if (!ev.attendees.get(p.name) || p.sick || p.mode !== 'normal' || p.chat) continue;
      const a = p.action;
      if (a && (a.event === ev || a.def.id === 'cook' || a.def.id === 'attend')) continue;
      if (a && a.def.id === 'sleep' && a.night) continue;
      if (this.cookingFor(p)) continue;
      p.cancelAction();
    }
  }

  newDay() {
    const sim = this.sim;
    for (const p of sim.people) {
      for (const [name, r] of Object.entries(p.rel)) {
        const o = sim.byName(name);
        if (!o) continue;
        const baseline = (IS.Social.compat(p, o) - 0.6) * 100;
        r.friendship += (baseline - r.friendship) * 0.04;
        if (!r.partner) r.romance = Math.max(0, r.romance - 1.5);
      }
    }
    if (sim.world.food > 25) {
      const spoiled = Math.floor((sim.world.food - 25) * 0.2);
      sim.world.food -= spoiled;
      if (spoiled >= 2) sim.log(`${spoiled} portions spoiled in the overflowing pantry.`, 'warn');
    }
    const homes = new Set(sim.people.map(p => p.homeId));
    const need = homes.size * (sim.clock.season === 'Winter' || sim.clock.season === 'Fall' ? 2 : 1);
    if (sim.world.wood >= need) sim.world.wood -= need;
    else {
      sim.world.wood = 0;
      for (const p of sim.people) p.addMood('Cold house, no firewood', -6, 600);
      sim.log('The woodpile ran out. Chilly houses this morning.', 'warn');
    }
    for (const p of sim.people) {
      p.greetedBoat = false;
      p.sawDolphins = false;
      if (!p.sick) p.visitedBy.clear();
    }
    this.dolphinsToday = false;
    if (sim.isBirthdayAny()) {
      for (const p of sim.people) if (sim.isBirthday(p)) sim.log(`It's ${p.name}'s birthday today!`, 'event', [p]);
    }
  }

  morningChecks() {
    const sim = this.sim;
    for (const p of sim.people) {
      if (p.sick && Math.random() < 0.8) {
        p.sick = false;
        p.visitedBy.clear();
        sim.log(`${p.name} is feeling better.`, 'good', [p]);
        continue;
      }
      if (sim.clock.day === 1) continue;
      const risk = 0.025 + (p.wetUntil > sim.clock.abs - 600 ? 0.06 : 0);
      if (!p.sick && Math.random() < risk) {
        p.sick = true;
        p.visitedBy.clear();
        p.remember('Woke up with a nasty cold', { tag: 'sick', mood: -6 });
        sim.log(`${p.name} woke up with a cold and is staying in bed.`, 'warn', [p]);
      }
    }
  }

  startEvent(ev) {
    const sim = this.sim;
    ev.state = 'active';
    if (ev.outdoor && (sim.weather === 'rain' || sim.weather === 'storm')) {
      ev.indoor = true;
      ev.seat = 'hallSeat'; ev.seatFilter = null; ev.place = 'the Hall';
      ev.name = ev.kind === 'bonfire' ? 'Game Night' : 'Indoor Picnic';
      sim.log(`Rain moved the ${ev.kind === 'bonfire' ? 'bonfire' : 'picnic'} indoors: ${ev.name} at the Hall!`, 'event');
    }
    if (ev.kind === 'boatDay') return;
    if (ev.kind === 'bonfire' && !ev.indoor) {
      sim.world.bonfire.lit = true;
      if (sim.world.wood >= 3) sim.world.wood -= 3;
      else sim.log('Not much firewood left, so the bonfire is a small one.', 'warn');
    }
    if (ev.kind === 'dinner' || ev.kind === 'party' || ev.kind === 'picnic') {
      const cost = [...ev.attendees.values()].filter(Boolean).length;
      if (sim.world.food >= cost) { sim.world.food -= cost; ev.feast = true; }
      else { ev.feast = false; sim.log('The pantry is low, so the meal is a modest one.', 'warn'); }
    }
    sim.toast(`${ev.name} is starting at ${ev.place}!`);
    sim.log(`${ev.name} started at ${ev.place}.`, 'event');
  }

  endEvent(ev) {
    const sim = this.sim;
    ev.state = 'done';
    const went = sim.people.filter(p => ev.attendees.get(p.name) && p.action && p.action.event === ev);
    if (ev.kind === 'bonfire') sim.world.bonfire.lit = false;
    if (ev.kind === 'contest') {
      const ranked = Object.entries(ev.scores).sort((a, b) => b[1] - a[1]);
      if (ranked.length) {
        const [wname, wscore] = ranked[0];
        const w = sim.byName(wname);
        if (w) {
          w.remember(`Won the Fishing Contest with ${wscore} fish`, { tag: 'contest', mood: 15, news: true, moodDuration: 1440 });
          w.say('I WON! Bow before the champion!');
          w.emote('sparkle', 3);
        }
        for (const p of went) if (p !== w) p.remember(`Lost the Fishing Contest to ${wname}`, { tag: 'contest', mood: p.traits.grumpy > 0.5 ? -6 : 0, news: true });
        sim.log(`${wname} won the Fishing Contest with ${wscore} fish!`, 'event', [w]);
        sim.toast(`${wname} wins the Fishing Contest!`);
      } else {
        sim.log('Nobody caught a single fish at the contest. The fish win this year.', 'event');
      }
    }
    for (const p of went) {
      const good = ev.kind !== 'contest';
      if (good) p.remember(`Went to ${ev.name}`, { tag: 'event', mood: ev.feast === false ? 4 : 10, moodDuration: 720 });
      for (const o of went) if (o !== p) p.changeRel(o.name, 1);
    }
    if (went.length >= 2) sim.log(`${ev.name} wrapped up. ${went.map(p => p.name).join(', ')} had a good time.`, 'event', went);
  }

  // ------------------------------------------------------------ weather
  rollWeather(morning) {
    const sim = this.sim;
    if (sim.clock.day === 1 && morning) return this.setWeather('sunny', true);
    const table = {
      Spring: { sunny: 0.45, cloudy: 0.25, rain: 0.2, storm: 0.04, fog: 0.06 },
      Summer: { sunny: 0.62, cloudy: 0.18, rain: 0.1, storm: 0.07, fog: 0.03 },
      Fall: { sunny: 0.3, cloudy: 0.3, rain: 0.25, storm: 0.07, fog: 0.08 },
      Winter: { sunny: 0.3, cloudy: 0.35, rain: 0.2, storm: 0.05, fog: 0.1 },
    }[sim.clock.season];
    const items = Object.entries(table).filter(([k]) => morning || k !== 'fog').map(([k, w]) => ({ k, w }));
    // weather tends to persist
    for (const it of items) if (it.k === sim.weather) it.w += 0.25;
    this.setWeather(IS.weightedPick(items).k);
  }

  setWeather(w, silent) {
    const sim = this.sim;
    if (w === sim.weather) return;
    const prev = sim.weather;
    sim.weather = w;
    if (silent) return;
    const msg = {
      sunny: 'The clouds part. Sunshine over the island.',
      cloudy: 'Clouds roll in over the island.',
      rain: 'It starts to rain.',
      storm: 'A storm is rolling in! Everyone heads for cover.',
      fog: 'A thick fog settles over the island.',
    }[w];
    sim.log(msg, w === 'storm' ? 'warn' : 'weather');
    if (w === 'storm') sim.toast('Storm incoming!');
    // Storms and rain make outdoor folks reconsider
    if (w === 'storm' || w === 'rain') for (const p of sim.people) sim.nudge(p, w === 'storm' ? 0.9 : 0.4);
    if (prev === 'storm' && w !== 'rain') for (const p of sim.people) if (Math.random() < 0.3) p.remember('Survived the storm', { tag: 'storm' });
  }

  // ------------------------------------------------------------ random
  hourly(hour) {
    const sim = this.sim, w = sim.world;
    const clearDay = sim.weather === 'sunny' || sim.weather === 'cloudy';
    if (!this.dolphins && sim.clock.day - this.lastDolphinDay >= 3 && hour >= 8 && hour <= 17 && clearDay && Math.random() < 0.03) {
      this.lastDolphinDay = sim.clock.day;
      const bf = w.bonfire;
      let ty = bf.y + 3;
      while (ty < w.H - 3 && (w.isLand(bf.x, ty) || w.waterDist[w.idx(bf.x, ty)] < 3)) ty++;
      this.dolphins = { tx: bf.x + IS.randi(-4, 4), ty, until: sim.clock.abs + 70, t0: performance.now() };
      this.dolphinsToday = true;
      sim.log('Dolphins spotted off the south beach!', 'event');
      sim.toast('Dolphins off the south beach!');
      for (const p of sim.people) if (Math.random() < p.traits.curious) sim.nudge(p, 1);
    }
    if ((hour >= 21 || hour <= 2) && sim.weather === 'sunny' && Math.random() < 0.15) this.shootingStar();
    if (!this.bottle && hour >= 7 && hour <= 17 && Math.random() < 0.02) {
      const s = IS.pick((w.spots.shore || []).filter(s => !s.takenBy));
      if (s) this.bottle = { tx: s.x, ty: s.y, claimedBy: null };
    }
  }

  shootingStar() {
    const sim = this.sim;
    this.stars.push({ t0: performance.now(), x: Math.random(), y: Math.random() * 0.4 });
    const seen = sim.people.filter(p => !p.building && p.pose !== 'sleep' && p.mode === 'normal');
    for (const p of seen) {
      p.emote('sparkle', 2);
      if (Math.random() < 0.6) p.say(IS.pick(['A shooting star! Make a wish!', 'Did you see that?!', 'Ooh! Wish wish wish!']));
      p.remember('Saw a shooting star and made a wish', { tag: 'star', mood: 6, news: true });
    }
    sim.log(seen.length ? `A shooting star streaked across the sky. ${seen.map(p => p.name).join(' and ')} made a wish.` : 'A shooting star streaked across the sky. Nobody saw it.', 'event', seen);
  }

  readBottle(p) {
    const sim = this.sim;
    if (!this.bottle) return;
    const msg = IS.pick(IS.Dialogue.bottleMessages);
    this.bottle = null;
    p.remember('Found a message in a bottle', { tag: 'bottle', detail: msg, mood: 6, news: true });
    p.emote('exclaim', 2);
    p.say(`"${msg}"`, 4);
    sim.log(`${p.name} found a message in a bottle: "${msg}"`, 'event', [p]);
  }

  // ------------------------------------------------------------ supply boat
  updateBoat(dt) {
    const sim = this.sim, w = sim.world, T = IS.TILE;
    const ev = this.list.find(e => e.kind === 'boatDay' && e.day === sim.clock.day);
    const min = sim.clock.min;
    const dockX = 44 * T + 40, dockY = w.dock.endY * T + 34;
    const farX = dockX + 260, farY = (w.H + 1) * T;
    if (ev && !this.boat && min >= ev.start - 50 && min < ev.end) {
      this.boat = { x: farX, y: farY, state: 'arriving', t: 0 };
      sim.log('A sail on the horizon. The supply boat is coming!', 'event');
      for (const p of sim.people) if (Math.random() < 0.5) sim.nudge(p, 0.6);
    }
    const b = this.boat;
    if (!b) return;
    if (b.state === 'arriving') {
      const total = 50;
      b.t = Math.min(1, b.t + dt / total);
      const e = 1 - Math.pow(1 - b.t, 2);
      b.x = IS.lerp(farX, dockX, e); b.y = IS.lerp(farY, dockY, e);
      if (b.t >= 1) {
        b.state = 'docked';
        w.food += 6; w.wood += 4;
        const lucky = IS.shuffle(sim.people.slice()).slice(0, IS.randi(1, 2));
        for (const p of lucky) p.remember('Got a letter from the mainland', { tag: 'letter', mood: 8, news: true });
        sim.log(`The supply boat docked: +6 food, +4 wood, and mail for ${lucky.map(p => p.name).join(' and ')}.`, 'event', lucky);
        sim.toast('The supply boat has docked!');
      }
    } else if (b.state === 'docked') {
      b.x = dockX; b.y = dockY;
      if (!ev || min >= ev.end) { b.state = 'leaving'; b.t = 0; sim.log('The supply boat sets sail again.', 'event'); }
    } else if (b.state === 'leaving') {
      b.t = Math.min(1, b.t + dt / 45);
      const e = b.t * b.t;
      b.x = IS.lerp(dockX, farX + 200, e); b.y = IS.lerp(dockY, farY, e);
      if (b.t >= 1) this.boat = null;
    }
  }
};
