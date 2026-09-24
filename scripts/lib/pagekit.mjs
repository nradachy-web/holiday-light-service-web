// Helpers for the company, editorial and commercial vertical pages: audience-fit process copy,
// the full-bleed media hero, the compact page head, guide cards and the article parts.
// Everything renders existing components where they exist; only the layouts are new.
import { esc, riseWords } from './html.mjs';
import { icon } from './icons.mjs';
import { STRINGS } from './roofline.mjs';
import { crumbs } from './blocks.mjs';
import { phoneLink, estimateLink } from './layout.mjs';

/**
 * The five shared process steps, fitted to the page's audience.
 * 'residential' drops sentences that only apply to commercial projects, so a homeowner's page
 * never talks about commercial walkthroughs. 'commercial' and 'all' keep the full copy.
 * 'permanent' and 'landscape' are residential copy whose last step is setup and support instead of
 * takedown: those lights stay up, so a season-end takedown would contradict the page.
 */
export function processSteps(ctx, audience = 'all') {
  const P = ctx.content.copy.process;
  const steps = P.steps;
  if (audience === 'all' || audience === 'commercial') return steps;
  const home = steps.map(([t, p]) => {
    const kept = p
      .split(/(?<=\.)\s+/)
      .filter((s) => !/^Commercial\b/.test(s))
      .join(' ');
    if (!kept) throw new Error(`Process step "${t}" has no residential copy left`);
    return [t, kept];
  });
  if (audience === 'residential') return home;
  const last = P.year_round?.[audience];
  if (!last) throw new Error(`No year-round last step for audience "${audience}"`);
  // Landscape fixtures are set in beds and lawns, not hung from a roof or a bucket truck, so that
  // audience gets its own installation step (year_round.installation) when the copy provides one.
  const install = P.year_round.installation?.[audience];
  const fitted = install ? home.map((st) => (st[0] === install[0] ? install : st)) : home;
  if (install && !fitted.includes(install)) throw new Error(`No "${install[0]}" step to replace for audience "${audience}"`);
  return [...fitted.slice(0, -1), last];
}

// The process intro for a page: service-neutral for the lighting that stays up all year.
export const processIntro = (ctx, audience = 'all') =>
  audience === 'permanent' || audience === 'landscape' ? ctx.content.copy.process.year_round.intro : ctx.content.copy.process.intro;

// Which process copy a service page or landing page uses.
export const audienceFor = (slug) =>
  ({ 'commercial-holiday-lighting': 'commercial', 'permanent-lighting': 'permanent', 'landscape-lighting': 'landscape' })[slug] || 'residential';

/**
 * Full-bleed page hero with a photo or footage behind the headline (our work, about).
 * Reuses the .page-hero layout of the service area directory.
 */
export function mediaHero(ctx, page, { crumbItems = [], eyebrow = '', h1, sub = '', photo, video, focal, actions, cls = '', deco = 'eave' }) {
  let media = '';
  let foot = '';
  if (video) {
    const v = ctx.media.bgVideo(video, { id: 'hero-video', eager: true, sizes: '100vw', focal });
    media = v.html;
    foot = `<div class="wrap page-hero-foot"><p class="media-cap">${esc(v.caption)}</p>${v.toggle}</div>`;
  } else if (photo) {
    media = ctx.media.photo(photo, { eager: true, sizes: '100vw', focal });
    foot = `<div class="wrap page-hero-foot"><p class="media-cap">${esc(ctx.media.caption(photo))}</p></div>`;
  }
  const act =
    actions === undefined
      ? `${estimateLink(ctx, page, 'hero', { cls: 'btn btn-glow btn-lg' })}${phoneLink('hero', { cls: 'btn btn-line btn-lg' })}`
      : actions;
  return `<section class="page-hero mhero${cls ? ' ' + cls : ''}" aria-labelledby="page-title">
  <div class="page-hero-media">${media}<div class="page-hero-scrim"></div></div>
  <div class="wrap page-hero-in">
    ${crumbItems.length ? crumbs(ctx, crumbItems) : ''}
    ${eyebrow ? `<p class="eyebrow mhero-eyebrow">${esc(eyebrow)}</p>` : ''}
    <h1 class="page-title" id="page-title" data-rise>${riseWords(h1)}</h1>
    ${deco ? `<div class="sh-deco">${STRINGS[deco]()}</div>` : ''}
    ${sub ? `<p class="page-sub" data-fade style="--d:300ms">${esc(sub)}</p>` : ''}
    ${act ? `<div class="page-actions" data-fade style="--d:420ms" data-bar-hide>${act}</div>` : ''}
  </div>
  ${foot}
</section>`;
}

