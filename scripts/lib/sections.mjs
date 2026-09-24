// Page sections shared by several page types.
import { esc } from './html.mjs';
import { icon } from './icons.mjs';
import { quoteForm } from './form.mjs';
import { BUSINESS as B } from './config.mjs';

// The closing block: blue-hour photo, next steps, the big phone and the form.
// label: an honest tag before the photo caption, the same one the page's hero uses (for example
// "Seasonal work" on permanent and landscape pages, which have no photos of their own work yet).
// steps: the next steps to list, when a page needs its own wording (landscape lighting).
export function closing(ctx, page, { heading, text, photoName = 'town-blue-hour-aerial', formOpts = {}, anchor = 'estimate', eyebrow = 'Free estimate', label = '', steps }) {
  const { copy } = ctx.content;
  const next = (steps || copy.contact.next_steps).map(([t, p], i) => `<li><span class="next-n" aria-hidden="true">${i + 1}</span><div><h3>${esc(t)}</h3><p>${esc(p)}</p></div></li>`).join('');
  return `<section class="closing" aria-labelledby="close-title">
  <div class="closing-media">${ctx.media.photo(photoName, { sizes: '100vw', alt: '' })}</div>
  <div class="closing-scrim"></div>
  <div class="wrap closing-in">
    <div class="closing-head" data-reveal>
      <p class="eyebrow">${esc(eyebrow)}</p>
      <h2 id="close-title">${esc(heading)}</h2>
      ${text ? `<p class="lead">${esc(text)}</p>` : ''}
    </div>
    <div class="closing-more" data-reveal>
      <ol class="next">${next}</ol>
      <a class="big-phone" href="${B.tel}" data-contact="phone" data-placement="closing">${icon('phone')}<span><span class="big-phone-k">Prefer to talk it through?</span>${B.phone}</span></a>
      <p class="media-cap closing-cap">${label ? `<span class="cap-tag">${esc(label)}</span>` : ''}<span>Photo: ${esc(ctx.media.caption(photoName))}</span></p>
    </div>
    <div class="closing-form">${quoteForm(ctx, page, { placement: 'closing', anchor, heading: 'Tell us what to light', ...formOpts })}</div>
  </div>
</section>`;
}


// An editorial composition of our own captioned photos (no grid catalog, no lightbox).
// Layout classes follow the photo orientation so crops stay honest.
// A panorama (wider than 2.5:1, like the 1500x454 pavilion) always keeps its own proportions: a 4:3
// or 16:9 slot would crop it to the middle and enlarge it past its pixels. In a pair on the service
// pages (no layout class) the two photos share one height in a strip, each at its own frame. The
// 900x418 house stays out of this: at its own proportions it would run wider than its pixels.
const WIDE = 2.5;
const ratioOf = (r) => { const [a, b] = String(r).split('/').map(Number); return b ? a / b : a; };
export function composition(ctx, names, { cls = '' } = {}) {
  const { figure, mediaItem } = { ...ctx.media, mediaItem: ctx.content.mediaItem };
  const n = names.length;
  const items = names.map((name) => {
    const m = mediaItem(name);
    const o = m.orientation || (m.width >= m.height ? 'landscape' : 'portrait');
    const wide = m.width / m.height > WIDE;
    // media.json `frame` overrides the slot's crop for a photo whose subject fills only part of it.
    return { name, m, o, wide, frame: wide ? `${m.width}/${m.height}` : m.frame };
  });
  const strip = n === 2 && !cls && items.some((x) => x.wide);
  if (strip) for (const x of items) x.frame = x.frame || (x.o === 'portrait' ? '4/5' : '4/3');
  const total = strip ? items.reduce((a, x) => a + ratioOf(x.frame), 0) : 0;
  const html = items
    .map(({ name, o, wide, frame }, i) => {
      // In a strip each photo's width is its share of the row, at 1320px wide at most.
      const sizes = strip
        ? `(min-width: 1000px) ${Math.round((1320 * ratioOf(frame)) / total)}px, 100vw`
        : n === 1 || wide ? '(min-width: 1000px) 1100px, 100vw' : o === 'portrait' ? '(min-width: 1000px) 420px, 100vw' : '(min-width: 1000px) 720px, 100vw';
      const extra = `${frame ? ' has-frame' : ''}${wide ? ' comp-wide' : ''}`;
      return figure(name, { sizes, cls: `comp-fig comp-${o} comp-${i + 1}${extra}`, frame }).replace('<figure class="', '<figure data-reveal class="');
    })
    .join('');
  const stripStyle = strip ? ` style="--strip-cols:${items.map((x) => `minmax(0,${ratioOf(x.frame).toFixed(3)}fr)`).join(' ')}"` : '';
  return `<div class="comp comp-n${n}${strip ? ' comp-strip' : ''}${cls ? ' ' + cls : ''}"${stripStyle}>${html}</div>`;
}
