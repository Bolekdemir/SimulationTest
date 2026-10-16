#!/usr/bin/env node
// Checks the smarter whisper reading (questions, chained orders, typos,
// pronouns, places, little actions). Each case is given to Iroh.
// Run: node tools/whisper-test.js   (add --show to print every answer)
// tools/whisper-heldout.js is a held-out set written without looking at the code.
const path = require('path');
const fs = require('fs');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

// [what you type, expected first order]  n = how many orders in total
const CASES = [
  // Questions, answered from their real state
  ['how are you?', { k: 'ask', q: 'mood' }], ['hru', { k: 'ask', q: 'mood' }], ['you ok?', { k: 'ask', q: 'mood' }], ['how is it going', { k: 'ask', q: 'mood' }],
  ['what are you doing?', { k: 'ask', q: 'doing' }], ['wyd', { k: 'ask', q: 'doing' }], ['what are you up to', { k: 'ask', q: 'doing' }],
  ['why are you sad?', { k: 'ask', q: 'why' }], ["what's wrong?", { k: 'ask', q: 'why' }],
  ['who do you like?', { k: 'ask', q: 'crush' }], ["who's your crush", { k: 'ask', q: 'crush' }], ['are you dating anyone?', { k: 'ask', q: 'crush' }],
  ['who is your best friend?', { k: 'ask', q: 'bff' }], ['who do you hate?', { k: 'ask', q: 'enemy' }],
  ['what do you think of Forest?', { k: 'ask', q: 'opinion', ab: 'Forest' }], ['do you like lynn?', { k: 'ask', q: 'opinion', ab: 'Lynn' }], ['how do you feel about Beach?', { k: 'ask', q: 'opinion', ab: 'Beach' }],
  ['is jude nice?', { k: 'ask', q: 'opinion', ab: 'Jude' }], ['tell me about egg', { k: 'ask', q: 'opinion', ab: 'Egg' }],
  ['are you scared of me?', { k: 'ask', q: 'sky' }], ['what do you think of me?', { k: 'ask', q: 'sky' }],
  ['are you hungry?', { k: 'ask', q: 'hungry' }], ['are you tired?', { k: 'ask', q: 'tired' }], ['are you bored', { k: 'ask', q: 'bored' }],
  ['where are you?', { k: 'ask', q: 'where' }], ['what do you want to do today?', { k: 'ask', q: 'want' }], ["what's new?", { k: 'ask', q: 'news' }],
  ['tell me a secret', { k: 'ask', q: 'secret' }], ['what are your hobbies?', { k: 'ask', q: 'loves' }], ['how old are you?', { k: 'ask', q: 'age' }],
  // Questions that are really orders
  ['do you want to go fishing?', { k: 'act', act: 'fish' }], ['can you go swimming?', { k: 'act', act: 'swim' }],
  // Chains
  ['eat then go fishing', { k: 'act', act: 'eat', n: 2 }], ['go fishing and then take a nap', { k: 'act', act: 'fish', n: 2 }],
  ['take a nap, then read a book, then go swimming', { k: 'act', act: 'sleep', n: 3 }], ['after you eat, go chop wood', { k: 'act', act: 'eat', n: 2 }],
  ['before you go fishing, eat something', { k: 'act', act: 'eat', n: 2 }], ['go fishing and take a nap', { k: 'act', act: 'fish', n: 2 }],
  ['go fishing with egg and lynn', { k: 'actWith', act: 'fish', w: 'Egg' }],
  // Typos
  ['go fihsing', { k: 'act', act: 'fish' }], ['flrit with lyn', { k: 'social', t: 'flirt', to: 'Lynn' }], ['talk to frest', { k: 'social', to: 'Forest' }],
  ['go swiming with jdue', { k: 'actWith', act: 'swim', w: 'Jude' }], ['apologize to beech', { k: 'social', t: 'apology', to: 'Beach' }],
  // Pronouns
  ['find lynn and hug her', { k: 'social', to: 'Lynn', n: 2 }],
  // Places
  ['go to the dock', { k: 'goto', place: 'the dock' }], ['walk to the lighthouse', { k: 'goto', place: 'the lighthouse' }], ['head into the woods', { k: 'goto', place: 'the Old Oak' }],
  ["go to egg's house", { k: 'goto', place: 'house' }], ['go to the hall', { k: 'goto', place: 'the Hall' }], ['go fishing at the dock', { k: 'act', act: 'fish' }],
  // Little actions and feelings
  ['dance', { k: 'emote' }], ['sing a song', { k: 'emote' }], ['do a little jump', { k: 'emote' }], ['flex', { k: 'emote' }],
  ['calm down', { k: 'soothe' }], ['cheer up', { k: 'soothe' }], ["it's okay", { k: 'soothe' }], ['wake up', { k: 'wake' }],
  ['say "hello everyone"', { k: 'say' }], ['shout "I LOVE FISH"', { k: 'say' }],
  ['avoid beach', { k: 'avoid', to: 'Beach' }], ['stay away from jude', { k: 'avoid', to: 'Jude' }], ['break up with lynn', { k: 'social', t: 'breakup', to: 'Lynn' }],
  ['pray', { k: 'act', act: 'pray' }],
  // Couple stuff (Iroh is single in the test, so dates turn into asking someone out)
  ['kiss lynn', { k: 'social', t: 'kiss', to: 'Lynn' }], ['propose to jude', { k: 'social', t: 'propose', to: 'Jude' }], ['ask beach to marry you', { k: 'social', t: 'propose', to: 'Beach' }],
  ['give forest a gift', { k: 'social', t: 'gift', to: 'Forest' }], ['bring egg some flowers', { k: 'social', t: 'gift', to: 'Egg' }], ['make up with jude', { k: 'social', t: 'makeUp', to: 'Jude' }],
  ['take lynn on a date', { k: 'social', t: 'flirt', to: 'Lynn' }], ['watch the sunset with beach', { k: 'social', t: 'flirt', to: 'Beach' }],
  // Still the classics
  ['chat with Lynn about Forest', { k: 'social', t: 'askAbout', to: 'Lynn', ab: 'Forest' }], ['go fishing with Egg', { k: 'actWith', act: 'fish', w: 'Egg' }],
  ['what does Lynn think of Jude', { k: 'social', t: 'askAbout', to: 'Lynn', ab: 'Jude' }], ['flirt', { k: 'needWho' }], ['juggle', { k: 'unknown' }],
];
let HELDOUT = [];
try { HELDOUT = require('./whisper-heldout.js'); } catch (e) { /* not written yet */ }

