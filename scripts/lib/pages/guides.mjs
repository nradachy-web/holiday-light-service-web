// /guides/ hub plus one readable long-form article per guide in site-copy. Each article carries a
// table of contents, a related service card, an in-text call to action from the service copy,
// Article JSON-LD, the other guides and the closing form preset to the related service.
import { esc, riseWords } from '../html.mjs';
import { icon } from '../icons.mjs';
import { crumbs, ticks, sceneSwitcher } from '../blocks.mjs';
import { closing } from '../sections.mjs';
import { phoneLink, estimateLink } from '../layout.mjs';
import { pageHead, guideCard, GUIDE_PHOTOS, readingTime, guideWords, slugify } from '../pagekit.mjs';
import { SERVICE_SETUP } from './services.mjs';
import { BUSINESS as B } from '../config.mjs';

const HEAD_SCENE = new Set(['permanent-vs-seasonal-holiday-lights']);
const largest = (m) => Object.entries(m.files.webp).sort((a, b) => Number(b[0]) - Number(a[0]))[0][1];

export default function guidePages(ctx) {
  const { copy } = ctx.content;
  const G = copy.guides_hub;
  const pages = [
    {
      path: '/guides/',
      type: 'guides',
      title: G.title,
      description: G.meta_description,
      estimateHref: '#estimate',
      crumbs: [{ name: 'Guides', href: '/guides/' }],
      schemas: [
        {
          '@type': 'CollectionPage',
          name: G.h1,
          description: G.meta_description,
          url: ctx.abs('/guides/'),
          hasPart: copy.guides.map((g) => ({ '@type': 'Article', headline: g.h1, url: ctx.abs(`/guides/${g.slug}/`) })),
        },
      ],
      body: (ctx, page) => hubBody(ctx, page, G),
    },
  ];
  for (const g of copy.guides) {
    const path = `/guides/${g.slug}/`;
    const photo = ctx.content.mediaItem(GUIDE_PHOTOS[g.slug] || 'roofline-large-home');
    const svc = ctx.content.service(g.related_service);
    pages.push({
      path,
      type: 'guide',
      navSection: '/guides/',
      title: g.title,
      description: g.meta_description,
      estimateHref: '#estimate',
      ogType: 'article',
      ogImage: ctx.og.guide(g.slug),
      ogAlt: photo.alt,
      crumbs: [
        { name: 'Guides', href: '/guides/' },
        { name: g.h1, href: path },
      ],
      schemas: [
        {
          '@type': 'Article',
          headline: g.h1,
          description: g.meta_description,
          image: ctx.abs(largest(photo)),
          wordCount: guideWords(g),
          datePublished: g.published,
          dateModified: g.updated || g.published,
          inLanguage: 'en-US',
          author: { '@id': ctx.abs('/') + '#business' },
          publisher: { '@id': ctx.abs('/') + '#business' },
          mainEntityOfPage: ctx.abs(path),
          about: { '@type': 'Service', name: svc.name, url: ctx.abs(`/${svc.slug}/`) },
        },
      ],
      body: (ctx, page) => guideBody(ctx, page, g, svc),
    });
  }
  return pages;
}

function hubBody(ctx, page, G) {
  const guides = ctx.content.copy.guides;
  const [first, ...rest] = guides;
  return `<div class="gh-page">
  <div class="wrap">
    ${pageHead(ctx, page, { crumbItems: [{ name: 'Guides' }], h1: G.h1, sub: G.intro, cls: 'gh-head' })}
    <div class="gh-cards">
      ${guideCard(ctx, first, { feature: true, headingTag: 'h2', eager: true })}
      <div class="gcards gcards-3">${rest.map((g) => guideCard(ctx, g, { headingTag: 'h2' })).join('')}</div>
    </div>
  </div>
</div>

${closing(ctx, page, { heading: G.closing.heading, text: G.closing.text, photoName: 'town-blue-hour-aerial', anchor: 'estimate' })}`;
}

