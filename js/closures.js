'use strict';
// Is it actually open that day? Free map data catches some closures and misses others, so this
// layers several checks:
//   · OpenStreetMap tags on the place: seasonal=*, opening_hours month ranges, "temporarily closed" notes
//   · Tags on the last stretch of road in: seasonal=*, motor_vehicle:conditional=no @ (Nov 15-May 15)…
//   · Elevation and season: high mountain roads and trailheads are usually gated or snowed in Nov–May
//   · Snow on the ground in the forecast (Open-Meteo), when the trip is within 16 days
//   · Places you've reported closed yourself, which Planerr then stops suggesting

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
// Months (0-based) each OSM season covers, generously.
const SEASON_MONTHS = { spring: [2, 3, 4], summer: [4, 5, 6, 7, 8], autumn: [8, 9, 10], fall: [8, 9, 10], winter: [10, 11, 0, 1, 2] };
const CLOSED_WORDS = /temporar(il)?y closed|closed (for|until) (the )?(season|winter|spring|further notice)|season(al)?ly closed|permanently closed|closed permanently|\(closed\)|out of business/i;
const CAR_ROADS = /^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|track|road|living_street)(_link)?$/;

function dateInRange(date, m1, d1, m2, d2) {
  const d = new Date(date + 'T12:00'), v = d.getMonth() * 100 + d.getDate(), a = m1 * 100 + d1, b = m2 * 100 + d2;
  return a <= b ? v >= a && v <= b : v >= a || v <= b;
}

// "no @ (Nov 15-May 15)", "no @ Dec-Mar", "no @ (winter)" → is the closure in force on that date?
function conditionalClosed(value, date) {
  for (const part of String(value).split(';')) {
    const m = part.match(/^\s*(no|private)\s*@\s*\(?([^)]*)\)?/i);
    if (!m) continue;
    const cond = m[2].toLowerCase();
    const season = Object.keys(SEASON_MONTHS).find(s => cond.includes(s));
    if (season && SEASON_MONTHS[season].includes(new Date(date + 'T12:00').getMonth())) return `in ${season}`;
    const r = cond.match(/([a-z]{3})\s*(\d{1,2})?\s*-\s*([a-z]{3})\s*(\d{1,2})?/);
    if (r && MONTHS.includes(r[1]) && MONTHS.includes(r[3])) {
      const m1 = MONTHS.indexOf(r[1]), m2 = MONTHS.indexOf(r[3]);
      const cap = w => w[0].toUpperCase() + w.slice(1);
      if (dateInRange(date, m1, +(r[2] || 1), m2, +(r[4] || 31))) return `${cap(r[1])}${r[2] ? ' ' + r[2] : ''} – ${cap(r[3])}${r[4] ? ' ' + r[4] : ''}`;
    }
  }
  return null;
}

// Reads OSM tags for a place or road. Returns { status: 'closed' | 'maybe', why } or null.
function closedInfo(tags, date) {
  if (!tags) return null;
  const text = [tags.name, tags.note, tags.description, tags.fixme, tags['note:en']].filter(Boolean).join(' · ');
  if (CLOSED_WORDS.test(text)) return { status: 'closed', why: 'Listed as closed on the map' };
  if (Object.keys(tags).some(k => /^(disused|abandoned|was|demolished):/.test(k)) || /^(off|closed)$/i.test(tags.opening_hours || '')) return { status: 'closed', why: 'Listed as no longer open' };
  for (const k of ['access:conditional', 'motor_vehicle:conditional', 'vehicle:conditional', 'motorcar:conditional']) {
    const c = tags[k] && conditionalClosed(tags[k], date);
    if (c) return { status: 'closed', why: `Closed to cars ${c}` };
  }
  const s = (tags.seasonal || '').toLowerCase();
  if (s && s !== 'no') {
    const ms = s.split(/[;,]/).flatMap(x => SEASON_MONTHS[x.trim()] || []);
    if (ms.length && !ms.includes(new Date(date + 'T12:00').getMonth())) return { status: 'closed', why: `Only open in ${s.replace(/;/g, ' and ')}` };
    if (!ms.length) return { status: 'maybe', why: 'Open seasonally, so check it’s open that day' };
  }
  if (tags.opening_hours) {
    const h = hoursOn(tags.opening_hours, date);
    if (h.status === 'closed') return { status: 'closed', why: 'Closed that day' };
  }
  return null;
}

// High mountains: roads and trailheads are usually gated or buried in snow outside summer.
function seasonRisk(elev, date) {
  if (elev == null) return null;
  const m = new Date(date + 'T12:00').getMonth(), ft = Math.round(elev * 3.281 / 100) * 100;
  const where = imperial() ? `${ft.toLocaleString()} ft` : `${Math.round(elev / 10) * 10} m`;
  if (elev >= 2900 && (m >= 10 || m <= 4 || (m === 9 && new Date(date + 'T12:00').getDate() >= 15)))
    return { lv: 'high', why: `It's at about ${where}. Roads and trailheads this high are usually gated or snowed in from mid-October to June.` };
  if (elev >= 2300 && (m >= 10 || m <= 3))
    return { lv: 'snow', why: `It's at about ${where}, so expect snow and icy roads this time of year. Some access roads close in winter.` };
  return null;
}

