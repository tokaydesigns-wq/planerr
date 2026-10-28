'use strict';
// Trip ideas: find real, notable places within the drive time you want, check the actual drive,
// the weather and food you'd like there, then build three different day plans.

// Where each kind of day comes from: Wikidata place types ("instance of"). Results are ranked by
// how many Wikipedia languages cover the place, which keeps ideas to well-known spots.
const WD_TYPES = {
  hike:      ['Q8502', 'Q34038', 'Q2143825', 'Q150784'],          // mountain, waterfall, hiking trail, canyon
  beach:     ['Q40080'],                                           // beach
  lake:      ['Q23397', 'Q131681'],                                // lake, reservoir
  park:      ['Q46169', 'Q1761072', 'Q179049', 'Q893775', 'Q167346'], // national/state park, nature reserve, national monument, botanical garden
  city:      ['Q1093829', 'Q15127012', 'Q3957', 'Q515'],           // US city/town, town, city
  themepark: ['Q194195', 'Q2416723', 'Q740326'],                   // amusement park, theme park, water park
  museum:    ['Q33506', 'Q207694', 'Q588140', 'Q43501', 'Q2281788', 'Q756102'], // museums, zoo, aquarium, open-air museum
  food:      ['Q15127012', 'Q3957', 'Q1093829'],                   // towns to eat your way through
  roadtrip:  ['Q6017969', 'Q893775', 'Q150784'],                   // scenic viewpoint, national monument, canyon
  snow:      ['Q130003'],                                          // ski resort
};
// Nearby Wikipedia articles that make good extra stops, and ones that don't (events, schools, suburbs…).
const SIGHT_OK = /park|trail|museum|lake|falls|waterfall|peak|mountain|historic|monument|garden|reservoir|canyon|beach|bridge|observatory|zoo|gallery|lighthouse|church|cathedral|mission|fort\b|castle|pier|wildlife|refuge|preserve|reserve|arboretum|winery|brewery|market|theat|landmark|tower|cave|springs|overlook|viewpoint|plaza|square|memorial|ranch|farm|mill|railroad|railway|depot|sculpture|aquarium|amphitheat|dam\b|rock|butte|mesa|arch/i;
const SIGHT_BAD = /massacre|shooting|murder|disaster|crash|killed|bombing|riot|attack|school|college|university|census-designated|unincorporated|neighborhood|neighbourhood|subdivision|cemetery|airport|interchange|station\b|highway|interstate|\broute\b|hospital|prison|correctional|company|corporation|church of jesus|election|district\b|county\b/i;
// Sights that usually charge admission or sell tours.
const PAID_SIGHT = /museum|\bmine\b|gold mine|tour|zoo|aquarium|cave|cavern|railroad|railway|observatory|gallery|theat|castle|winery|brewery|amusement|gondola|tram\b|planetarium|wildlife park/i;
const goodSight = n => !SIGHT_BAD.test(n.title + ' ' + n.text.slice(0, 160)) && SIGHT_OK.test(n.title + ' ' + n.text.slice(0, 160));
const IDEA_DUR = { hike: 180, beach: 180, lake: 150, park: 150, city: 120, themepark: 360, museum: 150, food: 60, roadtrip: 60, snow: 300 };
const IDEA_COST = { hike: 5, beach: 5, lake: 5, park: 10, city: 0, themepark: 90, museum: 25, food: 0, roadtrip: 0, snow: 110 };
const IDEA_PRICE = {
  hike: 'Parking or trailhead fee', beach: 'Parking', lake: 'Day-use or parking fee', park: 'Entry or parking',
  city: 'Free to wander. You only pay for what you buy', themepark: 'Day ticket (check the official site for today’s price)', museum: 'Admission',
  food: 'Free to wander. Food is priced below', roadtrip: 'Free', snow: 'Lift ticket',
};
const IDEA_TITLE = {
  hike: n => `Hike ${n}`, beach: n => `Beach day at ${n}`, lake: n => `Lake day at ${n}`, park: n => `${n} nature day`,
  city: n => `Explore ${n}`, themepark: n => `Thrills at ${n}`, museum: n => `${n} & around`, food: n => `Food crawl in ${n}`,
  roadtrip: n => `Road trip to ${n}`, snow: n => `Snow day at ${n}`,
};
const OUTDOOR_TYPES = new Set(['hike', 'beach', 'lake', 'park', 'roadtrip']);
const LIKE_CUISINES = ['pizza', 'mexican', 'italian', 'burger', 'japanese', 'thai', 'chinese', 'indian', 'korean', 'vietnamese', 'seafood', 'bbq', 'mediterranean', 'american', 'vegetarian', 'bakery', 'coffee_shop', 'ice_cream'];
const DRIVE_STEPS = [15, 30, 45, 60, 75, 90, 120, 150, 180, 240];

function ideaPrefs() {
  if (!state.ideaPrefs) {
    state.ideaPrefs = {
      origin: state.adventures.find(a => a.origin && !a.example)?.origin || null,
      maxDrive: 90, date: nextSaturday(), start: '08:00', end: '19:00',
      types: ['hike', 'beach', 'city'], budget: 150, people: 2, familyMode: false,
    };
  }
  if (state.ideaPrefs.date < todayStr()) state.ideaPrefs.date = nextSaturday();
  return state.ideaPrefs;
}

