'use strict';
// First-time welcome: three swipeable screens, shown once to brand-new users (state.seen.welcome).
// "Show the intro again" on the You screen opens it any time.

const WELCOME = [
  { mood: 'happy', h: 'Plan a day trip in minutes',
    p: 'Tell Pip what you feel like doing, or pick a few settings. You get 3 ready-to-go plans to choose from.' },
  { mood: 'wink', h: 'Pip checks the details',
    list: ['🚗 Drive times between stops', '⛅ The weather on your day', '🕘 Opening hours and closures', '🍜 Food you’ll actually like'] },
  { mood: 'sleepy', h: 'Your trips stay on your phone',
    p: 'No account needed. Use <b>Back up now</b> on the You tab to keep a safe copy.',
    tip: '<b>Tip:</b> add Planerr to your Home Screen to use it like an app.<br>iPhone: Share → Add to Home Screen<br>Android: menu → Install app' },
];

function welcomeSlide(s, i) {
  return `<section class="wl-slide" id="wl-s${i}" aria-roledescription="slide" aria-label="${i + 1} of ${WELCOME.length}">
    <div class="wl-art">${pip(s.mood, 'bob')}</div>
    <h2 id="wl-h${i}">${s.h}</h2>
    ${s.p ? `<p>${s.p}</p>` : ''}
    ${s.list ? `<ul class="wl-list">${s.list.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}
    ${s.tip ? `<p class="wl-tip">${s.tip}</p>` : ''}
  </section>`;
}

let welcomeEl = null, welcomeFrom = null;

function welcomeOpen() {
  if (welcomeEl) return;
  welcomeFrom = document.activeElement;
  welcomeEl = document.createElement('div');
  welcomeEl.className = 'welcome';
  welcomeEl.setAttribute('role', 'dialog');
  welcomeEl.setAttribute('aria-modal', 'true');
  welcomeEl.setAttribute('aria-label', 'Welcome to Planerr');
  welcomeEl.innerHTML = `<div class="wl-card">
    <div class="wl-track" tabindex="0" aria-label="Welcome screens, swipe or use Next">${WELCOME.map(welcomeSlide).join('')}</div>
    <div class="wl-dots" aria-hidden="true">${WELCOME.map(() => '<i></i>').join('')}</div>
    <div class="wl-btns"><button class="btn ghost" data-wl="skip">Skip</button><button class="btn primary wl-main" data-wl="next">Next</button></div>
  </div>`;
  document.body.append(welcomeEl);
  ['app', 'tabbar'].forEach(id => document.getElementById(id)?.setAttribute('inert', ''));
  welcomeEl.querySelector('.wl-track').addEventListener('scroll', welcomeSync, { passive: true });
  welcomeSync();
  welcomeEl.querySelector('.wl-main').focus();
}

// Which slide is showing, from the scroll position. Updates dots and the main button.
function welcomeIndex() {
  const t = welcomeEl.querySelector('.wl-track');
  return Math.round(t.scrollLeft / Math.max(1, t.clientWidth));
}
function welcomeSync() {
  if (!welcomeEl) return;
  const i = welcomeIndex(), last = i >= WELCOME.length - 1;
  welcomeEl.querySelectorAll('.wl-dots i').forEach((d, n) => d.classList.toggle('on', n === i));
  const b = welcomeEl.querySelector('.wl-main');
  b.textContent = last ? 'Let’s go' : 'Next';
  b.dataset.wl = last ? 'done' : 'next';
  welcomeEl.querySelector('[data-wl="skip"]').hidden = last;
}

function welcomeClose() {
  if (!welcomeEl) return;
  state.seen.welcome = true; save();
  welcomeEl.remove(); welcomeEl = null;
  document.querySelectorAll('[inert]').forEach(x => x.removeAttribute('inert'));
  if (welcomeFrom?.isConnected) welcomeFrom.focus(); else document.getElementById('app')?.focus?.();
}

document.addEventListener('click', e => {
  const again = e.target.closest('[data-act="welcome-again"]');
  if (again) { e.preventDefault(); welcomeOpen(); return; }
  const b = e.target.closest('[data-wl]');
  if (!b || !welcomeEl) return;
  if (b.dataset.wl === 'next') {
    const t = welcomeEl.querySelector('.wl-track');
    const to = (welcomeIndex() + 1) * t.clientWidth, from = t.scrollLeft;
    t.scrollTo({ left: to, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    // If the smooth scroll didn't start (some browsers skip it), jump there instead.
    setTimeout(() => { if (welcomeEl && t.scrollLeft === from) t.scrollTo({ left: to, behavior: 'auto' }); welcomeSync(); }, 400);
  } else welcomeClose();
});
document.addEventListener('keydown', e => {
  if (!welcomeEl) return;
  if (e.key === 'Escape') { welcomeClose(); return; }
  const t = welcomeEl.querySelector('.wl-track');
  if (e.key === 'ArrowRight' && e.target === t) { e.preventDefault(); t.scrollBy({ left: t.clientWidth }); }
  if (e.key === 'ArrowLeft' && e.target === t) { e.preventDefault(); t.scrollBy({ left: -t.clientWidth }); }
  // Keep Tab inside the dialog.
  if (e.key === 'Tab') {
    const f = [...welcomeEl.querySelectorAll('button, [tabindex="0"]')].filter(x => !x.hidden);
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

// First open only. A shared-plan link shows the plan first; the intro waits for the next normal open.
document.addEventListener('DOMContentLoaded', () => {
  if (!state.seen.welcome && !location.hash.startsWith('#/view/')) welcomeOpen();
});
