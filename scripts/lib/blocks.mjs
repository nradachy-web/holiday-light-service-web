// Shared content blocks: breadcrumbs, FAQ, check rows, county pills, the What we light switcher,
// the season light string, the permanent lighting scene switcher and the lit statement.
import { esc, litWords, pad2 } from './html.mjs';
import { icon } from './icons.mjs';
import { STRINGS } from './roofline.mjs';

export function crumbs(ctx, items) {
  const all = [{ name: 'Home', href: '/' }, ...items];
  return `<nav class="crumbs" aria-label="Breadcrumb"><ol>${all
    .map((x, i) => {
      const last = i === all.length - 1;
      const inner = last ? `<span aria-current="page">${esc(x.name)}</span>` : `<a href="${ctx.url(x.href)}">${esc(x.name)}</a>`;
      return `<li>${i ? icon('chev') : ''}${inner}</li>`;
    })
    .join('')}</ol></nav>`;
}

export function faqList(items, { openFirst = true } = {}) {
  return `<div class="faq-list">${items
    .map(([q, a], i) => `<details class="faq"${openFirst && i === 0 ? ' open' : ''}><summary><span>${esc(q)}</span><span class="faq-ic">${icon('plus')}</span></summary><div class="faq-a"><p>${esc(a)}</p></div></details>`)
    .join('')}</div>`;
}

export const faqSchema = (items) => ({
  '@type': 'FAQPage',
  mainEntity: items.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
});

// "Every estimate spells out" check row (from c3).
export const SPELLS = ['Design', 'Installation', 'In-season service', 'Takedown'];
export const SPELLS_PERMANENT = ['Design', 'Installation', 'App walkthrough'];
export const SPELLS_LANDSCAPE = ['Design', 'Fixture placement', 'Installation'];
export function spellsOut(cls = '', items = SPELLS) {
  return `<div class="spells${cls ? ' ' + cls : ''}"><p class="spells-h">Every estimate spells out</p><ul>${items.map((x) => `<li>${icon('check')}<span>${x}</span></li>`).join('')}</ul></div>`;
}