(async () => {
  const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const page = await browser.newPage();
  page.on('pageerror', e => console.error('PAGE ERROR', e.message));
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForFunction(() => window.sim && window.sim.menu, null, { timeout: 60000 });
  const res = await page.evaluate(cases => {
    const iroh = sim.byName('Iroh');
    return cases.map(([text, exp, set]) => {
      sim.whisperRef = {};
      const orders = IS.Command.understand(sim, iroh, text);
      const o = orders[0];
      const who = x => (x ? x.name : undefined);
      const got = { k: o.kind, q: o.q, t: o.topic === undefined ? undefined : o.topic, to: who(o.target), ab: who(o.about) || who(o.extra && (o.extra.subject || o.extra.third)), act: o.act, w: who(o.with), place: o.place, n: orders.length, e: o.kind === 'emote' ? o.k : undefined, text: o.text };
      const bad = Object.entries(exp).filter(([k, v]) => got[k] !== v).map(([k, v]) => `${k}: want ${v}, got ${got[k]}`);
      const answer = o.kind === 'ask' ? IS.Command.answer(sim, iroh, o) : null;
      return { text, set, ok: !bad.length, bad, what: orders.map(x => x.what || x.reason).join(' | '), answer };
    });
  }, CASES.concat(HELDOUT.map(c => [c[0], c[1], 'heldout'])));
  const fails = res.filter(r => !r.ok);
  for (const f of fails) console.log(`FAIL${f.set ? ' [held-out]' : ''}  "${f.text}"  ->  ${f.bad.join('; ')}   (${f.what})`);
  const main = res.filter(r => !r.set), held = res.filter(r => r.set);
  const pct = list => (list.length ? `${list.filter(r => r.ok).length}/${list.length} (${Math.round(list.filter(r => r.ok).length / list.length * 100)}%)` : 'none');
  console.log(`\nmain set ${pct(main)}   held-out set ${pct(held)}`);
  if (process.argv.includes('--show')) for (const r of res) console.log(`${r.ok ? 'ok  ' : 'FAIL'}  "${r.text}" -> ${r.what}${r.answer ? '  =>  ' + r.answer : ''}`);
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})();
