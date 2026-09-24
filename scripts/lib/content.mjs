// Loads content/*.json once and exposes lookups. Templates never read files themselves.
import fs from 'node:fs';
import path from 'node:path';
import { CONTENT, COUNTY_ORDER, LOCAL_SERVICES } from './config.mjs';

const readJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

export function loadContent() {
  const copy = readJSON(path.join(CONTENT, 'site-copy.json'));
  const media = readJSON(path.join(CONTENT, 'media.json'));
  const cityDir = path.join(CONTENT, 'cities');
  const cities = fs
    .readdirSync(cityDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => readJSON(path.join(cityDir, f)))
    .sort((a, b) => a.name.localeCompare(b.name));

  const citySlugs = new Set(cities.map((c) => c.slug));
  for (const c of cities) {
    for (const s of LOCAL_SERVICES) {
      if (!c.pages?.[s]) throw new Error(`City ${c.slug} is missing page copy for ${s}`);
    }
    for (const n of c.neighbors || []) {
      if (!citySlugs.has(n)) throw new Error(`City ${c.slug} lists unknown neighbor ${n}`);
    }
  }

  // County groups in the fixed order, cities alphabetical. Unknown counties go last.
  const counties = [...COUNTY_ORDER, ...new Set(cities.map((c) => c.county).filter((c) => !COUNTY_ORDER.includes(c)))]
    .map((county) => ({ county, cities: cities.filter((c) => c.county === county) }))
    .filter((g) => g.cities.length);

  const service = (slug) => {
    const s = copy.services.find((x) => x.slug === slug);
    if (!s) throw new Error('Unknown service ' + slug);
    return s;
  };
  const vertical = (slug) => {
    const v = copy.verticals.find((x) => x.slug === slug);
    if (!v) throw new Error('Unknown vertical ' + slug);
    return v;
  };
  const city = (slug) => {
    const c = cities.find((x) => x.slug === slug);
    if (!c) throw new Error('Unknown city ' + slug);
    return c;
  };
  const mediaItem = (name) => {
    const m = media.find((x) => x.name === name);
    if (!m) throw new Error('Unknown media ' + name);
    return m;
  };

  return { copy, media, cities, counties, service, vertical, city, mediaItem, colorOf: colorCities(cities) };
}

// Greedy graph coloring over the neighbor graph (made symmetric), so that pages
// for neighboring communities pick different photo variants. Returns (slug, k) => index.
function colorCities(cities) {
  const adj = new Map(cities.map((c) => [c.slug, new Set()]));
  for (const c of cities) {
    for (const n of c.neighbors || []) {
      adj.get(c.slug).add(n);
      adj.get(n)?.add(c.slug);
    }
  }
  const order = [...cities].sort((a, b) => adj.get(b.slug).size - adj.get(a.slug).size || a.slug.localeCompare(b.slug));
  const cache = new Map();
  return (slug, k, salt = 0) => {
    const key = k + ':' + salt;
    if (!cache.has(key)) {
      const colors = new Map();
      order.forEach((c, i) => {
        const used = new Set([...adj.get(c.slug)].map((n) => colors.get(n)).filter((x) => x !== undefined));
        // Start from a rotating offset so the salt changes the distribution between services.
        let pick = (i + salt) % k;
        for (let t = 0; t < k && used.has(pick); t++) pick = (pick + 1) % k;
        colors.set(c.slug, pick);
      });
      cache.set(key, colors);
    }
    return cache.get(key).get(slug) ?? 0;
  };
}
