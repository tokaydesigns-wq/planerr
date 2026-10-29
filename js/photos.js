'use strict';
// Trip photos people add themselves, filed under the stop where they took them so each
// attraction gets its own album. Images live on this device in IndexedDB (localStorage is far
// too small), downscaled to 1600px with a 720px copy for thumbnails and covers. Nothing is uploaded.

const PhotoDB = {
  db: null,
  open() {
    return this.db || (this.db = new Promise((ok, no) => {
      const r = indexedDB.open('planerr-photos', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('photos', { keyPath: 'id' }).createIndex('adv', 'adv');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => no(r.error);
    }));
  },
  async run(mode, fn) {
    const db = await this.open();
    return new Promise((ok, no) => {
      const t = db.transaction('photos', mode), req = fn(t.objectStore('photos'));
      t.oncomplete = () => ok(req?.result);
      t.onerror = t.onabort = () => no(t.error);
    });
  },
  put: rec => PhotoDB.run('readwrite', st => st.put(rec)),
  del: id => PhotoDB.run('readwrite', st => st.delete(id)),
  get: id => PhotoDB.run('readonly', st => st.get(id)),
  forAdv: adv => PhotoDB.run('readonly', st => st.index('adv').getAll(adv)),
};

// ui.photos[advId] = [{ id, stop, at, thumbURL }] once loaded; ui.covers[advId] = object URL.
const tripPhotos = adv => ui.photos?.[adv.id];
const photoStops = adv => [...adv.stops.map(s => ({ id: s.id, name: s.name, e: s.main ? '⭐' : CATS[s.cat]?.e || '📍' })), { id: 'other', name: 'Other moments', e: '✨' }];
const photoStopOf = (adv, p) => adv.stops.some(s => s.id === p.stop) ? p.stop : 'other';

function rerenderKeep() {
  const { view, id } = parseRoute();
  if (view === 'rate' && advById(id)) captureRateInputs(advById(id));
  const y = window.scrollY; render(); window.scrollTo(0, y);
}

async function loadTripPhotos(advId, force) {
  ui.photos = ui.photos || {}; ui.photoLoading = ui.photoLoading || new Set();
  if ((ui.photos[advId] && !force) || ui.photoLoading.has(advId)) return;
  ui.photoLoading.add(advId);
  let recs = [];
  try { recs = await PhotoDB.forAdv(advId); } catch (e) {}
  (ui.photos[advId] || []).forEach(p => URL.revokeObjectURL(p.thumbURL));
  ui.photos[advId] = recs.sort((a, b) => a.at - b.at).map(r => ({ id: r.id, stop: r.stop, at: r.at, thumbURL: URL.createObjectURL(r.thumb) }));
  ui.photoLoading.delete(advId);
  if (parseRoute().id === advId) rerenderKeep();
}

async function loadCover(adv) {
  ui.covers = ui.covers || {};
  if (ui.covers[adv.id]) { URL.revokeObjectURL(ui.covers[adv.id]); delete ui.covers[adv.id]; }
  if (!adv.cover) return;
  try { const r = await PhotoDB.get(adv.cover); if (r) ui.covers[adv.id] = URL.createObjectURL(r.thumb); } catch (e) {}
}
window.addEventListener('DOMContentLoaded', async () => {
  const withCover = state.adventures.filter(a => a.cover);
  if (!withCover.length) return;
  await Promise.all(withCover.map(loadCover));
  rerenderKeep();
});

function readImage(file) {
  return new Promise((ok, no) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); ok(img); };
    img.onerror = () => { URL.revokeObjectURL(url); no(new Error('unreadable')); };
    img.src = url;
  });
}
function shrink(img, max, quality) {
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return new Promise((ok, no) => c.toBlob(b => b ? ok(b) : no(new Error('encode')), 'image/jpeg', quality));
}

