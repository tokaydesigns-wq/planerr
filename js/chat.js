'use strict';
// "Tell Pip" chat: people describe their day in their own words, Pip pulls out the trip
// settings (kinds of day, drive, date, times, group, food, budget, start) and fills in
// the trip-ideas form, then builds the 3 plans. It reads keywords; no AI service is used.

const CHAT_TYPES = {
  hike: /\b(hik(e|es|ing)|trails?|trek|mountains?|summit|peaks?|waterfalls?|woods|forest|backpack)/,
  beach: /\b(beach(es)?|ocean|sea|surf(ing)?|coast(al)?|sand|shore)\b/,
  lake: /\b(lakes?|rivers?|kayak(ing)?|canoe(ing)?|paddl(e|ing)|fishing|swim(ming)?|tubing)\b/,
  park: /\b(parks?|nature|picnic|gardens?|wildlife|outdoors?|scenic|views?|sunset|birds?)\b/,
  city: /\b(city|downtown|shopping|urban|nightlife|explore (a )?town|old town)\b/,
  themepark: /\b(theme ?parks?|amusement|rides|roller ?coasters?|water ?parks?|six flags)\b/,
  museum: /\b(museums?|art|history|historic|culture|cultural|galler(y|ies)|science|zoo|aquarium)\b/,
  food: /\b(foodie|food (trip|tour)|eat (our|my) way|brewer(y|ies)|winer(y|ies)|wine|tasting)\b/,
  roadtrip: /\b(road ?trip|scenic drive|cruis(e|ing)|drive around|back ?roads)\b/,
  snow: /\b(snow|ski(ing)?|snowboard(ing)?|sledding|sled)\b/,
};
const CHAT_MOODS = [[/\b(chill|relax(ing|ed)?|easy|lazy|calm|peaceful)\b/, ['park', 'lake']], [/\b(adventur(e|ous)|thrill(ing)?|exciting|active|epic)\b/, ['hike', 'themepark']], [/\b(romantic|date)\b/, ['city', 'park']], [/\b(rain(y)?|indoors?)\b/, ['museum', 'city']]];
const CHAT_FOOD = { pizza: /\bpizza/, mexican: /\b(mexican|tacos?|burritos?|tex-?mex)/, italian: /\b(italian|pasta)/, burger: /\bburgers?/, japanese: /\b(japanese|sushi|ramen)/, thai: /\bthai\b/, chinese: /\b(chinese|dim sum)/, indian: /\b(indian|curry)/, korean: /\bkorean/, vietnamese: /\b(vietnamese|pho|banh mi)/, seafood: /\b(seafood|fish|crab|oysters?|lobster)/, bbq: /\b(bbq|barbecue|barbeque|smokehouse)/, mediterranean: /\b(mediterranean|greek|falafel|gyros?)/, american: /\b(american|diner|wings)/, bakery: /\b(bakery|bakeries|pastr(y|ies)|donuts?)/, coffee_shop: /\b(coffee|cafe|café|latte)/, ice_cream: /\b(ice cream|gelato|frozen yogurt)/ };
const CHAT_DIETS = { vegetarian: /\bvegetarian/, vegan: /\bvegan/, gluten_free: /\b(gluten[- ]free|celiac|coeliac)/, halal: /\bhalal/, kosher: /\bkosher/ };
const WORD_NUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, couple: 2, 'a couple': 2, 'a couple of': 2, few: 3, 'a few': 3 };
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const CHAT_EXAMPLES = [
  'Easy hike with the kids this Saturday, under an hour away, tacos after',
  'Romantic beach day for two, leave at 9, back by 7, budget $150',
  'Rainy day plan: museums and good ramen, about 45 minutes from home',
];

