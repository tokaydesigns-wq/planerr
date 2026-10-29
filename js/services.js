'use strict';
// Live data. Every source is free and needs no API key:
//   Photon (place search)  · OSRM (drive times)  · Open-Meteo (weather)
//   Nominatim (hours, websites, food, trails) · OpenStreetMap Overpass (backup, family spots)
//   Wikipedia (photos & descriptions)
//   Supabase (community feed, optional; see config.js)

async function getJSON(url, opts) {
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// The public OpenStreetMap servers get busy, so each one gets a time limit before trying the next.
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
async function overpass(query, perServerMs = 20000) {
  let last;
  for (const url of OVERPASS) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), perServerMs);
    try {
      const d = await getJSON(url, { method: 'POST', body: 'data=' + encodeURIComponent(query), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctl.signal });
      if (d.remark && /runtime error|timed out/i.test(d.remark) && !d.elements?.length) throw new Error(d.remark);
      return d.elements || [];
    } catch (e) { last = e; } finally { clearTimeout(timer); }
  }
  throw last;
}
const elPoint = e => ({ lat: e.lat ?? e.center?.lat, lon: e.lon ?? e.center?.lon });

// Nominatim allows one request a second, so calls wait their turn in a queue.
let nominatimTurn = Promise.resolve();
function nominatim(params, path = 'search') {
  const run = nominatimTurn.then(() => getJSON(`https://nominatim.openstreetmap.org/${path}?format=jsonv2&` + new URLSearchParams(params)));
  nominatimTurn = run.catch(() => {}).then(() => new Promise(r => setTimeout(r, 1100)));
  return run;
}

const foodItem = (id, name, amenity, pt, t) => ({
  id, name, amenity, ...pt,
  cuisine: (t.cuisine || '').toLowerCase().split(/[;,]/).map(s => s.trim()).filter(Boolean),
  hours: t.opening_hours || null, website: t.website || t['contact:website'] || null,
  diet: Object.fromEntries(Object.keys(DIETS).map(d => [d, t['diet:' + d] || null])),
  takeaway: t.takeaway || null, outdoor: t.outdoor_seating || null,
});

// Restaurants and cafés within about 2.5 km of each point, from Nominatim's category search.
async function nominatimFood(points) {
  const seen = new Set(), out = [];
  for (const p of points.slice(0, 5)) {
    const dLat = .0225, dLon = .0225 / Math.cos(p.lat * Math.PI / 180);
    const box = [p.lon - dLon, p.lat + dLat, p.lon + dLon, p.lat - dLat].map(n => n.toFixed(5)).join(',');
    for (const q of ['restaurant', 'cafe']) {
      let rows = [];
      try { rows = await nominatim({ q, viewbox: box, bounded: 1, limit: 30, extratags: 1 }); } catch (e) { continue; }
      for (const r of rows) {
        const id = (r.osm_type || 'n')[0].toUpperCase() + r.osm_id;
        if (!r.name || seen.has(id) || !/^(restaurant|cafe|fast_food|ice_cream|pub)$/.test(r.type)) continue;
        seen.add(id);
        out.push(foodItem(id, r.name, r.type, { lat: +r.lat, lon: +r.lon }, r.extratags || {}));
      }
    }
  }
  return out;
}

