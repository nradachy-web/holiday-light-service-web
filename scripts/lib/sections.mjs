// Page sections shared by several page types.
import { esc } from './html.mjs';
import { icon } from './icons.mjs';
import { quoteForm } from './form.mjs';
import { BUSINESS as B } from './config.mjs';

// The closing block: blue-hour photo, next steps, the big phone and the form.
export function closing(ctx, page, { heading, text, photoName = 'town-blue-hour-aerial', formOpts = {}, anchor = 'estimate', eyebrow = 'Free estimate' }) {
  const { copy } = ctx.content;
  const next = copy.contact.next_steps.map(([t, p], i) => `<li><span class="next-n" aria-hidden="true">${i + 1}</span><div><h3>${esc(t)}</h3><p>${esc(p)}</p></div></li>`).join('');
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
      <p class="media-cap closing-cap">Photo: ${esc(ctx.media.caption(photoName))}</p>
    </div>
    <div class="closing-form">${quoteForm(ctx, page, { placement: 'closing', anchor, heading: 'Tell us what to light', ...formOpts })}</div>
  </div>
</section>`;
}


// An editorial composition of our own captioned photos (no grid catalog, no lightbox).
// Layout classes follow the photo orientation so crops stay honest.
export function composition(ctx, names, { cls = '' } = {}) {
  const { figure, mediaItem } = { ...ctx.media, mediaItem: ctx.content.mediaItem };
  const n = names.length;
  const items = names
    .map((name, i) => {
      const m = mediaItem(name);
      const o = m.orientation || (m.width >= m.height ? 'landscape' : 'portrait');
      const sizes = n === 1 ? '(min-width: 1000px) 1100px, 100vw' : o === 'portrait' ? '(min-width: 1000px) 420px, 100vw' : '(min-width: 1000px) 720px, 100vw';
      return figure(name, { sizes, cls: `comp-fig comp-${o} comp-${i + 1}` }).replace('<figure class="', '<figure data-reveal class="');
    })
    .join('');
  return `<div class="comp comp-n${n}${cls ? ' ' + cls : ''}">${items}</div>`;
}
