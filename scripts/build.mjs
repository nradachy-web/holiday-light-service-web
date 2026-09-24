// Holiday Light Service static site generator.
// Plain Node ESM, no framework runtime. Reads content/*.json, renders every route through the
// shared shell, copies public/ into dist/ and writes sitemap.xml, robots.txt and route-manifest.json.
//
// Env: BASE_PATH (default /holiday-light-service-web), SITE_ORIGIN (default https://nradachy-web.github.io),
//      INDEXABLE=true to drop noindex, WEB3FORMS_KEY, GTM_ID, APEX_FORM_TOKEN (all optional).
//
// Pages come from every module in scripts/lib/pages/. Each default export takes the build context
// and returns an array of page objects: { path, title, description, body(ctx, page), type, crumbs,
// schemas, estimateHref, noindex, listed, file }. Add a page type by dropping in a new module.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { ROOT, DIST, PUBLIC, readConfig } from './lib/config.mjs';
import { loadContent } from './lib/content.mjs';
import { createMedia } from './lib/media.mjs';
import { renderPage } from './lib/shell.mjs';
import { esc } from './lib/html.mjs';
import { GUIDE_PHOTOS } from './lib/pagekit.mjs';

const started = Date.now();
const cfg = readConfig();
const content = loadContent();

const url = (p) => {
  if (/^(https?:|tel:|mailto:|#)/.test(p)) return p;
  const clean = p.startsWith('/') ? p : '/' + p;
  return cfg.base + clean;
};
const abs = (p) => cfg.origin + url(p === '/404.html' ? '/404.html' : p);

// Tiny inline posters for <video poster>. The visible poster is the responsive <picture> under
// each video, so the attribute costs no extra request.
async function tinyPosters() {
  const out = {};
  for (const m of content.media.filter((x) => x.kind === 'video')) {
    const src = path.join(PUBLIC, m.files.poster.webp['960']);
    const buf = await sharp(src).resize(32).webp({ quality: 45 }).toBuffer();
    out[m.name] = 'data:image/webp;base64,' + buf.toString('base64');
  }
  return out;
}

async function ensureFonts() {
  const pairs = [
    ['inter-tight-subset.woff2', 'node_modules/@fontsource-variable/inter-tight/files/inter-tight-latin-wght-normal.woff2'],
    ['inter-subset.woff2', 'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2'],
  ];
  for (const [name, fallback] of pairs) {
    const dest = path.join(PUBLIC, 'assets/fonts', name);
    if (!fs.existsSync(dest)) {
      await fsp.mkdir(path.dirname(dest), { recursive: true });
      await fsp.copyFile(path.join(ROOT, fallback), dest);
      console.warn(`Font ${name} was missing; copied the full latin file. Run python3 scripts/lib/subset-fonts.py for the smaller subset.`);
    }
  }
}

// Social preview images. Brand pages crop the Northern Michigan footage posters (their alt text names
// the region). Local pages and the permanent and landscape pages share a card cropped from one of our
// own photos whose caption names no place, so a shared local link never implies work in that town.
async function ogImages() {
  const largest = (m) => Object.entries(m.files.webp).sort((a, b) => Number(b[0]) - Number(a[0]))[0][1];
  const jobs = [
    ['holiday-light-service.jpg', content.mediaItem('hero-tree').files.poster.webp['1920'], 'attention'],
    ['commercial-holiday-lighting.jpg', content.mediaItem('downtown-wraps').files.poster.webp['1920'], 'centre'],
    ...Object.values(OG_CARDS).map((c) => [path.basename(c.image), largest(content.mediaItem(c.photo)), c.position]),
    // One card per guide, cropped from the guide's own photo.
    ...content.copy.guides.map((g) => [`guide-${g.slug}.jpg`, largest(content.mediaItem(GUIDE_PHOTOS[g.slug] || 'roofline-large-home')), 'attention']),
  ];
  const dir = path.join(DIST, 'assets/og');
  await fsp.mkdir(dir, { recursive: true });
  for (const [name, src, position] of jobs) {
    await sharp(path.join(PUBLIC, src)).resize(1200, 630, { fit: 'cover', position }).jpeg({ quality: 78, mozjpeg: true }).toFile(path.join(dir, name));
  }
}

// Our own photos for the local and permanent/landscape share cards (captions without a place name).
const OG_CARDS = {
  home: { image: '/assets/og/residential-roofline.jpg', photo: 'roofline-large-home', position: 'centre' },
  building: { image: '/assets/og/commercial-building.jpg', photo: 'commercial-building-lit-trees', position: 'centre' },
};

// Light CSS minification: comments and redundant whitespace only.
const minifyCss = (css) =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};,>])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();

