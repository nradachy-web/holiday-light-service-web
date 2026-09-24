// Light strings drawn as SVG: a wire polyline with C9 bulbs (or track pixels) spaced along it.
// Each bulb is two nodes: an unlit <use> and a lit <use>. The lit group shares one glow filter.
// The lit state is the resting default, so nothing depends on JavaScript or animation.

function place(points, spacing, skip = []) {
  const segs = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const L = Math.hypot(x2 - x1, y2 - y1);
    segs.push({ x1, y1, x2, y2, L, start: total, skip: skip.includes(i) });
    total += L;
  }
  const bulbs = [];
  let carry = spacing * 0.5;
  for (const s of segs) {
    let t = carry;
    while (t <= s.L + 0.001) {
      if (!s.skip) {
        const f = t / s.L;
        bulbs.push({
          x: s.x1 + (s.x2 - s.x1) * f,
          y: s.y1 + (s.y2 - s.y1) * f,
          ang: (Math.atan2(s.y2 - s.y1, s.x2 - s.x1) * 180) / Math.PI,
          d: s.start + t,
        });
      }
      t += spacing;
    }
    carry = t - s.L;
  }
  return { bulbs, total };
}

const f1 = (n) => (Math.round(n * 10) / 10).toString();

// The C9 glass outline and socket from icons.mjs, as points, for the combined unlit path.
const GLASS_PTS = [[-2.1, -2.4], [-2.7, -3.9], [-2.2, -6.7], [0, -10], [2.2, -6.7], [2.7, -3.9], [2.1, -2.4]];
const SOCKET_PTS = [[-1.7, -2.5], [1.7, -2.5], [1.7, 0.2], [-1.7, 0.2]];

/**
 * lightString({ points, spacing, width, height, kind, t0, span, cls, drop, skip })
 * kind: 'c9' (default) or 'px' (continuous track pixels for permanent lighting).
 * drop: length of an unlit wire drop after the last point (a downspout corner end).
 * t0/span: when the first bulb lights and how long the run takes, in ms.
 */
export function lightString({ points, spacing = 20, width, height, kind = 'c9', t0 = 120, span = 1100, cls = '', drop = 0, skip = [], label = '' }) {
  const pts = points.slice();
  const skipSegs = skip.slice();
  if (drop) {
    const [lx, ly] = pts[pts.length - 1];
    skipSegs.push(pts.length - 1);
    pts.push([lx, ly + drop]);
  }
  const { bulbs, total } = place(pts, spacing, skipSegs);
  let seed = 11;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const on = kind === 'px' ? 'px-on' : 'c9-on';
  // Unlit bulbs are drawn as one path per layer (not one node per bulb) to keep the DOM small.
  let offGlass = '';
  let offSock = '';
  const ons = [];
  bulbs.forEach((b, i) => {
    const tr = kind === 'px' ? `translate(${f1(b.x)} ${f1(b.y)})` : `translate(${f1(b.x)} ${f1(b.y)}) rotate(${Math.round(b.ang)})`;
    const delay = Math.round(t0 + (b.d / total) * span);
    const lum = (0.86 + rnd() * 0.14).toFixed(2);
    if (kind === 'px') {
      offGlass += `M${f1(b.x - 1.9)} ${f1(b.y)}a1.9 1.9 0 1 0 3.8 0a1.9 1.9 0 1 0-3.8 0`;
    } else {
      const a = (Math.round(b.ang) * Math.PI) / 180;
      const T = ([px, py]) => `${f1(b.x + px * Math.cos(a) - py * Math.sin(a))} ${f1(b.y + px * Math.sin(a) + py * Math.cos(a))}`;
      offGlass += `M${T(GLASS_PTS[0])}C${T(GLASS_PTS[1])} ${T(GLASS_PTS[2])} ${T(GLASS_PTS[3])}C${T(GLASS_PTS[4])} ${T(GLASS_PTS[5])} ${T(GLASS_PTS[6])}Z`;
      offSock += `M${SOCKET_PTS.map(T).join('L')}Z`;
    }
    ons.push(`<use href="#${on}" transform="${tr}" style="--t:${delay}ms;--lum:${lum};--i:${i}"/>`);
  });
  const offs = [
    offSock ? `<path class="off-sock" d="${offSock}"/>` : '',
    `<path class="off-glass" d="${offGlass}"/>`,
  ];
  const d = 'M' + pts.map((p) => p.map(f1).join(' ')).join('L');
  const end = drop ? `<rect class="plug" x="${f1(pts[pts.length - 1][0] - 2)}" y="${f1(pts[pts.length - 1][1] - 1)}" width="4" height="6" rx="1.2"/>` : '';
  const a11y = label ? ` role="img" aria-label="${label}"` : ' aria-hidden="true"';
  return `<svg class="string string-${kind}${cls ? ' ' + cls : ''}" viewBox="0 0 ${width} ${height}"${a11y} focusable="false"><path class="wire" d="${d}" pathLength="1"/>${end}<g class="off">${offs.join('')}</g><g class="on" filter="url(#c9-glow)">${ons.join('')}</g></svg>`;
}

// Named shapes used across the site. Each service gets its own string so pages are not clones.
export const STRINGS = {
  // Home hero: long eave, a main gable over the headline, a dormer, then the house corner with a drop.
  hero: () =>
    lightString({
      points: [[0, 184], [250, 184], [440, 46], [630, 184], [744, 184], [820, 122], [896, 184], [960, 184]],
      spacing: 19,
      width: 1100,
      height: 216,
      drop: 26,
      t0: 90,
      span: 1150,
      cls: 'hero-string',
    }),
  // Residential landing: a straight eave with a small gable, ending at the corner.
  eave: () =>
    lightString({ points: [[0, 30], [560, 30], [612, 8], [664, 30], [736, 30]], spacing: 17, width: 760, height: 44, drop: 10, t0: 60, span: 900, cls: 'deco-string' }),
  // Commercial landing: a stepped parapet like a storefront outline. The short vertical steps
  // (segments 1, 3, 5 and 7) carry bare wire: a C9 turned sideways there reads as a blob.
  outline: () =>
    lightString({
      points: [[0, 50], [118, 50], [118, 24], [318, 24], [318, 8], [468, 8], [468, 24], [640, 24], [640, 50], [736, 50]],
      skip: [1, 3, 5, 7],
      spacing: 17,
      width: 760,
      height: 60,
      t0: 60,
      span: 900,
      cls: 'deco-string',
    }),
  // Permanent: a continuous track of pixels under the eave.
  track: () =>
    lightString({ points: [[0, 22], [540, 22], [596, 6], [652, 22], [736, 22]], spacing: 8.5, width: 760, height: 34, kind: 'px', t0: 60, span: 800, cls: 'deco-string' }),
  // Permanent scene switcher: a full roofline illustration in the hero's bulb language.
  scene: () =>
    lightString({
      points: [[0, 170], [120, 170], [292, 22], [464, 170], [540, 170], [622, 100], [704, 170], [800, 170]],
      spacing: 24,
      width: 800,
      height: 184,
      t0: 60,
      span: 900,
      cls: 'scene-string',
    }),
};