function guideBody(ctx, page, g, svc) {
  const setup = SERVICE_SETUP[svc.slug] || {};
  const presets = { lights: setup.lights || [], property: setup.property || null };
  const photo = GUIDE_PHOTOS[g.slug] || 'roofline-large-home';
  const m = ctx.content.mediaItem(photo);
  const ids = g.sections.map((s) => slugify(s.heading));
  const ctaAt = Math.min(2, g.sections.length - 1);

  const toc = g.sections.map((s, i) => `<li><a href="#${ids[i]}">${esc(s.heading)}</a></li>`).join('');
  const sections = g.sections
    .map((s, i) => {
      const cta =
        i === ctaAt
          ? `<aside class="gd-cta" aria-label="${esc(svc.name)}"><p class="gd-cta-t">${esc(svc.hero_sub)}</p><div class="gd-cta-act">${estimateLink(ctx, page, 'guide_inline', { cls: 'btn btn-glow btn-sm' })}<a class="tlink tlink-sm" href="${ctx.url(`/${svc.slug}/`)}">${esc(svc.name)}${icon('arrow')}</a></div></aside>`
          : '';
      return `<section class="gd-sec" aria-labelledby="${ids[i]}">
        <h2 id="${ids[i]}">${esc(s.heading)}</h2>
        ${s.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('\n        ')}
      </section>${cta}`;
    })
    .join('\n      ');

  const others = ctx.content.copy.guides.filter((x) => x.slug !== g.slug);

  // The permanent lighting guide shows the labeled scene illustration (no permanent photos exist);
  // the others show their photo beside the headline, at a size the source files support.
  const media = HEAD_SCENE.has(g.slug)
    ? `<div class="gd-media gd-media-scene">${sceneSwitcher(ctx, { cls: 'scene-guide' })}</div>`
    : `<figure class="gd-media gd-fig">${ctx.media.photo(photo, { eager: true, sizes: '(min-width: 1000px) 560px, 100vw' })}<figcaption>${esc(m.caption)}</figcaption></figure>`;

  return `<article class="gd" aria-labelledby="page-title">
  <div class="wrap gd-head">
    <div class="gd-crumbs">${crumbs(ctx, [{ name: 'Guides', href: '/guides/' }, { name: g.h1 }])}</div>
    <div class="gd-head-copy">
      <p class="eyebrow gd-eyebrow">Guide <span aria-hidden="true">·</span> ${readingTime(g)}</p>
      <h1 class="gd-title" id="page-title" data-rise>${riseWords(g.h1)}</h1>
      <p class="gd-dek" data-fade style="--d:260ms">${esc(g.dek)}</p>
    </div>
    ${media}
  </div>
  <div class="wrap gd-grid">
    <nav class="gd-toc" aria-label="In this guide">
      <p class="gd-toc-h">In this guide</p>
      <ol>${toc}</ol>
    </nav>
    <div class="gd-body">
      ${sections}
    </div>
    <aside class="gd-aside" aria-label="Related service">
      <div class="gd-rel">
        <p class="scope-h">Related service</p>
        <p class="gd-rel-t"><a href="${ctx.url(`/${svc.slug}/`)}">${esc(svc.name)}</a></p>
        <p class="gd-rel-s">${esc(svc.summary)}</p>
        ${ticks(svc.scope.slice(0, 4))}
        ${estimateLink(ctx, page, 'guide_aside', { cls: 'btn btn-glow btn-sm' })}
        ${phoneLink('guide_aside', { cls: 'tlink tlink-sm', label: `Or call ${B.phone}` })}
      </div>
    </aside>
  </div>
</article>

<section class="sec gd-more" aria-labelledby="more-title">
  <div class="wrap">
    <div class="split-head" data-reveal>
      <h2 id="more-title" class="h-quiet">More guides</h2>
      <p class="lead-s"><a class="tlink" href="${ctx.url('/guides/')}">All guides${icon('arrow')}</a></p>
    </div>
    <div class="gcards gcards-3">${others.map((x) => guideCard(ctx, x)).join('')}</div>
  </div>
</section>

${closing(ctx, page, { heading: svc.cta_line, text: '', photoName: svc.slug === 'commercial-holiday-lighting' ? 'town-harbor-aerial' : 'town-blue-hour-aerial', anchor: 'estimate', formOpts: presets })}`;
}
