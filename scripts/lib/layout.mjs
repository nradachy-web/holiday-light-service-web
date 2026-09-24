// Site chrome: header, mobile navigation, footer and the sticky mobile bar.
import { esc } from './html.mjs';
import { icon, wordmark } from './icons.mjs';
import { BUSINESS as B } from './config.mjs';

export const NAV = [
  ['Residential', '/christmas-light-installation/'],
  ['Commercial', '/commercial-holiday-lighting/'],
  ['Permanent', '/permanent-lighting/'],
  ['Service area', '/service-area/'],
  ['Our work', '/our-work/'],
];


const MORE = [
  ['Roofline lights', '/roofline-christmas-lights/'],
  ['Trees and shrubs', '/tree-and-shrub-lighting/'],
  ['Landscape lighting', '/landscape-lighting/'],
  ['How it works', '/process/'],
  ['About', '/about/'],
  ['Questions', '/faq/'],
  ['Guides', '/guides/'],
  ['Contact', '/contact/'],
];

export function brand(ctx, cls = '') {
  return `<a class="brand${cls ? ' ' + cls : ''}" href="${ctx.url('/')}" aria-label="${B.name}, home">${wordmark()}</a>`;
}

// Phone link. Every tel: link on the site goes through here so tracking hooks stay consistent.
export function phoneLink(placement, { cls = 'btn btn-line', label = `Call ${B.phone}`, iconFirst = true, aria } = {}) {
  return `<a class="${cls}" href="${B.tel}" data-contact="phone" data-placement="${placement}"${aria ? ` aria-label="${esc(aria)}"` : ''}>${iconFirst ? icon('phone') : ''}<span>${esc(label)}</span></a>`;
}

export function estimateLink(ctx, page, placement, { cls = 'btn btn-glow', label = 'Get my free estimate', arrow = true, preset = '' } = {}) {
  return `<a class="${cls}" href="${esc(page.estimateHref)}" data-cta="estimate" data-placement="${placement}"${preset}><span>${esc(label)}</span>${arrow ? icon('arrow') : ''}</a>`;
}

function navState(page, href) {
  if (page.path === href) return ' aria-current="page"';
  if (href !== '/' && page.path.startsWith(href)) return ' class="is-section"';
  if (page.navSection === href) return ' class="is-section"';
  return '';
}

export function header(ctx, page) {
  const link = ([t, h]) => `<a href="${ctx.url(h)}"${navState(page, h)}>${t}</a>`;
  // The commercial property types sit under Commercial in both navs, so the HOA manager and the
  // downtown director reach their page in one step.
  const subs = ctx.content.copy.verticals.map((v) => link([v.name, `/commercial/${v.slug}/`])).join('');
  // Desktop: Commercial opens a short list of the property types on hover or keyboard focus.
  const links = NAV.map(([t, h]) =>
    h === '/commercial-holiday-lighting/'
      ? `<div class="nav-item has-sub">${link([t, h])}<div class="nav-sub"><p class="nav-sub-h">Commercial property types</p>${subs}</div></div>`
      : link([t, h])
  ).join('');
  const mobileLinks = NAV.map(([t, h]) => (h === '/commercial-holiday-lighting/' ? `${link([t, h])}<div class="mnav-sub">${subs}</div>` : link([t, h]))).join('');
  const more = MORE.map(link).join('');
  // After a request is sent, the header offers the phone number instead of another estimate.
  const thanks = page.type === 'thanks';
  const cta = thanks ? '' : `<a class="btn btn-glow btn-sm hdr-cta" href="${esc(page.estimateHref)}" data-cta="estimate" data-placement="header">Free estimate</a>`;
  return `<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header" data-header>
  <div class="hdr">
    ${brand(ctx)}
    <nav class="nav" aria-label="Main">${links}</nav>
    <div class="hdr-actions">
      <a class="hdr-phone${thanks ? ' hdr-phone-full' : ''}" href="${B.tel}" data-contact="phone" data-placement="header" aria-label="Call ${B.phone}"><span class="hdr-phone-ic">${icon('phone')}</span><span class="hdr-phone-num">${B.phone}</span></a>
      ${cta}
      <button class="menu-btn" type="button" aria-expanded="false" aria-controls="mnav" data-menu>${icon('menu', 'i-open')}${icon('close', 'i-close')}<span class="sr-only">Menu</span></button>
    </div>
  </div>
  <div class="mnav" id="mnav" data-mnav hidden>
    <nav class="mnav-main" aria-label="Mobile">${mobileLinks}</nav>
    <nav class="mnav-more" aria-label="More pages">${more}</nav>
    <div class="mnav-cta">
      ${phoneLink('mobile_menu')}
      ${thanks ? '' : estimateLink(ctx, page, 'mobile_menu')}
    </div>
  </div>
</header>`;
}

export function footer(ctx, page) {
  const { copy, counties } = ctx.content;
  const col = (title, items) => `<div class="f-col"><h2 class="f-h">${title}</h2><ul>${items.map(([t, h]) => `<li><a href="${h.startsWith('http') ? h : ctx.url(h)}">${esc(t)}</a></li>`).join('')}</ul></div>`;
  const area = counties
    .map((g) => `<div class="f-county"><h3 class="f-ch">${esc(g.county)}</h3><ul>${g.cities.map((c) => `<li><a href="${ctx.url(`/service-area/${c.slug}/`)}">${esc(c.name)}</a></li>`).join('')}</ul></div>`)
    .join('');
  return `<footer class="site-footer">
  <div class="wrap">
    <div class="f-top">
      <div class="f-brand">
        ${brand(ctx)}
        <p>${esc(copy.home.meta_description)}</p>
        <a class="f-phone" href="${B.tel}" data-contact="phone" data-placement="footer">${B.phone}</a>
        ${estimateLink(ctx, page, 'footer')}
      </div>
      <div class="f-cols">
        ${col('Services', copy.services.map((s) => [s.name, `/${s.slug}/`]))}
        ${col('Commercial', copy.verticals.map((v) => [v.name, `/commercial/${v.slug}/`]))}
        ${col('Company', [['Our work', '/our-work/'], ['How it works', '/process/'], ['About', '/about/'], ['Questions', '/faq/'], ['Guides', '/guides/'], ['Contact', '/contact/'], ['Facebook', B.facebook]])}
      </div>
    </div>
    <div class="f-area">
      <h2 class="f-h f-h-glow"><a href="${ctx.url('/service-area/')}">Serving Southeast Michigan</a></h2>
      <div class="f-counties">${area}</div>
    </div>
    <div class="f-base">
      <p>${esc(B.family)}</p>
      <p>&copy; ${ctx.year} ${B.name}</p>
      <p><a href="${ctx.url('/privacy/')}">Privacy</a></p>
      <p class="f-credit"><a href="${B.creditUrl}">${esc(B.credit)}</a></p>
    </div>
  </div>
</footer>`;
}

// The sticky phone bar shows the number itself, not just "Call". It is left off the thank-you page,
// where asking for another estimate would be the wrong next step.
export function mobileBar(ctx, page) {
  if (page.type === 'thanks') return '';
  return `<div class="mobile-bar" data-mobile-bar role="region" aria-label="Call or request an estimate">
  <a class="btn btn-line mb-call" href="${B.tel}" data-contact="phone" data-placement="mobile_bar" aria-label="Call ${B.phone}">${icon('phone')}<span>${B.phone}</span></a>
  <a class="btn btn-glow mb-est" href="${esc(page.estimateHref)}" data-cta="estimate" data-placement="mobile_bar"><span>Free estimate</span>${icon('arrow')}</a>
</div>`;
}
