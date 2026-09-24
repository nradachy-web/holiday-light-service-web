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
 * variant: 'frame' (photo or scene under the copy), 'bleed' (full-bleed footage or still behind)
 * media: HTML for the media slot (frame variant)
 * bleed: { name, focal } for footage, or { photo, focal } for a still
 * plan: optional "Planning for" row (commercial pages)
 */
export function splitHero(ctx, page, { crumbItems = [], eyebrow = '', h1, sub, deco = '', variant = 'frame', media = '', bleed = null, form, more = true, actions = true, mediaCls = '', spells, plan = '' }) {
  let bg = '';
  let foot = '';
  if (variant === 'bleed' && bleed?.photo) {
    bg = `<div class="sh-bg sh-bg-still">${ctx.media.photo(bleed.photo, { eager: true, sizes: '100vw', focal: bleed.focal, alt: '' })}<div class="sh-scrim"></div></div>`;
    foot = `<div class="sh-foot"><p class="media-cap">${esc(ctx.media.caption(bleed.photo))}</p></div>`;
  } else if (variant === 'bleed' && bleed) {
    const v = ctx.media.bgVideo(bleed.name, { id: 'hero-video', eager: true, sizes: '100vw', focal: bleed.focal });
    bg = `<div class="sh-bg">${v.html}<div class="sh-scrim"></div></div>`;
    foot = `<div class="sh-foot"><p class="media-cap">${esc(v.caption)}</p>${v.toggle}</div>`;
  }
  // The call line shows on every width: a button beside the H1 on desktop, a compact glowing line
  // between the sub and the card on phones, so the number is on the first screen of every landing page.
  const act = actions
    ? `<div class="sh-act" data-fade style="--d:360ms" data-bar-hide>${phoneLink('hero', { cls: 'btn btn-line' })}${actions === true ? '' : actions}</div>`
    : '';
  return `<section class="split-hero split-${variant}${plan ? ' has-plan' : ''}" aria-labelledby="page-title">
  ${bg}
  <div class="wrap sh-grid">
    <div class="sh-copy">
      ${crumbItems.length ? crumbs(ctx, crumbItems) : ''}
      ${eyebrow ? `<p class="eyebrow sh-eyebrow">${esc(eyebrow)}</p>` : ''}
      <h1 class="sh-title" id="page-title" data-rise>${riseWords(h1)}</h1>
      ${deco ? `<div class="sh-deco">${deco}</div>` : ''}
      ${sub ? `<p class="sh-sub" data-fade style="--d:260ms">${esc(sub)}</p>` : ''}
    </div>
    ${plan ? `<div class="sh-plan" data-fade style="--d:320ms">${plan}</div>` : ''}
    ${act}
    ${media ? `<div class="sh-media${mediaCls ? ' ' + mediaCls : ''}">${media}</div>` : ''}
    <div class="sh-form">${form}</div>
    ${more ? `<div class="sh-more" data-fade style="--d:480ms">${proofRow()}${spellsOut('', spells)}</div>` : ''}
    ${foot}
  </div>
</section>`;
}

/**
 * A captioned frame for the split hero: one photo, or a pair.
 * A pair that leads with a landscape photo is laid out wide plus narrow at one height, so a
 * low-resolution photo is never stretched across the whole column. label: an honest tag shown
 * before the caption (for example "Seasonal work" on a page whose own work has no photos yet).
 */
export function heroFrame(ctx, names, { focal, label = '', focals = [] } = {}) {
  const { photo, caption } = ctx.media;
  const tag = label ? `<span class="cap-tag">${esc(label)}</span> ` : '';
  if (names.length === 1) {
    const n = names[0];
    // Very wide photos keep their own proportions instead of a 2:1 crop that would be mostly sky.
    const m = ctx.content.mediaItem(n);
    const wide = m.width / m.height > 2.1 ? ` style="--frame-ar:${m.width}/${m.height}"` : '';
    return `<figure class="sh-frame${label ? ' is-labeled' : ''}"${wide}>${photo(n, { eager: true, sizes: '(min-width: 1000px) 720px, 100vw', focal })}<figcaption>${tag}${esc(caption(n))}</figcaption></figure>`;
  }
  // Landscape photos take the wider slot and both share one height, so neither is stretched.
  const land = names.map((n) => { const m = ctx.content.mediaItem(n); return m.width > m.height; });
  const mixed = land[0] !== land[1] || land[0];
  const cols = land.map((l) => (l ? '1.5fr' : '1fr')).map((f) => `minmax(0,${f})`).join(' ');
  const sizes = (i) => (land[i] && !land[1 - i] ? '(min-width: 1000px) 470px, 60vw' : !land[i] && land[1 - i] ? '(min-width: 1000px) 310px, 40vw' : '(min-width: 1000px) 390px, 50vw');
  // On phones the two captions collapse into one line under the pair.
  return `<div class="sh-pair${mixed ? ' sh-pair-wide' : ''}"${mixed ? ` style="--pair-cols:${cols}"` : ''}>${names
    .map((n, i) => `<figure class="sh-frame">${photo(n, { eager: true, sizes: sizes(i), focal: focals[i] })}<figcaption>${esc(caption(n))}</figcaption></figure>`)
    .join('')}<p class="sh-pair-cap">${tag}${names.map((n) => esc(caption(n))).join(' ')}</p></div>`;
}


export const cityEyebrow = (city) => `${city.county} ${'·'} Free estimates`;
export { icon };
