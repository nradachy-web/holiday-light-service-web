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

// Keeps ", MI" on the line with its city name (escaped text in, HTML out).
export const bindMI = (html) => String(html).replace(/, MI\b/g, ',&nbsp;MI');

// Long local paragraphs (over about 70 words) render as two, split at the sentence boundary nearest
// the middle. Returns escaped <p> markup.
export function paras(text, cls = 'lead-body') {
  const t = String(text || '');
  const words = t.split(/\s+/).filter(Boolean).length;
  const out = (x) => `<p class="${cls}">${esc(x)}</p>`;
  if (words <= 70) return out(t);
  const mid = t.length / 2;
  let best = -1;
  for (const m of t.matchAll(/[.!?]\s+(?=[A-Z0-9"])/g)) {
    const at = m.index + m[0].length;
    if (best < 0 || Math.abs(at - mid) < Math.abs(best - mid)) best = at;
  }
  if (best < 0) return out(t);
  return out(t.slice(0, best).trim()) + '\n      ' + out(t.slice(best).trim());
}
