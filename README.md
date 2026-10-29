# Planerr

A phone-first web app for planning day-trip adventures. Add it to your home screen and it opens like an app, even offline.

## What it does

- **Plan with Pip**: describe your day in your own words on the Home screen ("easy hike with the kids Saturday, under an hour away, tacos after"). Pip, the camper-van mascot, picks out the kinds of day, drive time, date, times, group, food, diet, budget and starting town, fills in the trip-ideas settings and builds the 3 plans. It reads keywords in the browser; no AI service or key is involved.
- **Recommended trails** for any hike: named trails near the hike stop with length, climb, walk time, difficulty, surface and dog rules, plus directions to the start, Google reviews and a trail map. **Use this trail** adds it to the plan and sets the hike time. Trail data comes from OpenStreetMap (Photon and Nominatim) and elevations from Open-Meteo.
- **Your photos**: after a trip (or during it, from live mode), add your own pictures and file each one under the stop where you took it, so every attraction gets its own album. Pick a cover photo for the trip. Photos are stored on the phone only (IndexedDB) and never uploaded.
- **Trip ideas**: enter your starting point, the longest drive you want each way, the date and times, the kinds of day you're into, the food you like, a budget and whether the kids are coming. Planerr finds well-known real places within that drive (Wikidata), checks the actual drive time and that day's weather for each, picks restaurants that match your taste, adds sights nearby, and builds **3 different day plans**. Tap **Save this plan**, or **Show me 3 different plans** for more.
- **Plan an adventure**: type of day, date, leave/back-by times, starting point, main destination, stops along the way, budget, people, and kids.
- **Research on its own** when you save a plan:
  - drive time and distance for every leg (OSRM / OpenStreetMap)
  - the forecast for that day, hour by hour, with sunrise and sunset (Open-Meteo, up to 16 days out)
  - opening hours on your date, checked against when you'll actually arrive (OpenStreetMap)
  - a photo and description of the destination, plus photos of sights nearby (Wikipedia)
  - restaurants and cafés along the route and at the destination, ranked by your taste (OpenStreetMap)
  - heads-up alerts: closed or not-yet-open stops, rain on outdoor stops, being out after dark, running past your back-by time, going over budget
- **Tickets**: flags stops that likely need advance tickets, links the official site when OpenStreetMap lists it, and gives step-by-step buying instructions for your date, arrival time and group.
- **Hike supplies**: water per person sized to your time on the trail, plus gear chosen from the forecast (rain, UV, cold, heat, sunset).
- **Morning briefing**: a welcome, the weather and what to wear, when to leave, today's route, warnings, a tickets check and a packing check.
- **Live mode**: next stop, one-tap navigation, mark stops done, nearby food.
- **Rate the day** from 1 to 5 stars, give each stop a 👍 or 👎, and leave tips. Food ratings feed your taste profile.
- **Explore**: browse adventures other people shared, with their stops, tips and ratings, and copy one into your own plans.
- **Family**: add kids' ages to get age-band picks, tips, kid-friendly spots near the destination, ticket age reminders and family packing.
- **You**: your name for the briefing, units, dietary needs, taste profile, stats, and backup/restore.

Your adventures are saved on your device (browser storage). Use **You → Export backup** to move them to another phone.

## Run it on your computer

```bash
python -m http.server 8123
```

Then open http://localhost:8123.

## Put it on your phone (GitHub Pages, free)

1. Create a GitHub repository and push this folder to it.
2. In the repository, go to **Settings → Pages**, choose **Deploy from a branch**, then pick `main` and `/ (root)`.
3. Open the URL GitHub gives you (`https://<you>.github.io/<repo>/`) on your phone.
4. **iPhone:** tap Share, then **Add to Home Screen**. **Android:** tap ⋮, then **Install app**.

## Turn on the community feed (optional, free)

Without this, Explore shows built-in examples only.

1. Create a free project at https://supabase.com.
2. In the project, open **SQL Editor**, paste in `supabase.sql`, and click **Run**.
3. Go to **Project Settings → API** and copy the **Project URL** and the **anon public** key into `config.js`.
4. Deploy again. When people rate an adventure, they can choose to share it to Explore.

The anon key is meant to be public. Row Level Security lets anyone read and post, but nobody can edit or delete other people's posts through the app. To remove a post, delete it in the Supabase table editor.

## Limits to know

- **Opening hours** come from OpenStreetMap volunteers. They're good for big attractions and patchier for small businesses, so confirm anything important on the official site.
- **Drive times** don't include traffic.
- **Restaurant data** comes from OpenStreetMap through Nominatim (about one request a second), with the Overpass servers as a backup. If both are unavailable, ideas get a lunch placeholder with a link to nearby restaurants in Google Maps. Use **Refresh** under Research to retry. Each restaurant has a **Google reviews** link that opens its Google Maps listing.
- **Photos** come from Wikipedia. Landmarks, parks and towns usually have one; small businesses usually don't, so those get an illustration instead.
- **Ticket steps** are general guidance. Prices and availability come from the venue's own site.

## Files

- `index.html`: app shell and tab bar
- `styles.css`: design tokens (light and dark) and components
- `js/core.js`: saved data, schedule, opening-hours parser, alerts, gear, budget, taste
- `js/services.js`: live data sources and the research pass
- `js/ui.js`: screens and interactions
- `js/ideas.js`: the trip idea generator
- `sw.js`, `manifest.webmanifest`, `icons/`: install and offline support
- `supabase.sql`, `config.js`: community feed
- `v1/index.html`: the original desktop planner
