// Commercial verticals: /commercial/<slug>/ for downtowns, HOA entrances, retail and offices.
// Literal H1 and the quote form on the first screen, preset to the property type. The downtowns
// page carries the site's one frame-crossing H1 (c2): footage in a film frame whose bottom edge
// runs through the headline, plus the town-aerial footage band.
import { esc, riseWords } from '../html.mjs';
import { icon } from '../icons.mjs';
import { STRINGS } from '../roofline.mjs';
import { splitHero, heroFrame } from '../heroes.mjs';
import { crumbs, considerationCards, processRow, faqList, faqSchema, ticks, countyPills, proofRow, spellsOut } from '../blocks.mjs';
import { quoteForm } from '../form.mjs';
import { closing, composition } from '../sections.mjs';
import { phoneLink } from '../layout.mjs';
import { processSteps, relatedGuide } from '../pagekit.mjs';

export const VERTICAL_SETUP = {
  'downtowns-and-municipalities': {
    property: 'Downtown or municipality',
    lights: ['Trees and shrubs', 'Poles and lampposts'],
    film: 'downtown-wraps',
    band: 'town-aerial',
    comp: ['downtown-wrapped-trees-night', 'downtown-sidewalk-wraps', 'downtown-street-blue-hour', 'crew-bistro-install'],
    close: 'town-blue-hour-aerial',
  },
  'hoa-and-subdivision-entrances': {
    property: 'HOA or subdivision',
    lights: ['Entrance or sign'],
    // A common-area roofline, the whole pavilion at its own proportions (a panorama is never cropped);
    // the green entrance sits lower, paired with a lit home, so no slot near the top is all color.
    hero: ['pavilion-roofline-lights'],
    deco: 'eave',
    comp: ['subdivision-entrance-green-trees', 'roofline-large-home'],
    close: 'town-blue-hour-aerial',
  },
  'retail-and-shopping-centers': {
    property: 'Business',
    lights: ['Building outline'],
    hero: ['downtown-storefront-wraps'],
    focal: '50% 62%',
    deco: 'outline',
    comp: ['downtown-sidewalk-wraps', 'downtown-sidewalk-night', 'crew-bistro-install'],
    close: 'town-harbor-aerial',
  },
  'offices-and-business-campuses': {
    property: 'Business',
    lights: ['Entrance or sign'],
    hero: ['commercial-building-lit-trees'],
    focal: '50% 38%',
    deco: 'outline',
    comp: ['evergreens-warm-white', 'downtown-wrapped-trees-night', 'bucket-truck-roofline-install'],
    close: 'town-harbor-aerial',
  },
};

export default function verticalPages(ctx) {
  const commercial = ctx.content.service('commercial-holiday-lighting');
  return ctx.content.copy.verticals.map((v) => {
    const setup = VERTICAL_SETUP[v.slug];
    if (!setup) throw new Error('No page setup for vertical ' + v.slug);
    const path = `/commercial/${v.slug}/`;
    return {
      path,
      type: 'vertical',
      navSection: '/commercial-holiday-lighting/',
      bodyClass: setup.film ? 'has-film' : '',
      title: v.title,
      description: v.meta_description,
      estimateHref: '#estimate',
      ogImage: ctx.og.commercial,
      crumbs: [
        { name: commercial.name, href: '/commercial-holiday-lighting/' },
        { name: v.name, href: path },
      ],
      schemas: [
        {
          '@type': 'Service',
          name: v.h1,
          serviceType: `${commercial.name}: ${v.name}`,
          description: v.summary,
          provider: { '@id': ctx.abs('/') + '#business' },
          areaServed: { '@type': 'AdministrativeArea', name: 'Southeast Michigan' },
          url: ctx.abs(path),
        },
        faqSchema(v.faqs),
      ],
      body: (ctx, page) => verticalBody(ctx, page, v, setup, commercial),
    };
  });
}

// The frame-crossing hero (downtowns only): the film frame sits in the copy column and the H1
// overlaps its lower edge by two lines, so the headline starts on the footage and ends on the night.
function filmHero(ctx, page, v, setup, form) {
  const f = ctx.media.bgVideo(setup.film, { id: 'hero-video', eager: true, sizes: '(min-width: 1000px) 800px, 100vw' });
  return `<section class="split-hero split-film" aria-labelledby="page-title">
  <div class="wrap sh-grid">
    <div class="sh-copy">
      ${crumbs(ctx, [{ name: ctx.content.service('commercial-holiday-lighting').name, href: '/commercial-holiday-lighting/' }, { name: v.name }])}
      <div class="xf">
        <div class="xf-frame">${f.html}<div class="xf-scrim"></div><div class="xf-ctl">${f.toggle}</div></div>
        <h1 class="xf-title" id="page-title" data-rise>${riseWords(v.h1)}</h1>
      </div>
      <p class="sh-sub" data-fade style="--d:260ms">${esc(v.hero_sub)}</p>
    </div>
    <div class="sh-act" data-fade style="--d:360ms" data-bar-hide>${phoneLink('hero', { cls: 'btn btn-line' })}</div>
    <div class="sh-form">${form}</div>
    <div class="sh-more" data-fade style="--d:480ms">${proofRow()}${spellsOut()}</div>
    <div class="sh-foot"><p class="media-cap">${esc(f.caption)}</p></div>
  </div>
</section>`;
}

