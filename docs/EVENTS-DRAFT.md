# Direction 2: sample events (draft for Mav to react to)

Status: **nothing here is built or decided.** Open question 2 in `DESIGN.md` suggested brainstorming a few events to see which ones spark ideas. These are 8, written to fit what the game can already do (grief, memories, sickness, the boat, storms, the bottle, god powers, the cat).

Each event lists:
- **Omens**: what the player can notice first.
- **Who**: the personalities it prefers.
- **Paths**: how it can play out.
- **Links**: which events it needs or rules out.

The secret itself is left blank on purpose. Where an event points at it, it says **(the secret)**.

---

### 1. The Lighthouse Keeper's Logbook
- **Omens:** the lighthouse light skips a beat at night. A curious islander starts staring at it.
- **Who:** the most curious and bravest islander finds a way in.
- **Paths:**
  - They read the logbook alone and turn quiet and secretive. They hint at **(the secret)** in later conversations.
  - They bring a friend, and the two bond over it.
  - A storm hits while they're up there: the first real danger of the run.
- **Links:** unlocks *The Second Boat*. If the reader dies, the logbook is lost for this run.

### 2. The Fever
- **Omens:** one islander coughs for a day ("Just a tickle"). Others nearby start coughing a day later.
- **Who:** spreads along friendships, so the most social people are most at risk.
- **Paths:**
  - Bless in time and it ends.
  - Ignore it and the weakest person may die.
  - A kind islander nurses everyone, gets sick last, and the island owes them.
- **Links:** can't run in the same week as *The Feast*. Makes *The Quarrel* more likely (people blame whoever brought it).

### 3. The Quarrel That Doesn't End
- **Omens:** two people with low friendship bump into each other three times in a day.
- **Who:** grumpy and impulsive people, or a love triangle when one exists.
- **Paths:**
  - They make up at a Friday dinner.
  - Their friends pick sides and the island splits for the rest of the run.
  - One of them leaves on the boat.
- **Links:** blocks *The Wedding* for that pair. If one of them dies, the other carries guilt (memory plus mood) for the rest of the run.

### 4. The Second Boat
- **Omens:** a boat appears on the horizon at dusk and doesn't come in. The cat stares at the sea.
- **Who:** anyone. The bravest islander wants to row out.
- **Paths:**
  - Nobody goes, and it vanishes.
  - Someone goes and comes back changed, with a clue to **(the secret)**.
  - Someone goes and doesn't come back (permanent death, with an omen first, as planned).
- **Links:** needs *The Logbook*, or two clues found.

### 5. The Feast
- **Omens:** an islander who loves cooking starts hoarding food and dropping hints.
- **Who:** cooks and social types.
- **Paths:**
  - A big happy night. It counts as a "good" event for currency.
  - A storm ruins it.
  - Someone doesn't show up, and that matters for *The Quarrel*.
- **Links:** can't happen during *The Fever*. A feast after a death becomes a memorial dinner instead (the grief system already exists).

### 6. The Message in the Bottle (expanded)
- **Omens:** the bottle washes up. It already exists in the game.
- **Who:** the curious islander, or whoever's on the beach.
- **Paths:** the letter is one of three each run:
  - a love letter that sets up *The Wedding*,
  - a warning about **(the secret)**,
  - a map to a find.
- **Links:** the warning version makes *The Second Boat* more likely.

### 7. The Night the Cat Went Missing
- **Omens:** the cat stops coming home, and food goes missing.
- **Who:** the cat lover panics first.
- **Paths:**
  - A search party bonds the islanders.
  - The cat turns up at the cliffs, near **(the secret)**.
  - The cat lover goes looking alone in the dark, which is a danger with an omen first.
- **Links:** this is a low-stakes event that can lead to a high-stakes one. It's good for the "who experiences what" goal, because it's about the people, not the cat.

### 8. The Wedding
- **Omens:** an engaged pair. Engagement already exists in the game.
- **Who:** the couple and their closest friends.
- **Paths:**
  - Big day.
  - Called off by *The Quarrel*.
  - One of them dies before it, the most dramatic case. The director should save this for late in a run.
- **Links:** ruled out by *The Quarrel* between the pair. *The Feast* can merge into the reception.

---

## How a registry could look (a guess, for when you say go)
```js
{ id: 'fever', weight: 1, omen: { days: 1, ... }, cast: sim => /* pick who, by personality */,
  needs: [], blocks: ['feast'], start(sim, cast) {}, update(sim, dt) {}, outcomes: ['cured', 'death', 'nurse'] }
```
- At the start of a run, draw about 20 events from the pool, respecting `needs` and `blocks`.
- A "director" schedules them, scoring drama (who gets hurt or changed) with the guardrails already in `DESIGN.md`: a cooldown between deaths, and never wiping the cast early.
- The round-end screen pays currency per outcome (survived, helped), not per tragedy.

## Questions these raise
1. Should the player see omens as journal lines ("Mav, someone is coughing"), only in the world, or both?
2. Can powers cancel an event outright, or only change how it ends? (I'd lean toward "only change how it ends".)
3. How many events per in-game week feels right? A guess: 1 big plus 2 small.
