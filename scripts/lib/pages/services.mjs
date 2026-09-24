// The six service pages. Literal H1 and the quote form on the first screen, then scope,
// our own photos, considerations, process, FAQ, local page links and the closing form.
import { esc } from '../html.mjs';
import { icon } from '../icons.mjs';
import { STRINGS } from '../roofline.mjs';
import { splitHero, heroFrame, heroFootage } from '../heroes.mjs';
import { considerationCards, processRow, faqList, faqSchema, ticks, countyPills, sceneSwitcher, SPELLS, SPELLS_PERMANENT, SPELLS_LANDSCAPE } from '../blocks.mjs';
import { quoteForm } from '../form.mjs';
import { closing, composition } from '../sections.mjs';
import { LOCAL_SERVICES } from '../config.mjs';

export const SERVICE_SETUP = {
  'christmas-light-installation': { hero: { variant: 'frame', photos: ['roofline-large-home'] }, deco: 'eave', lights: ['Roofline'], property: 'Home', comp: ['evergreens-warm-white', 'residential-multicolor-canopy', 'bucket-truck-roofline-install'], nav: '/christmas-light-installation/' },
  'roofline-christmas-lights': { hero: { variant: 'frame', photos: ['pavilion-roofline-lights'] }, deco: 'eave', lights: ['Roofline'], property: 'Home', comp: ['roofline-large-home', 'bucket-truck-roofline-install'], nav: '/christmas-light-installation/' },
  'tree-and-shrub-lighting': { hero: { variant: 'frame', photos: ['evergreens-warm-white', 'residential-multicolor-canopy'] }, deco: 'eave', lights: ['Trees and shrubs'], property: 'Home', comp: ['residential-birch-wraps', 'residential-red-green-trees', 'evergreens-green-lights'], nav: '/christmas-light-installation/' },
  'commercial-holiday-lighting': { hero: { variant: 'bleed', video: 'downtown-wraps' }, deco: 'outline', lights: [], property: 'Business', comp: ['downtown-wrapped-trees-night', 'commercial-building-lit-trees', 'downtown-sidewalk-wraps', 'crew-bistro-install'], nav: '/commercial-holiday-lighting/', og: 'commercial' },
  'permanent-lighting': { hero: { variant: 'frame', scene: true }, deco: 'track', lights: ['Permanent lighting'], property: 'Home', comp: [], nav: '/permanent-lighting/' },
  'landscape-lighting': { hero: { variant: 'frame', footage: 'park-tree-wraps' }, deco: '', lights: ['Landscape lighting'], property: 'Home', comp: [], nav: '/landscape-lighting/' },
};

export default function servicePages(ctx) {
  return ctx.content.copy.services.map((s) => {
    const setup = SERVICE_SETUP[s.slug];
    if (!setup) throw new Error('No page setup for service ' + s.slug);
    return {
      path: `/${s.slug}/`,
      type: 'service',
      service: s.slug,
      navSection: setup.nav,
      title: s.title,
      description: s.meta_description,
      estimateHref: '#estimate',
      ogImage: setup.og === 'commercial' ? ctx.og.commercial : undefined,
      crumbs: [{ name: s.name, href: `/${s.slug}/` }],
      schemas: [
        { '@type': 'Service', name: s.name, serviceType: s.name, description: s.summary, provider: { '@id': ctx.abs('/') + '#business' }, areaServed: { '@type': 'AdministrativeArea', name: 'Southeast Michigan' }, url: ctx.abs(`/${s.slug}/`) },
        faqSchema(s.faqs),
      ],
      body: (ctx, page) => serviceBody(ctx, page, s, setup),
    };
  });
}

function heroMedia(ctx, setup) {
  if (setup.hero.scene) return sceneSwitcher(ctx, { cls: 'scene-hero', preset: false });
  if (setup.hero.footage) return heroFootage(ctx, setup.hero.footage);
  if (setup.hero.photos) return heroFrame(ctx, setup.hero.photos);
  return '';
}

