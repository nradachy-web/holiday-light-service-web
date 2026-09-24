// One inline sprite per page: UI icons as <symbol>s plus the C9 bulb artwork and its shared glow.
// The sprite svg is zero size but not display:none, so gradients and filters referenced by <use> still resolve.

const ICONS = {
  phone:
    '<path d="M7.1 3.6h2.5l1.5 4.1-2 1.3a11.2 11.2 0 0 0 5.9 5.9l1.3-2 4.1 1.5v2.5a2.1 2.1 0 0 1-2.3 2.1C11.3 18.4 5.6 12.7 5 5.9a2.1 2.1 0 0 1 2.1-2.3Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  arrow:
    '<path d="M4.5 12h14.5M13.5 6.5 19 12l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  check: '<path d="m5 12.5 4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  pin:
    '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="10" r="2.3" fill="currentColor"/>',
  menu: '<path d="M4 8h16M4 16h16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  close: '<path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  chev: '<path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  pause: '<path d="M8.5 6v12M15.5 6v12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  play: '<path d="M8 5.8v12.4a.6.6 0 0 0 .9.5l9.6-6.2a.6.6 0 0 0 0-1L8.9 5.3a.6.6 0 0 0-.9.5Z" fill="currentColor"/>',
  plus: '<path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  back: '<path d="M19.5 12H5M10.5 6.5 5 12l5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
};

// C9 bulb, base at 0,0 pointing up. Glass is a faceted cone with a rounded tip.
const GLASS = 'M-2.1-2.4C-2.7-3.9-2.2-6.7 0-10C2.2-6.7 2.7-3.9 2.1-2.4Z';
const FACET = 'M-2.1-2.4C-2.7-3.9-2.2-6.7 0-10L0-2.4Z';

export function sprite() {
  const icons = Object.entries(ICONS)
    .map(([id, body]) => `<symbol id="i-${id}" viewBox="0 0 24 24">${body}</symbol>`)
    .join('');
  return `<svg class="sprite" width="0" height="0" aria-hidden="true" focusable="false"><defs>
<filter id="c9-glow" x="-4%" y="-60%" width="108%" height="220%" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceGraphic" stdDeviation="5.5" result="wide"/><feColorMatrix in="wide" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 .75 0" result="soft"/><feGaussianBlur in="SourceGraphic" stdDeviation="1.3" result="tight"/><feMerge><feMergeNode in="soft"/><feMergeNode in="tight"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
${icons}
<symbol id="c9-off" overflow="visible"><rect x="-1.7" y="-2.5" width="3.4" height="2.7" rx=".6" fill="#6f685e"/><path d="${GLASS}" fill="#2b2a31" stroke="rgba(255,255,255,.09)" stroke-width=".5"/></symbol>
<symbol id="px-off" overflow="visible"><circle r="1.9" fill="#2b2a31"/></symbol>
<symbol id="px-on" overflow="visible"><circle r="1.9" fill="currentColor"/><circle cx="-.5" cy="-.5" r=".75" fill="#fff" fill-opacity=".7"/></symbol>
<symbol id="c9-on" overflow="visible"><path d="${GLASS}" fill="currentColor"/><path d="${FACET}" fill="#fff" fill-opacity=".42"/><path d="M-.95-3.8-.4-7.6" stroke="#fff" stroke-width=".7" stroke-linecap="round" stroke-opacity=".95"/></symbol>
</defs></svg>`;
}

export const icon = (name, cls = '') =>
  `<svg class="i${cls ? ' ' + cls : ''}" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;

// Wordmark: a C9 bulb hanging from a draped wire, "Holiday Light" at 650 and "Service" at 350.
export function wordmark() {
  return `<svg class="wm-bulb" viewBox="0 0 26 34" aria-hidden="true" focusable="false"><path class="wm-wire" d="M1 4.5c6 3.4 18 3.4 24 0" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><rect class="wm-cap" x="10.2" y="6.4" width="5.6" height="5.4" rx="1.2"/><path class="wm-glass" d="M13 11.6c-3.9 0-6.1 3.1-6.1 6.6 0 4.3 3.6 7 6.1 11.4 2.5-4.4 6.1-7.1 6.1-11.4 0-3.5-2.2-6.6-6.1-6.6z"/><path class="wm-shine" d="M10.4 16.4c.3-1.5 1.3-2.6 2.6-2.9" fill="none" stroke-width="1.3" stroke-linecap="round"/></svg><span class="wm-word" aria-hidden="true"><span class="wm-a">Holiday Light</span> <span class="wm-b">Service</span></span>`;
}
