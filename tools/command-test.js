#!/usr/bin/env node
// Checks the "tell them what to do" parser against phrasings people actually
// type. Each case is given to Iroh. Run: node tools/command-test.js
const path = require('path');
const fs = require('fs');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

// [what you type, expected]   k = kind, t = topic, to = who, ab = about whom, act = activity, w = with whom
const CASES = [
  // Plain activities
  ['go fishing', { k: 'act', act: 'fish' }], ['fish', { k: 'act', act: 'fish' }], ['catch some fish', { k: 'act', act: 'fish' }],
  ['take a nap', { k: 'act', act: 'sleep' }], ['go to sleep', { k: 'act', act: 'sleep' }], ['go to bed', { k: 'act', act: 'sleep' }], ['get some rest', { k: 'act', act: 'sleep' }],
  ['eat something', { k: 'act', act: 'eat' }], ['grab a bite', { k: 'act', act: 'eat' }], ['have lunch', { k: 'act', act: 'eat' }],
  ['go swimming', { k: 'act', act: 'swim' }], ['go for a swim', { k: 'act', act: 'swim' }], ['take a dip in the sea', { k: 'act', act: 'swim' }],
  ['go to the beach', { k: 'act', act: 'beach' }], ['relax on the beach', { k: 'act', act: 'beach' }], ['sunbathe', { k: 'act', act: 'beach' }],
  ['tend the garden', { k: 'act', act: 'garden' }], ['water the plants', { k: 'act', act: 'garden' }], ['go do some gardening', { k: 'act', act: 'garden' }],
  ['chop wood', { k: 'act', act: 'chop' }], ['chop some wood please', { k: 'act', act: 'chop' }], ['go cut some trees', { k: 'act', act: 'chop' }],
  ['read a book', { k: 'act', act: 'read' }], ['go read', { k: 'act', act: 'read' }],
  ['look at the stars', { k: 'act', act: 'stargaze' }], ['go stargazing', { k: 'act', act: 'stargaze' }],
  ['pet the cat', { k: 'act', act: 'petCat' }], ['go play with Biscuit', { k: 'act', act: 'petCat' }],
  ['go home', { k: 'act', act: 'home' }], ['relax at home', { k: 'act', act: 'home' }],
  ['go for a walk', { k: 'act', act: 'wander' }], ['explore the island', { k: 'act', act: 'wander' }],
  ['go forage for mushrooms', { k: 'act', act: 'forage' }], ['pick some berries', { k: 'act', act: 'forage' }],
  ['hang out at the plaza', { k: 'act', act: 'plaza' }],
  ['Iroh go fishing', { k: 'act', act: 'fish' }], ['tell Iroh to go swimming', { k: 'act', act: 'swim' }], ['can you please go fishing', { k: 'act', act: 'fish' }],
  ['go fishing then swim', { k: 'act', act: 'fish' }],
  // Stop
  ['stop', { k: 'stop' }], ['stay there', { k: 'stop' }], ["don't go fishing", { k: 'stop' }], ['stop what you are doing', { k: 'stop' }],
  // Talking to someone
  ['talk to Lynn', { k: 'social', t: null, to: 'Lynn' }], ['chat with Egg', { k: 'social', t: null, to: 'Egg' }], ['go see Forest', { k: 'social', t: null, to: 'Forest' }],
  ['Lynn', { k: 'social', t: null, to: 'Lynn' }], ['visit Jude', { k: 'social', t: null, to: 'Jude' }], ['say hi to Beach', { k: 'social', t: null, to: 'Beach' }],
  ['go hang out with Egg', { k: 'social', t: null, to: 'Egg' }], ['catch up with Forest', { k: 'social', t: null, to: 'Forest' }], ['find Lynn', { k: 'social', t: null, to: 'Lynn' }],
  // Talking ABOUT someone (the bug Mav hit)
  ['chat with Lynn about Forest', { k: 'social', t: 'askAbout', to: 'Lynn', ab: 'Forest' }],
  ['talk to Egg about Beach', { k: 'social', t: 'askAbout', to: 'Egg', ab: 'Beach' }],
  ['ask Jude about Lynn', { k: 'social', t: 'askAbout', to: 'Jude', ab: 'Lynn' }],
  ['ask Forest what he thinks of Beach', { k: 'social', t: 'askAbout', to: 'Forest', ab: 'Beach' }],
  ['what does Lynn think of Jude', { k: 'social', t: 'askAbout', to: 'Lynn', ab: 'Jude' }],
  ['tell Beach what you think of Jude', { k: 'social', to: 'Beach' }],
  ['tell lynn how you feel about forest', { k: 'social', to: 'Lynn' }],
  ['share your thoughts on Egg with Jude', { k: 'social', to: 'Jude' }],
  ['talk about Lynn with Egg', { k: 'social', t: 'askAbout', to: 'Egg', ab: 'Lynn' }],
  ['go talk to Lynn about Forest please', { k: 'social', t: 'askAbout', to: 'Lynn', ab: 'Forest' }],
  ['speak with Beach regarding Jude', { k: 'social', t: 'askAbout', to: 'Beach', ab: 'Jude' }],
  ['find out what Egg thinks about Forest', { k: 'social', t: 'askAbout', to: 'Egg', ab: 'Forest' }],
  // Gossip
  ['gossip about Forest', { k: 'social', t: 'gossipBad', ab: 'Forest' }],
  ['trash talk Beach to Lynn', { k: 'social', t: 'gossipBad', to: 'Lynn', ab: 'Beach' }],
  ['complain about Jude to Egg', { k: 'social', t: 'gossipBad', to: 'Egg', ab: 'Jude' }],
  ['say nice things about Egg to Jude', { k: 'social', t: 'gossipGood', to: 'Jude', ab: 'Egg' }],
  ['put in a good word for Forest with Lynn', { k: 'social', t: 'gossipGood', to: 'Lynn', ab: 'Forest' }],
  ['gossip with Egg about Beach', { k: 'social', t: 'gossipBad', to: 'Egg', ab: 'Beach' }],
  // Topics
  ['talk to Egg about the cat', { k: 'social', t: 'cat', to: 'Egg' }],
  ['chat with Lynn about the weather', { k: 'social', t: 'weather', to: 'Lynn' }],
  ['talk to Forest about the dinner', { k: 'social', t: 'eventSoon', to: 'Forest' }],
  ['ask Egg about his crush', { k: 'social', t: 'tease', to: 'Egg' }],
  ['talk to Jude about the future', { k: 'social', t: 'future', to: 'Jude' }],
  ['tell Forest about your dream', { k: 'social', t: 'dream', to: 'Forest' }],
  ['talk to Egg about the plan', { k: 'social', t: 'catchphrase', to: 'Egg' }],
  ['talk to Lynn about fishing', { k: 'social', to: 'Lynn' }],
  ['ask Beach about the news', { k: 'social', t: 'rumor', to: 'Beach' }],
  ['talk to Forest about the lighthouse', { k: 'social', t: 'mystery', to: 'Forest' }],
  // Social actions
  ['flirt with Lynn', { k: 'social', t: 'flirt', to: 'Lynn' }], ['rizz up Beach', { k: 'social', t: 'flirt', to: 'Beach' }], ['hit on Lynn', { k: 'social', t: 'flirt', to: 'Lynn' }],
  ['kiss Lynn', { k: 'social', t: 'flirt', to: 'Lynn' }], ['ask Lynn out', { k: 'social', t: 'confess', to: 'Lynn' }], ['confess to Beach', { k: 'social', t: 'confess', to: 'Beach' }],
  ['tell Lynn how he feels', { k: 'social', t: 'confess', to: 'Lynn' }],
  ['apologize to Beach', { k: 'social', t: 'apology', to: 'Beach' }], ['say sorry to Jude', { k: 'social', t: 'apology', to: 'Jude' }], ['make up with Beach', { k: 'social', t: 'apology', to: 'Beach' }],
  ['pick a fight with Jude', { k: 'social', t: 'argue', to: 'Jude' }], ['argue with Beach', { k: 'social', t: 'argue', to: 'Beach' }], ['yell at Egg', { k: 'social', t: 'argue', to: 'Egg' }],
  ['roast Egg', { k: 'social', t: 'roast', to: 'Egg' }], ['make fun of Forest', { k: 'social', t: 'roast', to: 'Forest' }], ['tease Jude', { k: 'social', t: 'roast', to: 'Jude' }],
  ['compliment Lynn', { k: 'social', t: 'compliment', to: 'Lynn' }], ['be nice to Beach', { k: 'social', t: 'compliment', to: 'Beach' }], ['hug Egg', { k: 'social', t: 'compliment', to: 'Egg' }],
  ['tell Egg a joke', { k: 'social', t: 'joke', to: 'Egg' }], ['make Forest laugh', { k: 'social', t: 'joke', to: 'Forest' }],
  ['cheer up Egg', { k: 'social', t: 'comfort', to: 'Egg' }], ['comfort Lynn', { k: 'social', t: 'comfort', to: 'Lynn' }], ['check on Beach', { k: 'social', t: 'comfort', to: 'Beach' }],
  ['thank Lynn', { k: 'social', t: 'thanks', to: 'Lynn' }],
  ['tell Egg a joke about Forest', { k: 'social', t: 'joke', to: 'Egg' }],
  // Doing things with someone
  ['go fishing with Egg', { k: 'actWith', act: 'fish', w: 'Egg' }], ['swim with Forest', { k: 'actWith', act: 'swim', w: 'Forest' }],
  ['go to the beach with Jude', { k: 'actWith', act: 'beach', w: 'Jude' }], ['take Egg swimming', { k: 'actWith', act: 'swim', w: 'Egg' }],
  ['invite Lynn to go stargazing', { k: 'actWith', act: 'stargaze', w: 'Lynn' }], ['bring Forest to the garden', { k: 'actWith', act: 'garden', w: 'Forest' }],
  ['go for a walk with Lynn', { k: 'actWith', act: 'wander', w: 'Lynn' }], ['look at the stars with Lynn', { k: 'actWith', act: 'stargaze', w: 'Lynn' }],
  ['tell Forest to go fishing', { k: 'social', t: 'hangout', to: 'Forest' }], ['ask Egg to come swimming', { k: 'social', t: 'hangout', to: 'Egg' }],
  ['learn fishing from Egg', { k: 'social', t: 'teach', to: 'Egg' }], ['ask Lynn to teach him gardening', { k: 'social', t: 'teach', to: 'Lynn' }],
  // Needs a name / can't do
  ['flirt', { k: 'needWho' }], ['apologize', { k: 'needWho' }], ['go talk to someone', { k: 'needWho' }],
  ['dance', { k: 'unknown' }], ['do a backflip', { k: 'unknown' }], ['build a rocket', { k: 'unknown' }], ['asdfgh', { k: 'unknown' }],
];