// Checks the drive in to a destination: road tags near the end, elevation, and snow on the ground.
// roads=false skips sampling the road in (used for city-type days, where seasonal gates are rare).
API.access = async function (from, to, date, roads = true) {
  const out = { roads: [], elev: null, snowDepth: null, at: Date.now() };
  const [route, wx] = await Promise.all([
    from && roads ? getJSON(`https://router.project-osrm.org/route/v1/driving/${from.lon.toFixed(5)},${from.lat.toFixed(5)};${to.lon.toFixed(5)},${to.lat.toFixed(5)}?overview=full&geometries=geojson`).catch(() => null) : null,
    daysUntil(date) >= 0 && daysUntil(date) <= 15
      ? getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${to.lat}&longitude=${to.lon}&timezone=auto&start_date=${date}&end_date=${date}&hourly=snow_depth&daily=snowfall_sum`).catch(() => null)
      : getJSON(`https://api.open-meteo.com/v1/elevation?latitude=${to.lat}&longitude=${to.lon}`).then(e => ({ elevation: e.elevation?.[0] })).catch(() => null),
  ]);
  if (wx) {
    out.elev = wx.elevation ?? null;
    const depths = (wx.hourly?.snow_depth || []).filter(Number.isFinite);
    if (depths.length) out.snowDepth = Math.max(...depths);
    out.snowfall = wx.daily?.snowfall_sum?.[0] ?? null;
  }
  // Sample the last stretch of the drive (where seasonal gates usually are) and read each road's tags.
  const line = route?.routes?.[0]?.geometry?.coordinates;
  if (line?.length > 1) {
    const marks = [0.5, 6], picks = [];
    let acc = 0, k = 0;
    for (let i = line.length - 1; i > 0 && k < marks.length; i--) {
      acc += haversine({ lat: line[i][1], lon: line[i][0] }, { lat: line[i - 1][1], lon: line[i - 1][0] });
      if (acc >= marks[k]) { picks.push(line[i - 1]); k++; }
    }
    if (!picks.length) picks.push(line[0]);
    const seen = new Set();
    for (const c of picks) {
      const r = await nominatim({ lat: c[1], lon: c[0], zoom: 17, extratags: 1 }, 'reverse').catch(() => null);
      if (!r || r.category !== 'highway' || !CAR_ROADS.test(r.type)) continue;
      const name = r.name || r.address?.road || 'The road in';
      const info = closedInfo({ ...(r.extratags || {}) }, date);
      if (!info || seen.has(name + info.why)) continue;
      seen.add(name + info.why);
      out.roads.push({ name, ...info });
    }
  }
  return out;
};

// Alerts for one destination's access check, worded for the plan page.
function accessAlerts(acc, name, date, cat) {
  if (!acc) return [];
  const out = [];
  acc.roads.forEach(r => out.push(r.status === 'closed'
    ? { lv: 'bad', ic: '🚧', t: `<b>${esc(r.name)}</b> on the way to <b>${esc(name)}</b>: ${esc(r.why)}. You may not be able to drive there that day.` }
    : { lv: 'warn', ic: '🚧', t: `<b>${esc(r.name)}</b> on the way to <b>${esc(name)}</b>: ${esc(r.why)}.` }));
  const risk = seasonRisk(acc.elev, date);
  if (risk && cat !== 'fun') out.push({ lv: risk.lv === 'high' ? 'bad' : 'warn', ic: '🏔️', t: `<b>${esc(name)}</b>: ${risk.why} Check the road status before you go.` });
  if (acc.snowDepth >= .05) out.push({ lv: 'warn', ic: '❄️', t: `About ${imperial() ? Math.round(acc.snowDepth * 39.37) + ' in' : Math.round(acc.snowDepth * 100) + ' cm'} of snow on the ground is forecast at <b>${esc(name)}</b>. Trails may be icy and some roads may be closed.` });
  return out;
}
const accessBlocked = (acc, date) => !!acc && (acc.roads.some(r => r.status === 'closed') || seasonRisk(acc.elev, date)?.lv === 'high');

// ---------- places you've reported closed ----------
// Kept for 90 days, so a place closed for the season can come back on its own.
const closedKey = p => p.osm || p.id || `${(p.name || p.label || '').toLowerCase()}|${(+p.lat).toFixed(3)},${(+p.lon).toFixed(3)}`;
function reportedClosed(p) {
  const r = state.closed?.[closedKey(p)];
  return !!r && r.until > Date.now();
}
const closedBtn = (key, name) => `<button class="pill line closed-btn" data-act="report-closed" data-key="${esc(key)}" data-name="${esc(name)}">🚫 It's closed</button>`;

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act="report-closed"]');
  if (!el) return;
  state.closed = state.closed || {};
  Object.keys(state.closed).forEach(k => { if (state.closed[k].until < Date.now()) delete state.closed[k]; });
  state.closed[el.dataset.key] = { name: el.dataset.name, until: Date.now() + 90 * 864e5 };
  save();
  toast(`Got it. Planerr won't suggest ${el.dataset.name} for the next 3 months.`);
  const y = window.scrollY; render(); window.scrollTo(0, y);
});
