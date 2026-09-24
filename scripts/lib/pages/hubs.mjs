// City hubs /service-area/<city>/ and the /service-area/ directory grouped by county.
import { esc } from '../html.mjs';
import { icon } from '../icons.mjs';
import { STRINGS } from '../roofline.mjs';
import { splitHero, heroFrame, cityEyebrow } from '../heroes.mjs';
import { crumbs } from '../blocks.mjs';
import { closing, composition } from '../sections.mjs';
import { quoteForm } from '../form.mjs';
import { LOCAL_SERVICES } from '../config.mjs';

// Hub heroes lean on footage stills and commercial work so they differ from the residential landing pages.
const HUB_PHOTOS = [['downtown-storefront-wraps'], ['commercial-building-lit-trees'], ['pavilion-roofline-lights'], ['park-tree-and-wraps'], ['downtown-sidewalk-night']];
// Warm white work for the "Around <city>" section, never the same frame as the hero above it.
// Captions here carry no place name, so nothing beside the city copy reads as work done elsewhere.
const AROUND_PHOTOS = ['roofline-large-home', 'downtown-wrapped-trees-night', 'evergreens-warm-white', 'crew-bistro-install', 'downtown-sidewalk-wraps'];

export default function hubPages(ctx) {
  const { cities, copy, colorOf } = ctx.content;
  const pages = cities.map((city) => ({
    path: `/service-area/${city.slug}/`,
    type: 'hub',
    city: city.slug,
    navSection: '/service-area/',
    title: city.hub.title,
    description: city.hub.meta_description,
    estimateHref: '#estimate',
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
      return hubBody(ctx, page, city, HUB_PHOTOS[k], AROUND_PHOTOS[(k + 1) % AROUND_PHOTOS.length]);
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

function hubBody(ctx, page, city, photos, aroundPhoto) {
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
    return `<li class="svc-card" data-reveal style="--d:${i * 80}ms"><a href="${ctx.url(`/${slug}/${city.slug}/`)}"><span class="svc-card-k">${esc(s.short)}</span><span class="svc-card-t">${esc(city.pages[slug].h1)}</span><span class="svc-card-s">${esc(city.hub.highlights[i] || s.summary)}</span><span class="svc-card-go">${icon('arrow')}</span></a></li>`;
  }).join('');
  const neighbors = (city.neighbors || []).map((n) => ctx.content.city(n));
  return `${hero}

<section class="sec sec-local" aria-labelledby="local-title">
  <div class="wrap local">
    <div class="local-copy" data-reveal>
      <p class="place-tag">${icon('pin')}<span>${esc(city.display)}</span><span class="place-county">${esc(city.county)}</span></p>
      <h2 id="local-title">Around ${esc(city.name)}</h2>
      <p class="lead-body">${esc(city.hub.local_context)}</p>
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
    <h2 id="nearby-title" class="h-quiet">Nearby communities</h2>
    <ul class="city-pills">${neighbors.map((n) => `<li><a class="city-pill" href="${ctx.url(`/service-area/${n.slug}/`)}">${esc(n.display)}</a></li>`).join('')}</ul>
    <p class="nearby-links"><a class="tlink" href="${ctx.url('/service-area/')}">The full service area${icon('arrow')}</a></p>
  </div>
</section>

${closing(ctx, page, { heading: ctx.content.copy.home.closing.heading, text: ctx.content.copy.home.closing.text, eyebrow: `Free estimate in ${city.display}`, photoName: 'town-blue-hour-aerial', anchor: 'estimate-close', formOpts: { city: city.slug } })}`;
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
    <div class="page-actions" data-fade style="--d:420ms"><a class="btn btn-glow" href="#estimate" data-cta="estimate" data-placement="hero"><span>Get my free estimate</span>${icon('arrow')}</a></div>
  </div>
  <div class="wrap page-hero-foot"><p class="media-cap">${esc(v.caption)}</p>${v.toggle}</div>
</section>

<div class="sec sec-dir">
  <div class="wrap dir">${blocks}</div>
</div>

${closing(ctx, page, { heading: ctx.content.copy.home.closing.heading, text: ctx.content.copy.home.closing.text, photoName: 'town-harbor-aerial', anchor: 'estimate' })}`;
}