const nearestDrive = m => DRIVE_STEPS.reduce((a, b) => Math.abs(b - m) < Math.abs(a - m) ? b : a);
const wordNum = w => /^\d/.test(w) ? parseFloat(w) : WORD_NUM[w.trim()] ?? null;
function clock(h, m, ap, kind) {
  h = +h; m = +(m || 0);
  if (h > 23 || m > 59) return null;
  ap = (ap || '').replace(/\./g, '');
  if (ap === 'pm' && h < 12) h += 12;
  else if (ap === 'am' && h === 12) h = 0;
  else if (!ap && kind === 'end' && h >= 1 && h <= 11) h += 12;
  else if (!ap && kind === 'start' && h >= 1 && h <= 5) h += 12;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Reads one message and returns only what it mentions.
function parseTrip(raw) {
  const t = raw.toLowerCase().replace(/[’']/g, "'"), out = {};

  const types = Object.keys(CHAT_TYPES).filter(k => CHAT_TYPES[k].test(t));
  if (!types.length) CHAT_MOODS.forEach(([re, ks]) => { if (re.test(t)) ks.forEach(k => types.includes(k) || types.push(k)); });
  if (types.length) out.types = types;

  // Drive time only counts next to a driving word, so "hike for 3 hours" isn't read as the drive.
  const dur = String.raw`(\d+(?:\.\d+)?|an?|half an|one|two|three|four|five|a couple(?: of)?|a few)\s*(hours?|hrs?|h|minutes?|mins?)\b( and a half)?`;
  const dm = t.match(new RegExp(String.raw`(?:within|under|less than|no more than|up to|max(?:imum)?|about|around|like)?\s*${dur}\s*(?:away|drive|of driving|driving|in the car|each way|from (?:home|here|me|us))`))
    || t.match(new RegExp(String.raw`(?:drive|driving)\s*(?:time\s*)?(?:of|for|is|about|around|under|up to|max|no more than|less than)?\s*${dur}`))
    || t.match(new RegExp(String.raw`within\s*${dur}`));
  if (dm) {
    const n = dm[1] === 'half an' ? .5 : wordNum(dm[1]);
    if (n != null) out.maxDrive = nearestDrive(/^h/.test(dm[2]) ? (n + (dm[3] ? .5 : 0)) * 60 : n);
  } else if (/\b(close by|nearby|not (too |that |very )?far|nothing (too )?far|close to home|local|near (me|home|here))\b/.test(t)) out.maxDrive = 45;
  else if (/\b(far away|long drive|anywhere|don't mind driving)\b/.test(t)) out.maxDrive = 180;

  const now = new Date(), shift = n => { const d = new Date(now); d.setDate(d.getDate() + n); return localISO(d); };
  const day = t.match(/\b(next )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (/\btoday\b|\bthis (morning|afternoon)\b/.test(t)) out.date = todayStr();
  else if (/\btomorrow\b/.test(t)) out.date = shift(1);
  else if (day) { let n = (DAYS.indexOf(day[2]) - now.getDay() + 7) % 7; if (day[1] && n < 7) n += n === 0 ? 7 : 0; out.date = shift(n); }
  else if (/\b(this )?weekend\b/.test(t)) out.date = nextSaturday();
  else {
    const md = t.match(/\b(\d{1,2})\/(\d{1,2})\b/);
    if (md) { const d = new Date(now.getFullYear(), +md[1] - 1, +md[2]); if (d < now && localISO(d) !== todayStr()) d.setFullYear(d.getFullYear() + 1); if (!isNaN(d)) out.date = localISO(d); }
  }

  const tm = String.raw`(\d{1,2})(?::(\d\d))?\s*(am|pm|a\.m\.|p\.m\.)?(?!\s*(?:hours?|hrs?|h\b|min|people|adults|kids|year|\$|dollars|bucks))`;
  const sm = t.match(new RegExp(String.raw`\b(?:leave|leaving|start|starting|head(?:ing)? out|depart|get going|go)\s*(?:at|around|about|by)?\s*${tm}`));
  const em = t.match(new RegExp(String.raw`\b(?:back|home|return(?:ing)?|done|finish(?:ed)?|until|till)\s*(?:home\s*)?(?:by|at|around|before|about)?\s*${tm}`));
  const rm = t.match(/\b(\d{1,2})(?::(\d\d))?\s*(am|pm)?\s*(?:-|to|until|till)\s*(\d{1,2})(?::(\d\d))?\s*(am|pm)\b/);
  if (sm) out.start = clock(sm[1], sm[2], sm[3], 'start');
  if (em) out.end = clock(em[1], em[2], em[3], 'end');
  if (rm && !sm && !em) { out.start = clock(rm[1], rm[2], rm[3] || (+rm[1] < +rm[4] ? rm[6] : 'am'), 'start'); out.end = clock(rm[4], rm[5], rm[6], 'end'); }
  if (!out.start && /\b(early|sunrise|first thing)\b/.test(t)) out.start = '07:00';
  if (!out.start && /\b(afternoon)\b/.test(t) && !/\bmorning\b/.test(t)) { out.start = '12:00'; out.end = out.end || '19:00'; }
  if (!out.end && /\b(all day|full day|whole day)\b/.test(t)) out.end = '20:00';
  if (!out.end && /\b(half day|quick|short)\b/.test(t)) out.end = clock(+(out.start || '08:00').slice(0, 2) + 5, 0, '', 'x');
  ['start', 'end'].forEach(k => { if (!out[k]) delete out[k]; });

  const pm = t.match(/\b(\d+|two|three|four|five|six|seven|eight|nine|ten)\s*(?:people|adults|of us|persons|grown-?ups)\b/);
  const fm = t.match(/\bme and (?:my )?(\d+|two|three|four|five|six)\s*(?:friends|buddies|pals)\b/);
  if (pm) out.people = wordNum(pm[1]);
  else if (fm) out.people = wordNum(fm[1]) + 1;
  else if (/\b(just me|by myself|solo|alone|on my own)\b/.test(t)) out.people = 1;
  else if (/\b(my (wife|husband|partner|girlfriend|boyfriend|fianc[eé]e?|spouse)|the two of us|both of us|couple|date|for two)\b/.test(t)) out.people = 2;
  else if (/\b(me and (?:my )?(?:friend|buddy|bestie|mom|dad|sister|brother))\b/.test(t)) out.people = 2;

  if (/\b(no kids|without (the )?kids|adults only|kid-free)\b/.test(t)) out.familyMode = false;
  else if (/\b(kids?|children|child|toddlers?|bab(y|ies)|my (son|daughter)|family|little ones)\b/.test(t)) out.familyMode = true;

  const bm = t.match(/\$\s?(\d[\d,]*)/) || t.match(/\b(\d[\d,]*)\s*(?:dollars|bucks|usd)\b/) || t.match(/\bbudget\s*(?:of|is|around|about|under)?\s*(\d[\d,]*)/);
  if (bm) out.budget = +bm[1].replace(/,/g, '');
  else if (/\b(free|cheap|on a budget|low budget|broke|inexpensive)\b/.test(t)) out.budget = 50;
  else if (/\b(splurge|fancy|treat (ourselves|myself)|no budget|money's no object)\b/.test(t)) out.budget = 300;

  const likes = Object.keys(CHAT_FOOD).filter(k => CHAT_FOOD[k].test(t));
  if (likes.length) out.likes = likes;
  const diet = Object.keys(CHAT_DIETS).filter(k => CHAT_DIETS[k].test(t));
  if (diet.length) out.diet = diet;

  const om = raw.match(/\b(?:from|starting (?:in|from|at|out of)|leaving from|i live in|i'm in|im in|based in|we're in|we are in|out of)\s+([A-Za-z][A-Za-z .'-]{1,40}?)(?=\s*(?:[,.!?;]|$|\b(?:and|with|for|to|on|this|next|tomorrow|today|under|within|about|around|i|we|leave|leaving|back)\b))/i);
  if (om && !/^(home|here|my house|me|us|the house|work)$/i.test(om[1].trim())) out.originText = om[1].trim();

  return out;
}

const chatState = () => state.chat || (state.chat = { msgs: [{ from: 'pip', html: `Hi, I'm <b>Pip</b>! 🚐 Tell me about the day you're dreaming of: what you want to do, how far you'll drive, when, who's coming, what you like to eat and your budget. Say it however you like.` }], heard: false });

// Pip's summary of everything set so far, including defaults it filled in.
function chatSummary(got) {
  const p = ideaPrefs(), likes = state.profile.likes || [];
  const mark = k => got[k] != null ? '' : ' <span class="tiny muted">(default)</span>';
  const kidsN = state.family.kids.length;
  const rows = [
    ['🧭', 'Kinds of day', p.types.map(k => `${TYPES[k].e} ${TYPES[k].label}`).join(', ') + mark('types')],
    ['🚗', 'Drive', `up to ${fmtDur(p.maxDrive)} each way${mark('maxDrive')}`],
    ['📅', 'When', `${fmtDate(p.date, { weekday: 'long', month: 'short', day: 'numeric' })}, ${fmtTime(toMin(p.start))} to ${fmtTime(toMin(p.end))}${got.date || got.start || got.end ? '' : mark('x')}`],
    ['👥', 'Who', `${p.people} adult${p.people === 1 ? '' : 's'}${p.familyMode ? ` + ${kidsN ? `${kidsN} kid${kidsN === 1 ? '' : 's'}` : 'kids'}` : ''}${mark('people')}`],
    ['💵', 'Budget', `${money(p.budget)}${mark('budget')}`],
    likes.length && ['🍽️', 'Food', likes.map(c => cuisineInfo(c)[1] + ' ' + cuisineInfo(c)[0]).join(', ')],
    state.profile.diet.length && ['🥗', 'Diet', state.profile.diet.map(d => DIETS[d]).join(', ')],
    p.origin && ['📍', 'Starting from', esc(p.origin.label)],
  ].filter(Boolean);
  return `<div class="chat-sum">${rows.map(([e, k, v]) => `<div><span>${e}</span><span class="small"><b>${k}:</b> ${v}</span></div>`).join('')}</div>`;
}

async function chatSend(text) {
  text = text.trim();
  if (!text) return;
  const c = chatState(), p = ideaPrefs();
  c.msgs.push({ from: 'me', html: esc(text) });
  ui.chatTyping = true; renderChat();

  const got = parseTrip(text);
  Object.assign(c.got = c.got || {}, got);
  ['types', 'maxDrive', 'date', 'start', 'end', 'people', 'budget', 'familyMode'].forEach(k => { if (got[k] != null) p[k] = got[k]; });
  if (toMin(p.end) - toMin(p.start) < 180) p.end = clock(Math.min(23, +p.start.slice(0, 2) + 8), p.start.slice(3), '', 'x');
  if (got.likes) state.profile.likes = [...new Set([...(state.profile.likes || []), ...got.likes])];
  if (got.diet) state.profile.diet = [...new Set([...state.profile.diet, ...got.diet])];
  let originNote = '';
  if (got.originText) {
    try {
      const hit = (await API.searchPlaces(got.originText, p.origin))[0];
      if (hit) p.origin = hit; else originNote = `I couldn't find “${esc(got.originText)}” on the map. `;
    } catch (e) { originNote = 'I couldn’t look up that town just now. '; }
  }
  save();
  await new Promise(r => setTimeout(r, 450));

  const understood = Object.keys(got).filter(k => k !== 'originText').length + (got.originText && !originNote ? 1 : 0);
  let html;
  if (!understood) {
    html = `Hmm, I didn't catch anything I can plan with yet. Try words like <b>hike</b>, <b>beach</b>, <b>museum</b>, <b>an hour away</b>, <b>Saturday</b>, <b>with the kids</b>, <b>tacos</b> or <b>$100</b>.`;
  } else {
    const cheer = ['Ooh, sounds like a great day!', 'Love it!', 'Got it!', 'Nice, I can work with that!'][c.msgs.length % 4];
    html = `${cheer} Here's the plan so far:${chatSummary(c.got)}`;
    if (got.familyMode && !state.family.kids.length) html += `<p class="small">Add your kids' ages in <a href="#/family">Family</a> and I'll pick spots that suit them.</p>`;
    html += p.origin ? `<p>${originNote}Tell me anything else you want to change, or I'll build 3 plans now.</p>` : `<p>${originNote}Last thing: <b>where are you starting from?</b></p>`;
  }
  c.msgs.push({ from: 'pip', html });
  c.heard = c.heard || !!understood;
  save();
  ui.chatTyping = false;
  if (parseRoute().view === 'chat') render();
}

function renderChat() { if (parseRoute().view === 'chat') render(); }

function chatScreen() {
  const c = chatState(), p = ideaPrefs();
  const needOrigin = c.heard && !p.origin;
  return `<div class="screen chat-screen">
    <div class="topbar"><a class="icon-btn" href="#/" aria-label="Back">${I.back}</a><h1 style="flex:1">Plan with Pip</h1>${c.msgs.length > 1 ? '<button class="btn sm ghost" data-act="chat-reset">Start over</button>' : ''}</div>
    <div class="chat" id="chat-log" aria-live="polite">
      ${c.msgs.map(m => m.from === 'pip'
        ? `<div class="msg pip-msg"><div class="av">${pip('happy')}</div><div class="bub">${m.html}</div></div>`
        : `<div class="msg me-msg"><div class="bub">${m.html}</div></div>`).join('')}
      ${ui.chatTyping ? `<div class="msg pip-msg"><div class="av">${pip('happy', 'bob')}</div><div class="bub typing"><i></i><i></i><i></i></div></div>` : ''}
      ${!c.heard && !ui.chatTyping ? `<div class="chips chat-examples">${CHAT_EXAMPLES.map(x => `<button class="chip" data-act="chat-example" data-t="${esc(x)}">${esc(x)}</button>`).join('')}</div>` : ''}
      ${needOrigin && !ui.chatTyping ? `<div class="card chat-origin">${pickerHTML('idea-origin', 'Home address or town', '')}<button class="btn sm ghost" data-act="locate" data-target="idea" style="justify-self:start">◎ Use my location</button></div>` : ''}
      ${c.heard && p.origin && !ui.chatTyping ? `<button class="btn primary block chat-go" data-act="chat-build" style="min-height:54px;font-size:1.05rem">✨ Build my 3 plans</button>` : ''}
    </div>
    <form class="composer" data-chat-form>
      <textarea id="chat-in" rows="1" placeholder="${c.heard ? 'Change anything…' : 'Describe your perfect day…'}" aria-label="Message Pip" enterkeyhint="send"></textarea>
      <button class="send" type="submit" aria-label="Send">${svgIcon('<path d="M5 12h14M13 6l6 6-6 6"/>')}</button>
    </form>
  </div>`;
}

function setupChat() {
  const log = $('#chat-log');
  if (log) window.scrollTo(0, document.body.scrollHeight);
  if (ui.chatPending) { const t = ui.chatPending; ui.chatPending = null; chatSend(t); }
}

// Home-screen starter: the first message is typed right on Home, then the chat opens.
function chatStarter() {
  return `<form class="chat-start" data-chat-form data-start>
    <div class="cs-head"><div class="cs-pip">${pip('wink')}</div><div><b>Tell Pip about your perfect day</b><small>Describe it in your own words and get 3 plans.</small></div></div>
    <div class="composer inline">
      <textarea id="cs-in" rows="3" placeholder="e.g. Easy hike with the kids this Saturday, under an hour away, tacos after" aria-label="Describe your adventure" enterkeyhint="send"></textarea>
      <button class="send" type="submit" aria-label="Send">${svgIcon('<path d="M5 12h14M13 6l6 6-6 6"/>')}</button>
    </div>
  </form>`;
}

document.addEventListener('submit', e => {
  const f = e.target.closest('[data-chat-form]');
  if (!f) return;
  e.preventDefault();
  const box = f.querySelector('textarea'), text = box.value.trim();
  if (!text) { box.focus(); return; }
  box.value = '';
  if (f.hasAttribute('data-start')) { ui.chatPending = text; go('chat'); } else chatSend(text);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey && e.target.matches('[data-chat-form] textarea')) { e.preventDefault(); e.target.form.requestSubmit(); }
});
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act^="chat-"]');
  if (!el) return;
  switch (el.dataset.act) {
    case 'chat-example': chatSend(el.dataset.t); return;
    case 'chat-reset': state.chat = null; save(); render(); return;
    case 'chat-build':
      go('ideas'); generateIdeas();
      setTimeout(() => $('#idea-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
      return;
  }
});
