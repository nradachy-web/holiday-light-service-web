#!/usr/bin/env node
// Browser quality gate for dist/ in real Chrome (Playwright, channel "chrome", so H.264 video plays).
//
//   npm test                      full run: pages x (1440, 390, 320), reduced motion, no JavaScript, video, forms
//   npm run preview               serve dist/ with BASE_PATH on http://127.0.0.1:4188 (no tests)
//   PAGES=/,/faq/ npm test        limit the page set
//
// Environment: BASE_PATH and SITE_ORIGIN (inferred from dist/index.html canonical when unset),
// WEB3FORMS_KEY (optional cross-check; the form mode is detected from the page), BROWSER_CONCURRENCY (default 3),
// HEADED=1 to watch. Nothing is ever sent: api.web3forms.com and every other third party are intercepted.
// Writes reports/browser/*.jpg and reports/browser-results.json. Exits 1 on any failure.

import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.resolve(process.env.DIST_DIR || path.join(ROOT, 'dist'));
const CONTENT = path.join(ROOT, 'content');
const PHONE_TEL = 'tel:+12487568915';

// ---------------------------------------------------------------------------
// Config shared with lighthouse.mjs
// ---------------------------------------------------------------------------
export function normBase(b) {
  b = String(b ?? '').trim();
  if (b === '/' || b === '') return '';
  if (!b.startsWith('/')) b = '/' + b;
  return b.replace(/\/+$/, '');
}
export function resolveConfig(dist = DIST) {
  let inferred = null;
  try {
    const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
    const href = html.match(/<link[^>]+rel="canonical"[^>]*href="([^"]+)"/i)?.[1] || html.match(/<link[^>]+href="([^"]+)"[^>]*rel="canonical"/i)?.[1];
    if (href) { const u = new URL(href); inferred = { origin: u.origin, base: normBase(u.pathname) }; }
  } catch { /* no dist yet */ }
  const base = process.env.BASE_PATH !== undefined ? normBase(process.env.BASE_PATH) : inferred ? inferred.base : '/holiday-light-service-web';
  const origin = (process.env.SITE_ORIGIN || inferred?.origin || 'https://nradachy-web.github.io').replace(/\/+$/, '');
  return { dist, base, origin, site: origin + base };
}

// ---------------------------------------------------------------------------
// Tiny static server that mirrors GitHub Pages: BASE_PATH prefix, dir -> index.html,
// 301 to the trailing slash, dist/404.html for misses, gzip for text, byte ranges for video.
// ---------------------------------------------------------------------------
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp4': 'video/mp4', '.webm': 'video/webm', '.vtt': 'text/vtt', '.pdf': 'application/pdf',
};
const COMPRESSIBLE = /\.(?:html|css|m?js|json|xml|txt|svg|webmanifest|vtt)$/i;
export function serveDist({ dist = DIST, base = '', port = 0, host = '127.0.0.1' } = {}) {
  const gzCache = new Map();
  const server = http.createServer((req, res) => {
    const send404 = () => {
      const f = path.join(dist, '404.html');
      res.writeHead(404, { 'Content-Type': TYPES['.html'] });
      res.end(req.method === 'HEAD' ? undefined : fs.existsSync(f) ? fs.readFileSync(f) : 'Not found');
    };
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { return send404(); }
    if (base) {
      if (pathname === base) { res.writeHead(301, { Location: base + '/' }); return res.end(); }
      if (!pathname.startsWith(base + '/')) return send404();
      pathname = pathname.slice(base.length);
    }
    let file = path.join(dist, pathname);
    if (!file.startsWith(dist)) return send404();
    let stat = fs.existsSync(file) ? fs.statSync(file) : null;
    if (stat && stat.isDirectory()) {
      if (!pathname.endsWith('/')) { res.writeHead(301, { Location: base + pathname + '/' }); return res.end(); }
      file = path.join(file, 'index.html');
      stat = fs.existsSync(file) ? fs.statSync(file) : null;
    }
    if (!stat || !stat.isFile()) return send404();
    const ext = path.extname(file).toLowerCase();
    const headers = { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': 'max-age=600', 'Accept-Ranges': 'bytes', 'Last-Modified': stat.mtime.toUTCString() };
    const range = req.headers.range && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if (range && !COMPRESSIBLE.test(ext)) {
      let start = range[1] === '' ? stat.size - Number(range[2]) : Number(range[1]);
      let end = range[1] !== '' && range[2] !== '' ? Number(range[2]) : stat.size - 1;
      if (range[1] === '') end = stat.size - 1;
      if (start < 0) start = 0;
      if (start >= stat.size || end < start) { res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }); return res.end(); }
      end = Math.min(end, stat.size - 1);
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1 });
      if (req.method === 'HEAD') return res.end();
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    if (COMPRESSIBLE.test(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      const key = file + ':' + stat.mtimeMs;
      if (!gzCache.has(key)) gzCache.set(key, zlib.gzipSync(fs.readFileSync(file), { level: 9 }));
      const body = gzCache.get(key);
      res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', 'Content-Length': body.length, Vary: 'Accept-Encoding' });
      return res.end(req.method === 'HEAD' ? undefined : body);
    }
    res.writeHead(200, { ...headers, 'Content-Length': stat.size });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const p = server.address().port;
      resolve({ port: p, origin: `http://${host}:${p}`, url: `http://${host}:${p}${base}`, close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(() => r()); }) });
    });
  });
}

