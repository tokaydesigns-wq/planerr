'use strict';
// Screens, routing and interaction. Each screen is a function that returns HTML for #app;
// clicks are handled in one delegated listener keyed by data-act.

const ui = { draft: null, results: {}, timers: {}, busy: {}, steps: {}, community: null, communityErr: null, exploreType: 'all', exploreQ: '', rating: 0, foodFilter: 'match' };
const svgIcon = d => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = { back: svgIcon('<path d="M15 5l-7 7 7 7"/>'), edit: svgIcon('<path d="M4 20h4L19 9l-4-4L4 16z"/>') };

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(ui.timers.toast); ui.timers.toast = setTimeout(() => { t.hidden = true; }, 2600);
}
const parseRoute = () => { const [view, id] = location.hash.replace(/^#\/?/, '').split('/'); return { view: view || 'home', id: id ? decodeURIComponent(id) : null }; };
const go = path => { location.hash = '#/' + path; };

// ---------- illustrated scenes (used when there's no photo) ----------
function sceneSVG(type) {
  const t = TYPES[type] || TYPES.park, [a, b] = t.grad, id = 'g' + type;
  const sky = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="400" height="260" fill="url(#${id})"/><circle cx="300" cy="78" r="36" fill="#FFF4C9" opacity=".92"/>`;
  const dark = 'rgba(8,30,26,.78)', mid = 'rgba(8,30,26,.42)';
  const scenes = {
    mountains: `<path d="M0 260V170l70-80 50 50 70-90 70 100 50-40 90 70v80z" fill="${mid}"/><path d="M190 50l-18 22 12-2 6 8 8-10 10 4z" fill="#fff" opacity=".9"/><path d="M0 260v-50l90-60 70 50 80-60 90 65 70-35v90z" fill="${dark}"/>`,
    snow: `<path d="M0 260V170l70-80 50 50 70-90 70 100 50-40 90 70v80z" fill="rgba(255,255,255,.55)"/><path d="M0 260v-50l90-60 70 50 80-60 90 65 70-35v90z" fill="#F4FBFF"/><path d="M0 260v-25c80-20 160 10 240-5s110-10 160 0v30z" fill="#DCEFFB"/>`,
    waves: `<path d="M0 170c40-14 80 14 120 0s80-14 120 0 80 14 120 0 40-8 40-8v98H0z" fill="rgba(255,255,255,.45)"/><path d="M0 200c40-14 80 14 120 0s80-14 120 0 80 14 120 0 40-8 40-8v68H0z" fill="rgba(6,90,110,.65)"/><path d="M0 232c60-10 140-6 220 4s140 6 180-4v28H0z" fill="#FFE2A6"/>`,
    lake: `<path d="M0 160l80-50 60 40 90-70 80 60 90-30v40H0z" fill="${mid}"/><rect y="170" width="400" height="90" fill="rgba(20,90,150,.55)"/><path d="M60 196h80M220 214h110M120 236h70" stroke="rgba(255,255,255,.7)" stroke-width="4" stroke-linecap="round"/><path d="M170 186l50 0-8 10h-34z" fill="${dark}"/>`,
    hills: `<path d="M0 260v-90c60-40 120-40 180 0s140 20 220-30v120z" fill="${mid}"/><path d="M0 260v-50c80-50 170-40 240 0s110 0 160-20v70z" fill="${dark}"/><circle cx="90" cy="168" r="18" fill="${dark}"/><rect x="87" y="176" width="6" height="22" fill="${dark}"/><circle cx="330" cy="150" r="14" fill="${dark}"/><rect x="327" y="156" width="6" height="18" fill="${dark}"/>`,
    city: `<g fill="${mid}"><rect x="20" y="120" width="50" height="140"/><rect x="80" y="80" width="40" height="180"/><rect x="250" y="100" width="46" height="160"/><rect x="340" y="130" width="50" height="130"/></g><g fill="${dark}"><rect x="0" y="170" width="60" height="90"/><rect x="60" y="140" width="56" height="120"/><rect x="128" y="110" width="44" height="150"/><rect x="180" y="150" width="70" height="110"/><rect x="262" y="135" width="52" height="125"/><rect x="320" y="175" width="80" height="85"/></g><g fill="#FFE9A8" opacity=".85"><rect x="140" y="125" width="6" height="8"/><rect x="154" y="140" width="6" height="8"/><rect x="72" y="160" width="6" height="8"/><rect x="276" y="150" width="6" height="8"/><rect x="200" y="170" width="6" height="8"/></g>`,
    coaster: `<path d="M0 260v-60c70-30 130-20 200 0s130 10 200-20v80z" fill="${dark}"/><path d="M20 210c40-120 90-120 120-40s60-80 100-60 50 90 80 60 40-70 80-60" fill="none" stroke="#fff" stroke-width="5" opacity=".9"/><circle cx="260" cy="120" r="34" fill="none" stroke="#fff" stroke-width="5" opacity=".9"/>`,
    road: `<path d="M0 260v-90c60-30 130-30 200 0s140 20 200-10v100z" fill="${mid}"/><path d="M170 260l20-110h20l20 110z" fill="${dark}"/><path d="M200 160v14M200 186v18M200 218v24" stroke="#FFE9A8" stroke-width="4"/>`,
  };
  return `<svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${sky}${scenes[t.scene] || scenes.hills}${sceneDeco(t.scene)}</svg>`;
}
const heroMedia = adv => ui.covers?.[adv.id] ? `<img src="${ui.covers[adv.id]}" alt="">` : adv.research?.photo?.img ? `<img src="${esc(adv.research.photo.img)}" alt="">` : sceneSVG(adv.type);
const whenLabel = adv => {
  if (adv.status === 'done') return fmtDate(adv.date, { month: 'short', day: 'numeric', year: 'numeric' });
  const d = daysUntil(adv.date);
  return d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : d > 1 ? `In ${d} days` : `${fmtDate(adv.date)} (passed)`;
};

// ---------- render ----------
function render() {
  const { view, id } = parseRoute();
  const screens = { home, ideas: ideasScreen, idea: () => ideaDetail(id), chat: chatScreen, new: () => formScreen(null), edit: () => formScreen(id), a: () => detail(id), brief: () => briefing(id), live: () => live(id), rate: () => rateScreen(id), explore: () => explore(id), family, you };
  const fn = screens[view] || home;
  $('#app').innerHTML = fn();
  // Fade in only when arriving on a screen, not on every in-place update.
  if (ui.shown !== location.hash) { ui.shown = location.hash; $('#app').firstElementChild?.classList.add('enter'); }
  const tab = { new: 'new', edit: 'new', ideas: 'new', idea: 'new', chat: 'home', explore: 'explore', family: 'family', you: 'you' }[view] || 'home';
  $$('#tabbar a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
  $('#tabbar').hidden = view === 'brief';
  afterRender(view, id);
}
window.addEventListener('hashchange', () => { if (!ui.keepDraft) ui.draft = null; ui.keepDraft = false; render(); window.scrollTo(0, 0); });

function afterRender(view, id) {
  const adv = id && advById(id);
  if ((view === 'a' || view === 'brief') && adv && !adv.research?.at && !ui.busy[id]) runResearch(adv);
  if (view === 'explore' && !ui.community && !ui.loadingCommunity) loadCommunity();
  if (view === 'idea') setupIdeaDetail(id);
  if (view === 'chat') setupChat();
  if ((view === 'a' || view === 'rate' || view === 'live') && adv) loadTripPhotos(adv.id);
}

async function runResearch(adv) {
  ui.busy[adv.id] = true; ui.steps[adv.id] = {};
  const rerender = () => { const r = parseRoute(); if (r.id === adv.id) render(); };
  rerender();
  await research(adv, (name, st) => { ui.steps[adv.id][name] = st; });
  ui.busy[adv.id] = false;
  save(); rerender();
}

async function loadCommunity() {
  ui.loadingCommunity = true;
  try { ui.community = await Community.list(); ui.communityErr = null; }
  catch (e) { ui.community = []; ui.communityErr = 'Couldn’t load shared adventures. Check your connection and reopen Explore.'; }
  ui.loadingCommunity = false;
  if (parseRoute().view === 'explore') render();
}

// ---------- Home ----------
function advCard(a) {
  return `<a class="adv-card" href="#/a/${a.id}">
    <div class="adv-thumb">${heroMedia(a)}</div>
    <div class="stack" style="gap:4px;min-width:0">
      <h3>${esc(a.title)}</h3>
      <div class="meta"><span>${TYPES[a.type]?.e || ''} ${TYPES[a.type]?.label || ''}</span><span>${whenLabel(a)}</span></div>
      <div class="meta">${a.status === 'done' ? (a.rating ? stars(a.rating) : '<span>Not rated</span>') : `<span>${a.stops.length} stop${a.stops.length === 1 ? '' : 's'}</span>`}${a.status === 'active' ? '<span class="pill coral">In progress</span>' : ''}${a.example ? '<span class="pill example-flag">Example</span>' : ''}</div>
    </div></a>`;
}

function home() {
  const h = new Date().getHours();
  const hi = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  const name = state.profile.name;
  const open = state.adventures.filter(a => a.status !== 'done').sort((a, b) => (a.status === 'active' ? -1 : 0) - (b.status === 'active' ? -1 : 0) || a.date.localeCompare(b.date));
  const past = state.adventures.filter(a => a.status === 'done').sort((a, b) => b.date.localeCompare(a.date));
  const next = open[0];
  const wx = next && wxDay(next);
  return `<div class="screen">
    <header class="greet"><span class="eyebrow">${fmtDate(todayStr(), { weekday: 'long', month: 'long', day: 'numeric' })}</span><h1>${hi}${name ? ', ' + esc(name) : ''}.</h1></header>
    ${homeBanner(next ? (next.status === 'active' ? 'Adventure in progress! Let’s roll.' : `${whenLabel(next)}: ${esc(next.title)}!`) : 'Where are we going today?')}
    ${chatStarter()}
    <a class="idea-cta" href="#/ideas"><span class="e">✨</span><span><b>Or pick settings yourself</b><small>Choose drive time, kinds of day and food. Planerr builds 3 plans.</small></span><span class="go">→</span></a>
    ${next ? `
      <a class="hero tall" href="#/a/${next.id}" style="text-decoration:none">
        ${heroMedia(next)}
        <div class="hero-top"><span class="pill coral">${next.status === 'active' ? 'Happening now' : 'Up next'}</span><span class="pill">${whenLabel(next)}</span>${next.example ? '<span class="pill example-flag">Example</span>' : ''}</div>
        <div class="hero-body">
          <h1>${esc(next.title)}</h1>
          <div class="row wrap"><span class="pill">${TYPES[next.type].e} ${TYPES[next.type].label}</span><span class="pill">${fmtDate(next.date)}</span>${wx ? `<span class="pill">${wmo(wx.daily.weather_code[0])[0]} ${Math.round(wx.daily.temperature_2m_max[0])}°</span>` : ''}</div>
        </div>
      </a>
      <div class="row">
        ${next.status === 'active' ? `<a class="btn primary block" href="#/live/${next.id}">Continue adventure</a>`
          : `<a class="btn primary block" href="#/brief/${next.id}">Start briefing</a><a class="btn" href="#/a/${next.id}">View plan</a>`}
      </div>` : `
      <div class="hero flat">${sceneSVG('hike')}<div class="hero-body"><h2>Where to next?</h2><p style="color:#fff">Plan a day trip and Planerr checks the weather, hours, food and drive time for you.</p></div></div>
      <a class="btn primary block" href="#/new">Plan an adventure</a>`}
    ${open.length > 1 ? `<section class="stack"><div class="section-title"><h2>Coming up</h2></div><div class="adv-list">${open.slice(1).map(advCard).join('')}</div></section>` : ''}
    <section class="stack">
      <div class="section-title"><h2>Past adventures</h2><span class="muted small">${past.length}</span></div>
      ${past.length ? `<div class="adv-list">${past.map(advCard).join('')}</div>` : `<div class="empty">${pipNote('<span>Finished adventures show up here with your rating.</span>', 'sleepy')}</div>`}
    </section>
    ${state.adventures.some(a => a.example) ? `<p class="note">Items marked Example are samples. Remove them in <a href="#/you">You</a>.</p>` : ''}
  </div>`;
}

// ---------- Plan form (new & edit) ----------
function draftFrom(adv) { return JSON.parse(JSON.stringify(adv)); }

function pickerHTML(key, placeholder, value) {
  return `<div class="place-field">
    <input type="search" id="pk-${key}" data-search="${key}" placeholder="${esc(placeholder)}" autocomplete="off" value="${esc(value || '')}">
    <div class="suggest" id="sg-${key}" hidden></div>
  </div>`;
}
function pickedHTML(p, act, extra = '') {
  return `<div class="picked"><span>📍</span><div><b>${esc(p.label)}</b><small>${esc(p.sub || '')}</small></div>${extra}<button class="icon-btn" data-act="${act}" aria-label="Change">✕</button></div>`;
}

function formScreen(id) {
  if (!ui.draft || ui.draft._for !== (id || 'new')) {
    const src = id && advById(id);
    ui.draft = src ? draftFrom(src) : newAdventure();
    ui.draft._for = id || 'new';
  }
  const d = ui.draft, kids = state.family.kids;
  const main = d.stops.find(s => s.main);
  const side = d.stops.filter(s => !s.main);
  const stopRow = s => {
    const i = d.stops.indexOf(s);
    return `<div class="stop-edit" data-stop="${s.id}">
      <div class="row">
        <span style="font-size:1.3rem">${s.main ? '⭐' : CATS[s.cat]?.e || '📍'}</span>
        <input type="text" data-sf="name" value="${esc(s.name)}" placeholder="Stop name" aria-label="Stop name">
        <button class="icon-btn" data-act="s-up" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button class="icon-btn" data-act="s-down" aria-label="Move down" ${i === d.stops.length - 1 ? 'disabled' : ''}>↓</button>
        <button class="icon-btn" data-act="s-del" aria-label="Remove stop">✕</button>
      </div>
      <div class="grid3">
        <label class="field"><span>Type</span><select data-sf="cat">${Object.entries(CATS).map(([k, c]) => `<option value="${k}" ${k === s.cat ? 'selected' : ''}>${c.e} ${c.label}</option>`).join('')}</select></label>
        <label class="field"><span>Minutes</span><input type="number" min="0" step="15" data-sf="dur" value="${s.dur}"></label>
        <label class="field"><span>Cost $</span><input type="number" min="0" step="1" data-sf="cost" value="${s.cost}"></label>
      </div>
      ${s.place ? `<div class="small muted">📍 ${esc(s.place.label)}${s.place.sub ? ', ' + esc(s.place.sub) : ''} · <button class="btn sm ghost" data-act="s-unplace">Change location</button></div>`
        : pickerHTML('stop:' + s.id, 'Find this place on the map', '')}
      ${s.tip ? `<p class="small muted">Tip from the community: ${esc(s.tip)}</p>` : ''}
    </div>`;
  };
  return `<div class="screen">
    <div class="topbar"><a class="icon-btn" href="${id ? '#/a/' + id : '#/'}" aria-label="Back">${I.back}</a><h1>${id ? 'Edit adventure' : 'New adventure'}</h1></div>
    ${id ? '' : `<a class="idea-cta" href="#/ideas"><span class="e">✨</span><span><b>Not sure where to go?</b><small>Get 3 ready-made plans within your drive time.</small></span><span class="go">→</span></a>`}

    <section class="card">
      <h2>What kind of day?</h2>
      <div class="type-grid">${Object.entries(TYPES).map(([k, t]) => `<button class="type-opt ${d.type === k ? 'on' : ''}" data-act="type" data-type="${k}"><span class="e">${t.e}</span>${t.label}</button>`).join('')}</div>
      <label class="field"><span>Name it</span><input type="text" id="f-title" data-df="title" value="${esc(d.title)}" placeholder="${main ? `${TYPES[d.type].label} at ${esc(main.name)}` : 'Saturday summit hike'}"></label>
    </section>

    <section class="card">
      <h2>When</h2>
      <label class="field"><span>Date</span><input type="date" id="f-date" data-df="date" value="${esc(d.date)}"></label>
      <div class="grid2">
        <label class="field"><span>Leave at</span><input type="time" id="f-start" data-df="start" value="${esc(d.start)}"></label>
        <label class="field"><span>Back by</span><input type="time" id="f-end" data-df="end" value="${esc(d.end)}"></label>
      </div>
    </section>

    <section class="card">
      <h2>Where</h2>
      <div class="field"><span>Starting from</span>
        ${d.origin ? pickedHTML(d.origin, 'origin-clear') : `${pickerHTML('origin', 'Home address or town', '')}<button class="btn sm ghost" data-act="locate" style="justify-self:start">◎ Use my location</button>`}
      </div>
      <div class="field"><span>Main destination</span>
        ${main ? stopRow(main) : pickerHTML('dest', 'Park, trail, beach, museum, town…', '')}
      </div>
      <div class="field"><span>Stops along the way</span>
        <div class="stack">${side.map(stopRow).join('')}</div>
        ${pickerHTML('add', 'Add a viewpoint, café, shop…', '')}
        <button class="btn sm ghost" data-act="s-custom" style="justify-self:start">＋ Add a stop without a location</button>
      </div>
    </section>

    <section class="card">
      <h2>Who & budget</h2>
      <div class="grid2">
        <label class="field"><span>Adults</span><input type="number" min="1" id="f-people" data-df="people" value="${d.people}"></label>
        <label class="field"><span>Budget $</span><input type="number" min="0" step="10" id="f-budget" data-df="budget" value="${d.budget}"></label>
      </div>
      ${kids.length ? `<label class="check" style="border:0"><input type="checkbox" id="f-family" data-df="familyMode" ${d.familyMode ? 'checked' : ''}><span>Bring the kids<small>${kids.map(k => esc(k.name || 'Kid') + ' (' + k.age + ')').join(', ')}. Adds kid-friendly picks, ticket ages and family packing.</small></span></label>`
        : `<p class="small muted">Going with kids? <a href="#/family">Add them in Family</a> to get age-matched picks.</p>`}
      <label class="field"><span>Notes</span><textarea id="f-notes" data-df="notes" placeholder="Parking, who's driving, reservations…">${esc(d.notes)}</textarea></label>
    </section>

    <button class="btn primary block" data-act="save-adv" style="min-height:54px;font-size:1.05rem">${id ? 'Save changes' : 'Plan it & research'}</button>
    ${id ? `<button class="btn ghost block" data-act="del-adv" style="color:var(--bad)">Delete adventure</button>` : ''}
  </div>`;
}

function applyPick(key, p) {
  const d = ui.draft;
  if (key === 'idea-origin') { ideaPrefs().origin = p; save(); }
  else if (key === 'origin') d.origin = p;
  else if (key === 'dest') {
    d.stops.forEach(s => { s.main = false; });
    d.stops.push(newStop({ name: p.label, place: p, cat: TYPES[d.type].cat, dur: d.type === 'hike' ? 180 : d.type === 'themepark' ? 300 : 120, main: true }));
    if (!d.title) d.title = '';
  } else if (key === 'add') {
    const mi = d.stops.findIndex(s => s.main);
    const cat = /cafe|restaurant|fast_food|bakery|ice_cream|pub|bar/.test(p.kind) ? 'food' : /viewpoint|peak/.test(p.kind) ? 'sight' : /shop|mall|supermarket/.test(p.kind) ? 'shop' : 'sight';
    const s = newStop({ name: p.label, place: p, cat, dur: cat === 'food' ? 45 : 30 });
    mi >= 0 ? d.stops.splice(mi, 0, s) : d.stops.push(s);
  } else if (key.startsWith('stop:')) {
    const s = d.stops.find(x => x.id === key.slice(5));
    if (s) { s.place = p; if (!s.name) s.name = p.label; }
  }
}

async function searchPicker(key, q) {
  const box = $('#sg-' + CSS.escape(key));
  if (!box) return;
  if (q.trim().length < 3) { box.hidden = true; return; }
  const near = ui.draft?.origin || ui.draft?.stops.find(s => s.place)?.place || null;
  try {
    const res = await API.searchPlaces(q, near);
    ui.results[key] = res;
    box.innerHTML = res.length ? res.map((r, i) => `<button data-act="pick" data-key="${esc(key)}" data-i="${i}"><b>${esc(r.label)}</b><small>${esc(r.sub)}</small></button>`).join('')
      : `<button disabled><small>No matches. Try adding the town name.</small></button>`;
  } catch (e) {
    box.innerHTML = `<button disabled><small>Place search is offline. Check your connection.</small></button>`;
  }
  box.hidden = false;
}

async function saveDraft() {
  const d = ui.draft;
  const main = d.stops.find(s => s.main);
  if (!d.stops.length && !d.origin) { toast('Add a destination first.'); return; }
  if (!d.date) { toast('Pick a date.'); return; }
  d.stops = d.stops.filter(s => s.name.trim() || s.place);
  if (!d.title.trim()) d.title = main ? `${TYPES[d.type].label} at ${main.name}` : `${TYPES[d.type].label} day`;
  const isNew = d._for === 'new';
  delete d._for;
  if (d.example) delete d.example;
  if (isNew) state.adventures.push(d);
  else state.adventures[state.adventures.findIndex(a => a.id === d.id)] = d;
  d.research = { ...(d.research || {}), at: null };
  refreshPacking(d);
  save();
  ui.draft = null;
  go('a/' + d.id);
}

// ---------- Adventure detail ----------
function stepBadge(advId, name, label) {
  const st = ui.steps[advId]?.[name];
  if (!ui.busy[advId]) return '';
  return st === 'ok' ? '' : `<span class="loading"><span class="spin"></span>${label}</span>`;
}

function weatherCard(adv) {
  const R = adv.research || {}, w = wxDay(adv), sch = schedule(adv);
  if (!w) {
    const msg = ui.busy[adv.id] ? stepBadge(adv.id, 'weather', 'Checking the forecast…')
      : R.weather?.note === 'far' ? `Forecasts reach 16 days ahead. Check back from ${fmtDate(localISO(new Date(new Date(adv.date + 'T12:00').getTime() - 15 * 864e5)))}.`
      : R.weather?.note === 'past' ? 'This date has passed.' : R.errors?.weather ? 'Couldn’t reach the weather service.' : 'Add a destination to see the forecast.';
    return `<section class="card" id="weather"><h2>Weather</h2><p class="muted">${msg}</p></section>`;
  }
  const d = w.daily, [icon, label] = wmo(d.weather_code[0]);
  const hours = [];
  for (let m = Math.floor(toMin(adv.start) / 60) * 60; m <= Math.min(sch.home, 1439); m += 60) hours.push(m);
  return `<section class="card" id="weather">
    <div class="card-head"><h2>Weather</h2><span class="muted small">${esc(w.place)}</span></div>
    <div class="wx"><div class="wx-big">${icon}</div><div><div class="wx-temp">${Math.round(d.temperature_2m_max[0])}° <span>/ ${Math.round(d.temperature_2m_min[0])}°</span></div><div class="muted">${label} · ☔ ${d.precipitation_probability_max[0] ?? 0}% · 💨 ${Math.round(d.wind_speed_10m_max[0])} ${imperial() ? 'mph' : 'km/h'}</div></div></div>
    <div class="row wrap small"><span class="pill line">🌅 ${fmtTime(toMin(d.sunrise[0].slice(11, 16)))}</span><span class="pill line">🌇 ${fmtTime(sunsetMin(adv))}</span><span class="pill line">UV ${Math.round(d.uv_index_max[0] ?? 0)}</span></div>
    <div class="hours">${hours.map(m => { const x = wxAt(adv, m); return x ? `<div><small>${fmtTime(m).replace(':00', '')}</small><span>${wmo(x.code)[0]}</span><b>${Math.round(x.temp)}°</b><small class="${x.rain >= 50 ? 'wet' : ''}">${x.rain}%</small></div>` : ''; }).join('')}</div>
  </section>`;
}

function timelineCard(adv) {
  const sch = schedule(adv), R = adv.research || {};
  const live = adv.status !== 'planned';
  const rows = adv.stops.map((s, i) => {
    const r = sch.rows[i], tags = R.details?.[s.place?.osm];
    const h = tags?.opening_hours ? hoursOn(tags.opening_hours, adv.date) : null;
    const v = h && visitStatus(h, r.arrive, r.depart);
    const hp = !h ? (s.place?.osm && R.details && !ui.busy[adv.id] ? '<span class="pill line">Hours not listed</span>' : '')
      : v === 'open' ? `<span class="pill good">Open · ${esc(h.text)}</span>` : v === 'closes' ? `<span class="pill warn">Closes early · ${esc(h.text)}</span>`
      : v === 'unknown' ? `<span class="pill line" title="${esc(h.text)}">Hours: ${esc((h.text || '').slice(0, 40))}</span>` : `<span class="pill bad">${v === 'closed' ? 'Closed that day' : 'Not open then · ' + esc(h.text)}</span>`;
    const x = wxAt(adv, r.arrive);
    return `<div class="t-row">
      <div class="t-time">${fmtTime(r.arrive)}</div>
      <div class="t-rail"><div class="t-dot ${s.done ? 'done' : ''}"></div><div class="t-line"></div></div>
      <div class="t-body">
        ${r.drive ? `<div class="t-drive">🚗 ${fmtDur(r.drive)} drive${r.km ? ' · ' + dist(r.km) : ''}</div>` : ''}
        <h3>${s.main ? '⭐ ' : ''}${esc(s.name)}</h3>
        ${s.trail ? `<span class="small">🥾 ${esc(s.trail.name)} · ${dist(s.trail.km)} · ${s.trail.diff}</span>` : ''}
        <div class="row wrap small"><span class="muted">${CATS[s.cat]?.e} ${fmtDur(s.dur)} · until ${fmtTime(r.depart)}${s.cost ? ' · ' + money(s.cost) : ''}</span>${x ? `<span class="muted">${wmo(x.code)[0]} ${Math.round(x.temp)}°</span>` : ''}</div>
        <div class="row wrap">${hp}${s.place ? `<a class="pill line" href="${mapsDir(s.place)}" target="_blank" rel="noopener">Directions ↗</a>` : ''}${s.cat === 'food' && s.place ? reviewsLink(s.name, s.place) : ''}${s.place && adv.status !== 'done' ? closedBtn(closedKey(s.place), s.name) : ''}</div>
        ${s.tip ? `<p class="small muted">💡 ${esc(s.tip)}</p>` : ''}
      </div></div>`;
  }).join('');
  return `<section class="card" id="plan">
    <div class="card-head"><h2>The plan</h2>${live ? '' : `<a class="btn sm" href="#/edit/${adv.id}">Edit stops</a>`}</div>
    ${adv.stops.length ? `<div class="timeline">
      ${adv.origin ? `<div class="t-row"><div class="t-time">${fmtTime(toMin(adv.start))}</div><div class="t-rail"><div class="t-dot home"></div><div class="t-line"></div></div><div class="t-body"><h3>Leave ${esc(adv.origin.label)}</h3></div></div>` : ''}
      ${rows}
      ${adv.origin ? `<div class="t-row"><div class="t-time">${fmtTime(sch.home)}</div><div class="t-rail"><div class="t-dot home"></div></div><div class="t-body">${sch.back ? `<div class="t-drive">🚗 ${fmtDur(sch.back.min)} drive · ${dist(sch.back.km)}</div>` : ''}<h3>Back home</h3></div></div>` : ''}
    </div>
    ${sch.routed ? '<p class="note">Drive times come from OpenStreetMap routing and don’t include traffic.</p>' : stepBadge(adv.id, 'route', 'Working out drive times…')}`
    : `<div class="empty">${pipNote('<span>No stops yet. Pip is ready when you are.</span>', 'wink', `<a class="btn sm primary" href="#/edit/${adv.id}">Add stops</a>`)}</div>`}
  </section>`;
}

function foodCard(adv) {
  const R = adv.research || {};
  if (!R.food) return `<section class="card" id="food"><h2>Food along the way</h2><p class="muted">${ui.busy[adv.id] ? stepBadge(adv.id, 'food', 'Finding places to eat…') : R.errors?.food ? 'Couldn’t load restaurants right now. Try Refresh research below.' : 'Add a destination to find food nearby.'}</p></section>`;
  const votes = state.profile.votes || {};
  const planned = new Set(adv.stops.map(s => s.place?.osm));
  const shut = R.food.filter(f => reportedClosed(f) || closedInfo({ ...f.ctags, opening_hours: f.hours }, adv.date)?.status === 'closed').map(f => f.id);
  let list = R.food.filter(f => !planned.has(f.id) && votes[f.id] !== -1 && !shut.includes(f.id)).map(f => ({ ...f, score: tasteScore(f), maybe: closedInfo(f.ctags, adv.date)?.status === 'maybe' }));
  if (ui.foodFilter === 'diet' && state.profile.diet.length) list = list.filter(f => state.profile.diet.some(d => f.diet[d] === 'yes' || f.diet[d] === 'only' || f.cuisine.includes(d)));
  list.sort((a, b) => b.score - a.score || a.km - b.km);
  const groups = {};
  list.slice(0, 14).forEach(f => { (groups[f.near] = groups[f.near] || []).push(f); });
  const item = f => {
    const [label, e] = f.cuisine.length ? cuisineInfo(f.cuisine[0]) : AMENITY_FOOD[f.amenity] || ['Food', '🍽️'];
    const h = f.hours ? hoursOn(f.hours, adv.date) : null;
    const diets = Object.entries(f.diet).filter(([, v]) => v === 'yes' || v === 'only').map(([k]) => DIETS[k]);
    return `<div class="li">
      <div class="ic">${e}</div>
      <div class="main"><b>${esc(f.name)}</b>
        <span class="small muted">${esc(f.cuisine.slice(0, 2).map(c => cuisineInfo(c)[0]).join(' · ') || label)} · ${dist(f.km)}${h ? ` · ${h.status === 'open' ? 'Open ' + esc(h.text) : h.status === 'closed' ? 'Closed that day' : 'Hours vary'}` : ''}</span>
        <span class="row wrap" style="gap:4px">${f.score > 0 ? '<span class="pill good">Matches your taste</span>' : ''}${f.maybe ? '<span class="pill warn">Seasonal: check it’s open</span>' : ''}${diets.map(x => `<span class="pill line">${x}</span>`).join('')}${reviewsLink(f.name, f)}${closedBtn(f.id, f.name)}</span>
      </div>
      <div class="acts">
        <button class="icon-btn" data-act="food-vote" data-fid="${f.id}" data-v="1" aria-label="I like this kind of food" style="${votes[f.id] === 1 ? 'background:var(--good-soft)' : ''}">👍</button>
        <button class="icon-btn" data-act="food-vote" data-fid="${f.id}" data-v="-1" aria-label="Not for me">👎</button>
        <button class="icon-btn" data-act="food-add" data-fid="${f.id}" aria-label="Add to plan" style="background:var(--coral);color:var(--coral-ink)">＋</button>
      </div></div>`;
  };
  return `<section class="card" id="food">
    <div class="card-head"><h2>Food along the way</h2><span class="muted small">${R.food.length - shut.length} found</span></div>
    ${shut.length ? `<p class="small muted">Hiding ${shut.length} place${shut.length === 1 ? '' : 's'} that ${shut.length === 1 ? 'is' : 'are'} closed that day or that you reported closed.</p>` : ''}
    <div class="chips"><button class="chip ${ui.foodFilter === 'match' ? 'on' : ''}" data-act="food-filter" data-f="match">Best for you</button>${state.profile.diet.length ? `<button class="chip ${ui.foodFilter === 'diet' ? 'on' : ''}" data-act="food-filter" data-f="diet">${state.profile.diet.map(d => DIETS[d]).join(' / ')} only</button>` : ''}</div>
    ${Object.keys(groups).length ? Object.entries(groups).map(([k, fs]) => `<div class="stack" style="gap:0"><span class="label">${esc(k)}</span><div class="list">${fs.map(item).join('')}</div></div>`).join('')
      : '<p class="muted">Nothing matched. Try “Best for you”.</p>'}
    <p class="note">👍 and 👎 teach Planerr your taste. ＋ adds the place to your plan. Tap Google reviews to read what people say in Google Maps. Listings come from OpenStreetMap, so double-check hours for small places.</p>
  </section>`;
}

function ticketsCard(adv) {
  const items = adv.stops.map(s => [s, ticketInfo(adv, s)]).filter(([, t]) => t);
  if (!items.length) return '';
  return `<section class="card" id="tickets"><h2>Tickets</h2>
    ${items.map(([s, t]) => `<div class="stack">
      <h3>🎟️ ${esc(s.name)}</h3>
      ${t.charge ? `<p class="small muted">Listed price: ${esc(t.charge)}</p>` : ''}
      <ol class="steps">${t.steps.map(x => `<li><span>${x}</span></li>`).join('')}</ol>
      <div class="row wrap">${t.site ? `<a class="btn primary sm" href="${esc(t.site)}" target="_blank" rel="noopener">Official site ↗</a>` : ''}<a class="btn sm" href="${t.search}" target="_blank" rel="noopener">${t.site ? 'Search tickets' : 'Find official tickets'} ↗</a></div>
    </div>`).join('<div class="divider"></div>')}
  </section>`;
}

function nearbyCard(adv) {
  const n = (adv.research?.nearby || []).filter(x => x.title !== adv.research?.photo?.title && !SIGHT_BAD.test(x.title + ' ' + x.text.slice(0, 160))).slice(0, 10);
  if (!n.length) return ui.busy[adv.id] ? `<section class="card" id="explore"><h2>Worth a look nearby</h2>${stepBadge(adv.id, 'photos', 'Finding photos…')}</section>` : '';
  return `<section class="card" id="explore"><h2>Worth a look nearby</h2>
    <div class="gallery">${n.map(x => `<a class="g-item" href="${esc(x.url)}" target="_blank" rel="noopener"><img src="${esc(x.img)}" alt="${esc(x.title)}" loading="lazy"><div><b>${esc(x.title)}</b><span class="small muted">${esc(x.text.slice(0, 110))}${x.text.length > 110 ? '…' : ''}</span></div></a>`).join('')}</div>
    <p class="note">Photos and descriptions from Wikipedia.</p>
  </section>`;
}

function familyCard(adv) {
  if (!adv.familyMode || !state.family.kids.length) return '';
  const kids = state.family.kids, bands = [...new Set(kids.map(k => bandFor(k.age)))];
  const wanted = new Set(bands.flatMap(b => b.osm));
  const anchor = mainStop(adv)?.place;
  const spots = (adv.research?.family || []).filter(s => wanted.has(s.kind)).map(s => ({ ...s, km: anchor ? haversine(anchor, s) : 0 }))
    .sort((a, b) => (a.kind === 'playground') - (b.kind === 'playground') || a.km - b.km).slice(0, 10);
  return `<section class="card" id="family">
    <h2>Family picks</h2>
    <div class="chips">${kids.map(k => `<span class="chip static">${esc(k.name || 'Kid')} · ${k.age}</span>`).join('')}</div>
    ${bands.map(b => `<div class="band" style="background:${b.color}"><h3>${b.label}</h3><ul>${b.tips.map(t => `<li>${t}</li>`).join('')}</ul></div>`).join('')}
    ${spots.length ? `<span class="label">Kid-friendly spots nearby</span><div class="list">${spots.map(s => `<div class="li"><div class="ic">${FAMILY_OSM[s.kind][1]}</div><div class="main"><b>${esc(s.name)}</b><span class="small muted">${FAMILY_OSM[s.kind][0]} · ${dist(s.km)}</span></div><div class="acts"><button class="icon-btn" data-act="fam-add" data-sid="${s.id}" aria-label="Add to plan" style="background:var(--coral);color:var(--coral-ink)">＋</button></div></div>`).join('')}</div>`
      : `<p class="muted small">${ui.busy[adv.id] ? 'Looking for kid-friendly spots…' : 'No kid-friendly spots found near the destination.'}</p>`}
  </section>`;
}

function gearCard(adv) {
  const kit = hikeKit(adv);
  const done = adv.packing.filter(p => p.done).length;
  return `${kit ? `<section class="card" id="gear"><div class="card-head"><h2>Hike supplies</h2><span class="pill line">${fmtDur(kit.hikeMin)} on trail</span></div>
      <div class="list">${kit.kit.map(k => `<div class="check" style="cursor:default"><span>🎒</span><span><b>${esc(k.item)}</b><small>${esc(k.why)}</small></span></div>`).join('')}</div></section>` : ''}
    <section class="card" id="${kit ? 'packing' : 'gear'}">
      <div class="card-head"><h2>Packing list</h2><span class="muted small">${done}/${adv.packing.length}</span></div>
      <div class="progress"><div style="width:${adv.packing.length ? done / adv.packing.length * 100 : 0}%"></div></div>
      <div>${adv.packing.map(p => `<label class="check ${p.done ? 'done' : ''}"><input type="checkbox" data-pack="${p.id}" ${p.done ? 'checked' : ''}><span>${esc(p.text)}</span></label>`).join('')}</div>
      <form class="row" data-form="pack"><input type="text" name="item" placeholder="Add an item" aria-label="Add packing item"><button class="btn sm">Add</button></form>
    </section>`;
}

function researchCard(adv) {
  const R = adv.research || {}, c = R.checked || {};
  const rows = [['route', 'Drive times', 'OSRM / OpenStreetMap'], ['weather', 'Forecast', 'Open-Meteo'], ['hours', 'Opening hours & websites', 'OpenStreetMap'], ['food', 'Food along the way', 'OpenStreetMap'], ['photos', 'Photos', 'Wikipedia']];
  rows.splice(1, 0, ['access', 'Road closures, elevation & snow', 'OpenStreetMap / Open-Meteo']);
  if (isHikeAdv(adv)) rows.push(['trails', 'Recommended trails', 'OpenStreetMap / Open-Meteo']);
  if (adv.familyMode) rows.push(['family', 'Kid-friendly spots', 'OpenStreetMap']);
  return `<section class="card"><div class="card-head"><h2>Research</h2><button class="btn sm" data-act="research" ${ui.busy[adv.id] ? 'disabled' : ''}>${ui.busy[adv.id] ? 'Researching…' : 'Refresh'}</button></div>
    <div class="list">${rows.map(([k, label, src]) => {
      const st = ui.busy[adv.id] ? ui.steps[adv.id]?.[k] : null;
      const status = st === 'start' ? '<span class="loading"><span class="spin"></span></span>' : R.errors?.[k] ? '<span class="pill bad">Failed</span>' : c[k] ? `<span class="pill good">✓ ${new Date(c[k]).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>` : '<span class="pill line">Not yet</span>';
      return `<div class="li" style="grid-template-columns:1fr auto"><div class="main"><b>${label}</b><span class="tiny muted">${src}</span></div>${status}</div>`;
    }).join('')}</div>
    <p class="note">Hours come from OpenStreetMap, which volunteers keep up to date. Confirm on the official site for anything important.</p>
  </section>`;
}

function detail(id) {
  const adv = advById(id);
  if (!adv) return `<div class="screen"><div class="empty">That adventure doesn't exist anymore.<a class="btn" href="#/">Go home</a></div></div>`;
  const sch = schedule(adv), b = budget(adv), alerts = alertsFor(adv), photo = adv.research?.photo;
  const cta = adv.status === 'planned' ? `<a class="btn primary" href="#/brief/${adv.id}">Start briefing</a>`
    : adv.status === 'active' ? `<a class="btn primary" href="#/live/${adv.id}">Continue adventure</a>`
    : `<button class="btn dark" data-act="again">Plan it again</button>`;
  return `<div class="screen">
    <div class="hero">
      ${heroMedia(adv)}
      <div class="hero-top"><a class="icon-btn" href="#/" aria-label="Back">${I.back}</a><span class="spacer"></span>${adv.example ? '<span class="pill example-flag">Example</span>' : ''}${adv.status !== 'done' ? `<a class="icon-btn" href="#/edit/${adv.id}" aria-label="Edit">${I.edit}</a>` : ''}</div>
      ${photo?.img ? `<span class="credit"><a href="${esc(photo.url)}" target="_blank" rel="noopener">Photo: Wikipedia</a></span>` : ''}
      <div class="hero-body">
        <div class="row wrap"><span class="pill coral">${whenLabel(adv)}</span><span class="pill">${TYPES[adv.type].e} ${TYPES[adv.type].label}</span>${adv.status === 'done' && adv.rating ? `<span class="pill">${stars(adv.rating)}</span>` : ''}</div>
        <h1>${esc(adv.title)}</h1>
        <span style="color:#fff;font-weight:600">${fmtDate(adv.date, { weekday: 'long', month: 'long', day: 'numeric' })} · ${fmtTime(toMin(adv.start))} – ${fmtTime(sch.home)}</span>
      </div>
    </div>
    ${photo?.text && photo.title ? `<p class="muted small">${esc(photo.text.slice(0, 220))}${photo.text.length > 220 ? '…' : ''}</p>` : ''}

    <div class="stats">
      <div class="stat"><span class="k">Driving</span><span class="v">${sch.routed ? fmtDur(sch.driveMin) : '—'}</span></div>
      <div class="stat"><span class="k">Distance</span><span class="v">${sch.routed ? dist(sch.km) : '—'}</span></div>
      <div class="stat"><span class="k">Est. spend</span><span class="v">${money(b.total)}</span></div>
      <div class="stat"><span class="k">${b.left >= 0 ? 'Left over' : 'Over by'}</span><span class="v" style="color:${b.left >= 0 ? 'var(--good)' : 'var(--bad)'}">${money(Math.abs(b.left))}</span></div>
    </div>
    <p class="note" style="margin-top:-10px">Spend estimate: stops ${money(b.stopsCost)}${b.fuel ? ` + fuel ${money(b.fuel)}` : ''}${b.food ? ` + ${b.meals.join(' & ')} for ${b.people} (${money(b.food)})` : ''}.</p>

    ${adv.status === 'done' ? `<section class="card"><h2>How it went</h2>${adv.rating ? stars(adv.rating) : ''}${adv.review ? `<p>${esc(adv.review)}</p>` : ''}${adv.tips ? `<p class="small muted">Tip: ${esc(adv.tips)}</p>` : ''}${!adv.rating ? `<a class="btn primary" href="#/rate/${adv.id}">Rate this adventure</a>` : ''}</section>` : ''}

    ${alerts.length ? `<div class="alerts">${alerts.map(a => `<div class="alert ${a.lv}"><span class="ic">${a.ic}</span><span>${a.t}</span></div>`).join('')}</div>` : (ui.busy[adv.id] ? '' : adv.research?.at ? `<div class="alert good"><span class="ic">✓</span><span>No problems found with this plan.</span></div>` : '')}

    <nav class="jump scroll-x" aria-label="Sections">
      ${[['plan', 'Plan'], isHikeAdv(adv) && ['trails', 'Trails'], (adv.status !== 'planned' || adv.photoCount) && ['photos', 'Photos'], ['weather', 'Weather'], ['food', 'Food'], adv.stops.some(s => ticketInfo(adv, s)) && ['tickets', 'Tickets'], (adv.research?.nearby || []).length && ['explore', 'Nearby'], adv.familyMode && state.family.kids.length && ['family', 'Family'], ['gear', 'Gear']].filter(Boolean).map(([k, l]) => `<a class="chip" href="#${k}" data-act="jump" data-to="${k}">${l}</a>`).join('')}
    </nav>
    ${timelineCard(adv)}
    ${trailsCard(adv)}
    ${adv.status !== 'planned' || adv.photoCount ? photosCard(adv, adv.status === 'done' ? '' : 'Add photos as you go. File each one under the stop where you took it.') : ''}
    ${weatherCard(adv)}
    ${foodCard(adv)}
    ${ticketsCard(adv)}
    ${nearbyCard(adv)}
    ${familyCard(adv)}
    ${gearCard(adv)}
    ${adv.notes ? `<section class="card"><h2>Notes</h2><p>${esc(adv.notes)}</p></section>` : ''}
    ${researchCard(adv)}
    <div class="sticky-cta">${cta}</div>
  </div>`;
}

// ---------- Briefing ----------
function briefing(id) {
  const adv = advById(id);
  if (!adv) return detail(id);
  const sch = schedule(adv), w = wxDay(adv), alerts = alertsFor(adv).filter(a => a.lv !== 'info'), tickets = adv.stops.filter(s => ticketInfo(adv, s));
  const h = new Date().getHours(), hi = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  const d = w?.daily;
  const wear = !d ? '' : d.temperature_2m_max[0] >= tempHot() ? 'Dress light and bring a sun hat.' : d.temperature_2m_min[0] <= tempCold() ? 'Wear warm layers. It starts cold.' : (d.precipitation_probability_max[0] ?? 0) >= 50 ? 'Bring a rain jacket.' : 'Layers will cover you all day.';
  const kids = adv.familyMode ? state.family.kids : [];
  const dayNote = daysUntil(adv.date) === 0 ? '' : `<div class="alert info"><span class="ic">📅</span><span>This briefing is for ${fmtDate(adv.date, { weekday: 'long', month: 'long', day: 'numeric' })}. You can still start now.</span></div>`;
  return `<div class="brief">
    <div class="row"><a class="icon-btn" href="#/a/${adv.id}" aria-label="Back" style="background:rgba(255,255,255,.6)">${I.back}</a></div>
    <div class="hello">
      <div class="brief-pip">${pip('happy', 'bob')}</div>
      <h1>${hi}${state.profile.name ? ', ' + esc(state.profile.name) : ''} <span class="wave">👋</span></h1>
      <p>Here's your briefing for <b>${esc(adv.title)}</b>: ${adv.stops.length} stop${adv.stops.length === 1 ? '' : 's'}${sch.routed ? `, ${fmtDur(sch.driveMin)} of driving` : ''}, back around <b>${fmtTime(sch.home)}</b>.</p>
    </div>
    ${dayNote}
    <section class="card">
      <div class="grid2">
        <div><span class="label">Leave at</span><div class="wx-temp">${fmtTime(toMin(adv.start))}</div><span class="small muted">${adv.origin ? 'from ' + esc(adv.origin.label) : ''}</span></div>
        <div><span class="label">Weather</span>${d ? `<div class="wx-temp">${wmo(d.weather_code[0])[0]} ${Math.round(d.temperature_2m_max[0])}°</div><span class="small muted">${wmo(d.weather_code[0])[1]} · ☔ ${d.precipitation_probability_max[0] ?? 0}% · sunset ${fmtTime(sunsetMin(adv))}</span>` : `<p class="small muted">${ui.busy[id] ? 'Checking…' : 'Not available yet.'}</p>`}</div>
      </div>
      ${wear ? `<p><b>What to wear:</b> ${wear}</p>` : ''}
    </section>
    ${alerts.length ? `<section class="card"><h2>Heads-up</h2><div class="alerts">${alerts.map(a => `<div class="alert ${a.lv}"><span class="ic">${a.ic}</span><span>${a.t}</span></div>`).join('')}</div></section>` : ''}
    <section class="card"><h2>Today's route</h2>
      <div class="list">${adv.stops.map((s, i) => `<div class="li" style="grid-template-columns:70px 1fr"><b class="small" style="font-variant-numeric:tabular-nums">${fmtTime(sch.rows[i].arrive)}</b><div class="main"><b>${CATS[s.cat]?.e} ${esc(s.name)}</b><span class="small muted">${fmtDur(s.dur)}${sch.rows[i].drive ? ` · ${fmtDur(sch.rows[i].drive)} drive before` : ''}</span></div></div>`).join('')}</div>
    </section>
    ${tickets.length ? `<section class="card"><h2>Tickets ready?</h2>${tickets.map(s => `<label class="check"><input type="checkbox"><span>QR code or confirmation for <b>${esc(s.name)}</b> saved offline</span></label>`).join('')}</section>` : ''}
    ${kids.length ? `<section class="card"><h2>With the kids</h2><ul style="margin:0;padding-left:18px">${[...new Set(kids.map(k => bandFor(k.age)))].map(b => `<li>${b.tips[0]}</li>`).join('')}</ul></section>` : ''}
    <section class="card"><div class="card-head"><h2>Pack check</h2><span class="muted small">${adv.packing.filter(p => p.done).length}/${adv.packing.length}</span></div>
      <div>${adv.packing.map(p => `<label class="check ${p.done ? 'done' : ''}"><input type="checkbox" data-pack="${p.id}" ${p.done ? 'checked' : ''}><span>${esc(p.text)}</span></label>`).join('')}</div>
    </section>
    <button class="btn dark block" data-act="start" style="min-height:58px;font-size:1.15rem">Let's go!</button>
  </div>`;
}

// ---------- Live mode ----------
function live(id) {
  const adv = advById(id);
  if (!adv) return detail(id);
  const sch = schedule(adv), i = adv.stops.findIndex(s => !s.done), cur = adv.stops[i];
  const done = adv.stops.filter(s => s.done).length;
  const today = daysUntil(adv.date) === 0, x = today ? wxAt(adv, nowMin()) : null;
  const planned = new Set(adv.stops.map(s => s.place?.osm).filter(Boolean));
  const food = cur?.place && adv.research?.food ? adv.research.food.filter(f => !planned.has(f.id)).map(f => ({ ...f, d: haversine(cur.place, f), score: tasteScore(f) })).filter(f => f.d < 5).sort((a, b) => b.score - a.score || a.d - b.d).slice(0, 3) : [];
  return `<div class="screen">
    <div class="topbar"><a class="icon-btn" href="#/a/${adv.id}" aria-label="Back to plan">${I.back}</a><h1 style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(adv.title)}</h1>${x ? `<span class="pill line">${wmo(x.code)[0]} ${Math.round(x.temp)}°</span>` : ''}</div>
    <div class="stack" style="gap:6px"><div class="progress"><div style="width:${adv.stops.length ? done / adv.stops.length * 100 : 0}%"></div></div><span class="small muted">${done} of ${adv.stops.length} stops done</span></div>
    ${cur ? `<div class="now-card">
        <span class="label">${done ? 'Next stop' : 'First stop'} · planned ${fmtTime(sch.rows[i].arrive)}</span>
        <h2>${CATS[cur.cat]?.e} ${esc(cur.name)}</h2>
        <span>${fmtDur(cur.dur)} here${sch.rows[i].drive ? ` · about ${fmtDur(sch.rows[i].drive)} away` : ''}</span>
        ${cur.tip ? `<span class="small">💡 ${esc(cur.tip)}</span>` : ''}
        ${cur.trail ? `<span class="small">🥾 ${esc(cur.trail.name)} · ${dist(cur.trail.km)} · ${cur.trail.diff}</span>` : ''}
        <label class="btn sm live-photo"><input type="file" accept="image/*" multiple hidden data-photo-add data-adv="${adv.id}" data-stop="${cur.id}">📷 Add photos here${(tripPhotos(adv) || []).filter(p => p.stop === cur.id).length ? ` (${(tripPhotos(adv) || []).filter(p => p.stop === cur.id).length})` : ''}</label>
        <div class="row">${cur.place ? `<a class="btn primary" style="flex:1" href="${mapsDir(cur.place)}" target="_blank" rel="noopener">Navigate ↗</a>` : ''}<button class="btn" style="flex:1" data-act="stop-done" data-sid="${cur.id}">Done here ✓</button></div>
      </div>` : `<div class="now-card"><span class="label">All stops done</span><h2>Nice work! 🎉</h2><span>Head home safe, then rate the day.</span>${adv.origin ? `<a class="btn primary" href="${mapsDir(adv.origin)}" target="_blank" rel="noopener">Navigate home ↗</a>` : ''}</div>`}
    ${food.length ? `<section class="card"><h2>Hungry?</h2><div class="list">${food.map(f => `<div class="li"><div class="ic">${f.cuisine.length ? cuisineInfo(f.cuisine[0])[1] : (AMENITY_FOOD[f.amenity] || ['', '🍽️'])[1]}</div><div class="main"><b>${esc(f.name)}</b><span class="small muted">${dist(f.d)} from ${esc(cur.name)}</span>${reviewsLink(f.name, f)}</div><a class="icon-btn" href="${mapsDir(f)}" target="_blank" rel="noopener" aria-label="Directions">↗</a></div>`).join('')}</div></section>` : ''}
    <section class="card"><h2>Stops</h2>
      ${adv.stops.map((s, j) => `<label class="check ${s.done ? 'done' : ''}"><input type="checkbox" data-act="stop-toggle" data-sid="${s.id}" ${s.done ? 'checked' : ''}><span>${esc(s.name)}<small>${fmtTime(sch.rows[j].arrive)} · ${fmtDur(s.dur)}</small></span></label>`).join('')}
    </section>
    <a class="btn dark block" href="#/rate/${adv.id}" style="min-height:52px">Finish & rate the day</a>
  </div>`;
}

// ---------- Rating ----------
function rateScreen(id) {
  const adv = advById(id);
  if (!adv) return detail(id);
  if (ui.ratingFor !== id) { ui.ratingFor = id; ui.rating = adv.rating || 0; }
  return `<div class="screen">
    <div class="topbar"><a class="icon-btn" href="#/a/${adv.id}" aria-label="Back">${I.back}</a><h1>How was it?</h1></div>
    <section class="card" style="text-align:center">
      <h2>${esc(adv.title)}</h2>
      <div class="star-input" role="radiogroup" aria-label="Rating">${[1, 2, 3, 4, 5].map(n => `<button class="${n <= ui.rating ? 'on' : ''}" data-act="star" data-n="${n}" role="radio" aria-checked="${n === ui.rating}" aria-label="${n} star${n > 1 ? 's' : ''}">★</button>`).join('')}</div>
      <span class="muted small">${['Tap to rate', 'Not great', 'It was OK', 'Good day', 'Great day', 'Perfect day!'][ui.rating]}</span>
    </section>
    <section class="card"><h2>Each stop</h2>
      <div class="list">${adv.stops.map(s => `<div class="li" data-stop="${s.id}"><div class="ic">${CATS[s.cat]?.e}</div><div class="main"><b>${esc(s.name)}</b><input type="text" data-sf-rate="tip" value="${esc(s.tip)}" placeholder="Tip for others (optional)" style="min-height:38px;margin-top:4px"></div>
        <div class="acts"><button class="icon-btn" data-act="like" data-v="1" style="${s.liked === true ? 'background:var(--good-soft)' : ''}" aria-label="Loved it">👍</button><button class="icon-btn" data-act="like" data-v="0" style="${s.liked === false ? 'background:var(--bad-soft)' : ''}" aria-label="Skip next time">👎</button></div></div>`).join('')}</div>
    </section>
    ${photosCard(adv, 'Add your pictures from the day. Put each one under the stop where you took it, so every place keeps its own album.')}
    <section class="card">
      <label class="field"><span>The highlights</span><textarea id="r-review" placeholder="What made the day?">${esc(adv.review)}</textarea></label>
      <label class="field"><span>Advice for next time</span><textarea id="r-tips" placeholder="Go early, park at…, skip…">${esc(adv.tips)}</textarea></label>
    </section>
    <section class="card">
      <h2>Share with the community</h2>
      ${Community.ready ? `<label class="check" style="border:0"><input type="checkbox" id="r-share" ${adv.example ? 'disabled' : ''}><span>Post this adventure to Explore<small>Shares the title, area, stops, tips, rating and budget. Not your home location or exact times.</small></span></label>
        <label class="field"><span>Show my name as</span><input type="text" id="r-author" value="${esc(state.profile.name)}" placeholder="First name or nickname" maxlength="40"></label>`
        : `<p class="small muted">Community sharing isn't switched on for this copy of Planerr yet. See README → “Turn on the community feed”.</p>`}
    </section>
    <button class="btn primary block" data-act="save-rating" style="min-height:54px">Save</button>
  </div>`;
}

// ---------- Explore ----------
function explore(id) {
  const all = [...(ui.community || []), ...EXAMPLE_COMMUNITY];
  if (id) {
    const a = all.find(x => String(x.id) === id);
    if (!a) return `<div class="screen"><div class="empty">${ui.loadingCommunity ? 'Loading…' : 'Adventure not found.'}<a class="btn" href="#/explore">Back to Explore</a></div></div>`;
    const stops = Array.isArray(a.stops) ? a.stops : [];
    return `<div class="screen">
      <div class="hero">${a.photo ? `<img src="${esc(a.photo)}" alt="">` : sceneSVG(a.type)}
        <div class="hero-top"><a class="icon-btn" href="#/explore" aria-label="Back">${I.back}</a><span class="spacer"></span>${a.example ? '<span class="pill example-flag">Example</span>' : ''}</div>
        <div class="hero-body"><div class="row wrap"><span class="pill">${TYPES[a.type]?.e || ''} ${TYPES[a.type]?.label || ''}</span>${a.rating ? `<span class="pill">${stars(a.rating)}</span>` : ''}</div><h1>${esc(a.title)}</h1><span style="color:#fff;font-weight:600">📍 ${esc(a.region || '')}</span></div>
      </div>
      <section class="card">
        <div class="row wrap small muted"><span>By ${esc(a.author || 'Someone')}</span>${a.budget ? `<span>· Spent about ${money(a.budget)}</span>` : ''}${a.family_ages?.length ? `<span>· With kids aged ${a.family_ages.join(', ')}</span>` : ''}</div>
        ${a.review ? `<p>${esc(a.review)}</p>` : ''}
        ${a.tips ? `<div class="alert info"><span class="ic">💡</span><span>${esc(a.tips)}</span></div>` : ''}
      </section>
      <section class="card"><h2>Their stops</h2>
        <div class="list">${stops.map(s => `<div class="li" style="grid-template-columns:44px 1fr"><div class="ic">${CATS[s.kind]?.e || '📍'}</div><div class="main"><b>${esc(s.name)}</b>${s.tip ? `<span class="small muted">${esc(s.tip)}</span>` : ''}${s.liked === false ? '<span class="pill warn">Would skip</span>' : ''}</div></div>`).join('')}</div>
      </section>
      <button class="btn primary block" data-act="copy-community" data-cid="${esc(String(a.id))}" style="min-height:54px">Plan this adventure</button>
    </div>`;
  }
  const q = ui.exploreQ.toLowerCase();
  const list = all.filter(a => (ui.exploreType === 'all' || a.type === ui.exploreType) && (!q || `${a.title} ${a.region} ${a.review}`.toLowerCase().includes(q))
    && (ui.exploreType !== 'family' || a.family_ages?.length));
  return `<div class="screen">
    <header class="greet"><span class="eyebrow">Explore</span><h1>Adventures people loved</h1></header>
    <input type="search" id="ex-q" data-explore-q placeholder="Search places, towns, ideas…" value="${esc(ui.exploreQ)}" aria-label="Search adventures">
    <div class="scroll-x">${[['all', 'All'], ['family', '👨‍👩‍👧 Family']].concat(Object.entries(TYPES).map(([k, t]) => [k, `${t.e} ${t.label}`])).map(([k, l]) => `<button class="chip ${ui.exploreType === k ? 'on' : ''}" data-act="ex-type" data-type="${k}">${l}</button>`).join('')}</div>
    ${ui.loadingCommunity ? '<span class="loading"><span class="spin"></span>Loading shared adventures…</span>' : ''}
    ${ui.communityErr ? `<div class="alert warn"><span class="ic">⚠️</span><span>${ui.communityErr}</span></div>` : ''}
    ${!Community.ready ? `<div class="alert info"><span class="ic">ℹ️</span><span>These are examples. Real adventures appear here once the community feed is switched on and people share their trips.</span></div>` : ''}
    <div class="adv-list">${list.map(a => `<a class="adv-card" href="#/explore/${encodeURIComponent(a.id)}">
      <div class="adv-thumb">${a.photo ? `<img src="${esc(a.photo)}" alt="" loading="lazy">` : sceneSVG(a.type)}</div>
      <div class="stack" style="gap:4px;min-width:0"><h3>${esc(a.title)}</h3>
        <div class="meta"><span>📍 ${esc(a.region || '')}</span></div>
        <div class="meta">${a.rating ? stars(a.rating) : ''}<span>${esc(a.author || '')}</span>${a.example ? '<span class="pill example-flag">Example</span>' : ''}${a.family_ages?.length ? '<span class="pill line">Family</span>' : ''}</div>
      </div></a>`).join('') || `<div class="empty">${pipNote('<span>Nothing matches yet.</span>', 'sleepy')}</div>`}</div>
  </div>`;
}

// ---------- Family ----------
function family() {
  const kids = state.family.kids;
  const bands = AGE_BANDS.filter(b => kids.some(k => bandFor(k.age) === b));
  const suggest = { toddler: ['park', 'beach'], little: ['park', 'beach', 'themepark'], kid: ['themepark', 'museum', 'lake'], teen: ['hike', 'city', 'themepark'] };
  return `<div class="screen">
    <header class="greet"><span class="eyebrow">Family</span><h1>Who's coming along?</h1></header>
    <section class="card">
      ${kids.length ? kids.map(k => `<div class="kid"><div class="av">${k.age <= 3 ? '🍼' : k.age <= 7 ? '🧸' : k.age <= 12 ? '⚽' : '🎧'}</div><div style="flex:1;min-width:0"><b>${esc(k.name || 'Kid')}</b><div class="small muted">${k.age} years · ${bandFor(k.age).label}</div></div><button class="icon-btn" data-act="kid-del" data-kid="${k.id}" aria-label="Remove">✕</button></div>`).join('')
        : '<p class="muted">Add your kids’ ages and Planerr will suggest attractions, ticket age tips and family packing for each adventure.</p>'}
      <form class="grid2" data-form="kid" style="grid-template-columns:1fr 90px auto;align-items:end">
        <label class="field"><span>Name</span><input type="text" name="name" placeholder="Optional"></label>
        <label class="field"><span>Age</span><input type="number" name="age" min="0" max="17" required></label>
        <button class="btn primary">Add</button>
      </form>
    </section>
    ${bands.map(b => `<section class="band" style="background:${b.color}">
      <h2 style="color:#13241F">${b.label}</h2>
      <div><span class="label" style="color:#3B4A45">Go for</span><ul>${b.picks.map(p => `<li>${p}</li>`).join('')}</ul></div>
      <div><span class="label" style="color:#3B4A45">Tips</span><ul>${b.tips.map(p => `<li>${p}</li>`).join('')}</ul></div>
      <div class="row wrap">${suggest[b.id].map(t => `<button class="btn sm" data-act="fam-plan" data-type="${t}" style="background:#fff;color:#13241F;border-color:transparent">${TYPES[t].e} Plan a ${TYPES[t].label.toLowerCase()} day</button>`).join('')}</div>
    </section>`).join('')}
    ${!kids.length ? `<section class="stack">${AGE_BANDS.map(b => `<div class="band" style="background:${b.color}"><h3>${b.label}</h3><p class="small">${b.picks.slice(0, 3).join(' · ')}</p></div>`).join('')}</section>` : ''}
  </div>`;
}

// ---------- You ----------
function you() {
  const p = state.profile;
  const done = state.adventures.filter(a => a.status === 'done' && !a.example);
  const rated = done.filter(a => a.rating);
  const avg = rated.length ? (rated.reduce((s, a) => s + a.rating, 0) / rated.length).toFixed(1) : '—';
  const km = done.reduce((s, a) => s + schedule(a).km, 0);
  const typeCount = {}; done.forEach(a => { typeCount[a.type] = (typeCount[a.type] || 0) + 1; });
  const fav = Object.entries(typeCount).sort((a, b) => b[1] - a[1])[0];
  const taste = Object.entries(p.taste).filter(([k, v]) => v > 0 && !k.startsWith('amenity:')).sort((a, b) => b[1] - a[1]).slice(0, 7);
  const max = taste[0]?.[1] || 1;
  return `<div class="screen">
    <header class="greet"><span class="eyebrow">You</span><h1>${p.name ? esc(p.name) + "'s" : 'Your'} adventures</h1></header>
    <div class="stats">
      <div class="stat"><span class="k">Done</span><span class="v">${done.length}</span></div>
      <div class="stat"><span class="k">Avg rating</span><span class="v">${avg}${rated.length ? '★' : ''}</span></div>
      <div class="stat"><span class="k">Driven</span><span class="v">${km ? dist(km) : '—'}</span></div>
      <div class="stat"><span class="k">Favorite</span><span class="v">${fav ? TYPES[fav[0]].e + ' ' + TYPES[fav[0]].label.split(' ')[0] : '—'}</span></div>
    </div>
    <section class="card">
      <label class="field"><span>Your name</span><input type="text" id="p-name" data-pf="name" value="${esc(p.name)}" placeholder="Used in your briefing"></label>
      <div class="field"><span>Units</span><div class="chips"><button class="chip ${p.units === 'imperial' ? 'on' : ''}" data-act="units" data-u="imperial">°F · miles</button><button class="chip ${p.units === 'metric' ? 'on' : ''}" data-act="units" data-u="metric">°C · km</button></div></div>
    </section>
    <section class="card">
      <h2>Your taste</h2>
      <div class="field"><span>Dietary needs</span><div class="chips">${Object.entries(DIETS).map(([k, l]) => `<button class="chip ${p.diet.includes(k) ? 'on' : ''}" data-act="diet" data-d="${k}">${l}</button>`).join('')}</div></div>
      ${taste.length ? `<div class="bars">${taste.map(([k, v]) => `<div class="bar"><span>${cuisineInfo(k)[1]} ${esc(cuisineInfo(k)[0])}</span><div class="track"><div style="width:${v / max * 100}%"></div></div><span class="n">${Math.round(v)}</span></div>`).join('')}</div>`
        : '<p class="small muted">Use 👍 and 👎 on food suggestions, and rate food stops after a trip. Planerr learns what you like and moves it to the top.</p>'}
      ${taste.length ? '<button class="btn sm ghost" data-act="taste-reset" style="justify-self:start">Reset taste profile</button>' : ''}
    </section>
    <section class="card">
      <h2>Community</h2>
      <p class="small">${Community.ready ? '✓ Connected. You can share adventures to Explore when you rate them.' : 'Not connected. Explore shows examples only. See README → “Turn on the community feed”.'}</p>
    </section>
    <section class="card">
      <h2>Your data</h2>
      <p class="small muted">Everything is saved on this device. Back it up or move it to another phone with a file.</p>
      <div class="row wrap"><button class="btn sm" data-act="export">Export backup</button><label class="btn sm">Import backup<input type="file" id="import" accept="application/json" hidden></label>${state.adventures.some(a => a.example) ? '<button class="btn sm" data-act="clear-examples">Remove examples</button>' : ''}</div>
    </section>
    <p class="note">Data: Open-Meteo, OpenStreetMap contributors, OSRM, Photon by Komoot, Wikipedia.</p>
  </div>`;
}

// ---------- events ----------
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]');
  if (!el) {
    if (!e.target.closest('.place-field')) $$('.suggest').forEach(s => { s.hidden = true; });
    return;
  }
  const act = el.dataset.act, { view, id } = parseRoute(), adv = id && advById(id), d = ui.draft;
  const stopEl = el.closest('[data-stop]');
  const keepScroll = () => { const y = window.scrollY; render(); window.scrollTo(0, y); };

  switch (act) {
    case 'jump': e.preventDefault(); document.getElementById(el.dataset.to)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return;
    // form
    case 'type': { d.type = el.dataset.type; const m = d.stops.find(s => s.main); if (m && !m._catTouched) m.cat = TYPES[d.type].cat; keepScroll(); return; }
    case 'pick': { const key = el.dataset.key, p = ui.results[key]?.[+el.dataset.i]; if (p) { applyPick(key, p); keepScroll(); } return; }
    case 'origin-clear': d.origin = null; keepScroll(); return;
    case 'locate': {
      if (!navigator.geolocation) { toast('Location isn’t available in this browser.'); return; }
      el.disabled = true; el.textContent = 'Finding you…';
      navigator.geolocation.getCurrentPosition(async pos => {
        const { latitude: lat, longitude: lon } = pos.coords;
        let here;
        try { here = await API.reverse(lat, lon); } catch (err) { here = { label: 'My location', sub: '', lat, lon, osm: null }; }
        if (el.dataset.target === 'idea') { ideaPrefs().origin = here; save(); } else d.origin = here;
        keepScroll();
      }, () => { toast('Couldn’t get your location. Type an address instead.'); el.disabled = false; el.textContent = '◎ Use my location'; }, { timeout: 10000 });
      return;
    }
    case 's-up': case 's-down': {
      const i = d.stops.findIndex(s => s.id === stopEl.dataset.stop), j = act === 's-up' ? i - 1 : i + 1;
      if (j >= 0 && j < d.stops.length) [d.stops[i], d.stops[j]] = [d.stops[j], d.stops[i]];
      keepScroll(); return;
    }
    case 's-del': d.stops = d.stops.filter(s => s.id !== stopEl.dataset.stop); keepScroll(); return;
    case 's-unplace': { const s = d.stops.find(x => x.id === stopEl.dataset.stop); s.place = null; keepScroll(); return; }
    case 's-custom': { const mi = d.stops.findIndex(s => s.main); const s = newStop({ name: '', cat: 'rest', dur: 30 }); mi >= 0 ? d.stops.splice(mi, 0, s) : d.stops.push(s); keepScroll(); return; }
    case 'save-adv': saveDraft(); return;
    case 'del-adv':
      if (!confirm(`Delete “${d.title || 'this adventure'}”? This can’t be undone.`)) return;
      state.adventures = state.adventures.filter(a => a.id !== d.id); save(); deleteTripPhotos(d.id); ui.draft = null; go(''); toast('Adventure deleted'); return;
    // detail
    case 'research': runResearch(adv); return;
    case 'food-filter': ui.foodFilter = el.dataset.f; keepScroll(); return;
    case 'food-vote': {
      const f = adv.research.food.find(x => x.id === el.dataset.fid), v = +el.dataset.v;
      state.profile.votes = state.profile.votes || {};
      state.profile.votes[f.id] = v;
      bumpTaste(f.cuisine.length ? f.cuisine : ['amenity:' + f.amenity], v);
      save(); keepScroll(); toast(v > 0 ? `Noted: more ${f.cuisine[0] ? cuisineInfo(f.cuisine[0])[0] : 'places like this'}` : 'Hidden. Planerr will show fewer like it.');
      return;
    }
    case 'food-add': {
      const f = adv.research.food.find(x => x.id === el.dataset.fid);
      const s = newStop({ name: f.name, cat: 'food', dur: f.amenity === 'cafe' || f.amenity === 'ice_cream' ? 30 : 60, cost: (f.amenity === 'restaurant' ? 22 : 12) * (adv.people + (adv.familyMode ? state.family.kids.length : 0)), place: { label: f.name, sub: f.near, lat: f.lat, lon: f.lon, osm: f.id }, cuisine: f.cuisine });
      const mi = adv.stops.findIndex(x => x === mainStop(adv));
      f.near === 'On the way' && mi >= 0 ? adv.stops.splice(mi, 0, s) : adv.stops.splice(mi >= 0 ? mi + 1 : adv.stops.length, 0, s);
      bumpTaste(f.cuisine.length ? f.cuisine : ['amenity:' + f.amenity], 2);
      adv.research.details = { ...(adv.research.details || {}), [f.id]: f.hours ? { opening_hours: f.hours } : {} };
      save(); keepScroll(); toast(`Added ${f.name} to your plan`);
      try { await updateRoute(adv); save(); keepScroll(); } catch (err) {}
      return;
    }
    case 'fam-add': {
      const sp = adv.research.family.find(x => x.id === el.dataset.sid);
      const s = newStop({ name: sp.name, cat: sp.kind === 'playground' || sp.kind === 'park' ? 'rest' : 'fun', dur: sp.kind === 'playground' ? 45 : 120, place: { label: sp.name, sub: FAMILY_OSM[sp.kind][0], lat: sp.lat, lon: sp.lon, osm: sp.id } });
      adv.stops.push(s); refreshPacking(adv); save(); keepScroll(); toast(`Added ${sp.name}`);
      try { await updateRoute(adv); adv.research.details = { ...adv.research.details, ...(await API.details([sp.id])) }; save(); keepScroll(); } catch (err) {}
      return;
    }
    case 'again': {
      const c = draftFrom(adv);
      Object.assign(c, { id: uid(), status: 'planned', rating: 0, review: '', date: nextSaturday(), research: {}, example: false, createdAt: Date.now() });
      c.stops.forEach(s => { s.id = uid(); s.done = false; s.liked = null; });
      c.packing.forEach(p => { p.done = false; });
      c._for = 'new'; ui.draft = c; ui.keepDraft = true; go('new'); return;
    }
    // briefing & live
    case 'start': adv.status = 'active'; adv.startedAt = Date.now(); save(); go('live/' + adv.id); return;
    case 'stop-done': adv.stops.find(s => s.id === el.dataset.sid).done = true; save(); render(); window.scrollTo(0, 0); return;
    case 'stop-toggle': { const s = adv.stops.find(x => x.id === el.dataset.sid); s.done = el.checked; save(); keepScroll(); return; }
    // rating
    case 'star': ui.rating = +el.dataset.n; captureRateInputs(adv); keepScroll(); return;
    case 'like': { captureRateInputs(adv); const s = adv.stops.find(x => x.id === stopEl.dataset.stop); s.liked = el.dataset.v === '1' ? (s.liked === true ? null : true) : (s.liked === false ? null : false); keepScroll(); return; }
    case 'save-rating': await saveRating(adv); return;
    // explore
    case 'ex-type': ui.exploreType = el.dataset.type; keepScroll(); return;
    case 'copy-community': {
      const a = [...(ui.community || []), ...EXAMPLE_COMMUNITY].find(x => String(x.id) === el.dataset.cid);
      const c = newAdventure({ title: a.title, type: TYPES[a.type] ? a.type : 'park', budget: a.budget || 100, notes: a.tips || '' });
      c.stops = (a.stops || []).map((s, i) => newStop({ name: s.name, cat: CATS[s.kind] ? s.kind : 'sight', tip: s.tip || '', place: s.lat != null ? { label: s.name, sub: a.region, lat: s.lat, lon: s.lon, osm: s.osm || null } : null, main: i === (a.main_index ?? 0) }));
      c._for = 'new'; ui.draft = c; ui.keepDraft = true; go('new');
      toast('Copied. Set where you’re starting from and find each stop on the map.');
      return;
    }
    // family
    case 'kid-del': state.family.kids = state.family.kids.filter(k => k.id !== el.dataset.kid); save(); keepScroll(); return;
    case 'fam-plan': { const c = newAdventure({ type: el.dataset.type, familyMode: true }); c._for = 'new'; ui.draft = c; ui.keepDraft = true; go('new'); return; }
    // you
    case 'units': state.profile.units = el.dataset.u; staleCheck(); save(); keepScroll(); return;
    case 'diet': { const k = el.dataset.d, set = new Set(state.profile.diet); set.has(k) ? set.delete(k) : set.add(k); state.profile.diet = [...set]; save(); keepScroll(); return; }
    case 'taste-reset': if (confirm('Reset your taste profile?')) { state.profile.taste = {}; state.profile.votes = {}; save(); keepScroll(); } return;
    case 'clear-examples': state.adventures = state.adventures.filter(a => !a.example); save(); keepScroll(); toast('Examples removed'); return;
    case 'export': {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `planerr-backup-${todayStr()}.json` });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      return;
    }
  }
});

function captureRateInputs(adv) {
  const r = $('#r-review'), t = $('#r-tips');
  if (r) adv.review = r.value;
  if (t) adv.tips = t.value;
  $$('[data-sf-rate]').forEach(inp => { const s = adv.stops.find(x => x.id === inp.closest('[data-stop]').dataset.stop); if (s) s.tip = inp.value; });
}

async function saveRating(adv) {
  captureRateInputs(adv);
  if (!ui.rating) { toast('Tap the stars to rate the day.'); return; }
  const first = adv.status !== 'done';
  adv.rating = ui.rating; adv.status = 'done'; adv.finishedAt = Date.now();
  if (first) adv.stops.forEach(s => { if (s.cat === 'food' && s.liked != null) bumpTaste(s.cuisine?.length ? s.cuisine : ['amenity:restaurant'], s.liked ? 2 : -2); });
  save();
  if ($('#r-share')?.checked) {
    const author = ($('#r-author')?.value || '').trim().slice(0, 40);
    if (author && !state.profile.name) state.profile.name = author;
    const main = mainStop(adv);
    const row = {
      author: author || 'Someone', title: adv.title.slice(0, 80), type: adv.type,
      region: main?.place ? [main.place.label, main.place.sub].filter(Boolean).join(', ').slice(0, 120) : '',
      trip_date: adv.date, rating: adv.rating, review: adv.review.slice(0, 2000), tips: adv.tips.slice(0, 1000),
      budget: Math.round(budget(adv).total), family_ages: adv.familyMode ? state.family.kids.map(k => k.age) : [],
      photo: adv.research?.photo?.img || null,
      stops: adv.stops.map(s => ({ name: s.name, kind: s.cat, tip: s.tip || '', liked: s.liked, lat: s.place?.lat ?? null, lon: s.place?.lon ?? null, osm: s.place?.osm ?? null })),
      main_index: Math.max(0, adv.stops.indexOf(main)),
    };
    try { await Community.share(row); ui.community = null; toast('Shared to Explore. Thanks!'); }
    catch (e) { toast('Saved, but sharing failed. Check your connection and try again from this screen.'); go('rate/' + adv.id); return; }
  } else toast('Saved. Nice adventure!');
  go('a/' + adv.id);
}

document.addEventListener('input', e => {
  const el = e.target, d = ui.draft;
  if (el.dataset.search) {
    clearTimeout(ui.timers[el.dataset.search]);
    const key = el.dataset.search, q = el.value;
    ui.timers[key] = setTimeout(() => searchPicker(key, q), 350);
    return;
  }
  if (el.dataset.df && d) {
    const k = el.dataset.df;
    d[k] = el.type === 'checkbox' ? el.checked : ['people', 'budget'].includes(k) ? num(el.value, k === 'people' ? 1 : 0) : el.value;
    return;
  }
  if (el.dataset.sf && d) {
    const s = d.stops.find(x => x.id === el.closest('[data-stop]').dataset.stop);
    const k = el.dataset.sf;
    s[k] = ['dur', 'cost'].includes(k) ? num(el.value) : el.value;
    if (k === 'cat') s._catTouched = true;
    return;
  }
  if (el.dataset.pf) { state.profile[el.dataset.pf] = el.value; save(); return; }
  if (el.hasAttribute('data-explore-q')) { ui.exploreQ = el.value; clearTimeout(ui.timers.ex); ui.timers.ex = setTimeout(() => { render(); const i = $('#ex-q'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); return; }
});

document.addEventListener('change', async e => {
  const el = e.target;
  if (el.dataset.pack) {
    const adv = advById(parseRoute().id), p = adv.packing.find(x => x.id === el.dataset.pack);
    p.done = el.checked; el.closest('.check').classList.toggle('done', p.done); save();
    return;
  }
  if (el.id === 'import' && el.files[0]) {
    try {
      const data = JSON.parse(await el.files[0].text());
      if (!Array.isArray(data.adventures)) throw new Error('Not a Planerr backup');
      const ids = new Set(state.adventures.map(a => a.id));
      data.adventures.forEach(a => { if (!ids.has(a.id)) state.adventures.push(a); });
      if (data.family?.kids?.length && !state.family.kids.length) state.family = data.family;
      save(); render(); toast(`Imported ${data.adventures.length} adventures`);
    } catch (err) { toast('That file isn’t a Planerr backup.'); }
    el.value = '';
  }
});

document.addEventListener('submit', e => {
  const f = e.target;
  if (!f.dataset.form) return;
  e.preventDefault();
  if (f.dataset.form === 'pack') {
    const adv = advById(parseRoute().id), text = f.item.value.trim();
    if (!text) return;
    adv.packing.push({ id: uid(), text, done: false }); save();
    const y = window.scrollY; render(); window.scrollTo(0, y);
    $('[data-form="pack"] input')?.focus();
  }
  if (f.dataset.form === 'kid') {
    const age = Math.round(num(f.age.value, -1));
    if (age < 0 || age > 17) { toast('Enter an age from 0 to 17.'); return; }
    state.family.kids.push({ id: uid(), name: f.name.value.trim(), age });
    state.family.kids.sort((a, b) => a.age - b.age);
    save(); render();
  }
});

// Weather is per date and unit system, so a stale research pass (older than 6 hours) refreshes when opened.
function staleCheck() {
  state.adventures.forEach(a => {
    if (a.status !== 'done' && a.research?.at && Date.now() - a.research.at > 6 * 3600e3) a.research.at = null;
    if (a.research?.weather?.units && a.research.weather.units !== state.profile.units) a.research.at = null;
  });
}
staleCheck();
// Wait for every script (ideas.js adds a screen) before the first render.
document.addEventListener('DOMContentLoaded', render);

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
