// 75 local landing pages: /<service>/<city>/ for the three local services.
// The form sits beside the literal H1 on desktop and right after the H1 and sub on phones,
// with the city preset and a two-step flow. Photos rotate by a neighbor-aware coloring so
// adjacent communities do not get identical pages.
import { esc } from '../html.mjs';
import { icon } from '../icons.mjs';
import { STRINGS } from '../roofline.mjs';
import { splitHero, heroFrame, cityEyebrow } from '../heroes.mjs';
import { considerationCards, processRow, faqList, faqSchema, ticks, sceneSwitcher, planRow, SPELLS, SPELLS_PERMANENT } from '../blocks.mjs';
import { quoteForm } from '../form.mjs';
import { closing, composition } from '../sections.mjs';
import { LOCAL_SERVICES, BUSINESS } from '../config.mjs';
import { estimateLink, phoneLink } from '../layout.mjs';
import { processSteps, audienceFor, relatedGuide } from '../pagekit.mjs';

// Per service: presets, the hero string shape, the hero media variants and the photos for the
// local section. Hero slots carry warm white (or neutral daylight) work only; each colored photo
// in the local section is paired with a warm one (design-decisions.md, DESIGN.md photo rules).
export const LANDING_SETUP = {
  'christmas-light-installation': {
    topic: 'Christmas light installation',
    anchor: 'Christmas lights',
    lights: ['Roofline'],
    property: 'Home',
    deco: 'eave',
    og: 'home',
    nav: '/christmas-light-installation/',
    variants: [
      { hero: ['roofline-large-home', 'evergreens-warm-white'], local: ['bucket-truck-roofline-install', 'residential-multicolor-canopy'] },
      { hero: ['bucket-truck-roofline-install', 'evergreens-warm-white'], local: ['roofline-large-home', 'residential-birch-wraps'] },
      { hero: ['roofline-large-home', 'bucket-truck-roofline-install'], local: ['evergreens-warm-white', 'residential-red-green-trees'] },
      { hero: ['evergreens-warm-white', 'roofline-large-home'], local: ['bucket-truck-roofline-install', 'residential-red-green-trees'] },
    ],
  },
  'commercial-holiday-lighting': {
    topic: 'commercial Christmas lights and holiday lighting',
    anchor: 'Commercial lighting',
    lights: [],
    property: 'Business',
    deco: 'outline',
    og: 'building',
    plan: true,
    nav: '/commercial-holiday-lighting/',
    // Footage on some pages, our own stills (captions without place names) on the rest.
    variants: [
      { bleed: { name: 'downtown-wraps' }, local: ['downtown-wrapped-trees-night', 'downtown-sidewalk-wraps'] },
      { bleed: { photo: 'commercial-building-lit-trees', focal: '50% 40%' }, local: ['crew-bistro-install', 'downtown-sidewalk-wraps'] },
      { bleed: { photo: 'downtown-wrapped-trees-night', focal: '50% 45%' }, local: ['commercial-building-lit-trees', 'crew-bistro-install'] },
      { bleed: { photo: 'downtown-sidewalk-wraps', focal: '50% 42%' }, local: ['pavilion-roofline-lights', 'commercial-building-lit-trees'] },
    ],
  },
  'permanent-lighting': {
    topic: 'permanent Christmas lights',
    anchor: 'Permanent lights',
    lights: ['Permanent lighting'],
    property: 'Home',
    deco: 'track',
    og: 'home',
    scene: true,
    nav: '/permanent-lighting/',
    // No photos of permanent installs exist yet, so the local section shows our seasonal roofline
    // work, labeled as seasonal, beside the estimate checklist.
    variants: [{ local: ['roofline-large-home'] }, { local: ['bucket-truck-roofline-install'] }],
  },
};

