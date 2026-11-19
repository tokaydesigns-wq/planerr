'use strict';
// What you really spent: entries on adv.spent = [{ id, amt, cat, note, stopId, at }],
// compared with the estimate from budget(). Used on the live screen, the plan page, the recap and the share text.

const SPEND_CATS = { food: ['🍽️', 'Food'], tickets: ['🎟️', 'Tickets'], fuel: ['⛽', 'Fuel'], parking: ['🅿️', 'Parking'], shopping: ['🛍️', 'Shopping'], other: ['✨', 'Other'] };

const spentList = adv => Array.isArray(adv.spent) ? adv.spent : [];
const spentTotal = adv => spentList(adv).reduce((a, e) => a + num(e.amt), 0);

// The estimate split into the same categories as the entries. Food stops count as food, other stop costs as tickets.
function estimateByCat(adv) {
  const b = budget(adv), out = { food: b.food, tickets: 0, fuel: b.fuel, parking: 0, shopping: 0, other: 0 };
  adv.stops.forEach(s => { out[s.cat === 'food' ? 'food' : 'tickets'] += num(s.cost); });
  return out;
}
function spentByCat(adv) {
  const out = { food: 0, tickets: 0, fuel: 0, parking: 0, shopping: 0, other: 0 };
  spentList(adv).forEach(e => { out[SPEND_CATS[e.cat] ? e.cat : 'other'] += num(e.amt); });
  return out;
}

// One friendly line: how the real spend compares with the estimate.
function spendVerdict(adv) {
  const est = estimateByCat(adv), act = spentByCat(adv);
  const total = Object.values(est).reduce((a, n) => a + n, 0), real = spentTotal(adv), diff = Math.round(real) - Math.round(total);
  if (diff === 0) return 'Right on your estimate. Nicely planned!';
  if (diff < 0) return `${money(-diff)} under your estimate. Nice!`;
  const worst = Object.keys(act).sort((a, b) => (act[b] - est[b]) - (act[a] - est[a]))[0];
  return `${money(diff)} over your estimate${act[worst] - est[worst] > 0 ? `, mostly ${SPEND_CATS[worst][1].toLowerCase()}` : ''}.`;
}

// Short money amounts for plain text: $12.50 keeps its cents, $12 doesn't.
const moneyExact = n => { const c = Math.round(n * 100) / 100; return '$' + c.toLocaleString(undefined, c % 1 ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : {}); };

// Estimated vs actual: overall and per category, as simple bars.
function spendSummary(adv) {
  if (!spentList(adv).length) return '';
  const est = estimateByCat(adv), act = spentByCat(adv);
  const estTotal = Object.values(est).reduce((a, n) => a + n, 0), real = spentTotal(adv);
  const top = Math.max(1, ...Object.keys(act).map(k => Math.max(est[k], act[k])));
  const rows = Object.keys(SPEND_CATS).filter(k => est[k] >= 1 || act[k] > 0).map(k => `
    <div class="sp-row"><span class="sp-name">${SPEND_CATS[k][0]} ${SPEND_CATS[k][1]}</span><span class="sp-nums">${moneyExact(act[k])} <span class="muted">${est[k] >= 1 ? `of ~${money(est[k])}` : 'unplanned'}</span></span>
      <div class="sp-bars"><div class="sp-est" style="width:${est[k] / top * 100}%"></div><div class="sp-act ${act[k] > est[k] + 0.5 ? 'over' : ''}" style="width:${act[k] / top * 100}%"></div></div></div>`).join('');
  return `<section class="card sp-summary"><h2>Estimated vs actual</h2>
    <div class="grid2"><div><span class="label">Estimated</span><div class="wx-temp">${money(estTotal)}</div></div><div><span class="label">Actually spent</span><div class="wx-temp">${moneyExact(real)}</div></div></div>
    <p class="sp-verdict"><b>${spendVerdict(adv)}</b></p>
    <div class="sp-rows">${rows}</div>
    <p class="sp-key small muted"><span class="sp-dot est"></span> estimate <span class="sp-dot act"></span> actual</p>
  </section>`;
}

// The add / edit form, open when ui.spend matches this trip. Values live in ui.spend so a re-render keeps them.
function spendForm(adv) {
  const f = ui.spend;
  const stops = adv.stops.map(s => `<option value="${s.id}" ${f.stopId === s.id ? 'selected' : ''}>${esc(s.name || 'Stop')}</option>`).join('');
  return `<div class="sp-form" id="sp-form">
    <label class="field"><span>Amount</span><input type="text" inputmode="decimal" id="sp-amt" placeholder="0.00" autocomplete="off" value="${esc(f.amt)}"></label>
    <div class="chips" role="radiogroup" aria-label="Category">${Object.entries(SPEND_CATS).map(([k, [e, l]]) => `<button type="button" class="chip ${f.cat === k ? 'on' : ''}" role="radio" aria-checked="${f.cat === k}" data-act="sp-cat" data-cat="${k}">${e} ${l}</button>`).join('')}</div>
    <label class="field"><span>Note (optional)</span><input type="text" id="sp-note" maxlength="80" placeholder="Lunch at the boardwalk" value="${esc(f.note)}"></label>
    ${adv.stops.length ? `<label class="field"><span>Which stop? (optional)</span><select id="sp-stop"><option value="">Not tied to a stop</option>${stops}</select></label>` : ''}
    <div class="row"><button class="btn primary" style="flex:1" data-act="sp-save">${f.id ? 'Save changes' : 'Add spend'}</button><button class="btn" data-act="sp-cancel">Cancel</button></div>
  </div>`;
}