// Proof row on the first screen. Landscape lighting is ground-level work, so its row trades the
// bucket trucks for the free estimate (both verified facts, DESIGN.md).
export const PROOF = ['Lighting Southeast Michigan since 2003', 'Bucket-truck crews for the high work'];
export const PROOF_LANDSCAPE = ['Lighting Southeast Michigan since 2003', 'Free estimates for homes and businesses'];
export function proofRow(cls = '', items = PROOF) {
  return `<ul class="proof${cls ? ' ' + cls : ''}">${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
}

export function ticks(list, cls = '') {
  return `<ul class="ticks${cls ? ' ' + cls : ''}">${list.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
}

// County rows with city pills. hrefFor(city) decides where each pill goes.
export function countyPills(ctx, { hrefFor = (c) => `/service-area/${c.slug}/`, headingTag = 'h3', current = '' } = {}) {
  return `<div class="counties">${ctx.content.counties
    .map(
      (g) => `<div class="county"><${headingTag} class="county-h">${esc(g.county)}</${headingTag}><ul class="city-pills">${g.cities
        .map((c) => `<li><a class="city-pill" href="${ctx.url(hrefFor(c))}"${c.slug === current ? ' aria-current="page"' : ''}>${esc(c.name)}</a></li>`)
        .join('')}</ul></div>`
    )
    .join('')}</div>`;
}

// Numbered cards for the three considerations.
export function considerationCards(list) {
  return `<ol class="cards3">${list.map(([t, p], i) => `<li class="ccard" data-reveal style="--d:${i * 90}ms"><span class="ccard-n">${pad2(i + 1)}</span><h3>${esc(t)}</h3><p>${esc(p)}</p></li>`).join('')}</ol>`;
}

// The process as a lit string of numbered steps.
export function processRow(steps, { cls = '' } = {}) {
  return `<ol class="process${cls ? ' ' + cls : ''}">${steps
    .map(([t, p], i) => `<li class="pstep" data-reveal style="--d:${i * 70}ms"><span class="pstep-n" aria-hidden="true">${i + 1}</span><h3>${esc(t)}</h3><p>${esc(p)}</p></li>`)
    .join('')}</ol>`;
}

// Large display statement that lights word by word as it scrolls in (c2).
export function statement(text, quietFrom) {
  const i = quietFrom ? text.indexOf(quietFrom) : -1;
  const main = i >= 0 ? text.slice(0, i).trim() : text;
  const quiet = i >= 0 ? text.slice(i).trim() : '';
  return `<p class="statement-text" data-lit>${litWords(main)}${quiet ? ` <span class="quiet">${litWords(quiet)}</span>` : ''}</p>`;
}

// Permanent lighting scene switcher: the hero's own C9 roofline string, recolored by scene.
export const SCENES = [
  ['warm', 'Warm white'],
  ['christmas', 'Christmas'],
  ['game', 'Game day'],
  ['july', 'Fourth of July'],
  ['halloween', 'Halloween'],
];
export function sceneSwitcher(ctx, { cls = '', preset = true } = {}) {
  return `<div class="scene${cls ? ' ' + cls : ''}" data-scene>
  <div class="scene-stage">
    ${STRINGS.scene()}
    <span class="scene-tag">Illustration</span>
  </div>
  <div class="scene-bar">
    <div class="scene-pills" role="group" aria-label="Preview a lighting scene">${SCENES.map(([k, l], i) => `<button class="pill pill-sm" type="button" aria-pressed="${i === 0}" data-scene-set="${k}">${l}</button>`).join('')}</div>
    ${preset ? `<button class="tlink scene-add" type="button" data-preset-light="Permanent lighting" data-preset-scroll>${icon('plus')}<span>Add permanent lighting to my estimate</span></button>` : ''}
  </div>
  <p class="scene-cap">Illustration of app-controlled scenes on one roofline. Choose colors and schedules from your phone.</p>
</div>`;
}

// The draped season string: five stations, bulbs lit up to today (c2 and c3, with c1's live logic).
const WINDOWS = [
  ['08-01', '10-31'],
  ['09-01', '11-30'],
  ['10-01', '12-10'],
  ['11-26', '01-01'],
  ['01-02', '01-31'],
];
// How each phase reads inside the live summary sentence ("Where the season stands today: booking and design.").
const PHASES = ['booking', 'design', 'installation', 'in-season service', 'takedown'];
export function seasonString(season) {
  const n = season.length;
  const w = 1000;
  const col = w / n;
  let d = `M0 6`;
  for (let i = 0; i < n; i++) {
    const x0 = i * col;
    d += ` Q${x0 + col / 2} 74 ${x0 + col} 6`;
  }
  return `<div class="season" data-season>
  <svg class="season-wire" viewBox="0 0 ${w} 60" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="${d}"/></svg>
  <ol class="stations">${season
    .map(
      (s, i) => `<li class="station" data-from="${WINDOWS[i][0]}" data-to="${WINDOWS[i][1]}" data-phase="${PHASES[i]}">
      <span class="st-bulb" aria-hidden="true"><svg viewBox="-6 -12 12 14" focusable="false"><use href="#c9-off"/><use class="st-on" href="#c9-on"/></svg></span>
      <span class="st-here" hidden>We are here</span>
      <p class="st-when">${esc(s.when)} <span class="st-now" hidden>Now</span></p>
      <h3>${esc(s.label)}</h3>
      <p>${esc(s.text)}</p>
    </li>`
    )
    .join('')}</ol>
  <p class="season-summary" data-season-summary hidden></p>
</div>`;
}

// The "What we light" switcher (c1). Panels are divs with role=tabpanel; inactive ones are inert.
export function switcher(ctx, cats) {
  const { photo, caption } = ctx.media;
  const sizesFor = (layout, k) => {
    if (layout === 'tri') return '(min-width: 1000px) 290px, 50vw';
    if (layout === 'native') return '(min-width: 761px) 560px, 100vw';
    if (layout === 'pair') return k === 0 ? '(min-width: 1000px) 540px, 100vw' : '(min-width: 1000px) 330px, 50vw';
    return '(min-width: 1000px) 880px, 100vw';
  };
  const panels = cats
    .map((c, i) => {
      const panes = c.panes
        .map((p, k) => {
          const m = ctx.content.mediaItem(p);
          const ar = c.layout === 'native' ? ` style="--ar:${m.width}/${m.height}"` : '';
          return `<figure class="pane${c.mpanes.includes(p) ? '' : ' pane-dsk'}"${ar}>${photo(p, { sizes: sizesFor(c.layout, k) })}<figcaption>${esc(caption(p))}</figcaption></figure>`;
        })
        .join('');
      return `<div class="sw-panel${i === 0 ? ' is-active' : ''}" id="sw-p-${c.id}" role="tabpanel" aria-labelledby="sw-t-${c.id}" data-panel>
  <div class="sw-media" data-layout="${c.layout}" data-mlayout="${c.layout === 'native' ? 'native' : c.mpanes.length > 1 ? 'pair' : 'single'}">${panes}</div>
  <div class="sw-info">
    <p class="sw-count"><span>${pad2(i + 1)}</span> / ${pad2(cats.length)}</p>
    <h3>${esc(c.title)}</h3>
    <p>${esc(c.text)}</p>
    ${ticks(c.list)}
    <div class="sw-actions">
      <a class="btn btn-glow btn-sm" href="#estimate" data-cta="estimate" data-placement="switcher_${c.id}"${c.presetLight ? ` data-preset-light="${esc(c.presetLight)}"` : ''}${c.presetProperty ? ` data-preset-property="${esc(c.presetProperty)}"` : ''}>${icon('plus')}<span>${esc(c.add)}</span></a>
      <a class="tlink" href="${ctx.url(c.link[1])}">${esc(c.link[0])}${icon('arrow')}</a>
    </div>
  </div>
</div>`;
    })
    .join('');
  return `<div class="sw" data-switch>
  <div class="sw-bar">
    <div class="sw-tabs" role="tablist" aria-label="What we light">${cats
      .map((c, i) => `<button class="pill" type="button" role="tab" id="sw-t-${c.id}" aria-controls="sw-p-${c.id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-tab>${esc(c.label)}<span class="pill-prog" aria-hidden="true"></span></button>`)
      .join('')}</div>
    <button class="vtoggle vtoggle-sm sw-toggle" type="button" data-sw-toggle>${icon('pause', 'i-pause')}${icon('play', 'i-play')}<span class="vtoggle-label" data-sw-label>Pause slideshow</span></button>
  </div>
  <div class="sw-stage">${panels}</div>
</div>`;
}

// "Planning for" row (commercial pages): property-type pills that preset the page's form, plus text
// links to each commercial property page. site.js keeps aria-pressed in step with the form.
const PLAN = [
  ['Business', 'Business'],
  ['HOA or subdivision', 'HOA entrance'],
  ['Downtown or municipality', 'Downtown district'],
];
export function planRow(ctx, { current = 'Business' } = {}) {
  const verticals = ctx.content.copy.verticals;
  const links = verticals.map((v, i) => `${i ? (i === verticals.length - 1 ? ' and ' : ', ') : ''}<a href="${ctx.url(`/commercial/${v.slug}/`)}">${esc(v.name.toLowerCase().replace(/^hoa/, 'HOA'))}</a>`).join('');
  return `<div class="plan" data-plan>
  <p class="plan-h" id="plan-h">Planning for</p>
  <div class="plan-pills" role="group" aria-labelledby="plan-h">${PLAN.map(([v, l]) => `<button class="pill pill-sm" type="button" aria-pressed="${v === current}" data-preset-property="${esc(v)}" data-plan-pill>${esc(l)}</button>`).join('')}</div>
  <p class="plan-links">More on ${links}.</p>
</div>`;
}
