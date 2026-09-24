#!/usr/bin/env node
// Lighthouse mobile audit of the built site, served locally with BASE_PATH like GitHub Pages.
//
//   npm run lighthouse                         home, one local page, one service page, 1 run each
//   LH_RUNS=5 npm run lighthouse               5 runs per page, median reported, worst run shown
//   npm run lighthouse -- /faq/ /contact/      audit other routes instead
//
// Budgets from the brief: performance 95+, accessibility 100 and best practices 100 on mobile. Exits 1 when a budget is
// missed (LH_NO_FAIL=1 to only report). SEO is expected to lose points in preview builds because
// every page is noindex; that is reported, not failed. Reports go to reports/lighthouse/.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { serveDist, resolveConfig, contentModel, pageExists } from './browser-check.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = resolveConfig();
const OUT = path.join(ROOT, 'reports', 'lighthouse');
const RUNS = Math.max(1, Number(process.env.LH_RUNS || (process.argv.find((a) => a.startsWith('--runs='))?.split('=')[1]) || 1));
const BUDGET = { performance: 95, accessibility: 100, bestPractices: 100 };

if (!fs.existsSync(path.join(cfg.dist, 'index.html'))) {
  console.error('lighthouse: dist/index.html not found. Run npm run build first.');
  process.exit(1);
}

