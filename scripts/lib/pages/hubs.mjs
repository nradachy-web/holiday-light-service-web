// City hubs /service-area/<city>/ and the /service-area/ directory grouped by county.
import { esc, bindMI, paras } from '../html.mjs';
import { icon } from '../icons.mjs';
import { STRINGS } from '../roofline.mjs';
import { splitHero, heroFrame, cityEyebrow } from '../heroes.mjs';
import { crumbs, nearbyLinks } from '../blocks.mjs';
import { closing, composition } from '../sections.mjs';
import { quoteForm } from '../form.mjs';
import { LOCAL_SERVICES } from '../config.mjs';
import { closingPhoto } from './landings.mjs';

// Hub heroes pair a home with commercial work (a hub covers every service), using only our own photos
// whose captions name no place: a "Northern Michigan" caption right under "Holiday Lighting in <City>"
// undercuts the local promise. Each pair leads with a landscape frame, so the hero is subject-filled.
const HUB_PHOTOS = [
  ['commercial-building-lit-trees', 'evergreens-warm-white'],
  ['downtown-wrapped-trees-night', 'evergreens-warm-white'],
  ['roofline-large-home', 'downtown-sidewalk-wraps'],
  ['commercial-building-lit-trees', 'downtown-sidewalk-wraps'],
  ['bucket-truck-roofline-install', 'downtown-sidewalk-wraps'],
];
// The "Around <city>" photo: warm white or crew work, never a frame already in the hero above it.
const AROUND_PHOTOS = ['downtown-wrapped-trees-night', 'roofline-large-home', 'crew-bistro-install', 'commercial-building-lit-trees', 'evergreens-warm-white'];
const aroundFor = (hero, k) => {
  for (let t = 0; t < AROUND_PHOTOS.length; t++) {
    const n = AROUND_PHOTOS[(k + t) % AROUND_PHOTOS.length];
    if (!hero.includes(n)) return n;
  }
  return AROUND_PHOTOS[0];
};

export default function hubPages(ctx) {
  const { cities, copy, colorOf } = ctx.content;
  // Nearby communities in both directions: the ones this city lists plus the ones that list it.
  const back = new Map(cities.map((c) => [c.slug, []]));
  for (const c of cities) for (const n of c.neighbors || []) back.get(n)?.push(c.slug);
  const nearby = new Map(cities.map((c) => [c.slug, [...new Set([...(c.neighbors || []), ...back.get(c.slug).sort()])]]));
  const pages = cities.map((city) => ({
    path: `/service-area/${city.slug}/`,
    type: 'hub',
    city: city.slug,
    navSection: '/service-area/',
    title: city.hub.title,
    description: city.hub.meta_description,
    estimateHref: '#estimate',
    ...ctx.og.card('home'),
    crumbs: [
      { name: 'Service area', href: '/service-area/' },
      { name: city.display, href: `/service-area/${city.slug}/` },
    ],
    schemas: [
      {
        '@type': 'WebPage',
        name: city.hub.h1,
        url: ctx.abs(`/service-area/${city.slug}/`),
        about: { '@type': 'City', name: `${city.name}, Michigan`, containedInPlace: { '@type': 'AdministrativeArea', name: `${city.county}, Michigan` } },
      },
    ],
    body: (ctx, page) => {
      const k = colorOf(city.slug, HUB_PHOTOS.length, 7);
      // The "Around <city>" photo is a different frame from the hero, also rotated by neighbor coloring.
      return hubBody(ctx, page, city, HUB_PHOTOS[k], aroundFor(HUB_PHOTOS[k], k + 1), nearby.get(city.slug));
    },
  }));

  const SA = copy.service_area;
  pages.push({
    path: '/service-area/',
    type: 'directory',
    title: SA.title,
    description: SA.meta_description,
    estimateHref: '#estimate',
    crumbs: [{ name: 'Service area', href: '/service-area/' }],
    body: (ctx, page) => directoryBody(ctx, page, SA),
  });
  return pages;
}

