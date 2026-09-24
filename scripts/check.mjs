#!/usr/bin/env node
// Static quality gate for the generated site in dist/. Fast, no browser.
//
//   npm run check
//
// Environment (use the same values the build used):
//   BASE_PATH       default "/holiday-light-service-web" (inferred from dist/index.html canonical when unset)
//   SITE_ORIGIN     default "https://nradachy-web.github.io" (inferred the same way when unset)
//   INDEXABLE       "true" means pages must be indexable; anything else means every page is noindex,follow
//   WEB3FORMS_KEY   set means direct form delivery is expected in the HTML; unset means preview mode
//   GTM_ID          set means the GTM snippet is expected; unset means no GTM reference at all
//   APEX_FORM_TOKEN set means the vendored attribution script is expected on pages with a form
//   ALLOW_PLANNED=1 links to planned but not yet built pages become warnings instead of failures
//   DIST_DIR        check another folder (used for fixtures)
//   VERBOSE=1       also print allowed claim-pattern hits and every example of each failure
//
// Exits 1 when any failure is found. Writes reports/check-results.json.

import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.resolve(process.env.DIST_DIR || path.join(ROOT, 'dist'));
const CONTENT = path.join(ROOT, 'content');
const VERBOSE = process.env.VERBOSE === '1';
const ALLOW_PLANNED = process.env.ALLOW_PLANNED === '1';

const PHONE_TEL = 'tel:+12487568915';
const PHONE_DIGITS = '2487568915';
const CREDIT_HREF = 'https://modernapexstrategies.com';
const CREDIT_TEXT = 'Website & marketing by Modern Apex Strategies';
const FACEBOOK = 'https://www.facebook.com/holidaylightexpress';
const WEIGHT_BUDGET = 600 * 1024;
const TITLE_MAX = 64; // "under 65 characters"

// ---------------------------------------------------------------------------
// Result bookkeeping
// ---------------------------------------------------------------------------
const failures = new Map();
const warnings = new Map();
const plannedLinks = new Map();
function push(map, rule, msg) {
  if (!map.has(rule)) map.set(rule, []);
  map.get(rule).push(msg);
}
const fail = (rule, msg) => push(failures, rule, msg);
const warn = (rule, msg) => push(warnings, rule, msg);

