# Planerr to-do list

Add ideas anywhere in **Inbox**: a sentence is enough. The nightly agent picks the top unchecked
item from **Up next** (or a bug it found), does it on a branch, opens a pull request and moves the
item to **In review**. Merge the pull request to put it live, then tick it off under **Done**.

Tags: `[bug]` something broken · `[feature]` new section or ability · `[polish]` looks or wording ·
`[needs-owner]` needs an account, a decision or something only the owner can do (the agent skips these).

## Inbox

- (add new ideas here)

## Up next

- [ ] `[feature]` Pip chat: understand more phrasings (for example "something to do with my dog", "not too hot", "somewhere new", "rainy day backup") and suggest one follow-up question when the description is thin.
- [ ] `[polish]` Restaurants: when a plan ends up with "Lunch near…" because no restaurant was found within 6 km, widen the search before giving up.
- [ ] `[feature]` Photos: a "Trip recap" view that shows each stop with its photos, rating and notes as one scrolling story.
- [ ] `[feature]` Export or back up photos and adventures to a file, since everything lives on one phone.
- [ ] `[polish]` Closures: check the road in for every stop with a place, not only the main destination.

## In review

- Count the whole trail: trails that run past the ~4 mile search area get one wider lookup (Trails, third slice)

## Needs the owner

- [ ] `[needs-owner]` Community feed: create a free Supabase project, run `supabase.sql`, paste the URL and anon key into `config.js`. Until then Explore only shows built-in examples.
- [ ] `[needs-owner]` Google "temporarily closed" status and in-app Google reviews need a Google Cloud account with billing (Places API). Declined for now.
- [ ] `[needs-owner]` Pip as a real AI chat needs a paid AI account and a small server to hold the key. Declined for now; Pip stays keyword-based.

## Known limits (not bugs)

- Free map data misses some closures. For example, Brainard Lake Road (to Mount Audubon) isn't tagged as seasonal, so the elevation check is what catches it.
- Trail lengths count pieces within about 4 miles of the stop; a trail that runs off that area gets one wider lookup (up to about 12 miles), for the first 3 such trails only.
- Photos are stored on the phone only and aren't backed up.

## Done

- [x] Mark out-and-back trails (Trails, second slice)
- [x] Show which trails are loops (first slice of the Trails item)
- [x] Trip ideas about twice as fast (25 s → about 11 s)
- [x] Google reviews button on restaurants and trails
- [x] Cartoon art (Pip), home banner, polished look
- [x] Restaurants from Nominatim (Overpass kept as backup)
- [x] Plan with Pip chat
- [x] Recommended trails for hikes
- [x] Trip photo albums per stop
- [x] Closure checks: roads in, snowed-in peaks, seasonal restaurants, "It's closed" reports
