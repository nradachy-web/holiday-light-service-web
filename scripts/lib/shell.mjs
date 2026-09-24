// The page shell: head (title, description, canonical, Open Graph, robots, JSON-LD), sprite,
// header, main, footer and the mobile bar. Every page goes through renderPage().
import { esc, json } from './html.mjs';
import { sprite } from './icons.mjs';
import { header, footer, mobileBar } from './layout.mjs';
import { BUSINESS as B } from './config.mjs';
import { resetFormIds } from './form.mjs';

// Runs before first paint: marks JS, enables motion unless reduced, and falls back to the
// plain no-JS layout if site.js has not started within six seconds.
const HEAD_SCRIPT = `(function(d,w){var r=d.documentElement;r.classList.add('js');w.dataLayer=w.dataLayer||[];try{if(w.matchMedia('(prefers-reduced-motion: no-preference)').matches){r.classList.add('motion')}}catch(e){}setTimeout(function(){if(!w.__hls){r.classList.remove('js','motion')}},6000)})(document,window)`;

export function businessNode(ctx) {
  return {
    '@type': 'LocalBusiness',
    '@id': ctx.abs('/') + '#business',
    name: B.name,
    url: ctx.abs('/'),
    telephone: '+1-248-756-8915',
    foundingDate: B.founded,
    description: ctx.content.copy.home.meta_description,
    image: ctx.abs(ctx.og.default),
    logo: ctx.abs('/assets/icons/icon-512.png'),
    sameAs: [B.facebook],
    // A service-area business: region and country only. No street address or city is verified yet
    // (README launch checklist: add addressLocality once Aaron confirms the Business Profile city).
    address: { '@type': 'PostalAddress', addressRegion: 'MI', addressCountry: 'US' },
    areaServed: ctx.content.counties.map((g) => ({ '@type': 'AdministrativeArea', name: `${g.county}, Michigan` })),
  };
}

export function renderPage(ctx, page) {
  resetFormIds();
  const { cfg } = ctx;
  const body = typeof page.body === 'function' ? page.body(ctx, page) : page.body;
  const canonical = ctx.abs(page.path);
  const noindex = !cfg.indexable || page.noindex;
  const robots = noindex ? 'noindex,follow' : 'index,follow';
  const og = ctx.abs(page.ogImage || ctx.og.default);
  const ogSize = ctx.og.size(page.ogImage || ctx.og.default);
  // The alt text always describes the image actually shared.
  const ogAlt = page.ogAlt || (page.ogImage === ctx.og.commercial ? ctx.og.commercialAlt : ctx.og.alt);

  const graph = [businessNode(ctx), ...(page.schemas || [])];
  if (page.path === '/') graph.push({ '@type': 'WebSite', '@id': ctx.abs('/') + '#website', name: B.name, url: ctx.abs('/'), publisher: { '@id': ctx.abs('/') + '#business' } });
  if (page.crumbs && page.crumbs.length) {
    const items = [{ name: 'Home', href: '/' }, ...page.crumbs];
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: items.map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.name, item: ctx.abs(x.href || page.path) })),
    });
  }

  const gtmHead = cfg.gtmId
    ? `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${cfg.gtmId}');</script>`
    : '';
  const gtmBody = cfg.gtmId
    ? `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${cfg.gtmId}" height="0" width="0" style="display:none;visibility:hidden" title="Google Tag Manager"></iframe></noscript>`
    : '';
  const apex = cfg.apexToken ? `<script src="${ctx.url('/assets/js/apex-attribution.js')}" data-token="${esc(cfg.apexToken)}" defer></script>` : '';

  const bodyAttrs = [
    `class="${esc(['page-' + (page.type || 'page'), page.bodyClass].filter(Boolean).join(' '))}"`,
    `data-base="${esc(cfg.base)}"`,
    `data-page-type="${esc(page.type || 'page')}"`,
    page.service ? `data-service="${esc(page.service)}"` : '',
    page.city ? `data-city="${esc(page.city)}"` : '',
    `data-thanks="${esc(ctx.url('/thank-you/'))}"`,
  ]
    .filter(Boolean)
    .join(' ');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.description)}">
<meta name="robots" content="${robots}">
<link rel="canonical" href="${esc(canonical)}">
<meta name="theme-color" content="#05070d">
<meta name="color-scheme" content="dark">
<meta property="og:type" content="${page.ogType || 'website'}">
<meta property="og:site_name" content="${B.name}">
<meta property="og:title" content="${esc(page.title)}">
<meta property="og:description" content="${esc(page.description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(og)}">
<meta property="og:image:width" content="${ogSize.width}">
<meta property="og:image:height" content="${ogSize.height}">
<meta property="og:image:alt" content="${esc(ogAlt)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${ctx.url('/favicon.ico')}" sizes="32x32">
<link rel="icon" href="${ctx.url('/favicon.svg')}" type="image/svg+xml">
<link rel="apple-touch-icon" href="${ctx.url('/apple-touch-icon.png')}">
<link rel="manifest" href="${ctx.url('/site.webmanifest')}">
<link rel="preload" href="${ctx.url('/assets/fonts/inter-tight-subset.woff2')}" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${ctx.url('/assets/css/site.css')}?v=${ctx.version}">
<script>${HEAD_SCRIPT}</script>
${gtmHead}
<script type="application/ld+json">${json({ '@context': 'https://schema.org', '@graph': graph })}</script>
<script src="${ctx.url('/assets/js/site.js')}?v=${ctx.version}" defer></script>
${apex}
</head>
<body ${bodyAttrs}>
${gtmBody}
${sprite()}
${header(ctx, page)}
<main id="main">
${body}
</main>
${footer(ctx, page)}
${mobileBar(ctx, page)}
</body>
</html>
`;
}
