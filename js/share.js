'use strict';
// "Send to family": the plan is packed into the link itself (#/view/<data>), so there's no server.
// The link opens a read-only page on any phone; nothing is saved there unless the person taps "Save to my Planerr".
// Format: "<version><kind>.<base64url>", where kind z = deflate-raw compressed JSON, j = plain JSON. Bump SHARE_V if the shape changes.

const SHARE_V = 1;
const b64url = bytes => { let s = ''; bytes.forEach(b => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64url = str => Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const pipe = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());

// Only what the read-only view needs. Short keys keep the link short.
function sharePack(adv) {
  const sch = schedule(adv), w = wxDay(adv), r5 = n => Math.round(n * 1e5) / 1e5;
  const pt = p => p && { l: p.label, s: p.sub || '', a: r5(p.lat), o: r5(p.lon) };
  const out = { t: adv.title, y: adv.type, d: adv.date, s: adv.start, h: sch.home, n: adv.notes || '', p: adv.people, b: adv.budget };
  if (adv.origin) out.g = pt(adv.origin);
  out.k = adv.stops.map(s => ({ n: s.name, c: s.cat, u: s.dur, $: s.cost || 0, m: s.main ? 1 : 0, w: s.tip || '', p: pt(s.place) }));
  const legs = adv.research?.route;
  if (legs && sch.routed) out.r = { key: legs.key, l: legs.legs.map(x => ({ min: Math.round(x.min), km: Math.round(x.km * 10) / 10 })) };
  if (w) { const d = w.daily, [icon, label] = wmo(d.weather_code[0]); out.x = { i: icon, l: label, hi: Math.round(d.temperature_2m_max[0]), lo: Math.round(d.temperature_2m_min[0]), r: d.precipitation_probability_max[0] ?? 0, w: Math.round(d.wind_speed_10m_max[0]), u: imperial() ? 'mph' : 'km/h', at: w.place || '' }; }
  return out;
}

async function shareEncode(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  if (typeof CompressionStream === 'function') { try { return `${SHARE_V}z.${b64url(await pipe(bytes, new CompressionStream('deflate-raw')))}`; } catch (e) {} }
  return `${SHARE_V}j.${b64url(bytes)}`;
}
async function shareDecode(str) {
  const m = /^(\d+)([zj])\.([\w-]+)$/.exec(str || '');
  if (!m || +m[1] !== SHARE_V) throw new Error('bad link');
  let bytes = unb64url(m[3]);
  if (m[2] === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
  const o = JSON.parse(new TextDecoder().decode(bytes));
  if (!o || typeof o.t !== 'string' || !Array.isArray(o.k) || !/^\d{4}-\d\d-\d\d$/.test(o.d)) throw new Error('bad plan');
  return o;
}

// Turn the packed plan back into an adventure-shaped object (not saved anywhere).
function shareAdv(o) {
  const pl = p => p && { label: p.l, sub: p.s, lat: p.a, lon: p.o };
  const adv = newAdventure({ title: o.t, type: TYPES[o.y] ? o.y : 'hike', date: o.d, start: o.s, notes: o.n, people: o.p || 2, budget: o.b || 100, origin: pl(o.g) || null });
  adv.stops = o.k.map(k => newStop({ name: k.n, cat: CATS[k.c] ? k.c : 'sight', dur: k.u, cost: k.$, main: !!k.m, tip: k.w, place: pl(k.p) || null }));
  if (o.r) adv.research = { route: { key: o.r.key, legs: o.r.l } };
  return adv;
}

// ---------- the read-only screen ----------
const shareState = { src: null, obj: null, bad: false };
function viewScreen() {
  const raw = location.hash.replace(/^#\/view\//, '');
  const bad = `<div class="screen"><div class="empty">${pipNote('<span>This link looks broken. Ask them to send it again.</span>', 'wink')}<a class="btn" href="#/">Open Planerr</a></div></div>`;
  if (shareState.src !== raw) {
    shareState.src = raw; shareState.obj = null; shareState.bad = false;
    shareDecode(raw).then(o => { shareState.obj = o; }, () => { shareState.bad = true; }).then(() => { if (parseRoute().view === 'view') render(); });
  }
  if (shareState.bad) return bad;
  if (!shareState.obj) return `<div class="screen"><p class="muted">Opening the plan…</p></div>`;
  const o = shareState.obj, adv = shareAdv(o), sch = schedule(adv), x = o.x;
  const row = (time, body, home) => `<div class="t-row"><div class="t-time">${fmtTime(time)}</div><div class="t-rail"><div class="t-dot ${home ? 'home' : ''}"></div><div class="t-line"></div></div><div class="t-body">${body}</div></div>`;
  const stops = adv.stops.map((s, i) => {
    const r = sch.rows[i];
    return row(r.arrive, `${r.drive ? `<div class="t-drive">🚗 ${fmtDur(r.drive)} drive${r.km ? ' · ' + dist(r.km) : ''}</div>` : ''}<h3>${s.main ? '⭐ ' : ''}${esc(s.name)}</h3>
      <div class="row wrap small"><span class="muted">${CATS[s.cat]?.e || ''} ${fmtDur(s.dur)} · until ${fmtTime(r.depart)}</span></div>
      ${s.place ? `<div class="row wrap"><a class="pill line" href="${mapsDir(s.place)}" target="_blank" rel="noopener">Directions ↗</a></div>` : ''}
      ${s.tip ? `<p class="small muted">💡 ${esc(s.tip)}</p>` : ''}`);
  }).join('');
  return `<div class="screen">
    <div class="alert info"><span class="ic">📨</span><span>Someone shared this plan with you. It’s only a copy to look at.</span></div>
    <section class="card share-head">
      <div class="row wrap"><span class="pill coral">${fmtDate(o.d, { weekday: 'long', month: 'long', day: 'numeric' })}</span><span class="pill">${TYPES[adv.type].e} ${TYPES[adv.type].label}</span></div>
      <h1>${esc(adv.title)}</h1>
      <p class="muted">Leave ${fmtTime(toMin(adv.start))} · back about ${fmtTime(o.h)}</p>
    </section>
    <section class="card" id="plan"><h2>The plan</h2>
      ${adv.stops.length ? `<div class="timeline">
        ${adv.origin ? row(toMin(adv.start), `<h3>Leave ${esc(adv.origin.label)}</h3>`, true) : ''}
        ${stops}
        ${adv.origin ? row(o.h, `${sch.back ? `<div class="t-drive">🚗 ${fmtDur(sch.back.min)} drive · ${dist(sch.back.km)}</div>` : ''}<h3>Back home</h3>`, true) : ''}
      </div>` : '<p class="muted">No stops in this plan.</p>'}
    </section>
    ${x ? `<section class="card"><div class="card-head"><h2>Weather</h2><span class="muted small">${esc(x.at)}</span></div>
      <div class="wx"><div class="wx-big">${x.i}</div><div><div class="wx-temp">${x.hi}° <span>/ ${x.lo}°</span></div><div class="muted">${esc(x.l)} · ☔ ${x.r}% · 💨 ${x.w} ${x.u}</div></div></div>
      <p class="note">Forecast from when the plan was sent.</p></section>` : ''}
    ${adv.notes ? `<section class="card"><h2>Notes</h2><p>${esc(adv.notes)}</p></section>` : ''}
    <div class="sticky-cta"><button class="btn primary" data-act="share-save">Save to my Planerr</button></div>
  </div>`;
}

// "Share Planerr": sends the app's own link with a short note. Testing on this computer still shares the live address.
const APP_URL = 'https://tokaydesigns-wq.github.io/planerr/';
const appUrl = () => /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) ? APP_URL : new URL('./', location.href).href;
async function shareApp() {
  const url = appUrl(), text = 'I plan day trips with Planerr. It finds places, checks the weather and drive, and picks spots to eat. Free, no sign-up.';
  try {
    if (navigator.share) { await navigator.share({ title: 'Planerr', text, url }); return; }
    await navigator.clipboard.writeText(`${text} ${url}`); toast('Link copied. Paste it into a message.');
  } catch (err) { if (err.name !== 'AbortError') toast(`Couldn’t share. The link is ${url}`); }
}

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act^="share-"]');
  if (!el) return;
  if (el.dataset.act === 'share-app') { e.preventDefault(); await shareApp(); return; }
  if (el.dataset.act === 'share-save') {
    const adv = shareAdv(shareState.obj);
    adv.stops.forEach(s => { s.id = uid(); });
    state.adventures.unshift(adv); save(); go('a/' + adv.id); toast('Saved to your Planerr');
    return;
  }
  if (el.dataset.act === 'share-send') {
    const a = advById(parseRoute().id); if (!a) return;
    let url;
    try { url = `${location.origin}${location.pathname}#/view/${await shareEncode(sharePack(a))}`; } catch (err) { toast('Couldn’t make a link. Try again.'); return; }
    try {
      if (navigator.share) await navigator.share({ title: a.title, url });
      else { await navigator.clipboard.writeText(url); toast('Link copied. Paste it into a message.'); }
    } catch (err) { if (err.name !== 'AbortError') toast('Couldn’t share the link.'); }
  }
});