function hubBody(ctx, page, city, photos, aroundPhoto, nearbySlugs) {
  const { service } = ctx.content;
  const form = quoteForm(ctx, page, { placement: 'hero', anchor: 'estimate', city: city.slug, heading: 'Get my free estimate' });
  const hero = splitHero(ctx, page, {
    crumbItems: [{ name: 'Service area', href: '/service-area/' }, { name: city.display }],
    eyebrow: cityEyebrow(city),
    h1: city.hub.h1,
    sub: city.hub.intro,
    deco: STRINGS.eave(),
    media: heroFrame(ctx, photos),
    form,
  });
  const cards = LOCAL_SERVICES.map((slug, i) => {
    const s = service(slug);
    return `<li class="svc-card" data-reveal style="--d:${i * 80}ms"><a href="${ctx.url(`/${slug}/${city.slug}/`)}"><span class="svc-card-k">${esc(s.short)}</span><span class="svc-card-t">${bindMI(esc(city.pages[slug].h1))}</span><span class="svc-card-s">${esc(city.hub.highlights[i] || s.summary)}</span><span class="svc-card-go">${icon('arrow')}</span></a></li>`;
  }).join('');
  const neighbors = nearbySlugs.map((n) => ctx.content.city(n));
  const HC = ctx.content.copy.service_area.hub_closing;
  const fill = (t) => t.replace(/\{city\}/g, city.name);
  return `${hero}

<section class="sec sec-local" aria-labelledby="local-title">
  <div class="wrap local">
    <div class="local-copy" data-reveal>
      <p class="place-tag">${icon('pin')}<span>${esc(city.display)}</span><span class="place-county">${esc(city.county)}</span></p>
      <h2 id="local-title">Around ${esc(city.name)}</h2>
      ${paras(city.hub.local_context)}
    </div>
    <div class="local-comp">${composition(ctx, [aroundPhoto], { cls: 'comp-local comp-hub' })}</div>
  </div>
</section>

<section class="sec sec-hub-services" aria-labelledby="svc-title">
  <div class="wrap">
    <h2 id="svc-title" class="h-quiet" data-reveal>Lighting services in ${esc(city.name)}</h2>
    <ul class="svc-cards">${cards}</ul>
  </div>
</section>

<section class="sec sec-nearby" aria-labelledby="nearby-title">
  <div class="wrap nearby">
    <h2 id="nearby-title" class="h-quiet">Also serving near ${esc(city.name)}</h2>
    ${nearbyLinks(neighbors.map((n) => ({ href: ctx.url(`/service-area/${n.slug}/`), name: n.display, county: n.county, why: n.hub.highlights[0] || '' })))}
    <p class="nearby-links"><a class="tlink" href="${ctx.url('/service-area/')}">The full service area${icon('arrow')}</a></p>
  </div>
</section>

${closing(ctx, page, { heading: fill(HC.heading), text: fill(HC.text), eyebrow: `Free estimate in ${city.display}`, photoName: closingPhoto('hub', [...photos, aroundPhoto]), anchor: 'estimate-close', formOpts: { city: city.slug } })}`;
}

function directoryBody(ctx, page, SA) {
  const { counties, service } = ctx.content;
  const blocks = counties
    .map(
      (g) => `<section class="dir-county" aria-labelledby="c-${g.county.replace(/\W+/g, '-').toLowerCase()}" data-reveal>
    <h2 class="dir-h" id="c-${g.county.replace(/\W+/g, '-').toLowerCase()}">${esc(g.county)}</h2>
    <ul class="dir-cities">${g.cities
      .map(
        (c) => `<li class="dir-city"><a class="dir-name" href="${ctx.url(`/service-area/${c.slug}/`)}">${esc(c.name)}${icon('arrow')}</a><ul class="dir-links">${LOCAL_SERVICES.map((s) => `<li><a href="${ctx.url(`/${s}/${c.slug}/`)}">${esc(service(s).short)}</a></li>`).join('')}</ul></li>`
      )
      .join('')}</ul>
  </section>`
    )
    .join('');
  const v = ctx.media.bgVideo('town-aerial', { id: 'hero-video', eager: true, sizes: '100vw' });
  return `<section class="page-hero" aria-labelledby="page-title">
  <div class="page-hero-media">${v.html}<div class="page-hero-scrim"></div></div>
  <div class="wrap page-hero-in">
    ${crumbs(ctx, [{ name: 'Service area' }])}
    <h1 class="page-title" id="page-title" data-rise>${SA.h1.split(' ').map((w, i) => `<span class="w" style="--i:${i}"><span>${esc(w)}</span></span>`).join(' ')}</h1>
    <div class="sh-deco">${STRINGS.eave()}</div>
    <p class="page-sub" data-fade style="--d:300ms">${esc(SA.intro)}</p>
    <div class="page-actions" data-fade style="--d:420ms" data-bar-hide><a class="btn btn-glow" href="#estimate" data-cta="estimate" data-placement="hero"><span>Get my free estimate</span>${icon('arrow')}</a></div>
  </div>
  <div class="wrap page-hero-foot"><p class="media-cap">${esc(v.caption)}</p>${v.toggle}</div>
</section>

<div class="sec sec-dir">
  <div class="wrap dir">${blocks}</div>
</div>

${closing(ctx, page, { heading: SA.closing.heading, text: SA.closing.text, photoName: 'town-harbor-aerial', anchor: 'estimate' })}`;
}
