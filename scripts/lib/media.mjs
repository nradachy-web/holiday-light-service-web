// Photo and background video markup. Widths come only from content/media.json and every
// referenced file is checked against public/ at build time, so a missing size fails the build.
import fs from 'node:fs';
import path from 'node:path';
import { PUBLIC } from './config.mjs';
import { esc, attrs } from './html.mjs';
import { icon } from './icons.mjs';

export function createMedia({ url, mediaItem, tinyPosters = {} }) {
  const checked = new Set();
  const asset = (p) => {
    if (!checked.has(p)) {
      if (!fs.existsSync(path.join(PUBLIC, p))) throw new Error('Media file missing from public/: ' + p);
      checked.add(p);
    }
    return url(p);
  };
  const sorted = (obj = {}) =>
    Object.entries(obj)
      .map(([w, p]) => [Number(w), p])
      .sort((a, b) => a[0] - b[0]);
  const srcset = (obj) => sorted(obj).map(([w, p]) => `${asset(p)} ${w}w`).join(', ');

  function photo(name, { sizes = '100vw', eager = false, alt, cls = '', focal } = {}) {
    const m = mediaItem(name);
    if (m.kind !== 'photo') throw new Error(name + ' is not a photo');
    const webp = sorted(m.files.webp);
    const fallback = (webp.filter(([w]) => w <= 900).pop() || webp[0])[1];
    const a = alt === undefined ? m.alt : alt;
    const avif = m.files.avif && Object.keys(m.files.avif).length ? `<source type="image/avif" srcset="${srcset(m.files.avif)}" sizes="${sizes}">` : '';
    return `<picture${cls ? ` class="${cls}"` : ''}>${avif}<source type="image/webp" srcset="${srcset(m.files.webp)}" sizes="${sizes}"><img${attrs({
      src: asset(fallback),
      width: m.width,
      height: m.height,
      alt: a,
      loading: eager ? 'eager' : 'lazy',
      decoding: 'async',
      fetchpriority: eager ? 'high' : false,
      style: `object-position:${focal || m.focal || '50% 50%'}`,
    })}></picture>`;
  }

  const caption = (name) => mediaItem(name).caption;

  // A captioned figure. The caption always comes from media.json.
  function figure(name, { sizes, cls = '', eager = false, focal, ratio } = {}) {
    return `<figure class="${cls}"${ratio ? ` style="--ratio:${ratio}"` : ''}>${photo(name, { sizes, eager, focal })}<figcaption>${esc(caption(name))}</figcaption></figure>`;
  }

  /**
   * Background video: a poster <picture> (the real first frame, responsive) under a <video>
   * that has no autoplay attribute. site.js attaches the source after load and idle (autostart) or
   * after the first scroll or tap, and never on reduced motion, Save-Data or slow connections.
   * Returns { html, toggle, caption }.
   */
  function bgVideo(name, { id, eager = false, autostart = eager, portrait = false, sizes = '100vw', alt, focal } = {}) {
    const m = mediaItem(name);
    if (m.kind !== 'video') throw new Error(name + ' is not a video');
    const p = m.files.poster;
    const land = { webp: srcset(p.webp), avif: srcset(p.avif) };
    const hasPortrait = portrait && m.files.portrait;
    const portraitSources = hasPortrait
      ? `<source media="(max-aspect-ratio: 4/5)" type="image/avif" srcset="${srcset(m.files.portrait.poster.avif)}"><source media="(max-aspect-ratio: 4/5)" type="image/webp" srcset="${srcset(m.files.portrait.poster.webp)}">`
      : '';
    const posterFallback = sorted(p.webp)[0][1];
    const a = alt === undefined ? m.alt : alt;
    const pos = focal || m.focal || '50% 50%';
    const picture = `<picture class="bgv-poster">${portraitSources}<source type="image/avif" srcset="${land.avif}" sizes="${sizes}"><source type="image/webp" srcset="${land.webp}" sizes="${sizes}"><img${attrs({
      src: asset(posterFallback),
      width: m.width,
      height: m.height,
      alt: a,
      loading: eager ? 'eager' : 'lazy',
      decoding: 'async',
      fetchpriority: eager ? 'high' : false,
      style: `object-position:${pos}`,
    })}></picture>`;
    const video = `<video${attrs({
      id,
      class: 'bgv-video',
      'data-bg-video': name,
      muted: true,
      playsinline: true,
      loop: true,
      preload: 'none',
      poster: tinyPosters[name] || url(posterFallback),
      'aria-hidden': 'true',
      tabindex: '-1',
      'data-src-sd': asset(m.files.mp4['720']),
      'data-src-hd': asset(m.files.mp4['1080']),
      'data-src-portrait': hasPortrait ? asset(m.files.portrait.mp4) : false,
      // Autostart videos fill the first screen and start after load and idle. The rest start only
      // after the visitor scrolls or taps, which also keeps their first frame out of the LCP window.
      'data-autostart': autostart ? 'true' : false,
      style: `object-position:${pos}`,
    })}></video>`;
    const toggle = `<button class="vtoggle" type="button" data-video-toggle aria-controls="${id}">${icon('pause', 'i-pause')}${icon('play', 'i-play')}<span class="vtoggle-label" data-video-label>Play video</span></button>`;
    return { html: `<div class="bgv">${picture}${video}</div>`, toggle, caption: m.caption };
  }

  return { photo, figure, bgVideo, caption, asset };
}