if (!fss.existsSync(DIST)) {
  console.error(`check: ${path.relative(ROOT, DIST) || DIST} does not exist. Run npm run build first.`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
function normBase(b) {
  b = String(b ?? '').trim();
  if (b === '/' || b === '') return '';
  if (!b.startsWith('/')) b = '/' + b;
  return b.replace(/\/+$/, '');
}
const inferred = (() => {
  try {
    const html = fss.readFileSync(path.join(DIST, 'index.html'), 'utf8');
    const href = html.match(/<link[^>]+rel="canonical"[^>]*href="([^"]+)"/i)?.[1] || html.match(/<link[^>]+href="([^"]+)"[^>]*rel="canonical"/i)?.[1];
    if (!href) return null;
    const u = new URL(href);
    return { origin: u.origin, base: normBase(u.pathname) };
  } catch { return null; }
})();
const notes = [];
let BASE, ORIGIN;
if (process.env.BASE_PATH !== undefined) BASE = normBase(process.env.BASE_PATH);
else if (inferred) { BASE = inferred.base; notes.push(`BASE_PATH not set, inferred "${BASE}" from dist/index.html canonical`); }
else BASE = '/holiday-light-service-web';
if (process.env.SITE_ORIGIN) ORIGIN = process.env.SITE_ORIGIN.replace(/\/+$/, '');
else if (inferred) { ORIGIN = inferred.origin; notes.push(`SITE_ORIGIN not set, inferred "${ORIGIN}" from dist/index.html canonical`); }
else ORIGIN = 'https://nradachy-web.github.io';
const INDEXABLE = process.env.INDEXABLE === 'true';
const W3F_KEY = (process.env.WEB3FORMS_KEY || '').trim();
const GTM_ID = (process.env.GTM_ID || '').trim();
const APEX_TOKEN = (process.env.APEX_FORM_TOKEN || '').trim();
const SITE = ORIGIN + BASE;
const THANK_YOU_URL = SITE + '/thank-you/';

// ---------------------------------------------------------------------------
// Content (drives the URL plan and per-page expectations)
// ---------------------------------------------------------------------------
const readJSON = (p) => JSON.parse(fss.readFileSync(p, 'utf8'));
const copy = readJSON(path.join(CONTENT, 'site-copy.json'));
const media = readJSON(path.join(CONTENT, 'media.json'));
const cities = fss.readdirSync(path.join(CONTENT, 'cities')).filter((f) => f.endsWith('.json')).sort()
  .map((f) => readJSON(path.join(CONTENT, 'cities', f)));
const cityBySlug = new Map(cities.map((c) => [c.slug, c]));
const services = copy.services || [];
const serviceBySlug = new Map(services.map((s) => [s.slug, s]));
const landingServices = [...new Set(cities.flatMap((c) => Object.keys(c.pages || {})))];
const verticals = copy.verticals || [];
const guides = copy.guides || [];

const planned = new Set(['/', '/service-area/', '/our-work/', '/about/', '/process/', '/faq/', '/contact/', '/guides/', '/privacy/', '/thank-you/', '/404.html']);
for (const s of services) planned.add(`/${s.slug}/`);
for (const c of cities) {
  planned.add(`/service-area/${c.slug}/`);
  for (const svc of Object.keys(c.pages || {})) planned.add(`/${svc}/${c.slug}/`);
}
for (const v of verticals) planned.add(`/commercial/${v.slug}/`);
for (const g of guides) planned.add(`/guides/${g.slug}/`);

// Every file path media.json knows about, with the pixel width its name promises.
const mediaFiles = new Map();
for (const entry of media) {
  (function collect(v) {
    if (typeof v === 'string') { if (v.startsWith('/assets/')) mediaFiles.set(v, entry.name); }
    else if (v && typeof v === 'object') for (const x of Object.values(v)) collect(x);
  })(entry.files);
}

// ---------------------------------------------------------------------------
// Minimal HTML parser: enough structure for attribute and containment queries.
// ---------------------------------------------------------------------------
const VOID = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
const RAW = new Set(['script', 'style', 'textarea', 'title']);
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '\u00b7', hellip: '\u2026', rsquo: '\u2019', lsquo: '\u2018', ldquo: '\u201c', rdquo: '\u201d', copy: '\u00a9', reg: '\u00ae', trade: '\u2122', times: '\u00d7', rarr: '\u2192', larr: '\u2190', bull: '\u2022', mdash: '\u2014', ndash: '\u2013', thinsp: ' ', ensp: ' ', emsp: ' ' };
function decode(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try { return String.fromCodePoint(cp); } catch { return m; }
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}
function parseAttrs(raw) {
  const attrs = {};
  const re = /([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m = re.exec(raw))) {
    const name = m[1].toLowerCase();
    if (name in attrs) continue;
    attrs[name] = decode(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return attrs;
}
function parseHTML(html) {
  const lower = html.toLowerCase();
  const root = { tag: '#root', attrs: {}, start: 0, openEnd: 0, close: html.length, end: html.length, parent: null, children: [] };
  const nodes = [];
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<![^>]*>|<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[1]) {
      const tag = m[1].toLowerCase();
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === tag) {
          while (stack.length > i) { const n = stack.pop(); n.close = m.index; n.end = re.lastIndex; }
          break;
        }
      }
      continue;
    }
    if (!m[2]) continue;
    const tag = m[2].toLowerCase();
    const rawAttrs = m[3] || '';
    const node = { tag, attrs: parseAttrs(rawAttrs.replace(/\/\s*$/, '')), start: m.index, openEnd: re.lastIndex, close: null, end: null, parent: stack[stack.length - 1], children: [] };
    node.parent.children.push(node);
    nodes.push(node);
    if (VOID.has(tag) || /\/\s*$/.test(rawAttrs)) { node.close = node.end = node.openEnd; continue; }
    if (RAW.has(tag)) {
      const idx = lower.indexOf('</' + tag, re.lastIndex);
      node.close = idx < 0 ? html.length : idx;
      const gt = html.indexOf('>', node.close);
      node.end = gt < 0 ? html.length : gt + 1;
      re.lastIndex = node.end;
      continue;
    }
    stack.push(node);
  }
  while (stack.length > 1) { const n = stack.pop(); n.close = n.end = html.length; }
  return { html, root, nodes };
}
const cls = (n) => (n.attrs.class || '').split(/\s+/).filter(Boolean);
const hasClass = (n, c) => cls(n).includes(c);
const within = (n, anc) => n !== anc && n.start >= anc.start && n.end <= anc.end;
const inside = (n, pred) => { for (let p = n.parent; p; p = p.parent) if (pred(p)) return p; return null; };
const INLINE = /^(?:span|a|strong|em|b|i|small|sup|sub|abbr|mark|u|s|q|cite|time|bdi|bdo|data|var|kbd|code|wbr)$/;
function textOf(doc, n, { templates = false } = {}) {
  let s = doc.html.slice(n.openEnd, n.close ?? n.openEnd);
  s = s.replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(templates ? /<(script|style)\b[\s\S]*?<\/\1\s*>/gi : /<(script|style|template)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<\/?([a-zA-Z][\w:-]*)(?:[^>"']|"[^"]*"|'[^']*')*>/g, (t, tag) => (INLINE.test(tag.toLowerCase()) ? '' : ' '));
  return decode(s).replace(/\s+/g, ' ').trim();
}
const squash = (s) => String(s).toLowerCase().replace(/[\s\u00a0]+/g, '');

// ---------------------------------------------------------------------------
// Forbidden-claims rules (BRIEF.md "Claims you must NOT make")
// deny: always a failure when it overlaps the hit. allow: legitimate usage (process, direction).
// ---------------------------------------------------------------------------
const CLAIMS = [
  // "review" is fine as approval or planning language (HOA review, review the estimate); customer reviews are not.
  { id: 'review', re: /\breview(?:s|ed|ing)?\b/gi,
    deny: [/\b(?:google|customer|client|homeowner|online|yelp|facebook|five[- ]star|5[- ]star|glowing|great|rave|verified|real|our|read|see|leave|write|check\s+out)\s+(?:us\s+)?(?:a\s+)?reviews?\b/gi, /\breviews?\s+(?:from|on\s+google|on\s+facebook|say|speak)\b/gi],
    allow: [/\b(?:to|we|will|can|you|they|and|then|board|boards|association|associations|owner|owners|manager|managers|committee|commission|city|township|village|district|planning|design|historic|architectural|for|any|approval|permit|a|the|its|their|your|also|first|that|this|hoa|subdivision|need|needs|needed|require|requires|required|may|might|must|should|would|exterior|formal|quick|final|plan|site|zoning)\s+(?:review|reviews|reviewed|reviewing)\b/gi,
      /\breview(?:s|ed|ing)?\s+(?:the|your|it|each|every|one|a|an|exterior|permanent|plans?|designs?|layouts?|that|what|how|with|and|process|first|access|power|options|placement|straightforward|before|board|committee|requirements|rules|guidelines|approval|them)\b/gi] },
  { id: 'review', re: /\breviewers?\b/gi,
    allow: [{ re: /\b(?:historic|planning|board|association|commission|hoa|city|township|village)\b/gi, before: 260, anywhere: true }] },
  { id: 'stars', re: /\b(?:\d(?:\.\d)?|one|two|three|four|five)[- ]?stars?\b|\bstars\b|\bstar[- ]ratings?\b/gi },
  { id: 'rated', re: /\b(?:top[- ]|highly[- ]|best[- ])?rated\b/gi },
  { id: 'testimonial', re: /\btestimonials?\b/gi },
  { id: 'insured', re: /\b(?:fully\s+)?insured\b|\binsurance\b/gi },
  { id: 'licensed', re: /\blicen[cs]ed\b/gi },
  { id: 'certified', re: /\bcertifi(?:ed|cation|cations|cate|cates)\b/gi },
  { id: 'osha', re: /\bosha\b/gi },
  { id: 'warranty', re: /\bwarrant(?:y|ies|ied)\b/gi },
  { id: 'guarantee', re: /\bguarant(?:ee|eed|ees)\b/gi },
  { id: 'number-one', re: /#\s?1\b|\bnumber\s+one\b|\bno\.\s?1\b/gi },
  { id: 'best-in', re: /\bbest\s+in\b|\b(?:michigan'?s|area'?s|region'?s|detroit'?s)\s+best\b|\bbest\s+(?:holiday|christmas|lighting|light\s+install\w*|company|installers?)\b/gi },
  { id: 'top-rated', re: /\btop[- ]rated\b/gi },
  { id: 'leading', re: /\bleading\b/gi,
    allow: [/\bleading\s+(?:to|past|up|into|toward|towards|down|from|through|along|onto|out|across|around|off)\b/gi] },
  { id: 'lifespan', re: /\blife[- ]?span\b|\b\d[\d,]*\s*million\s+colou?rs\b/gi },
  { id: 'hours', re: /\b\d[\d,]*\s*-?\s*(?:hours?|hrs?)\b|\bhour\s+warrant\w*/gi },
  { id: 'price', re: /\$\s?\d|\b\d+\s*(?:dollars|usd)\b|\b\d+\s*%\s*off\b|\bfinancing\b|\bdiscounts?\b|\bcoupons?\b|\bpromo\s+code\b/gi },
  { id: 'per-foot', re: /\bper\s+(?:linear\s+)?(?:foot|feet|ft)\b|\/\s?(?:linear\s+)?(?:ft|foot)\b|\bper\s+(?:strand|bulb)\b/gi },
  { id: 'storage', re: /\bstorage\b|\bwe(?:'ll|\s+will)?\s+store\b|\bstore\s+(?:your|the|them|it)\s+(?:lights?|displays?|decor)\b/gi },
  { id: 'response-time', re: /\b24\s*\/\s*7\b|\b24\s*(?:hours|hrs)\b|\bsame[- ](?:week|day)\b|\bnext[- ]day\b|\bwithin\s+(?:\d+|one|two|three|a|an)\s+(?:hours?|days?|business\s+days?|weeks?)\b/gi },
  { id: 'brand-name', re: /\b(?:gemstone|trimlight|govee|jellyfish|oelo|twinkly|everlights)\b/gi },
  { id: 'award', re: /\baward[- ]?winning\b|\bawards?\b/gi },
  { id: 'counts', re: /\b\d[\d,]*\+?\s+(?:homes|houses|installs|installations|customers|clients|projects|displays|properties|businesses|hoas|neighborhoods)\s+(?:lit|served|installed|completed|decorated|and\s+counting)\b|\b(?:lit|served|installed|decorated)\s+(?:over|more\s+than)?\s*\d[\d,]*\+?\s+(?:homes|houses|customers|clients|projects|displays|properties|businesses)\b/gi },
  { id: 'ownership', re: /\b(?:lease[ds]?|leasing|rental|rented|you\s+own|yours\s+to\s+keep|you\s+keep)\b/gi, near: /\blights?\b|\bdisplay\b|\bstrands?\b/i },
];
// Numeric experience claims must say 20 (or "since 2003"); Ace's "since 2001" is the one approved family line.
const YEARS_RE = /\b(\d+)\+?\s*(?:years?|yrs)\s+(?:of\s+)?(?:experience|in\s+business|in\s+(?:holiday\s+)?lighting|lighting)\b/gi;
const SINCE_RE = /\b(?:serving|lighting|lit|installing|in\s+business|putting\s+up\s+lights)\b[^.]{0,60}\bsince\s+(\d{4})\b/gi;
const PAST_WORK_RE = /\bwe(?:'ve|\s+have)?\s+(?:lit|installed|decorated|wrapped|lighted)\b[^.]{0,60}\bin\s+[A-Z]|\bour\s+(?:clients?|customers?)\s+(?:in|include)\b/g;

function overlaps(re, text, s, e, before = 40, after = 40, anywhere = false) {
  const from = Math.max(0, s - before);
  const win = text.slice(from, Math.min(text.length, e + after));
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(win))) {
    if (anywhere) return true;
    const ms = from + m.index, me = ms + m[0].length;
    if (ms < e && me > s) return true;
    if (m[0].length === 0) re.lastIndex++;
  }
  return false;
}
const claimHits = new Map(); // key -> {rule, phrase, context, pages:Set, allowed}
function scanClaims(text, where) {
  if (!text) return;
  for (const rule of CLAIMS) {
    rule.re.lastIndex = 0;
    for (const m of text.matchAll(rule.re)) {
      const s = m.index, e = s + m[0].length;
      if (rule.near && !overlaps(rule.near, text, s, e, 40, 40, true)) continue;
      let allowed = false;
      const denied = (rule.deny || []).some((re) => overlaps(re, text, s, e));
      if (!denied) {
        allowed = (rule.allow || []).some((a) => (a instanceof RegExp ? overlaps(a, text, s, e) : overlaps(a.re, text, s, e, a.before ?? 40, a.after ?? 40, a.anywhere)));
      }
      recordClaim(rule.id, m[0], text, s, e, where, allowed);
    }
  }
  for (const m of text.matchAll(YEARS_RE)) if (m[1] !== '20') recordClaim('years', m[0], text, m.index, m.index + m[0].length, where, false);
  for (const m of text.matchAll(SINCE_RE)) if (m[1] !== '2003' && m[1] !== '2001') recordClaim('years', m[0], text, m.index, m.index + m[0].length, where, false);
  for (const m of text.matchAll(PAST_WORK_RE)) {
    const ctx = context(text, m.index, m.index + m[0].length);
    warn('claims: past work named in a place (confirm a media.json caption supports it)', `${where}: "${ctx}"`);
  }
}
function context(text, s, e, pad = 60) {
  return (s > pad ? '...' : '') + text.slice(Math.max(0, s - pad), s) + '[' + text.slice(s, e) + ']' + text.slice(e, e + pad) + (e + pad < text.length ? '...' : '');
}
function recordClaim(rule, phrase, text, s, e, where, allowed) {
  const ctx = context(text, s, e).replace(/\s+/g, ' ');
  const key = rule + '|' + ctx;
  if (!claimHits.has(key)) claimHits.set(key, { rule, phrase: phrase.toLowerCase(), context: ctx, where: new Set(), allowed });
  claimHits.get(key).where.add(where);
}

// ---------------------------------------------------------------------------
// Files and routes
// ---------------------------------------------------------------------------
async function walk(dir) {
  const out = [];
  for (const ent of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}
const distFiles = await walk(DIST);
const rel = (p) => path.relative(DIST, p).split(path.sep).join('/');
const htmlFiles = distFiles.filter((f) => f.endsWith('.html')).sort();
function routeOf(file) {
  const r = rel(file);
  if (r === 'index.html') return '/';
  if (r.endsWith('/index.html')) return '/' + r.slice(0, -'index.html'.length);
  return '/' + r;
}
const pages = htmlFiles.map((file) => ({ file, route: routeOf(file) }));
if (!pages.length) fail('pages: no HTML files in dist', DIST);
const routes = new Set(pages.map((p) => p.route));
const LOCAL_RE = new RegExp(`^/(${landingServices.map((s) => s.replace(/[-]/g, '\\-')).join('|')})/([a-z0-9-]+)/$`);
function classify(route) {
  if (route === '/') return { type: 'home' };
  if (route === '/404.html') return { type: 'notfound' };
  if (route === '/thank-you/') return { type: 'thankyou' };
  if (route === '/privacy/') return { type: 'privacy' };
  if (route === '/service-area/') return { type: 'area' };
  let m = route.match(LOCAL_RE);
  if (m && cityBySlug.has(m[2])) return { type: 'local', service: m[1], city: cityBySlug.get(m[2]) };
  m = route.match(/^\/service-area\/([a-z0-9-]+)\/$/);
  if (m && cityBySlug.has(m[1])) return { type: 'hub', city: cityBySlug.get(m[1]) };
  m = route.match(/^\/([a-z0-9-]+)\/$/);
  if (m && serviceBySlug.has(m[1])) return { type: 'service', service: serviceBySlug.get(m[1]) };
  if (/^\/commercial\/[a-z0-9-]+\/$/.test(route)) return { type: 'vertical' };
  if (route.startsWith('/guides/')) return { type: route === '/guides/' ? 'guides' : 'guide' };
  return { type: 'other' };
}
function fileFor(sitePath) {
  // sitePath is relative to the site root (base removed), starts with "/"
  let p;
  try { p = decodeURIComponent(sitePath); } catch { p = sitePath; }
  const abs = path.join(DIST, p);
  if (!abs.startsWith(DIST)) return null;
  if (p.endsWith('/')) return fss.existsSync(path.join(abs, 'index.html')) ? path.join(abs, 'index.html') : null;
  if (fss.existsSync(abs) && fss.statSync(abs).isFile()) return abs;
  if (fss.existsSync(path.join(abs, 'index.html'))) return path.join(abs, 'index.html');
  return null;
}
// Returns {skip} | {external} | {error} | {sitePath, file}
function resolveRef(raw, pageRoute, { fromCssFile } = {}) {
  const ref = String(raw).trim();
  if (!ref || ref.startsWith('#') || /^(?:mailto|tel|sms|javascript|data|blob|about):/i.test(ref)) return { skip: true };
  if (/^\/\//.test(ref)) return { external: true };
  let pathname;
  if (/^https?:\/\//i.test(ref)) {
    let u;
    try { u = new URL(ref); } catch { return { error: 'unparseable URL' }; }
    const full = u.origin + u.pathname;
    if (u.origin !== ORIGIN || !(u.pathname === BASE || u.pathname === BASE + '/' || u.pathname.startsWith(BASE + '/'))) return { external: true };
    pathname = full.slice(ORIGIN.length);
  } else if (ref.startsWith('/')) {
    pathname = ref.split(/[?#]/)[0];
    if (BASE && !(pathname === BASE || pathname.startsWith(BASE + '/'))) return { error: `missing BASE_PATH "${BASE}"` };
  } else {
    if (pageRoute === '/404.html' && !fromCssFile) return { error: 'relative URL on 404.html breaks on nested paths' };
    const baseUrl = fromCssFile ? 'http://h' + BASE + '/' + fromCssFile : 'http://h' + BASE + pageRoute;
    pathname = new URL(ref, baseUrl).pathname;
  }
  pathname = pathname.split(/[?#]/)[0];
  let sitePath = BASE ? pathname.slice(BASE.length) : pathname;
  if (sitePath === '') sitePath = '/';
  return { sitePath, file: fileFor(sitePath) };
}
function srcsetCandidates(v) {
  return String(v).split(/,(?=\s*\S)/).map((part) => {
    const [url, desc] = part.trim().split(/\s+/);
    return { url, desc: desc || '' };
  }).filter((c) => c.url);
}

// ---------------------------------------------------------------------------
// Shared checks state
// ---------------------------------------------------------------------------
const titles = new Map();
const descriptions = new Map();
const referencedMedia = new Map(); // sitePath -> {pages:Set, widths:Set}
const weights = [];
const sizeCache = new Map();
const fileSize = (f) => { if (!sizeCache.has(f)) sizeCache.set(f, fss.statSync(f).size); return sizeCache.get(f); };
const cssRefsChecked = new Set();
let refCount = 0;
let imgCount = 0;
const counts = {};
const indexableRoutes = [];

function noteMedia(sitePath, route, desc) {
  if (!/^\/assets\/(?:images|media)\//.test(sitePath)) return;
  if (!referencedMedia.has(sitePath)) referencedMedia.set(sitePath, { pages: new Set(), widths: new Set() });
  const r = referencedMedia.get(sitePath);
  r.pages.add(route);
  const w = desc.match(/^(\d+)w$/);
  if (w) r.widths.add(+w[1]);
}
function checkRef(raw, route, where, desc = '', opts = {}) {
  const r = resolveRef(raw, route, opts);
  if (r.skip || r.external) return r;
  refCount++;
  if (r.error) { fail('links: internal URL problems', `${route} ${where} "${raw}": ${r.error}`); return r; }
  noteMedia(r.sitePath, route, desc);
  if (!r.file) {
    const norm = r.sitePath.endsWith('/') || /\.[a-z0-9]+$/i.test(r.sitePath) ? r.sitePath : r.sitePath + '/';
    if (planned.has(norm) && !routes.has(norm)) {
      if (ALLOW_PLANNED) push(plannedLinks, norm, route);
      else fail('links: point at planned pages that are not built', `${route} ${where} -> ${raw}`);
    } else fail('links: broken internal references', `${route} ${where} -> ${raw}`);
  }
  return r;
}
function cssUrls(css) {
  const out = [];
  for (const m of css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)) out.push(m[2]);
  for (const m of css.matchAll(/@import\s+(['"])([^'"]+)\1/g)) out.push(m[2]);
  return out;
}
function checkCssFile(file, route) {
  const key = file;
  if (cssRefsChecked.has(key)) return;
  cssRefsChecked.add(key);
  const css = fss.readFileSync(file, 'utf8');
  const relFile = rel(file);
  for (const u of cssUrls(css)) {
    if (/^data:/i.test(u)) continue;
    checkRef(u, route, `in ${relFile}`, '', { fromCssFile: relFile });
  }
}

// ---------------------------------------------------------------------------
// Per-page checks
// ---------------------------------------------------------------------------
const phoneTextRe = /(?:\+?1[\s.-]?)?\(?\b(\d{3})\)?[\s.-]?(\d{3})[\s.-](\d{4})\b/g;

for (const { file, route } of pages) {
  const html = await fs.readFile(file, 'utf8');
  const doc = parseHTML(html);
  const kind = classify(route);
  counts[kind.type] = (counts[kind.type] || 0) + 1;
  const N = doc.nodes;
  const q = (pred) => N.filter(pred);
  const tagIs = (t) => (n) => n.tag === t;
  const utility = kind.type === 'notfound' || kind.type === 'thankyou';

  // Document basics
  const htmlEl = N.find(tagIs('html'));
  if (!htmlEl || !/^en\b/i.test(htmlEl.attrs.lang || '')) fail('document: <html lang="en">', route);
  if (!N.some((n) => n.tag === 'meta' && n.attrs.name === 'viewport')) fail('document: viewport meta', route);

  // One h1
  const h1s = q(tagIs('h1'));
  if (h1s.length !== 1) fail('headings: exactly one <h1>', `${route} has ${h1s.length}`);
  const h1Text = h1s[0] ? textOf(doc, h1s[0]) : '';

  // Title
  const titleEl = N.find(tagIs('title'));
  const title = titleEl ? decode(html.slice(titleEl.openEnd, titleEl.close)).replace(/\s+/g, ' ').trim() : '';
  if (!title) fail('title: missing', route);
  else {
    if (title.length > TITLE_MAX) fail('title: must be under 65 characters', `${route} (${title.length}) "${title}"`);
    if (titles.has(title)) fail('title: must be unique', `${route} duplicates ${titles.get(title)} "${title}"`);
    else titles.set(title, route);
  }

  // Meta description
  const descEl = N.find((n) => n.tag === 'meta' && (n.attrs.name || '').toLowerCase() === 'description');
  const desc = descEl ? descEl.attrs.content.trim() : '';
  if (!desc) (utility ? warn : fail)('description: missing', route);
  else {
    if (descriptions.has(desc)) fail('description: must be unique', `${route} duplicates ${descriptions.get(desc)}`);
    else descriptions.set(desc, route);
    if (desc.length > 160 || desc.length < 70) warn('description: length outside 70 to 160 characters', `${route} (${desc.length})`);
  }

  // Canonical
  const canon = q((n) => n.tag === 'link' && (n.attrs.rel || '').split(/\s+/).includes('canonical'));
  const expectedCanon = SITE + (route === '/404.html' ? '/404.html' : route);
  if (kind.type !== 'notfound') {
    if (canon.length !== 1) fail('canonical: exactly one link rel=canonical', `${route} has ${canon.length}`);
    else if (canon[0].attrs.href !== expectedCanon) fail('canonical: must equal SITE_ORIGIN + BASE_PATH + route', `${route} has "${canon[0].attrs.href}", expected "${expectedCanon}"`);
    const ogUrl = N.find((n) => n.tag === 'meta' && n.attrs.property === 'og:url');
    if (ogUrl && ogUrl.attrs.content !== expectedCanon) warn('canonical: og:url differs from canonical', `${route} og:url "${ogUrl.attrs.content}"`);
  }

  // Robots
  const robots = q((n) => n.tag === 'meta' && (n.attrs.name || '').toLowerCase() === 'robots');
  const robotsVal = robots.map((r) => (r.attrs.content || '').toLowerCase().replace(/\s+/g, '')).join(';');
  const noindex = robotsVal.includes('noindex');
  if (robots.length > 1) fail('robots: at most one robots meta', route);
  if (!INDEXABLE) {
    if (robotsVal !== 'noindex,follow') fail('robots: preview builds need <meta name="robots" content="noindex,follow"> on every page', `${route} has "${robotsVal || 'none'}"`);
  } else if (kind.type === 'thankyou') {
    if (!noindex) fail('robots: /thank-you/ must always be noindex', route);
  } else if (kind.type === 'notfound') {
    if (!noindex) warn('robots: 404 page should be noindex', route);
  } else if (noindex) fail('robots: INDEXABLE=true but page is noindex', `${route} "${robotsVal}"`);
  if (!utility && !(INDEXABLE && noindex)) indexableRoutes.push(route);

  // JSON-LD
  let ldTypes = [];
  for (const s of q((n) => n.tag === 'script' && (n.attrs.type || '').toLowerCase() === 'application/ld+json')) {
    const raw = html.slice(s.openEnd, s.close);
    let data;
    try { data = JSON.parse(raw); } catch (e) { fail('json-ld: invalid JSON', `${route}: ${e.message}`); continue; }
    const ctxs = JSON.stringify(data['@context'] ?? '');
    if (!/schema\.org/.test(ctxs)) fail('json-ld: @context must be schema.org', route);
    const strings = [];
    (function visit(v, key) {
      if (Array.isArray(v)) return v.forEach((x) => visit(x, key));
      if (v && typeof v === 'object') {
        for (const [k, x] of Object.entries(v)) {
          if (k === '@type') [].concat(x).forEach((t) => ldTypes.push(String(t)));
          if (/^(?:aggregateRating|review|reviews)$/.test(k)) fail('json-ld: no ratings or reviews', `${route} has "${k}"`);
          if (k === 'telephone' && String(x).replace(/\D/g, '').slice(-10) !== PHONE_DIGITS) fail('json-ld: telephone must be (248) 756-8915', `${route} "${x}"`);
          if (k === 'streetAddress') warn('json-ld: street address is not a verified fact in BRIEF.md', `${route} "${x}"`);
          visit(x, k);
        }
      } else if (typeof v === 'string') strings.push([key, v]);
    })(data);
    for (const t of ldTypes) if (/^(?:AggregateRating|Review|Rating|EmployerAggregateRating)$/.test(t)) fail('json-ld: no ratings or reviews', `${route} @type ${t}`);
    for (const [k, v] of strings) {
      if (/^https?:\/\//.test(v)) { if (k !== '@context' && k !== '@id') checkRef(v, route, `json-ld ${k}`); }
      else if (!/^@/.test(k)) scanClaims(v, route + ' (json-ld)');
    }
  }
  if (kind.type === 'home' && !ldTypes.some((t) => /LocalBusiness|HomeAndConstructionBusiness|Electrician|Organization|ProfessionalService/.test(t))) warn('json-ld: home should describe the business', route);
  if (kind.type === 'local' && !ldTypes.includes('FAQPage')) warn('json-ld: local page without FAQPage', route);

  // Skip link and main
  const skip = N.find((n) => n.tag === 'a' && hasClass(n, 'skip-link'));
  if (!skip || skip.attrs.href !== '#main') fail('landmarks: a.skip-link href="#main"', route);
  const mains = q(tagIs('main'));
  if (mains.length !== 1 || mains[0].attrs.id !== 'main') fail('landmarks: exactly one <main id="main">', `${route} has ${mains.length} main, id "${mains[0]?.attrs.id ?? ''}"`);
  if (skip && mains[0] && skip.start > mains[0].start) fail('landmarks: skip link must come before <main>', route);
  const firstFocusable = N.find((n) => (n.tag === 'a' && n.attrs.href !== undefined) || n.tag === 'button' || (n.tag === 'input' && n.attrs.type !== 'hidden'));
  if (skip && firstFocusable && firstFocusable !== skip) warn('landmarks: skip link should be the first focusable element', route);

  // Duplicate ids and id references
  const ids = new Map();
  for (const n of N) if (n.attrs.id !== undefined) {
    if (ids.has(n.attrs.id)) fail('ids: duplicate id', `${route} #${n.attrs.id}`);
    ids.set(n.attrs.id, n);
  }
  for (const n of N) {
    for (const a of ['for', 'aria-labelledby', 'aria-describedby', 'aria-controls', 'list', 'form', 'aria-owns', 'aria-activedescendant']) {
      if (n.attrs[a] === undefined) continue;
      if (a === 'form' && n.tag === 'form') continue;
      for (const id of n.attrs[a].split(/\s+/).filter(Boolean)) if (!ids.has(id)) fail('ids: reference to a missing id', `${route} <${n.tag} ${a}="${id}">`);
    }
    if (n.tag === 'a' && /^#./.test(n.attrs.href || '') && !ids.has(decodeURIComponent(n.attrs.href.slice(1)))) fail('links: in-page anchor target missing', `${route} href="${n.attrs.href}"`);
  }

  // Header: phone and estimate
  const headers = q((n) => n.tag === 'header' && hasClass(n, 'site-header'));
  if (headers.length !== 1) fail('header: exactly one <header class="site-header">', `${route} has ${headers.length}`);
  const header = headers[0];
  if (header) {
    const hp = N.filter((n) => within(n, header) && n.tag === 'a' && n.attrs['data-contact'] === 'phone' && n.attrs['data-placement'] === 'header');
    if (!hp.length) fail('header: phone link a[data-contact="phone"][data-placement="header"]', route);
    else {
      if (hp[0].attrs.href !== PHONE_TEL) fail('header: phone href must be tel:+12487568915', `${route} "${hp[0].attrs.href}"`);
      if (!textOf(doc, hp[0]).includes('756-8915')) fail('header: phone link must contain the visible number text for desktop', route);
    }
    const he = N.filter((n) => within(n, header) && n.tag === 'a' && n.attrs['data-cta'] === 'estimate' && n.attrs['data-placement'] === 'header');
    if (!he.length) fail('header: estimate button a[data-cta="estimate"][data-placement="header"]', route);
    else if (!he[0].attrs.href) fail('header: estimate button needs an href', route);
  }

  // Phone links everywhere
  for (const a of q((n) => n.tag === 'a' && /^tel:/i.test(n.attrs.href || ''))) {
    if (a.attrs.href !== PHONE_TEL) fail('phone: every tel: link must be tel:+12487568915', `${route} "${a.attrs.href}"`);
    if (a.attrs['data-contact'] !== 'phone' || !a.attrs['data-placement']) fail('phone: tel: links need data-contact="phone" and data-placement', `${route} "${textOf(doc, a).slice(0, 40)}"`);
  }
  for (const a of q((n) => n.tag === 'a' && /facebook\.com/i.test(n.attrs.href || ''))) {
    if (a.attrs.href.replace(/\/$/, '') !== FACEBOOK) fail('links: Facebook link must be the verified page', `${route} "${a.attrs.href}"`);
  }

  // Mobile bar
  const bars = q((n) => n.tag === 'div' && hasClass(n, 'mobile-bar'));
  if (!bars.length) (utility ? warn : fail)('mobile bar: <div class="mobile-bar"> with call and estimate', route);
  else {
    const b = bars[0];
    if (!N.some((n) => within(n, b) && n.tag === 'a' && n.attrs['data-contact'] === 'phone')) fail('mobile bar: needs a[data-contact="phone"]', route);
    if (!N.some((n) => within(n, b) && n.tag === 'a' && n.attrs['data-cta'] === 'estimate')) fail('mobile bar: needs a[data-cta="estimate"]', route);
  }

  // Footer credit
  const credits = q((n) => n.tag === 'a' && (n.attrs.href === CREDIT_HREF || n.attrs.href === CREDIT_HREF + '/'));
  const credit = credits.find((a) => textOf(doc, a) === CREDIT_TEXT);
  if (!credit) fail('footer: credit link with exact text', `${route} found ${credits.map((a) => '"' + textOf(doc, a) + '"').join(', ') || 'no credit link'}`);
  else {
    if (!inside(credit, (p) => p.tag === 'footer')) fail('footer: credit must sit inside <footer>', route);
    if (credit.attrs.href !== CREDIT_HREF) warn('footer: credit href has a trailing slash', route);
  }

  // Quote forms
  const forms = q((n) => n.tag === 'form' && n.attrs['data-quote'] !== undefined);
  const needsForm = !['thankyou', 'notfound', 'privacy'].includes(kind.type);
  if (needsForm && forms.length < 1) fail('forms: every page needs a form[data-quote]', route);
  for (const f of forms) {
    const inF = (pred) => N.filter((n) => within(n, f) && pred(n));
    const place = f.attrs['data-placement'];
    const where = `${route} form[data-placement="${place ?? ''}"]`;
    if (!place) fail('forms: form[data-quote] needs data-placement', route);
    const steps = inF((n) => n.attrs['data-step'] !== undefined).map((n) => n.attrs['data-step']);
    if (!steps.includes('1')) fail('forms: steps [data-step="1"...]', where);
    const nums = [...new Set(steps)].map(Number).sort((a, b) => a - b);
    if (nums.some((v, i) => v !== i + 1)) fail('forms: steps must be numbered 1..n', `${where} has ${nums.join(',')}`);
    if (!inF((n) => n.tag === 'button' && (n.attrs.type || '').toLowerCase() === 'submit').length) fail('forms: button[type="submit"]', where);
    const city = inF((n) => n.attrs.name === 'city' && ['select', 'input'].includes(n.tag));
    if (!city.length) fail('forms: city field name="city"', where);
    else if (city[0].tag !== 'select') warn('forms: city is not a <select>', where);
    if (!inF((n) => n.attrs.name === 'property_type').length) fail('forms: property field name="property_type"', where);
    if (!inF((n) => n.attrs.name === 'what_to_light').length) fail('forms: chips name="what_to_light"', where);
    const hp = inF((n) => n.tag === 'input' && n.attrs.name === 'botcheck');
    if (hp.length !== 1) fail('forms: honeypot input name="botcheck"', where);
    else if (hp[0].attrs.tabindex !== '-1') fail('forms: honeypot needs tabindex="-1"', where);
    if (!inF((n) => n.attrs.role === 'status').length) fail('forms: status region [role="status"] inside the form', where);
    if (!inF((n) => n.tag === 'input' && (n.attrs.type || '').toLowerCase() === 'tel').length) warn('forms: no input[type="tel"]', where);
    // Every control needs a label
    for (const c of inF((n) => ['input', 'select', 'textarea'].includes(n.tag))) {
      const type = (c.attrs.type || '').toLowerCase();
      if (type === 'hidden' || type === 'submit' || type === 'button' || c.attrs.name === 'botcheck') continue;
      const labelled = c.attrs['aria-label'] || c.attrs['aria-labelledby'] || c.attrs.title ||
        (c.attrs.id && N.some((n) => n.tag === 'label' && n.attrs.for === c.attrs.id)) || inside(c, (p) => p.tag === 'label');
      if (!labelled) fail('forms: every control needs a label', `${where} <${c.tag} name="${c.attrs.name ?? ''}">`);
    }
    const accessKey = inF((n) => n.tag === 'input' && n.attrs.name === 'access_key');
    if (W3F_KEY) {
      if ((f.attrs.action || '') !== 'https://api.web3forms.com/submit') fail('forms: direct mode needs action="https://api.web3forms.com/submit"', where);
      if ((f.attrs.method || '').toLowerCase() !== 'post') fail('forms: direct mode needs method="post"', where);
      if (!accessKey.length || accessKey[0].attrs.value !== W3F_KEY) fail('forms: direct mode needs input name="access_key" with WEB3FORMS_KEY', where);
      const redirect = inF((n) => n.tag === 'input' && n.attrs.name === 'redirect');
      if (!redirect.length || redirect[0].attrs.value !== THANK_YOU_URL) fail('forms: direct mode needs input name="redirect" = thank-you URL', `${where} has "${redirect[0]?.attrs.value ?? ''}", expected "${THANK_YOU_URL}"`);
    } else {
      if (accessKey.length) fail('forms: preview build must not carry an access_key', where);
      if (/web3forms/i.test(f.attrs.action || '')) fail('forms: preview build must not post to Web3Forms', where);
    }
  }

  // Local landing page specifics
  if (kind.type === 'local') {
    const pageData = kind.city.pages[kind.service] || {};
    const expectH1 = pageData.h1 || `${serviceBySlug.get(kind.service)?.name ?? kind.service} in ${kind.city.display}`;
    if (squash(h1Text) !== squash(expectH1)) fail('local pages: H1 must be "<Service> in <City>, MI" from the city file', `${route} "${h1Text}" expected "${expectH1}"`);
    if (!/^(?:.+) in .+, MI$/.test(h1Text.replace(/\s+/g, ' ')) && squash(h1Text) === squash(expectH1)) warn('local pages: H1 does not read "<Service> in <City>, MI" with spaces', `${route} "${h1Text}"`);
    if (forms.length !== 2) fail('local pages: two form[data-quote] (first screen and close)', `${route} has ${forms.length}`);
    const hero = forms.find((f) => f.attrs['data-placement'] === 'hero');
    if (!hero) fail('local pages: first-screen form[data-placement="hero"]', route);
    if (hero && h1s[0] && hero.start < h1s[0].start) warn('local pages: hero form comes before the H1 in source order', route);
    const cityNames = [kind.city.slug, kind.city.name, kind.city.display].map((s) => s.toLowerCase());
    for (const f of forms) {
      const fields = N.filter((n) => within(n, f) && n.attrs.name === 'city');
      const field = fields[0];
      if (!field) continue;
      let chosen = null;
      if (field.tag === 'select') {
        const opt = N.find((n) => within(n, field) && n.tag === 'option' && n.attrs.selected !== undefined);
        if (opt) chosen = [opt.attrs.value ?? '', textOf(doc, opt)];
      } else chosen = [field.attrs.value ?? ''];
      if (!chosen || !chosen.some((v) => cityNames.includes(String(v).toLowerCase()))) fail('local pages: city must be preselected in every form', `${route} form[data-placement="${f.attrs['data-placement']}"] has ${JSON.stringify(chosen)}`);
    }
    if (!title.toLowerCase().includes(kind.city.name.toLowerCase())) fail('local pages: title must name the city', `${route} "${title}"`);
    if (desc && !desc.toLowerCase().includes(kind.city.name.toLowerCase())) warn('local pages: description should name the city', route);
    const neighborLinks = (kind.city.neighbors || []).filter((slug) => html.includes(`/${slug}/`));
    if ((kind.city.neighbors || []).length && !neighborLinks.length) warn('local pages: no links to nearby communities', route);
  }
  if (kind.type === 'hub') {
    if (kind.city.hub?.h1 && squash(h1Text) !== squash(kind.city.hub.h1)) warn('city hubs: H1 differs from the city file', `${route} "${h1Text}"`);
    if (!title.toLowerCase().includes(kind.city.name.toLowerCase())) fail('city hubs: title must name the city', `${route} "${title}"`);
  }
  if (kind.type === 'service' && kind.service.h1 && squash(h1Text) !== squash(kind.service.h1)) warn('service pages: H1 differs from site-copy.json', `${route} "${h1Text}"`);

  // GTM and attribution modes
  const gtmRefs = /googletagmanager\.com/.test(html);
  if (GTM_ID) { if (!html.includes(GTM_ID) || !gtmRefs) fail('tags: GTM_ID set but the GTM snippet is missing', route); }
  else if (gtmRefs) fail('tags: GTM_ID unset but the page references googletagmanager.com', route);
  const apexScripts = q((n) => n.tag === 'script' && /apex-attribution\.js/.test(n.attrs.src || ''));
  if (APEX_TOKEN) {
    if (forms.length && !apexScripts.some((s) => s.attrs['data-token'] === APEX_TOKEN)) fail('tags: APEX_FORM_TOKEN set but apex-attribution.js with data-token is missing', route);
  } else if (apexScripts.length) fail('tags: APEX_FORM_TOKEN unset but apex-attribution.js is included', route);

  // Background videos
  const bgVideos = q((n) => n.tag === 'video' && n.attrs['data-bg-video'] !== undefined);
  for (const v of q(tagIs('video'))) if (v.attrs.autoplay !== undefined) fail('video: no autoplay attribute (JS starts videos)', `${route} ${v.attrs.id ? '#' + v.attrs.id : ''}`);
  for (const v of bgVideos) {
    for (const a of ['muted', 'playsinline', 'loop', 'poster']) if (v.attrs[a] === undefined) fail(`video: data-bg-video needs ${a}`, `${route} ${v.attrs.id ? '#' + v.attrs.id : ''}`);
  }
  if (bgVideos.length) {
    const toggles = q((n) => n.tag === 'button' && /\b(?:pause|play)\b/i.test([n.attrs['aria-label'] || '', textOf(doc, n), n.attrs.title || ''].join(' ')));
    if (toggles.length < bgVideos.length) fail('video: every background video needs a pause/play button', `${route} ${bgVideos.length} videos, ${toggles.length} buttons`);
  }

  // References: href/src/srcset/poster/data-*/style url()/og:image
  for (const n of N) {
    for (const [a, v] of Object.entries(n.attrs)) {
      if (!v) continue;
      if (a === 'href' || a === 'src' || a === 'poster' || a === 'data' || a === 'action') {
        if (a === 'action' && n.tag === 'form' && /^https:\/\/api\.web3forms\.com\//.test(v)) continue;
        if (n.tag === 'link' && /\b(?:preconnect|dns-prefetch)\b/.test(n.attrs.rel || '')) continue;
        checkRef(v, route, `<${n.tag} ${a}>`);
      } else if (a === 'srcset' || a === 'imagesrcset' || (a.startsWith('data-') && /\s\d+w\s*(?:,|$)/.test(v))) {
        for (const c of srcsetCandidates(v)) checkRef(c.url, route, `<${n.tag} ${a}>`, c.desc);
      } else if (a === 'content' && /^(?:og:image|og:image:url|og:image:secure_url|og:url|og:video|twitter:image)$/.test(n.attrs.property || n.attrs.name || '')) {
        checkRef(v, route, `<meta ${n.attrs.property || n.attrs.name}>`);
      } else if (a.startsWith('data-') && /^(?:\/|\.\.?\/|https?:\/\/)\S*\.(?:mp4|webm|webp|avif|jpe?g|png|svg|gif|css|js|woff2?|json|vtt)(?:[?#]\S*)?$/i.test(v.trim())) {
        checkRef(v, route, `<${n.tag} ${a}>`);
      } else if (a === 'style') {
        for (const u of cssUrls(v)) checkRef(u, route, `<${n.tag} style>`);
      }
    }
    if (n.tag === 'style') for (const u of cssUrls(html.slice(n.openEnd, n.close))) checkRef(u, route, '<style>');
    if (n.tag === 'link' && /\bstylesheet\b/.test(n.attrs.rel || '')) {
      const r = resolveRef(n.attrs.href || '', route);
      if (r.file) checkCssFile(r.file, route);
    }
    if (n.tag === 'img') {
      imgCount++;
      if (n.attrs.alt === undefined) fail('images: <img> needs alt', `${route} ${n.attrs.src}`);
      if (!/^\d+$/.test(n.attrs.width || '') || !/^\d+$/.test(n.attrs.height || '')) fail('images: <img> needs width and height', `${route} ${n.attrs.src}`);
    }
  }

  // Visible text: claims, placeholders, phone numbers
  const body = N.find(tagIs('body')) || doc.root;
  const visible = textOf(doc, body, { templates: true });
  const attrText = [];
  const placeholders = [];
  for (const n of N) {
    for (const a of ['alt', 'title', 'aria-label']) if (n.attrs[a]) attrText.push(n.attrs[a]);
    if (n.attrs.placeholder) placeholders.push(n.attrs.placeholder);
    if (n.tag === 'input' && /^(?:submit|button)$/i.test(n.attrs.type || '') && n.attrs.value) attrText.push(n.attrs.value);
    if (n.tag === 'meta' && /^(?:description|og:title|og:description|twitter:title|twitter:description)$/.test(n.attrs.name || n.attrs.property || '')) attrText.push(n.attrs.content || '');
  }
  const allText = [title, visible, ...attrText].join(' \n ');
  scanClaims([allText, ...placeholders].join(' \n '), route);
  const placeholder = allText.match(/\bundefined\b|\[object Object\]|\bNaN\b|lorem ipsum|\bTODO\b|\bYOUR_[A-Z_]+|example\.com|localhost|127\.0\.0\.1|\{\{|\}\}/i);
  if (placeholder) fail('text: placeholder or template leftovers', `${route}: "${context(allText, placeholder.index, placeholder.index + placeholder[0].length, 40)}"`);
  for (const m of allText.matchAll(phoneTextRe)) {
    const digits = m[1] + m[2] + m[3];
    if (digits !== PHONE_DIGITS) fail('phone: only (248) 756-8915 may appear', `${route}: "${m[0]}"`);
  }

  // Page weight: HTML + CSS + JS + first-screen images (+ preloaded fonts), no video
  const w = { route, html: Buffer.byteLength(html), css: 0, js: 0, img: 0, font: 0 };
  const seen = new Set();
  const addFile = (bucket, sitePathOrFile) => {
    if (!sitePathOrFile || seen.has(sitePathOrFile)) return;
    seen.add(sitePathOrFile);
    try { w[bucket] += fileSize(sitePathOrFile); } catch { /* broken refs are reported above */ }
  };
  const largest = (cands) => cands.map((c) => ({ ...c, n: parseFloat(c.desc) || 0 })).sort((a, b) => b.n - a.n)[0];
  for (const n of N) {
    if (n.tag === 'link' && /\bstylesheet\b/.test(n.attrs.rel || '')) addFile('css', resolveRef(n.attrs.href || '', route).file);
    if (n.tag === 'script' && n.attrs.src) addFile('js', resolveRef(n.attrs.src, route).file);
    if (n.tag === 'link' && /\bmodulepreload\b/.test(n.attrs.rel || '')) addFile('js', resolveRef(n.attrs.href || '', route).file);
    if (n.tag === 'link' && /\bpreload\b/.test(n.attrs.rel || '') && n.attrs.as === 'font') addFile('font', resolveRef(n.attrs.href || '', route).file);
    if (n.tag === 'link' && /\bpreload\b/.test(n.attrs.rel || '') && n.attrs.as === 'image') {
      const c = n.attrs.imagesrcset ? largest(srcsetCandidates(n.attrs.imagesrcset)) : { url: n.attrs.href };
      if (c) addFile('img', resolveRef(c.url, route).file);
    }
    if (n.tag === 'img' && (n.attrs.loading || '').toLowerCase() !== 'lazy') {
      const pic = n.parent && n.parent.tag === 'picture' ? n.parent : null;
      const firstSource = pic ? pic.children.find((c) => c.tag === 'source' && c.attrs.srcset && !c.attrs.media) : null;
      const set = firstSource ? firstSource.attrs.srcset : n.attrs.srcset;
      const c = set ? largest(srcsetCandidates(set)) : { url: n.attrs.src };
      if (c) addFile('img', resolveRef(c.url, route).file);
    }
    if (n.tag === 'video' && n.attrs.poster && (n.attrs.preload || '') !== 'none') addFile('img', resolveRef(n.attrs.poster, route).file);
  }
  w.total = w.html + w.css + w.js + w.img + w.font;
  w.gzipHtml = zlib.gzipSync(html).length;
  weights.push(w);
  if (w.total > WEIGHT_BUDGET) warn('weight: page over 600 KB (HTML+CSS+JS+first-screen images+preloaded fonts)', `${route} ${(w.total / 1024).toFixed(0)} KB (html ${(w.html / 1024).toFixed(0)}, css ${(w.css / 1024).toFixed(0)}, js ${(w.js / 1024).toFixed(0)}, img ${(w.img / 1024).toFixed(0)}, font ${(w.font / 1024).toFixed(0)})`);
}

// ---------------------------------------------------------------------------
// Site-level checks
// ---------------------------------------------------------------------------
// Planned pages that are not built
const missingPlanned = [...planned].filter((r) => !routes.has(r)).sort();
if (missingPlanned.length) {
  if (ALLOW_PLANNED) warn('pages: planned in content/*.json but not built', `${missingPlanned.length}: ${missingPlanned.slice(0, 12).join(' ')}${missingPlanned.length > 12 ? ' ...' : ''}`);
  else for (const r of missingPlanned) fail('pages: planned in content/*.json but not built', r);
}
if (!routes.has('/404.html')) fail('pages: 404.html', 'missing');

// Sitemap
const sitemapFile = path.join(DIST, 'sitemap.xml');
let sitemapLocs = [];
if (!fss.existsSync(sitemapFile)) fail('sitemap: dist/sitemap.xml', 'missing');
else {
  const xml = fss.readFileSync(sitemapFile, 'utf8');
  sitemapLocs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => decode(m[1]));
  const set = new Set(sitemapLocs);
  if (set.size !== sitemapLocs.length) fail('sitemap: duplicate <loc>', `${sitemapLocs.length - set.size} duplicates`);
  for (const loc of sitemapLocs) {
    if (!loc.startsWith(SITE + '/')) { fail('sitemap: <loc> must start with SITE_ORIGIN + BASE_PATH', loc); continue; }
    const r = resolveRef(loc, '/');
    if (!r.file) fail('sitemap: <loc> does not resolve to a page', loc);
    const route = loc.slice(SITE.length);
    if (route === '/thank-you/' || route === '/404.html') fail('sitemap: must not list utility pages', loc);
  }
  for (const route of indexableRoutes) if (!set.has(SITE + route)) fail('sitemap: indexable page missing from sitemap.xml', route);
}
const robotsTxt = path.join(DIST, 'robots.txt');
if (!fss.existsSync(robotsTxt)) warn('robots.txt: missing', 'dist/robots.txt');
else {
  const txt = fss.readFileSync(robotsTxt, 'utf8');
  if (INDEXABLE && /^\s*disallow:\s*\/\s*$/im.test(txt)) fail('robots.txt: INDEXABLE=true but robots.txt blocks everything', 'dist/robots.txt');
  const sm = txt.match(/^\s*sitemap:\s*(\S+)/im)?.[1];
  if (sm && sm !== SITE + '/sitemap.xml') warn('robots.txt: Sitemap line differs from SITE_ORIGIN + BASE_PATH', sm);
}
const host = new URL(ORIGIN).hostname;
if (!host.endsWith('github.io') && !BASE) {
  const cname = path.join(DIST, 'CNAME');
  if (!fss.existsSync(cname)) warn('launch: custom domain build without dist/CNAME', host);
  else if (fss.readFileSync(cname, 'utf8').trim() !== host) fail('launch: dist/CNAME must match SITE_ORIGIN host', fss.readFileSync(cname, 'utf8').trim());
}

// Media: every referenced image or video comes from media.json at a real width
let sharp = null;
try { sharp = (await import('sharp')).default; } catch { warn('media: sharp not available, pixel widths not verified', ''); }
let mediaChecked = 0;
for (const [sitePath, info] of referencedMedia) {
  const example = [...info.pages][0];
  if (!mediaFiles.has(sitePath)) {
    fail('media: referenced asset is not listed in content/media.json', `${sitePath} (e.g. ${example})`);
    continue;
  }
  const file = fileFor(sitePath);
  if (!file) continue; // reported as a broken link
  mediaChecked++;
  if (!sharp || !/\.(?:webp|avif|jpe?g|png)$/i.test(sitePath)) continue;
  let meta;
  try { meta = await sharp(file).metadata(); } catch (e) { fail('media: unreadable image', `${sitePath}: ${e.message}`); continue; }
  for (const wd of info.widths) if (Math.abs(meta.width - wd) > 2) fail('media: srcset width descriptor does not match the file', `${sitePath} is ${meta.width}px wide but is offered as ${wd}w (e.g. ${example})`);
  const named = sitePath.match(/-(\d+)\.(?:webp|avif|jpe?g|png)$/i)?.[1];
  if (named && Math.abs(meta.width - +named) > 2 && !/-160\./.test(sitePath)) warn('media: file name width differs from pixel width', `${sitePath} is ${meta.width}px`);
}

// No en or em dashes in any text file in dist, or in the source that produces it
const TEXT_EXT = /\.(?:html?|css|m?js|json|xml|txt|svg|webmanifest|map|md|vtt|ya?ml|py|sh)$/i;
const DASH_RE = /[\u2013\u2014]|&(?:mdash|ndash);|&#(?:8211|8212);|&#x0*(?:2013|2014);|\\u(?:2013|2014)|\\u\{(?:2013|2014)\}/gi;
// In source files only the literal characters count: an escape such as \u2014 in a detection regex is fine.
const LITERAL_DASH_RE = /[\u2013\u2014]/g;
function scanDashes(file, label, rule, re = DASH_RE) {
  const text = fss.readFileSync(file, 'utf8');
  re.lastIndex = 0;
  if (!re.test(text)) return;
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    re.lastIndex = 0;
    const m = re.exec(line);
    if (m) fail(rule, `${label}:${i + 1} "${line.slice(Math.max(0, m.index - 40), m.index + 40).trim()}"`);
  });
}
for (const f of distFiles.filter((f) => TEXT_EXT.test(f))) scanDashes(f, 'dist/' + rel(f), 'dashes: U+2013 or U+2014 in dist');
async function sourceFiles(dir) {
  const out = [];
  if (!fss.existsSync(dir)) return out;
  for (const ent of await fs.readdir(dir, { withFileTypes: true })) {
    if (/^(?:node_modules|dist|reports|research|\.git|\.DS_Store)$/.test(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...(await sourceFiles(p)));
    else if (TEXT_EXT.test(ent.name) && ent.name !== 'package-lock.json') out.push(p);
  }
  return out;
}
for (const f of [...(await sourceFiles(path.join(ROOT, 'scripts'))), ...(await sourceFiles(path.join(ROOT, 'content'))), ...(await sourceFiles(path.join(ROOT, 'src'))), ...(await sourceFiles(path.join(ROOT, 'templates'))), ...(await sourceFiles(path.join(ROOT, 'public'))), ...(await sourceFiles(path.join(ROOT, '.github')))].concat(['README.md', 'package.json'].map((f) => path.join(ROOT, f)).filter((f) => fss.existsSync(f)))) {
  scanDashes(f, path.relative(ROOT, f), 'dashes: U+2013 or U+2014 in source files', LITERAL_DASH_RE);
}

// Claims in site JavaScript strings (status messages and injected copy)
for (const f of distFiles.filter((f) => /\.m?js$/.test(f) && !/apex-attribution\.js$/.test(f))) {
  const js = fss.readFileSync(f, 'utf8');
  const strings = [...js.matchAll(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g)].map((m) => m[0].slice(1, -1)).filter((s) => /[a-z]{3,}\s+[a-z]{2,}/i.test(s));
  for (const s of strings) scanClaims(s, 'dist/' + rel(f));
}

// Turn claim hits into failures, grouped by phrase context
const allowedClaims = [];
for (const hit of claimHits.values()) {
  const where = [...hit.where];
  const loc = where.length > 1 ? `${where.length} places, e.g. ${where[0]}` : where[0];
  if (hit.allowed) allowedClaims.push(hit);
  else fail(`claims: forbidden pattern "${hit.rule}"`, `${loc}: "${hit.context}"`);
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const kb = (b) => (b / 1024).toFixed(0) + ' KB';
const failCount = [...failures.values()].reduce((a, b) => a + b.length, 0);
const warnCount = [...warnings.values()].reduce((a, b) => a + b.length, 0);
const LIMIT = VERBOSE ? Infinity : 12;
const line = '-'.repeat(72);
console.log(line);
console.log('Holiday Light Service static check');
console.log(`dist: ${DIST}`);
console.log(`base "${BASE}"  origin ${ORIGIN}  indexable ${INDEXABLE}  forms ${W3F_KEY ? 'direct (Web3Forms)' : 'preview'}  gtm ${GTM_ID || 'off'}  attribution ${APEX_TOKEN ? 'on' : 'off'}`);
for (const n of notes) console.log('note: ' + n);
console.log(`pages ${pages.length}: ` + Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', '));
console.log(`internal references ${refCount}, images ${imgCount}, media files verified ${mediaChecked}, sitemap URLs ${sitemapLocs.length}, allowed claim-pattern hits ${allowedClaims.length}`);
if (weights.length) {
  const heavy = [...weights].sort((a, b) => b.total - a.total);
  const avg = weights.reduce((a, b) => a + b.total, 0) / weights.length;
  console.log(`page weight (HTML+CSS+JS+first-screen images+preloaded fonts, no video): average ${kb(avg)}, heaviest:`);
  for (const w of heavy.slice(0, 5)) console.log(`  ${kb(w.total).padStart(7)}  ${w.route}  (html ${kb(w.html)}, gz ${kb(w.gzipHtml)}; css ${kb(w.css)}; js ${kb(w.js)}; img ${kb(w.img)}; font ${kb(w.font)})`);
}
if (VERBOSE && allowedClaims.length) {
  console.log(line + '\nAllowed claim-pattern hits (legitimate usage):');
  for (const h of allowedClaims) console.log(`  [${h.rule}] ${[...h.where].length} place(s): "${h.context}"`);
} else if (allowedClaims.length) {
  const byPhrase = {};
  for (const h of allowedClaims) byPhrase[h.phrase] = (byPhrase[h.phrase] || 0) + 1;
  console.log('allowed claim-pattern phrases (VERBOSE=1 for context): ' + Object.entries(byPhrase).map(([p, n]) => `"${p}" x${n}`).join(', '));
}
if (plannedLinks.size) {
  console.log(line + `\nLinks to planned pages that are not built yet (ALLOW_PLANNED=1, warnings): ${plannedLinks.size} targets`);
  for (const [target, from] of [...plannedLinks].slice(0, VERBOSE ? Infinity : 20)) console.log(`  ${target}  (linked from ${new Set(from).size} page(s), e.g. ${from[0]})`);
  if (!VERBOSE && plannedLinks.size > 20) console.log(`  ... and ${plannedLinks.size - 20} more`);
}
if (warnings.size) {
  console.log(line + `\nWarnings (${warnCount}):`);
  for (const [rule, list] of warnings) {
    console.log(`  ${rule} (${list.length})`);
    for (const m of list.slice(0, LIMIT)) console.log(`    ${m}`);
    if (list.length > LIMIT) console.log(`    ... and ${list.length - LIMIT} more`);
  }
}
if (failures.size) {
  console.log(line + `\nFailures (${failCount}):`);
  for (const [rule, list] of failures) {
    console.log(`  x ${rule} (${list.length})`);
    for (const m of list.slice(0, LIMIT)) console.log(`    ${m}`);
    if (list.length > LIMIT) console.log(`    ... and ${list.length - LIMIT} more (VERBOSE=1 shows all)`);
  }
}
console.log(line);
console.log(failCount ? `FAIL: ${failCount} problem(s) across ${failures.size} rule(s), ${warnCount} warning(s).` : `PASS: ${pages.length} pages clean, ${warnCount} warning(s).`);

try {
  await fs.mkdir(path.join(ROOT, 'reports'), { recursive: true });
  await fs.writeFile(path.join(ROOT, 'reports', 'check-results.json'), JSON.stringify({
    ok: !failCount,
    config: { dist: DIST, base: BASE, origin: ORIGIN, indexable: INDEXABLE, forms: W3F_KEY ? 'direct' : 'preview', gtm: !!GTM_ID, attribution: !!APEX_TOKEN, allowPlanned: ALLOW_PLANNED },
    pages: pages.length, counts, internalReferences: refCount, images: imgCount, mediaVerified: mediaChecked, sitemapUrls: sitemapLocs.length,
    failures: Object.fromEntries(failures), warnings: Object.fromEntries(warnings),
    plannedLinks: Object.fromEntries([...plannedLinks].map(([k, v]) => [k, [...new Set(v)]])),
    allowedClaims: allowedClaims.map((h) => ({ rule: h.rule, context: h.context, where: [...h.where] })),
    weights,
  }, null, 2));
} catch { /* reports are optional */ }
process.exit(failCount ? 1 : 0);
