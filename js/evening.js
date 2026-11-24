// ---------- Evening before: a short "ready for tomorrow?" checklist on Home ----------
// Shows the whole day before a planned trip. Nothing is sent anywhere; it's built from the plan's own research.

// The first real (not example) trip planned for tomorrow, if any.
const eveningTrip = () => state.adventures.find(a => a.status === 'planned' && !a.example && daysUntil(a.date) === 1);

// One line of clothing advice from the day's forecast. Also used by the morning briefing.
function wearAdvice(d) {
  if (!d) return '';
  return d.temperature_2m_max[0] >= tempHot() ? 'Dress light and bring a sun hat.'
    : d.temperature_2m_min[0] <= tempCold() ? 'Wear warm layers. It starts cold.'
    : (d.precipitation_probability_max[0] ?? 0) >= 50 ? 'Bring a rain jacket.' : 'Layers will cover you all day.';
}

function eveningCard() {
  const adv = eveningTrip();
  if (!adv) return '';
  const sch = schedule(adv), d = wxDay(adv)?.daily, leave = toMin(adv.start);
  const packed = adv.packing.filter(p => p.done).length, total = adv.packing.length;
  const tickets = adv.stops.filter(s => ticketInfo(adv, s));
  const warn = alertsFor(adv).filter(a => a.lv === 'bad' || a.lv === 'warn');
  const rows = [
    [d ? wmo(d.weather_code[0])[0] : '🌤️', d ? `<b>${Math.round(d.temperature_2m_max[0])}°</b>, ${wmo(d.weather_code[0])[1].toLowerCase()}, ${d.precipitation_probability_max[0] ?? 0}% chance of rain. ${wearAdvice(d)}`
      : ui.busy[adv.id] ? 'Checking tomorrow’s forecast…' : 'The forecast isn’t available yet.'],
    ['⏰', `Leave at <b>${fmtTime(leave)}</b>${adv.origin ? ` from ${esc(adv.origin.label)}` : ''}. Set an alarm for about <b>${fmtTime(leave - 60)}</b>.`],
    total ? ['🎒', packed === total ? `All ${total} things packed. ✓` : `<b>${packed} of ${total}</b> things packed so far.`] : null,
    tickets.length ? ['🎟️', `Buy or save tickets tonight for <b>${tickets.map(s => esc(s.name)).join(', ')}</b>.`] : null,
    // Alert links jump within the plan page, so on Home they become plain bold text (See plan goes there).
    warn.length ? ['⚠️', `${warn.length === 1 ? 'One thing' : `${warn.length} things`} to check: ${warn[0].t.replace(/<a [^>]*>(.*?)<\/a>/g, '<b>$1</b>')}`] : null,
    sch.driveMin >= 120 ? ['⛽', `About ${fmtDur(sch.driveMin)} of driving. Fill up tonight to save time in the morning.`] : null,
    ['🔋', 'Charge your phone. Your plan works offline, so it’s there even without signal.'],
  ].filter(Boolean);
  return `<section class="card evening">
    <div><h2>🌙 Ready for tomorrow?</h2><p class="small muted evening-trip">${esc(adv.title)}</p></div>
    <div class="list">${rows.map(([ic, t]) => `<div class="li" style="grid-template-columns:44px 1fr"><div class="ic" aria-hidden="true">${ic}</div><span>${t}</span></div>`).join('')}</div>
    <div class="row"><a class="btn primary" style="flex:1" href="#/brief/${adv.id}">Pack & check</a><a class="btn" style="flex:1" href="#/a/${adv.id}">See plan</a></div>
  </section>`;
}
