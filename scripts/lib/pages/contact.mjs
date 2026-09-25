// /contact/: the estimate form first (beside the H1 on desktop, right after it on phones), then the
// phone, what happens next, where we work and the questions people ask before they call.
// No street address: none is verified.
import { esc, riseWords } from '../html.mjs';
import { icon } from '../icons.mjs';
import { STRINGS } from '../roofline.mjs';
import { crumbs, countyPills, faqList } from '../blocks.mjs';
import { quoteForm } from '../form.mjs';
import { BUSINESS as B } from '../config.mjs';

const BEFORE_YOU_CALL = [/^How do estimates work/, /^What is included/, /^How far ahead/, /^What areas do you serve/];

export default function contactPages(ctx) {
  const C = ctx.content.copy.contact;
  return [
    {
      path: '/contact/',
      type: 'contact',
      title: C.title,
      description: C.meta_description,
      estimateHref: '#estimate',
      crumbs: [{ name: 'Contact', href: '/contact/' }],
      schemas: [{ '@type': 'ContactPage', name: C.h1, description: C.meta_description, url: ctx.abs('/contact/'), mainEntity: { '@id': ctx.abs('/') + '#business' } }],
      body: (ctx, page) => contactBody(ctx, page, C),
    },
  ];
}

function contactBody(ctx, page, C) {
  const { copy } = ctx.content;
  const form = quoteForm(ctx, page, { placement: 'hero', anchor: 'estimate', heading: 'Get my free estimate', compact: true });
  const next = C.next_steps.map(([t, p], i) => `<li><span class="next-n" aria-hidden="true">${i + 1}</span><div><h3>${esc(t)}</h3><p>${esc(p)}</p></div></li>`).join('');
  const faqs = BEFORE_YOU_CALL.map((re) => copy.faq.items.find(([q]) => re.test(q))).filter(Boolean);

  return `<section class="ct-hero" aria-labelledby="page-title">
  <div class="ct-media">${ctx.media.photo('town-blue-hour-aerial', { sizes: '100vw', alt: '' })}</div>
  <div class="ct-scrim"></div>
  <div class="wrap ct-grid">
    <div class="ct-head">
      ${crumbs(ctx, [{ name: 'Contact' }])}
      <p class="eyebrow ct-eyebrow">Free estimates</p>
      <h1 class="phead-title" id="page-title" data-rise>${riseWords(C.h1)}</h1>
      <div class="sh-deco">${STRINGS.eave()}</div>
      <p class="phead-sub" data-fade style="--d:260ms">${esc(C.intro)}</p>
    </div>
    <div class="ct-form">${form}</div>
    <div class="ct-more" data-fade style="--d:420ms">
      <a class="big-phone" href="${B.tel}" data-contact="phone" data-placement="contact">${icon('phone')}<span><span class="big-phone-k">Prefer to talk it through?</span>${B.phone}</span></a>
      <h2 class="ct-h">What happens next</h2>
      <ol class="next">${next}</ol>
      <p class="media-cap ct-cap">Photo: ${esc(ctx.media.caption('town-blue-hour-aerial'))}</p>
    </div>
  </div>
</section>

<section class="sec ct-area" aria-labelledby="area-title">
  <div class="wrap area">
    <div class="area-copy" data-reveal>
      <h2 id="area-title">${esc(copy.home.area_heading)}</h2>
      <p class="lead-s">${esc(copy.home.area_intro)}</p>
      <a class="tlink" href="${ctx.url('/service-area/')}">The full service area${icon('arrow')}</a>
      <p class="ct-social"><a class="tlink tlink-sm" href="${B.facebook}" rel="noopener">Holiday Light Service on Facebook${icon('arrow')}</a></p>
    </div>
    <div data-reveal>${countyPills(ctx)}</div>
  </div>
</section>

<section class="sec sec-faq ct-faq" aria-labelledby="faq-title">
  <div class="wrap faq-wrap">
    <div class="faq-side" data-reveal>
      <h2 id="faq-title">Before you call</h2>
      <a class="tlink" href="${ctx.url('/faq/')}">All holiday lighting questions${icon('arrow')}</a>
    </div>
    <div data-reveal>${faqList(faqs)}</div>
  </div>
</section>`;
}