// Default page set: home, the first residential local page in Oakland County (or any local page), the primary service page.
function defaultRoutes() {
  const { copy, cities, landingServices } = contentModel();
  const out = ['/'];
  const svc = landingServices[0] || 'christmas-light-installation';
  const city = cities.find((c) => /oakland/i.test(c.county) && c.pages?.[svc]) || cities.find((c) => c.pages?.[svc]);
  if (city) out.push(`/${svc}/${city.slug}/`);
  const service = (copy.services || [])[0];
  if (service) out.push(`/${service.slug}/`);
  return out;
}
const argRoutes = process.argv.slice(2).filter((a) => a.startsWith('/'));
const routes = (argRoutes.length ? argRoutes : defaultRoutes()).filter((r) => {
  if (pageExists(cfg.dist, r)) return true;
  console.warn(`lighthouse: ${r} is not in dist, skipped`);
  return false;
});
const slug = (r) => (r === '/' ? 'home' : r.replace(/^\/|\/$/g, '').replace(/\//g, '--'));

async function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  try { return chromeLauncher.getChromePath(); } catch { /* fall through */ }
  try {
    const { chromium } = await import('@playwright/test');
    const p = chromium.executablePath();
    if (fs.existsSync(p)) return p;
  } catch { /* none */ }
  return undefined;
}

await fsp.mkdir(OUT, { recursive: true });
const srv = await serveDist({ dist: cfg.dist, base: cfg.base });
const chromePath = await findChrome();
const rows = [];
console.log(`Lighthouse ${RUNS} run(s) per page, mobile preset, against ${srv.url}/`);
try {
  for (const route of routes) {
    const runs = [];
    for (let i = 1; i <= RUNS; i++) {
      // A fresh browser per run keeps the cache cold, the way a first visit from an ad lands.
      const chrome = await chromeLauncher.launch({ chromePath, chromeFlags: ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-extensions'] });
      try {
        const result = await lighthouse(srv.url + route, {
          port: chrome.port,
          output: ['html', 'json'],
          logLevel: 'error',
          onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        });
        const lhr = result.lhr;
        const name = `${slug(route)}${RUNS > 1 ? `-run${i}` : ''}`;
        await fsp.writeFile(path.join(OUT, `${name}.report.html`), result.report[0]);
        await fsp.writeFile(path.join(OUT, `${name}.report.json`), result.report[1]);
        const score = (k) => (lhr.categories[k]?.score == null ? null : Math.round(lhr.categories[k].score * 100));
        const num = (id) => lhr.audits[id]?.numericValue ?? null;
        const failedA11y = Object.values(lhr.audits).filter((a) => lhr.categories.accessibility?.auditRefs.some((r) => r.id === a.id && r.weight > 0) && a.score !== null && a.score < 1).map((a) => a.id);
        const failedSeo = Object.values(lhr.audits).filter((a) => lhr.categories.seo?.auditRefs.some((r) => r.id === a.id && r.weight > 0) && a.score !== null && a.score < 1).map((a) => a.id);
        runs.push({
          run: i, report: path.relative(ROOT, path.join(OUT, `${name}.report.html`)),
          performance: score('performance'), accessibility: score('accessibility'), bestPractices: score('best-practices'), seo: score('seo'),
          lcp: num('largest-contentful-paint'), cls: num('cumulative-layout-shift'), tbt: num('total-blocking-time'), fcp: num('first-contentful-paint'), si: num('speed-index'),
          lcpElement: lhr.audits['largest-contentful-paint-element']?.details?.items?.[0]?.items?.[0]?.node?.snippet || lhr.audits['largest-contentful-paint-element']?.details?.items?.[0]?.node?.snippet || '',
          failedA11y, failedSeo, runtimeError: lhr.runtimeError?.message || null,
          warnings: lhr.runWarnings || [],
        });
        process.stdout.write('.');
      } finally {
        await chrome.kill();
      }
    }
    const med = (k) => { const v = runs.map((r) => r[k]).filter((x) => x !== null).sort((a, b) => a - b); return v.length ? v[Math.floor((v.length - 1) / 2)] : null; };
    const worst = [...runs].sort((a, b) => (a.performance ?? 0) - (b.performance ?? 0))[0];
    rows.push({ route, runs, median: { performance: med('performance'), accessibility: med('accessibility'), bestPractices: med('bestPractices'), seo: med('seo'), lcp: med('lcp'), cls: med('cls'), tbt: med('tbt'), fcp: med('fcp'), si: med('si') }, worst });
  }
} finally {
  await srv.close();
}
process.stdout.write('\n');

// Report
const ms = (v) => (v == null ? '  n/a' : v >= 1000 ? (v / 1000).toFixed(2) + 's' : Math.round(v) + 'ms');
const pad = (s, n) => String(s ?? 'n/a').padStart(n);
console.log('-'.repeat(96));
console.log(`${'page'.padEnd(46)} ${pad('perf', 5)} ${pad('a11y', 5)} ${pad('bp', 4)} ${pad('seo', 4)} ${pad('LCP', 7)} ${pad('CLS', 6)} ${pad('TBT', 7)} ${pad('FCP', 7)}`);
const problems = [];
for (const r of rows) {
  const m = r.median;
  console.log(`${r.route.padEnd(46)} ${pad(m.performance, 5)} ${pad(m.accessibility, 5)} ${pad(m.bestPractices, 4)} ${pad(m.seo, 4)} ${pad(ms(m.lcp), 7)} ${pad(m.cls == null ? 'n/a' : m.cls.toFixed(3), 6)} ${pad(ms(m.tbt), 7)} ${pad(ms(m.fcp), 7)}`);
  if (RUNS > 1) console.log(`  runs perf: ${r.runs.map((x) => x.performance).join(', ')}   worst LCP ${ms(Math.max(...r.runs.map((x) => x.lcp ?? 0)))}`);
  if (r.worst?.lcpElement) console.log(`  LCP element: ${r.worst.lcpElement.slice(0, 110)}`);
  const a11yFails = [...new Set(r.runs.flatMap((x) => x.failedA11y))];
  if (a11yFails.length) console.log(`  accessibility audits failing: ${a11yFails.join(', ')}`);
  const seoFails = [...new Set(r.runs.flatMap((x) => x.failedSeo))];
  if (seoFails.length) console.log(`  seo audits failing: ${seoFails.join(', ')}${seoFails.every((id) => id === 'is-crawlable') ? ' (expected while the build is noindex)' : ''}`);
  for (const x of r.runs) if (x.runtimeError) problems.push(`${r.route} run ${x.run}: ${x.runtimeError}`);
  if (m.performance !== null && m.performance < BUDGET.performance) problems.push(`${r.route}: performance ${m.performance} < ${BUDGET.performance}`);
  if (RUNS > 1 && r.runs.some((x) => x.performance < BUDGET.performance)) console.log(`  note: ${r.runs.filter((x) => x.performance < BUDGET.performance).length} of ${RUNS} runs under ${BUDGET.performance}`);
  if (m.accessibility !== null && m.accessibility < BUDGET.accessibility) problems.push(`${r.route}: accessibility ${m.accessibility} < ${BUDGET.accessibility}`);
  if (m.bestPractices !== null && m.bestPractices < BUDGET.bestPractices) problems.push(`${r.route}: best practices ${m.bestPractices} < ${BUDGET.bestPractices}`);
}
console.log('-'.repeat(96));
await fsp.writeFile(path.join(OUT, 'summary.json'), JSON.stringify({ base: cfg.base, runs: RUNS, budget: BUDGET, pages: rows, problems }, null, 2));
console.log(`Reports: ${path.relative(ROOT, OUT)}/ (html and json per run, summary.json)`);
if (problems.length) {
  console.log('Budget misses:\n  ' + problems.join('\n  '));
  if (process.env.LH_NO_FAIL !== '1') process.exit(1);
} else console.log(`PASS: performance >= ${BUDGET.performance}, accessibility ${BUDGET.accessibility} and best practices ${BUDGET.bestPractices} on every audited page.`);
