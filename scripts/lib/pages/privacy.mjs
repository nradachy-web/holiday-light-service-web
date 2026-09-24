// /privacy/: what this website actually does with information, written from the build settings so
// it is never out of step with the code. The tag manager paragraph follows GTM_ID, the attribution
// cookie paragraph appears only when APEX_FORM_TOKEN is set, and the form paragraph follows
// WEB3FORMS_KEY. No quote form here; the page closes with a call and estimate strip.
import { esc } from '../html.mjs';
import { phoneLink, estimateLink } from '../layout.mjs';
import { pageHead, slugify } from '../pagekit.mjs';
import { BUSINESS as B } from '../config.mjs';

export default function privacyPages(ctx) {
  return [
    {
      path: '/privacy/',
      type: 'privacy',
      title: `Privacy | ${B.name}`,
      description: 'How the Holiday Light Service website handles estimate requests, phone links, cookies and tags, in plain language and specific to this site.',
      estimateHref: ctx.url('/contact/'),
      crumbs: [{ name: 'Privacy', href: '/privacy/' }],
      schemas: [{ '@type': 'WebPage', name: 'Privacy', url: ctx.abs('/privacy/'), about: { '@id': ctx.abs('/') + '#business' } }],
      body: (ctx, page) => privacyBody(ctx, page),
    },
  ];
}

// Each section: [heading, [html blocks]]. Text is escaped where it is built.
function sections(ctx) {
  const { formKey, gtmId, apexToken } = ctx.cfg;
  const tel = `<a href="${B.tel}" data-contact="phone" data-placement="privacy_text">${B.phone}</a>`;
  const out = [];

  const form = [
    `<p>When you send an estimate request, the form sends what you enter and choose:</p>`,
    `<ul class="pv-list">
      <li>Your name and phone number</li>
      <li>Your email address, if you add one</li>
      <li>Your city and, if you add it, your street address</li>
      <li>The property type and what you would like lit</li>
      <li>The page you sent it from</li>
    </ul>`,
    // True whether the form key delivers to the agency inbox (which passes requests on) or to the
    // company office directly: name both parties that can receive a request.
    `<p>Requests are delivered by email through Web3Forms, a form delivery service. A request reaches ${esc(B.name)} either directly or by way of Modern Apex Strategies, the company that builds and manages this website and its advertising, and it is used to follow up about your estimate. Web3Forms handles the message on its way under its own privacy policy.</p>`,
  ];
  if (!formKey) form.push(`<p class="pv-note">This preview of the site is not connected to email delivery yet, so the form does not send anything. Submitting it shows a note and the phone number instead.</p>`);
  out.push(['The estimate form', form]);

  if (gtmId) {
    out.push([
      'Analytics and advertising tags',
      [
        `<p>This site loads Google Tag Manager. Through it, ${esc(B.name)} can run analytics and advertising tags, for example to measure visits and to count the calls and estimate requests that come from ads. Those tags can set cookies in your browser.</p>`,
        `<p>The site passes the tag manager simple events, such as a tap on a phone link, a step in the estimate form or a sent request, along with the property type and city you chose. It never passes your name, phone number, email or address.</p>`,
        `<p>You can block or clear cookies in your browser settings at any time.</p>`,
      ],
    ]);
  } else {
    out.push([
      'Analytics and advertising tags',
      [`<p>This site does not run analytics or advertising tags. No tag manager is configured, so no tracking scripts from Google, Meta or anyone else load on these pages.</p>`],
    ]);
  }

  if (apexToken) {
    out.push([
      'The ad attribution cookie',
      [
        `<p>When you arrive from an ad or from a link with campaign tags, the site saves a first-party cookie named <strong>apx_attr</strong> for 90 days. It holds the ad click identifiers and campaign (UTM) values from that link, the page you arrived on, the site that referred you and the time of that first visit. It holds no name, phone number or email.</p>`,
        `<p>If you send an estimate request, a copy of the request and those campaign values also go to Modern Apex Strategies, the company that builds and manages this website and its advertising, so ${esc(B.name)} can see which ads lead to requests. Taps on phone links, and one visit note per browser session with the page and whether an ad click was present, are reported the same way, without personal details.</p>`,
        `<p>You can clear or block the cookie in your browser settings. The site and the form keep working without it.</p>`,
      ],
    ]);
  } else {
    out.push(['Cookies', [`<p>The site itself does not set cookies.${gtmId ? ' Tags loaded through the tag manager can, as described above.' : ''}</p>`]]);
  }

  out.push([
    'Phone links',
    [`<p>Phone numbers on this site are tel: links. Tapping one opens your phone or calling app with ${tel}, and the call goes straight to ${esc(B.name)}. The website does not record calls.${gtmId || apexToken ? ' The tap itself is counted as described above.' : ''}</p>`],
  ]);

  out.push([
    'Hosting, fonts and media',
    [
      `<p>The site is a set of static pages hosted on GitHub Pages. Like any web host, GitHub receives technical details such as your IP address and browser type when your browser requests a page.</p>`,
      `<p>The fonts, photos and videos are served from this site, so no font or video service sees your visit. The Facebook link takes you to Facebook, where Facebook's own policy applies.</p>`,
    ],
  ]);

  out.push(['Questions', [`<p>For questions about your information or a request you sent, call ${esc(B.name)} at ${tel}.</p>`]]);
  return out;
}

function privacyBody(ctx, page) {
  const list = sections(ctx);
  const toc = list.map(([h]) => `<li><a href="#${slugify(h)}">${esc(h)}</a></li>`).join('');
  const body = list
    .map(([h, blocks]) => `<section class="gd-sec" aria-labelledby="${slugify(h)}"><h2 id="${slugify(h)}">${esc(h)}</h2>${blocks.join('')}</section>`)
    .join('\n      ');
  const H = ctx.content.copy.home;
  return `<div class="pv-page">
  <div class="wrap">
    ${pageHead(ctx, page, {
      crumbItems: [{ name: 'Privacy' }],
      h1: 'Privacy',
      sub: 'What the Holiday Light Service website collects and where it goes. This page describes this site only.',
      cls: 'pv-head',
    })}
  </div>
  <div class="wrap pv-grid">
    <nav class="gd-toc" aria-label="On this page">
      <p class="gd-toc-h">On this page</p>
      <ol>${toc}</ol>
    </nav>
    <div class="gd-body pv-body">
      ${body}
    </div>
  </div>
</div>

<section class="cta-strip" aria-labelledby="cta-title">
  <div class="wrap cta-in">
    <div>
      <p class="eyebrow">Free estimate</p>
      <h2 id="cta-title">${esc(H.closing.heading)}</h2>
    </div>
    <div class="cta-act">
      ${estimateLink(ctx, page, 'privacy_strip', { cls: 'btn btn-glow btn-lg' })}
      ${phoneLink('privacy_strip', { cls: 'btn btn-line btn-lg' })}
    </div>
  </div>
</section>`;
}
