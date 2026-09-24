// Small string helpers shared by every template.

export const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Attribute string from an object. true renders a bare attribute, false or null skips it.
export function attrs(obj = {}) {
  let out = '';
  for (const [k, v] of Object.entries(obj)) {
    if (v === false || v === null || v === undefined) continue;
    out += v === true ? ` ${k}` : ` ${k}="${esc(v)}"`;
  }
  return out;
}

export const cx = (...list) => list.filter(Boolean).join(' ');

// Wrap each word so the headline can rise word by word. The index drives the stagger in CSS.
export function riseWords(text, start = 0) {
  return String(text)
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => `<span class="w" style="--i:${i + start}"><span>${esc(w)}</span></span>`)
    .join(' ');
}

// Wrap words for the scroll-lit statement. Words in `quiet` get the gold tone.
export function litWords(text) {
  return String(text)
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `<span class="lw">${esc(w)}</span>`)
    .join(' ');
}

export const pad2 = (n) => String(n).padStart(2, '0');

// Deterministic small hash for picking variants.
export function hash(str) {
  let h = 2166136261;
  for (const ch of String(str)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const json = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c');