// The spending card: running total, entries and the add form.
function spendCard(adv) {
  const list = spentList(adv), est = Math.round(budget(adv).total), open = ui.spend?.advId === adv.id;
  const stopName = id => adv.stops.find(s => s.id === id)?.name;
  return `<section class="card" id="spend">
    <div class="card-head"><h2>What you spent</h2>${open ? '' : '<button class="btn sm" data-act="sp-new">＋ Add spend</button>'}</div>
    <p class="sp-total"><b>${moneyExact(spentTotal(adv))}</b> spent of ~${money(est)} estimated</p>
    ${open ? spendForm(adv) : ''}
    ${list.length ? `<div class="list">${list.map(e => `<div class="li" style="grid-template-columns:44px 1fr auto"><div class="ic">${SPEND_CATS[e.cat]?.[0] || '✨'}</div><div class="main"><b>${moneyExact(num(e.amt))} · ${SPEND_CATS[e.cat]?.[1] || 'Other'}</b><span class="small muted">${esc([e.note, stopName(e.stopId)].filter(Boolean).join(' · ')) || '&nbsp;'}</span></div>
        <div class="acts"><button class="icon-btn" data-act="sp-edit" data-eid="${e.id}" aria-label="Edit">✎</button><button class="icon-btn" data-act="sp-del" data-eid="${e.id}" aria-label="Delete" style="color:var(--bad)">🗑</button></div></div>`).join('')}</div>`
      : open ? '' : '<p class="small muted">Nothing logged yet. Tap “Add spend” whenever you pay for something.</p>'}
  </section>`;
}

// Plain-text lines for the shared recap.
function spendText(adv) {
  if (!spentList(adv).length) return [];
  const act = spentByCat(adv);
  const parts = Object.keys(SPEND_CATS).filter(k => act[k] > 0).map(k => `${SPEND_CATS[k][1].toLowerCase()} ${moneyExact(act[k])}`);
  return [`Spent ${moneyExact(spentTotal(adv))} (estimated ${money(budget(adv).total)}): ${parts.join(', ')}. ${spendVerdict(adv)}`];
}

// Copy what's typed into ui.spend so a re-render (picking a category) doesn't lose it.
function captureSpend() {
  if (!ui.spend || !$('#sp-amt')) return;
  ui.spend.amt = $('#sp-amt').value; ui.spend.note = $('#sp-note').value; ui.spend.stopId = $('#sp-stop')?.value || '';
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act^="sp-"]');
  if (!el) return;
  const { id } = parseRoute(), adv = id && advById(id);
  if (!adv) return;
  const redraw = () => rerenderKeep();
  const act = el.dataset.act;
  if (act === 'sp-new') {
    const cur = adv.stops.find(s => !s.done);
    ui.spend = { advId: adv.id, id: null, amt: '', cat: 'food', note: '', stopId: cur?.id || '' };
    redraw(); $('#sp-amt')?.focus();
  } else if (act === 'sp-edit') {
    const x = spentList(adv).find(s => s.id === el.dataset.eid); if (!x) return;
    ui.spend = { advId: adv.id, id: x.id, amt: String(x.amt), cat: x.cat, note: x.note || '', stopId: x.stopId || '' };
    redraw(); $('#spend')?.scrollIntoView({ block: 'center' });
  } else if (act === 'sp-cat') {
    captureSpend(); ui.spend.cat = el.dataset.cat; redraw();
  } else if (act === 'sp-cancel') {
    ui.spend = null; redraw();
  } else if (act === 'sp-del') {
    if (!confirm('Delete this spend entry?')) return;
    adv.spent = spentList(adv).filter(s => s.id !== el.dataset.eid);
    if (ui.spend?.id === el.dataset.eid) ui.spend = null;
    save(); redraw(); toast('Deleted');
  } else if (act === 'sp-save') {
    captureSpend();
    const amt = Math.round(num(String(ui.spend.amt).replace(',', '.')) * 100) / 100;
    if (!amt) { toast('Type how much you spent.'); $('#sp-amt')?.focus(); return; }
    const entry = { amt, cat: ui.spend.cat, note: ui.spend.note.trim(), stopId: ui.spend.stopId || '' };
    adv.spent = spentList(adv);
    if (ui.spend.id) Object.assign(adv.spent.find(s => s.id === ui.spend.id) || {}, entry);
    else adv.spent.push({ id: uid(), ...entry, at: Date.now() });
    ui.spend = null; save(); redraw(); toast('Saved');
  }
});