async function main() {
  await ensureFonts();
  const cssSrc = await fsp.readFile(path.join(PUBLIC, 'assets/css/site.css'), 'utf8');
  const jsSrc = await fsp.readFile(path.join(PUBLIC, 'assets/js/site.js'), 'utf8');
  const version = crypto.createHash('sha1').update(cssSrc + jsSrc).digest('hex').slice(0, 10);

  const media = createMedia({ url, mediaItem: content.mediaItem, tinyPosters: await tinyPosters() });
  const ctx = {
    cfg,
    content,
    url,
    abs,
    media,
    version,
    year: new Date().getFullYear(),
    og: {
      default: '/assets/og/holiday-light-service.jpg',
      commercial: '/assets/og/commercial-holiday-lighting.jpg',
      alt: 'A giant multicolor tree lit on the waterfront at night, Northern Michigan.',
      commercialAlt: 'Downtown street trees wrapped in warm white lights at night, Northern Michigan.',
      guide: (slug) => `/assets/og/guide-${slug}.jpg`,
      // Cards for local, permanent and landscape pages: { image, alt } with the alt from media.json.
      card: (key, { seasonal = false } = {}) => {
        const c = OG_CARDS[key];
        const alt = content.mediaItem(c.photo).alt;
        return { ogImage: c.image, ogAlt: seasonal ? `Seasonal holiday work: ${alt.charAt(0).toLowerCase()}${alt.slice(1)}` : alt };
      },
    },
  };

  // Discover page modules.
  const pagesDir = path.join(ROOT, 'scripts/lib/pages');
  const modules = (await fsp.readdir(pagesDir)).filter((f) => f.endsWith('.mjs')).sort();
  const pages = [];
  const seen = new Map();
  for (const f of modules) {
    const mod = await import(pathToFileURL(path.join(pagesDir, f)).href);
    if (typeof mod.default !== 'function') continue;
    for (const p of mod.default(ctx)) {
      if (!p.path || !p.title || !p.description) throw new Error(`Page from ${f} is missing path, title or description`);
      if (seen.has(p.path)) throw new Error(`Duplicate route ${p.path} from ${f} and ${seen.get(p.path)}`);
      seen.set(p.path, f);
      p.estimateHref = p.estimateHref || '#estimate';
      pages.push(p);
    }
  }

  // Fresh dist with public/ copied in.
  await fsp.rm(DIST, { recursive: true, force: true });
  await fsp.mkdir(DIST, { recursive: true });
  await fsp.cp(PUBLIC, DIST, { recursive: true, filter: (src) => !path.basename(src).startsWith('.') });
  await fsp.writeFile(path.join(DIST, 'assets/css/site.css'), minifyCss(cssSrc));
  await ogImages();

  const dash = new RegExp("[\\u2013\\u2014]");
  const routes = [];
  const unlisted = [];
  for (const page of pages) {
    const html = renderPage(ctx, page);
    if (dash.test(html)) throw new Error(`En or em dash found in ${page.path}`);
    const h1s = (html.match(/<h1[\s>]/g) || []).length;
    if (h1s !== 1) throw new Error(`${page.path} has ${h1s} h1 elements`);
    const dest = page.file ? path.join(DIST, page.file) : path.join(DIST, page.path, 'index.html');
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    await fsp.writeFile(dest, html);
    const entry = {
      path: page.path,
      type: page.type || 'page',
      service: page.service || null,
      city: page.city || null,
      title: page.title,
      description: page.description,
      canonical: abs(page.path),
    };
    if (page.listed === false || page.noindex) unlisted.push(entry);
    else routes.push(entry);
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map((r) => `  <url><loc>${esc(r.canonical)}</loc></url>`).join('\n')}\n</urlset>\n`;
  await fsp.writeFile(path.join(DIST, 'sitemap.xml'), sitemap);
  await fsp.writeFile(
    path.join(DIST, 'robots.txt'),
    `User-agent: *\nAllow: /\n${cfg.indexable ? `Sitemap: ${abs('/sitemap.xml')}\n` : '# Review build: every page carries noindex until INDEXABLE=true.\n'}`
  );
  await fsp.writeFile(path.join(DIST, '.nojekyll'), '');
  const manifest = {
    base: cfg.base,
    origin: cfg.origin,
    indexable: cfg.indexable,
    formDelivery: cfg.formKey ? 'web3forms' : 'preview',
    tagManager: Boolean(cfg.gtmId),
    attribution: Boolean(cfg.apexToken),
    count: routes.length + unlisted.length,
    listed: routes.length,
    byType: [...routes, ...unlisted].reduce((a, r) => ((a[r.type] = (a[r.type] || 0) + 1), a), {}),
    routes,
    unlisted,
  };
  await fsp.writeFile(path.join(DIST, 'route-manifest.json'), JSON.stringify(manifest, null, 2));

  console.log(
    `Built ${manifest.count} pages (${routes.length} in sitemap) ${JSON.stringify(manifest.byType)} in ${Date.now() - started}ms. ` +
      `${cfg.indexable ? 'Indexable' : 'Noindex review'} build for ${cfg.origin}${cfg.base}/. Form: ${manifest.formDelivery}. GTM: ${cfg.gtmId || 'none'}. Attribution: ${cfg.apexToken ? 'on' : 'off'}.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
