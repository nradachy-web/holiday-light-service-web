// Home: hero with the roofline switch-on, the lit statement, property paths, What we light,
// the season string, the commercial band, permanent scenes, the crew, the service area and the close.
import { esc } from '../html.mjs';
import { icon } from '../icons.mjs';
import { homeHero } from '../heroes.mjs';
import { statement, switcher, seasonString, sceneSwitcher, countyPills } from '../blocks.mjs';
import { closing } from '../sections.mjs';

export default function homePages(ctx) {
  const { copy } = ctx.content;
  const H = copy.home;
  return [
    {
      path: '/',
      type: 'home',
      title: H.title,
      description: H.meta_description,
      estimateHref: '#estimate',
      body: (ctx, page) => homeBody(ctx, page, H),
    },
  ];
}

function homeBody(ctx, page, H) {
  const { copy, service, vertical } = ctx.content;
  const { photo, figure, caption } = ctx.media;

  // Each card has its own photo (none repeats in the switcher below) and its own line, so the home
  // page does not say the same thing twice.
  const T = H.paths;
  const paths = [
    { key: 'home', title: 'Homes', text: T.home, photo: 'bucket-truck-roofline-install', property: 'Home', cta: 'Get a home estimate', link: ['See residential lighting', '/christmas-light-installation/'] },
    // The pavilion is a panorama: it keeps its own proportions in the card frame (native), never a crop.
    { key: 'hoa', title: 'HOAs and entrances', text: T.hoa, photo: 'pavilion-roofline-lights', native: true, property: 'HOA or subdivision', cta: 'Get an entrance estimate', link: ['See HOA lighting', '/commercial/hoa-and-subdivision-entrances/'] },
    { key: 'downtown', title: 'Downtowns and municipalities', text: T.downtown, photo: 'downtown-wrapped-trees-night', property: 'Downtown or municipality', lights: 'Trees and shrubs,Poles and lampposts', cta: 'Plan a downtown estimate', link: ['See downtown lighting', '/commercial/downtowns-and-municipalities/'] },
    { key: 'business', title: 'Businesses', text: T.business, photo: 'commercial-building-lit-trees', property: 'Business', cta: 'Book a walkthrough', link: ['See commercial lighting', '/commercial-holiday-lighting/'] },
  ];
  const pathCards = paths
    .map(
      (p, i) => `<li class="path" data-reveal style="--d:${i * 80}ms">
      <figure class="path-media${p.native ? ' path-native' : ''} fit1x" style="${ctx.media.fit(p.photo)}">${photo(p.photo, { sizes: '(min-width: 1241px) 300px, (min-width: 761px) 50vw, 100vw', focal: p.focal })}<figcaption>${esc(caption(p.photo))}</figcaption></figure>
      <div class="path-body">
        <h3>${esc(p.title)}</h3>
        <p>${esc(p.text)}</p>
      </div>
      <div class="path-actions">
        <a class="btn btn-glow btn-sm" href="#estimate" data-cta="estimate" data-placement="path_${p.key}" data-preset-property="${esc(p.property)}"${p.lights ? ` data-preset-light="${esc(p.lights)}"` : ''}><span>${esc(p.cta)}</span>${icon('arrow')}</a>
        <a class="tlink tlink-sm" href="${ctx.url(p.link[1])}">${esc(p.link[0])}${icon('arrow')}</a>
      </div>
    </li>`
    )
    .join('');

  const roof = service('roofline-christmas-lights');
  const trees = service('tree-and-shrub-lighting');
  const hoa = vertical('hoa-and-subdivision-entrances');
  const dt = vertical('downtowns-and-municipalities');
  const cats = [
    // The house photo is only 900px wide, so it keeps its own proportions (letterboxed on the night
    // ground) instead of a cover crop that would enlarge it past its pixels.
    { id: 'roof', label: 'Rooflines', layout: 'native', panes: ['roofline-large-home'], mpanes: ['roofline-large-home'], title: 'Rooflines', text: roof.hero_sub, list: roof.scope.slice(0, 4), link: ['Roofline Christmas lights', '/roofline-christmas-lights/'], add: 'Add roofline to my estimate', presetLight: 'Roofline' },
    { id: 'trees', label: 'Trees and shrubs', layout: 'tri', panes: ['evergreens-warm-white', 'residential-multicolor-canopy', 'residential-birch-wraps'], mpanes: ['evergreens-warm-white', 'residential-multicolor-canopy'], title: 'Trees and shrubs', text: trees.hero_sub, list: trees.scope.slice(0, 4), link: ['Tree and shrub lighting', '/tree-and-shrub-lighting/'], add: 'Add trees to my estimate', presetLight: 'Trees and shrubs' },
    { id: 'entrances', label: 'Entrances', layout: 'pair', panes: ['subdivision-entrance-green-trees', 'evergreens-warm-white'], mpanes: ['subdivision-entrance-green-trees', 'evergreens-warm-white'], title: 'HOA and subdivision entrances', text: hoa.hero_sub, list: hoa.scope.slice(0, 4), link: ['Entrance lighting', '/commercial/hoa-and-subdivision-entrances/'], add: 'Add an entrance to my estimate', presetLight: 'Entrance or sign', presetProperty: 'HOA or subdivision' },
    { id: 'downtowns', label: 'Downtowns', layout: 'pair', panes: ['downtown-storefront-wraps', 'downtown-sidewalk-wraps'], mpanes: ['downtown-storefront-wraps'], title: 'Downtowns and main streets', text: dt.hero_sub, list: dt.scope.slice(0, 4), link: ['Downtown and municipal lighting', '/commercial/downtowns-and-municipalities/'], add: 'Plan a downtown estimate', presetProperty: 'Downtown or municipality' },
  ];

  const band = ctx.media.bgVideo('downtown-wraps', { id: 'band-video', sizes: '100vw' });
  const commercial = service('commercial-holiday-lighting');
  // Commercial-specific one-liners, not the vertical summaries the property cards above already use.
  const vcards = copy.verticals
    .map((v) => `<li><a class="vcard" href="${ctx.url(`/commercial/${v.slug}/`)}"><span class="vcard-t">${esc(v.name)}${icon('arrow')}</span><span class="vcard-s">${esc(H.commercial_band.cards[v.slug] || v.summary)}</span></a></li>`)
    .join('');

  const crew = copy.our_work.sections.find((s) => s.subject === 'crew');
  const reasons = H.reasons.map(([t, p]) => `<li><h3>${esc(t)}</h3><p>${esc(p)}</p></li>`).join('');

  return `${homeHero(ctx, page)}

<section class="statement" aria-label="About our service">
  <div class="wrap statement-in">${statement(H.intro, 'No ladder for you.')}</div>
</section>

<section class="sec sec-paths" aria-labelledby="paths-title">
  <div class="wrap">
    <div class="paths-head" data-reveal>
      <h2 id="paths-title">Start with your property</h2>
      <p>Pick the kind of property and the estimate card fills in for you.</p>
    </div>
    <ul class="paths">${pathCards}</ul>
  </div>
</section>

<section class="sec sec-switch" id="what-we-light" aria-labelledby="wwl-title">
  <div class="wrap">
    <div class="sec-head" data-reveal>
      <div><p class="eyebrow">Our own work, after dark</p><h2 id="wwl-title">${esc(H.services_heading)}</h2></div>
      <p class="lead-s">${esc(H.services_intro)}</p>
    </div>
    <div data-reveal>${switcher(ctx, cats)}</div>
  </div>
</section>

<section class="sec sec-season" aria-labelledby="season-title">
  <div class="wrap">
    <div class="season-head" data-reveal>
      <h2 id="season-title">${esc(H.season_heading)}</h2>
      <p class="lead-s">Installs commonly run from October into early December, and takedown comes after the holidays. Booking earlier gives you more date options.</p>
    </div>
    <div data-reveal>${seasonString(H.season)}</div>
  </div>
</section>

<section class="band" aria-labelledby="band-title">
  <div class="wrap">
    <div class="band-frame">
      <div class="band-media">${band.html}<div class="band-scrim"></div></div>
      <h2 class="band-title" id="band-title">${esc(H.commercial_band.heading)}</h2>
      <div class="band-foot"><p class="media-cap">${esc(band.caption)}</p>${band.toggle}</div>
    </div>
    <div class="band-body">
      <div class="band-copy" data-reveal>
        <p class="lead">${esc(H.commercial_band.text)}</p>
        <div class="band-actions">
          <a class="btn btn-glow" href="#estimate" data-cta="estimate" data-placement="commercial_band" data-preset-property="Business"><span>${esc(commercial.cta_line.replace(/\.$/, ''))}</span>${icon('arrow')}</a>
          <a class="tlink" href="${ctx.url('/commercial-holiday-lighting/')}">Commercial holiday lighting${icon('arrow')}</a>
        </div>
      </div>
      <ul class="vcards" data-reveal>${vcards}</ul>
    </div>
  </div>
</section>

<section class="sec sec-perm" aria-labelledby="perm-title">
  <div class="wrap perm">
    <div class="perm-copy" data-reveal>
      <p class="eyebrow">Permanent lighting</p>
      <h2 id="perm-title">${esc(H.permanent_band.heading)}</h2>
      <p class="lead-s">${esc(H.permanent_band.text)}</p>
      <a class="tlink" href="${ctx.url('/permanent-lighting/')}">Permanent roofline lighting${icon('arrow')}</a>
    </div>
    <div class="perm-scene" data-reveal>${sceneSwitcher(ctx)}</div>
  </div>
</section>

<section class="sec sec-crew" aria-labelledby="crew-title">
  <div class="wrap crew">
    <div class="crew-copy" data-reveal>
      <h2 id="crew-title">${esc(crew.heading)}</h2>
      <p class="lead">${esc(crew.text)}</p>
      <ul class="reasons">${reasons}</ul>
    </div>
    ${figure('crew-bistro-install', { sizes: '(min-width: 1000px) 700px, 100vw', cls: 'cfig cfig-a' })}
    ${figure('downtown-streetscape-daytime', { sizes: '(min-width: 1000px) 460px, 100vw', cls: 'cfig cfig-b' })}
    ${figure('downtown-sidewalk-night', { sizes: '(min-width: 1000px) 760px, 100vw', cls: 'cfig cfig-c' })}
  </div>
</section>

<section class="sec sec-area" aria-labelledby="area-title">
  <div class="wrap area">
    <div class="area-copy" data-reveal>
      <h2 id="area-title">${esc(H.area_heading)}</h2>
      <p class="lead-s">${esc(H.area_intro)}</p>
      <a class="tlink" href="${ctx.url('/service-area/')}">The full service area${icon('arrow')}</a>
    </div>
    <div data-reveal>${countyPills(ctx)}</div>
  </div>
</section>

${closing(ctx, page, { heading: H.closing.heading, text: H.closing.text, photoName: 'town-blue-hour-aerial' })}`;
}
