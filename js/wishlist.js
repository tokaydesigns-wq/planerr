// ---------- Want to go: places saved for later from Trip ideas and Explore ----------
// Each saved item keeps a small copy of the trip (title, type, stops), so it still works
// after the trip ideas or the Explore feed have changed. "Plan it" opens a new plan from it.

// Trip ideas change every time, so an idea is known by its main stop's name.
function ideaWish(plan) {
  const a = plan.adv, main = a.stops.find(s => s.main) || a.stops[0];
  return {
    key: 'idea:' + (main?.name || a.title).toLowerCase(), kind: 'idea', title: a.title, type: a.type,
    where: main?.place?.sub || main?.place?.label || '', photo: a.research.photo?.img || '', budget: a.budget, origin: a.origin, tips: '',
    stops: a.stops.map(s => ({ name: s.name, cat: s.cat, dur: s.dur, cost: s.cost, place: s.place, main: !!s.main, tip: s.tip || '', cuisine: s.cuisine })),
  };
}
function postWish(a) {
  return {
    key: 'post:' + a.id, kind: 'post', title: a.title, type: TYPES[a.type] ? a.type : 'park',
    where: a.region || '', photo: a.photo || '', budget: a.budget || 100, origin: null, tips: a.tips || '',
    stops: (Array.isArray(a.stops) ? a.stops : []).map((s, i) => ({ name: s.name, cat: CATS[s.kind] ? s.kind : 'sight', tip: s.tip || '', main: i === (a.main_index ?? 0),
      place: s.lat != null ? { label: s.name, sub: a.region, lat: s.lat, lon: s.lon, osm: s.osm || null } : null })),
  };
}
const isWished = key => state.wishlist.some(w => w.key === key);
function toggleWish(item) {
  if (isWished(item.key)) { state.wishlist = state.wishlist.filter(w => w.key !== item.key); save(); toast('Removed from Want to go'); return; }
  state.wishlist.unshift({ ...item, savedAt: Date.now() }); save(); toast('Saved to Want to go on Home');
}

// The heart button used on idea cards, the idea page and Explore posts.
function wishBtn(key, act, data, big) {
  const on = isWished(key), label = on ? 'Saved to Want to go' : 'Save to Want to go';
  return big
    ? `<button class="btn block" data-act="${act}" ${data} aria-pressed="${on}">${on ? '❤️ Saved to Want to go' : '🤍 Save for later'}</button>`
    : `<button class="icon-btn wish-btn" data-act="${act}" ${data} aria-pressed="${on}" aria-label="${label}" title="${label}">${on ? '❤️' : '🤍'}</button>`;
}

// Home section. Shows nothing until something is saved.
function wishlistHome() {
  if (!state.wishlist.length) return '';
  return `<section class="stack">
    <div class="section-title"><h2>Want to go</h2><span class="muted small">${state.wishlist.length}</span></div>
    <div class="adv-list">${state.wishlist.map(w => `<div class="adv-card wish-card">
      <div class="adv-thumb">${w.photo ? `<img src="${esc(w.photo)}" alt="" loading="lazy">` : sceneSVG(w.type)}</div>
      <div class="stack" style="gap:6px;min-width:0"><h3>${esc(w.title)}</h3>
        <div class="meta"><span>${TYPES[w.type]?.e || ''} ${TYPES[w.type]?.label || ''}</span>${w.where ? `<span>📍 ${esc(w.where)}</span>` : ''}</div>
        <div class="row"><button class="btn sm primary" data-act="wish-plan" data-key="${esc(w.key)}">Plan it</button><button class="btn sm ghost" data-act="wish-remove" data-key="${esc(w.key)}" aria-label="Remove ${esc(w.title)} from Want to go">Remove</button></div>
      </div></div>`).join('')}</div>
  </section>`;
}

// Opens the plan form filled in from a saved item; the person picks the date and saves.
function planFromWish(w) {
  const c = newAdventure({ title: w.title, type: TYPES[w.type] ? w.type : 'park', budget: w.budget || 100, origin: w.origin || null, notes: w.tips || '' });
  c.stops = w.stops.map(s => newStop(JSON.parse(JSON.stringify(s))));
  c._for = 'new'; ui.draft = c; ui.keepDraft = true; go('new');
  toast(w.origin ? 'Pick a date, then save the plan.' : 'Pick a date and where you’re starting from, then save.');
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act^="wish-"]');
  if (!el) return;
  const y = window.scrollY, rerender = () => { render(); window.scrollTo(0, y); };
  switch (el.dataset.act) {
    case 'wish-idea': { restoreIdeas(); const p = ui.ideas?.plans?.[+el.dataset.i]; if (p) { toggleWish(ideaWish(p)); rerender(); } return; }
    case 'wish-post': {
      const a = [...(ui.community || []), ...EXAMPLE_COMMUNITY].find(x => String(x.id) === el.dataset.cid);
      if (a) { toggleWish(postWish(a)); rerender(); }
      return;
    }
    case 'wish-plan': { const w = state.wishlist.find(x => x.key === el.dataset.key); if (w) planFromWish(w); return; }
    case 'wish-remove': state.wishlist = state.wishlist.filter(x => x.key !== el.dataset.key); save(); rerender(); toast('Removed from Want to go'); return;
  }
});
