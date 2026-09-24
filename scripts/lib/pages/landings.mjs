// 75 local landing pages: /<service>/<city>/ for the three local services.
// The form sits beside the literal H1 on desktop and right after the H1 and sub on phones,
// with the city preset and a two-step flow. Photos rotate by a neighbor-aware coloring so
// adjacent communities do not get identical pages.
import { esc } from '../html.mjs';
import { icon } from '../icons.mjs';
import { STRINGS } from '../roofline.mjs';
import { splitHero, heroFrame, cityEyebrow } from '../heroes.mjs';
import { considerationCards, processRow, faqList, faqSchema, ticks, sceneSwitcher, SPELLS, SPELLS_PERMANENT } from '../blocks.mjs';
import { quoteForm } from '../form.mjs';
import { closing, composition } from '../sections.mjs';
import { LOCAL_SERVICES, BUSINESS } from '../config.mjs';
import { estimateLink, phoneLink } from '../layout.mjs';

// Per service: presets, the hero string shape, and photo variants [hero, composition].
export const LANDING_SETUP = {
  'christmas-light-installation': {
    highlight: 0,
    topic: 'Christmas lights',
    lights: ['Roofline'],
    property: 'Home',
    deco: 'eave',
    nav: '/christmas-light-installation/',
    variants: [
      [['roofline-large-home'], ['evergreens-warm-white', 'residential-multicolor-canopy']],
      [['evergreens-warm-white', 'residential-multicolor-canopy'], ['roofline-large-home', 'bucket-truck-roofline-install']],
      [['roofline-large-home'], ['residential-birch-wraps', 'evergreens-warm-white']],
      [['residential-multicolor-canopy', 'evergreens-warm-white'], ['roofline-large-home', 'residential-red-green-trees']],
    ],
  },
  'commercial-holiday-lighting': {
    highlight: 1,
    topic: 'commercial holiday lighting',
    lights: [],
    property: 'Business',
    deco: 'outline',
    video: 'downtown-wraps',
    og: 'commercial',
    nav: '/commercial-holiday-lighting/',
    variants: [
      [null, ['downtown-wrapped-trees-night', 'downtown-sidewalk-wraps']],
      [null, ['commercial-building-lit-trees', 'crew-bistro-install']],
      [null, ['downtown-sidewalk-night', 'pavilion-roofline-lights']],
      [null, ['subdivision-entrance-green-trees', 'downtown-street-blue-hour']],
    ],
  },
  'permanent-lighting': {
    highlight: 2,
    topic: 'permanent lighting',
    lights: ['Permanent lighting'],
    property: 'Home',
    deco: 'track',
    scene: true,
    nav: '/permanent-lighting/',
    variants: [[null, []]],
  },
};

export default function landingPages(ctx) {
  const pages = [];
  const { cities, service, colorOf } = ctx.content;
  LOCAL_SERVICES.forEach((slug, si) => {
    const s = service(slug);
    const setup = LANDING_SETUP[slug];
    for (const city of cities) {
      const P = city.pages[slug];
      const v = colorOf(city.slug, setup.variants.length, si);
      const faqs = [...P.faq, ...pickServiceFaqs(s.faqs, colorOf(city.slug, 5, si + 3))];
      pages.push({
        path: `/${slug}/${city.slug}/`,
        type: 'landing',
        service: slug,
        city: city.slug,
        navSection: setup.nav,
        title: P.title,
        description: P.meta_description,
        estimateHref: '#estimate',
        ogImage: setup.og === 'commercial' ? ctx.og.commercial : undefined,
        crumbs: [
          { name: s.name, href: `/${slug}/` },
          { name: city.display, href: `/${slug}/${city.slug}/` },
        ],
        schemas: [
          {
            '@type': 'Service',
            name: P.h1,
            serviceType: s.name,
            description: P.meta_description,
            provider: { '@id': ctx.abs('/') + '#business' },
            areaServed: { '@type': 'City', name: `${city.name}, Michigan`, containedInPlace: { '@type': 'AdministrativeArea', name: `${city.county}, Michigan` } },
            url: ctx.abs(`/${slug}/${city.slug}/`),
          },
          faqSchema(faqs),
        ],
        body: (ctx, page) => landingBody(ctx, page, { s, setup, city, P, variant: setup.variants[v], faqs }),
      });
    }
  });
  return pages;
}

// Two service FAQs per page, rotated so neighboring pages do not repeat the same pair.
function pickServiceFaqs(list, k) {
  const a = k % list.length;
  const b = (a + 2) % list.length;
  return [list[a], list[b]];
}

