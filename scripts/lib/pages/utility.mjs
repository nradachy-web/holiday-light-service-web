// /thank-you/ (always noindex, fires no events by itself) and the custom 404.
import { esc, riseWords } from '../html.mjs';
import { icon } from '../icons.mjs';
import { STRINGS } from '../roofline.mjs';
import { phoneLink } from '../layout.mjs';

function textHero(ctx, { h1, text, actions, cls = '', after = '' }) {
  return `<section class="text-hero${cls ? ' ' + cls : ''}" aria-labelledby="page-title">
  <div class="text-hero-media">${ctx.media.photo('town-harbor-aerial', { sizes: '100vw', alt: '', eager: true })}</div>
  <div class="text-hero-scrim"></div>
  <div class="wrap text-hero-in">
    <div class="text-hero-roof">${STRINGS.eave()}</div>
    <h1 class="page-title" id="page-title" data-rise>${riseWords(h1)}</h1>
    <p class="page-sub" data-fade style="--d:300ms">${esc(text)}</p>
    <div class="page-actions" data-fade style="--d:420ms" data-bar-hide>${actions}</div>
    ${after}
  </div>
</section>`;
}

// What happens next, repeated from the contact page, plus a recap of the request that site.js fills
// from sessionStorage after a confirmed send (choices only, never name, phone or email).
function thanksNext(ctx) {
  const steps = ctx.content.copy.contact.next_steps;
  return `<div class="ty-next" data-fade style="--d:520ms">
      <p class="ty-recap" data-request-recap hidden></p>
      <h2 class="ty-h">What happens next</h2>
      <ol class="next">${steps.map(([t, p], i) => `<li><span class="next-n" aria-hidden="true">${i + 1}</span><div><h3>${esc(t)}</h3><p>${esc(p)}</p></div></li>`).join('')}</ol>
      <p class="ty-wait"><span class="ty-wait-k">While you wait</span><a class="tlink tlink-sm" href="${ctx.url('/guides/')}">Holiday lighting guides${icon('arrow')}</a><a class="tlink tlink-sm" href="${ctx.url('/our-work/')}">Our work${icon('arrow')}</a></p>
    </div>`;
}

export default function utilityPages(ctx) {
  const { copy } = ctx.content;
  const T = copy.thank_you;
  const N = copy.not_found;
  return [
    {
      path: '/thank-you/',
      type: 'thanks',
      title: T.title,
      description: 'Your holiday lighting estimate request was sent. Holiday Light Service will follow up to talk through your property, your ideas and your timing.',
      noindex: true,
      listed: false,
      estimateHref: ctx.url('/contact/'),
      body: (ctx) =>
        textHero(ctx, {
          h1: T.h1,
          text: T.text,
          actions: `${phoneLink('thank_you', { cls: 'btn btn-glow btn-lg' })}<a class="btn btn-line btn-lg" href="${ctx.url('/our-work/')}"><span>See our work</span>${icon('arrow')}</a>`,
          cls: 'text-hero-thanks',
          after: thanksNext(ctx),
        }),
    },
    {
      path: '/404.html',
      file: '404.html',
      type: 'notfound',
      title: N.title,
      description: 'This page could not be found. Find your community or request a free holiday lighting estimate from Holiday Light Service.',
      noindex: true,
      listed: false,
      estimateHref: ctx.url('/contact/'),
      body: (ctx) =>
        textHero(ctx, {
          h1: N.h1,
          text: N.text,
          actions: `<a class="btn btn-glow btn-lg" href="${ctx.url('/')}"><span>Home page</span>${icon('arrow')}</a><a class="btn btn-line btn-lg" href="${ctx.url('/service-area/')}"><span>Service area</span></a>${phoneLink('not_found', { cls: 'btn btn-line btn-lg' })}`,
        }),
    },
  ];
}
