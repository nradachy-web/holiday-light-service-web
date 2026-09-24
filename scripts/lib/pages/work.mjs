// /our-work/: four chapters from site-copy our_work, each a curated, captioned composition of our
// own photos and footage. Static layouts only: no filters, no expand icons, no lightbox, no grid
// catalog. Each chapter can preset the estimate form at the close.
import { esc, pad2 } from '../html.mjs';
import { icon } from '../icons.mjs';
import { closing } from '../sections.mjs';
import { mediaHero } from '../pagekit.mjs';

// Per chapter: where it leads, the preset it offers and the composition. Each item is a photo or
// a footage clip with a crop ratio; placement lives in site.css (.wk-<subject> .wk-<slot>).
const CHAPTERS = {
  residential: {
    id: 'homes',
    preset: { property: 'Home', label: 'Get a home estimate' },
    link: ['Christmas light installation', '/christmas-light-installation/'],
    items: [
      { slot: 'a', name: 'roofline-large-home', ar: '900/418', sizes: '(min-width: 761px) 560px, 100vw' },
      { slot: 'b', name: 'evergreens-warm-white', ar: '1/1', sizes: '(min-width: 1000px) 520px, 100vw' },
      { slot: 'c', name: 'residential-multicolor-canopy', ar: '3/4', sizes: '(min-width: 1000px) 300px, 50vw' },
      { slot: 'd', name: 'residential-birch-wraps', ar: '3/4', sizes: '(min-width: 1000px) 420px, 50vw' },
    ],
  },
  commercial: {
    id: 'commercial',
    preset: { property: 'Business', label: 'Book a walkthrough' },
    link: ['Commercial holiday lighting', '/commercial-holiday-lighting/'],
    items: [
      { slot: 'a', video: 'downtown-wraps', ar: '21/9' },
      { slot: 'b', name: 'downtown-wrapped-trees-night', ar: '16/10', sizes: '(min-width: 1000px) 860px, 100vw' },
      { slot: 'c', name: 'downtown-sidewalk-wraps', ar: '3/4', sizes: '(min-width: 1000px) 420px, 100vw' },
      { slot: 'd', name: 'waterfront-tree-night', ar: '4/5', focal: '52% 50%', sizes: '(min-width: 1000px) 420px, 100vw' },
    ],
  },
  entrance: {
    id: 'entrances',
    preset: { property: 'HOA or subdivision', label: 'Get an entrance estimate' },
    link: ['HOA and subdivision entrances', '/commercial/hoa-and-subdivision-entrances/'],
    // Warm white leads: the pavilion roofline at its own proportions beside the chapter head, then the
    // lit trees on an office building's grounds, with the green entrance smaller beside them. The green
    // spruce stays off this page so the chapter never reads as a section of color (DESIGN.md photo rules).
    items: [
      { slot: 'a', name: 'pavilion-roofline-lights', ar: '1500/454', sizes: '(min-width: 1000px) 860px, 100vw' },
      { slot: 'b', name: 'commercial-building-lit-trees', ar: '16/10', focal: '50% 38%', sizes: '(min-width: 1000px) 640px, 100vw' },
      { slot: 'c', name: 'subdivision-entrance-green-trees', ar: '4/3', sizes: '(min-width: 1000px) 540px, 100vw' },
    ],
  },
  crew: {
    id: 'crew',
    preset: null,
    link: ['How it works', '/process/'],
    items: [
      { slot: 'a', name: 'crew-bistro-install', ar: '16/10', sizes: '(min-width: 1000px) 860px, 100vw' },
      { slot: 'b', name: 'bucket-truck-roofline-install', ar: '4/3', sizes: '(min-width: 1000px) 540px, 100vw' },
      { slot: 'c', name: 'downtown-streetscape-daytime', ar: '3/4', sizes: '(min-width: 1000px) 420px, 100vw' },
    ],
  },
};

export default function workPages(ctx) {
  const W = ctx.content.copy.our_work;
  const images = W.sections.flatMap((s) => (CHAPTERS[s.subject]?.items || []).filter((i) => i.name).map((i) => ctx.content.mediaItem(i.name)));
  return [
    {
      path: '/our-work/',
      type: 'work',
      title: W.title,
      description: W.meta_description,
      estimateHref: '#estimate',
      crumbs: [{ name: 'Our work', href: '/our-work/' }],
      schemas: [
        {
          '@type': 'CollectionPage',
          name: W.h1,
          description: W.meta_description,
          url: ctx.abs('/our-work/'),
          hasPart: images.map((m) => ({
            '@type': 'ImageObject',
            contentUrl: ctx.abs(Object.entries(m.files.webp).sort((a, b) => b[0] - a[0])[0][1]),
            caption: m.caption,
          })),
        },
      ],
      body: (ctx, page) => workBody(ctx, page, W),
    },
  ];
}

function item(ctx, it, i, chapterId) {
  const d = `--d:${(i % 3) * 90}ms`;
  if (it.video) {
    const v = ctx.media.bgVideo(it.video, { id: `work-video-${chapterId}`, sizes: '(min-width: 1000px) 1320px, 100vw' });
    return `<figure class="comp-fig wk-fig wk-film wk-${it.slot}" style="--ar:${it.ar};${d}" data-reveal><div class="wk-film-box">${v.html}</div><figcaption><span>${esc(v.caption)}</span>${v.toggle}</figcaption></figure>`;
  }
  const [x, y] = it.ar.split('/').map(Number);
  const tall = x < y ? ' wk-p' : '';
  return `<figure class="comp-fig wk-fig wk-${it.slot}${tall}" style="--ar:${it.ar};${d}" data-reveal>${ctx.media.photo(it.name, { sizes: it.sizes, focal: it.focal })}<figcaption>${esc(ctx.media.caption(it.name))}</figcaption></figure>`;
}

function workBody(ctx, page, W) {
  const chapters = W.sections
    .map((s, n) => {
      const c = CHAPTERS[s.subject];
      if (!c) throw new Error('No composition for our_work subject ' + s.subject);
      const preset = c.preset
        ? `<a class="btn btn-glow btn-sm" href="#estimate" data-cta="estimate" data-placement="work_${c.id}" data-preset-property="${esc(c.preset.property)}"><span>${esc(c.preset.label)}</span>${icon('arrow')}</a>`
        : '';
      return `<section class="sec wk wk-${s.subject}" id="${c.id}" aria-labelledby="wk-${c.id}-title">
  <div class="wrap wk-grid">
    <header class="wk-head" data-reveal>
      <p class="wk-n"><span>${pad2(n + 1)}</span> / ${pad2(W.sections.length)}</p>
      <h2 id="wk-${c.id}-title">${esc(s.heading)}</h2>
      <p class="lead-s">${esc(s.text)}</p>
      <div class="wk-act">${preset}<a class="tlink tlink-sm" href="${ctx.url(c.link[1])}">${esc(c.link[0])}${icon('arrow')}</a></div>
    </header>
    ${c.items.map((it, i) => item(ctx, it, i, c.id)).join('\n    ')}
  </div>
</section>`;
    })
    .join('\n\n');

  return `${mediaHero(ctx, page, {
    crumbItems: [{ name: 'Our work' }],
    h1: W.h1,
    sub: W.intro,
    video: 'park-tree-wraps',
    cls: 'mhero-work',
  })}

${chapters}

${closing(ctx, page, { heading: W.closing.heading, text: W.closing.text, photoName: 'town-blue-hour-aerial', anchor: 'estimate' })}`;
}
