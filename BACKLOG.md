# Planerr to-do list

Add ideas anywhere in **Inbox**: a sentence is enough. The nightly agent picks the top unchecked
item from **Up next** (or a bug it found), does it on a branch, opens a pull request and moves the
item to **In review**. Merge the pull request to put it live, then tick it off under **Done**.

Tags: `[bug]` something broken · `[feature]` new section or ability · `[polish]` looks or wording ·
`[needs-owner]` needs an account, a decision or something only the owner can do (the agent skips these).

## Inbox

- (add new ideas here)

## Up next

## In review

- `[feature]` Trip recap: Share and Print buttons, and a Recap link on past adventure cards (PR: "Trip recap: share, print, and a Recap link on Home")

## Needs the owner

- [ ] `[needs-owner]` Google "temporarily closed" status and in-app Google reviews need a Google Cloud account with billing (Places API). Declined for now.
- [ ] `[needs-owner]` Pip as a real AI chat needs a paid AI account and a small server to hold the key. Declined for now; Pip stays keyword-based.

## Known limits (not bugs)

- Reports count phones, not people: someone who clears their browser data can report the same post again.
- Free map data misses some closures. For example, Brainard Lake Road (to Mount Audubon) isn't tagged as seasonal, so the elevation check is what catches it.
- Trail lengths count pieces within about 4 miles of the stop; a trail that runs off that area gets one wider lookup (up to about 12 miles), for the first 3 such trails only.
- Photos live on the phone; they're only backed up when you use Export backup on the You page.

## Done

- [x] "Somewhere new" skips places from your past adventures (#15)
- [x] Favor well-known places in trip ideas (#13)
- [x] Check the road in for every stop, not just the main one (#14)
- [x] Report button on Explore posts (hidden for everyone after 3 reports)
- [x] Backup file includes trip photos
- [x] Trip recap: one scrolling story per finished adventure
- [x] Community feed switched on (Supabase): shared adventures show on Explore
- [x] Wider lunch search: about 9 km out before falling back to "Lunch near…"
- [x] Pip understands more phrasings and asks one follow-up question (dog, not too hot, somewhere new, backup plans)
- [x] Count the whole trail: trails that run past the ~4 mile search area get one wider lookup
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
