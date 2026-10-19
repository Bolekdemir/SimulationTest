# Chat Export: Tidewhistle Isle, development handoff

## How to use this export
This is a record of a long earlier conversation in which an AI assistant built most of the game "Tidewhistle Isle" with the user. Read it first, then read the code in this repository. The code is the real source of truth and is not copied in here. Treat everything below as context. If something is unclear or looks out of date, ask the user rather than guessing.

## Metadata
- Exported: 2026-10-17
- Topic: building a cozy isometric pixel-art island life-sim in plain JavaScript
- Participants: the user, who likes to be called **"Mav"** (sometimes "Maverick"), and an AI coding assistant running in a cloud Claude Code session
- Scope: the whole chat. The early part of the chat was compacted into a summary before this export (see Gaps & uncertainty).
- Size: about 21,300 lines of JS in `js/`, 27 files. About 8.7 hours of wall time, of which 5 hours were API time.

## TL;DR
- Tidewhistle Isle is a browser island sim: six hand-designed islanders with rule-based "brains", god powers for the player (the "Sky Hand"), death and grief, couples and weddings, skills, a collection book, and whisper commands.
- The latest work added the **main goal: grow the island into a town**:
  - generated newcomers
  - visitors who decide whether to stay
  - an Island Rating
  - a building system (house, bakery, library, gym)
  - unhappy islanders who can leave
  - tiers, ending in a Town Festival at 12 islanders
- Everything is committed and pushed to branch `claude/tidewhistle-isle`, and published as Claude artifact Version 26.
- The user stopped the session to save usage. Phase 5–6 (balance, final tests) is only partly done; see Open questions.

## Background & context
- Repo: `bolekdemir/simulationtest` (GitHub, written `Bolekdemir/SimulationTest` in places). Work branch: **`claude/tidewhistle-isle`**. No pull requests unless the user asks.
- Play links:
  - Claude artifact (latest): https://claude.ai/artifact/HSwdpQfQo3SQPV5TaococJ (Version 26)
  - GitHub Pages: https://bolekdemir.github.io/SimulationTest/ (unverified whether Pages serves this branch, so it may be outdated)
- The player is the **Sky Hand**: a god hand that grabs, throws, smites, blesses, revives and whispers to islanders.
- The original six islanders (designed by Mav, in `js/config.js`):

  | Name | Personality |
  |---|---|
  | Iroh | Goofy, roasting, smart |
  | Forest | Serious, athletic, curly hair, cares about looks |
  | Egg | Lazy, happy, loves cats |
  | Jude | Bad boy with rizz |
  | Beach | Rich, rude, dyed blonde |
  | Lynn | Kind, smart, strawberry-blonde |

  The cat is **Biscuit**.

## Goals (how they evolved)
- The game was built up feature by feature in this order:
  1. smarter whispers
  2. god powers and graphic death
  3. a toggleable powers HUD
  4. blood and smoke that fade, plus grief stages
  5. triple the dialogue
  6. a Hall redesign
  7. "AI-level" reactions done with rules (the user chose "rule-based only, deeper": **no real LLM in the game**)
  8. a content pack
  9. couples
  10. a fix for the collection book not closing
- Then the user asked for a **main goal**. They picked the option "Grow the Island" and answered the design questions as follows (each was the recommended choice):
  - newcomers are **generated**, not hand-made
  - **islanders do the building** (the player picks what and where)
  - **people can leave**
  - the top tier means **town status, then you keep playing**
- The user's extra requirements: newcomers sometimes have **green or blue eyes**; new buildings must have **no bugs and nobody walking through them**; "make no mistakes".

## Key information & data

### Architecture
- Plain JS on a global `IS` namespace. Canvas 2D isometric rendering. No build step, no dependencies.
- Script order (in `index.html`):
  ```
  util, lines, config, tune, sprites, iso, world, dialogue, actions, newcomers, person, cat, social, talk, command, mind, save, events, gods, content, love, town, build, render, ui, input, menu, main
  ```
- `sw.js` is the service worker. Its cache name is currently `tidewhistle-v13`. Bump it and keep its file list in sync whenever files change.