// ---------------------------------------------------------------------------
// Page selection, data-driven from content/*.json and filtered to what exists in dist
// ---------------------------------------------------------------------------
export function contentModel() {
  const readJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
  const copy = readJSON(path.join(CONTENT, 'site-copy.json'));
  const cities = fs.readdirSync(path.join(CONTENT, 'cities')).filter((f) => f.endsWith('.json')).sort().map((f) => readJSON(path.join(CONTENT, 'cities', f)));
  const landingServices = [...new Set(cities.flatMap((c) => Object.keys(c.pages || {})))];
  const byCounty = new Map();
  for (const c of cities) { if (!byCounty.has(c.county)) byCounty.set(c.county, []); byCounty.get(c.county).push(c); }
  const counties = [...byCounty.keys()].sort();
  return { copy, cities, landingServices, byCounty, counties };
}
export function pageExists(dist, route) {
  const f = route.endsWith('/') ? path.join(dist, route, 'index.html') : path.join(dist, route);
  return fs.existsSync(f);
}
function selectPages(dist) {
  const { copy, landingServices, byCounty, counties } = contentModel();
  const wanted = [];
  const add = (route, kind, extra = {}) => { if (!wanted.some((w) => w.route === route)) wanted.push({ route, kind, ...extra }); };
  add('/', 'home');
  for (const s of copy.services || []) add(`/${s.slug}/`, 'service');
  // Six local pages across the three services and different counties.
  for (let i = 0; i < 6 && counties.length && landingServices.length; i++) {
    const county = counties[i % counties.length];
    const list = byCounty.get(county);
    const city = list[Math.floor(i / counties.length) % list.length];
    const service = landingServices[i % landingServices.length];
    add(`/${service}/${city.slug}/`, 'local', { city: city.slug, cityName: city.name, service });
  }
  for (const county of [counties[0], counties[Math.min(3, counties.length - 1)]].filter(Boolean)) {
    const c = byCounty.get(county)[0];
    add(`/service-area/${c.slug}/`, 'hub', { city: c.slug });
  }
  add('/service-area/', 'area');
  const vertical = (copy.verticals || []).find((v) => /hoa/.test(v.slug)) || (copy.verticals || [])[0];
  if (vertical) add(`/commercial/${vertical.slug}/`, 'vertical');
  // The downtowns vertical carries the site's one frame-crossing headline over footage.
  const film = (copy.verticals || []).find((v) => /downtown/.test(v.slug));
  if (film) add(`/commercial/${film.slug}/`, 'vertical');
  for (const r of ['/our-work/', '/about/', '/faq/', '/contact/', '/process/', '/guides/']) add(r, 'other');
  const guide = (copy.guides || [])[0];
  if (guide) add(`/guides/${guide.slug}/`, 'guide');
  add('/privacy/', 'privacy');
  add('/thank-you/', 'thankyou');
  let list = wanted;
  if (process.env.PAGES) {
    const only = process.env.PAGES.split(',').map((s) => s.trim()).filter(Boolean);
    list = only.map((r) => wanted.find((w) => w.route === r) || { route: r, kind: /\/(?:christmas-light-installation|commercial-holiday-lighting|permanent-lighting)\/[a-z-]+\/$/.test(r) ? 'local' : 'other' });
  }
  const present = list.filter((w) => pageExists(dist, w.route));
  const missing = list.filter((w) => !pageExists(dist, w.route)).map((w) => w.route);
  return { pages: present, missing };
}
const slugOf = (route) => (route === '/' ? 'home' : route.replace(/^\/|\/$/g, '').replace(/\//g, '--'));

// ---------------------------------------------------------------------------
// In-page probes (run inside the browser)
// ---------------------------------------------------------------------------
const PROBES = String.raw`
window.__qa = {
  eff(el) { let o = 1; for (let e = el; e && e.nodeType === 1; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity); return o; },
  shown(el) {
    if (!el || !el.isConnected) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true })) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  },
  srOnly(el) {
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if ((cs.clip && cs.clip !== 'auto' && /rect\(\s*0/.test(cs.clip)) || /inset\(\s*50%/.test(cs.clipPath)) return true;
      const r = e.getBoundingClientRect();
      if (cs.position === 'absolute' && r.width <= 1 && r.height <= 1) return true;
    }
    return false;
  },
  present(el) {
    if (!__qa.shown(el) || __qa.eff(el) < 0.05) return false;
    const r = el.getBoundingClientRect();
    return r.top < innerHeight - 2 && r.bottom > 2 && r.left < innerWidth - 2 && r.right > 2;
  },
  sel(el) {
    if (!el || el.nodeType !== 1) return String(el);
    let s = el.tagName.toLowerCase();
    if (el.id) return s + '#' + el.id;
    const c = [...el.classList].slice(0, 2).join('.');
    if (c) s += '.' + c;
    const p = el.parentElement;
    return (p && p !== document.body ? __qa.sel(p) + ' > ' : '') + s;
  },
  text(el) { return (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60); },
  clipped() {
    const vw = document.documentElement.clientWidth;
    const out = [];
    const inScroller = (el) => { for (let e = el.parentElement; e; e = e.parentElement) { const cs = getComputedStyle(e); if (/auto|scroll/.test(cs.overflowX) && e.scrollWidth > e.clientWidth + 1) return true; } return false; };
    for (const el of document.querySelectorAll('h1,h2,h3,p,a,button,li,figcaption,label,legend')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      if (el.closest('[hidden],.sr-only,.sprite,[aria-hidden="true"],.skip-link,[inert],.mnav,.nav-sub,[data-rise]')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || !(el.innerText || '').trim() || inScroller(el)) continue;
      if (r.right > vw + 1 || r.left < -1) { out.push(__qa.sel(el) + ' "' + __qa.text(el).slice(0, 24) + '" off screen (' + Math.round(r.left) + ' to ' + Math.round(r.right) + ' of ' + vw + ')'); continue; }
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const acs = getComputedStyle(a);
        if (/hidden|clip/.test(acs.overflowX) || /hidden|clip/.test(acs.overflow)) {
          const ar = a.getBoundingClientRect();
          if (r.right > ar.right + 1.5 || r.left < ar.left - 1.5) out.push(__qa.sel(el) + ' "' + __qa.text(el).slice(0, 24) + '" cut by ' + __qa.sel(a));
          break;
        }
      }
    }
    return [...new Set(out)];
  },
  // The 1x rule (DESIGN.md): no framed photo displays past its own pixels. A frame carries its source
  // size in --pw and --ph; the displayed size is the cover scale of the picture box. Photos outside a
  // .fit1x frame are allowed only as full-bleed backdrops and in the What we light panes.
  photos1x() {
    const out = [];
    for (const img of document.querySelectorAll('img[src*="/assets/images/"]')) {
      if (!img.getClientRects().length || !img.offsetWidth) continue;
      const frame = img.closest('.fit1x');
      if (!frame) {
        if (!img.closest('.closing-media,.ct-media,.sh-bg,.page-hero-media,.fq-bg,.text-hero-media,.pane')) out.push(__qa.sel(img.parentElement) + ' photo outside a .fit1x frame');
        continue;
      }
      const fs = getComputedStyle(frame);
      const pw = parseFloat(fs.getPropertyValue('--pw')), ph = parseFloat(fs.getPropertyValue('--ph'));
      if (!pw || !ph) { out.push(__qa.sel(frame) + ' .fit1x without --pw/--ph'); continue; }
      const fit = getComputedStyle(img).objectFit;
      const w = img.offsetWidth, h = img.offsetHeight;
      const scale = fit === 'contain' ? Math.min(w / pw, h / ph) : fit === 'cover' ? Math.max(w / pw, h / ph) : w / pw;
      if (scale > 1 + 1.5 / pw) out.push(__qa.sel(frame) + ' ' + w + 'x' + h + ' shows a ' + pw + 'x' + ph + ' photo at ' + scale.toFixed(2) + 'x');
    }
    return out;
  },
  // Home property cards: in each row of cards, the photos, titles and buttons start on one line.
  cardRows() {
    const out = [];
    const rows = new Map();
    for (const c of document.querySelectorAll('.paths .path')) {
      const t = Math.round(c.getBoundingClientRect().top);
      if (!rows.has(t)) rows.set(t, []);
      rows.get(t).push(c);
    }
    for (const row of rows.values()) {
      if (row.length < 2) continue;
      for (const s of ['picture', 'h3', '.path-actions .btn', '.path-actions .tlink']) {
        const tops = row.map((c) => c.querySelector(s).getBoundingClientRect().top);
        if (Math.max(...tops) - Math.min(...tops) > 0.5) out.push(s + ' tops differ by ' + (Math.max(...tops) - Math.min(...tops)).toFixed(1) + 'px in a row of ' + row.length);
      }
    }
    return out;
  },
};`;

// ---------------------------------------------------------------------------
// Main run
// ---------------------------------------------------------------------------
async function main() {
  const cfg = resolveConfig();
  if (!fs.existsSync(DIST) || !fs.existsSync(path.join(DIST, 'index.html'))) {
    console.error(`browser-check: ${DIST} has no index.html. Run npm run build first.`);
    process.exit(1);
  }
  if (process.argv.includes('--serve')) {
    const port = Number(process.env.PORT || 4188);
    const srv = await serveDist({ dist: DIST, base: cfg.base, port });
    console.log(`Serving ${path.relative(ROOT, DIST) || DIST} at ${srv.url}/  (BASE_PATH "${cfg.base}"). Ctrl+C to stop.`);
    return;
  }

  const { chromium } = await import('@playwright/test');
  const { default: AxeBuilder } = await import('@axe-core/playwright');
  const started = Date.now();
  const srv = await serveDist({ dist: DIST, base: cfg.base });
  const LOCAL = srv.url; // e.g. http://127.0.0.1:53211/holiday-light-service-web
  const localHost = new URL(srv.origin).host;
  const siteHost = new URL(cfg.origin).host;
  const SHOTS = path.join(ROOT, 'reports', 'browser');
  await fsp.mkdir(SHOTS, { recursive: true });

  const failures = [];
  const warnings = [];
  const fail = (area, msg) => failures.push({ area, msg });
  const warn = (area, msg) => warnings.push({ area, msg });
  const external = { web3forms: [], gtm: 0, attribution: [], blocked: [] };

  const { pages, missing } = selectPages(DIST);
  const browser = await chromium.launch({ channel: 'chrome', headless: !process.env.HEADED });

  // Every context gets the same network policy: local files pass, third parties are intercepted.
  let formResponder = null; // set by the form tests
  async function makeContext(opts = {}) {
    const ctx = await browser.newContext({ deviceScaleFactor: 1, serviceWorkers: 'block', bypassCSP: true, ...opts });
    await ctx.addInitScript(PROBES);
    await ctx.route('**/*', async (route) => {
      const req = route.request();
      const u = new URL(req.url());
      if (u.host === localHost || u.protocol === 'data:' || u.protocol === 'blob:') return route.continue();
      if (u.host === 'api.web3forms.com') {
        const rec = { method: req.method(), url: req.url(), contentType: req.headers()['content-type'] || '', body: req.postData() || '', at: Date.now() };
        external.web3forms.push(rec);
        if (formResponder) return formResponder(route, rec);
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, message: 'intercepted' }) });
      }
      if (/(?:^|\.)googletagmanager\.com$|(?:^|\.)google-analytics\.com$/.test(u.hostname)) {
        external.gtm++;
        return route.fulfill({ status: 200, contentType: 'text/javascript', body: '' });
      }
      if (u.hostname === 'app.modernapexstrategies.com') {
        external.attribution.push({ url: req.url(), body: req.postData() || '' });
        return route.fulfill({ status: 204, body: '' });
      }
      if (u.host === siteHost && (u.pathname === cfg.base || u.pathname.startsWith(cfg.base + '/'))) {
        // Production-origin URLs (redirect fields, absolute links) are served from the local build.
        const resp = await route.fetch({ url: srv.origin + u.pathname + u.search });
        return route.fulfill({ response: resp });
      }
      external.blocked.push(req.url());
      return route.abort('blockedbyclient');
    });
    return ctx;
  }
  function watch(page) {
    const log = { errors: [], failed: [], closed: false, muted: false };
    const isMedia = (req) => req.resourceType() === 'media' || /\.(?:mp4|webm)(?:[?#]|$)/i.test(req.url());
    const isBlocked = (url) => { try { const h = new URL(url).host; return h !== localHost; } catch { return false; } };
    page.on('console', (m) => {
      if (log.closed || log.muted || m.type() !== 'error') return;
      const locUrl = m.location()?.url || '';
      if (isBlocked(locUrl) && !locUrl.startsWith(srv.origin)) return; // noise from intercepted third parties
      if (/Failed to load resource/.test(m.text()) && /\.(?:mp4|webm)/i.test(locUrl)) return;
      log.errors.push(m.text());
    });
    page.on('pageerror', (e) => { if (!log.closed) log.errors.push('pageerror: ' + e.message); });
    page.on('requestfailed', (r) => {
      if (log.closed || isMedia(r)) return;
      const t = r.failure()?.errorText || '';
      if (/ERR_BLOCKED_BY_CLIENT/.test(t) && isBlocked(r.url())) return; // recorded as blocked third party
      if (/ERR_ABORTED/.test(t) && r.resourceType() === 'document') return;
      log.failed.push(`${t} ${r.url()}`);
    });
    page.on('response', (r) => {
      if (log.closed || isMedia(r.request()) || r.status() < 400) return;
      const u = new URL(r.url());
      if (u.pathname === '/favicon.ico') { warn('network', `favicon.ico 404 at the host root (${r.url()})`); return; }
      log.failed.push(`${r.status()} ${r.url()}`);
    });
    return log;
  }
  const settle = (page, ms) => page.waitForTimeout(ms);
  // Polls scroll position from Node (works with JavaScript disabled) until it holds still.
  async function scrollSettled(page, maxMs = 4000) {
    let last = null, same = 0;
    for (let t = 0; t < maxMs && same < 2; t += 100) {
      const y = await page.evaluate(() => [scrollX, scrollY].join(','));
      if (y === last) same++; else { same = 0; last = y; }
      await page.waitForTimeout(100);
    }
  }
  async function scrollThrough(page) {
    await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const H = innerHeight;
      let y = 0;
      while (y < document.documentElement.scrollHeight) {
        window.scrollTo({ top: y, behavior: 'instant' });
        await wait(110);
        y += Math.round(H * 0.7);
      }
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
      await wait(250);
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
    await settle(page, 700);
  }

  // ----- Per page, per viewport ---------------------------------------------------------
  const VIEWPORTS = [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 640 }];
  const pageResults = [];
  const tasks = [];
  for (const vp of VIEWPORTS) for (const p of pages) tasks.push({ vp, p });
  const FULL = new Set(['/', pages.find((p) => p.kind === 'local')?.route].filter(Boolean));

  async function runTask({ vp, p }) {
    const where = `${p.route} @${vp.width}`;
    const result = { route: p.route, kind: p.kind, width: vp.width, height: vp.height, failures: [], warnings: [] };
    const f = (area, msg) => { result.failures.push(`${area}: ${msg}`); fail(area, `${where} ${msg}`); };
    const w = (area, msg) => { result.warnings.push(`${area}: ${msg}`); warn(area, `${where} ${msg}`); };
    const ctx = await makeContext({ viewport: vp, reducedMotion: 'no-preference' });
    const page = await ctx.newPage();
    const log = watch(page);
    try {
      const resp = await page.goto(LOCAL + p.route, { waitUntil: 'load', timeout: 45000 });
      if (!resp || resp.status() >= 400) f('load', `HTTP ${resp?.status()}`);
      await settle(page, 900);
      // Load-moment timing: H1 and hero form should be fully visible by about 900ms.
      const early = await page.evaluate(() => {
        const h1 = document.querySelector('h1');
        const parts = h1 ? [h1, ...h1.querySelectorAll('*')] : [];
        const h1min = parts.length ? Math.min(...parts.filter((e) => __qa.shown(e)).map((e) => __qa.eff(e))) : 0;
        const form = document.querySelector('form[data-quote][data-placement="hero"]');
        return { h1min, form: form ? __qa.eff(form) : null };
      });
      if (early.h1min < 0.95) w('load moment', `H1 not fully shown about 900ms after load (min opacity ${early.h1min.toFixed(2)})`);
      if (early.form !== null && early.form < 0.95) w('load moment', `hero form opacity ${early.form.toFixed(2)} about 900ms after load (must be tappable at first paint)`);
      await settle(page, 1500);

      // Header phone and estimate CTA
      const hdr = await page.evaluate((desktop) => {
        const out = {};
        for (const [k, s] of [['phone', 'header.site-header a[data-contact="phone"][data-placement="header"]'], ['estimate', 'header.site-header a[data-cta="estimate"][data-placement="header"]']]) {
          const el = [...document.querySelectorAll(s)].find((e) => __qa.present(e)) || document.querySelector(s);
          if (!el) { out[k] = { ok: false, why: 'missing' }; continue; }
          const r = el.getBoundingClientRect();
          const cx = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), cy = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2));
          const hit = document.elementFromPoint(cx, cy);
          const covered = hit && !(el === hit || el.contains(hit));
          const name = (el.getAttribute('aria-label') || '') + ' ' + (el.textContent || '');
          out[k] = { ok: __qa.present(el) && __qa.eff(el) > 0.9, covered, coveredBy: covered ? __qa.sel(hit) : '', visibleText: el.innerText.replace(/\s+/g, ' ').trim(), name: name.replace(/\s+/g, ' ').trim(), href: el.getAttribute('href'), w: r.width, h: r.height };
        }
        // The header controls end at the right gutter and never run past it.
        const row = document.querySelector('header.site-header .hdr');
        const acts = document.querySelector('header.site-header .hdr-actions');
        if (row && acts) out.align = { row: Math.round(row.getBoundingClientRect().right), acts: Math.round(acts.getBoundingClientRect().right) };
        return out;
      }, vp.width >= 1024);
      if (hdr.align && Math.abs(hdr.align.acts - hdr.align.row) > 2) f('header', `controls end at x=${hdr.align.acts}, the header row at x=${hdr.align.row}`);
      // The thank-you page offers the phone number instead of another estimate.
      if (p.kind === 'thankyou') {
        if (hdr.estimate.ok) f('header', 'the thank-you page shows an estimate button');
        if (hdr.phone.ok && !/756.8915/.test(hdr.phone.visibleText)) f('header', `the thank-you header must show the number, shows "${hdr.phone.visibleText}"`);
      }
      for (const k of p.kind === 'thankyou' ? ['phone'] : ['phone', 'estimate']) {
        const h = hdr[k];
        if (!h.ok) f('header', `${k} link not visible (${h.why || 'hidden or off screen'})`);
        else if (h.covered) f('header', `${k} link is covered by ${h.coveredBy}`);
        if (h.ok && (h.w < 24 || h.h < 24)) w('header', `${k} tap target ${Math.round(h.w)}x${Math.round(h.h)}`);
      }
      if (hdr.phone.ok) {
        if (hdr.phone.href !== PHONE_TEL) f('header', `phone href "${hdr.phone.href}"`);
        if (vp.width >= 1024 && !/756.8915/.test(hdr.phone.visibleText)) f('header', `desktop phone must show the number, shows "${hdr.phone.visibleText}"`);
        if (!/756.?8915|call/i.test(hdr.phone.name)) f('header', 'phone link has no accessible name with the number or "Call"');
      }

      // Local pages: form position on the first screen
      if (p.kind === 'local') {
        const pos = await page.evaluate(() => {
          const h1 = document.querySelector('h1');
          const form = document.querySelector('form[data-quote][data-placement="hero"]') || document.querySelector('form[data-quote]');
          if (!h1 || !form) return { missing: !h1 ? 'h1' : 'form' };
          const step = form.querySelector('[data-step="1"]');
          const ctl = step && [...step.querySelectorAll('.chip, select, textarea, button')].find((e) => __qa.shown(e));
          const hr = h1.getBoundingClientRect(), fr = form.getBoundingClientRect();
          const sr = step ? step.getBoundingClientRect() : null, cr = ctl ? ctl.getBoundingClientRect() : null;
          const citySel = form.querySelector('[name="city"]');
          return { h1: { top: hr.top, bottom: hr.bottom, left: hr.left, right: hr.right, width: hr.width }, form: { top: fr.top, bottom: fr.bottom, left: fr.left, right: fr.right }, step: sr && { top: sr.top, bottom: sr.bottom, shown: __qa.shown(step) }, ctl: cr && { top: cr.top, bottom: cr.bottom }, after: !!(h1.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING), vh: innerHeight, city: citySel ? citySel.value : null };
        });
        if (pos.missing) f('landing', `no ${pos.missing}`);
        else {
          if (!pos.step || !pos.step.shown) f('landing', 'hero form step 1 is not shown');
          if (!pos.city) f('landing', 'city is not preselected in the hero form');
          else if (p.city && !String(pos.city).toLowerCase().includes(p.city.replace(/-mi$/, '').split('-')[0]) && !String(pos.city).toLowerCase().includes(String(p.cityName || '').toLowerCase())) w('landing', `hero form city value "${pos.city}" does not look like ${p.city}`);
          if (vp.width >= 1024) {
            if (!pos.step || pos.step.top < 0 || pos.step.top >= pos.vh) f('landing', `form step 1 is not inside the first viewport (top ${Math.round(pos.step?.top)})`);
            else if (!pos.ctl || pos.ctl.bottom > pos.vh) f('landing', `first control of step 1 ends below the first viewport (${Math.round(pos.ctl?.bottom)} > ${pos.vh})`);
            const beside = pos.form.left >= pos.h1.left + pos.h1.width * 0.5 && pos.form.top < pos.h1.bottom + 40 && pos.form.bottom > pos.h1.top;
            if (!beside) f('landing', 'form is not beside the H1 at desktop width');
          } else {
            if (!pos.after || pos.form.top < pos.h1.bottom - 1) f('landing', 'form does not follow the H1 on phones');
            // The card's first choices belong on the first phone screen (390x844); smaller screens only warn.
            if (!pos.ctl || pos.ctl.bottom > pos.vh) (vp.width >= 390 ? f : w)('landing', `the form's first choice ends below the first screen (${Math.round(pos.ctl?.bottom)} > ${pos.vh})`);
          }
        }
      }
      await page.screenshot({ path: path.join(SHOTS, `${slugOf(p.route)}-${vp.width}.jpg`), type: 'jpeg', quality: 70 });

      // Reveal everything, then measure layout
      await scrollThrough(page);
      const layout = await page.evaluate(() => {
        const de = document.documentElement;
        const vw = de.clientWidth;
        const sw = Math.max(de.scrollWidth, document.body.scrollWidth);
        const offenders = sw > vw + 1 ? [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > vw + 1 && __qa.shown(e); }).slice(-5).map((e) => __qa.sel(e) + ' right=' + Math.round(e.getBoundingClientRect().right)) : [];
        // Smallest visible text
        let min = Infinity, minAt = '';
        const small = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const seen = new Set();
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          if (!n.nodeValue.trim()) continue;
          const el = n.parentElement;
          if (!el || seen.has(el) || el.closest('script,style,noscript,template,title')) continue;
          seen.add(el);
          if (!__qa.shown(el) || __qa.srOnly(el)) continue;
          const range = document.createRange(); range.selectNodeContents(n);
          const rr = range.getBoundingClientRect();
          if (rr.width <= 1 || rr.height <= 1) continue;
          let size = parseFloat(getComputedStyle(el).fontSize);
          if (el instanceof SVGElement && el.getScreenCTM) { const m = el.getScreenCTM(); if (m) size *= Math.hypot(m.a, m.b); }
          if (size < min) { min = size; minAt = __qa.sel(el) + ' "' + n.nodeValue.trim().slice(0, 30) + '"'; }
          if (size < 12.45) small.push(`${size.toFixed(1)}px ${__qa.sel(el)} "${n.nodeValue.trim().slice(0, 30)}"`);
        }
        const broken = [...document.images].filter((i) => i.getClientRects().length && i.currentSrc !== '' && i.complete && i.naturalWidth === 0).map((i) => i.currentSrc || i.src);
        const unrevealed = [...document.querySelectorAll('[data-reveal]')].filter((e) => getComputedStyle(e).display !== 'none' && __qa.eff(e) < 0.99).map((e) => `${__qa.sel(e)} opacity ${__qa.eff(e).toFixed(2)}`);
        const clipped = __qa.clipped();
        return { overflow: sw > vw + 1, sw, vw, offenders, min, minAt, small: small.slice(0, 8), smallCount: small.length, broken, unrevealed, clipped, photos: __qa.photos1x(), cards: __qa.cardRows() };
      });
      result.minFontPx = Number.isFinite(layout.min) ? +layout.min.toFixed(2) : null;
      if (layout.overflow) f('overflow', `horizontal overflow ${layout.sw}px > ${layout.vw}px: ${layout.offenders.join('; ')}`);
      if (layout.smallCount) f('text size', `${layout.smallCount} text node(s) under 12.5px, e.g. ${layout.small.join(' | ')}`);
      if (layout.broken.length) f('images', `broken: ${layout.broken.slice(0, 4).join(', ')}`);
      if (layout.unrevealed.length) f('reveal', `${layout.unrevealed.length} [data-reveal] still hidden after scrolling the whole page: ${layout.unrevealed.slice(0, 4).join(' | ')}`);
      if (layout.clipped.length) f('clipping', `${layout.clipped.length} text element(s) cut off by their container or the screen edge: ${layout.clipped.slice(0, 5).join(' | ')}`);
      if (layout.photos.length) f('photos 1x', `${layout.photos.length} photo(s) past their own pixels or outside the frame system: ${layout.photos.slice(0, 4).join(' | ')}`);
      if (layout.cards.length) f('property cards', layout.cards.join(' | '));

      // Mobile bar behaviour
      const barCheck = await page.evaluate(async (phone) => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const bar = document.querySelector('.mobile-bar');
        if (!bar) return { missing: true };
        const call = bar.querySelector('a[data-contact="phone"]');
        const out = { atTop: __qa.present(bar), overForm: [], gap: null, desktopMid: null, number: call ? /756.8915/.test(call.textContent) : false };
        const forms = [...document.querySelectorAll('form[data-quote]')];
        if (!phone) {
          window.scrollTo({ top: Math.round(document.documentElement.scrollHeight / 2), behavior: 'instant' });
          await wait(600);
          out.desktopMid = __qa.present(bar);
          window.scrollTo({ top: 0, behavior: 'instant' });
          return out;
        }
        for (const fm of forms) {
          const r = fm.getBoundingClientRect();
          const y = window.scrollY + r.top - Math.max(0, (innerHeight - Math.min(r.height, innerHeight)) / 2);
          window.scrollTo({ top: Math.max(0, y), behavior: 'instant' });
          await wait(650);
          out.overForm.push({ placement: fm.dataset.placement || '', visible: __qa.present(bar), cls: bar.className });
        }
        // A scroll position past the first screen and the hero section where no form intersects the viewport
        const ranges = forms.map((fm) => { const r = fm.getBoundingClientRect(); return [r.top + scrollY, r.bottom + scrollY]; });
        const maxY = document.documentElement.scrollHeight - innerHeight;
        const main = document.querySelector('main');
        const hero = main && main.firstElementChild;
        const heroBottom = hero ? hero.getBoundingClientRect().bottom + scrollY : 0;
        for (let y = Math.ceil(Math.max(innerHeight, heroBottom)); y <= maxY; y += 80) {
          if (ranges.every(([a, b]) => b <= y || a >= y + innerHeight)) {
            window.scrollTo({ top: y, behavior: 'instant' });
            await wait(650);
            out.gap = { y, visible: __qa.present(bar), cls: bar.className };
            break;
          }
        }
        window.scrollTo({ top: 0, behavior: 'instant' });
        return out;
      }, vp.width < 1024);
      if (barCheck.missing) { if (p.kind !== 'thankyou') f('mobile bar', 'missing .mobile-bar'); }
      else if (vp.width >= 1024) {
        if (barCheck.atTop || barCheck.desktopMid) f('mobile bar', 'shown at desktop width');
      } else {
        for (const o of barCheck.overForm) if (o.visible) f('mobile bar', `visible while form[data-placement="${o.placement}"] is on screen (class "${o.cls}")`);
        if (!barCheck.number) f('mobile bar', 'the call button does not show the phone number');
        if (barCheck.gap && !barCheck.gap.visible) f('mobile bar', `hidden with no form on screen at y=${barCheck.gap.y} (class "${barCheck.gap.cls}")`);
        result.mobileBar = barCheck;
      }
      await settle(page, 400);

      // axe WCAG 2.1 A/AA
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      result.axeViolations = axe.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
      for (const v of result.axeViolations) f('axe', `${v.id} (${v.impact}, ${v.nodes} node(s)): ${v.help} at ${v.targets.join(' | ')}`);

      // Full-page capture briefly emulates another viewport, which can replay entrance animations
      // (for example on blocks hidden below 980px) and catch them at opacity 0. Resting states are the
      // finished visible states, so drop animations for this layout-review screenshot only.
      if (FULL.has(p.route) && vp.width !== 320) await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
      if (FULL.has(p.route) && vp.width !== 320) await page.screenshot({ path: path.join(SHOTS, `${slugOf(p.route)}-${vp.width}-full.jpg`), type: 'jpeg', quality: 60, fullPage: true, animations: 'disabled' });
    } catch (e) {
      f('run', `exception: ${e.message.split('\n')[0]}`);
    } finally {
      log.closed = true;
      for (const e of log.errors) f('console', e.slice(0, 300));
      for (const r of [...new Set(log.failed)]) f('network', r);
      await ctx.close().catch(() => {});
    }
    pageResults.push(result);
    process.stdout.write(result.failures.length ? 'x' : '.');
  }
  const CONC = Math.max(1, Number(process.env.BROWSER_CONCURRENCY || 3));
  console.log(`Browser check: ${pages.length} pages x ${VIEWPORTS.length} viewports at ${LOCAL}/ (concurrency ${CONC})`);
  if (missing.length) console.log(`Not in dist, skipped: ${missing.join(' ')}`);
  const queue = [...tasks];
  await Promise.all(Array.from({ length: CONC }, async () => { while (queue.length) await runTask(queue.shift()); }));
  process.stdout.write('\n');

  // ----- Tablet widths (iPad portrait and landscape): the widths where layouts switch -----------
  const TABLETS = [{ width: 768, height: 1024 }, { width: 834, height: 1112 }, { width: 1024, height: 768 }];
  const tabletPages = [pages.find((p) => p.kind === 'home'), pages.find((p) => p.kind === 'local'), pages.find((p) => p.kind === 'service'), pages.find((p) => p.route === '/faq/'), pages.find((p) => p.kind === 'hub')].filter(Boolean);
  const tabletResults = [];
  for (const vp of TABLETS) {
    for (const p of tabletPages) {
      const where = `${p.route} @${vp.width}x${vp.height}`;
      const ctx = await makeContext({ viewport: vp, reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      const log = watch(page);
      try {
        await page.goto(LOCAL + p.route, { waitUntil: 'load' });
        await settle(page, 400);
        await scrollThrough(page);
        const r = await page.evaluate(() => {
          const de = document.documentElement;
          const row = document.querySelector('header.site-header .hdr').getBoundingClientRect();
          const acts = document.querySelector('header.site-header .hdr-actions').getBoundingClientRect();
          return { overflow: Math.max(de.scrollWidth, document.body.scrollWidth) > de.clientWidth + 1, clipped: __qa.clipped(), row: Math.round(row.right), acts: Math.round(acts.right), photos: __qa.photos1x(), cards: __qa.cardRows() };
        });
        if (r.photos.length) fail('tablet', `${where}: ${r.photos.length} photo(s) past their own pixels or outside the frame system: ${r.photos.slice(0, 4).join(' | ')}`);
        if (r.cards.length) fail('tablet', `${where}: property cards ${r.cards.join(' | ')}`);
        if (r.overflow) fail('tablet', `${where}: horizontal overflow`);
        if (r.clipped.length) fail('tablet', `${where}: ${r.clipped.length} text element(s) cut off: ${r.clipped.slice(0, 4).join(' | ')}`);
        if (Math.abs(r.acts - r.row) > 2) fail('tablet', `${where}: header controls end at x=${r.acts}, the header row at x=${r.row}`);
        tabletResults.push({ route: p.route, width: vp.width, height: vp.height, clipped: r.clipped.length });
        await page.screenshot({ path: path.join(SHOTS, `${slugOf(p.route)}-${vp.width}x${vp.height}.jpg`), type: 'jpeg', quality: 60 });
      } catch (e) { fail('tablet', `${where}: exception ${e.message.split('\n')[0]}`); }
      finally { log.closed = true; for (const e of log.errors) fail('console', `${where} ${e}`); await ctx.close().catch(() => {}); }
    }
  }

  // ----- Phone menu: fills the screen below the header, the page behind it stays put, Escape closes it
  const menuResult = {};
  const homePage = pages.find((p) => p.kind === 'home');
  if (homePage) {
    const where = `${homePage.route} @390 menu`;
    const ctx = await makeContext({ viewport: VIEWPORTS[1], reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    try {
      await page.goto(LOCAL + homePage.route, { waitUntil: 'load' });
      await page.locator('[data-menu]').click();
      await settle(page, 300);
      const y0 = await page.evaluate(() => scrollY);
      await page.mouse.move(195, 700);
      await page.mouse.wheel(0, 600);
      await settle(page, 400);
      const m = await page.evaluate((y) => {
        const panel = document.querySelector('[data-mnav]');
        const r = panel.getBoundingClientRect();
        return { open: !panel.hidden, bottom: Math.round(r.bottom), vh: innerHeight, moved: scrollY !== y, subs: panel.querySelectorAll('.mnav-sub a').length };
      }, y0);
      Object.assign(menuResult, m);
      if (!m.open) fail('menu', `${where}: the menu did not open`);
      if (m.bottom < m.vh - 2) fail('menu', `${where}: the open menu stops at y=${m.bottom} of ${m.vh}, the page shows underneath`);
      if (m.moved) fail('menu', `${where}: the page scrolls behind the open menu`);
      if (m.subs < 4) fail('menu', `${where}: the commercial property types are not listed under Commercial`);
      await page.keyboard.press('Escape');
      await settle(page, 200);
      const closed = await page.evaluate(() => document.querySelector('[data-mnav]').hidden && !document.documentElement.classList.contains('menu-lock') && document.activeElement === document.querySelector('[data-menu]'));
      if (!closed) fail('menu', `${where}: Escape does not close the menu, unlock the page and return focus to the button`);
    } catch (e) { fail('menu', `${where}: exception ${e.message.split('\n')[0]}`); }
    finally { await ctx.close().catch(() => {}); }
  }

  // ----- Form details: presets from the URL, Enter before the last step, inline errors, one step event per step
  const formExtras = {};
  const commercialLocal = pages.find((p) => p.kind === 'local' && p.service === 'commercial-holiday-lighting');
  if (commercialLocal) {
    const where = `${commercialLocal.route}?property=hoa&lights=poles @1440`;
    const ctx = await makeContext({ viewport: VIEWPORTS[0], reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    try {
      await page.goto(LOCAL + commercialLocal.route + '?property=hoa&lights=poles', { waitUntil: 'load' });
      await settle(page, 300);
      const r = await page.evaluate(() => {
        const f = document.querySelector('#estimate form[data-quote]');
        return {
          tag: (f.querySelector('[data-context-text]') || {}).textContent || '',
          poles: !!f.querySelector('input[name="what_to_light"][value="Poles and lampposts"]:checked'),
          pill: (document.querySelector('[data-plan-pill][aria-pressed="true"]') || {}).textContent || '',
        };
      });
      formExtras.urlPreset = r;
      if (!/^HOA or entrance in /.test(r.tag)) fail('forms', `${where}: the card tag reads "${r.tag}", expected "HOA or entrance in ..."`);
      if (!r.poles) fail('forms', `${where}: ?lights=poles did not check "Poles and lampposts"`);
      if (r.pill && !/HOA/.test(r.pill)) fail('forms', `${where}: the "Planning for" pill shows "${r.pill}"`);
    } catch (e) { fail('forms', `${where}: exception ${e.message.split('\n')[0]}`); }
    finally { await ctx.close().catch(() => {}); }
  }
  if (homePage) {
    const where = `${homePage.route} @1440 form details`;
    const ctx = await makeContext({ viewport: VIEWPORTS[0], reducedMotion: 'reduce' });
    const flowEvents = [];
    await ctx.exposeBinding('__qaEvent2', (_src, ev) => { flowEvents.push(ev); });
    await ctx.addInitScript(() => {
      const dl = (window.dataLayer = window.dataLayer || []);
      const orig = dl.push.bind(dl);
      dl.push = function (...args) { for (const a of args) { try { if (a && a.event) window.__qaEvent2(JSON.parse(JSON.stringify(a))); } catch { /* ignore */ } } return orig(...args); };
    });
    const page = await ctx.newPage();
    try {
      await page.goto(LOCAL + homePage.route, { waitUntil: 'load' });
      const form = page.locator('#estimate form[data-quote]');
      await form.scrollIntoViewIfNeeded();
      await form.locator('[data-next]').click();
      await form.locator('[data-back]').click();
      await form.locator('[data-next]').click();
      await settle(page, 200);
      const steps2 = flowEvents.filter((e) => e.event === 'estimate_step' && e.step === 2).length;
      if (steps2 !== 1) fail('dataLayer', `${where}: Next, Back, Next pushed estimate_step 2 ${steps2} times (expected once)`);
      const address = form.locator('input[name="address"]');
      if (await address.count()) {
        await address.fill('123 Main St');
        await address.press('Enter');
        await settle(page, 250);
        const st = await page.evaluate(() => { const f = document.querySelector('#estimate form[data-quote]'); return { step: f.querySelector('[data-step-active]').getAttribute('data-step'), invalid: f.querySelectorAll('[aria-invalid="true"]').length, status: f.querySelector('[role="status"]').textContent.trim() }; });
        formExtras.enter = st;
        if (st.step !== '3') fail('forms', `${where}: Enter in the step 2 address field went to step ${st.step}, expected step 3`);
        if (st.invalid || st.status) fail('forms', `${where}: Enter before the last step showed errors (${st.invalid} invalid, status "${st.status}")`);
      }
      await form.locator('input[name="phone"]').fill('555');
      await form.locator('button[type="submit"]').click();
      await settle(page, 250);
      const errs = await page.evaluate(() => {
        const f = document.querySelector('#estimate form[data-quote]');
        const phone = f.querySelector('input[name="phone"]');
        const d = phone.getAttribute('aria-describedby');
        const el = d && document.getElementById(d);
        return { shown: [...f.querySelectorAll('[data-err]')].filter((e) => !e.hidden).map((e) => e.textContent), phoneMsg: el ? el.textContent : '' };
      });
      formExtras.inlineErrors = errs;
      if (errs.shown.length < 2) fail('forms', `${where}: an empty name and a short phone show ${errs.shown.length} inline message(s)`);
      if (!/area code/i.test(errs.phoneMsg)) fail('forms', `${where}: a short phone number is not explained under the field ("${errs.phoneMsg}")`);
      await page.locator('header a[data-cta="estimate"]').first().click();
      await settle(page, 150);
      if (!flowEvents.some((e) => e.event === 'estimate_cta_click' && e.placement === 'header')) fail('dataLayer', `${where}: the header estimate button pushed no estimate_cta_click`);
    } catch (e) { fail('forms', `${where}: exception ${e.message.split('\n')[0]}`); }
    finally { await ctx.close().catch(() => {}); }
  }

  // ----- Reduced motion: fully lit immediately, videos never start -----------------------
  const rmPages = [pages.find((p) => p.kind === 'home'), ...pages.filter((p) => p.kind === 'local').slice(0, 2), pages.find((p) => p.kind === 'service')].filter(Boolean);
  const reducedResults = [];
  for (const vp of [VIEWPORTS[0], VIEWPORTS[1]]) {
    for (const p of rmPages) {
      const where = `${p.route} @${vp.width} reduced-motion`;
      const ctx = await makeContext({ viewport: vp, reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      const log = watch(page);
      try {
        await page.goto(LOCAL + p.route, { waitUntil: 'load' });
        await settle(page, 350);
        const lit = await page.evaluate(() => {
          const bad = [];
          const els = [...document.querySelectorAll('[data-reveal], h1, h1 *, form[data-quote]')];
          for (const el of els) {
            const cs = getComputedStyle(el);
            if (cs.display === 'none') continue;
            const o = __qa.eff(el);
            if (o < 0.99 || cs.visibility === 'hidden') bad.push(`${__qa.sel(el)} opacity ${o.toFixed(2)} ${cs.visibility}`);
          }
          const running = document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.getComputedTiming && (a.effect.getComputedTiming().iterations === Infinity || a.effect.getComputedTiming().activeDuration > 1200));
          return { bad: bad.slice(0, 8), badCount: bad.length, checked: els.length, running: running.length, runningOn: running.slice(0, 4).map((a) => (a.effect.target ? __qa.sel(a.effect.target) : '?') + ' ' + (a.animationName || '')) };
        });
        if (lit.badCount) fail('reduced motion', `${where}: ${lit.badCount} element(s) not fully lit: ${lit.bad.join(' | ')}`);
        if (lit.running) warn('reduced motion', `${where}: ${lit.running} long or infinite animation(s) still running: ${lit.runningOn.join(' | ')}`);
        await settle(page, 3600);
        const vids = await page.evaluate(() => [...document.querySelectorAll('video[data-bg-video]')].map((v) => ({ paused: v.paused, t: v.currentTime, src: v.currentSrc })));
        const playing = vids.filter((v) => !v.paused || v.t > 0);
        if (playing.length) fail('reduced motion', `${where}: ${playing.length} background video(s) started`);
        reducedResults.push({ route: p.route, width: vp.width, checked: lit.checked, notLit: lit.badCount, runningAnimations: lit.running, videos: vids.length, videosStarted: playing.length });
        await page.screenshot({ path: path.join(SHOTS, `${slugOf(p.route)}-${vp.width}-reduced.jpg`), type: 'jpeg', quality: 60 });
      } catch (e) { fail('reduced motion', `${where}: exception ${e.message.split('\n')[0]}`); }
      finally { log.closed = true; for (const e of log.errors) fail('console', `${where} ${e}`); await ctx.close().catch(() => {}); }
    }
  }

  // ----- JavaScript disabled: every reveal visible, all text readable --------------------
  const noJsResults = [];
  let directMode = null;
  for (const vp of [VIEWPORTS[0], VIEWPORTS[1]]) {
    for (const p of pages) {
      const where = `${p.route} @${vp.width} no-JS`;
      const ctx = await makeContext({ viewport: vp, javaScriptEnabled: false });
      const page = await ctx.newPage();
      try {
        await page.goto(LOCAL + p.route, { waitUntil: 'load' });
        const r = await page.evaluate(() => {
          const out = { reveals: 0, hiddenReveals: [], unreadable: [], forms: [], h1: false, phone: false, estimate: false, direct: false };
          for (const el of document.querySelectorAll('[data-reveal]')) {
            out.reveals++;
            const cs = getComputedStyle(el);
            const o = __qa.eff(el);
            if (!__qa.shown(el) || o < 0.99) out.hiddenReveals.push(`${__qa.sel(el)} (opacity ${o.toFixed(2)}, ${cs.display}, ${cs.visibility})`);
          }
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          const seen = new Set();
          for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            if (!n.nodeValue.trim()) continue;
            const el = n.parentElement;
            if (!el || seen.has(el) || el.closest('script,style,template,[hidden],[aria-hidden="true"],dialog:not([open]),details:not([open]) > :not(summary)')) continue;
            if (el.closest(':disabled, [aria-disabled="true"]')) continue; // disabled controls are exempt, as in WCAG 1.4.3
            seen.add(el);
            if (__qa.srOnly(el)) continue;
            const cs = getComputedStyle(el);
            if (cs.display === 'none') continue;
            if (el.closest('[data-step]') && !el.closest('[data-step="1"]')) continue; // later steps are judged below
            const o = __qa.eff(el);
            const alpha = (cs.color.match(/rgba?\(([^)]+)\)/)?.[1].split(/[,/ ]+/).filter(Boolean)[3]) ?? '1';
            if (!__qa.shown(el) || o < 0.9 || cs.visibility === 'hidden' || parseFloat(alpha) < 0.5) {
              // Elements hidden by the design at rest (for example closed menus) are fine only when the whole branch is display:none.
              let hiddenBranch = false;
              for (let e = el; e; e = e.parentElement) if (getComputedStyle(e).display === 'none') { hiddenBranch = true; break; }
              if (!hiddenBranch) out.unreadable.push(`${__qa.sel(el)} "${n.nodeValue.trim().slice(0, 30)}" (opacity ${o.toFixed(2)})`);
            }
          }
          const h1 = document.querySelector('h1');
          out.h1 = !!h1 && __qa.shown(h1) && __qa.eff(h1) > 0.99;
          out.phone = [...document.querySelectorAll('header.site-header a[data-contact="phone"]')].some((e) => __qa.shown(e));
          out.estimate = [...document.querySelectorAll('header.site-header a[data-cta="estimate"]')].some((e) => __qa.shown(e));
          for (const f of document.querySelectorAll('form[data-quote]')) {
            out.direct = out.direct || !!f.querySelector('input[name="access_key"]');
            const steps = [...f.querySelectorAll('[data-step]')];
            const submit = f.querySelector('button[type="submit"]');
            out.forms.push({ placement: f.dataset.placement, steps: steps.length, shownSteps: steps.filter((s) => __qa.shown(s)).length, submit: !!submit && __qa.shown(submit) });
          }
          return out;
        });
        directMode = directMode ?? r.direct;
        if (r.hiddenReveals.length) fail('no-JS', `${where}: ${r.hiddenReveals.length} [data-reveal] hidden: ${r.hiddenReveals.slice(0, 5).join(' | ')}`);
        if (r.unreadable.length) fail('no-JS', `${where}: ${r.unreadable.length} text element(s) unreadable: ${r.unreadable.slice(0, 5).join(' | ')}`);
        if (!r.h1) fail('no-JS', `${where}: H1 not visible`);
        // The thank-you page offers the phone only; every other page has the phone and the estimate button.
        if (!r.phone || (!r.estimate && p.kind !== 'thankyou')) fail('no-JS', `${where}: header phone or estimate not visible`);
        for (const fm of r.forms) {
          if (fm.shownSteps < fm.steps || !fm.submit) (r.direct ? fail : warn)('no-JS', `${where}: form[data-placement="${fm.placement}"] shows ${fm.shownSteps}/${fm.steps} steps${fm.submit ? '' : ' and no submit button'} without JavaScript${r.direct ? ' (direct mode must work without JS)' : ''}`);
        }
        noJsResults.push({ route: p.route, width: vp.width, reveals: r.reveals, hiddenReveals: r.hiddenReveals.length, unreadable: r.unreadable.length, forms: r.forms });
        if (p.kind === 'home' || p.kind === 'local') await page.screenshot({ path: path.join(SHOTS, `${slugOf(p.route)}-${vp.width}-nojs.jpg`), type: 'jpeg', quality: 60, fullPage: vp.width === 390 && p.kind === 'home' });
      } catch (e) { fail('no-JS', `${where}: exception ${e.message.split('\n')[0]}`); }
      finally { await ctx.close().catch(() => {}); }
    }
  }

  // ----- Background video: plays in Chrome, pause button works, gated by saveData and slow networks
  const videoResult = {};
  const home = pages.find((p) => p.kind === 'home');
  if (home) {
    const where = `${home.route} @1440 video`;
    const ctx = await makeContext({ viewport: VIEWPORTS[0], reducedMotion: 'no-preference' });
    const page = await ctx.newPage();
    try {
      await page.goto(LOCAL + home.route, { waitUntil: 'load' });
      const count = await page.locator('video[data-bg-video]').count();
      videoResult.videos = count;
      if (count) {
        const started = await page.waitForFunction(() => [...document.querySelectorAll('video[data-bg-video]')].some((v) => !v.paused && v.currentTime > 0.2), null, { timeout: 15000 }).then(() => true, () => false);
        videoResult.started = started;
        if (!started) fail('video', `${where}: no background video started within 15s of load`);
        else {
          const marked = await page.evaluate(() => {
            const v = [...document.querySelectorAll('video[data-bg-video]')].find((x) => !x.paused);
            let btn = v.id ? document.querySelector(`button[aria-controls="${v.id}"]`) : null;
            for (let scope = v.parentElement; !btn && scope; scope = scope.parentElement) btn = [...scope.querySelectorAll('button')].find((b) => /pause|play/i.test((b.getAttribute('aria-label') || '') + ' ' + b.textContent));
            if (!btn) return false;
            v.setAttribute('data-qa-video', '');
            btn.setAttribute('data-qa-toggle', '');
            return true;
          });
          if (!marked) fail('video', `${where}: no pause/play button found for the playing video`);
          else {
            await page.locator('[data-qa-toggle]').click();
            await settle(page, 400);
            const paused = await page.locator('[data-qa-video]').evaluate((v) => v.paused);
            if (!paused) fail('video', `${where}: pause button did not pause the video`);
            await page.locator('[data-qa-toggle]').click();
            await settle(page, 800);
            const resumed = await page.locator('[data-qa-video]').evaluate((v) => !v.paused);
            if (!resumed) fail('video', `${where}: play button did not resume the video`);
            videoResult.toggle = paused && resumed;
          }
        }
      }
    } catch (e) { fail('video', `${where}: exception ${e.message.split('\n')[0]}`); }
    finally { await ctx.close().catch(() => {}); }
    if (videoResult.videos) {
      for (const mode of ['saveData', '3g', '2g']) {
        const ctx2 = await makeContext({ viewport: VIEWPORTS[1], reducedMotion: 'no-preference' });
        await ctx2.addInitScript((m) => {
          const conn = { saveData: m === 'saveData', effectiveType: m === 'saveData' ? '4g' : m, downlink: 1, rtt: 300, addEventListener() {}, removeEventListener() {}, onchange: null };
          try { Object.defineProperty(Navigator.prototype, 'connection', { get() { return conn; }, configurable: true }); } catch { /* ignore */ }
        }, mode);
        const pg = await ctx2.newPage();
        try {
          await pg.goto(LOCAL + home.route, { waitUntil: 'load' });
          await settle(pg, 6000);
          const started = await pg.evaluate(() => [...document.querySelectorAll('video[data-bg-video]')].filter((v) => !v.paused || v.currentTime > 0).length);
          videoResult[mode] = started ? 'started' : 'held';
          if (started) fail('video', `${home.route} @390 ${mode}: ${started} background video(s) started`);
        } catch (e) { fail('video', `${mode}: exception ${e.message.split('\n')[0]}`); }
        finally { await ctx2.close().catch(() => {}); }
      }
    }
  }

  // ----- Forms: walk the steps, validate, submit with interception ------------------------
  const formResults = [];
  const events = [];
  async function formFlow({ route, vp, label, directFailFirst }) {
    const where = `${route} @${vp.width} form`;
    const out = { route, width: vp.width, label, steps: [], events: [] };
    const ctx = await makeContext({ viewport: vp, reducedMotion: 'reduce' });
    const flowEvents = [];
    await ctx.exposeBinding('__qaEvent', (_src, ev) => { flowEvents.push({ ...ev, __t: Date.now() }); });
    await ctx.addInitScript(() => {
      const dl = (window.dataLayer = window.dataLayer || []);
      const orig = dl.push.bind(dl);
      dl.push = function (...args) {
        for (const a of args) { try { if (a && typeof a === 'object' && a.event) window.__qaEvent(JSON.parse(JSON.stringify(a))); } catch { /* ignore */ } }
        return orig(...args);
      };
    });
    const page = await ctx.newPage();
    const log = watch(page);
    const w3fBefore = external.web3forms.length;
    const attBefore = external.attribution.length;
    try {
      await page.goto(LOCAL + route, { waitUntil: 'load' });
      await settle(page, 500);
      const mode = await page.evaluate(() => (document.querySelector('form[data-quote] input[name="access_key"]') ? 'direct' : 'preview'));
      out.mode = mode;
      out.apex = await page.evaluate(() => !!(window.apexAttribution && window.apexAttribution.attach));
      if (process.env.WEB3FORMS_KEY && mode !== 'direct') fail('forms', `${where}: WEB3FORMS_KEY is set but the page is in preview mode`);

      // contact_click from the header phone
      const placement = await page.evaluate(() => {
        const a = document.querySelector('header.site-header a[data-contact="phone"][data-placement="header"]');
        if (!a) return null;
        a.addEventListener('click', (e) => e.preventDefault(), { once: true });
        a.click();
        return a.dataset.placement;
      });
      await settle(page, 150);
      if (placement && !flowEvents.some((e) => e.event === 'contact_click' && e.channel === 'phone' && e.placement === placement)) fail('dataLayer', `${where}: header phone click did not push contact_click {channel:"phone", placement:"${placement}"}`);

      const formSel = await page.evaluate(() => {
        const f = document.querySelector('form[data-quote][data-placement="hero"]') || document.querySelector('form[data-quote]');
        if (!f) return null;
        f.setAttribute('data-qa-form', '');
        f.scrollIntoView({ block: 'start', behavior: 'instant' });
        return f.dataset.placement;
      });
      if (!formSel) { fail('forms', `${where}: no form[data-quote]`); return out; }
      const form = page.locator('[data-qa-form]');
      out.placement = formSel;
      const hp = await form.locator('input[name="botcheck"]').evaluate((e) => ({ shown: __qa.shown(e) && __qa.eff(e) > 0.05 && !__qa.srOnly(e), tab: e.tabIndex, value: e.value })).catch(() => null);
      if (!hp) fail('forms', `${where}: honeypot missing`);
      else if (hp.shown || hp.tab !== -1) fail('forms', `${where}: honeypot is visible or focusable`);
      const presetCity = await form.locator('[name="city"]').first().evaluate((e) => e.value).catch(() => '');
      out.presetCity = presetCity;

      // Mark the target in the page, then click it by locator so Playwright sends real pointer events.
      const markClick = async (kind) => {
        const ok = await page.evaluate((k) => {
          document.querySelectorAll('[data-qa-target]').forEach((e) => e.removeAttribute('data-qa-target'));
          const f = document.querySelector('[data-qa-form]');
          const s = f.querySelector('[data-step-active]') || f;
          const labelOf = (c) => { const lab = c.labels && c.labels[0]; return lab && __qa.shown(lab) ? lab : c; };
          let el = null;
          if (k === 'chip') {
            const chips = [...s.querySelectorAll('input[name="what_to_light"]')];
            if (chips.length && !chips.some((c) => c.checked)) el = labelOf(chips[0]);
          } else if (k === 'property') {
            const radios = [...s.querySelectorAll('input[type="radio"][name="property_type"]')];
            if (radios.length && !radios.some((c) => c.checked)) el = labelOf(radios[0]);
          } else if (k === 'next') {
            const btns = [...f.querySelectorAll('button:not([type="submit"])')].filter((b) => __qa.shown(b) && !b.hasAttribute('aria-pressed') && !/back|previous|prev\b|pause|play/i.test(b.textContent + ' ' + (b.getAttribute('aria-label') || '')));
            el = btns.find((b) => /next|continue|contact|details|step/i.test(b.textContent)) || btns[btns.length - 1] || null;
          }
          if (!el) return false;
          el.setAttribute('data-qa-target', '');
          return true;
        }, kind);
        if (!ok) return false;
        await page.locator('[data-qa-target]').click({ timeout: 5000 });
        return true;
      };
      const activeStep = () => page.evaluate(() => { const f = document.querySelector('[data-qa-form]'); const a = f.querySelector('[data-step-active]'); return a ? a.getAttribute('data-step') : null; });
      const submitVisible = () => form.locator('button[type="submit"]').first().isVisible();

      let submitShown = false;
      for (let i = 0; i < 6; i++) {
        const step = await activeStep();
        out.steps.push(step);
        // Choose a chip, a property type and a city when this step shows them and nothing is chosen yet.
        await markClick('chip');
        await markClick('property');
        await page.evaluate(() => {
          const f = document.querySelector('[data-qa-form]');
          const s = f.querySelector('[data-step-active]') || f;
          for (const sel of s.querySelectorAll('select')) {
            if (!sel.value && __qa.shown(sel)) { const o = [...sel.options].find((x) => x.value); if (o) { sel.value = o.value; sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true })); } }
          }
        });
        if (await submitVisible()) { submitShown = true; break; }
        const advanced = await markClick('next');
        if (!advanced) { fail('forms', `${where}: no Next button on step ${step}`); break; }
        await settle(page, 350);
        const after = await activeStep();
        if (after === step) { fail('forms', `${where}: Next did not advance from step ${step}`); break; }
      }
      out.steps.push(await activeStep());
      if (!submitShown && !(await submitVisible())) { fail('forms', `${where}: never reached a visible submit button (steps ${out.steps.join(' > ')})`); return out; }
      if (!flowEvents.some((e) => e.event === 'estimate_start')) fail('dataLayer', `${where}: no estimate_start after the first interaction`);
      if (flowEvents.filter((e) => e.event === 'estimate_start').length > 1) warn('dataLayer', `${where}: estimate_start fired more than once`);
      const stepEvents = flowEvents.filter((e) => e.event === 'estimate_step');
      if (out.steps.filter(Boolean).length > 1 && !stepEvents.length) fail('dataLayer', `${where}: no estimate_step events while advancing`);
      if (stepEvents.some((e) => e.step === undefined)) fail('dataLayer', `${where}: estimate_step without {step}`);

      // Empty submit: validation must stop it and point at the first missing field.
      const w3fPreEmpty = external.web3forms.length;
      await form.locator('button[type="submit"]').first().click();
      await settle(page, 500);
      const v = await page.evaluate(() => {
        const f = document.querySelector('[data-qa-form]');
        const a = document.activeElement;
        return { focusInForm: !!a && f.contains(a) && /INPUT|SELECT|TEXTAREA/.test(a.tagName), invalid: f.querySelectorAll('[aria-invalid="true"]').length, url: location.href };
      });
      if (external.web3forms.length > w3fPreEmpty) fail('forms', `${where}: an empty contact step was sent`);
      if (!v.focusInForm || !v.invalid) warn('forms', `${where}: empty submit should set aria-invalid and focus the first missing field (focus in form ${v.focusInForm}, aria-invalid ${v.invalid})`);
      if (flowEvents.some((e) => e.event === 'generate_lead')) fail('dataLayer', `${where}: generate_lead fired on a failed validation`);

      // Fill the contact step
      await page.evaluate(() => {
        const f = document.querySelector('[data-qa-form]');
        const s = f.querySelector('[data-step-active]') || f;
        const set = (el, val) => { el.focus(); el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
        for (const el of s.querySelectorAll('input, textarea, select')) {
          if (el.name === 'botcheck' || el.type === 'hidden' || !__qa.shown(el)) continue;
          if (el.type === 'checkbox' || el.type === 'radio') { if (el.required && !el.checked) el.click(); continue; }
          if (el.tagName === 'SELECT') { if (!el.value) { const o = [...el.options].find((x) => x.value); if (o) set(el, o.value); } continue; }
          if (el.value) continue;
          const hint = (el.name + ' ' + el.id + ' ' + (el.autocomplete || '')).toLowerCase();
          if (el.type === 'tel' || /phone|tel/.test(hint)) set(el, '(248) 555-0100');
          else if (el.type === 'email' || /mail/.test(hint)) set(el, 'browser-qa@example.org');
          else if (/zip|postal/.test(hint)) set(el, '48430');
          else if (el.tagName === 'TEXTAREA') set(el, 'Automated browser check. Please ignore.');
          else if (/name/.test(hint)) set(el, 'Browser QA');
          else set(el, 'Browser QA');
        }
      });

      if (mode === 'preview') {
        const w3f0 = external.web3forms.length;
        await form.locator('button[type="submit"]').first().click();
        await settle(page, 900);
        const pv = await page.evaluate(() => {
          const f = document.querySelector('[data-qa-form]');
          const scope = f.closest('section, aside, div') || f;
          const txt = [...scope.querySelectorAll('*')].filter((e) => __qa.shown(e) && /preview/i.test(e.textContent || '')).map((e) => __qa.text(e));
          const status = f.querySelector('[role="status"]');
          const call = [...scope.querySelectorAll('a[href^="tel:"]')].some((a) => __qa.shown(a));
          return { notice: txt.length > 0, status: status ? status.textContent.trim() : '', call, url: location.href };
        });
        out.preview = pv;
        if (external.web3forms.length > w3f0) fail('forms', `${where}: preview mode sent a request to api.web3forms.com`);
        if (!pv.notice) fail('forms', `${where}: preview mode shows no preview notice after submit (status "${pv.status}")`);
        if (!pv.call) fail('forms', `${where}: preview mode shows no call button after submit`);
        if (!pv.url.startsWith(LOCAL + route)) fail('forms', `${where}: preview submit navigated to ${pv.url}`);
        if (flowEvents.some((e) => e.event === 'generate_lead')) fail('dataLayer', `${where}: generate_lead fired in preview mode (no confirmed submission)`);
      } else {
        const formInfo = await page.evaluate(() => { const f = document.querySelector('[data-qa-form]'); return { key: f.querySelector('input[name="access_key"]')?.value, redirect: f.querySelector('input[name="redirect"]')?.value }; });
        if (directFailFirst) {
          formResponder = (rt) => rt.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'intercepted failure' }) });
          const n0 = external.web3forms.length;
          log.muted = true; // the site may log its own delivery error here
          await form.locator('button[type="submit"]').first().click();
          for (const t0 = Date.now(); external.web3forms.length === n0 && Date.now() - t0 < 6000;) await settle(page, 100);
          await settle(page, 1200);
          log.muted = false;
          const st = await page.evaluate(() => ({ status: document.querySelector('[data-qa-form] [role="status"]')?.textContent.trim() || '', url: location.href }));
          if (external.web3forms.length === n0) fail('forms', `${where}: direct mode did not call api.web3forms.com`);
          if (!st.status) fail('forms', `${where}: failed delivery shows no message in [role="status"]`);
          if (!st.url.startsWith(LOCAL + route)) fail('forms', `${where}: failed delivery navigated away to ${st.url}`);
          if (flowEvents.some((e) => e.event === 'generate_lead')) fail('dataLayer', `${where}: generate_lead fired for a failed delivery`);
          out.failedDelivery = st;
        }
        formResponder = (rt) => rt.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, message: 'intercepted' }) });
        const n1 = external.web3forms.length;
        await Promise.all([
          page.waitForURL(/\/thank-you\/?(?:[?#].*)?$/, { timeout: 10000 }).catch(() => fail('forms', `${where}: did not reach the thank-you page after a successful delivery`)),
          form.locator('button[type="submit"]').first().click(),
        ]);
        const sent = external.web3forms.slice(n1);
        out.sent = sent.map((s) => ({ method: s.method, url: s.url, contentType: s.contentType }));
        if (!sent.length) fail('forms', `${where}: no request to api.web3forms.com was attempted`);
        const last = sent.at(-1);
        if (last) {
          let body = {};
          try { body = JSON.parse(last.body); } catch {
            if (/multipart\/form-data/.test(last.contentType)) for (const m of last.body.matchAll(/name="([^"]+)"\r?\n\r?\n([\s\S]*?)\r?\n--/g)) body[m[1]] = m[2];
            else body = Object.fromEntries(new URLSearchParams(last.body));
          }
          out.payloadKeys = Object.keys(body);
          if (last.method !== 'POST' || !/api\.web3forms\.com\/submit/.test(last.url)) fail('forms', `${where}: expected POST https://api.web3forms.com/submit, got ${last.method} ${last.url}`);
          if (!body.access_key || body.access_key !== formInfo.key) fail('forms', `${where}: payload access_key missing or different from the form`);
          // The JavaScript path posts JSON and redirects in the browser after a confirmed success (checked above),
          // so a redirect field is only expected on a plain form POST; the no-JS POST test checks that one.
          const jsonPost = /application\/json/.test(last.contentType);
          if (!jsonPost && (!body.redirect || !/\/thank-you\/$/.test(body.redirect))) warn('forms', `${where}: form-encoded payload has no redirect field ending in /thank-you/`);
          if (!body.property_type || !body.city) fail('forms', `${where}: payload is missing property_type or city`);
          if (body.botcheck) fail('forms', `${where}: honeypot was filled`);
        }
        const lead = flowEvents.filter((e) => e.event === 'generate_lead');
        if (lead.length !== 1) fail('dataLayer', `${where}: expected one generate_lead after success, got ${lead.length}`);
        else {
          if (!lead[0].property_type || !lead[0].city) fail('dataLayer', `${where}: generate_lead needs {property_type, city}`);
          const okAt = external.web3forms.slice(n1)[0]?.at || 0;
          if (lead[0].__t < okAt) fail('dataLayer', `${where}: generate_lead fired before the delivery response`);
        }
        formResponder = null;
      }
      const pii = JSON.stringify(flowEvents);
      if (out.apex && !external.attribution.slice(attBefore).some((a) => /"kind"\s*:\s*"form"/.test(a.body)) && mode === 'direct') warn('attribution', `${where}: no apexAttribution.attach form post after success`);
      if (/Browser QA|555-0100|browser-qa@/i.test(pii)) fail('dataLayer', `${where}: personal details leaked into dataLayer`);
      out.events = flowEvents.map(({ __t, ...e }) => e);
      events.push(...out.events.map((e) => ({ where, ...e })));
    } catch (e) {
      fail('forms', `${where}: exception ${e.message.split('\n')[0]}`);
    } finally {
      formResponder = null;
      log.closed = true;
      for (const e of log.errors) if (!/web3forms|intercepted/i.test(e)) fail('console', `${where} ${e}`);
      await ctx.close().catch(() => {});
      out.web3formsRequests = external.web3forms.length - w3fBefore;
      formResults.push(out);
    }
  }
  const firstLocal = pages.find((p) => p.kind === 'local');
  if (firstLocal) await formFlow({ route: firstLocal.route, vp: VIEWPORTS[1], label: 'landing, phone', directFailFirst: true });
  if (home) await formFlow({ route: home.route, vp: VIEWPORTS[0], label: 'home, desktop', directFailFirst: false });

  // No-JavaScript POST in direct mode: the plain form must carry access_key and redirect.
  if (directMode && firstLocal) {
    const where = `${firstLocal.route} @390 no-JS POST`;
    const ctx = await makeContext({ viewport: VIEWPORTS[1], javaScriptEnabled: false });
    const page = await ctx.newPage();
    formResponder = (rt) => rt.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>ok</title><p>intercepted</p>' });
    const n0 = external.web3forms.length;
    try {
      await page.goto(LOCAL + firstLocal.route, { waitUntil: 'load' });
      const form = page.locator('form[data-quote][data-placement="hero"]').first();
      for (const sel of ['input[name="what_to_light"]', 'input[type="radio"][name="property_type"]']) {
        const el = form.locator(sel).first();
        if (await el.count()) await el.check({ force: true }).catch(() => {});
      }
      const fields = form.locator('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([name=botcheck]), textarea');
      for (let i = 0; i < await fields.count(); i++) {
        const el = fields.nth(i);
        if (!(await el.isVisible())) continue;
        const t = (await el.getAttribute('type')) || '';
        const n = ((await el.getAttribute('name')) || '').toLowerCase();
        await el.fill(t === 'tel' || /phone/.test(n) ? '(248) 555-0100' : t === 'email' || /mail/.test(n) ? 'browser-qa@example.org' : /zip/.test(n) ? '48430' : 'Browser QA');
      }
      // Focusing each field scrolls it into view, smoothly when the page sets scroll-behavior: smooth.
      // Clicking during that scroll reads as an unstable element, so wait for the scroll to settle first.
      await scrollSettled(page);
      await Promise.all([page.waitForLoadState('load').catch(() => {}), form.locator('button[type="submit"]').first().click()]);
      await settle(page, 800);
      const sent = external.web3forms.slice(n0).at(-1);
      if (!sent) fail('forms', `${where}: the plain form did not POST to api.web3forms.com`);
      else {
        const body = Object.fromEntries(new URLSearchParams(sent.body));
        if (sent.method !== 'POST') fail('forms', `${where}: method ${sent.method}`);
        if (!body.access_key) fail('forms', `${where}: no access_key in the plain POST`);
        if (!body.redirect || !/\/thank-you\/$/.test(body.redirect)) fail('forms', `${where}: redirect field missing or not the thank-you URL ("${body.redirect || ''}")`);
        formResults.push({ route: firstLocal.route, width: 390, label: 'no-JS POST', payloadKeys: Object.keys(body) });
      }
    } catch (e) { fail('forms', `${where}: exception ${e.message.split('\n')[0]}`); }
    finally { formResponder = null; await ctx.close().catch(() => {}); }
  }

  await browser.close();
  await srv.close();

  // Unexpected third parties
  const blocked = [...new Set(external.blocked)];
  for (const u of blocked) fail('third party', `unexpected request blocked: ${u}`);
  // Every api.web3forms.com request is answered by the route handler (fulfill), never continued, so none reaches the network.
  const realOutbound = 0;
  const report = {
    ok: failures.length === 0,
    config: { base: cfg.base, origin: cfg.origin, local: LOCAL, formMode: directMode ? 'direct' : 'preview', durationMs: Date.now() - started },
    pages: pages.map((p) => p.route), skipped: missing,
    pageChecks: pageResults.sort((a, b) => a.route.localeCompare(b.route) || b.width - a.width),
    tablets: tabletResults, menu: menuResult, formDetails: formExtras,
    reducedMotion: reducedResults, noJavaScript: noJsResults, video: videoResult, forms: formResults,
    dataLayerEvents: events,
    network: { web3formsIntercepted: external.web3forms.length, web3formsReachedNetwork: realOutbound, gtmStubbed: external.gtm, attributionIntercepted: external.attribution.length, blockedThirdParty: blocked },
    failures, warnings,
  };
  await fsp.writeFile(path.join(ROOT, 'reports', 'browser-results.json'), JSON.stringify(report, null, 2));

  // Summary
  const line = '-'.repeat(72);
  console.log(line);
  console.log(`Pages ${pages.length} x ${VIEWPORTS.length} widths, ${pageResults.length} page checks, ${tabletResults.length} tablet checks, ${reducedResults.length} reduced-motion, ${noJsResults.length} no-JS, ${formResults.length} form flows. Form mode: ${directMode ? 'direct' : 'preview'}.`);
  console.log(`Network: ${external.web3forms.length} Web3Forms request(s) intercepted, none sent. ${external.attribution.length} attribution post(s) intercepted. ${blocked.length} unexpected third-party request(s).`);
  const minFont = pageResults.filter((r) => r.minFontPx).map((r) => r.minFontPx);
  if (minFont.length) console.log(`Smallest visible text: ${Math.min(...minFont)}px`);
  if (videoResult.videos !== undefined) console.log(`Video: ${videoResult.videos} on home, started ${!!videoResult.started}, toggle ${videoResult.toggle ?? 'n/a'}, saveData ${videoResult.saveData ?? 'n/a'}, 3g ${videoResult['3g'] ?? 'n/a'}, 2g ${videoResult['2g'] ?? 'n/a'}`);
  const group = (list) => { const m = new Map(); for (const x of list) { if (!m.has(x.area)) m.set(x.area, []); m.get(x.area).push(x.msg); } return m; };
  if (warnings.length) {
    console.log(line + `\nWarnings (${warnings.length}):`);
    for (const [area, msgs] of group(warnings)) { console.log(`  ${area} (${msgs.length})`); for (const m of msgs.slice(0, 8)) console.log('    ' + m); if (msgs.length > 8) console.log(`    ... and ${msgs.length - 8} more`); }
  }
  if (failures.length) {
    console.log(line + `\nFailures (${failures.length}):`);
    for (const [area, msgs] of group(failures)) { console.log(`  x ${area} (${msgs.length})`); for (const m of msgs.slice(0, 10)) console.log('    ' + m); if (msgs.length > 10) console.log(`    ... and ${msgs.length - 10} more (see reports/browser-results.json)`); }
  }
  console.log(line);
  console.log(failures.length ? `FAIL: ${failures.length} problem(s). Screenshots in reports/browser/.` : `PASS: all browser checks clean. Screenshots in reports/browser/.`);
  process.exit(failures.length ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
