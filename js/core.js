'use strict';
// Shared constants, helpers, saved state and the planning rules (schedule, alerts, gear, budget).

const STORE = 'planerr.app.v1';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const num = (v, d = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? Math.max(0, n) : d; };
const toMin = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const fmtTime = m => {
  m = ((Math.round(m) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60), mm = String(m % 60).padStart(2, '0');
  return `${(h % 12) || 12}:${mm} ${h < 12 ? 'AM' : 'PM'}`;
};
const fmtDur = m => { m = Math.max(0, Math.round(m)); const h = Math.floor(m / 60), r = m % 60; return h ? (r ? `${h}h ${r}m` : `${h}h`) : `${r}m`; };
const localISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayStr = () => localISO(new Date());
const daysUntil = date => Math.round((new Date(date + 'T12:00') - new Date(todayStr() + 'T12:00')) / 864e5);
const fmtDate = (d, opts = { weekday: 'short', month: 'short', day: 'numeric' }) => d ? new Date(d + 'T12:00').toLocaleDateString(undefined, opts) : 'No date';
const money = n => '$' + Math.round(n).toLocaleString();
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const haversine = (a, b) => {
  const R = 6371, rad = x => x * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const imperial = () => state.profile.units === 'imperial';
const dist = km => {
  const v = imperial() ? km * 0.621 : km, unit = imperial() ? 'mi' : 'km';
  return `${v < 10 ? Math.round(v * 10) / 10 : Math.round(v)} ${unit}`;
};
const stars = n => `<span class="stars" aria-label="${n} out of 5 stars">${'★'.repeat(n)}<span class="off">${'★'.repeat(5 - n)}</span></span>`;
const mapsDir = p => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`;
const mapsSearch = q => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

// ---------- adventure types ----------
const TYPES = {
  hike:      { label: 'Hike',            e: '🥾', grad: ['#0E6B4F', '#9BD37A'], scene: 'mountains', cat: 'hike' },
  beach:     { label: 'Beach',           e: '🏖️', grad: ['#0FA3B1', '#FFD166'], scene: 'waves',     cat: 'water' },
  lake:      { label: 'Lake & river',    e: '🛶', grad: ['#1769AA', '#7EE0E6'], scene: 'lake',      cat: 'water' },
  park:      { label: 'Park & nature',   e: '🌳', grad: ['#23864F', '#D7EE7E'], scene: 'hills',     cat: 'sight' },
  city:      { label: 'City',            e: '🏙️', grad: ['#FF5A36', '#FFC046'], scene: 'city',      cat: 'sight' },
  themepark: { label: 'Theme park',      e: '🎢', grad: ['#E2336B', '#FFC21A'], scene: 'coaster',   cat: 'fun' },
  museum:    { label: 'Museum & culture',e: '🏛️', grad: ['#3F4CC2', '#FF9F7A'], scene: 'city',      cat: 'sight' },
  food:      { label: 'Food trip',       e: '🍜', grad: ['#D9480F', '#FFD43B'], scene: 'hills',     cat: 'food' },
  roadtrip:  { label: 'Road trip',       e: '🚗', grad: ['#C2410C', '#FDE68A'], scene: 'road',      cat: 'sight' },
  snow:      { label: 'Snow day',        e: '🎿', grad: ['#2F6FD0', '#DDF3FF'], scene: 'snow',      cat: 'fun' },
};

const CATS = {
  sight: { label: 'Sightseeing', e: '📸' },
  hike:  { label: 'Hike',        e: '🥾' },
  water: { label: 'Water',       e: '🌊' },
  fun:   { label: 'Attraction',  e: '🎟️' },
  food:  { label: 'Food',        e: '🍽️' },
  shop:  { label: 'Shopping',    e: '🛍️' },
  rest:  { label: 'Break',       e: '☕' },
};
const OUTDOOR = new Set(['hike', 'water', 'sight']);

const CUISINES = {
  pizza: ['Pizza', '🍕'], burger: ['Burgers', '🍔'], mexican: ['Mexican', '🌮'], italian: ['Italian', '🍝'],
  chinese: ['Chinese', '🥡'], japanese: ['Japanese', '🍣'], sushi: ['Sushi', '🍣'], thai: ['Thai', '🍜'], indian: ['Indian', '🍛'],
  vietnamese: ['Vietnamese', '🍜'], korean: ['Korean', '🍲'], seafood: ['Seafood', '🦐'], american: ['American', '🍽️'],
  bbq: ['BBQ', '🍖'], barbecue: ['BBQ', '🍖'], sandwich: ['Sandwiches', '🥪'], mediterranean: ['Mediterranean', '🥙'], greek: ['Greek', '🥙'],
  breakfast: ['Breakfast', '🥞'], brunch: ['Brunch', '🥞'], bakery: ['Bakery', '🥐'], chicken: ['Chicken', '🍗'], vegetarian: ['Vegetarian', '🥗'],
  vegan: ['Vegan', '🥗'], coffee_shop: ['Coffee', '☕'], ice_cream: ['Ice cream', '🍦'], donut: ['Donuts', '🍩'], french: ['French', '🥖'],
  steak_house: ['Steakhouse', '🥩'], ramen: ['Ramen', '🍜'], tacos: ['Tacos', '🌮'], noodle: ['Noodles', '🍜'], kebab: ['Kebab', '🥙'],
  middle_eastern: ['Middle Eastern', '🧆'], spanish: ['Spanish', '🥘'], tea: ['Tea', '🍵'], juice: ['Juice', '🧃'], dessert: ['Dessert', '🍰'],
};
const AMENITY_FOOD = { restaurant: ['Restaurant', '🍽️'], cafe: ['Café', '☕'], fast_food: ['Quick bite', '🍟'], ice_cream: ['Ice cream', '🍦'], pub: ['Pub', '🍺'], bar: ['Bar', '🍸'] };
const cuisineInfo = key => CUISINES[key] || [key.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()), '🍽️'];
const DIETS = { vegetarian: 'Vegetarian', vegan: 'Vegan', gluten_free: 'Gluten-free', halal: 'Halal', kosher: 'Kosher' };

// ---------- family ----------
const AGE_BANDS = [
  { id: 'toddler', min: 0, max: 3, label: 'Toddlers (0–3)', color: '#FFD9CC',
    picks: ['Playgrounds & splash pads', 'Petting zoos and farms', 'Aquariums', 'Short, stroller-friendly nature paths', 'Picnic lawns'],
    tips: ['Plan around nap time and keep drives under an hour each way', 'Check for changing stations and stroller access', 'Pack spare clothes, wipes and familiar snacks'],
    osm: ['playground', 'zoo', 'aquarium', 'park'] },
  { id: 'little', min: 4, max: 7, label: 'Little kids (4–7)', color: '#FFE9A8',
    picks: ['Zoos', "Children's museums", 'Beaches with calm water', 'Easy trails under 3 miles', 'Mini golf'],
    tips: ['Break the day into short activities with snack stops', 'Look for junior ranger or scavenger-hunt programs', 'Kids under 3 often get in free, so check child ticket ages'],
    osm: ['zoo', 'playground', 'museum', 'miniature_golf', 'water_park', 'aquarium'] },
  { id: 'kid', min: 8, max: 12, label: 'Big kids (8–12)', color: '#CDEFD9',
    picks: ['Science museums', 'Kayaking and paddleboarding', 'Hikes up to 5 miles', 'Theme parks', 'Caves and waterfalls'],
    tips: ['Let them pick one stop of the day', 'Check height requirements for rides before you go', 'Bring a camera or binoculars for them to use'],
    osm: ['theme_park', 'museum', 'water_park', 'zoo', 'miniature_golf'] },
  { id: 'teen', min: 13, max: 17, label: 'Teens (13–17)', color: '#D6E4FF',
    picks: ['Adventure parks, ziplines and climbing', 'Longer hikes with a summit or view', 'City exploring and food halls', 'Water sports', 'Concerts and events'],
    tips: ['Involve them in planning and give them a budget for one stop', 'Plan photo-worthy spots', 'Keep a phone charger handy'],
    osm: ['theme_park', 'water_park', 'museum', 'attraction'] },
];
const bandFor = age => AGE_BANDS.find(b => age >= b.min && age <= b.max) || AGE_BANDS[AGE_BANDS.length - 1];
const FAMILY_OSM = {
  playground: ['Playground', '🛝'], zoo: ['Zoo', '🦒'], aquarium: ['Aquarium', '🐠'], theme_park: ['Theme park', '🎢'],
  museum: ['Museum', '🏛️'], water_park: ['Water park', '💦'], miniature_golf: ['Mini golf', '⛳'], park: ['Park', '🌳'], attraction: ['Attraction', '⭐'],
};

// ---------- saved state ----------
function defaultUnits() { return /^en-(US|LR)|^my/.test(navigator.language || '') ? 'imperial' : 'metric'; }

function nextSaturday() {
  const d = new Date(); d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  return localISO(d);
}
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return localISO(d); }

function newAdventure(over = {}) {
  return {
    id: uid(), title: '', type: 'hike', date: nextSaturday(), start: '08:00', end: '18:00',
    budget: 100, people: 2, origin: null, stops: [], familyMode: false, notes: '',
    status: 'planned', rating: 0, review: '', tips: '', packing: [], research: {}, createdAt: Date.now(), ...over,
  };
}
function newStop(over = {}) { return { id: uid(), name: '', cat: 'sight', dur: 60, cost: 0, place: null, done: false, liked: null, tip: '', ...over }; }

function seedState() {
  const sf = { label: 'San Francisco', sub: 'California, US', lat: 37.7793, lon: -122.4193 };
  const upcoming = newAdventure({
    example: true, title: 'Muir Woods & Sausalito', type: 'hike', start: '08:00', end: '17:30', budget: 160, people: 2, origin: sf,
    stops: [
      newStop({ name: 'Golden Gate Bridge Vista Point', cat: 'sight', dur: 25, place: { label: 'Golden Gate Bridge Vista Point', sub: 'Sausalito, CA', lat: 37.8324, lon: -122.4795 } }),
      newStop({ name: 'Muir Woods National Monument', cat: 'hike', dur: 150, cost: 30, main: true, place: { label: 'Muir Woods National Monument', sub: 'Mill Valley, CA', lat: 37.8970, lon: -122.5811 } }),
      newStop({ name: 'Sausalito waterfront', cat: 'sight', dur: 90, place: { label: 'Sausalito', sub: 'California, US', lat: 37.8591, lon: -122.4853 } }),
    ],
    notes: 'Muir Woods needs a parking or shuttle reservation in advance.',
  });
  const past = newAdventure({
    example: true, title: 'Santa Cruz Beach Day', type: 'beach', date: daysAgo(18), start: '09:00', end: '19:00', budget: 120, people: 2,
    status: 'done', rating: 4, origin: sf,
    stops: [
      newStop({ name: 'Natural Bridges State Beach', cat: 'water', dur: 120, cost: 10, done: true, place: { label: 'Natural Bridges State Beach', sub: 'Santa Cruz, CA', lat: 36.9503, lon: -122.0573 } }),
      newStop({ name: 'Santa Cruz Beach Boardwalk', cat: 'fun', dur: 150, cost: 60, done: true, place: { label: 'Santa Cruz Beach Boardwalk', sub: 'Santa Cruz, CA', lat: 36.9643, lon: -122.0177 } }),
    ],
    review: 'Tide pools at low tide were the highlight. The boardwalk gets busy after 2 PM.',
    tips: 'Check the tide chart and go to Natural Bridges at low tide.',
  });
  return { profile: { name: '', units: defaultUnits(), diet: [], taste: {}, likes: [] }, family: { kids: [] }, adventures: [upcoming, past], seen: {} };
}

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE));
    if (s && Array.isArray(s.adventures)) {
      s.profile = { name: '', units: defaultUnits(), diet: [], taste: {}, likes: [], ...s.profile };
      s.family = s.family || { kids: [] };
      s.seen = s.seen || {};
      return s;
    }
  } catch (e) {}
  return seedState();
}
let state = loadState();
function save() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) {} }
const advById = id => state.adventures.find(a => a.id === id);

// ---------- planning rules ----------
const located = adv => adv.stops.filter(s => s.place);
const mainStop = adv => adv.stops.find(s => s.main) || adv.stops.find(s => s.place && s.cat === TYPES[adv.type]?.cat) || located(adv).at(-1) || null;
const routePoints = adv => {
  const pts = located(adv).map(s => s.place);
  return adv.origin ? [adv.origin, ...pts, adv.origin] : pts;
};
const routeKey = adv => routePoints(adv).map(p => `${p.lat.toFixed(4)},${p.lon.toFixed(4)}`).join(';');

// Times for every stop: leave at start, drive each leg, stay at each stop, drive home.
function schedule(adv) {
  const route = adv.research?.route;
  const legs = route && route.key === routeKey(adv) ? route.legs : [];
  let cur = toMin(adv.start), li = 0, seen = false;
  const rows = adv.stops.map(s => {
    let drive = 0, km = 0;
    if (s.place && (adv.origin || seen)) { const leg = legs[li++]; drive = leg?.min || 0; km = leg?.km || 0; }
    if (s.place) seen = true;
    cur += drive;
    const arrive = cur; cur += s.dur;
    return { arrive, depart: cur, drive, km };
  });
  const back = adv.origin && legs[li] ? legs[li] : null;
  const home = cur + (back?.min || 0);
  const driveMin = rows.reduce((a, r) => a + r.drive, 0) + (back?.min || 0);
  const km = rows.reduce((a, r) => a + r.km, 0) + (back?.km || 0);
  return { rows, back, home, driveMin, km, routed: legs.length > 0 };
}

// Opening hours (OpenStreetMap format). Handles the common forms: "Mo-Fr 09:00-17:00; Sa 10:00-14:00; Su off",
// "24/7", month prefixes ("Apr-Oct ...") and sunrise-sunset. Anything else reports "unknown" with the raw text.
const OH_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const OH_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function inList(spec, value, names) {
  return spec.split(',').some(part => {
    const [a, b] = part.trim().split('-').map(x => names.indexOf(x.trim()));
    if (a < 0) return false;
    if (b === undefined || b < 0) return a === value;
    return a <= b ? value >= a && value <= b : value >= a || value <= b;
  });
}
function hoursOn(oh, date) {
  if (!oh) return { status: 'unknown' };
  const raw = oh.trim();
  if (/^24\/7$/.test(raw)) return { status: 'open', ranges: [[0, 1440]], text: 'Open 24 hours' };
  const d = new Date(date + 'T12:00'), day = d.getDay(), month = d.getMonth();
  const rules = raw.split(/\s*;\s*|(?<=\d|off|closed)\s*,\s*(?=(?:Mo|Tu|We|Th|Fr|Sa|Su|PH)\b)/);
  let result = null, understood = false;
  const monthRe = /^((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?:\s*-\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec))?(?:\s*,\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?:\s*-\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec))?)*)\s*:?\s+(.*)$/;
  const dayRe = /^((?:Mo|Tu|We|Th|Fr|Sa|Su|PH)(?:\s*-\s*(?:Mo|Tu|We|Th|Fr|Sa|Su))?(?:\s*,\s*(?:Mo|Tu|We|Th|Fr|Sa|Su|PH)(?:\s*-\s*(?:Mo|Tu|We|Th|Fr|Sa|Su))?)*)\s*(.*)$/;
  for (let rule of rules) {
    rule = rule.trim();
    if (!rule) continue;
    const mm = rule.match(monthRe);
    if (mm) { if (!inList(mm[1].replace(/\s/g, ''), month, OH_MONTHS)) { understood = true; continue; } rule = mm[2]; }
    let rest = rule, applies = true;
    const dm = rule.match(dayRe);
    if (dm) {
      const days = dm[1].replace(/\s/g, '').split(',').filter(x => x !== 'PH').join(',');
      if (!days) { understood = true; continue; }
      applies = inList(days, day, OH_DAYS); rest = dm[2].trim();
    }
    if (/^(off|closed)$/i.test(rest)) { understood = true; if (applies) result = { status: 'closed', text: 'Closed' }; continue; }
    if (/sunrise|sunset|dawn|dusk/i.test(rest)) { understood = true; if (applies) result = { status: 'open', ranges: null, text: 'Sunrise to sunset' }; continue; }
    const times = rest.split(',').map(t => t.trim().replace(/\+$/, '').match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/));
    if (!rest || times.some(t => !t)) return { status: 'unknown', text: raw };
    understood = true;
    if (applies) {
      const ranges = times.map(t => { const a = +t[1] * 60 + +t[2]; let b = +t[3] * 60 + +t[4]; if (b <= a) b += 1440; return [a, b]; });
      result = { status: 'open', ranges, text: ranges.map(([a, b]) => `${fmtTime(a)}–${fmtTime(b)}`).join(', ') };
    }
  }
  if (!understood) return { status: 'unknown', text: raw };
  return result || { status: 'closed', text: 'Closed that day' };
}
// Is the place open for the planned visit? 'open' | 'closed' (that day) | 'outside' (open that day, not then) | 'unknown'
function visitStatus(h, arrive, depart) {
  if (h.status !== 'open' || !h.ranges) return h.status;
  return h.ranges.some(([a, b]) => arrive >= a && arrive < b) ? (h.ranges.some(([a, b]) => depart <= b && arrive >= a) ? 'open' : 'closes') : 'outside';
}

// ---------- weather helpers ----------
const WMO = {
  0: ['☀️', 'Clear'], 1: ['🌤️', 'Mostly clear'], 2: ['⛅', 'Partly cloudy'], 3: ['☁️', 'Overcast'], 45: ['🌫️', 'Fog'], 48: ['🌫️', 'Freezing fog'],
  51: ['🌦️', 'Light drizzle'], 53: ['🌦️', 'Drizzle'], 55: ['🌧️', 'Heavy drizzle'], 56: ['🌧️', 'Freezing drizzle'], 57: ['🌧️', 'Freezing drizzle'],
  61: ['🌦️', 'Light rain'], 63: ['🌧️', 'Rain'], 65: ['🌧️', 'Heavy rain'], 66: ['🌧️', 'Freezing rain'], 67: ['🌧️', 'Freezing rain'],
  71: ['🌨️', 'Light snow'], 73: ['🌨️', 'Snow'], 75: ['❄️', 'Heavy snow'], 77: ['🌨️', 'Snow grains'], 80: ['🌦️', 'Showers'], 81: ['🌧️', 'Heavy showers'],
  82: ['⛈️', 'Violent showers'], 85: ['🌨️', 'Snow showers'], 86: ['❄️', 'Heavy snow showers'], 95: ['⛈️', 'Thunderstorms'], 96: ['⛈️', 'Thunderstorms & hail'], 99: ['⛈️', 'Thunderstorms & hail'],
};
const wmo = c => WMO[c] || ['🌡️', 'Unknown'];
const wxDay = adv => adv.research?.weather?.daily ? adv.research.weather : null;
function wxAt(adv, min) {
  const h = wxDay(adv)?.hourly;
  if (!h || min < 0 || min >= 1440) return null;
  const i = Math.floor(min / 60);
  return { temp: h.temperature_2m[i], rain: h.precipitation_probability[i] ?? 0, code: h.weather_code[i] };
}
const sunsetMin = adv => { const w = wxDay(adv); return w ? toMin(w.daily.sunset[0].slice(11, 16)) : null; };
const tempHot = () => imperial() ? 85 : 29;
const tempCold = () => imperial() ? 45 : 7;

// ---------- tickets ----------
const TICKET_TOURISM = new Set(['theme_park', 'zoo', 'aquarium', 'museum', 'gallery']);
function ticketInfo(adv, stop) {
  const tags = adv.research?.details?.[stop.place?.osm] || {};
  const needs = stop.cat === 'fun' || tags.fee === 'yes' || TICKET_TOURISM.has(tags.tourism) || tags.leisure === 'water_park'
    || (stop === mainStop(adv) && ['themepark', 'museum', 'snow'].includes(adv.type));
  if (!needs) return null;
  const site = tags.website || tags['contact:website'] || tags.url || null;
  const kind = tags.tourism === 'theme_park' || adv.type === 'themepark' ? 'themepark'
    : tags.tourism === 'museum' || tags.tourism === 'gallery' || adv.type === 'museum' ? 'museum'
    : tags.tourism === 'zoo' || tags.tourism === 'aquarium' ? 'zoo' : adv.type === 'snow' ? 'snow' : 'general';
  const kids = adv.familyMode ? state.family.kids : [];
  const people = `${adv.people} adult${adv.people === 1 ? '' : 's'}${kids.length ? ` and ${kids.length} kid${kids.length > 1 ? 's' : ''} (ages ${kids.map(k => k.age).join(', ')})` : ''}`;
  const steps = [
    site ? `Open the official site (link below). Make sure the address bar matches the venue's own domain, not a reseller.`
         : `Search for “${stop.name} official tickets” and open the venue's own site. Skip ads and reseller sites, which often charge more.`,
    `Pick <b>${fmtDate(adv.date, { weekday: 'long', month: 'long', day: 'numeric' })}</b>. If there are timed entries, choose one near <b>${fmtTime(schedule(adv).rows[adv.stops.indexOf(stop)]?.arrive ?? toMin(adv.start))}</b>, your planned arrival.`,
    `Choose tickets for ${people}.${kids.length ? ' Check the child age cutoffs. Toddlers are often free and kids under 12 often pay less.' : ''}`,
  ];
  if (kind === 'themepark') steps.push('Compare a one-day ticket with any skip-the-line or express add-on, and check height limits for the rides your group wants.');
  if (kind === 'museum') steps.push('Look for free or discounted days, special exhibits that need a separate ticket, and reciprocal memberships you may already have.');
  if (kind === 'zoo') steps.push('Check for combo tickets with nearby attractions and look for feeding or show times to plan around.');
  if (kind === 'snow') steps.push('Lift tickets are usually cheaper online in advance. Add rentals or lessons in the same order if you need them.');
  steps.push('Add parking or shuttle passes if the site offers them. Popular places sell out of parking first.');
  steps.push('Pay, then save the confirmation email and screenshot the QR codes so they work without signal.');
  return { site, steps, search: `https://www.google.com/search?q=${encodeURIComponent(stop.name + ' official tickets')}`, fee: tags.fee, charge: tags.charge };
}

