# Tidewhistle Isle

A cozy isometric pixel-art island life simulation. Six islanders (and a cat) live on a small island with their own personalities, needs, memories, friendships and grudges. You watch from above as the Sky Hand, and you can pick them up, carry them around, and throw them into the sea.

Open `index.html` in a browser. No build step, no dependencies.

## Design your islanders

Everything about the people lives in `js/config.js`: name, bio, look (skin, hair, hair style, eye colour, height, shirt, pants, accessory), personality traits, sense of humour, quirks, loves and hates, home, birthday, catchphrases, who they can fall for, and starting relationships.

The current cast: **Iroh**, **Forest** and **Egg** (the bro trio), **Jude**, and roommates **Beach** and **Lynn**. Plus **Biscuit**, the island cat.

## What's simulated

- **Needs**: fullness, energy, social, fun. They drive every decision.
- **Utility AI brains**: each islander scores ~20 activities (fishing, gardening, foraging, chopping wood, reading, beach, swimming, wandering, stargazing, cooking, visiting friends...) against their needs, traits, loves/hates, time of day and weather.
- **Conversations**: topics chosen from personality, memories and relationships (gossip, jokes, complaints, compliments, flirting, arguments, apologies, news, the Sky Hand). Listeners react based on compatibility and mood.
- **Relationships** drift toward what their personalities naturally support. Crushes, confessions, rejections and couples happen when romance is enabled.
- **Weekly calendar**: Tue fishing contest, Wed supply boat, Thu story night, Fri community dinner, Sat beach bonfire, Sun picnic, plus birthday parties.
- **Random life**: weather (sun, clouds, rain, storms, fog), dolphins, shooting stars, messages in bottles, colds (friends bring soup), food spoilage, firewood running out.
- **Isometric world**: a raised island slab with cliff edges, 3D buildings with gable roofs and lit/shaded walls, cutaway interiors, market stalls, string lights, hedges, fences and beach umbrellas.
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

## Code map

| File | What it does |
| --- | --- |
| `js/config.js` | Islanders and tuning |
| `js/world.js` | Island generation, buildings, activity spots, A* pathfinding, isometric terrain pre-render |
| `js/iso.js` | Isometric projection and procedural iso art (buildings, interiors, props) |
| `js/sprites.js` | All pixel art, drawn procedurally |
| `js/actions.js` | Every activity and how it is scored |
| `js/person.js` | Islander entity: needs, movement, memory, relationships, Sky Hand physics |
| `js/cat.js` | The island cat |
| `js/social.js` | Conversations and relationship changes |
| `js/dialogue.js` | Line pools |
| `js/events.js` | Calendar, weather, random events, supply boat |
| `js/render.js` | Drawing, lighting, weather, particles |
| `js/ui.js`, `js/input.js`, `js/main.js` | HUD, controls, main loop |
