# Planerr

A phone-first web app for planning day-trip adventures. Add it to your home screen and it opens like an app, even offline.

## What it does

- **Plan with Pip**: describe your day in your own words on the Home screen ("easy hike with the kids Saturday, under an hour away, tacos after"). Pip, the camper-van mascot, picks out the kinds of day, drive time, date, times, group, food, diet, budget and starting town, fills in the trip-ideas settings and builds the 3 plans. It reads keywords in the browser; no AI service or key is involved.
- **Closure checks**: before suggesting a place, Planerr reads the map tags on the last stretch of road in (seasonal roads, winter gates such as `motor_vehicle:conditional=no @ (Nov 15-May 15)`), the destination's elevation (places above about 9,500 ft are skipped mid-October to June, except ski areas), forecast snow on the ground, and restaurant tags (`seasonal=*`, opening-hours month ranges, "temporarily closed" notes). Restaurants closed that day are hidden. Anything marked **It's closed** isn't suggested again for 3 months. Free map data still misses some closures, so check official sites before you go.
- **Recommended trails** for any hike: named trails near the hike stop with length, climb, walk time, difficulty, surface and dog rules, plus directions to the start, Google reviews and a trail map. **Use this trail** adds it to the plan and sets the hike time. Trail data comes from OpenStreetMap (Photon and Nominatim) and elevations from Open-Meteo.
- **Your photos**: after a trip (or during it, from live mode), add your own pictures and file each one under the stop where you took it, so every attraction gets its own album. Pick a cover photo for the trip. Photos are stored on the phone only (IndexedDB) and never uploaded.
- **Trip ideas**: enter your starting point, the longest drive you want each way, the date and times, the kinds of day you're into, the food you like, a budget and whether the kids are coming. Planerr finds well-known real places within that drive (Wikidata), checks the actual drive time and that day's weather for each, picks restaurants that match your taste, adds sights nearby, and builds **3 different day plans**. Tap **Save this plan**, or **Show me 3 different plans** for more.
- **Want to go**: tap 🤍 on a trip idea or an Explore post to save it for later. Saved places are listed on Home, and **Plan it** opens a new plan with the stops filled in.
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
- **Ready for tomorrow?**: the day before a trip, Home shows a short checklist: the forecast and what to wear, when to leave and set an alarm, how much is packed, tickets to sort out, anything to check, and a fuel reminder for long drives.
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

The anon key is meant to be public. Row Level Security lets anyone read and post, but nobody can edit or delete other people's posts through the app. To review reported posts or remove one, see **Reviewing reported posts** below.

## Reviewing reported posts

When 3 different phones report a community post, it's hidden from Explore automatically. You decide whether it stays hidden, comes back, or is deleted. There's no admin screen in the app on purpose: the app's key is public, so anyone could open one. Instead you do this in Supabase, where only you are signed in.

**See the hidden posts**

1. Go to https://supabase.com, sign in, and open your Planerr project.
2. Click **SQL Editor** in the left menu, then **New query**.
3. Paste this and click **Run**. You'll get a table with each hidden post's `id`, title, place, date posted and number of reports (newest first). It only looks; it changes nothing.

```sql
select a.id, a.title, a.region as place, a.created_at as posted_on, count(r.reporter) as reports
from public.adventures a
left join public.adventure_reports r on r.adventure_id = a.id
where a.hidden
group by a.id
order by a.created_at desc;
```

**Bring a post back (it was fine)**

1. In the results above, copy the post's `id` (click the cell, then copy).
2. Click **New query**, paste this, and replace `PASTE-POST-ID-HERE` with the id. Keep the quote marks.
3. Click **Run**. The post shows in Explore again, and its reports are wiped so it doesn't hide itself straight away.

```sql
begin;
delete from public.adventure_reports where adventure_id = 'PASTE-POST-ID-HERE';
update public.adventures set hidden = false where id = 'PASTE-POST-ID-HERE';
commit;
```

**Delete a post for good (it was bad)**

Same steps, with this query. **Deleting can't be undone.** If you're unsure, leave the post hidden, because hidden posts are invisible to everyone anyway.

```sql
delete from public.adventures where id = 'PASTE-POST-ID-HERE';
```

Tips: use a fresh **New query** each time so you only run the one you meant to. Supabase may show a warning for the delete query, which is normal. The same queries are saved (commented out) at the bottom of `supabase.sql`.

## Checking your visitor numbers

Planerr counts visitors anonymously, so you can see whether people use it and come back. Once a day, each phone sends a random number (not a name, location or trip), the date, and whether Planerr is installed on its Home Screen. People can turn this off on the You screen. Your own testing on `localhost` isn't counted.

**One-time setup:** in Supabase, open **SQL Editor → New query**, paste the whole `supabase.sql` file, and click **Run**. It's safe to run again; it only adds what's missing.

**See the numbers:** open **SQL Editor → New query**, paste one of these, and click **Run**. They only read; nothing changes.

The big picture:

```sql
select
  count(distinct device)                                                     as people_ever,
  count(distinct device) filter (where day >= current_date - 6)              as people_last_7_days,
  (select count(*) from (select device from public.visits group by device having count(*) >= 2) r) as came_back_at_least_once,
  (select count(*) from (select device from public.visits group by device having count(*) >= 3) r) as used_it_3_plus_days,
  count(distinct device) filter (where installed)                            as installed_on_home_screen
from public.visits;
```

People per day, last 30 days:

```sql
select day, count(*) as people, count(*) filter (where installed) as installed
from public.visits
where day >= current_date - 29
group by day order by day desc;
```

Do new people come back? (Each week: how many were new, and how many of them came back on a later day.)

```sql
with firsts as (select device, min(day) as first_day from public.visits group by device)
select date_trunc('week', f.first_day)::date as week_started,
       count(*) as new_people,
       count(*) filter (where exists (select 1 from public.visits v where v.device = f.device and v.day > f.first_day)) as came_back
from firsts f
group by 1 order by 1 desc;
```

**How to read it:** "came back" is the number that matters. If a good share of new people come back on another day, Planerr is useful to them. One person on two phones (or after clearing the browser) counts as two.

## Reading feedback

The You screen has a **Tell us what you think** box. Messages (and an email, if the person chose to leave one) go to your Supabase project. Nobody can read them through the app; only you can, in the dashboard.

**One-time setup:** run the whole `supabase.sql` file again in **SQL Editor → New query**. It only adds what's missing.

**Read new messages:** open **SQL Editor → New query**, paste this and click **Run**:

```sql
select id, created_at as sent_on, message, contact from public.feedback where not done order by created_at desc;
```

**Mark one as handled** so it drops off that list (replace `123` with its `id`):

```sql
update public.feedback set done = true where id = 123;
```

You can also browse them in **Table Editor → feedback**.

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
- `js/wishlist.js`: the Want to go list
- `js/evening.js`: the Ready for tomorrow? card on Home
- `sw.js`, `manifest.webmanifest`, `icons/`: install and offline support
- `supabase.sql`, `config.js`: community feed
- `v1/index.html`: the original desktop planner
