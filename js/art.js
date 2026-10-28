'use strict';
// Cartoon artwork drawn as inline SVG: Pip the camper van (the mascot), the home banner
// scene, and clouds/birds/trees layered over the trip scenes. Outlines use --outline so
// the drawings keep their ink line in light and dark mode.

const OUT = 'var(--outline)';

// Pip, a little camper van with a face. mood: 'happy' | 'wink' | 'sleepy'.
function pip(mood = 'happy', cls = '') {
  const eyes = mood === 'wink'
    ? `<circle cx="86" cy="39" r="3.6" fill="${OUT}"/><circle cx="87.2" cy="37.8" r="1.2" fill="#fff"/><path d="M93 39q3.5-3 7 0" fill="none" stroke="${OUT}" stroke-width="2.6" stroke-linecap="round"/>`
    : mood === 'sleepy'
      ? `<path d="M82 39q4 3 8 0M92 39q4 3 8 0" fill="none" stroke="${OUT}" stroke-width="2.6" stroke-linecap="round"/>`
      : `<circle cx="86" cy="39" r="3.6" fill="${OUT}"/><circle cx="96.5" cy="39" r="3.6" fill="${OUT}"/><circle cx="87.2" cy="37.8" r="1.2" fill="#fff"/><circle cx="97.7" cy="37.8" r="1.2" fill="#fff"/>`;
  return `<svg class="pip ${cls}" viewBox="0 0 124 86" aria-hidden="true">
    <ellipse cx="62" cy="80" rx="46" ry="4" fill="rgba(0,0,0,.14)"/>
    <g class="pip-body">
      <rect x="30" y="6" width="44" height="10" rx="4" fill="#FFC93C" stroke="${OUT}" stroke-width="2.6"/>
      <path d="M38 6v10M50 6v10M62 6v10" stroke="${OUT}" stroke-width="2"/>
      <path d="M14 30q0-14 16-14h52q14 0 20 12l8 14q4 6 4 12v8q0 6-6 6H16q-6 0-6-6V34q0-4 4-4z" fill="#FF5A36" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M10 52h104v6q0 6-6 6H16q-6 0-6-6z" fill="#FFF4E6" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/>
      <rect x="20" y="24" width="24" height="18" rx="5" fill="#BDEBFA" stroke="${OUT}" stroke-width="2.6"/>
      <rect x="48" y="24" width="24" height="18" rx="5" fill="#BDEBFA" stroke="${OUT}" stroke-width="2.6"/>
      <path d="M24 28l6-3M52 28l6-3" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>
      ${eyes}
      <circle cx="104" cy="48" r="3.4" fill="#FF9DB0" opacity=".85"/>
      <path d="M85 47q6 5 12 0" fill="none" stroke="${OUT}" stroke-width="2.6" stroke-linecap="round"/>
      <circle cx="112" cy="44" r="3" fill="#FFE27A" stroke="${OUT}" stroke-width="2"/>
    </g>
    <g class="pip-wheel"><circle cx="34" cy="66" r="10" fill="#2B3440" stroke="${OUT}" stroke-width="3"/><circle cx="34" cy="66" r="4" fill="#D8DEE6"/><path d="M34 58v4" stroke="#D8DEE6" stroke-width="2"/></g>
    <g class="pip-wheel"><circle cx="90" cy="66" r="10" fill="#2B3440" stroke="${OUT}" stroke-width="3"/><circle cx="90" cy="66" r="4" fill="#D8DEE6"/><path d="M90 58v4" stroke="#D8DEE6" stroke-width="2"/></g>
  </svg>`;
}