async function addTripPhotos(advId, stopId, files) {
  const adv = advById(advId);
  if (!adv || !files.length) return;
  toast(`Adding ${files.length} photo${files.length === 1 ? '' : 's'}…`);
  let added = 0, full = false;
  for (const f of files) {
    if (!/^image\//.test(f.type)) continue;
    try {
      const img = await readImage(f);
      const rec = { id: uid(), adv: advId, stop: stopId, at: f.lastModified || Date.now(), full: await shrink(img, 1600, .84), thumb: await shrink(img, 720, .8) };
      await PhotoDB.put(rec);
      if (!adv.cover) adv.cover = rec.id;
      added++;
    } catch (e) { if (e?.name === 'QuotaExceededError') { full = true; break; } }
  }
  adv.photoCount = (adv.photoCount || 0) + added;
  save();
  navigator.storage?.persist?.().catch(() => {});
  if (adv.cover && !ui.covers?.[adv.id]) await loadCover(adv);
  await loadTripPhotos(advId, true);
  const where = photoStops(adv).find(s => s.id === stopId)?.name || 'your trip';
  toast(full ? 'Your phone is out of space for more photos.' : added ? `Saved ${added} photo${added === 1 ? '' : 's'} to ${where}` : 'Those files couldn’t be opened as photos.');
}

async function deleteTripPhotos(advId) {
  try { await Promise.all((await PhotoDB.forAdv(advId)).map(r => PhotoDB.del(r.id))); } catch (e) {}
  if (ui.photos) delete ui.photos[advId];
}

const addTile = (adv, stopId, label = 'Add') => `<label class="ph add"><input type="file" accept="image/*" multiple hidden data-photo-add data-adv="${adv.id}" data-stop="${stopId}"><span>＋</span><small>${label}</small></label>`;

function photosCard(adv, intro) {
  const list = tripPhotos(adv);
  const by = id => (list || []).filter(p => photoStopOf(adv, p) === id);
  return `<section class="card" id="photos">
    <div class="card-head"><h2>Your photos</h2><span class="muted small">${list?.length ? `${list.length} photo${list.length === 1 ? '' : 's'}` : ''}</span></div>
    ${intro ? `<p class="small muted">${intro}</p>` : ''}
    ${!list ? '<span class="loading"><span class="spin"></span>Loading photos…</span>' : photoStops(adv).map(g => `
      <div class="album">
        <div class="album-head"><b>${g.e} ${esc(g.name)}</b>${by(g.id).length ? `<span class="tiny muted">${by(g.id).length}</span>` : ''}</div>
        <div class="album-grid">${by(g.id).map(p => `<button class="ph" data-act="ph-open" data-pid="${p.id}" aria-label="Open photo from ${esc(g.name)}"><img src="${p.thumbURL}" alt="" loading="lazy">${adv.cover === p.id ? '<span class="ph-cover">Cover</span>' : ''}</button>`).join('')}${addTile(adv, g.id)}</div>
      </div>`).join('')}
    <p class="note">Photos stay on this phone. They aren't uploaded anywhere, so they won't be on your other devices.</p>
  </section>`;
}

// ---------- full-screen viewer ----------
async function openViewer(advId, pid) {
  const adv = advById(advId), list = tripPhotos(adv) || [], i = list.findIndex(p => p.id === pid);
  if (i < 0) return;
  let rec;
  try { rec = await PhotoDB.get(pid); } catch (e) { return; }
  if (!rec) return;
  closeViewer();
  const url = URL.createObjectURL(rec.full), p = list[i], cur = photoStopOf(adv, p);
  const v = document.createElement('div');
  v.className = 'viewer'; v.id = 'viewer'; v.dataset.url = url; v.dataset.adv = advId; v.dataset.pid = pid;
  v.setAttribute('role', 'dialog'); v.setAttribute('aria-label', 'Photo');
  v.innerHTML = `
    <div class="v-top"><span class="pill">${i + 1} / ${list.length}</span><span class="spacer"></span><button class="icon-btn" data-act="ph-close" aria-label="Close">✕</button></div>
    <div class="v-img"><img src="${url}" alt="">
      ${i > 0 ? `<button class="car-btn prev" data-act="ph-nav" data-pid="${list[i - 1].id}" aria-label="Previous photo">‹</button>` : ''}
      ${i < list.length - 1 ? `<button class="car-btn next" data-act="ph-nav" data-pid="${list[i + 1].id}" aria-label="Next photo">›</button>` : ''}
    </div>
    <div class="v-bar">
      <label class="field"><span>Taken at</span><select data-ph-move>${photoStops(adv).map(s => `<option value="${s.id}" ${s.id === cur ? 'selected' : ''}>${s.e} ${esc(s.name)}</option>`).join('')}</select></label>
      <span class="small" style="color:#cfd8d4">${new Date(p.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
      <div class="row">
        <button class="btn sm" data-act="ph-cover" ${adv.cover === pid ? 'disabled' : ''}>${adv.cover === pid ? '★ Trip cover' : '☆ Make trip cover'}</button>
        <span class="spacer"></span>
        <button class="btn sm" data-act="ph-del" style="color:var(--bad)">Delete</button>
      </div>
    </div>`;
  document.body.appendChild(v);
  document.body.style.overflow = 'hidden';
  v.querySelector('[data-act="ph-close"]').focus();
}
function closeViewer() {
  const v = $('#viewer');
  if (!v) return;
  URL.revokeObjectURL(v.dataset.url); v.remove();
  document.body.style.overflow = '';
}

document.addEventListener('change', e => {
  const inp = e.target;
  if (inp.matches('[data-photo-add]')) { addTripPhotos(inp.dataset.adv, inp.dataset.stop, [...inp.files]); inp.value = ''; return; }
  if (inp.matches('[data-ph-move]')) {
    const v = $('#viewer'), adv = advById(v.dataset.adv), pid = v.dataset.pid;
    PhotoDB.get(pid).then(r => { r.stop = inp.value; return PhotoDB.put(r); }).then(() => {
      const p = tripPhotos(adv)?.find(x => x.id === pid);
      if (p) p.stop = inp.value;
      rerenderKeep();
      toast(`Moved to ${photoStops(adv).find(s => s.id === inp.value).name}`);
    });
  }
});

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act^="ph-"]');
  if (!el) { if (e.target.id === 'viewer') closeViewer(); return; }
  const v = $('#viewer'), advId = v?.dataset.adv || parseRoute().id, adv = advById(advId);
  switch (el.dataset.act) {
    case 'ph-open': case 'ph-nav': openViewer(advId, el.dataset.pid); return;
    case 'ph-close': closeViewer(); return;
    case 'ph-cover': adv.cover = v.dataset.pid; save(); await loadCover(adv); openViewer(advId, v.dataset.pid); rerenderKeep(); toast('Set as the trip cover'); return;
    case 'ph-del': {
      if (!confirm('Delete this photo from Planerr? This can’t be undone.')) return;
      const pid = v.dataset.pid;
      await PhotoDB.del(pid);
      adv.photoCount = Math.max(0, (adv.photoCount || 1) - 1);
      ui.photos[advId] = (ui.photos[advId] || []).filter(p => p.id !== pid);
      if (adv.cover === pid) { adv.cover = ui.photos[advId][0]?.id || null; await loadCover(adv); }
      save(); closeViewer(); rerenderKeep(); toast('Photo deleted');
    }
  }
});
document.addEventListener('keydown', e => {
  const v = $('#viewer');
  if (!v) return;
  if (e.key === 'Escape') closeViewer();
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') v.querySelector(`.car-btn.${e.key === 'ArrowLeft' ? 'prev' : 'next'}`)?.click();
});
window.addEventListener('hashchange', closeViewer);
