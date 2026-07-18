# Figure Out When to Force Loading Screen Time

Decide whether the loading screen should enforce a minimum display duration, and if so, what that threshold should be and how to implement it cleanly.

## Questions to Answer

- Does the scene load fast enough on a cold cache that the loading screen flashes and disappears before the user registers it?
- Is there a UX reason to hold the screen (e.g. to avoid a jarring pop-in of unfinished geometry)?
- What is the right minimum — 0ms (no floor), 500ms, 1s, or something tied to actual asset readiness?

## Context

- Loading logic lives in `js/core/main.js` or wherever the scene init resolves.
- The current loading screen is in `index.html` / `css/styles.css`.

## Don't over-engineer

- Don't build a progress bar or asset tracking system unless the review reveals it's actually needed.
- A simple `Math.max(elapsed, MIN_MS)` before hiding the screen is sufficient if a floor is warranted.
