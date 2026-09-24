// First-screen layouts. The home hero carries the one orchestrated load moment; the split hero
// puts the literal H1 beside the quote form on desktop and right after the H1 on phones.
import { esc, riseWords } from './html.mjs';
import { icon } from './icons.mjs';
import { STRINGS } from './roofline.mjs';
import { crumbs, spellsOut, proofRow } from './blocks.mjs';
import { phoneLink, estimateLink } from './layout.mjs';

export function homeHero(ctx, page) {
  const H = ctx.content.copy.home;
  const v = ctx.media.bgVideo('hero-tree', { id: 'hero-video', eager: true, portrait: true, sizes: '100vw' });
  return `<section class="hero" aria-labelledby="page-title">
  <div class="hero-media">${v.html}<div class="hero-dim"></div></div>
  <div class="hero-scrim"></div>
  <div class="wrap hero-in">
    <div class="hero-roof">${STRINGS.hero()}</div>
    <p class="eyebrow hero-eyebrow" data-fade style="--d:120ms">${esc(H.eyebrow)}</p>
    <h1 class="hero-title" id="page-title" data-rise>${riseWords(H.h1)}</h1>
    <p class="hero-sub" data-fade style="--d:420ms">${esc(H.hero_sub)}</p>
    <div class="hero-actions" data-fade style="--d:520ms" data-bar-hide>
      ${estimateLink(ctx, page, 'hero', { cls: 'btn btn-glow btn-lg' })}
      ${phoneLink('hero', { cls: 'btn btn-line btn-lg' })}
    </div>
    <div data-fade style="--d:640ms">${spellsOut('spells-hero')}</div>
  </div>
  <div class="wrap hero-foot" data-fade style="--d:760ms">
    <p class="media-cap">${esc(v.caption)}</p>
    ${v.toggle}
  </div>
</section>`;
}

/**
 * splitHero(ctx, page, opts)
 * variant: 'frame' (photo or scene under the copy), 'bleed' (full-bleed footage behind)
 * media: HTML for the media slot (frame variant), bleed: { name } for footage
 */
export function splitHero(ctx, page, { crumbItems = [], eyebrow = '', h1, sub, deco = '', variant = 'frame', media = '', bleed = null, form, more = true, actions = true, mediaCls = '', spells }) {
  let bg = '';
  let foot = '';
  if (variant === 'bleed' && bleed) {
    const v = ctx.media.bgVideo(bleed.name, { id: 'hero-video', eager: true, sizes: '100vw', focal: bleed.focal });
    bg = `<div class="sh-bg">${v.html}<div class="sh-scrim"></div></div>`;
    foot = `<div class="sh-foot"><p class="media-cap">${esc(v.caption)}</p>${v.toggle}</div>`;
  }
  const act = actions
    ? `<div class="sh-act" data-fade style="--d:360ms">${phoneLink('hero', { cls: 'btn btn-line' })}${actions === true ? '' : actions}</div>`
    : '';
  return `<section class="split-hero split-${variant}" aria-labelledby="page-title">
  ${bg}
  <div class="wrap sh-grid">
    <div class="sh-copy">
      ${crumbItems.length ? crumbs(ctx, crumbItems) : ''}
      ${eyebrow ? `<p class="eyebrow sh-eyebrow">${esc(eyebrow)}</p>` : ''}
      <h1 class="sh-title" id="page-title" data-rise>${riseWords(h1)}</h1>
      ${deco ? `<div class="sh-deco">${deco}</div>` : ''}
      ${sub ? `<p class="sh-sub" data-fade style="--d:260ms">${esc(sub)}</p>` : ''}
    </div>
    ${act}
    ${media ? `<div class="sh-media${mediaCls ? ' ' + mediaCls : ''}">${media}</div>` : ''}
    <div class="sh-form">${form}</div>
    ${more ? `<div class="sh-more" data-fade style="--d:480ms">${proofRow()}${spellsOut('', spells)}</div>` : ''}
    ${foot}
  </div>
</section>`;
}

// A captioned frame for the split hero: one photo, or a pair of portraits.
export function heroFrame(ctx, names, { focal } = {}) {
  const { photo, caption } = ctx.media;
  if (names.length === 1) {
    const n = names[0];
    // Very wide photos keep their own proportions instead of a 2:1 crop that would be mostly sky.
    const m = ctx.content.mediaItem(n);
    const wide = m.width / m.height > 2.1 ? ` style="--frame-ar:${m.width}/${m.height}"` : '';
    return `<figure class="sh-frame"${wide}>${photo(n, { eager: true, sizes: '(min-width: 1000px) 720px, 100vw', focal })}<figcaption>${esc(caption(n))}</figcaption></figure>`;
  }
  // On phones the two captions collapse into one line under the pair.
  return `<div class="sh-pair">${names
    .map((n) => `<figure class="sh-frame">${photo(n, { eager: true, sizes: '(min-width: 1000px) 360px, 50vw' })}<figcaption>${esc(caption(n))}</figcaption></figure>`)
    .join('')}<p class="sh-pair-cap">${names.map((n) => esc(caption(n))).join(' ')}</p></div>`;
}

// A framed footage panel (landscape lighting): poster frame plus video, captioned truthfully.
export function heroFootage(ctx, name) {
  const v = ctx.media.bgVideo(name, { id: 'hero-video', eager: true, autostart: false, sizes: '(min-width: 1000px) 720px, 100vw' });
  return `<figure class="sh-frame sh-film">${v.html}<figcaption><span>${esc(v.caption)}</span>${v.toggle}</figcaption></figure>`;
}

export const cityEyebrow = (city) => `${city.county} ${'·'} Free estimates`;
export { icon };