// ---------- gear & packing ----------
function hikeKit(adv) {
  const hikes = adv.stops.filter(s => s.cat === 'hike');
  if (!hikes.length) return null;
  const sch = schedule(adv), w = wxDay(adv), d = w?.daily;
  const hikeMin = hikes.reduce((a, s) => a + s.dur, 0);
  const kids = adv.familyMode ? state.family.kids : [];
  const people = adv.people + kids.length;
  const liters = Math.max(1, Math.ceil((hikeMin / 60) * 0.5 * 2) / 2);
  const water = imperial() ? `${Math.round(liters * 33.8)} oz` : `${liters} L`;
  const kit = [
    { item: `Water: about ${water} per person (${people} people)`, why: `Allow about half a liter (17 oz) per hour of hiking. You have ${fmtDur(hikeMin)} on the trail.` },
    { item: 'Salty snacks and lunch', why: 'Trail mix, jerky, fruit. Pack a bit more than you think.' },
    { item: 'Hiking shoes with good grip', why: 'Break them in first. Leave brand-new boots at home.' },
    { item: 'Layers (avoid cotton)', why: 'A moisture-wicking base and a light fleece.' },
    { item: 'Offline trail map', why: 'Download the area in Google Maps or AllTrails. Trailheads often have no signal.' },
    { item: 'First aid kit', why: 'Blister pads, bandages, pain relief, any personal meds.' },
    { item: 'Whistle', why: 'Three blasts means you need help. It carries farther than a voice.' },
  ];
  const rain = d?.precipitation_probability_max?.[0] ?? 0;
  if (rain >= 30) kit.push({ item: 'Rain shell and pack cover', why: `${rain}% chance of rain that day.` });
  if ((d?.uv_index_max?.[0] ?? 5) >= 3) kit.push({ item: 'Sun hat, sunglasses, sunscreen', why: d ? `UV index up to ${Math.round(d.uv_index_max[0])}.` : 'Sun exposure adds up on exposed trails.' });
  if (d && d.temperature_2m_min[0] <= tempCold()) kit.push({ item: 'Warm hat and gloves', why: `Lows near ${Math.round(d.temperature_2m_min[0])}°.` });
  if (d && d.temperature_2m_max[0] >= tempHot()) kit.push({ item: 'Electrolyte tablets and a cooling towel', why: `Highs near ${Math.round(d.temperature_2m_max[0])}°. Hike early if you can.` });
  const ss = sunsetMin(adv);
  const lastHike = adv.stops.reduce((a, s, i) => s.cat === 'hike' ? sch.rows[i].depart : a, 0);
  if (ss == null || lastHike > ss - 90) kit.push({ item: 'Headlamp with fresh batteries', why: ss ? `Sunset is ${fmtTime(ss)}, close to when you finish.` : 'In case the hike runs late.' });
  if (hikeMin >= 180) kit.push({ item: 'Trekking poles', why: 'They save your knees on long descents.' });
  const m = new Date(adv.date + 'T12:00').getMonth();
  if (m >= 4 && m <= 8) kit.push({ item: 'Insect repellent', why: 'Bugs are out in summer.' });
  if (kids.some(k => k.age <= 3)) kit.push({ item: 'Child carrier', why: 'For toddlers when little legs get tired.' });
  if (kids.length) kit.push({ item: 'Kid-sized snacks and a small reward', why: 'Something to look forward to at the turnaround point.' });
  return { kit, hikeMin };
}