const API = {
  async searchPlaces(q, near) {
    const bias = near ? `&lat=${near.lat}&lon=${near.lon}` : '';
    const d = await getJSON(`https://photon.komoot.io/api/?limit=6&lang=en&q=${encodeURIComponent(q)}${bias}`);
    return d.features.map(f => {
      const p = f.properties, [lon, lat] = f.geometry.coordinates;
      const label = p.name || [p.housenumber, p.street].filter(Boolean).join(' ') || p.city || q;
      const sub = [p.name && p.street ? p.street : null, p.city || p.county, p.state, p.countrycode].filter(Boolean).join(', ');
      return { label, sub, lat, lon, osm: p.osm_type && p.osm_id ? p.osm_type + p.osm_id : null, kind: p.osm_value || '' };
    });
  },

  async reverse(lat, lon) {
    const d = await getJSON(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}&lang=en`);
    const p = d.features?.[0]?.properties || {};
    return { label: 'My location', sub: [p.city || p.county, p.state].filter(Boolean).join(', '), lat, lon, osm: null };
  },

  async route(points) {
    if (points.length < 2) return null;
    const c = points.map(p => `${p.lon.toFixed(5)},${p.lat.toFixed(5)}`).join(';');
    const d = await getJSON(`https://router.project-osrm.org/route/v1/driving/${c}?overview=simplified&geometries=geojson`);
    const r = d.routes?.[0];
    if (!r) return null;
    return { legs: r.legs.map(l => ({ min: Math.round(l.duration / 60), km: l.distance / 1000 })), line: r.geometry.coordinates };
  },

  async weather(p, date, units) {
    const u = units === 'imperial' ? '&temperature_unit=fahrenheit&wind_speed_unit=mph' : '';
    return getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&timezone=auto&start_date=${date}&end_date=${date}`
      + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset,uv_index_max'
      + '&hourly=temperature_2m,precipitation_probability,weather_code' + u);
  },

  // Tags (hours, website, fee, wikipedia…) for places picked from search, looked up by their OSM id.
  // Nominatim first (one quick request); the busy Overpass servers are the backup.
  async details(osmIds) {
    if (!osmIds.length) return {};
    try {
      const rows = await nominatim({ osm_ids: osmIds.slice(0, 50).join(','), extratags: 1 }, 'lookup');
      if (rows.length) return Object.fromEntries(rows.map(r => [(r.osm_type || 'n')[0].toUpperCase() + r.osm_id, { name: r.name, ...(r.extratags || {}) }]));
    } catch (e) {}
    const by = { N: [], W: [], R: [] };
    osmIds.forEach(id => by[id[0]]?.push(id.slice(1)));
    const parts = [['node', by.N], ['way', by.W], ['relation', by.R]].filter(([, ids]) => ids.length).map(([t, ids]) => `${t}(id:${ids.join(',')});`).join('');
    const els = await overpass(`[out:json][timeout:20];(${parts});out tags center;`, 8000);
    return Object.fromEntries(els.map(e => [e.type[0].toUpperCase() + e.id, e.tags || {}]));
  },

  // Nominatim first: it answers in about a second. The Overpass servers are often too busy,
  // so they're only a backup when Nominatim finds nothing.
  async food(points, perServerMs = 8000) {
    let list = [];
    try { list = await nominatimFood(points); } catch (e) {}
    if (list.length) return list;
    const parts = points.map(p => `nwr(around:2500,${p.lat.toFixed(5)},${p.lon.toFixed(5)})["amenity"~"^(restaurant|cafe|fast_food|ice_cream|pub)$"]["name"];`).join('');
    const els = await overpass(`[out:json][timeout:25];(${parts});out tags center 120;`, perServerMs);
    return els.map(e => foodItem(e.type[0].toUpperCase() + e.id, e.tags.name, e.tags.amenity, elPoint(e), e.tags)).filter(f => f.lat != null);
  },

  async familySpots(p) {
    const q = `[out:json][timeout:25];(
      nwr(around:12000,${p.lat},${p.lon})["tourism"~"^(zoo|aquarium|theme_park|museum)$"]["name"];
      nwr(around:12000,${p.lat},${p.lon})["leisure"~"^(water_park|miniature_golf)$"]["name"];
      nwr(around:4000,${p.lat},${p.lon})["leisure"="playground"];
    );out tags center 80;`;
    const els = await overpass(q);
    return els.map(e => {
      const t = e.tags, kind = t.tourism && FAMILY_OSM[t.tourism] ? t.tourism : t.leisure;
      return { id: e.type[0].toUpperCase() + e.id, kind, name: t.name || 'Playground', ...elPoint(e), museumKind: t.museum || null, website: t.website || null };
    }).filter(x => x.lat != null && FAMILY_OSM[x.kind]);
  },

  // Real driving minutes from one origin to many places in a single request.
  async driveTable(origin, pts) {
    const c = [origin, ...pts].map(p => `${p.lon.toFixed(5)},${p.lat.toFixed(5)}`).join(';');
    const d = await getJSON(`https://router.project-osrm.org/table/v1/driving/${c}?sources=0&annotations=duration,distance`);
    return pts.map((_, i) => {
      const s = d.durations?.[0]?.[i + 1];
      return s == null ? null : { min: Math.round(s / 60), km: (d.distances?.[0]?.[i + 1] ?? 0) / 1000 };
    });
  },

  // One forecast call for many places (Open-Meteo accepts comma-separated coordinates).
  async weatherMany(pts, date, units) {
    const u = units === 'imperial' ? '&temperature_unit=fahrenheit' : '';
    const d = await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${pts.map(p => p.lat.toFixed(3)).join(',')}&longitude=${pts.map(p => p.lon.toFixed(3)).join(',')}`
      + `&timezone=auto&start_date=${date}&end_date=${date}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max${u}`);
    return (Array.isArray(d) ? d : [d]).map(x => x.daily ? { code: x.daily.weather_code[0], hi: x.daily.temperature_2m_max[0], lo: x.daily.temperature_2m_min[0], rain: x.daily.precipitation_probability_max[0] ?? 0 } : null);
  },

  async wikiNearby(p) {
    const d = await getJSON(`https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=geosearch&ggscoord=${p.lat}|${p.lon}`
      + '&ggsradius=10000&ggslimit=20&prop=pageimages|extracts|coordinates&piprop=thumbnail&pithumbsize=900&exintro=1&explaintext=1&exsentences=2&exlimit=20');
    return Object.values(d.query?.pages || {}).filter(pg => pg.thumbnail && pg.coordinates).map(pg => ({
      title: pg.title, img: pg.thumbnail.source, text: pg.extract || '', url: `https://en.wikipedia.org/?curid=${pg.pageid}`,
      lat: pg.coordinates[0].lat, lon: pg.coordinates[0].lon,
    }));
  },

  async wikiPage(ref, sentences = 3, needImage = true) {
    const [lang, title] = ref.includes(':') ? [ref.slice(0, ref.indexOf(':')), ref.slice(ref.indexOf(':') + 1)] : ['en', ref];
    const d = await getJSON(`https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&titles=${encodeURIComponent(title)}`
      + `&prop=pageimages|extracts&piprop=thumbnail&pithumbsize=1200&exintro=1&explaintext=1&exsentences=${sentences}`);
    const pg = Object.values(d.query?.pages || {})[0];
    if (!pg || pg.missing !== undefined || (needImage && !pg.thumbnail)) return null;
    return { title: pg.title, img: pg.thumbnail?.source || null, text: pg.extract || '', url: `https://${lang}.wikipedia.org/?curid=${pg.pageid}` };
  },

  // The photos used in a Wikipedia article, skipping maps, logos, icons and diagrams.
  async wikiImages(ref, limit = 14) {
    const [lang, title] = ref.includes(':') ? [ref.slice(0, ref.indexOf(':')), ref.slice(ref.indexOf(':') + 1)] : ['en', ref];
    const d = await getJSON(`https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&titles=${encodeURIComponent(title)}`
      + '&generator=images&gimlimit=50&prop=imageinfo&iiprop=url|mime|size|extmetadata&iiurlwidth=1000&iiextmetadatafilter=ImageDescription|Artist|LicenseShortName');
    const strip = s => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().replace(/^(.+?)\s*\1$/, '$1');
    return Object.values(d.query?.pages || {})
      .map(p => ({ name: p.title, info: p.imageinfo?.[0] }))
      .filter(({ name, info }) => info && /jpeg|png/.test(info.mime) && info.width >= 500 && info.height >= 300
        && !/logo|map|icon|flag|seal|locator|diagram|symbol|coat of arms|signature|sign\b|chart|graph|plan\b|location|relief|pictogram|banner|commons-|wikipedia|wiktionary|question/i.test(name))
      .slice(0, limit)
      .map(({ name, info }) => {
        const m = info.extmetadata || {};
        return { img: info.thumburl, caption: strip(m.ImageDescription?.value).slice(0, 140), credit: [strip(m.Artist?.value).slice(0, 60), m.LicenseShortName?.value].filter(Boolean).join(' · '), page: info.descriptionurl };
      });
  },
};

