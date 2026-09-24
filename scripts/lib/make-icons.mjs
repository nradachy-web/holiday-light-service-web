// Generates the favicon set from one SVG: favicon.svg, favicon.ico (16 and 32 PNG entries),
// apple-touch-icon.png and the manifest icons. Run once when the mark changes:
//   node scripts/lib/make-icons.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { PUBLIC } from './config.mjs';

const mark = (bg = true, pad = 0) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${64 + pad * 2} ${64 + pad * 2}">
<defs><radialGradient id="g" cx="50%" cy="60%" r="50%"><stop offset="0" stop-color="#ffc56e" stop-opacity=".55"/><stop offset="1" stop-color="#ffc56e" stop-opacity="0"/></radialGradient></defs>
${bg ? `<rect x="${-pad}" y="${-pad}" width="${64 + pad * 2}" height="${64 + pad * 2}" rx="${pad ? 0 : 14}" fill="#05070d"/>` : ''}
<circle cx="32" cy="40" r="22" fill="url(#g)"/>
<path d="M6 13c14 8 38 8 52 0" fill="none" stroke="#e8d9bf" stroke-opacity=".6" stroke-width="2.4" stroke-linecap="round"/>
<rect x="27.5" y="16.5" width="9" height="8.5" rx="2" fill="#9a8e7f"/>
<path d="M32 24.5c-7.4 0-11.6 5.9-11.6 12.6 0 8.2 6.9 13.3 11.6 21.7 4.7-8.4 11.6-13.5 11.6-21.7 0-6.7-4.2-12.6-11.6-12.6z" fill="#ffd18a"/>
<path d="M27 33.6c.6-2.9 2.5-5 5-5.5" fill="none" stroke="#fffaf0" stroke-width="2.4" stroke-linecap="round"/>
</svg>`;

const png = (svg, size) => sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + images.length * 16;
  for (const { size, data } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

await fs.mkdir(path.join(PUBLIC, 'assets/icons'), { recursive: true });
await fs.writeFile(path.join(PUBLIC, 'favicon.svg'), mark());
await fs.writeFile(path.join(PUBLIC, 'favicon.ico'), ico([{ size: 16, data: await png(mark(), 16) }, { size: 32, data: await png(mark(), 32) }]));
await fs.writeFile(path.join(PUBLIC, 'apple-touch-icon.png'), await png(mark(true, 6), 180));
await fs.writeFile(path.join(PUBLIC, 'assets/icons/icon-192.png'), await png(mark(true, 6), 192));
await fs.writeFile(path.join(PUBLIC, 'assets/icons/icon-512.png'), await png(mark(true, 6), 512));
await fs.writeFile(
  path.join(PUBLIC, 'site.webmanifest'),
  JSON.stringify(
    {
      name: 'Holiday Light Service',
      short_name: 'Holiday Lights',
      icons: [
        { src: 'assets/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'assets/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
      theme_color: '#05070d',
      background_color: '#05070d',
      display: 'browser',
    },
    null,
    2
  ) + '\n'
);
console.log('Icons written to public/');