function gearList(adv) {
  const items = ['Phone & charger', 'Wallet & ID', 'Water bottle', 'Snacks'];
  const cats = new Set(adv.stops.map(s => s.cat));
  const add = (...x) => items.push(...x);
  if (cats.has('water')) add('Swimsuit', 'Towel', 'Sandals', 'Dry bag', 'Change of clothes');
  if (cats.has('fun')) add('Tickets / QR codes saved offline', 'Portable battery');
  if (cats.has('sight')) add('Camera', 'Comfortable shoes');
  if (adv.type === 'snow') add('Waterproof gloves', 'Thermal layers', 'Goggles', 'Extra socks');
  if (adv.origin) add('Car keys', 'Road-trip playlist');
  const d = wxDay(adv)?.daily;
  if ((d?.precipitation_probability_max?.[0] ?? 0) >= 50) add('Rain jacket', 'Umbrella');
  if (adv.familyMode && state.family.kids.length) {
    add('Wipes and hand sanitizer', 'Kids’ snacks', 'Spare kid clothes');
    if (state.family.kids.some(k => k.age <= 3)) add('Diapers and changing pad', 'Stroller or carrier');
  }
  const kit = hikeKit(adv);
  if (kit) kit.kit.slice(1).forEach(k => add(k.item.replace(/:.*$/, '')));
  return [...new Set(items)];
}
function refreshPacking(adv) {
  const have = new Set(adv.packing.map(p => p.text.toLowerCase()));
  gearList(adv).forEach(text => { if (!have.has(text.toLowerCase())) { have.add(text.toLowerCase()); adv.packing.push({ id: uid(), text, done: false }); } });
}