// Pick the best hero photo for a place: its own Wikipedia article, else a nearby article whose title matches.
function pickPhoto(stop, tags, nearby) {
  const words = (stop?.name || '').toLowerCase().split(/\W+/).filter(w => w.length > 3);
  const score = n => words.filter(w => n.title.toLowerCase().includes(w)).length;
  const withDist = nearby.map(n => ({ ...n, d: stop?.place ? haversine(stop.place, n) : 0 }));
  const named = withDist.filter(n => score(n) > 0).sort((a, b) => score(b) - score(a) || a.d - b.d)[0];
  return named || withDist.sort((a, b) => a.d - b.d)[0] || null;
}

// Points along the route to look for food: a third and two-thirds of the way, plus the main stop.
function foodPoints(adv) {
  const pts = [], line = adv.research?.route?.line, main = mainStop(adv)?.place;
  if (line?.length > 4) {
    const half = adv.origin ? Math.floor(line.length / 2) : line.length;
    [Math.floor(half / 3), Math.floor(half * 2 / 3)].forEach(i => { const [lon, lat] = line[i]; pts.push({ lat, lon, label: 'On the way' }); });
  }
  if (main) pts.push({ ...main, label: `Near ${main.label}` });
  return pts.filter((p, i) => pts.findIndex(q => haversine(p, q) < 3) === i);
}