function verticalBody(ctx, page, v, setup, commercial) {
  const { copy } = ctx.content;
  const presets = { property: setup.property, lights: setup.lights };
  const form = quoteForm(ctx, page, { placement: 'hero', anchor: 'estimate', heading: 'Get my free estimate', ...presets });

  const hero = setup.film
    ? filmHero(ctx, page, v, setup, form)
    : splitHero(ctx, page, {
        crumbItems: [{ name: commercial.name, href: '/commercial-holiday-lighting/' }, { name: v.name }],
        eyebrow: 'Commercial holiday lighting',
        h1: v.h1,
        sub: v.hero_sub,
        deco: STRINGS[setup.deco](),
        variant: 'frame',
        media: heroFrame(ctx, setup.hero, { focal: setup.focal }),
        form,
      });

  // What the property type needs: over the town-aerial footage on the downtowns page, cards elsewhere.
  let needs;
  if (setup.band) {
    const b = ctx.media.bgVideo(setup.band, { id: 'band-video', sizes: '100vw' });
    needs = `<section class="vt-band" aria-labelledby="needs-title">
  <div class="vt-band-stage">
    <div class="vt-band-media">${b.html}<div class="vt-band-scrim"></div></div>
    <div class="wrap vt-band-in">
      <div class="vt-band-foot"><p class="media-cap">${esc(b.caption)}</p>${b.toggle}</div>
      <h2 id="needs-title" class="vt-band-title">What we plan for</h2>
    </div>
  </div>
  <div class="wrap vt-needs">${considerationCards(v.needs)}</div>
</section>`;
  } else {
    needs = `<section class="sec sec-consider" aria-labelledby="needs-title">
  <div class="wrap">
    <h2 id="needs-title" class="h-quiet" data-reveal>What we plan for</h2>
    ${considerationCards(v.needs)}
  </div>
</section>`;
  }

  const others = copy.verticals
    .filter((x) => x.slug !== v.slug)
    .map((x) => `<li><a class="vcard" href="${ctx.url(`/commercial/${x.slug}/`)}"><span class="vcard-t">${esc(x.name)}${icon('arrow')}</span><span class="vcard-s">${esc(x.summary)}</span></a></li>`)
    .concat(`<li><a class="vcard vcard-all" href="${ctx.url('/commercial-holiday-lighting/')}"><span class="vcard-t">${esc(commercial.name)}${icon('arrow')}</span><span class="vcard-s">${esc(commercial.summary)}</span></a></li>`)
    .join('');

  return `${hero}

<section class="sec sec-overview" aria-labelledby="overview-title">
  <div class="wrap overview">
    <div class="overview-copy" data-reveal>
      <h2 id="overview-title">One company, start to finish</h2>
      <p class="lead">${esc(v.intro)}</p>
    </div>
    <div class="scope-card" data-reveal>
      <p class="scope-h">Your estimate can include</p>
      ${ticks(v.scope)}
      <a class="btn btn-glow btn-sm" href="#estimate" data-cta="estimate" data-placement="scope"><span>Get my free estimate</span>${icon('arrow')}</a>
    </div>
  </div>
</section>

${needs}

<section class="sec sec-comp" aria-labelledby="work-title">
  <div class="wrap">
    <div class="split-head" data-reveal>
      <h2 id="work-title" class="h-quiet">Our own work</h2>
      <p class="lead-s"><a class="tlink" href="${ctx.url('/our-work/')}">More photos and footage${icon('arrow')}</a></p>
    </div>
    ${composition(ctx, setup.comp)}
  </div>
</section>

<section class="sec sec-process" aria-labelledby="process-title">
  <div class="wrap">
    <div class="split-head" data-reveal>
      <h2 id="process-title">How it works</h2>
      <p class="lead-s">${esc(copy.process.intro)}</p>
    </div>
    ${processRow(processSteps(ctx, 'commercial'))}
  </div>
</section>

<section class="sec sec-faq" aria-labelledby="faq-title">
  <div class="wrap faq-wrap">
    <div class="faq-side" data-reveal>
      <h2 id="faq-title">Before you book</h2>
      <a class="tlink" href="${ctx.url('/faq/')}">All holiday lighting questions${icon('arrow')}</a>
      ${relatedGuide(ctx, 'commercial-holiday-lighting')}
    </div>
    <div data-reveal>${faqList(v.faqs)}</div>
  </div>
</section>

<section class="sec sec-verticals vt-others" aria-labelledby="vert-title">
  <div class="wrap">
    <h2 id="vert-title" class="h-quiet" data-reveal>Other commercial properties</h2>
    <ul class="vcards vcards-page" data-reveal>${others}</ul>
  </div>
</section>

<section class="sec sec-local-links" aria-labelledby="near-title">
  <div class="wrap">
    <div class="split-head" data-reveal>
      <h2 id="near-title">${esc(commercial.name)} near you</h2>
      <p class="lead-s">Choose your community for local details and a free estimate with your city already filled in.</p>
    </div>
    <div data-reveal>${countyPills(ctx, { hrefFor: (c) => `/commercial-holiday-lighting/${c.slug}/` })}</div>
  </div>
</section>

${closing(ctx, page, { heading: v.cta_line, text: '', photoName: setup.close, anchor: 'estimate-close', formOpts: presets })}`;
}
