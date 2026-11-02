'use strict';
// Recommended trails for hikes. Photon finds named paths near the hike, Nominatim returns their
// map shapes (to measure length), and Open-Meteo gives elevations along them (to size the climb).
// OpenStreetMap stores a trail as many short pieces, so pieces are grouped by trail name and
// lengths count the pieces within about 4 miles of the stop; a trail that runs off that area gets one wider lookup.

const TRAIL_TAGS = ['highway:path', 'highway:footway', 'highway:track', 'highway:bridleway'].map(t => 'osm_tag=' + t).join('&');
const isHikeAdv = adv => TYPES[adv.type]?.cat === 'hike' || adv.stops.some(s => s.cat === 'hike');
const hikeStop = adv => adv.stops.find(s => s.cat === 'hike' && s.place) || (TYPES[adv.type]?.cat === 'hike' ? mainStop(adv) : null);

async function photonTrails(q, p, bbox) {
  const d = await getJSON(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=50&lang=en&lat=${p.lat}&lon=${p.lon}&bbox=${bbox}&${TRAIL_TAGS}`);
  return d.features.filter(f => f.properties.name && f.properties.osm_type === 'W').map(f => ({ name: f.properties.name.trim(), id: 'W' + f.properties.osm_id, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] }));
}

// Pieces joined to the one nearest the stop (ends within 60 m), so a same-named trail
// elsewhere in the area doesn't inflate the length or climb.
function connectedPart(lines, seed) {
  const pt = c => ({ lat: c[1], lon: c[0] });
  const touches = (a, b) => [a[0], a.at(-1)].some(e => b.some(c => haversine(pt(e), pt(c)) < .06)) || [b[0], b.at(-1)].some(e => a.some(c => haversine(pt(e), pt(c)) < .06));
  const left = [...lines], part = [left.splice(left.findIndex(l => l.includes(seed)), 1)[0]];
  for (let grew = true; grew;) {
    grew = false;
    for (let i = left.length - 1; i >= 0; i--) if (part.some(l => touches(l, left[i]))) { part.push(left.splice(i, 1)[0]); grew = true; }
  }
  return part;
}

// A loop is a closed ring. Pieces with a loose end (an end meeting no other piece's end within
// 30 m) are trimmed away, again and again, which removes short spurs to a trailhead as well as
// trails cut off by the search area. It's a loop when a ring is left that makes up most of the
// trail; better to miss one than to promise a loop that isn't. Scraps under 10 m are ignored, and
// a piece only meets itself if it's a ring on its own, or short pieces would glue loose ends shut.
function isLoop(part) {
  const pt = c => ({ lat: c[1], lon: c[0] }), ends = l => [l[0], l.at(-1)];
  const touch = (a, b) => haversine(pt(a), pt(b)) < .03;
  let ring = part.filter(l => lineKm(l) >= .01);
  const meets = (e, l) => ring.some(o => o === l ? lineKm(l) >= .1 && touch(l[0], l.at(-1)) : ends(o).some(c => touch(e, c)));
  for (let trimmed = true; trimmed && ring.length;) {
    const keep = ring.filter(l => ends(l).every(e => meets(e, l)));
    trimmed = keep.length < ring.length;
    ring = keep;
  }
  const km = ls => ls.reduce((a, l) => a + lineKm(l), 0);
  return ring.length > 0 && km(ring) >= km(part) * .5;
}

// Out and back: one plain path with exactly two loose ends and no junction, and nowhere near the
// edge of the search area, so a trail that was just cut off by the edge isn't mislabeled.
function isOutAndBack(part, box) {
  const pt = c => ({ lat: c[1], lon: c[0] }), ends = part.filter(l => lineKm(l) >= .01).flatMap(l => [l[0], l.at(-1)]);
  if (part.flat().some(c => c[0] < box.w || c[0] > box.e || c[1] < box.s || c[1] > box.n)) return false;
  const meets = ends.map((e, i) => ends.filter((o, j) => j !== i && haversine(pt(e), pt(o)) < .03).length);
  return meets.every(m => m <= 1) && meets.filter(m => m === 0).length === 2;
}

const lineKm = pts => pts.slice(1).reduce((a, q, i) => a + haversine({ lat: pts[i][1], lon: pts[i][0] }, { lat: q[1], lon: q[0] }), 0);

function trailDifficulty(km, climb, sac) {
  if (/alpine|demanding/.test(sac || '')) return 'Hard';
  const effort = km + climb / 60;
  return effort < 5 ? 'Easy' : effort < 10 ? 'Moderate' : 'Hard';
}

// Walking time for the length found, using Naismith's rule: 4.5 km/h plus an hour per 600 m of climb.
const trailMinutes = t => Math.round((t.km / 4.5 + t.climb / 600) * 60 / 15) * 15 || 15;

// Every piece of a named trail inside a search area (Nominatim, dedupe=0 so same-named pieces all come back).
const trailRows = (g, a) => nominatim({ q: g.name, viewbox: [a.w, a.n, a.e, a.s].map(n => n.toFixed(5)).join(','), bounded: 1, limit: 50, dedupe: 0, polygon_geojson: 1, polygon_threshold: .00005, extratags: 1 }).catch(() => [])
  .then(rows => rows.filter(r => r.category === 'highway' && (r.name || '').toLowerCase() === g.name.toLowerCase()));

// The pieces of a trail that join up to the one nearest the stop, plus that nearest point.
function trailPart(g, p) {
  const lines = [];
  g.rows.forEach(r => {
    const gj = r.geojson;
    (gj?.type === 'LineString' ? [gj.coordinates] : gj?.type === 'MultiLineString' ? gj.coordinates : []).forEach(l => lines.push(l));
  });
  if (!lines.length) return null;
  const near = lines.flat().reduce((b, c) => { const dd = haversine(p, { lat: c[1], lon: c[0] }); return dd < b.d ? { d: dd, c } : b; }, { d: Infinity, c: null });
  return { part: connectedPart(lines, near.c), near };
}

// The search area shrunk by 150 m: a trail reaching it was probably cut off by the area's edge.
const innerBox = (a, lat) => { const m = .0014; return { w: a.w + m / Math.cos(lat * Math.PI / 180), e: a.e - m / Math.cos(lat * Math.PI / 180), s: a.s + m, n: a.n - m }; };
const reachesEdge = (part, box) => part.flat().some(c => c[0] < box.w || c[0] > box.e || c[1] < box.s || c[1] > box.n);

API.trails = async function (p) {
  const d = .055, dl = d / Math.cos(p.lat * Math.PI / 180);
  const bbox = [p.lon - dl, p.lat - d, p.lon + dl, p.lat + d].map(n => n.toFixed(5)).join(',');
  const hits = (await Promise.all(['trail', 'loop', 'path'].map(q => photonTrails(q, p, bbox).catch(() => [])))).flat();
  const groups = new Map();
  hits.forEach(h => {
    if (/^(sidewalk|crosswalk|path)$/i.test(h.name)) return;
    const k = h.name.toLowerCase();
    if (!groups.has(k)) groups.set(k, { name: h.name, ids: new Set(), near: Infinity });
    const g = groups.get(k);
    g.ids.add(h.id); g.near = Math.min(g.near, haversine(p, h));
  });
  if (!groups.size) return [];

  // Photon merges same-named pieces, so it only finds the names. Nominatim with dedupe=0 then
  // returns every piece of each trail with its shape (one request a second, so the top 6 only).
  const top = [...groups.values()].sort((a, b) => a.near - b.near).slice(0, 6);
  const area = k => { const dd = d * k, ll = dl * k; return { w: p.lon - ll, e: p.lon + ll, s: p.lat - dd, n: p.lat + dd }; };
  for (const g of top) { g.area = area(1); g.rows = await trailRows(g, g.area); }

  // A trail that runs off the edge gets one wider lookup (about 3x the area, so up to ~12 miles out),
  // for the first 3 only to stay inside Nominatim's one-a-second limit. If it fails, keep the first result.
  for (const g of top.filter(g => { const t = trailPart(g, p); return t && reachesEdge(t.part, innerBox(g.area, p.lat)); }).slice(0, 3)) {
    const wide = area(3), rows = await trailRows(g, wide);
    if (rows.length) { g.rows = rows; g.area = wide; }
  }

  const trails = top.map(g => {
    const found = trailPart(g, p);
    if (!found) return null;
    const { part, near } = found, tags = {}, box = innerBox(g.area, p.lat), pts = part.flat(), loop = isLoop(part);
    g.rows.forEach(r => Object.assign(tags, r.extratags || {}));
    const step = Math.max(1, Math.floor(pts.length / 12));
    return {
      name: g.name, km: part.reduce((a, l) => a + lineKm(l), 0), climb: 0,
      start: { lat: near.c[1], lon: near.c[0] }, away: near.d, loop, outBack: !loop && isOutAndBack(part, box),
      samples: pts.filter((_, i) => i % step === 0).slice(0, 12),
      surface: tags.surface || null, dog: tags.dog || null, sac: tags.sac_scale || null,
      wheelchair: tags.wheelchair || null, id: [...g.ids][0],
    };
  }).filter(t => t && t.km >= .3);

  // One elevation call for all trails; the spread between the lowest and highest point is the climb.
  const all = trails.flatMap(t => t.samples);
  if (all.length) {
    try {
      const e = await getJSON(`https://api.open-meteo.com/v1/elevation?latitude=${all.map(c => c[1].toFixed(5)).join(',')}&longitude=${all.map(c => c[0].toFixed(5)).join(',')}`);
      let i = 0;
      trails.forEach(t => { const el = e.elevation.slice(i, i += t.samples.length).filter(Number.isFinite); t.climb = el.length ? Math.max(...el) - Math.min(...el) : 0; });
    } catch (err) {}
  }
  trails.forEach(t => { delete t.samples; t.diff = trailDifficulty(t.km, t.climb, t.sac); t.mins = trailMinutes(t); });
  // Favor trails that start close to the stop and are long enough to be a real hike.
  const rank = t => t.away * 1.5 - Math.min(t.km, 12) * .6;
  return trails.sort((a, b) => rank(a) - rank(b)).slice(0, 5);
};

