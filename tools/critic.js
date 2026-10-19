// The judge. Injected into a running simulation, it watches every line and
// every minute and scores how sensible and lively the islanders are.
// Used by tools/train.js; safe to ignore in the game itself.
window.Critic = (() => {
  const C = {};
  let sim, st;

  C.install = s => {
    sim = s;
    st = {
      lines: 0, convs: 0, convLines: [], v: {}, ex: {}, seen: new Map(), threadSeen: new Map(), threads: {}, uniq: new Set(),
      beh: { starving: 0, exhausted: 0, idle: 0, lonely: 0, loved: 0, hated: 0, active: 0, moodSum: 0, moodN: 0 },
      stuck: 0, pos: new Map(), plans: { done: 0, total: 0 }, days: 0,
    };
    const flag = (kind, text) => {
      st.v[kind] = (st.v[kind] || 0) + 1;
      (st.ex[kind] = st.ex[kind] || []).length < 4 && st.ex[kind].push(text);
    };
    C.flag = flag;

    // ---- every line spoken in a conversation
    const say0 = IS.Social.Conversation.prototype.say;
    IS.Social.Conversation.prototype.say = function (line) {
      const sp = line.sp, li = this.other(sp), text = line.text || '';
      const seg = this.segs && this.segs[this.segIdx];
      const kind = seg ? seg.kind : '?';
      const min = sim.clock.min;
      st.lines++;
      st.uniq.add(text);
      this._n = (this._n || 0) + 1;
      const tag = `${sp.name}->${li.name}: ${text}`;
      const noEvents = sim.events.list.reduce((t, e) => t.split(e.name).join(''), text);
      // Introducing yourself ("Hi! I'm Lynn.") is the one time saying your own name is fine
      const intro = seg && seg.run && seg.run.th && seg.run.th.key === 'welcome';
      if (!intro && new RegExp(`\\b${sp.name}\\b`).test(noEvents)) flag('self-name', tag);
      if ((sp.pose === 'sleep' && !sp.sick) || (li.pose === 'sleep' && !li.sick)) flag('sleep-talk', tag);
      if (IS.dist(sp.x, sp.y, li.x, li.y) > IS.TILE * 4.5 || (sp.building || null) !== (li.building || null)) flag('far-talk', `${tag} [d=${(IS.dist(sp.x, sp.y, li.x, li.y) / IS.TILE).toFixed(1)} ${sp.mode}/${li.mode} ${sp.action ? sp.action.def.id + ':' + sp.action.phase : '-'} ${li.action ? li.action.def.id + ':' + li.action.phase : '-'} b=${sp.building ? sp.building.id : '-'}/${li.building ? li.building.id : '-'} line${this._n}]`);
      if (kind === 'greet') for (const o of sim.people) if (o !== li && o !== sp && new RegExp(`\\b${o.name}\\b`).test(text)) flag('wrong-address', tag);
      if (/\bgood morning\b|^morning[.!]/i.test(text) && min >= 12 * 60) flag('time-mismatch', `${IS.fmtTime(min)} ${tag}`);
      if (/\bgood evening\b/i.test(text) && min < 16.5 * 60) flag('time-mismatch', `${IS.fmtTime(min)} ${tag}`);
      if (/\bgood ?night\b/i.test(text) && min < 20 * 60 && min > 5 * 60) flag('time-mismatch', `${IS.fmtTime(min)} ${tag}`);
      // Repeats: the same person saying the same thing within a day
      const k = sp.name + '|' + text;
      const last = st.seen.get(k);
      if (last !== undefined && sim.clock.abs - last < 1440 && text.length > 12) { flag('repeat', tag); st.rep = st.rep || {}; st.rep[text] = (st.rep[text] || 0) + 1; }
      st.seen.set(k, sim.clock.abs);
      // Questions should get an answer from the other person
      if (this._lastQ && this._lastQ.sp === sp) flag('ignored-question', this._lastQ.tag);
      this._lastQ = /\?$/.test(text.trim()) && text.length > 12 && kind !== 'bye' ? { sp, tag } : null;
      if (this._prevSp === sp && this._prevKind !== 'segue' && kind !== 'segue') flag('double-line', tag);
      this._prevSp = sp; this._prevKind = kind;
      return say0.call(this, line);
    };
    const end0 = IS.Social.Conversation.prototype.end;
    IS.Social.Conversation.prototype.end = function (aborted) {
      if (!this._ended) {
        this._ended = true;
        st.convs++;
        st.convLines.push(this._n || 0);
        if (this._lastQ && !aborted) flag('ignored-question', this._lastQ.tag);
      }
      return end0.call(this, aborted);
    };

    // ---- every topic thread that gets chosen
    const tf0 = IS.Talk.threadFor;
    IS.Talk.threadFor = (s2, a, b, topic, extra) => {
      const run = tf0(s2, a, b, topic, extra);
      if (!run) return run;
      const { th, ctx } = run;
      st.threads[th.id] = (st.threads[th.id] || 0) + 1;
      const tag = `${a.name}->${b.name} [${th.id}]`;
      if (ctx.third && (ctx.third === a || ctx.third === b) && /third/.test(JSON.stringify(th.beats.map(x => typeof x.say === 'function' ? '' : x.say)))) flag('third-is-here', tag);
      if (ctx.vars.crush && (ctx.vars.crush === a.name || ctx.vars.crush === b.name) && th.key === 'tease') flag('third-is-here', tag + ' crush');
      const n = ctx.news;
      if (n && th.key === 'rumor' && [n.a, n.b].some(x => x === a.name || x === b.name)) flag('own-news', tag);
      if (n && th.key === 'congrats' && (![n.a, n.b].includes(b.name) || [n.a, n.b].includes(a.name))) flag('own-news', tag);
      const e = IS.Mind.feeling(a);
      if (e && (e.type === 'heartbroken' || e.type === 'sulking') && ['joke', 'catchphrase', 'roast', 'flirt', 'tease'].includes(th.key)) flag('mood-mismatch', `${tag} while ${e.type}`);
      const partner = a.partner();
      if ((th.key === 'flirt' || th.key === 'confess') && partner && partner !== b) flag('cheating', tag);
      if (th.key === 'confess' && a.relTo(b.name).partner) flag('cheating', tag + ' already together');
      const pk = [a.name, b.name].sort().join('+') + '|' + th.id;
      const lt = st.threadSeen.get(pk);
      if (lt !== undefined && sim.clock.abs - lt < 720) flag('thread-repeat', tag);
      st.threadSeen.set(pk, sim.clock.abs);
      return run;
    };

    // ---- plans: count how many got done before the next morning replaces them
    const mp0 = IS.Mind.morning;
    IS.Mind.morning = s2 => {
      for (const p of s2.people) for (const pl of p.plans || []) { st.plans.total++; if (pl.done && !pl.gaveUp) st.plans.done++; }
      st.days++;
      return mp0(s2);
    };
  };

  // ---- behaviour, sampled every few sim minutes by the runner
  C.sample = mins => {
    const b = st.beh;
    for (const p of sim.people) {
      if (p.mode !== 'normal') continue;
      const asleep = p.pose === 'sleep';
      b.moodSum += p.mood(); b.moodN++;
      if (asleep) continue;
      const a = p.action;
      if (p.needs.hunger < 12 && sim.world.food > 0 && !(a && a.def.id === 'eat')) { b.starving += mins; const why = p.chat ? 'chat' : a ? a.def.id + ':' + a.phase : 'none'; st.why = st.why || {}; st.why['hungry:' + why] = (st.why['hungry:' + why] || 0) + mins; }
      if (p.needs.energy < 8 && !(a && a.def.id === 'sleep')) { b.exhausted += mins; const why = p.chat ? 'chat' : a ? a.def.id + ':' + a.phase : 'none'; st.why = st.why || {}; st.why['tired:' + why] = (st.why['tired:' + why] || 0) + mins; }
      if (!a && !p.chat) { b.idle += mins; st.why = st.why || {}; const k = 'idle:' + (p.idleUntil > sim.clock.abs ? 'waiting' : 'deciding') + ':' + (p.thought || '').slice(0, 30); st.why[k] = (st.why[k] || 0) + mins; }
      if (p.needs.social < 12) b.lonely += mins;
      if (a && a.def.love) { b.active += mins; if (p.loves.includes(a.def.love)) b.loved += mins; if (p.hates.includes(a.def.love)) b.hated += mins; }
      // Stuck: trying to walk somewhere but not moving
      const key = p.name;
      const prev = st.pos.get(key);
      const moving = a && a.phase === 'travel' && !p.chat;
      if (moving && prev && Math.abs(prev.x - p.x) + Math.abs(prev.y - p.y) < 1) { prev.n += mins; if (prev.n >= 30 && !prev.flagged) { prev.flagged = true; st.stuck++; C.flag('stuck', `${p.name} ${a.def.id} at ${p.tx},${p.ty}`); } }
      else st.pos.set(key, { x: p.x, y: p.y, n: 0 });
    }
  };

  // ---- the score
  C.report = () => {
    const days = Math.max(1, sim.clock.abs / 1440 - 0.27);
    const people = sim.people.length;
    const L = Math.max(1, st.lines);
    const per100 = k => (st.v[k] || 0) / L * 100;
    const severe = ['self-name', 'own-news', 'third-is-here', 'sleep-talk', 'cheating', 'far-talk', 'wrong-address', 'mood-mismatch'];
    const severeRate = severe.reduce((s, k) => s + per100(k), 0);
    const b = st.beh;
    const pd = people * days;
    const tvals = Object.values(st.threads);
    const tsum = tvals.reduce((s, x) => s + x, 0) || 1;
    const entropy = -tvals.reduce((s, x) => s + (x / tsum) * Math.log(x / tsum), 0) / Math.log(Math.max(2, tvals.length || 2));
    const chatsPPD = st.convs * 2 / pd;
    const avgLines = st.convLines.reduce((s, x) => s + x, 0) / Math.max(1, st.convLines.length);
    const log = sim.logEntries.map(e => e.text).join('\n');
    const fights = (log.match(/got into an argument/g) || []).length;
    const couples = (log.match(/said yes/g) || []).length;
    const band = (x, lo, hi, soft) => (x >= lo && x <= hi ? 1 : Math.max(0, 1 - (x < lo ? lo - x : x - hi) / soft));
    const m = {
      lines: st.lines, convs: st.convs, days: +days.toFixed(1), simDay: sim.clock.day,
      severePer100: +severeRate.toFixed(2),
      repeatPer100: +per100('repeat').toFixed(2), threadRepeatPerDay: +((st.v['thread-repeat'] || 0) / days).toFixed(2),
      timeMismatchPer100: +per100('time-mismatch').toFixed(2), ignoredQPer100: +per100('ignored-question').toFixed(2), doublePer100: +per100('double-line').toFixed(2),
      uniqueRatio: +(st.uniq.size / L).toFixed(3), threadEntropy: +entropy.toFixed(3), threadKinds: tvals.length,
      planDone: +(st.plans.done / Math.max(1, st.plans.total)).toFixed(3),
      mood: +(b.moodSum / Math.max(1, b.moodN)).toFixed(1),
      lovedShare: +(b.loved / Math.max(1, b.active)).toFixed(3), hatedShare: +(b.hated / Math.max(1, b.active)).toFixed(3),
      starvingHPD: +(b.starving / 60 / pd).toFixed(2), exhaustedHPD: +(b.exhausted / 60 / pd).toFixed(2), idleHPD: +(b.idle / 60 / pd).toFixed(2), lonelyHPD: +(b.lonely / 60 / pd).toFixed(2),
      stuck: st.stuck, chatsPerPersonDay: +chatsPPD.toFixed(2), avgLinesPerChat: +avgLines.toFixed(1),
      fightsPerWeek: +(fights / days * 7).toFixed(2), couples,
    };
    const score =
      - m.severePer100 * 6 - m.repeatPer100 * 1.2 - m.threadRepeatPerDay * 1 - m.timeMismatchPer100 * 4 - m.ignoredQPer100 * 2 - m.doublePer100 * 0.5
      - m.starvingHPD * 3 - m.exhaustedHPD * 3 - m.idleHPD * 4 - m.lonelyHPD * 2 - m.stuck * 1.5
      + m.uniqueRatio * 20 + m.threadEntropy * 15 + m.planDone * 15 + m.mood / 100 * 15 + m.lovedShare * 10 - m.hatedShare * 10
      + band(chatsPPD, 3, 9, 4) * 10 + band(avgLines, 7, 14, 6) * 5
      + band(m.fightsPerWeek, 1, 6, 4) * 5 + (couples >= 1 ? 3 : 0);
    m.score = +score.toFixed(2);
    return { m, v: st.v, ex: st.ex, threads: st.threads, why: st.why || {}, food: sim.world.food, rep: st.rep || {} };
  };

  return C;
})();
