# Tidewhistle Isle

**Play:** https://bolekdemir.github.io/SimulationTest/ (GitHub Pages, deployed from the `claude/tidewhistle-isle` branch)

**Install it as an app:** open the link, then use **Install the app** in the main menu (Chrome, Edge, Android), or on iPhone tap **Share → Add to Home Screen**. Installed, it opens fullscreen and works offline.

A cozy isometric pixel-art island life simulation. Six islanders (and a cat) live on a small island with their own personalities, needs, memories, friendships and grudges. You watch from above as the Sky Hand, and you can pick them up, carry them around, and throw them into the sea.

Open `index.html` in a browser. No build step, no dependencies.

## Design your islanders

Everything about the people lives in `js/config.js`: name, bio, look (skin, hair, hair style, eye colour, height, shirt, pants, accessory), personality traits, sense of humour, quirks, loves and hates, home, birthday, catchphrases, who they can fall for, and starting relationships.

The current cast: **Iroh**, **Forest** and **Egg** (the bro trio), **Jude**, and roommates **Beach** and **Lynn**. Plus **Biscuit**, the island cat.

## What's simulated

- **Needs**: fullness, energy, social, fun. They drive every decision.
- **Utility AI brains**: each islander scores ~20 activities (fishing, gardening, foraging, chopping wood, reading, beach, swimming, wandering, stargazing, cooking, visiting friends...) against their needs, traits, loves/hates, time of day and weather.
- **Conversations**: topics chosen from personality, memories and relationships (gossip, jokes, complaints, compliments, flirting, arguments, apologies, news, the Sky Hand). Listeners react based on compatibility and mood.
- **Relationships** drift toward what their personalities naturally support.
- **Romance with taste**: everyone has a type (`into` in config: looks, smarts, funny, kind, drive, confidence). Forest falls for looks almost on sight; Lynn wants kindness and brains. Crushes, flirting, confessions, rejections and couples follow from it.
- **Noticing each other**: islanders spot people they like across the island and walk over to chat, wave in passing, and pause their work when a friend drops by.
- **Conversations with flow** (`js/talk.js`): a chat is an opening, one or two topic threads that play out over several back-and-forth lines (each reply depends on how the last one landed), a segue, and a goodbye. Each islander has their own bits (Iroh's terrible plans, Forest's grind speeches, Egg's nap philosophy, Jude's deals, Beach's WiFi rants, Lynn's "have you eaten?"). Interrupted threads get picked back up next time, plans become island lore that others ask about, and the selected islander's page shows the conversation as it happens.
- **Conversations that don't loop**: about 5x more lines, each islander has their own voice, nobody repeats what was said recently, and they ask each other real questions, tease each other about crushes, comment on what others are doing, and bring up recent fights or favours.
- **Inner lives** (`js/mind.js`):
  - **Daily plans**: 2-3 goals every morning ("Restock the woodpile", "Talk to Lynn (act normal)", "Hang out with the bros"), shown as a checklist on their page.
  - **Grudges and gratitude**: they remember fights, roasts, soup and favours, forgive at their own personality's pace, and bring it up later.
  - **Group life**: they invite friends along, the bros hang out as a trio, and couples go on evening dates.
  - **Emotions that change behaviour**: jealous, heartbroken, sulking, proud, giddy, lonely.
  - **Gossip**: news spreads person to person and shifts opinions; everyone has an island reputation.
  - **Reactions**: friends rush over when someone gets dunked, congratulate new couples, comfort the heartbroken. Couples can break up.
  - **Growing the town** (`js/newcomers.js`, `js/town.js`, `js/build.js`): newcomers are generated from archetypes (traits, looks incl. blue/green eyes, loves, humour, bio, catchphrases) and run the same brain. The Island Rating decides when visitors arrive by boat; after two days they decide to stay or leave, with reasons. You place houses and venues (bakery, library, gym); placement is validated so nothing on the island gets cut off, sites are solid from the start, and islanders build them over days.
  - **Couples** (`js/love.js`): relationships have a start date and a stage (new, dating, serious, engaged, married) and pet names. Couple-only dates (sunset holding hands, a picnic for two, slow dancing), kisses hello, gifts chosen for what the partner loves, anniversaries, jealousy, fights and make-ups, proposals, and a wedding event at the Hall. Onlookers react, a grabbed partner's other half yells at the Sky, and blessing a couple together boosts them both.