const climbText = m => imperial() ? `${Math.round(m * 3.281 / 10) * 10} ft` : `${Math.round(m / 5) * 5} m`;
const diffClass = d => d === 'Easy' ? 'good' : d === 'Moderate' ? 'warn' : 'bad';

function trailRow(t, opts = {}) {
  const tags = [
    t.wheelchair === 'yes' || t.surface === 'paved' || t.surface === 'asphalt' ? '♿ Paved / stroller-friendly' : t.surface ? `Surface: ${t.surface.replace(/_/g, ' ')}` : null,
    t.dog === 'no' ? '🐕 No dogs' : t.dog === 'yes' || t.dog === 'leashed' ? '🐕 Dogs OK' : null,
  ].filter(Boolean);
  const picked = opts.picked === t.name;
  return `<div class="trail ${picked ? 'picked' : ''}">
    <div class="trail-head">
      <div class="trail-ic">🥾</div>
      <div class="main"><b>${esc(t.name)}</b><span class="small muted">${t.away < .3 ? 'Starts right here' : `Starts ${dist(t.away)} from ${esc(opts.from || 'the stop')}`}</span></div>
      <div class="row" style="gap:6px">${t.loop ? '<span class="pill line">🔁 Loop</span>' : t.outBack ? '<span class="pill line">↔ Out &amp; back</span>' : ''}<span class="pill ${diffClass(t.diff)}">${t.diff}</span></div>
    </div>
    <div class="trail-stats">
      <div><span class="k">Length</span><b>${dist(t.km)}</b></div>
      <div><span class="k">Climb</span><b>${climbText(t.climb)}</b></div>
      <div><span class="k">Walk time</span><b>${fmtDur(t.mins)}</b></div>
    </div>
    ${tags.length ? `<div class="row wrap" style="gap:6px">${tags.map(x => `<span class="pill line">${x}</span>`).join('')}</div>` : ''}
    <div class="row wrap" style="gap:6px">
      ${opts.pick ? `<button class="pill ${picked ? 'good' : 'coral'} trail-pick" data-act="trail-pick" data-name="${esc(t.name)}">${picked ? '✓ In your plan' : '＋ Use this trail'}</button>` : ''}
      <a class="pill line" href="${mapsDir(t.start)}" target="_blank" rel="noopener">Directions to start ↗</a>
      ${reviewsLink(t.name, t.start)}
      <a class="pill line" href="https://www.openstreetmap.org/${t.id[0] === 'W' ? 'way' : 'node'}/${t.id.slice(1)}" target="_blank" rel="noopener">Trail map ↗</a>
    </div>
  </div>`;
}

