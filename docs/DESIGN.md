# Tidewhistle Isle: design brainstorm (pre-release direction)

Status: brainstorm notes from a chat with Mav. Nothing here is built. Anything marked **(idea)** or **(guess)** is not a decision.
Read `docs/HANDOFF.md` for how the current game works.

## Why this exists
Mav may release the game. It needs to be more fun and interesting. Pain points Mav named: **no sound, too slow, gets boring fast**.
Mav's rule for now: do not start building until Mav says so.

## Platform
Undecided. Steam would be great but is hard. App Store is a maybe.
Suggestion (not decided): put a free web build on itch.io first to test whether it's fun.
Release checks still to do: are the islanders based on real people (get their OK), name check on "Iroh", sound, saving, performance.

## Direction 1: Resort tiers (from Mav's friend, kept as an option)
- Four tiers: Deserted Island, Tropical Getaway, 5-Star Paradise, Divine Sanctuary.
- Two currencies: cash for the AI community, Faith for the player's god powers.
- Powers unlock by tier. Island Prestige comes from tourist reviews and happiness. Alignment branch: benevolent vs wrathful.
- Notes from the chat: powers-by-tier and a Faith currency are good fits. The tourist/resort theme moves away from the named-islander focus, and the top tier is the "mess with people" style Mav said there are too many of.

## Direction 2: Lost Season 1 / Doors style (the current favourite)

### Setting (Mav's correction)
The islanders are **not stranded or abandoned**. Tidewhistle is a civilized island meant to be lived on (the current island, with its Hall, dock, and weekly events). It just has **secrets**. Lost is a reference for the mystery and the "who experiences what" storytelling, not for survival. Mav wants the game shifted toward this direction **slowly**, one small step at a time.

### Core idea
- Caretaker tone. Mav does not want another "mess with people" game.
- The island has a mystery. The **answer is always the same** (like Doors).
- **The path is random.** Each run draws about **20 of ~50 events**, not just a new order.
- Events can **depend on or rule out each other**.
- **Personalities change which events are likely to hit whom.**
- The real goal is not the secret. It is **how things happen and who experiences what** (two people growing close and one dies).

### Death
- **Permanent, mostly.** Exceptions are rare and costly. Ideas: one miracle per run, or miracles tied to the island's mystery.
- Dangers should give **omens** so the player has a chance to step in. A few sudden deaths are okay.
- The player cannot save everyone (triage).
- Director ideas **(idea)**: score events by drama (who they would hurt or change), with guardrails (cooldown between deaths, never wipe the cast too early).
- Aftermath: grief and memory systems already exist. A run recap that tells the story back is wanted.

### Rounds (a round is one run)
A round ends when:
1. you reach the end,
2. everybody dies, or
3. you start a new one.

### Time and pacing
- Speeds: 0x (pause), 1x, 2x, 5x, 15x.
- A run can last about 2 minutes or days of real time.
- **Catch-up on return:** when the player comes back, the game fast-forwards `real time away x the speed they left it on`. At 0x nothing passes.
- Catch-up **stops at the first real danger** (decided), so the player returns to the omen, not the funeral.
- A **"while you were away" recap** shows after catching up (decided).
- Not decided: a cap on how much time can be caught up (15x for hours is a lot of game days). Need to measure how long fast-forwarding takes. Browsers may throttle background tabs, which is why catch-up is used instead of true background running.

### Currency (name not chosen yet)
- Earned **at the end of each round**, shown on a round-end screen that counts each line visually (Balatro cash-out style).
- Sources: **days survived (capped)**, **events**, **clues found**.
- Open point: events should pay for how they were handled (survived, helped), not for tragedy just happening. Mav has not confirmed this.
- Earlier suggestion **(idea)**: a trust-based economy, where harming islanders costs trust and a fear income is a tempting but costly shortcut.
- **The bank carries over between rounds**, even after a failed round.
- **Start with some currency** (decided).
- Snowballing late game is fine (decided).
- Spent any time, including mid-round, on **both single-use powers (save or harm) and permanent unlocks** (decided).
- Not decided: what exactly is for sale, and all prices and payouts (need playtesting).

## Done so far
- **Island is 4x bigger** (80x60 -> 160x120 tiles, about 4.1x the land). The village is untouched; the new land is the **wild east**, joined by a forested ridge with a trail from the north trail to "the east woods". Activities (fishing, foraging, beach) stay in the village corner for now so nobody hikes across the map for firewood; open the east up when Direction 2 events need it. Old saves still load (all village coordinates are the same).
- **Wild east terrain:** lakes, a river, highland sea cliffs, boulders, and **terraced hills** (raised levels with rock walls and stone stairs; open valleys keep the east walkable). Wander spots: the east woods, the lake, the cliffs, the lookout.
- Pathfinding fix found along the way: the search counted already-finished tiles toward its limit, which only showed up on the bigger map.
- **Lighting pass:** ambient bloom (wide haze tinted by the hour, soft horizontal flares at night), sun shafts with dust specks, lit windows that stay behind things in front of them, light pools under windows and lamps, roofs casting short shadows on walls, cloud shadows, glints on the water, candle flicker.
- **Life in the air:** pollen by day (gold at sunset), butterflies, fireflies at night, rain splashes, trees swaying in gusts (hard in storms), footprints in the sand.
- **Sound** (all generated, no files): sea, wind, rain, fire, birds and gulls by day, crickets at night, thunder, a soft generative tune that follows the time of day, islander voice babble (everyone has their own pitch), the Hall bell when an event starts, the ferry horn, god power effects, UI clicks. Sound and Music levels in Settings.
- **Pacing (small):** the first visitor always comes on day one's boat, so something happens in the first few minutes.
- **Photo key (O):** saves a crisp screenshot, handy for store pages later.

## Open questions
1. **The hidden truth.** What is the island's secret? (Mav does not know yet.)
2. **The event pool.** What are the ~50 events? Suggested next step: brainstorm 5 and see which ones spark ideas.
3. **The powers.** What do save and harm powers do, and which are permanent unlocks?
4. **What is "the end"** of a round (finding the truth, or a final event)?
5. **Cast size.** With permanent death and six hand-made islanders, a bad run could end empty. Do newcomers replace the dead? Does anything carry over, like a graveyard or memory book?
6. **Why would anyone choose to harm?** It needs a tempting reason to exist, or the best play is always to save.
7. **Platform** (see above).
8. Numbers: prices, payouts, the day cap, catch-up cap.

## Easy wins that need no new design
- ~~Sound~~ (done, see above). Still open: footsteps, a real composed soundtrack later if the game ships.
- **Speed:** earlier first visitor, faster growth, early wins in the first 10 minutes.
- Handoff open items: pacing of town growth, repeated-line cleanup, check whether GitHub Pages serves the branch.