- **Start menu and saving**: a title journal with Continue / New island / Meet the islanders / How to play. The island autosaves every in-game hour to this browser. Esc or the menu key pauses.
- **Whispers from the sky**: type an order in plain words into the selected islander's page. The parser works out who it's for ("with/to Lynn"), who it's about ("about Forest"), what to do, and whether to bring someone along ("go fishing with Egg"). If it doesn't understand, the islander says so instead of guessing. `node tools/command-test.js` checks it against 170 phrasings, 45 of them held out from development.
- **God powers**: a toolbar of Hand, Smite (lightning), Meteor, Fire, Bless and Revive (keys Z X C V B G). Islanders can die: a charred body, a crater full of remains, or a splat from being thrown too hard. Bodies get buried and graves get flowers. Survivors grieve, talk about the dead, visit graves, start fearing the sky and pray at the plaza. Revive brings someone back with every bond intact, and everyone has questions.
- **Skills and finds**: islanders level up what they practise (fishing, gardening, foraging, woodcutting, swimming, beachcombing, sandcastles, bug catching, painting, guitar, fitness) and earn titles; better skills mean better catches, bigger sandcastles, nicer paintings and music people enjoy. Shells, rare fish, forest finds, bugs and buried treasure fill the island's Finds book (K).
- **More to do and more going on**: beachcombing, sandcastles that wash away (or get kicked over), bug catching, painting, guitar, workouts, jogging and kites; plus whales, auroras, rainbows, coconuts, bee attacks, treasure maps and a stray kitten who can be adopted.
- **Weekly calendar**: Tue fishing contest, Wed supply boat, Thu story night, Fri community dinner, Sat beach bonfire, Sun picnic, plus birthday parties.
- **Random life**: weather (sun, clouds, rain, storms, fog), dolphins, shooting stars, messages in bottles, colds (friends bring soup), food spoilage, firewood running out.
- **Isometric world**: a raised island slab with cliff edges, 3D buildings with gable roofs and lit/shaded walls, cutaway interiors, market stalls, string lights, hedges, fences and beach umbrellas.
- **Lush nature**: clumpy olive and yellow-green grass, chunky oaks with roots and moss, purple mossy rocks, blossom clusters, ferns, clover and mushrooms.
- **Lighting**: warm sun and cool blue-violet shadows, a lavender dusk, glowing windows, threshold bloom, shadows cast by the moving sun, a sweeping lighthouse beam, fireflies and bonfire light.
- **Humour and quirks**: roasts, dry jokes, goofy jokes, bragging, greed and impulsiveness all change how conversations go.

## Controls

| Action | How |
| --- | --- |
| Inspect an islander | Click them |
| Pick up / carry | Press and hold, then drag |
| Throw | Flick while dragging and let go |
| Move camera | Drag empty ground, or WASD / arrows |
| Zoom | Scroll, or + / - |
| Look inside buildings | Hover them, or press R |
| Speed | Space pauses, 1-5 sets speed |
| Next islander / follow | Tab / F |
| Pause menu | Esc, or the menu key |
| Give an order | Select an islander, type in the box on their page |
| Fullscreen | The Fullscreen button. If the viewer blocks real fullscreen, it hides the HUD instead (H toggles that too) |

## Training the brains

The islanders' behaviour is hand-written, but its key numbers (how chatty they are, how often they notice each other, how much plans matter, how likely each conversation topic is) live in `js/tune.js` and are trained:

- `tools/critic.js` is the judge. It watches a simulation and scores it: it penalises nonsense (talking about yourself in the third person, gossiping about someone to their face, congratulating your own couple, sleeping people talking, greeting the wrong person, "good morning" at night, ignored questions, repeated lines and topics) and bad behaviour (starving with food in the pantry, exhaustion, idling, getting stuck), and rewards variety, finished plans, mood, doing what you love, and a healthy amount of drama.
- `tools/train.js` runs islands four at a time in headless browsers with seeded randomness, and evolves the settings: each generation's best brains survive, breed and mutate.

```
node tools/train.js eval --sims 8 --days 3     # score the current brains
node tools/train.js train --gens 25 --pop 10   # evolve new settings (writes tools/out/best.json)
```

## Code map

| File | What it does |
| --- | --- |
| `js/config.js` | Islanders and tuning |
| `js/tune.js` | Trained brain settings |
| `tools/critic.js`, `tools/train.js` | The judge and the trainer |
| `js/world.js` | Island generation, buildings, activity spots, A* pathfinding, isometric terrain pre-render |
| `js/iso.js` | Isometric projection and procedural iso art (buildings, interiors, props) |
| `js/sprites.js` | All pixel art, drawn procedurally |
| `js/actions.js` | Every activity and how it is scored |
| `js/content.js` | Skills, the Finds collection, extra activities and random happenings |
| `js/gods.js` | God powers, death, gore, graves, grief and revival |
| `js/person.js` | Islander entity: needs, movement, memory, relationships, Sky Hand physics |
| `js/cat.js` | The island cat |
| `js/social.js` | Conversations, attraction, noticing, relationship changes |
| `js/command.js` | Parses typed orders into activities and conversations |
| `js/mind.js` | Plans, grudges, emotions, invitations, gossip, reactions |
| `js/save.js`, `js/menu.js` | Autosave, settings, install prompt, title / pause menu |
| `manifest.webmanifest`, `sw.js`, `icons/` | App install: name, icon, fullscreen, offline cache |
| `tools/build-artifact.py` | Builds the fragment version used for the Claude artifact |
| `js/talk.js` | Conversation threads, branching, resuming, segues and goodbyes |
| `js/dialogue.js` | Line pools, per-islander voices, questions with real answers, no-repeat picking |
| `js/events.js` | Calendar, weather, random events, supply boat |
| `js/render.js` | Drawing, lighting, weather, particles |
| `js/ui.js`, `js/input.js`, `js/main.js` | HUD, controls, main loop |