const trailNote = '<p class="note">Lengths cover the part of each trail within about 4 miles of the stop. Walk time is for that length at an easy pace; going out and back doubles it, but a loop doesn’t. Climb is the gap between the lowest and highest points. Check trail conditions before you go.</p>';

function trailsCard(adv) {
  if (!isHikeAdv(adv)) return '';
  const R = adv.research || {}, s = hikeStop(adv);
  if (!s?.place) return '';
  if (!R.trails) return `<section class="card" id="trails"><h2>Recommended trails</h2><p class="muted">${ui.busy[adv.id] ? stepBadge(adv.id, 'trails', 'Finding trails…') : R.errors?.trails ? 'Couldn’t load trails right now. Try Refresh research below.' : 'Trails show up after research.'}</p></section>`;
  if (!R.trails.length) return `<section class="card" id="trails"><h2>Recommended trails</h2><p class="muted">No named trails are mapped near ${esc(s.name)}. Check the park's website for trail maps.</p></section>`;
  const kids = adv.familyMode && state.family.kids.length;
  const list = kids ? [...R.trails].sort((a, b) => ['Easy', 'Moderate', 'Hard'].indexOf(a.diff) - ['Easy', 'Moderate', 'Hard'].indexOf(b.diff)) : R.trails;
  return `<section class="card" id="trails">
    <div class="card-head"><h2>Recommended trails</h2><span class="muted small">${R.trails.length} nearby</span></div>
    ${kids ? '<p class="small muted">Easiest first, since the kids are coming.</p>' : ''}
    <div class="stack">${list.map(t => trailRow(t, { pick: true, picked: s.trail?.name, from: s.name })).join('')}</div>
    ${trailNote}
  </section>`;
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act="trail-pick"]');
  if (!el) return;
  const adv = advById(parseRoute().id), s = adv && hikeStop(adv), t = adv?.research?.trails?.find(x => x.name === el.dataset.name);
  if (!s || !t) return;
  if (s.trail?.name === t.name) { delete s.trail; toast('Trail removed from your plan'); }
  else {
    s.trail = { name: t.name, km: t.km, climb: t.climb, diff: t.diff, mins: t.mins, start: t.start };
    s.dur = Math.min(420, Math.max(60, t.mins));
    refreshPacking(adv);
    toast(`${t.name} added. Hike time set to ${fmtDur(s.dur)}.`);
  }
  save();
  const y = window.scrollY; render(); window.scrollTo(0, y);
});
