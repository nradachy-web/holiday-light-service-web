// /about/: the story, the values and what we light. The single Ace Outdoor Services family
// mention on the page is the last story paragraph from site-copy (the footer carries the other).
import { esc, pad2 } from '../html.mjs';
import { icon } from '../icons.mjs';
import { statement } from '../blocks.mjs';
import { closing } from '../sections.mjs';
import { mediaHero } from '../pagekit.mjs';

export default function aboutPages(ctx) {
  const A = ctx.content.copy.about;
  return [
    {
      path: '/about/',
      type: 'about',
      title: A.title,
      description: A.meta_description,
      estimateHref: '#estimate',
      crumbs: [{ name: 'About', href: '/about/' }],
      schemas: [{ '@type': 'AboutPage', name: A.h1, description: A.meta_description, url: ctx.abs('/about/'), about: { '@id': ctx.abs('/') + '#business' } }],
      body: (ctx, page) => aboutBody(ctx, page, A),
    },
  ];
}

function aboutBody(ctx, page, A) {
  const { copy } = ctx.content;
  const { figure } = ctx.media;
  const story = A.story;
  if (story.length < 4) throw new Error('about.story needs four paragraphs');
  // The first paragraph is the lit statement; its last sentence carries the glow.
  const first = story[0];
  const lastSentence = first.split(/(?<=\.)\s+/).pop();
  const family = story.find((p) => /Ace Outdoor Services/.test(p));
  const body = story.slice(1).filter((p) => p !== family);

  const values = A.values
    .map(([t, p], i) => `<li class="ccard value" data-reveal style="--d:${i * 80}ms"><span class="ccard-n">${pad2(i + 1)}</span><h3>${esc(t)}</h3><p>${esc(p)}</p></li>`)
    .join('');

  const services = copy.services
    .map((s) => `<li><a class="vcard" href="${ctx.url(`/${s.slug}/`)}"><span class="vcard-t">${esc(s.name)}${icon('arrow')}</span><span class="vcard-s">${esc(s.summary)}</span></a></li>`)
    .join('');

  return `${mediaHero(ctx, page, {
    crumbItems: [{ name: 'About' }],
    eyebrow: 'About Holiday Light Service',
    h1: A.h1,
    sub: A.intro,
    photo: 'downtown-wrapped-trees-night',
    focal: '50% 42%',
    cls: 'mhero-about',
  })}

<section class="statement" aria-label="About us">
  <div class="wrap statement-in">${statement(first, lastSentence)}</div>
</section>

<section class="sec ab-story" aria-labelledby="story-title">
  <div class="wrap ab-grid">
    <div class="ab-copy" data-reveal>
      <h2 id="story-title" class="h-quiet">Our story</h2>
      ${body.map((p) => `<p class="lead-body">${esc(p)}</p>`).join('')}
      ${family ? `<p class="ab-family">${esc(family)}</p>` : ''}
    </div>
    ${figure('bucket-truck-roofline-install', { sizes: '(min-width: 1000px) 640px, 100vw', cls: 'comp-fig ab-fig ab-fig-a' }).replace('<figure ', '<figure data-reveal ')}
    ${figure('downtown-streetscape-daytime', { sizes: '(min-width: 1000px) 400px, 100vw', cls: 'comp-fig ab-fig ab-fig-b' }).replace('<figure ', '<figure data-reveal ')}
    ${figure('crew-bistro-install', { sizes: '(min-width: 1000px) 640px, 100vw', cls: 'comp-fig ab-fig ab-fig-c' }).replace('<figure ', '<figure data-reveal ')}
  </div>
</section>

<section class="sec ab-values" aria-labelledby="values-title">
  <div class="wrap">
    <h2 id="values-title" class="ab-h" data-reveal>How we work</h2>
    <ol class="cards4">${values}</ol>
  </div>
</section>

<section class="sec ab-services" aria-labelledby="services-title">
  <div class="wrap">
    <div class="split-head" data-reveal>
      <h2 id="services-title">${esc(copy.home.services_heading)}</h2>
      <p class="lead-s">${esc(A.services_intro)}</p>
    </div>
    <ul class="vcards ab-vcards" data-reveal>${services}</ul>
    <p class="ab-more" data-reveal><a class="tlink" href="${ctx.url('/our-work/')}">See our work${icon('arrow')}</a><a class="tlink" href="${ctx.url('/process/')}">How it works${icon('arrow')}</a><a class="tlink" href="${ctx.url('/service-area/')}">The full service area${icon('arrow')}</a></p>
  </div>
</section>

${closing(ctx, page, { heading: A.closing.heading, text: A.closing.text, photoName: 'town-harbor-aerial', anchor: 'estimate' })}`;
}
