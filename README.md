# Tidewhistle Isle

A cozy pixel-art island life simulation. Four islanders live on a small island with their own personalities, needs, memories, friendships and grudges. You watch from above as the Sky Hand, and you can pick them up, carry them around, and throw them into the sea.

Open `index.html` in a browser. No build step, no dependencies.

## Design your islanders

Everything about the people lives in `js/config.js`: name, age, bio, look (skin, hair, hair style, shirt, pants, accessory), personality traits, loves and hates, home, birthday, catchphrases, who they can fall for, and starting relationships. The four people in there now are placeholders.

## What's simulated

- **Needs**: fullness, energy, social, fun. They drive every decision.
- **Utility AI brains**: each islander scores ~20 activities (fishing, gardening, foraging, chopping wood, reading, beach, swimming, wandering, stargazing, cooking, visiting friends...) against their needs, traits, loves/hates, time of day and weather.
- **Conversations**: topics chosen from personality, memories and relationships (gossip, jokes, complaints, compliments, flirting, arguments, apologies, news, the Sky Hand). Listeners react based on compatibility and mood.
- **Relationships** drift toward what their personalities naturally support. Crushes, confessions, rejections and couples happen when romance is enabled.
- **Weekly calendar**: Tue fishing contest, Wed supply boat, Thu story night, Fri community dinner, Sat beach bonfire, Sun picnic, plus birthday parties.
- **Random life**: weather (sun, clouds, rain, storms, fog), dolphins, shooting stars, messages in bottles, colds (friends bring soup), food spoilage, firewood running out.
- **Day/night** with lamps, lit windows, a sweeping lighthouse beam, fireflies and bonfire light.

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
| `js/world.js` | Island generation, buildings, activity spots, A* pathfinding, terrain pre-render |
| `js/sprites.js` | All pixel art, drawn procedurally |
| `js/actions.js` | Every activity and how it is scored |
| `js/person.js` | Islander entity: needs, movement, memory, relationships, Sky Hand physics |
| `js/social.js` | Conversations and relationship changes |
| `js/dialogue.js` | Line pools |
| `js/events.js` | Calendar, weather, random events, supply boat |
| `js/render.js` | Drawing, lighting, weather, particles |
| `js/ui.js`, `js/input.js`, `js/main.js` | HUD, controls, main loop |
