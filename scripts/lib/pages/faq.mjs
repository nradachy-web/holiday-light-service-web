// /faq/: every question from site-copy faq.items as <details> accordions, grouped under short
// labels, with FAQPage JSON-LD from the same array. The estimate form rides beside the list on
// desktop and closes the page on phones. The guides follow.
import { esc } from '../html.mjs';
import { icon } from '../icons.mjs';
import { faqList, faqSchema } from '../blocks.mjs';
import { quoteForm } from '../form.mjs';
import { phoneLink, estimateLink } from '../layout.mjs';
import { pageHead, guideCard } from '../pagekit.mjs';

// Groups are matched by the question's opening words, so a reworded answer never moves a question.
// Anything unmatched lands in the last group, and the build fails if a question would be dropped.
const GROUPS = [
  ['timing', 'Timing and booking', [/^How far ahead/, /^When do the lights go up/, /^What happens if the weather/]],
  ['estimates', 'Estimates and service', [/^What is included/, /^How do estimates work/, /^Do commercial projects/, /^What if some lights stop/]],
  ['property', 'Your property', [/^Do I need HOA approval/, /^Can you reach tall trees/, /^Do I need extra outlets/, /^How should I prepare/]],
  ['more', 'Permanent, landscape and service area', [/^What is the difference between permanent/, /^Do you offer landscape/, /^What areas do you serve/]],
];

export function groupFaqs(items) {
  const used = new Set();
  const groups = GROUPS.map(([id, label, res]) => {
    const list = [];
    for (const re of res) {
      const i = items.findIndex(([q], k) => !used.has(k) && re.test(q));
      if (i >= 0) {
        used.add(i);
        list.push(items[i]);
      }
    }
    return { id, label, list };
  });
  const rest = items.filter((_, k) => !used.has(k));
  groups[groups.length - 1].list.push(...rest);
  const count = groups.reduce((a, g) => a + g.list.length, 0);
  if (count !== items.length) throw new Error(`FAQ grouping lost questions (${count} of ${items.length})`);
  return groups.filter((g) => g.list.length);
}

export default function faqPages(ctx) {
  const F = ctx.content.copy.faq;
  return [
    {
      path: '/faq/',
      type: 'faq',
      title: F.title,
      description: F.meta_description,
      estimateHref: '#estimate',
      crumbs: [{ name: 'Questions', href: '/faq/' }],
      schemas: [faqSchema(F.items)],
      body: (ctx, page) => faqBody(ctx, page, F),
    },
  ];
}

function faqBody(ctx, page, F) {
  const groups = groupFaqs(F.items);
  const form = quoteForm(ctx, page, { placement: 'faq', anchor: 'estimate', heading: 'Get my free estimate' });
  const jump = groups.map((g) => `<li><a class="pill pill-sm" href="#q-${g.id}">${esc(g.label)}</a></li>`).join('');
  const blocks = groups
    .map(
      (g, i) => `<section class="fq-group" id="q-${g.id}" aria-labelledby="q-${g.id}-title" data-reveal>
      <h2 class="fq-h" id="q-${g.id}-title">${esc(g.label)}</h2>
      ${faqList(g.list, { openFirst: i === 0 })}
    </section>`
    )
    .join('');
  const guides = ctx.content.copy.guides;

  return `<div class="fq-page">
  <div class="fq-bg" aria-hidden="true">${ctx.media.photo('downtown-sidewalk-night', { sizes: '100vw', alt: '' })}</div>
  <div class="wrap fq-grid">
    ${pageHead(ctx, page, {
      crumbItems: [{ name: 'Questions' }],
      h1: F.h1,
      sub: F.intro,
      actions: `${phoneLink('faq_head', { cls: 'btn btn-line' })}${estimateLink(ctx, page, 'faq_head', { cls: 'btn btn-glow fq-est' })}`,
      cls: 'fq-head',
    })}
    <nav class="fq-jump" aria-label="Question topics"><ul>${jump}</ul></nav>
    <div class="fq-list">${blocks}</div>
    <aside class="fq-form" aria-label="Free estimate">${form}</aside>
  </div>
</div>

<section class="sec fq-guides" aria-labelledby="guides-title">
  <div class="wrap">
    <div class="split-head" data-reveal>
      <h2 id="guides-title">Guides</h2>
      <p class="lead-s">${esc(ctx.content.copy.guides_hub.intro)}</p>
    </div>
    <div class="gcards gcards-4">${guides.map((g) => guideCard(ctx, g)).join('')}</div>
    <p class="fq-more" data-reveal><a class="tlink" href="${ctx.url('/guides/')}">All guides${icon('arrow')}</a></p>
  </div>
</section>`;
}