### What each module does
- **Brains:**
  - `actions.js` is the utility AI. Each action def has `score`, `can`, `plan`, `tick`, `finish`, `cancel` and `thought`, lives in `IS.Actions.list`, and is chosen in `Person.decide` (top 3, weighted pick).
  - `mind.js` handles daily plans (`M.makePlans`), emotions (`M.feel`, `M.feeling`), news and gossip (`M.news`, the RUMOR templates), invites, and `M.tick`.
- **Conversations:**
  - `social.js` holds the Conversation class, topic picking, and `S.react` (how a line lands).
  - `talk.js` holds the scripted threads: `def(id, {key, beats:[{by, say, pick, judge, if}], setup, after})`, plus topic weights in `T.topics` and the guards in `T.threadFor`.
  - `lines.js` holds `IS.MoreLines`, extra lines merged into any pool by its first line, via `IS.more`.
  - `dialogue.js` holds per-person voices and line pools.
- **Whispers:** `command.js`.
  - `C.understand` → `C.special` (say, questions, breakup, avoid, wake, goto, soothe, emotes, love orders, "please stay") → `C.parse` (legacy).
  - Supporting pieces: typo fixer, chain splitting, pronoun handling.
- **God powers and death:** `gods.js` covers powers, kill, grief stages (shock → anger → sadness → acceptance), burial and revival.
- **Content:** `content.js` covers skills, the collection, extra activities and random events.
- **Couples:** `love.js` covers stages, pet names, dates, gifts, anniversaries, fights, make-ups, proposals and weddings (with the wedding event in `events.js`).
- **Town growth (new):**
  - `newcomers.js` is the generator: 8 archetypes (sunny, grump, dreamer, hustler, charmer, bookworm, adventurer, slacker) with jittered traits, looks and eye colours (`N.EYES`, including blue and green), loves, humour, bio and catchphrases.
    - **Names are chosen so the whisper typo-fixer never turns a real word into a name** (e.g. no "Milo"/milk, no "Vera"/very).
    - `N.add` adds a person at runtime.
  - `town.js` covers the Island Rating (`T.rating`), visitors (ferry arrival, two-day visit, `T.judgeVisit` decides with reasons), homes and spare rooms (`T.homeFor`, `T.addBed`, `T.moveIn`), leaving (`T.morningCheck`, `T.plead`, `T.startLeaving`, `T.remove`), and tiers (`T.TIERS`, `T.GOAL = 12`, `T.checkTier`, `T.becomeTown`).
  - `build.js` covers blueprints (`B.TYPES`), placement validation (`B.check`, `B.wouldCutOff`), sites (`B.place`), builders (the `build` action), completion (`B.complete` lays a path to the road), venue activities (`treat`, `library`, `gymWorkout`), drawing, placement input, the Build tab, and save/restore.

### Game rules worth knowing
- **Rating parts:** Happiness 30, Friendliness 20, Food 15, Things to do 20 (8 + 3 per venue), Charm 15, minus Fear (up to 30).
- **Visitors:**
  - A visitor may come at 07:00 when the rating is at least 50, nobody is visiting, it's been 2+ days since the last visit, and the population is below the bed capacity.
  - The daily chance is `0.18 + (score-50)/90`, plus 0.25 on boat day (Wednesday).
  - A visitor stays if their judge score is at least 0.55.
  - If they want to stay but have no home, they wait 4 days.
- **Building costs:**

  | Building | Size | Wood | Food | Work | Unlocks at |
  |---|---|---|---|---|---|
  | House | 6×5 | 16 | 0 | 300 | 0 islanders |
  | Bakery | 5×4 | 12 | 6 | 220 | 7 islanders |
  | Library | 5×4 | 14 | 0 | 240 | 8 islanders |
  | Gym | 4×3 | 10 | 0 | 180 | 9 islanders |

  You only need **a quarter of the wood to start**. Builders pull the rest from the wood pile as they go, and islanders chop more while a site is short of wood.
- **Leaving:**
  - A bad day means average mood below 38, or sky opinion below −55. **Sick days don't count.**
  - Newcomers start considering leaving at 2 bad days and leave at 4.
  - The original six are more stubborn (`stubborn = 2`): they consider at 4 and leave at 7.