async function updateRoute(adv) {
  const key = routeKey(adv);
  if (adv.research?.route?.key === key) return;
  adv.research = adv.research || {};
  const pts = routePoints(adv);
  if (pts.length < 2) { adv.research.route = null; return; }
  const r = await API.route(pts);
  adv.research.route = r ? { ...r, key, at: Date.now() } : null;
}

// The research pass: run every lookup, keep whatever succeeds, note what failed.
async function research(adv, onStep = () => {}) {
  const R = adv.research = adv.research || {};
  R.errors = {};
  const main = mainStop(adv);
  const anchor = main?.place || located(adv).at(-1)?.place || adv.origin;
  const step = async (name, fn) => {
    onStep(name, 'start');
    try { await fn(); R.checked = { ...(R.checked || {}), [name]: Date.now() }; onStep(name, 'ok'); }
    catch (e) { R.errors[name] = String(e.message || e); onStep(name, 'fail'); }
  };

  await Promise.all([
    step('route', () => updateRoute(adv)),
    step('weather', async () => {
      if (!anchor) return;
      const days = daysUntil(adv.date);
      if (days < 0 || days > 15) { R.weather = { note: days < 0 ? 'past' : 'far', place: anchor.label }; return; }
      R.weather = { ...(await API.weather(anchor, adv.date, state.profile.units)), place: anchor.label, units: state.profile.units };
    }),
    step('photos', async () => {
      if (!anchor) return;
      R.nearby = await API.wikiNearby(anchor);
    }),
  ]);

  // Stops added from ideas, Wikipedia or the community have coordinates but no OpenStreetMap id yet.
  // Match each to the nearest same-named map entry so its hours and website can be checked.
  await Promise.all(adv.stops.filter(s => s.place && !s.place.osm && s.name).map(async s => {
    try {
      const hit = (await API.searchPlaces(s.name, s.place)).find(r => r.osm && haversine(r, s.place) < 3);
      if (hit) s.place.osm = hit.osm;
    } catch (e) {}
  }));

  // Nominatim allows one request a second, so these run one after another.
  await step('hours', async () => {
    const ids = [...new Set(adv.stops.map(s => s.place?.osm).filter(Boolean))];
    R.details = ids.length ? await API.details(ids) : {};
  });
  const ref = main?.place?.osm && R.details?.[main.place.osm]?.wikipedia;
  if (ref) { try { R.photo = await API.wikiPage(ref); } catch (e) {} }
  if (!ref || !R.photo) R.photo = main ? pickPhoto(main, null, R.nearby || []) : (R.nearby || [])[0] || null;

  await step('food', async () => {
    const pts = foodPoints(adv);
    if (!pts.length) { R.food = []; return; }
    const list = await API.food(pts);
    list.forEach(f => {
      const near = pts.map((p, i) => ({ i, d: haversine(p, f) })).sort((a, b) => a.d - b.d)[0];
      f.near = pts[near.i].label; f.km = near.d;
    });
    R.food = list;
  });
  if (isHikeAdv(adv)) await step('trails', async () => { const s = hikeStop(adv); R.trails = s?.place ? await API.trails(s.place) : []; });
  if (adv.familyMode && anchor) await step('family', async () => { R.family = await API.familySpots(anchor); });
  R.at = Date.now();
  refreshPacking(adv);
}