const cloud = (x, y, s = 1, cls = '') => `<g class="cloud ${cls}" transform="translate(${x} ${y}) scale(${s})"><path d="M8 26q-8 0-8-8t9-8q2-10 13-10 9 0 12 7 3-3 8-3 9 0 9 9v1q6 1 6 6 0 6-7 6z" fill="#fff" stroke="${OUT}" stroke-width="2.4" stroke-linejoin="round"/></g>`;
const birds = (x, y) => `<path d="M${x} ${y}q4-4 8 0q4-4 8 0M${x + 26} ${y - 10}q3-3 6 0q3-3 6 0" fill="none" stroke="${OUT}" stroke-width="2.2" stroke-linecap="round" opacity=".75"/>`;
const pine = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-2.5" y="0" width="5" height="9" fill="#7A4A2A" stroke="${OUT}" stroke-width="1.8"/><path d="M0-30L13 0H-13z" fill="#1F8A57" stroke="${OUT}" stroke-width="2.2" stroke-linejoin="round"/><path d="M0-30L7-14H-7z" fill="#2FAE6E"/></g>`;
const sunFace = (x, y, r) => `<g class="sun" transform="translate(${x} ${y})">
  <g class="rays" stroke="#FFC93C" stroke-width="4" stroke-linecap="round">${[0, 45, 90, 135, 180, 225, 270, 315].map(a => `<path d="M0 ${-(r + 6)}v-8" transform="rotate(${a})"/>`).join('')}</g>
  <circle r="${r}" fill="#FFD447" stroke="${OUT}" stroke-width="2.6"/>
  <circle cx="${-r * .32}" cy="${-r * .1}" r="2.4" fill="${OUT}"/><circle cx="${r * .32}" cy="${-r * .1}" r="2.4" fill="${OUT}"/>
  <path d="M${-r * .35} ${r * .22}q${r * .35} ${r * .3} ${r * .7} 0" fill="none" stroke="${OUT}" stroke-width="2.4" stroke-linecap="round"/>
  <circle cx="${-r * .58}" cy="${r * .2}" r="3" fill="#FF9DB0" opacity=".7"/><circle cx="${r * .58}" cy="${r * .2}" r="3" fill="#FF9DB0" opacity=".7"/>
</g>`;

// Cartoon extras laid over each trip scene in sceneSVG.
function sceneDeco(scene) {
  const sky = cloud(40, 34, .9, 'drift') + cloud(190, 18, .7, 'drift slow') + birds(120, 60);
  const trees = { mountains: pine(40, 236, 1.1) + pine(66, 244, .8) + pine(352, 240, 1), hills: pine(220, 232, .9) + pine(246, 240, .7), lake: pine(30, 168, .8) + pine(372, 168, .9), road: pine(110, 210, .9) + pine(300, 214, 1) };
  return sky + (trees[scene] || '');
}

// Home banner: Pip cruising a winding road through hills under a smiling sun.
function homeBanner(say) {
  return `<div class="banner">
    <svg viewBox="0 0 400 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs><linearGradient id="bsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--sky1)"/><stop offset="1" style="stop-color:var(--sky2)"/></linearGradient></defs>
      <rect width="400" height="180" fill="url(#bsky)"/>
      ${sunFace(338, 46, 22)}
      ${cloud(30, 26, .9, 'drift')}${cloud(200, 14, .65, 'drift slow')}${birds(150, 50)}
      <path d="M0 120q60-50 120-20t130-10 150 10v80H0z" fill="#8ED39B" stroke="${OUT}" stroke-width="2.6"/>
      <path d="M0 140q80-30 170-4t230-16v60H0z" fill="#46B06F" stroke="${OUT}" stroke-width="2.6"/>
      ${pine(36, 128, .9)}${pine(58, 134, .7)}${pine(300, 124, .9)}${pine(326, 130, 1.05)}${pine(372, 126, .8)}
      <path d="M-10 180q90-36 200-28t220-6v34z" fill="#5B6270" stroke="${OUT}" stroke-width="2.6"/>
      <path class="road-dash" d="M0 172q100-26 200-20t200-4" fill="none" stroke="#FFE27A" stroke-width="3.5" stroke-dasharray="14 12" stroke-linecap="round"/>
      <circle cx="110" cy="112" r="4" fill="#FF7DA0"/><circle cx="252" cy="120" r="4" fill="#FFE27A"/><circle cx="270" cy="126" r="3.4" fill="#fff"/>
    </svg>
    <div class="banner-pip">${pip('happy', 'bob')}</div>
    ${say ? `<div class="bubble">${say}</div>` : ''}
  </div>`;
}

// Small framed Pip for empty states and loading cards.
const pipNote = (text, mood = 'happy', extra = '') => `<div class="pip-note">${pip(mood, mood === 'sleepy' ? '' : 'bob')}<div class="stack" style="gap:8px;justify-items:center">${text}${extra}</div></div>`;