function landingBody(ctx, page, { s, setup, city, P, variant, faqs }) {
  const { copy, city: cityOf } = ctx.content;
  const [heroPhotos, compPhotos] = variant;
  const presets = { city: city.slug, lights: setup.lights, property: setup.property };
  const form = quoteForm(ctx, page, { placement: 'hero', anchor: 'estimate', heading: 'Get my free estimate', ...presets });
  let media = '';
  let mediaCls = '';
  if (setup.scene) {
    media = sceneSwitcher(ctx, { cls: 'scene-hero', preset: false });
    mediaCls = 'sh-media-scene';
  } else if (heroPhotos) media = heroFrame(ctx, heroPhotos);

  const hero = splitHero(ctx, page, {
    crumbItems: [{ name: s.name, href: `/${s.slug}/` }, { name: city.display }],
    eyebrow: cityEyebrow(city),
    h1: P.h1,
    sub: P.hero_sub,
    deco: STRINGS[setup.deco](),
    variant: setup.video ? 'bleed' : 'frame',
    bleed: setup.video ? { name: setup.video } : null,
    media,
    mediaCls,
    form,
    spells: setup.scene ? SPELLS_PERMANENT : SPELLS,
  });

  const highlight = city.hub.highlights[setup.highlight] || s.summary;
  const local = compPhotos.length
    ? `<div class="local-comp">${composition(ctx, compPhotos, { cls: 'comp-local' })}</div>`
    : `<div class="local-aside" data-reveal>${spellsCard(ctx, s)}</div>`;

  const neighbors = (city.neighbors || []).map((n) => cityOf(n));
  const nearby = neighbors
    .map((n) => `<li><a class="city-pill" href="${ctx.url(`/${s.slug}/${n.slug}/`)}">${esc(n.display)}</a></li>`)
    .join('');

  return `${hero}

<section class="sec sec-local" id="local" aria-labelledby="local-title">
  <div class="wrap local${compPhotos.length ? '' : ' local-solo'}">
    <div class="local-copy" data-reveal>
      <p class="place-tag">${icon('pin')}<span>${esc(city.display)}</span><span class="place-county">${esc(city.county)}</span></p>
      <h2 id="local-title">${esc(highlight)}</h2>
      <p class="lead-body">${esc(P.local_paragraph)}</p>
    </div>
    ${local}
  </div>
</section>

<section class="sec sec-consider" aria-labelledby="consider-title">
  <div class="wrap">
    <h2 id="consider-title" class="h-quiet" data-reveal>What we plan for in ${esc(city.name)}</h2>
    ${considerationCards(P.considerations)}
  </div>
</section>

<section class="sec sec-included" aria-labelledby="included-title">
  <div class="wrap included">
    <div class="included-copy" data-reveal>
      <h2 id="included-title">One company, start to finish</h2>
      <p class="lead-s">${esc(s.summary)}</p>
      ${ticks(s.scope, 'ticks-2')}
      <div class="included-cta">${estimateLink(ctx, page, 'included')}${phoneLink('included', { cls: 'tlink', label: `Or call ${BUSINESS.phone}` })}</div>
    </div>
    <div class="included-steps" data-reveal>
      <p class="scope-h">How it works</p>
      ${processRow(copy.process.steps.slice(0, 4), { cls: 'process-compact' })}
    </div>
  </div>
</section>

<section class="sec sec-faq" aria-labelledby="faq-title">
  <div class="wrap faq-wrap">
    <div class="faq-side" data-reveal>
      <h2 id="faq-title">Before you book</h2>
      <p class="lead-s">Common questions about ${esc(setup.topic)} in ${esc(city.name)}.</p>
    </div>
    <div data-reveal>${faqList(faqs)}</div>
  </div>
</section>

<section class="sec sec-nearby" aria-labelledby="nearby-title">
  <div class="wrap nearby">
    <h2 id="nearby-title" class="h-quiet">Nearby communities</h2>
    <ul class="city-pills">${nearby}</ul>
    <p class="nearby-links"><a class="tlink" href="${ctx.url(`/service-area/${city.slug}/`)}">Holiday lighting in ${esc(city.display)}${icon('arrow')}</a><a class="tlink" href="${ctx.url(`/${s.slug}/`)}">${esc(s.name)}${icon('arrow')}</a></p>
  </div>
</section>

${closing(ctx, page, { heading: s.cta_line, text: '', eyebrow: `Free estimate in ${city.display}`, photoName: s.slug === 'commercial-holiday-lighting' ? 'town-harbor-aerial' : 'town-blue-hour-aerial', anchor: 'estimate-close', formOpts: { ...presets } })}`;
}

function spellsCard(ctx, s) {
  const items = s.slug === 'permanent-lighting' ? SPELLS_PERMANENT : SPELLS;
  return `<div class="scope-card"><p class="scope-h">Every estimate spells out</p>${ticks(items)}<a class="btn btn-glow btn-sm" href="#estimate" data-cta="estimate" data-placement="local"><span>Get my free estimate</span>${icon('arrow')}</a></div>`;
}