// Generic FAQs are added after the three city FAQs only when they cover a topic the city FAQs do not.
const TOPICS = [
  ['booking', /\bbook(?:ing|ed)?\b|\bhow (?:early|far ahead)\b|\bwhen should\b/i],
  ['included', /\binclud/i],
  ['home', /\bbe home\b/i],
  ['damage', /\bdamage\b/i],
  ['outage', /\bgo(?:es)? out\b|\bgoes dark\b|\bstop working\b/i],
  ['walkthrough', /\bwalkthrough\b/i],
  ['hours', /\bhours\b/i],
  ['hoa', /\bHOA\b|\bassociation\b|\bmunicipal\b/i],
  ['track', /\btrack\b/i],
  ['control', /\bcontrol\b|\bapp\b/i],
  ['occasions', /\bonly for christmas\b|\bother holidays\b|\ball year\b/i],
  ['price', /\bpric/i],
  ['choose', /\bpermanent or seasonal\b|\bseasonal or permanent\b/i],
];
const topicOf = (q) => (TOPICS.find(([, re]) => re.test(q)) || [q.toLowerCase()])[0];
// Backfill from the general FAQ when the service FAQs are all covered by the city's questions.
const BACKFILL = {
  'christmas-light-installation': [/^Do I need extra outlets/, /^What happens if the weather/, /^How should I prepare/],
  'commercial-holiday-lighting': [/^Do commercial projects/, /^What happens if the weather/, /^Do I need HOA approval/],
  'permanent-lighting': [/^What is the difference between permanent/, /^Do I need extra outlets/],
};

function pickFaqs(ctx, slug, cityFaqs, serviceFaqs, k) {
  const used = new Set(cityFaqs.map(([q]) => topicOf(q)));
  const n = serviceFaqs.length;
  const a = k % n;
  // Rotation keeps neighboring pages from showing the same pair: a, a+2, a+4, a+1, a+3.
  const order = [0, 2, 4, 1, 3].map((d) => serviceFaqs[(a + d) % n]).filter(Boolean);
  const general = (BACKFILL[slug] || []).map((re) => ctx.content.copy.faq.items.find(([q]) => re.test(q))).filter(Boolean);
  const picked = [];
  for (const item of [...order, ...general]) {
    if (picked.length === 2) break;
    const t = topicOf(item[0]);
    if (used.has(t)) continue;
    used.add(t);
    picked.push(item);
  }
  return [...cityFaqs, ...picked];
}

// Neighbor links in both directions: every community a page lists, plus every community that lists it.
function nearbyMap(cities) {
  const back = new Map(cities.map((c) => [c.slug, []]));
  for (const c of cities) for (const n of c.neighbors || []) back.get(n)?.push(c.slug);
  return new Map(cities.map((c) => [c.slug, [...new Set([...(c.neighbors || []), ...back.get(c.slug).sort()])]]));
}

export default function landingPages(ctx) {
  const pages = [];
  const { cities, service, colorOf } = ctx.content;
  const nearby = nearbyMap(cities);
  LOCAL_SERVICES.forEach((slug, si) => {
    const s = service(slug);
    const setup = LANDING_SETUP[slug];
    for (const city of cities) {
      const P = city.pages[slug];
      const v = colorOf(city.slug, setup.variants.length, si);
      const faqs = pickFaqs(ctx, slug, P.faq, s.faqs, colorOf(city.slug, 5, si + 3));
      pages.push({
        path: `/${slug}/${city.slug}/`,
        type: 'landing',
        service: slug,
        city: city.slug,
        navSection: setup.nav,
        title: P.title,
        description: P.meta_description,
        estimateHref: '#estimate',
        // Share card: our own photo whose caption names no place (never the Northern Michigan footage).
        ...ctx.og.card(setup.og, { seasonal: !!setup.scene }),
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
        body: (ctx, page) => landingBody(ctx, page, { s, setup, city, P, variant: setup.variants[v], faqs, nearby: nearby.get(city.slug) }),
      });
    }
  });
  return pages;
}