// ---------- community feed (Supabase REST) ----------
const Community = {
  get ready() { const c = window.PLANERR_CONFIG || {}; return !!(c.supabaseUrl && c.supabaseAnonKey); },
  headers() {
    const k = window.PLANERR_CONFIG.supabaseAnonKey;
    return { apikey: k, Authorization: `Bearer ${k}`, 'Content-Type': 'application/json' };
  },
  async list() {
    if (!this.ready) return [];
    const base = window.PLANERR_CONFIG.supabaseUrl.replace(/\/$/, '');
    return getJSON(`${base}/rest/v1/adventures?select=*&order=created_at.desc&limit=100`, { headers: this.headers() });
  },
  async share(row) {
    const base = window.PLANERR_CONFIG.supabaseUrl.replace(/\/$/, '');
    const r = await fetch(`${base}/rest/v1/adventures`, { method: 'POST', headers: { ...this.headers(), Prefer: 'return=representation' }, body: JSON.stringify(row) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json())[0];
  },
};

// Built-in examples so Explore isn't empty before anyone shares. Marked as examples in the UI.
const EXAMPLE_COMMUNITY = [
  { id: 'ex1', example: true, author: 'Planerr', title: 'Yosemite Valley in a day', type: 'hike', region: 'Yosemite National Park, CA', rating: 5, budget: 220,
    review: 'Long drive but worth it. Get through the gate before 8 AM. The Mist Trail to Vernal Fall is steep and wet, so wear shoes with grip.',
    stops: [{ name: 'Tunnel View', kind: 'sight', tip: 'Best light in the morning.' }, { name: 'Mist Trail to Vernal Fall', kind: 'hike', tip: 'Bring a rain shell for the spray.' }, { name: 'Yosemite Valley Lodge food court', kind: 'food', tip: 'Quick and close to the trailhead shuttle.' }], family_ages: [] },
  { id: 'ex2', example: true, author: 'Planerr', title: 'Monterey Bay family day', type: 'beach', region: 'Monterey, CA', rating: 5, budget: 260,
    review: 'The aquarium was a hit with both kids. We did the touch pools first before the crowds.',
    stops: [{ name: 'Monterey Bay Aquarium', kind: 'fun', tip: 'Buy timed tickets online. Weekends sell out.' }, { name: "Fisherman's Wharf", kind: 'food', tip: 'Clam chowder samples everywhere.' }, { name: 'Dennis the Menace Park', kind: 'sight', tip: 'A huge playground, perfect after lunch.' }], family_ages: [4, 9] },
  { id: 'ex3', example: true, author: 'Planerr', title: 'Hudson Valley art & apples', type: 'museum', region: 'Beacon, NY', rating: 4, budget: 140,
    review: 'Dia Beacon is enormous, so give it two hours. We picked apples on the way home in late September.',
    stops: [{ name: 'Dia Beacon', kind: 'sight', tip: 'Free for kids. Closed Tuesdays and Wednesdays.' }, { name: 'Main Street Beacon', kind: 'food', tip: 'Lots of cafés and bakeries.' }, { name: 'Fishkill Farms', kind: 'shop', tip: 'Pick-your-own apples in the fall.' }], family_ages: [] },
  { id: 'ex4', example: true, author: 'Planerr', title: 'Austin swim & tacos', type: 'lake', region: 'Austin, TX', rating: 4, budget: 90,
    review: "Barton Springs is 68° all year, so it's refreshing in August. Reserve a swim slot on hot weekends.",
    stops: [{ name: 'Barton Springs Pool', kind: 'water', tip: 'Go early on weekends.' }, { name: 'South Congress Avenue', kind: 'shop', tip: 'Fun shops and murals.' }, { name: 'Taco trucks on East 6th', kind: 'food', tip: 'Cash helps at some trucks.' }], family_ages: [] },
];
