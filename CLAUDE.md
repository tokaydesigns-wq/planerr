# Planerr: notes for Claude

Planerr is a phone web app (installable PWA) for planning day-trip adventures. It's live at
https://tokaydesigns-wq.github.io/planerr/ and GitHub Pages deploys it straight from `main`,
so **anything merged to `main` goes live within a minute or two.**

The owner isn't a developer. Write to them in plain language, show what changed (screenshots
help), and say clearly what you did and didn't test.

## Working rules

- **Never push to `main`.** Work on a branch and open a pull request for the owner to review.
- **Free sources only, no API keys.** The app has no server and every file is public, so a key
  would be exposed. Paid services (Google Places, AI chat) were offered and declined for now.
- No build step and no frameworks. Plain HTML, CSS and JavaScript, loaded as classic scripts.
- Match the surrounding code: short functions, a comment above anything non-obvious, the same
  naming and density. Keep user-facing text short, friendly and specific.
- Test at phone width before calling anything done (see Testing).

## How the app is put together

`index.html` loads the scripts in this order. They share globals, so order matters for anything
that runs at load time:

| File | What's in it |
| --- | --- |
| `config.js` | Supabase settings for the community feed (blank, so the feed is off) |
| `js/core.js` | Helpers, constants (`TYPES`, `CATS`, `CUISINES`, `DIETS`, `AGE_BANDS`), saved state, schedule/budget/alerts, opening-hours parser `hoursOn` |
| `js/services.js` | All network calls (`API.*`), the `nominatim()` queue, `research(adv)` that fills `adv.research`, community feed |
| `js/closures.js` | Closure checks: `closedInfo(tags, date)`, `seasonRisk(elev, date)`, `API.access` (roads in, elevation, snow), "It's closed" reports |
| `js/art.js` | Cartoon SVG art: Pip the camper-van mascot, home banner, scene decorations |
| `js/ui.js` | Router, every screen function, the main click handler (`data-act`) |
| `js/ideas.js` | Trip-idea generator (Wikidata candidates → drive → weather → closures → food → photos) and the plan detail page |
| `js/chat.js` | "Plan with Pip" chat: keyword parser `parseTrip()` that fills the trip-idea settings |
| `js/trails.js` | Recommended trails for hikes (`API.trails`, `trailsCard`) |
| `js/photos.js` | Trip photo albums per stop, stored in IndexedDB, plus the full-screen viewer |
| `styles.css` | Everything visual. Colors are tokens on `:root` with dark-mode overrides |
| `sw.js` | Offline cache |

- **Routing:** `#/home`, `#/ideas`, `#/idea/N`, `#/chat`, `#/new`, `#/edit/ID`, `#/a/ID` (plan),
  `#/brief/ID`, `#/live/ID`, `#/rate/ID`, `#/explore`, `#/family`, `#/you`. `render()` rebuilds `#app`.
- **Clicks:** elements carry `data-act="..."`. ui.js has the main switch. ideas.js (`idea-*`),
  chat.js (`chat-*`), photos.js (`ph-*`), trails.js and closures.js have their own listeners.
- **Saved data:** one object in `localStorage['planerr.app.v1']`. When you add a field, give it a
  default in `loadState()` (core.js) so older saved data still works. Photos are in IndexedDB
  (`planerr-photos`), not localStorage.

## Data sources (all free, no keys)

- Photon (photon.komoot.io): place search, trail names
- Nominatim (nominatim.openstreetmap.org): restaurants, opening hours, trail shapes, road tags.
  **Max 1 request a second**. Always go through `nominatim(params, path)` in services.js, which queues.
- OSRM (router.project-osrm.org): drive times and routes
- Open-Meteo: weather, snow depth, elevation
- Wikipedia and Wikidata: photos, descriptions, trip-idea candidates
- Overpass: often overloaded, so it's only a backup (and for family spots)

## Adding or changing files

- New script: add it to `index.html` **and** to `SHELL` in `sw.js`.
- Any release: bump `CACHE` in `sw.js` (`planerr-vN`) so phones pick up the new version.

## Testing

```bash
python -m http.server 8123
```

Open http://localhost:8123 and check:

- Phone width (375px), light **and** dark mode, no sideways scrolling
  (`document.documentElement.scrollWidth` should equal the window width).
- The screens you touched, plus a quick pass over Home, Trip ideas (generate from a real town),
  a plan page, and the browser console for errors.
- A 504 or timeout from Overpass in the console is expected. The app falls back.
- If you can't run a browser, say so in the PR instead of claiming it works.

## Commits and pull requests

- One topic per PR, with a short title in plain words.
- In the PR description: what changed, why, how you tested it, and anything left undone.