// Phrasings written separately and NOT used while building the parser,
// to check it understands new wording rather than memorising the list above.
const HELDOUT = [
  ['yo go catch some fish', { k: 'act', act: 'fish' }], ['nap time', { k: 'act', act: 'sleep' }], ['sleep pls', { k: 'act', act: 'sleep' }],
  ['go eat', { k: 'act', act: 'eat' }], ['get food', { k: 'act', act: 'eat' }], ['hit the beach', { k: 'act', act: 'beach' }],
  ['go chill at the beach', { k: 'act', act: 'beach' }], ['swim in the ocean', { k: 'act', act: 'swim' }], ['do some farming', { k: 'act', act: 'garden' }],
  ['harvest the crops', { k: 'act', act: 'garden' }], ['go get some wood', { k: 'act', act: 'chop' }], ['wander around', { k: 'act', act: 'wander' }],
  ['stargaze tonight', { k: 'act', act: 'stargaze' }], ['cuddle the cat', { k: 'act', act: 'petCat' }], ['head home', { k: 'act', act: 'home' }],
  ['quit fishing', { k: 'stop' }], ['freeze', { k: 'stop' }],
  ['talk to lynn', { k: 'social', t: null, to: 'Lynn' }], ['go chat w Egg', { k: 'social', t: null, to: 'Egg' }], ['hang with jude', { k: 'social', t: null, to: 'Jude' }],
  ['ask lynn what she thinks about forest', { k: 'social', t: 'askAbout', to: 'Lynn', ab: 'Forest' }],
  ['go ask Egg about Jude', { k: 'social', t: 'askAbout', to: 'Egg', ab: 'Jude' }],
  ['chat with forest about lynn', { k: 'social', t: 'askAbout', to: 'Forest', ab: 'Lynn' }],
  ['find out how Jude feels about Beach', { k: 'social', t: 'askAbout', to: 'Jude', ab: 'Beach' }],
  ['talk to Egg about Forest and Lynn', { k: 'social', t: 'askAbout', to: 'Egg', ab: 'Forest' }],
  ['talk smack about Jude to Lynn', { k: 'social', t: 'gossipBad', to: 'Lynn', ab: 'Jude' }],
  ['rant to Egg about Beach', { k: 'social', t: 'gossipBad', to: 'Egg', ab: 'Beach' }],
  ['flirt w lynn', { k: 'social', t: 'flirt', to: 'Lynn' }], ['go flirt with beach', { k: 'social', t: 'flirt', to: 'Beach' }],
  ['tell lynn you like her', { k: 'social', t: 'confess', to: 'Lynn' }], ['apologise to jude', { k: 'social', t: 'apology', to: 'Jude' }],
  ['start beef with Jude', { k: 'social', t: 'argue', to: 'Jude' }], ['diss forest', { k: 'social', t: 'roast', to: 'Forest' }],
  ['hype up egg', { k: 'social', t: 'compliment', to: 'Egg' }], ['tell forest a joke', { k: 'social', t: 'joke', to: 'Forest' }],
  ['console Beach', { k: 'social', t: 'comfort', to: 'Beach' }], ['talk to forest about the weather', { k: 'social', t: 'weather', to: 'Forest' }],
  ['ask jude about his love life', { k: 'social', t: 'tease', to: 'Jude' }], ['talk to Lynn about the bonfire', { k: 'social', t: 'eventSoon', to: 'Lynn' }],
  ['go fishing w egg', { k: 'actWith', act: 'fish', w: 'Egg' }], ['take lynn stargazing', { k: 'actWith', act: 'stargaze', w: 'Lynn' }],
  ['go for a swim with jude', { k: 'actWith', act: 'swim', w: 'Jude' }], ['convince Egg to go swimming', { k: 'social', t: 'hangout', to: 'Egg' }],
  ['juggle', { k: 'unknown' }], ['flirt with someone', { k: 'needWho' }],
];