- **Tiers:** Hamlet (start), Village (8), Big village (10), Town (12). Reaching Town triggers a Town Festival at the Hall the next evening, after which `town.isTown` is set.
- **Capacity:** the Hall, bonfire and picnic now have extra standing spots, so 12+ islanders can attend events.
- **Measured results (assistant's tests):**
  - In natural 12-day games, the town grew from 6 to 8–9 and nobody left unhappy.
  - Greedy placement found room for about 11 houses on a fresh island.
  - The festival chain worked end to end with 12 of 12 attending.
  - The game ran at about 54 fps headless with 12 people.
  - Building stress tests found zero walking-through-walls violations.

## Decisions
- **No LLM in the game.** Brains stay rule-based. (User)
- **Grow the Island as the main goal**, with generated newcomers, islanders building, people able to leave, and town status that keeps playing. (User picked the assistant's recommended options.)
- **No ground re-baking for buildings.** Re-rendering the ground takes about 3.3 s, so new paths and sites are drawn as overlays (`IS.Build.drawGround`) instead. (Assistant)
- **Strict placement.** Placement is refused if anything would become unreachable, and site footprints are solid from the moment they're placed. `Person.moveAlong` re-plans a route if a wall appears on it. (Assistant, driven by the user's "no walking through buildings")
- **Construction looks like an open shell** whose walls rise in 10% steps (`b.wallH` support in `iso.js`), with the roof fading in at 80%+. (Assistant)
- **Visitors sleep in the Hall** on 2 guest bedrolls. **Spare rooms** in one-bed houses (Egg's, Jude's) are offered only if the housemates like the newcomer. (Assistant)
- **Food and chopping urgency scale with population**, instead of the old fixed threshold of 10. (Assistant)
- **The session was stopped before finishing Phase 5–6.** (User: "Phase 3 is enough for now, publish whatever u have rn")

## Rejected / abandoned options
- **Other main-goal ideas:** "Be Worshipped" (faith as a currency for powers), "The Island's Secret" (a story mystery), "Legacy" (kids and generations), and "Six Dreams" (life goals). The assistant had recommended Dreams plus Faith. The user chose Grow the Island instead. These remain possible later layers.
- **Hand-made newcomer cast:** rejected in favour of generated newcomers.
- **Instant placement by the Sky Hand:** rejected; islanders build.
- **Clipping the finished building sprite from the bottom up to show progress:** looked wrong in isometric, so it was replaced by real partial-height walls.

## Artifacts
All code lives in the repo on branch `claude/tidewhistle-isle`, so it isn't duplicated here. Most recent commits, newest first:
```
5dc5dd2 Town growth: leaving, tiers, town festival, wood and food balance
23f6bde Grow the town: generated newcomers, visitors, Island Rating, building
c879edc Fix the collection book: fit the screen, scroll inside, add a close button
43c36c4 Couples: dates, gifts, anniversaries, fights, proposals and weddings
eb19d09 Content pack: skills, a Finds book, eight new activities, new random events
94ee826 Hall redesign, island-wide reactions, sombre talk after bad news
e3a60a9 Revivals ripple like deaths do
9ddf6b7 Smarter whispers: questions, chained orders, typos, pronouns, places
742adba Nearly triple the dialogue: 4,936 new lines across 917 line pools
```

### Tools in the repo
- `node tools/whisper-test.js`: last run 78/78 main, 73/73 held out.
- `node tools/command-test.js`: last run 125/125, 45/45.
- `node tools/train.js eval --sims 12 --days 3 --seed 7 --workers 6`: the dialogue judge (critic: `tools/critic.js`).
- `python3 tools/build-artifact.py <out.html>`: builds the artifact page.

### Publishing the artifact
1. Build the page with `tools/build-artifact.py`.
2. Publish to https://claude.ai/artifact/HSwdpQfQo3SQPV5TaococJ with a `files` map `{"js/x.js": "js/x.js", ...}` for every changed JS file.
3. If the publish is refused because of unread files, read them with the Artifact read action first.

### Test harness rules (learned the hard way)
- In browser tests, clear localStorage in `addInitScript` and stub `IS.Save.save`. Leaked autosaves contaminated earlier runs.
- Step the sim manually with `sim.setSpeed(1); sim.frame = () => {}`. Do **not** use `setSpeed(0)`: panic running uses real time and freezes while paused, which made islanders look "stuck" and starve.
- The game already applies the save at boot (`main.js`), so don't apply it again in tests. `IS.Build.restore` is now safe to run twice anyway.
- Use `/opt/pw-browsers/chromium` with playwright from `/opt/node-tools/node_modules/playwright`.

## User preferences & working rules
- Call them **Mav**. Keep it casual, use emojis, be funny (dark jokes are fine), and be direct.
- Be honest: flag uncertainty and never confidently guess. No empty praise; praise only when it's earned. Not a yes-man. Point out mistakes when asked, and give critique first when feedback is requested.
- For big tasks: plan first, execute step by step, then review.
- Commit and push to `claude/tidewhistle-isle`. **No PRs unless asked.** No model names in commits. Commit trailer:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01RZ4n6jbMrUqEXXsb9w6184
  ```
- **The user cares about usage and cost.** They stopped the session at $142.58 estimated (mostly Opus). Prefer smaller steps, fewer long simulations, and ask before big multi-phase runs.

## Conversation timeline (late part, in detail)
1. **Couples feature.** Dates (sunset walk holding hands, picnic, slow dance), gifts, anniversaries, fights and make-ups, proposals, weddings, onlookers, Sky Hand reactions, whispers. Published as Version 23.
2. **Collection book fix.** It couldn't be closed because its close button sat off-screen. Fixed with a height cap, an inner scroll, an ✕ button and closing on backdrop click. Version 24.
3. **Main-goal options.** The assistant pitched 5. The user chose Grow the Island, then answered 4 design questions.
4. **Phases 1–3.** Generator, visitors and rating, building. Tested and published as Version 25.
5. **Phases 4–5.** Leaving, wood and food rebalance, tiers and festival. Stopped by the user mid-testing. Published as Version 26.
6. **Side questions:** the cost figure, a request for the game link, and an explanation of how the brains work.

## Open questions & next steps
- **Dialogue judge regression: fixed.** `tools/critic.js` no longer flags self-naming inside the `welcome` thread (introductions). Re-run (`--sims 12 --days 3 --seed 7 --workers 6`) scored 81.1 with 0 self-name violations; remaining: repeat 29, ignored-question 10, thread-repeat 7.
- **Pacing.** Growth was only checked in a handful of 12-day runs. Reaching 12 islanders looks like it takes about one in-game season.
- **Optional ideas mentioned but not done:** married couples moving in together; layering Dreams or Faith on top of the town goal; a scroll hint on the roster when there are many islanders.
- **GitHub Pages.** Check whether Pages serves `claude/tidewhistle-isle`.
- **Task list state.** Phase 5–6 ("tiers, town status, balance, tests") is still in progress. Tiers and the festival are done and tested; the judge fix is done; balance is pending.

## Glossary
- **Sky Hand:** the player.
- **Whisper:** typing an order or question to a selected islander.
- **Island Rating:** a 0–100 town score.
- **Visitor / waiting / leaving / resident:** values of `p.town.status`.
- **Site:** a building under construction.
- **Venue:** a non-house building (bakery, library, gym).
- **Tier:** the town size label.
- **Town book:** the panel opened with **T** (Island and Build tabs).
- **Finds book:** the collection panel (**K**).
- **Judge / critic:** the automated dialogue scorer in `tools/`.
- **HEAVY topics:** serious conversation topics that suppress chirpy follow-ups.
- **Thread:** a scripted conversation in `talk.js`.

## Gaps & uncertainty
- The early part of the original chat was compacted into a summary, so exact wording from those turns isn't preserved. Details of earlier features come from that summary and from the code.
- The cause of the judge drop is only partly checked (see Open questions).
- The cost figure is an estimate shown by `/usage`; whether it was actually billed depends on the user's plan, which isn't known.
- Nothing sensitive is included. The repo name, artifact link and session link are shared on purpose.