function serviceBody(ctx, page, s, setup) {
  const { copy, counties } = ctx.content;
  const form = quoteForm(ctx, page, { placement: 'hero', anchor: 'estimate', lights: setup.lights, property: setup.property, heading: 'Get my free estimate' });
  const hero = splitHero(ctx, page, {
    crumbItems: [{ name: s.name }],
    eyebrow: 'Southeast Michigan since 2003',
    h1: s.h1,
    sub: s.hero_sub,
    deco: setup.deco ? STRINGS[setup.deco]() : '',
    variant: setup.hero.variant,
    bleed: setup.hero.video ? { name: setup.hero.video } : null,
    media: setup.hero.variant === 'frame' ? heroMedia(ctx, setup) : '',
    mediaCls: setup.hero.scene ? 'sh-media-scene' : '',
    form,
    spells: s.slug === 'permanent-lighting' ? SPELLS_PERMANENT : s.slug === 'landscape-lighting' ? SPELLS_LANDSCAPE : SPELLS,
  });

  const hasLocal = LOCAL_SERVICES.includes(s.slug);
  const localBlock = hasLocal
    ? `<section class="sec sec-local-links" aria-labelledby="near-title">
  <div class="wrap">
    <div class="split-head" data-reveal>
      <h2 id="near-title">${esc(s.name)} near you</h2>
      <p class="lead-s">Choose your community for local details and a free estimate with your city already filled in.</p>
    </div>
    <div data-reveal>${countyPills(ctx, { hrefFor: (c) => `/${s.slug}/${c.slug}/` })}</div>
  </div>
</section>`
    : `<section class="sec sec-local-links" aria-labelledby="near-title">
  <div class="wrap">
    <div class="split-head" data-reveal>
      <h2 id="near-title">Where we work</h2>
      <p class="lead-s">${esc(copy.service_area.intro)}</p>
    </div>
    <div data-reveal>${countyPills(ctx)}</div>
  </div>
</section>`;

  const verticals =
    s.slug === 'commercial-holiday-lighting'
      ? `<section class="sec sec-verticals" aria-labelledby="vert-title">
  <div class="wrap">
    <h2 id="vert-title" class="h-quiet" data-reveal>Commercial property types</h2>
    <ul class="vcards vcards-page" data-reveal>${copy.verticals
      .map((v) => `<li><a class="vcard" href="${ctx.url(`/commercial/${v.slug}/`)}"><span class="vcard-t">${esc(v.name)}${icon('arrow')}</span><span class="vcard-s">${esc(v.summary)}</span></a></li>`)
      .join('')}</ul>
  </div>
</section>`
      : '';

  const comp = setup.comp.length
    ? `<section class="sec sec-comp" aria-labelledby="work-title">
  <div class="wrap">
    <h2 id="work-title" class="h-quiet" data-reveal>Our own work</h2>
    ${composition(ctx, setup.comp)}
  </div>
</section>`
    : '';

  return `${hero}

<section class="sec sec-overview" aria-labelledby="overview-title">
  <div class="wrap overview">
    <div class="overview-copy" data-reveal>
      <h2 id="overview-title">One company, start to finish</h2>
      <p class="lead">${esc(s.intro)}</p>
    </div>
    <div class="scope-card" data-reveal>
      <p class="scope-h">Your estimate can include</p>
      ${ticks(s.scope)}
      <a class="btn btn-glow btn-sm" href="#estimate" data-cta="estimate" data-placement="scope"><span>Get my free estimate</span>${icon('arrow')}</a>
    </div>
  </div>
</section>

${comp}

<section class="sec sec-consider" aria-labelledby="consider-title">
  <div class="wrap">
    <h2 id="consider-title" class="h-quiet" data-reveal>What we plan for</h2>
    ${considerationCards(s.considerations)}
  </div>
</section>

${verticals}

<section class="sec sec-process" aria-labelledby="process-title">
  <div class="wrap">
    <div class="split-head" data-reveal>
      <h2 id="process-title">How it works</h2>
      <p class="lead-s">${esc(copy.process.intro)}</p>
    </div>
    ${processRow(copy.process.steps)}
  </div>
</section>

<section class="sec sec-faq" aria-labelledby="faq-title">
  <div class="wrap faq-wrap">
    <div class="faq-side" data-reveal>
      <h2 id="faq-title">Questions</h2>
      <a class="tlink" href="${ctx.url('/faq/')}">All holiday lighting questions${icon('arrow')}</a>
    </div>
    <div data-reveal>${faqList(s.faqs)}</div>
  </div>
</section>

${localBlock}

${closing(ctx, page, { heading: s.cta_line, text: '', photoName: s.slug === 'commercial-holiday-lighting' ? 'town-harbor-aerial' : 'town-blue-hour-aerial', anchor: 'estimate-close', formOpts: { lights: setup.lights, property: setup.property } })}`;
}