/**
 * Compact page head on the night ground (FAQ, guides, privacy): breadcrumbs, H1, a light string
 * and the intro. Optional side slot for a form or a figure.
 */
export function pageHead(ctx, page, { crumbItems = [], eyebrow = '', h1, sub = '', deco = 'eave', actions = '', cls = '', subCls = '' }) {
  return `<header class="phead${cls ? ' ' + cls : ''}">
    ${crumbItems.length ? crumbs(ctx, crumbItems) : ''}
    ${eyebrow ? `<p class="eyebrow phead-eyebrow">${eyebrow}</p>` : ''}
    <h1 class="phead-title" id="page-title" data-rise>${riseWords(h1)}</h1>
    ${deco ? `<div class="sh-deco">${STRINGS[deco]()}</div>` : ''}
    ${sub ? `<p class="phead-sub${subCls ? ' ' + subCls : ''}" data-fade style="--d:260ms">${esc(sub)}</p>` : ''}
    ${actions ? `<div class="phead-act" data-fade style="--d:360ms" data-bar-hide>${actions}</div>` : ''}
  </header>`;
}

// One photo per guide, warm white first. Captions still come from media.json. The pavilion is kept off
// the permanent guide (it is a commercial building), and the soft 900px house photo stays out of the
// large feature slot on the guides hub.
export const GUIDE_PHOTOS = {
  'when-to-book-christmas-light-installation': 'evergreens-warm-white',
  'permanent-vs-seasonal-holiday-lights': 'roofline-large-home',
  'planning-commercial-holiday-lighting': 'downtown-wrapped-trees-night',
  'holiday-lights-without-the-ladder': 'bucket-truck-roofline-install',
};

// The guide that belongs next to each service's questions (service pages, verticals, local pages).
export const RELATED_GUIDE = {
  'christmas-light-installation': 'when-to-book-christmas-light-installation',
  'roofline-christmas-lights': 'holiday-lights-without-the-ladder',
  'tree-and-shrub-lighting': 'when-to-book-christmas-light-installation',
  'commercial-holiday-lighting': 'planning-commercial-holiday-lighting',
  'permanent-lighting': 'permanent-vs-seasonal-holiday-lights',
  // No guide covers landscape lighting yet, so that page shows none rather than a holiday guide.
};

/** A compact related-guide link card for the side of an FAQ block. */
export function relatedGuide(ctx, serviceSlug) {
  const slug = RELATED_GUIDE[serviceSlug];
  const g = slug && ctx.content.copy.guides.find((x) => x.slug === slug);
  if (!g) return '';
  return `<a class="rguide" href="${ctx.url(`/guides/${g.slug}/`)}"><span class="rguide-k">Guide <span aria-hidden="true">·</span> ${readingTime(g)}</span><span class="rguide-t">${esc(g.h1)}</span><span class="rguide-go">Read the guide${icon('arrow')}</span></a>`;
}

export function guideWords(g) {
  return [g.dek, ...g.sections.flatMap((s) => [s.heading, ...s.paragraphs])].join(' ').split(/\s+/).filter(Boolean).length;
}
// Reading time at about 230 words a minute, rounded up. A UI label, not a claim.
export const readingTime = (g) => `${Math.max(1, Math.ceil(guideWords(g) / 230))} min read`;

export const slugify = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** A guide card: photo, reading time, title, dek. The title link stretches over the whole card. */
export function guideCard(ctx, g, { feature = false, headingTag = 'h3', eager = false } = {}) {
  const name = GUIDE_PHOTOS[g.slug];
  const sizes = feature ? '(min-width: 1000px) 720px, 100vw' : '(min-width: 1000px) 420px, 100vw';
  const href = ctx.url(`/guides/${g.slug}/`);
  return `<article class="gcard${feature ? ' gcard-feature' : ''}" data-reveal>
    <div class="gcard-media">${ctx.media.photo(name, { sizes, alt: '', eager })}</div>
    <div class="gcard-body">
      <p class="gcard-k">Guide <span aria-hidden="true">·</span> ${readingTime(g)}</p>
      <${headingTag} class="gcard-t"><a href="${href}">${esc(g.h1)}</a></${headingTag}>
      <p class="gcard-dek">${esc(g.dek)}</p>
      <span class="gcard-go" aria-hidden="true">Read the guide${icon('arrow')}</span>
    </div>
  </article>`;
}