// ---------- budget ----------
function budget(adv) {
  const sch = schedule(adv);
  const people = adv.people + (adv.familyMode ? state.family.kids.length : 0);
  const stopsCost = adv.stops.reduce((a, s) => a + num(s.cost), 0);
  const fuel = sch.km ? (sch.km * 0.621 / 27) * 3.6 : 0;
  const start = toMin(adv.start), end = sch.home;
  const meals = [[12 * 60, 'lunch', 18], [18 * 60, 'dinner', 28]].filter(([t]) => start <= t && end >= t + 30);
  const foodPlanned = adv.stops.some(s => s.cat === 'food');
  const food = foodPlanned ? 0 : meals.reduce((a, m) => a + m[2] * people, 0);
  const total = stopsCost + fuel + food;
  return { stopsCost, fuel, food, meals: meals.map(m => m[1]), total, left: adv.budget - total, people };
}

// ---------- heads-up alerts ----------
function alertsFor(adv) {
  const out = [], sch = schedule(adv), ss = sunsetMin(adv), w = wxDay(adv);
  adv.stops.forEach((s, i) => {
    const tags = adv.research?.details?.[s.place?.osm];
    if (!tags?.opening_hours) return;
    const h = hoursOn(tags.opening_hours, adv.date), v = visitStatus(h, sch.rows[i].arrive, sch.rows[i].depart);
    if (v === 'closed') out.push({ lv: 'bad', ic: '⛔', t: `<b>${esc(s.name)}</b> is closed on ${fmtDate(adv.date, { weekday: 'long' })}.` });
    else if (v === 'outside') out.push({ lv: 'bad', ic: '🕒', t: `<b>${esc(s.name)}</b> isn't open when you arrive (${fmtTime(sch.rows[i].arrive)}). Hours that day: ${esc(h.text)}.` });
    else if (v === 'closes') out.push({ lv: 'warn', ic: '🕒', t: `<b>${esc(s.name)}</b> closes before you plan to leave. Hours: ${esc(h.text)}.` });
  });
  if (adv.end && sch.home > toMin(adv.end)) out.push({ lv: 'warn', ic: '⏰', t: `You'd be back at <b>${fmtTime(sch.home)}</b>, ${fmtDur(sch.home - toMin(adv.end))} after your ${fmtTime(toMin(adv.end))} goal. Shorten a stop or leave earlier.` });
  if (w) {
    adv.stops.forEach((s, i) => {
      const x = wxAt(adv, sch.rows[i].arrive);
      if (x && OUTDOOR.has(s.cat) && x.rain >= 50) out.push({ lv: 'warn', ic: '☔', t: `${x.rain}% chance of rain at <b>${esc(s.name)}</b>. Have an indoor backup.` });
    });
    const lastOutdoor = adv.stops.reduce((a, s, i) => OUTDOOR.has(s.cat) ? sch.rows[i].depart : a, 0);
    if (ss && lastOutdoor > ss) out.push({ lv: 'warn', ic: '🌙', t: `You'd still be outdoors after sunset (${fmtTime(ss)}). Bring a headlamp or move that stop earlier.` });
    if (w.daily.temperature_2m_max[0] >= tempHot()) out.push({ lv: 'warn', ic: '🥵', t: `Hot day, up to ${Math.round(w.daily.temperature_2m_max[0])}°. Bring extra water and plan shade breaks.` });
  }
  const b = budget(adv);
  if (adv.budget && b.left < 0) out.push({ lv: 'warn', ic: '💸', t: `Estimated spend is ${money(b.total)}, which is ${money(-b.left)} over your ${money(adv.budget)} budget.` });
  adv.stops.forEach(s => { const t = ticketInfo(adv, s); if (t) out.push({ lv: 'info', ic: '🎟️', t: `<b>${esc(s.name)}</b> may need tickets bought in advance. See Tickets below.` }); });
  return out;
}

// ---------- taste profile ----------
function bumpTaste(cuisines, by) {
  cuisines.forEach(c => { if (c) state.profile.taste[c] = Math.round(((state.profile.taste[c] || 0) + by) * 10) / 10; });
}
function tasteScore(f) {
  const t = state.profile.taste;
  const likes = state.profile.likes || [];
  let s = f.cuisine.reduce((a, c) => a + (t[c] || 0) + (likes.includes(c) ? 4 : 0), 0) + (t['amenity:' + f.amenity] || 0) * .5;
  state.profile.diet.forEach(d => { if (f.diet[d] === 'yes' || f.diet[d] === 'only' || f.cuisine.includes(d)) s += 3; });
  return s;
}
