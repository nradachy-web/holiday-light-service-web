// /process/: the five steps as a vertical light string with our own photos, the season string,
// a few practical questions and the closing form. The form also sits beside the H1.
import { esc } from '../html.mjs';
import { icon } from '../icons.mjs';
import { STRINGS } from '../roofline.mjs';
import { splitHero, heroFrame } from '../heroes.mjs';
import { seasonString, spellsOut, faqList } from '../blocks.mjs';
import { quoteForm } from '../form.mjs';
import { closing } from '../sections.mjs';
import { phoneLink, estimateLink } from '../layout.mjs';
import { processSteps } from '../pagekit.mjs';
import { BUSINESS } from '../config.mjs';

// Questions from the FAQ that belong next to the steps, matched by their opening words.
const PRACTICAL = [/^How do estimates work/, /^How should I prepare/, /^What happens if the weather/, /^What if some lights stop/];

export default function processPages(ctx) {
  const P = ctx.content.copy.process;
  return [
    {
      path: '/process/',
      type: 'process',
      title: P.title,
      description: P.meta_description,
      estimateHref: '#estimate',
      crumbs: [{ name: 'How it works', href: '/process/' }],
      schemas: [{ '@type': 'WebPage', name: P.h1, description: P.meta_description, url: ctx.abs('/process/'), about: { '@id': ctx.abs('/') + '#business' } }],
      body: (ctx, page) => processBody(ctx, page, P),
    },
  ];
}

function processBody(ctx, page, P) {
  const { copy } = ctx.content;
  const H = copy.home;
  const steps = processSteps(ctx, 'all');
  const form = quoteForm(ctx, page, { placement: 'hero', anchor: 'estimate', heading: 'Get my free estimate' });
  const hero = splitHero(ctx, page, {
    crumbItems: [{ name: 'How it works' }],
    eyebrow: 'Free estimates',
    h1: P.h1,
    sub: P.intro,
    deco: STRINGS.eave(),
    media: heroFrame(ctx, ['evergreens-warm-white', 'downtown-sidewalk-wraps']),
    form,
  });

  // What sits beside each step: actions, a photo, the estimate checklist.
  const extras = [
    `<div class="psv-act">${estimateLink(ctx, page, 'process_step', { cls: 'btn btn-glow btn-sm' })}${phoneLink('process_step', { cls: 'tlink tlink-sm', label: `Or call ${BUSINESS.phone}` })}</div>`,
    { photo: 'roofline-large-home', ar: '900/418' },
    `<div class="psv-spells">${spellsOut()}</div>`,
    { photo: 'bucket-truck-roofline-install', ar: '4/3' },
    `<p class="psv-more"><a class="tlink tlink-sm" href="${ctx.url('/faq/')}">Questions about in-season service${icon('arrow')}</a></p>`,
  ];

  const list = steps
    .map(([t, p], i) => {
      const x = extras[i];
      const fig = x && typeof x === 'object' ? `<figure class="comp-fig psv-fig fit1x" style="${ctx.media.fit(x.photo)};--ar:${x.ar}">${ctx.media.photo(x.photo, { sizes: '(min-width: 1000px) 560px, 100vw' })}<figcaption>${esc(ctx.media.caption(x.photo))}</figcaption></figure>` : '';
      const inline = typeof x === 'string' ? x : '';
      return `<li class="psv-step${fig ? ' has-fig' : ''}" data-reveal>
      <span class="psv-n" aria-hidden="true">${i + 1}</span>
      <div class="psv-body">
        <p class="psv-k">Step ${i + 1} of ${steps.length}</p>
        <h3>${esc(t)}</h3>
        <p>${esc(p)}</p>
        ${inline}
      </div>
      ${fig}
    </li>`;
    })
    .join('');

  const practical = PRACTICAL.map((re) => copy.faq.items.find(([q]) => re.test(q))).filter(Boolean);

  return `${hero}

<section class="sec pr-steps" aria-labelledby="steps-title">
  <div class="wrap">
    <div class="split-head" data-reveal>
      <h2 id="steps-title">Five steps, one company</h2>
      <p class="lead-s">${esc(copy.contact.next_steps[2][1])}</p>
    </div>
    <ol class="psv">${list}</ol>
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

<section class="sec sec-faq" aria-labelledby="faq-title">
  <div class="wrap faq-wrap">
    <div class="faq-side" data-reveal>
      <h2 id="faq-title">Practical questions</h2>
      <a class="tlink" href="${ctx.url('/faq/')}">All holiday lighting questions${icon('arrow')}</a>
    </div>
    <div data-reveal>${faqList(practical)}</div>
  </div>
</section>

${closing(ctx, page, { heading: P.closing.heading, text: P.closing.text, photoName: 'town-blue-hour-aerial', anchor: 'estimate-close' })}`;
}