function landingBody(ctx, page, { s, setup, city, P, variant, faqs, nearby }) {
  const { city: cityOf, service } = ctx.content;
  const presets = { city: city.slug, lights: setup.lights, property: setup.property };
  const form = quoteForm(ctx, page, { placement: 'hero', anchor: 'estimate', heading: 'Get my free estimate', ...presets });
  let media = '';
  let mediaCls = '';
  if (setup.scene) {
    media = sceneSwitcher(ctx, { cls: 'scene-hero', preset: false });
    mediaCls = 'sh-media-scene';
  } else if (variant.hero) media = heroFrame(ctx, variant.hero);

  const hero = splitHero(ctx, page, {
    crumbItems: [{ name: s.name, href: `/${s.slug}/` }, { name: city.display }],
    eyebrow: cityEyebrow(city),
    h1: P.h1,
    sub: P.hero_sub,
    deco: STRINGS[setup.deco](),
    variant: variant.bleed ? 'bleed' : 'frame',
    bleed: variant.bleed || null,
    media,
    mediaCls,
    form,
    plan: setup.plan ? planRow(ctx, { current: setup.property }) : '',
    spells: setup.scene ? SPELLS_PERMANENT : SPELLS,
  });

  const highlight = city.hub.highlights[LOCAL_SERVICES.indexOf(s.slug)] || s.summary;
  let local;
  if (setup.scene) {
    const name = variant.local[0];
    local = `<div class="local-aside local-aside-fig" data-reveal>
      <figure class="comp-fig local-fig">${ctx.media.photo(name, { sizes: '(min-width: 1000px) 560px, 100vw' })}<figcaption><span class="cap-tag">Seasonal work</span> ${esc(ctx.media.caption(name))}</figcaption></figure>
      ${spellsCard(ctx, s)}
    </div>`;
  } else local = `<div class="local-comp">${composition(ctx, variant.local, { cls: 'comp-local' })}</div>`;

  const nearbyPills = nearby
    .map((slug) => cityOf(slug))
    .map((n) => `<li><a class="city-pill" href="${ctx.url(`/${s.slug}/${n.slug}/`)}">${esc(setup.anchor)} in ${esc(n.display)}</a></li>`)
    .join('');
  const others = ['christmas-light-installation', 'commercial-holiday-lighting', 'permanent-lighting']
    .filter((x) => x !== s.slug)
    .map((x) => `<a class="tlink tlink-sm" href="${ctx.url(`/${x}/${city.slug}/`)}">${esc(LANDING_SETUP[x].anchor)} in ${esc(city.name)}${icon('arrow')}</a>`)
    .join('');
  const audience = audienceFor(s.slug);

  return `${hero}

<section class="sec sec-local" id="local" aria-labelledby="local-title">
  <div class="wrap local">
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
      ${processRow(processSteps(ctx, audience).slice(0, 4), { cls: 'process-compact' })}
    </div>
  </div>
</section>

<section class="sec sec-faq" aria-labelledby="faq-title">
  <div class="wrap faq-wrap">
    <div class="faq-side" data-reveal>
      <h2 id="faq-title">Before you book</h2>
      <p class="lead-s">Common questions about ${esc(setup.topic)} in ${esc(city.name)}.</p>
      ${relatedGuide(ctx, s.slug)}
    </div>
    <div data-reveal>${faqList(faqs)}</div>
  </div>
</section>

<section class="sec sec-nearby" aria-labelledby="nearby-title">
  <div class="wrap nearby">
    <h2 id="nearby-title" class="h-quiet">Nearby communities</h2>
    <ul class="city-pills">${nearbyPills}</ul>
    <p class="nearby-also"><span class="nearby-also-k">Also in ${esc(city.name)}</span>${others}<a class="tlink tlink-sm" href="${ctx.url(`/service-area/${city.slug}/`)}">All holiday lighting in ${esc(city.display)}${icon('arrow')}</a></p>
    <p class="nearby-links"><a class="tlink" href="${ctx.url(`/${s.slug}/`)}">${esc(service(s.slug).name)} across Southeast Michigan${icon('arrow')}</a></p>
  </div>
</section>

${closing(ctx, page, { heading: s.cta_line, text: '', eyebrow: `Free estimate in ${city.display}`, photoName: closingPhoto(s.slug, [...(variant.hero || []), variant.bleed?.photo, ...(variant.local || [])]), anchor: 'estimate-close', label: setup.scene ? 'Seasonal work' : '', formOpts: { ...presets } })}`;
}

// The closing background on local pages: our own warm white work whose caption names no place (a
// "Northern Michigan" caption under a local H1 undercuts the local promise), never a photo already on the page.
const CLOSING = {
  'commercial-holiday-lighting': ['downtown-wrapped-trees-night', 'commercial-building-lit-trees', 'downtown-sidewalk-wraps'],
  default: ['commercial-building-lit-trees', 'downtown-wrapped-trees-night', 'downtown-sidewalk-wraps'],
};
export function closingPhoto(slug, used = []) {
  const list = CLOSING[slug] || CLOSING.default;
  return list.find((n) => !used.includes(n)) || list[0];
}

function spellsCard(ctx, s) {
  const items = s.slug === 'permanent-lighting' ? SPELLS_PERMANENT : SPELLS;
  return `<div class="scope-card"><p class="scope-h">Every estimate spells out</p>${ticks(items)}<a class="btn btn-glow btn-sm" href="#estimate" data-cta="estimate" data-placement="local"><span>Get my free estimate</span>${icon('arrow')}</a></div>`;
}
