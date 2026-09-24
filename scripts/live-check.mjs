#!/usr/bin/env node
// Checks a deployed copy of the site against the local build, after every deploy and before the
// preview link goes to anyone.
//
//   npm run live-check                               checks the origin and base path in dist/route-manifest.json
//   npm run live-check -- https://holidaylightservicemi.com
//
// Every route the local build lists (sitemap pages plus /thank-you/ and /404.html) must answer 200 at
// the live URL, and the live home page must load the same site.js and site.css version as dist/.
// A mismatch means the deploy has not caught up with the source. Exits 1 on any problem.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestFile = path.join(ROOT, 'dist', 'route-manifest.json');
if (!fs.existsSync(manifestFile)) {
  console.error('live-check: dist/route-manifest.json is missing. Run npm run build first (with the same settings as the deploy).');
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
const arg = process.argv.slice(2).find((a) => /^https?:\/\//.test(a));
const site = (arg || manifest.origin + manifest.base).replace(/\/+$/, '');
const routes = [...manifest.routes, ...manifest.unlisted].map((r) => r.path);

const version = (html) => (html.match(/site\.js\?v=([a-z0-9]+)/) || [])[1] || '';
const localVersion = version(fs.readFileSync(path.join(ROOT, 'dist', 'index.html'), 'utf8'));

const problems = [];
let checked = 0;
async function check(route) {
  const url = site + route;
  try {
    const res = await fetch(url, { redirect: 'follow', headers: { 'cache-control': 'no-cache' } });
    checked++;
    if (res.status !== 200) problems.push(`${res.status} ${url}`);
    if (route === '/') {
      const live = version(await res.text());
      if (live !== localVersion) problems.push(`the live home page loads site.js?v=${live || 'none'}, the local build has v=${localVersion}: the deploy is older than the source`);
    }
  } catch (e) {
    problems.push(`no answer from ${url} (${e.message})`);
  }
}

const queue = [...routes];
await Promise.all(Array.from({ length: 8 }, async () => { while (queue.length) await check(queue.shift()); }));

console.log(`live-check ${site}/: ${checked} of ${routes.length} routes answered, ${problems.length} problem(s).`);
for (const p of problems.slice(0, 60)) console.log('  x ' + p);
if (problems.length > 60) console.log(`  ... and ${problems.length - 60} more`);
if (!problems.length) console.log('PASS: every route answers 200 and the live build matches dist/.');
process.exit(problems.length ? 1 : 0);