const STEP_LABELS = {
  places: p => `Finding places within ${fmtDur(p.maxDrive)} of ${p.origin.label}`,
  drive: () => 'Checking real drive times',
  weather: () => 'Checking the weather that day',
  food: () => 'Finding food you’ll like',
  photos: () => 'Getting photos and sights nearby',
};

const reachKm = inp => Math.min(260, inp.maxDrive * 1.05);

async function wdPlaces(origin, km, type) {
  const q = `SELECT ?item ?itemLabel ?coord ?image ?links ?article WHERE {
    SERVICE wikibase:around { ?item wdt:P625 ?coord. bd:serviceParam wikibase:center "Point(${origin.lon.toFixed(4)} ${origin.lat.toFixed(4)})"^^geo:wktLiteral. bd:serviceParam wikibase:radius "${Math.round(km)}". }
    VALUES ?t { ${WD_TYPES[type].map(x => 'wd:' + x).join(' ')} }
    ?item wdt:P31 ?t ; wikibase:sitelinks ?links .
    OPTIONAL { ?item wdt:P18 ?image }
    OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> . }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  } ORDER BY DESC(?links) LIMIT 60`;
  const d = await getJSON('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q));
  const seen = new Set();
  return d.results.bindings.flatMap(b => {
    const id = 'wd:' + b.item.value.split('/').pop(), m = b.coord.value.match(/Point\(([-\d.]+) ([-\d.]+)\)/), name = b.itemLabel?.value;
    if (seen.has(id) || !m || !name || /^Q\d+$/.test(name)) return [];
    seen.add(id);
    const pt = { lat: +m[2], lon: +m[1] };
    return [{
      id, name, ...pt, type, links: +b.links.value, crow: haversine(origin, pt),
      image: b.image ? b.image.value.replace(/^http:/, 'https:') + '?width=1000' : null,
      wiki: b.article ? 'en:' + decodeURIComponent(b.article.value.split('/wiki/')[1]).replace(/_/g, ' ') : null,
    }];
  });
}

// Wikidata allows a few queries at once, so the kinds of day are fetched in small batches.
async function findCandidates(inp) {
  const out = [], km = reachKm(inp);
  let failures = 0;
  for (let i = 0; i < inp.types.length; i += 4) {
    const batch = await Promise.all(inp.types.slice(i, i + 4).map(t => wdPlaces(inp.origin, km, t).catch(() => { failures++; return []; })));
    batch.forEach(list => out.push(...list));
  }
  if (!out.length && failures) throw new Error('places');
  const seen = new Set();
  return out.filter(c => !seen.has(c.id) && seen.add(c.id));
}

// Shortlist ~12 places spread across the chosen kinds of day, favoring well-known ones a comfortable distance out.
function shortlist(cands, inp, exclude) {
  const R = reachKm(inp), minKm = Math.max(6, R * 0.1);
  const byType = {};
  cands.filter(c => c.crow >= minKm && c.crow <= R && !exclude.has(c.id)).forEach(c => { (byType[c.type] = byType[c.type] || []).push(c); });
  const types = Object.keys(byType);
  const per = Math.max(3, Math.ceil(12 / Math.max(1, types.length)));
  return types.flatMap(t => byType[t]
    .map(c => ({ ...c, pre: 1 - Math.abs(c.crow / R - 0.5) + Math.log10(c.links + 1) * 0.35 + Math.random() * 0.35 }))
    .sort((a, b) => b.pre - a.pre).slice(0, per));
}

function scoreCandidate(c, inp) {
  if (!c.drive || c.drive.min > inp.maxDrive * 1.1) return -Infinity;
  const window = toMin(inp.end) - toMin(inp.start);
  if (c.drive.min * 2 + 60 > window) return -Infinity;
  let s = 1 - Math.abs(c.drive.min / inp.maxDrive - 0.65) * 1.1 + Math.log10(c.links + 1) * 0.3 + Math.random() * 0.2;
  if (c.wx) {
    if (OUTDOOR_TYPES.has(c.type)) s -= c.wx.rain >= 60 ? 0.8 : c.wx.rain >= 40 ? 0.3 : 0;
    if (c.type === 'beach' && c.wx.hi < (imperial() ? 68 : 20)) s -= 0.4;
    if (c.type === 'museum' && c.wx.rain >= 50) s += 0.3;
  }
  return s;
}

// Three picks: different kinds of day and at least 20 km apart when possible.
function pickThree(pool) {
  const sorted = pool.filter(c => c.score > -Infinity).sort((a, b) => b.score - a.score), picks = [];
  for (const pass of [0, 1, 2]) {
    for (const c of sorted) {
      if (picks.length === 3) break;
      if (picks.includes(c)) continue;
      const sameType = picks.some(p => p.type === c.type), near = picks.some(p => haversine(p, c) < 20);
      if ((pass === 0 && (sameType || near)) || (pass === 1 && near)) continue;
      picks.push(c);
    }
  }
  return picks;
}

function makePlan(inp, c, food, ex) {
  const kids = inp.familyMode ? state.family.kids.length : 0, people = inp.people + kids;
  const start = toMin(inp.start), window = toMin(inp.end) - start, drive = c.drive.min;
  const mainCat = c.type === 'food' || c.type === 'city' ? 'sight' : TYPES[c.type].cat;
  const who = `${people} ${people === 1 ? 'person' : 'people'}`;
  const main = newStop({
    name: c.name, cat: mainCat, main: true, dur: IDEA_DUR[c.type], cost: IDEA_COST[c.type] * people,
    place: { label: c.name, sub: '', lat: c.lat, lon: c.lon, osm: null },
    desc: ex.photo?.text || '', photo: ex.photo?.img || null, url: ex.photo?.url || null,
    priceNote: IDEA_COST[c.type] ? `${IDEA_PRICE[c.type]}: about ${money(IDEA_COST[c.type])} per person × ${who}` : IDEA_PRICE[c.type],
  });

  const near = food.filter(f => haversine(f, c) < 6).map(f => ({ ...f, s: tasteScore(f) + (f.cuisine.length ? 0.3 : 0) - haversine(f, c) / 8 })).sort((a, b) => b.s - a.s);
  const foods = [];
  for (const f of near) {
    if (foods.length === 4) break;
    if (!foods.some(p => p.cuisine[0] && p.cuisine[0] === f.cuisine[0])) foods.push(f);
  }
  const foodStop = (f, dur) => {
    const each = f.amenity === 'restaurant' ? 22 : f.amenity === 'pub' ? 20 : 10;
    return newStop({
      name: f.name, cat: 'food', dur, cost: each * people, cuisine: f.cuisine,
      place: { label: f.name, sub: f.cuisine.map(x => cuisineInfo(x)[0]).join(', '), lat: f.lat, lon: f.lon, osm: f.id },
      meta: { amenity: f.amenity, hours: f.hours, website: f.website, diet: f.diet, outdoor: f.outdoor, takeaway: f.takeaway },
      priceNote: `${f.amenity === 'restaurant' ? 'Sit-down meal' : f.amenity === 'pub' ? 'Pub meal' : 'Quick bite or café'}: about ${money(each)} per person × ${who}`,
    });
  };
  const sights = (ex.nearby || []).filter(n => n.title !== c.name && n.title !== ex.photo?.title && goodSight(n) && haversine(n, c) > 0.05 && haversine(n, c) < 15);

  const stops = [main];
  const used = () => drive * 2 + stops.reduce((a, s) => a + s.dur, 0) + (stops.length - 1) * 10;
  // Without restaurant data (map server busy), keep a lunch slot; the saved plan fills in real places.
  if (foods[0]) stops.push(foodStop(foods[0], 60));
  else stops.push(newStop({ name: `Lunch near ${c.name}`, cat: 'food', dur: 60, cost: 18 * people, tip: 'Open the saved plan for restaurant picks that match your taste.', priceNote: `Lunch: about $18 per person × ${who}` }));
  if (c.type === 'food') foods.slice(1, 3).forEach(f => stops.push(foodStop(f, 30)));
  for (const n of sights.slice(0, 5)) {
    if (used() + 50 > window - 40) break;
    const paid = PAID_SIGHT.test(n.title + ' ' + n.text.slice(0, 200));
    stops.push(newStop({
      name: n.title, cat: paid ? 'fun' : 'sight', dur: paid ? 60 : 40, tip: (n.text.split(/(?<=\.)\s/)[0] || '').slice(0, 140),
      cost: paid ? 15 * people : 0,
      place: { label: n.title, sub: '', lat: n.lat, lon: n.lon, osm: null },
      desc: n.text, photo: n.img, url: n.url,
      priceNote: paid ? `Admission or tour likely: about $15 per person × ${who} (check the official site)` : 'Usually free to see. Some sights charge entry, so check before you go.',
    }));
  }
  // Leave room for dinner when the day runs into the evening, then stretch the main stop into the free time.
  const dinner = foods.find(f => !stops.some(s => s.place?.osm === f.id) && !['cafe', 'ice_cream'].includes(f.amenity));
  const reserve = dinner && start + window >= 18 * 60 + 30 ? 70 : 0;
  const slack = window - used() - reserve;
  // Stretch no further than 1.6× the usual time, and not so far that lunch slips past 2 PM.
  const lunchBy = 14 * 60 - (start + drive) - 10;
  if (slack > 30) main.dur = Math.max(main.dur, Math.min(main.dur + slack - 20, Math.round(IDEA_DUR[c.type] * 1.6), lunchBy));
  else if (slack < 0) main.dur = Math.max(45, main.dur + slack);
  if (reserve && start + used() - drive + 10 >= 16 * 60 + 30) stops.push(foodStop(dinner, 60));

  const adv = newAdventure({
    title: IDEA_TITLE[c.type](c.name), type: c.type, date: inp.date, start: inp.start, end: inp.end,
    budget: inp.budget, people: inp.people, origin: inp.origin, familyMode: inp.familyMode, stops,
  });
  adv.research = { photo: ex.photo, nearby: ex.nearby || [] };

  let cur = start + drive;
  const times = stops.map((s, i) => { if (i) cur += 10; const t = cur; cur += s.dur; return t; });
  const fuel = (c.drive.km * 2 * 0.621 / 27) * 3.6;
  const cost = stops.reduce((a, s) => a + s.cost, 0) + fuel;

  const likes = state.profile.likes || [], liked = x => likes.includes(x) || (state.profile.taste[x] || 0) > 0;
  const reasons = [`🚗 ${fmtDur(drive)} each way`, `${TYPES[c.type].e} ${TYPES[c.type].label}`];
  if (c.wx) reasons.push(`${wmo(c.wx.code)[0]} ${Math.round(c.wx.hi)}° · ${c.wx.rain}% rain`);
  const match = stops.find(s => s.cuisine?.some(liked));
  if (match) { const k = match.cuisine.find(liked); reasons.push(`${cuisineInfo(k)[1]} ${cuisineInfo(k)[0]} you like`); }
  if (inp.familyMode && kids) reasons.push('👨‍👩‍👧 Family mode');
  return { adv, type: c.type, drive, km: c.drive.km, wx: c.wx, times, home: cur + drive, cost, fuel, reasons, overBudget: inp.budget && cost > inp.budget, noFood: !food.length, wiki: c.wiki, wdImage: c.image };
}

async function generateIdeas(shuffle) {
  const inp = ideaPrefs();
  if (!inp.origin) { toast('Add where you’re starting from.'); return; }
  if (!inp.types.length) { toast('Pick at least one kind of day.'); return; }
  if (toMin(inp.end) - toMin(inp.start) < 180) { toast('Give yourself at least 3 hours between leaving and getting back.'); return; }
  const key = JSON.stringify([inp.origin.lat, inp.origin.lon, inp.maxDrive, [...inp.types].sort()]);
  const prev = ui.ideas;
  const run = ui.ideas = { status: 'running', step: 'places', plans: [], key, seen: shuffle && prev?.key === key ? prev.seen : new Set(), cands: prev?.key === key ? prev.cands : null };
  const setStep = s => { run.step = s; if (parseRoute().view === 'ideas' && ui.ideas === run) renderIdeasResults(); };
  setStep('places');
  try {
    if (!run.cands) run.cands = await findCandidates(inp);
    let pool = shortlist(run.cands, inp, run.seen);
    if (pool.length < 3 && run.seen.size) { run.seen = new Set(); pool = shortlist(run.cands, inp, run.seen); }
    if (!pool.length) throw { friendly: `Couldn’t find matching places within ${fmtDur(inp.maxDrive)}. Try a longer drive or add more kinds of day.` };

    setStep('drive');
    const drives = await API.driveTable(inp.origin, pool);
    pool.forEach((c, i) => { c.drive = drives[i]; });

    setStep('weather');
    const days = daysUntil(inp.date);
    if (days >= 0 && days <= 15) {
      try { const wx = await API.weatherMany(pool, inp.date, state.profile.units); pool.forEach((c, i) => { c.wx = wx[i]; }); } catch (e) {}
    }
    pool.forEach(c => { c.score = scoreCandidate(c, inp); });
    const picks = pickThree(pool);
    if (!picks.length) throw { friendly: `Nothing within ${fmtDur(inp.maxDrive)} of driving fits between ${fmtTime(toMin(inp.start))} and ${fmtTime(toMin(inp.end))}. Try a longer drive or a longer day.` };
    picks.forEach(c => run.seen.add(c.id));

    setStep('food');
    let food = [];
    // Don't hold the plans hostage to a busy map server: give food 20 seconds, then build without it.
    try { food = await Promise.race([API.food(picks, 8000), new Promise((_, no) => setTimeout(() => no(new Error('slow')), 20000))]); } catch (e) {}

    setStep('photos');
    const extras = await Promise.all(picks.map(async c => {
      const [page, nearby] = await Promise.all([
        c.wiki ? API.wikiPage(c.wiki).catch(() => null) : null,
        API.wikiNearby(c).catch(() => []),
      ]);
      const photo = page || (c.image ? { img: c.image, title: c.name, text: '', url: `https://www.wikidata.org/wiki/${c.id.slice(3)}` } : null);
      return { photo, nearby };
    }));
    run.plans = picks.map((c, i) => makePlan(inp, c, food, extras[i]));
    run.status = 'done';
    state.lastIdeas = { plans: run.plans, key, date: inp.date };
    save();
    run.note = picks.length < 3 ? `Only ${picks.length} place${picks.length > 1 ? 's' : ''} fit. A longer drive or more kinds of day will give you more options.` : '';
  } catch (e) {
    run.status = 'error';
    run.msg = e.friendly || 'Couldn’t reach the map service. Check your connection and try again.';
  }
  if (ui.ideas === run && parseRoute().view === 'ideas') { renderIdeasResults(); $('#idea-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
}

// Plans from the last run survive a reload, so a plan's detail page can be reopened.
function restoreIdeas() {
  if (!ui.ideas && state.lastIdeas?.plans?.length) ui.ideas = { status: 'done', plans: state.lastIdeas.plans, key: state.lastIdeas.key, seen: new Set(), cands: null };
}

function ideaCard(p, i) {
  const a = p.adv, photo = a.research.photo;
  return `<article class="idea">
    <a class="hero flat" href="#/idea/${i}" aria-label="See photos and details for ${esc(a.title)}">
      ${photo?.img ? `<img src="${esc(photo.img)}" alt="">` : sceneSVG(a.type)}
      <div class="hero-top"><span class="pill coral">Plan ${i + 1}</span><span class="pill">${TYPES[a.type].e} ${TYPES[a.type].label}</span><span class="spacer"></span><span class="pill">📷 Photos & details</span></div>
      <div class="hero-body"><h2>${esc(a.title)}</h2></div>
    </a>
    <div class="idea-body">
      <div class="row wrap">${p.reasons.map(r => `<span class="pill line">${esc(r)}</span>`).join('')}</div>
      ${photo?.text ? `<p class="small muted">${esc(photo.text.slice(0, 160))}${photo.text.length > 160 ? '…' : ''}</p>` : ''}
      <div class="list">
        <div class="li" style="grid-template-columns:64px 1fr"><b class="small">${fmtTime(toMin(a.start))}</b><div class="main"><b>Leave ${esc(a.origin.label)}</b><span class="small muted">${fmtDur(p.drive)} drive · ${dist(p.km)}</span></div></div>
        ${a.stops.map((s, j) => `<div class="li" style="grid-template-columns:64px 1fr"><b class="small">${fmtTime(p.times[j])}</b><div class="main"><b>${s.main ? '⭐ ' : CATS[s.cat].e + ' '}${esc(s.name)}</b><span class="small muted">${fmtDur(s.dur)}${s.cuisine?.length ? ' · ' + esc(s.cuisine.slice(0, 2).map(x => cuisineInfo(x)[0]).join(', ')) : ''}${s.tip ? ' · ' + esc(s.tip.slice(0, 70)) + (s.tip.length > 70 ? '…' : '') : ''}</span></div></div>`).join('')}
        <div class="li" style="grid-template-columns:64px 1fr"><b class="small">${fmtTime(p.home)}</b><div class="main"><b>🏠 Back home</b></div></div>
      </div>
      ${p.noFood ? '<p class="small muted">The restaurant map is busy right now, so lunch is a placeholder. Save the plan and it fills in places that match your taste.</p>' : ''}
      <div class="row wrap small"><span>Est. <b>${money(p.cost)}</b>${p.overBudget ? ` <span class="pill warn">over your ${money(a.budget)}</span>` : ` <span class="pill good">within budget</span>`}</span></div>
      <div class="row"><a class="btn" style="flex:1" href="#/idea/${i}">See photos & details</a>
      ${p.saved ? `<a class="btn dark" style="flex:1" href="#/a/${a.id}">Saved · Open</a>` : `<button class="btn primary" style="flex:1" data-act="idea-save" data-i="${i}">Save this plan</button>`}</div>
    </div>
  </article>`;
}

// ---------- plan detail: photo gallery, descriptions, price per stop ----------
const ideaLoading = new Set();
const photoKey = url => decodeURIComponent(url.split('?')[0].replace(/^.*\//, '')).replace(/^\d+px-/, '').replace(/_/g, ' ').toLowerCase();

async function loadIdeaExtras(p) {
  if (p.gallery || ideaLoading.has(p)) return;
  ideaLoading.add(p);
  const main = p.adv.stops.find(s => s.main);
  const [imgs, about] = await Promise.all([
    p.wiki ? API.wikiImages(p.wiki).catch(() => []) : [],
    p.wiki ? API.wikiPage(p.wiki, 8, false).catch(() => null) : null,
  ]);
  const slides = [], keys = new Set();
  const add = (img, caption, credit, page) => {
    if (!img) return;
    const k = photoKey(img);
    if (keys.has(k)) return;
    keys.add(k); slides.push({ img, caption, credit, page });
  };
  const photo = p.adv.research.photo;
  if (photo?.img) add(photo.img, main.name, 'Wikipedia', photo.url);
  imgs.forEach(x => add(x.img, x.caption || main.name, x.credit, x.page));
  if (p.wdImage) add(p.wdImage, main.name, 'Wikimedia Commons', null);
  p.adv.stops.filter(s => !s.main && s.photo).forEach(s => add(s.photo, s.name, 'Wikipedia', s.url));
  (p.adv.research.nearby || []).filter(goodSight).slice(0, 6).forEach(n => add(n.img, n.title, 'Wikipedia', n.url));
  p.gallery = slides;
  if (about?.text && about.text.length > (main.desc || '').length) { main.desc = about.text; main.url = about.url; }
  ideaLoading.delete(p);
  save();
  const r = parseRoute();
  if (r.view === 'idea' && ui.ideas?.plans?.[+r.id] === p) { const y = window.scrollY; render(); window.scrollTo(0, y); }
}

function foodDesc(s, date) {
  const m = s.meta || {}, kind = (AMENITY_FOOD[m.amenity] || ['Restaurant'])[0].toLowerCase();
  const cuis = (s.cuisine || []).map(c => cuisineInfo(c)[0]);
  const diets = Object.entries(m.diet || {}).filter(([, v]) => v === 'yes' || v === 'only').map(([k]) => DIETS[k].toLowerCase());
  const lead = `${cuis.length ? cuis.join(' & ') + ' ' : ''}${kind}`;
  let t = lead[0].toUpperCase() + lead.slice(1) + (diets.length ? ` with ${diets.join(' and ')} options` : '') + '.';
  if (m.outdoor === 'yes') t += ' Has outdoor seating.';
  if (m.takeaway === 'yes') t += ' Does takeout.';
  if (m.hours) {
    const h = hoursOn(m.hours, date);
    t += h.status === 'open' ? ` Open ${h.text} that day.` : h.status === 'closed' ? ' Listed as closed that day, so check before you go.' : ` Hours: ${m.hours}.`;
  }
  const likes = state.profile.likes || [];
  if ((s.cuisine || []).some(c => likes.includes(c) || (state.profile.taste[c] || 0) > 0)) t += ' Matches food you like.';
  return t;
}

function stopDetail(p, s, j) {
  const a = p.adv;
  const desc = s.cat === 'food' && s.meta ? foodDesc(s, a.date) : s.desc || s.tip || (s.main ? `${TYPES[a.type].label} destination about ${fmtDur(p.drive)} from ${a.origin.label}.` : '');
  const link = s.meta?.website ? [s.meta.website, 'Website'] : s.url ? [s.url, 'Read more'] : null;
  return `<div class="stop-detail">
    <div class="sd-head">
      <span class="sd-time">${fmtTime(p.times[j])}</span>
      <div class="sd-name"><b>${s.main ? '⭐' : CATS[s.cat].e} ${esc(s.name)}</b><span class="small muted">${fmtDur(s.dur)} · ${CATS[s.cat].label}</span></div>
      <span class="sd-price ${s.cost ? '' : 'free'}">${s.cost ? money(s.cost) : 'Free'}</span>
    </div>
    ${s.photo && !s.main ? `<img class="sd-img" src="${esc(s.photo)}" alt="${esc(s.name)}" loading="lazy">` : ''}
    ${desc ? `<p>${esc(desc)}</p>` : ''}
    ${s.priceNote ? `<p class="small muted">💵 ${esc(s.priceNote)}</p>` : ''}
    <div class="row wrap">${s.place ? `<a class="pill line" href="${mapsDir(s.place)}" target="_blank" rel="noopener">Directions ↗</a>` : ''}${link ? `<a class="pill line" href="${esc(link[0])}" target="_blank" rel="noopener">${link[1]} ↗</a>` : ''}</div>
  </div>`;
}

function ideaDetail(i) {
  restoreIdeas();
  const p = ui.ideas?.plans?.[+i];
  if (!p) return `<div class="screen"><div class="empty">This plan isn’t available anymore. Generate new ideas to see more.<a class="btn" href="#/ideas">Back to ideas</a></div></div>`;
  const a = p.adv, main = a.stops.find(s => s.main);
  const slides = p.gallery || (a.research.photo?.img ? [{ img: a.research.photo.img, caption: main.name, credit: 'Wikipedia', page: a.research.photo.url }] : []);
  const stopsTotal = a.stops.reduce((t, s) => t + s.cost, 0), fuel = p.fuel ?? Math.max(0, p.cost - stopsTotal);
  return `<div class="screen">
    <div class="topbar"><a class="icon-btn" href="#/ideas" aria-label="Back to ideas">${I.back}</a><h1 style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Plan ${+i + 1}</h1><span class="pill line">${TYPES[a.type].e} ${TYPES[a.type].label}</span></div>

    <div class="carousel-wrap">
      ${slides.length ? `<div class="carousel" id="car" tabindex="0" aria-label="Photos of ${esc(main.name)}">${slides.map((s, k) => `
        <figure class="slide"><img src="${esc(s.img)}" alt="${esc(s.caption || main.name)}" ${k ? 'loading="lazy"' : ''}>
          <figcaption><span>${esc(s.caption || '')}</span>${s.credit ? `<small>${s.page ? `<a href="${esc(s.page)}" target="_blank" rel="noopener">${esc(s.credit)}</a>` : esc(s.credit)}</small>` : ''}</figcaption></figure>`).join('')}</div>
        ${slides.length > 1 ? `<button class="car-btn prev" data-act="car" data-d="-1" aria-label="Previous photo">‹</button><button class="car-btn next" data-act="car" data-d="1" aria-label="Next photo">›</button><span class="car-count" id="car-count">1 / ${slides.length}</span>` : ''}`
        : `<div class="hero flat">${sceneSVG(a.type)}</div>`}
    </div>
    ${!p.gallery ? '<span class="loading"><span class="spin"></span>Loading more photos…</span>' : slides.length > 1 ? '<p class="note" style="margin-top:-10px">Swipe for more photos.</p>' : ''}

    <div class="stack" style="gap:8px">
      <h1>${esc(a.title)}</h1>
      <div class="row wrap">${p.reasons.map(r => `<span class="pill line">${esc(r)}</span>`).join('')}</div>
    </div>

    <section class="card">
      <h2>About ${esc(main.name)}</h2>
      <p>${esc(main.desc || `${TYPES[a.type].label} destination about ${fmtDur(p.drive)} from ${a.origin.label}.`)}</p>
      ${main.url ? `<a class="small" href="${esc(main.url)}" target="_blank" rel="noopener">Read more on Wikipedia ↗</a>` : ''}
    </section>

    <section class="card">
      <div class="card-head"><h2>Stop by stop</h2><span class="muted small">${fmtTime(toMin(a.start))} – ${fmtTime(p.home)}</span></div>
      <div class="stop-detail"><div class="sd-head"><span class="sd-time">${fmtTime(toMin(a.start))}</span><div class="sd-name"><b>🚗 Leave ${esc(a.origin.label)}</b><span class="small muted">${fmtDur(p.drive)} drive · ${dist(p.km)}</span></div><span class="sd-price">${money(fuel / 2)}</span></div><p class="small muted">💵 Fuel each way, estimated at 27 mpg and $3.60 a gallon</p></div>
      ${a.stops.map((s, j) => stopDetail(p, s, j)).join('')}
      <div class="stop-detail"><div class="sd-head"><span class="sd-time">${fmtTime(p.home)}</span><div class="sd-name"><b>🏠 Back home</b><span class="small muted">${fmtDur(p.drive)} drive</span></div><span class="sd-price">${money(fuel / 2)}</span></div></div>
    </section>

    <section class="card">
      <h2>Cost breakdown</h2>
      <div class="costs">
        ${a.stops.map(s => `<div><span>${esc(s.name)}</span><b>${s.cost ? money(s.cost) : 'Free'}</b></div>`).join('')}
        <div><span>Fuel, round trip (${dist(p.km * 2)})</span><b>${money(fuel)}</b></div>
        <div class="total"><span>Estimated total</span><b>${money(p.cost)}</b></div>
        ${a.budget ? `<div class="${p.overBudget ? 'over' : 'under'}"><span>Your budget</span><b>${money(a.budget)} · ${p.overBudget ? money(p.cost - a.budget) + ' over' : money(a.budget - p.cost) + ' left'}</b></div>` : ''}
      </div>
      <p class="note">Prices are estimates for ${a.people + (a.familyMode ? state.family.kids.length : 0)} people. Check official sites for exact admission and menus.</p>
    </section>

    <div class="sticky-cta">${p.saved ? `<a class="btn dark" href="#/a/${a.id}">Saved · Open plan</a>` : `<button class="btn primary" data-act="idea-save" data-i="${i}">Save this plan</button>`}</div>
  </div>`;
}

function setupIdeaDetail(i) {
  restoreIdeas();
  const p = ui.ideas?.plans?.[+i];
  if (!p) return;
  loadIdeaExtras(p);
  const car = $('#car'), count = $('#car-count');
  if (car && count) car.addEventListener('scroll', () => { count.textContent = `${Math.round(car.scrollLeft / car.clientWidth) + 1} / ${car.children.length}`; }, { passive: true });
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act="car"]');
  if (!b) return;
  const car = $('#car');
  car?.scrollBy({ left: +b.dataset.d * car.clientWidth, behavior: 'smooth' });
});

function renderIdeasResults() {
  const box = $('#idea-results');
  if (box) box.innerHTML = ideasResultsHTML();
}

function ideasResultsHTML() {
  const run = ui.ideas, inp = ideaPrefs();
  if (!run) return '';
  if (run.status === 'running') {
    const order = ['places', 'drive', 'weather', 'food', 'photos'], at = order.indexOf(run.step);
    return `<section class="card"><h2>Building your plans…</h2><div class="list">${order.map((s, i) => `<div class="li" style="grid-template-columns:28px 1fr">${i < at ? '<span class="pill good">✓</span>' : i === at ? '<span class="spin"></span>' : '<span class="muted">·</span>'}<span class="${i > at ? 'muted' : ''}">${STEP_LABELS[s](inp)}</span></div>`).join('')}</div></section>`;
  }
  if (run.status === 'error') return `<div class="alert warn"><span class="ic">⚠️</span><span>${esc(run.msg)}</span></div>`;
  return `<div class="section-title"><h2>3 plans for ${fmtDate(inp.date, { weekday: 'long' })}</h2></div>
    ${run.note ? `<div class="alert info"><span class="ic">ℹ️</span><span>${esc(run.note)}</span></div>` : ''}
    ${run.plans.map(ideaCard).join('')}
    <button class="btn block" data-act="idea-shuffle">🎲 Show me 3 different plans</button>
    <p class="note">Places come from OpenStreetMap and Wikipedia. Drive times don’t include traffic. Saving a plan runs the full research: hours, tickets, alerts and gear.</p>`;
}

function ideasScreen() {
  restoreIdeas();
  const p = ideaPrefs(), kids = state.family.kids, likes = state.profile.likes || [];
  const di = Math.max(0, DRIVE_STEPS.indexOf(p.maxDrive));
  return `<div class="screen">
    <div class="topbar"><a class="icon-btn" href="#/" aria-label="Back">${I.back}</a><h1>Trip ideas</h1></div>
    <p class="muted" style="margin-top:-8px">Tell Planerr how far you'll drive and what you're into. It finds real places, checks the drive, weather and food, and builds 3 plans.</p>

    <section class="card">
      <div class="field"><span>Starting from</span>
        ${p.origin ? pickedHTML(p.origin, 'idea-origin-clear') : `${pickerHTML('idea-origin', 'Home address or town', '')}<button class="btn sm ghost" data-act="locate" data-target="idea" style="justify-self:start">◎ Use my location</button>`}
      </div>
      <div class="field">
        <span>Longest drive each way</span>
        <div class="drive-val"><b id="drive-out">${fmtDur(p.maxDrive)}</b></div>
        <input type="range" id="i-drive" min="0" max="${DRIVE_STEPS.length - 1}" step="1" value="${di}" data-if="maxDrive" aria-label="Longest drive each way">
        <div class="row small muted"><span>15m</span><span class="spacer"></span><span>4h</span></div>
      </div>
    </section>

    <section class="card">
      <label class="field"><span>Date</span><input type="date" id="i-date" data-if="date" value="${esc(p.date)}" min="${todayStr()}"></label>
      <div class="grid2">
        <label class="field"><span>Leave at</span><input type="time" id="i-start" data-if="start" value="${esc(p.start)}"></label>
        <label class="field"><span>Back by</span><input type="time" id="i-end" data-if="end" value="${esc(p.end)}"></label>
      </div>
    </section>

    <section class="card">
      <h2>What are you into?</h2>
      <div class="type-grid">${Object.entries(TYPES).map(([k, t]) => `<button class="type-opt ${p.types.includes(k) ? 'on' : ''}" data-act="idea-type" data-type="${k}" aria-pressed="${p.types.includes(k)}"><span class="e">${t.e}</span>${t.label}</button>`).join('')}</div>
    </section>

    <section class="card">
      <h2>Food you like</h2>
      <div class="chips">${LIKE_CUISINES.map(c => `<button class="chip ${likes.includes(c) ? 'on' : ''}" data-act="idea-like" data-c="${c}" aria-pressed="${likes.includes(c)}">${cuisineInfo(c)[1]} ${cuisineInfo(c)[0]}</button>`).join('')}</div>
      ${state.profile.diet.length ? `<p class="small muted">Also using your dietary needs: ${state.profile.diet.map(d => DIETS[d]).join(', ')}.</p>` : ''}
      <p class="note">Saved to your taste profile, along with your 👍 and 👎 on restaurants.</p>
    </section>

    <section class="card">
      <div class="grid2">
        <label class="field"><span>Adults</span><input type="number" id="i-people" min="1" data-if="people" value="${p.people}"></label>
        <label class="field"><span>Budget $</span><input type="number" id="i-budget" min="0" step="10" data-if="budget" value="${p.budget}"></label>
      </div>
      ${kids.length ? `<label class="check" style="border:0"><input type="checkbox" id="i-family" data-if="familyMode" ${p.familyMode ? 'checked' : ''}><span>Bring the kids<small>${kids.map(k => esc(k.name || 'Kid') + ' (' + k.age + ')').join(', ')}</small></span></label>` : ''}
    </section>

    <button class="btn primary block" data-act="idea-go" style="min-height:56px;font-size:1.08rem" ${ui.ideas?.status === 'running' ? 'disabled' : ''}>✨ Generate 3 plans</button>
    <div id="idea-results" class="stack" style="gap:16px">${ideasResultsHTML()}</div>
  </div>`;
}

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act^="idea-"]');
  if (!el) return;
  const p = ideaPrefs(), y = window.scrollY, rerender = () => { render(); window.scrollTo(0, y); };
  switch (el.dataset.act) {
    case 'idea-origin-clear': p.origin = null; save(); rerender(); return;
    case 'idea-type': { const t = el.dataset.type; p.types = p.types.includes(t) ? p.types.filter(x => x !== t) : [...p.types, t]; save(); rerender(); return; }
    case 'idea-like': {
      const c = el.dataset.c, likes = state.profile.likes = state.profile.likes || [];
      state.profile.likes = likes.includes(c) ? likes.filter(x => x !== c) : [...likes, c];
      save(); rerender(); return;
    }
    case 'idea-go': case 'idea-shuffle':
      $$('[data-act="idea-go"]').forEach(b => { b.disabled = true; });
      await generateIdeas(el.dataset.act === 'idea-shuffle');
      $$('[data-act="idea-go"]').forEach(b => { b.disabled = false; });
      return;
    case 'idea-save': {
      restoreIdeas();
      const plan = ui.ideas.plans[+el.dataset.i], adv = plan.adv;
      if (!state.adventures.some(a => a.id === adv.id)) { const copy = JSON.parse(JSON.stringify(adv)); refreshPacking(copy); state.adventures.push(copy); }
      plan.saved = true; save();
      go('a/' + adv.id); toast('Plan saved. Researching hours, tickets and gear…');
      return;
    }
  }
});

document.addEventListener('input', e => {
  const el = e.target, k = el.dataset.if;
  if (!k) return;
  const p = ideaPrefs();
  if (k === 'maxDrive') { p.maxDrive = DRIVE_STEPS[+el.value]; $('#drive-out').textContent = fmtDur(p.maxDrive); }
  else if (k === 'familyMode') p.familyMode = el.checked;
  else if (k === 'people' || k === 'budget') p[k] = num(el.value, k === 'people' ? 1 : 0);
  else p[k] = el.value;
  save();
});