(async () => {
  const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const page = await browser.newPage();
  page.on('pageerror', e => console.error('PAGE ERROR', e.message));
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForFunction(() => window.sim && window.sim.menu, null, { timeout: 60000 });
  const res = await page.evaluate(cases => {
    const iroh = sim.byName('Iroh');
    return cases.map(([text, exp, set]) => {
      const o = IS.Command.parse(text, iroh, sim.people);
      const got = { k: o.kind, t: o.topic === undefined ? undefined : o.topic, to: o.target ? o.target.name : undefined, ab: o.extra && (o.extra.subject || o.extra.third) ? (o.extra.subject || o.extra.third).name : undefined, act: o.act, w: o.with ? o.with.name : undefined };
      const bad = Object.entries(exp).filter(([k, v]) => got[k] !== v).map(([k, v]) => `${k}: want ${v}, got ${got[k]}`);
      return { text, set, ok: !bad.length, bad, what: o.what || o.reason };
    });
  }, CASES.concat(HELDOUT.map(c => [c[0], c[1], 'heldout'])));
  const fails = res.filter(r => !r.ok);
  for (const f of fails) console.log(`FAIL${f.set ? ' [held-out]' : ''}  "${f.text}"  ->  ${f.bad.join('; ')}   (${f.what})`);
  const main = res.filter(r => !r.set), held = res.filter(r => r.set);
  const pct = list => `${list.filter(r => r.ok).length}/${list.length} (${Math.round(list.filter(r => r.ok).length / list.length * 100)}%)`;
  console.log(`\nmain set ${pct(main)}   held-out set ${pct(held)}`);
  if (process.argv.includes('--show')) for (const r of res) console.log(`${r.ok ? 'ok  ' : 'FAIL'}  "${r.text}" -> ${r.what}`);
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})();
