#!/usr/bin/env node
// Holiday Light Service: media pipeline.
//
// Builds every photo, still and background video the site uses, and writes content/media.json.
//
//   node scripts/prepare-media.mjs            run everything (photos, stills, videos, manifest)
//   node scripts/prepare-media.mjs photos     company photos only
//   node scripts/prepare-media.mjs stills     4K footage stills only
//   node scripts/prepare-media.mjs videos     background loops only (slow: decodes 4K footage)
//   node scripts/prepare-media.mjs manifest   rewrite content/media.json from files on disk
//   add --only=<name> to limit photos, stills or videos to one item
//
// Requirements
//   sharp (installed in node_modules) for all image work.
//   ffmpeg 7 with libx264, libwebp not required. Path from $FFMPEG, else the build machine default below.
//   Source media stays read only. Intermediate frames go to $MEDIA_SCRATCH (default: OS temp dir).
//
// Video method (see VIDEOS below)
//   1. ffmpeg decodes only the needed seconds of the 4K source, crops, scales with lanczos,
//      applies a light denoise and grade, and writes raw RGB frames to scratch.
//   2. Node builds the loop frame by frame:
//        pingpong: eased forward and back sweep through a short window (cosine time curve, velocity
//                  reaches zero at both turnarounds, neighbouring frames blended for sub frame positions).
//                  Used for the hero (slow pull back) and the park orbit, where nothing moves on its own.
//        xfade:    the tail of the shot dissolves into its head with a smoothstep curve, so the last
//                  frame leads straight into frame 0. Used for shots with traffic or people.
//   3. x264 (high profile, yuv420p, faststart, no audio) with a CRF search against a bitrate budget:
//        1080p <= 4.5 MB per 10 s, 720p <= 1.8 MB per 10 s, portrait 720x1280 <= 2 MB per 10 s.
//   4. Posters are rendered from loop frame 0, so the poster always equals the first video frame.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IMG_OUT = path.join(ROOT, 'public/assets/images');
const VID_OUT = path.join(ROOT, 'public/assets/media');
const MANIFEST = path.join(ROOT, 'content/media.json');

const FFMPEG = process.env.FFMPEG ||
  '/private/tmp/claude-501/-Users-modernapex/32c849ea-97b9-480c-9572-26b37bbeb534/scratchpad/mediaenv/lib/python3.10/site-packages/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1';
const SRC_ROOT = process.env.HLS_MEDIA_SRC || '/Users/modernapex/Desktop/Desktop - Modern’s MacBook Pro/MC2 (2)';
const PHOTO_DIR = path.join(SRC_ROOT, 'holiday Lighting Serice');
const RAW_A = path.join(PHOTO_DIR, 'Boyne (1)');
const RAW_B = path.join(PHOTO_DIR, 'Charlevoix (1)');
const SCRATCH = process.env.MEDIA_SCRATCH || path.join(os.tmpdir(), 'hls-media-scratch');

const FPS_NUM = 24000, FPS_DEN = 1001; // all drone footage is 23.976 fps
const FPS = FPS_NUM / FPS_DEN;
const WEBP_Q = 76;
const AVIF_Q = 52;
const PHOTO_WIDTHS = [480, 900, 1500];
const THUMB = 160;

// ---------------------------------------------------------------------------------------------
// Company photos. Captions stay generic and true: no city names, no client names, no claims.
// crop: [left, top, width, height] in source pixels, applied after auto orient.
// redact: regions blurred for privacy (a house number), same coordinate space as crop input.
// ---------------------------------------------------------------------------------------------
const PHOTOS = [
  { file: '129314893_2469686016658443_8639073912067040365_n.jpg', name: 'residential-birch-wraps', tone: 'night', focal: '50% 45%',
    subject: 'Tree wraps (residential)',
    caption: 'Birch trunks wrapped limb by limb in cool white and red.',
    alt: 'A clump of birch trees at night with trunks and limbs wrapped in cool white and red mini lights, beside a landscaped bed of boulders.',
    uses: ['services-residential', 'landing-residential', 'our-work'] },
  { file: '132030927_2481261462167565_7593318136203041138_n.jpg', name: 'residential-multicolor-canopy', tone: 'night', focal: '50% 40%',
    subject: 'Tree and canopy lighting (residential)',
    caption: 'A mature front yard tree wrapped from trunk to branch tips in multicolor.',
    alt: 'A large bare tree in a front yard at night wrapped from the trunk to the branch tips in multicolor lights, with lit homes behind it.',
    uses: ['services-residential', 'landing-residential', 'our-work'] },
  { file: '146162969_2512819679011743_8235099763966159765_n.jpg', name: 'residential-red-green-trees', tone: 'night', focal: '50% 50%',
    subject: 'Tree and canopy lighting (residential)',
    caption: 'Red and green canopy wraps framing a brick home.',
    alt: 'A brick two story home at night with a large tree wrapped in red lights on the left, a tree wrapped in green on the right, and smaller lit trees by the entry.',
    uses: ['services-residential', 'landing-residential', 'our-work'] },
  { file: '146874579_2512819719011739_976688975703017391_n.jpg', name: 'evergreens-green-lights', tone: 'night', focal: '50% 45%',
    subject: 'Trees and shrubs',
    caption: 'Spruce trees filled with green light along a lawn edge.',
    alt: 'Two spruce trees covered in green lights on a lawn at night, with a birch trunk in front of the left tree.',
    uses: ['services-residential', 'landing-residential', 'our-work'] },
  { file: '476134406_3522659444694423_7971977880812506950_n.jpg', name: 'downtown-street-blue-hour', tone: 'dusk', focal: '50% 60%',
    crop: [0, 0, 720, 780], // removes a car hood in the lower right corner
    subject: 'Downtown and municipal lighting',
    caption: 'Downtown street trees wrapped in warm white at blue hour.',
    alt: 'A downtown street at dusk lined with trees wrapped in warm white lights, with traffic signals, a crosswalk and historic brick buildings.',
    uses: ['services-commercial', 'landing-commercial', 'our-work'] },
  { file: '476901242_1115632547240632_7787262208680534748_n.jpg', name: 'commercial-building-lit-trees', tone: 'night', focal: '55% 50%',
    crop: [0, 160, 2048, 1280], // trims empty sky and pavement
    subject: 'Commercial properties',
    caption: 'Warm white canopy lighting on the trees in front of an office building.',
    alt: 'A two story brick office building at night with three trees in front fully wrapped in warm white lights.',
    uses: ['services-commercial', 'landing-commercial', 'our-work'] },
  { file: '480028355_3530974637196237_5846961978144781926_n.jpg', name: 'subdivision-entrance-green-trees', tone: 'night', focal: '45% 50%',
    subject: 'HOA and subdivision entrances',
    caption: 'A subdivision entrance with canopy trees wrapped in green and a lit stone sign.',
    alt: 'A neighborhood entrance at night with a row of trees wrapped in green lights, white wrapped trunks, a stone entry sign trimmed in warm white and white lights along a fence.',
    uses: ['services-commercial', 'landing-commercial', 'our-work'] },
  { file: '480327527_3530974513862916_2784109451722030117_n.jpg', name: 'evergreens-warm-white', tone: 'night', focal: '50% 40%',
    subject: 'Trees and shrubs',
    caption: 'A stand of evergreens filled with warm white light.',
    alt: 'Five tall evergreen trees wrapped in warm white lights at night beside a walkway, with a river rock bed in the foreground.',
    uses: ['services-residential', 'services-commercial', 'landing-residential', 'our-work'] },
  { file: '480453286_3530974557196245_106224686942105336_n.jpg', name: 'roofline-large-home', tone: 'dusk', focal: '50% 50%',
    subject: 'Roofline lighting',
    caption: 'Warm white bulbs tracing every gable, dormer and eave.',
    alt: 'A large two story home at dusk with warm white bulbs outlining the rooflines, gables and dormers.',
    uses: ['services-residential', 'landing-residential', 'our-work'] },
  { file: '480550245_3530974383862929_7112163994489369255_n.jpg', name: 'bucket-truck-roofline-install', tone: 'day', focal: '40% 45%',
    redact: [[452, 455, 42, 30]], // house number plaque
    subject: 'Installation crew',
    caption: 'A bucket truck crew working a steep gable in daylight.',
    alt: 'A crew member in a bucket lift at the peak of a brick and sided home, with a white utility truck in the driveway.',
    uses: ['about', 'services-residential', 'landing-residential'] },
  { file: '484498573_1139182574885629_3692304098878028007_n.jpg', name: 'downtown-streetscape-daytime', tone: 'day', focal: '50% 60%',
    subject: 'Downtown streetscape (daytime)',
    caption: 'A downtown streetscape seen from above in daylight.',
    alt: 'An elevated daytime view of a downtown street with pedestrian crossing signs, a planted median, street trees and a brick building at the end of the block.',
    uses: ['about'] },
  { file: '484567967_1143898407747379_3293816618930001163_n.jpg', name: 'downtown-wrapped-trees-night', tone: 'night', focal: '50% 45%',
    subject: 'Downtown and municipal lighting',
    caption: 'Street trees wrapped in warm white along both sides of a downtown block.',
    alt: 'An empty downtown main street at night with trees on both sides wrapped in warm white lights above storefronts and sidewalks.',
    uses: ['services-commercial', 'landing-commercial', 'our-work'] },
  { file: '485146249_1144327904371096_4055950562844005726_n.jpg', name: 'crew-bistro-install', tone: 'day', focal: '35% 45%',
    subject: 'Installation crew',
    caption: 'Hanging bistro lights from the bucket.',
    alt: 'A crew member in a bucket lift attaching a strand of red and clear bistro bulbs to an overhead cable above a road crosswalk.',
    uses: ['about', 'services-commercial', 'landing-commercial'] },
  { file: '485369565_1143898544414032_4570760519663766981_n.jpg', name: 'downtown-sidewalk-wraps', tone: 'night', focal: '30% 40%',
    subject: 'Downtown and municipal lighting',
    caption: 'Warm white wraps running the length of a downtown sidewalk.',
    alt: 'A downtown sidewalk at night with a street tree wrapped in warm white lights in the foreground and more lit trees down the block.',
    uses: ['services-commercial', 'landing-commercial', 'our-work'] },
  { file: '486475683_1149446533859233_7964706126709085629_n.jpg', name: 'pavilion-roofline-lights', tone: 'night', focal: '47% 55%',
    crop: [0, 250, 2048, 620], // keeps the lit roofline, drops empty sky and a long photographer shadow
    subject: 'Building outlines (commercial)',
    caption: 'Warm white bulbs outlining a covered pavilion roofline.',
    alt: 'A covered pavilion at night with warm white bulbs outlining the roofline and a stone center gable holding a lit wreath.',
    uses: ['services-commercial', 'landing-commercial', 'our-work'] },
];
// Excluded on purpose (see report): 477025717 (a composited portrait over a downtown scene outside the
// service area, with a named city banner), and the three PNG screenshots in the source folder.

// ---------------------------------------------------------------------------------------------
// Stills pulled from the 4K drone footage (shot in Northern Michigan; the town is not named).
// ---------------------------------------------------------------------------------------------
const STILLS = [
  { src: [RAW_A, 'Dronegenuity16.MOV'], t: 23.0, name: 'waterfront-tree-night', tone: 'night', focal: '51% 55%',
    subject: 'Municipal tree lighting',
    caption: 'A giant multicolor tree on the waterfront at night, Northern Michigan.',
    alt: 'A tall evergreen covered in multicolor lights standing on a lakeshore at night, with dark water, a far shoreline and a cloudy sky behind.',
    uses: ['services-commercial', 'landing-commercial', 'our-work', 'closing'] },
  { src: [RAW_A, 'Dronegenuity17.MOV'], t: 16.0, name: 'tree-lights-closeup', tone: 'night', focal: '55% 50%',
    subject: 'Municipal tree lighting',
    caption: 'Dense multicolor lighting on a giant evergreen, seen up close.',
    alt: 'A close view of a large evergreen densely wrapped in red, green, blue and white lights against a dark evening sky and water.',
    uses: ['services-commercial', 'our-work', 'about'] },
  { src: [RAW_A, 'Dronegenuity9.MOV'], t: 30.0, name: 'waterfront-tree-dusk', tone: 'dusk', focal: '60% 45%',
    subject: 'Municipal tree lighting',
    caption: 'A lit waterfront tree at dusk, Northern Michigan.',
    alt: 'An aerial view at dusk of a tall evergreen covered in multicolor lights beside a lakeshore path, with a pier and calm water reflecting the clouds.',
    uses: ['services-commercial', 'landing-commercial', 'our-work'] },
  { src: [RAW_B, 'Dronegenuity11.MOV'], t: 40.0, name: 'park-tree-and-wraps', tone: 'dusk', focal: '65% 50%',
    subject: 'Downtown and municipal lighting',
    caption: 'A community tree surrounded by warm white canopy wraps, Northern Michigan.',
    alt: 'A tall evergreen in multicolor lights in a town park at blue hour, with deciduous trees wrapped in warm white lights behind it.',
    uses: ['services-commercial', 'landing-commercial', 'our-work'] },
  { src: [RAW_B, 'Dronegenuity5.MOV'], t: 6.0, name: 'downtown-storefront-wraps', tone: 'night', focal: '55% 45%',
    subject: 'Downtown and municipal lighting',
    caption: 'Canopy trees wrapped in warm white along a downtown block, Northern Michigan.',
    alt: 'A row of lit storefronts at night behind large street trees wrapped in warm white lights, with cars parked along the curb.',
    uses: ['services-commercial', 'landing-commercial', 'our-work'] },
  { src: [RAW_B, 'Dronegenuity9.MOV'], t: 80.0, name: 'downtown-sidewalk-night', tone: 'night', focal: '45% 45%',
    subject: 'Downtown and municipal lighting',
    caption: 'A downtown sidewalk under warm white canopy lighting, Northern Michigan.',
    alt: 'A wide downtown sidewalk at night beneath street trees wrapped in warm white lights, with storefronts glowing across the street.',
    uses: ['services-commercial', 'landing-commercial', 'our-work'] },
  { src: [RAW_B, 'Dronegenuity15.MOV'], t: 3.0, name: 'town-blue-hour-aerial', tone: 'dusk', focal: '50% 70%',
    subject: 'Downtown and municipal lighting',
    caption: 'A lit downtown at blue hour, Northern Michigan.',
    alt: 'An aerial view of a small downtown at blue hour, with warm white wrapped trees along the main street under a deep blue sky.',
    uses: ['closing', 'services-commercial', 'our-work'] },
  { src: [RAW_B, 'Dronegenuity3.MP4'], t: 0.6, name: 'town-harbor-aerial', tone: 'dusk', focal: '55% 55%',
    subject: 'Downtown and municipal lighting',
    caption: 'Wrapped street trees leading to the harbor at blue hour, Northern Michigan.',
    alt: 'An aerial view at blue hour of a main street lined with trees wrapped in warm white lights, leading past rooftops to a harbor and a lake.',
    uses: ['closing', 'services-commercial', 'landing-commercial', 'our-work'] },
];

// ---------------------------------------------------------------------------------------------
// Background loops. Times are seconds in the source file. crop is [w, h, x, y] in 4K pixels.
// ---------------------------------------------------------------------------------------------
const VIDEOS = [
  { name: 'hero-tree', src: [RAW_A, 'Dronegenuity16.MOV'], mode: 'pingpong', start: 22.5, span: 3.0, periodFrames: 240,
    crop: [3200, 1800, 0, 220], grade: 'eq=saturation=1.12:contrast=1.03',
    portrait: { crop: [1216, 2160, 1354, 0], size: [720, 1280] },
    tone: 'night', focal: '62% 50%', portraitFocal: '50% 50%',
    subject: 'Municipal tree lighting',
    caption: 'A giant multicolor tree on the waterfront at night, Northern Michigan.',
    alt: 'A slow aerial drift in front of a tall evergreen covered in multicolor lights on a lakeshore at night.',
    uses: ['hero'] },
  { name: 'downtown-wraps', src: [RAW_B, 'Dronegenuity5.MOV'], mode: 'xfade', start: 0.0, loop: 8.5, fade: 1.5,
    crop: null, grade: 'eq=saturation=1.06:contrast=1.03',
    tone: 'night', focal: '50% 45%',
    subject: 'Downtown and municipal lighting',
    caption: 'Canopy trees wrapped in warm white along a downtown block, Northern Michigan.',
    alt: 'A slow sideways pass along lit storefronts beneath street trees wrapped in warm white lights at night.',
    uses: ['services-commercial', 'landing-commercial'] },
  { name: 'town-aerial', src: [RAW_B, 'Dronegenuity15.MOV'], mode: 'xfade', start: 0.75, loop: 8.5, fade: 1.5,
    crop: null, grade: 'eq=saturation=1.1:contrast=1.03',
    tone: 'dusk', focal: '50% 65%',
    subject: 'Downtown and municipal lighting',
    caption: 'A lit downtown at blue hour, Northern Michigan.',
    alt: 'A slow aerial pan across a small downtown at blue hour, with warm white wrapped trees glowing under a deep blue sky.',
    uses: ['closing', 'service-area'] },
  { name: 'park-tree-wraps', src: [RAW_B, 'Dronegenuity11.MOV'], mode: 'pingpong', start: 40.0, span: 4.0, periodFrames: 240,
    crop: null, grade: 'eq=saturation=1.08:contrast=1.03',
    tone: 'dusk', focal: '55% 50%',
    subject: 'Downtown and municipal lighting',
    caption: 'A community tree and warm white canopy wraps in a town park, Northern Michigan.',
    alt: 'A slow aerial orbit around a tall multicolor tree in a park at blue hour, with warm white wrapped trees behind it.',
    uses: ['services-commercial', 'landing-commercial', 'our-work'] },
];

// ---------------------------------------------------------------------------------------------
const args = process.argv.slice(2);
const stage = args.find(a => !a.startsWith('--')) || 'all';
const only = (args.find(a => a.startsWith('--only=')) || '').slice(7) || null;
const pick = list => list.filter(x => !x.skip && (!only || x.name === only));
const log = (...m) => console.log(...m);

function ff(argv, opts = {}) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-nostdin', ...argv], { stdio: ['ignore', 'inherit', 'inherit'], ...opts });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${argv.join(' ')}`);
}

// ---------- images ----------
async function writeImageSet(input, name, { widths = PHOTO_WIDTHS } = {}) {
  const meta = await sharp(input).metadata();
  const srcW = meta.width, srcH = meta.height;
  let sizes = widths.filter(w => w <= srcW);
  // A source narrower than the next standard size still ships at its own width, never upscaled.
  if (srcW < 1500 && (!sizes.length || sizes[sizes.length - 1] < srcW * 0.85)) sizes.push(srcW);
  const files = { webp: {}, avif: {} };
  const rel = f => `/assets/images/${f}`;
  const outs = [];
  for (const w of [THUMB, ...sizes]) {
    const f = `${name}-${w}.webp`;
    await sharp(input).resize({ width: w, withoutEnlargement: true, kernel: 'lanczos3' })
      .webp({ quality: w === THUMB ? 70 : WEBP_Q, effort: 6, smartSubsample: true }).toFile(path.join(IMG_OUT, f));
    files.webp[w] = rel(f);
    outs.push(f);
    if (w >= 720) {
      const a = `${name}-${w}.avif`;
      const buf = await sharp(input).resize({ width: w, withoutEnlargement: true, kernel: 'lanczos3' })
        .avif({ quality: AVIF_Q, effort: 6 }).toBuffer();
      const webpSize = fs.statSync(path.join(IMG_OUT, f)).size;
      if (buf.length < webpSize) { await fsp.writeFile(path.join(IMG_OUT, a), buf); files.avif[w] = rel(a); outs.push(a); }
      else if (fs.existsSync(path.join(IMG_OUT, a))) await fsp.rm(path.join(IMG_OUT, a));
    }
  }
  return { files, width: srcW, height: srcH, sizes: [THUMB, ...sizes], outs };
}

async function preparePhotoBuffer(p) {
  let img = sharp(path.join(PHOTO_DIR, p.file)).rotate();
  let buf = await img.toColourspace('srgb').png().toBuffer();
  if (p.redact) {
    const comps = [];
    for (const [left, top, width, height] of p.redact) {
      const patch = await sharp(buf).extract({ left, top, width, height }).blur(8).toBuffer();
      comps.push({ input: patch, left, top });
    }
    buf = await sharp(buf).composite(comps).png().toBuffer();
  }
  if (p.crop) {
    const [left, top, width, height] = p.crop;
    buf = await sharp(buf).extract({ left, top, width, height }).png().toBuffer();
  }
  return buf;
}

async function runPhotos() {
  await fsp.mkdir(IMG_OUT, { recursive: true });
  for (const p of pick(PHOTOS)) {
    const buf = await preparePhotoBuffer(p);
    const r = await writeImageSet(buf, p.name);
    log(`photo ${p.name}: ${r.width}x${r.height} -> ${r.sizes.join(',')}`);
  }
}

async function runStills() {
  await fsp.mkdir(IMG_OUT, { recursive: true });
  const dir = path.join(SCRATCH, 'stills');
  await fsp.mkdir(dir, { recursive: true });
  for (const s of pick(STILLS)) {
    const png = path.join(dir, `${s.name}.png`);
    // Accurate seek, one full resolution frame, converted with the BT.709 matrix the footage is tagged with.
    ff(['-ss', String(s.t), '-i', path.join(...s.src), '-frames:v', '1', '-an',
      '-vf', 'scale=in_color_matrix=bt709:in_range=tv,format=rgb24', '-y', png]);
    const buf = await sharp(png).modulate({ saturation: 1.08 }).linear(1.03, -3).png().toBuffer();
    const r = await writeImageSet(buf, s.name);
    log(`still ${s.name}: ${r.width}x${r.height} -> ${r.sizes.join(',')}`);
  }
}

// ---------- video ----------
function extractFrames({ src, start, count, crop, size, grade, rawPath }) {
  // Decode 1 s of pre roll so the temporal denoiser has history, then keep `count` frames.
  const preroll = Math.min(start, 1.0);
  const prerollFrames = Math.round(preroll * FPS);
  const [w, h] = size;
  const vf = [
    crop ? `crop=${crop[0]}:${crop[1]}:${crop[2]}:${crop[3]}` : null,
    `scale=${w}:${h}:flags=lanczos`,
    'hqdn3d=1.2:1.2:5:5',
    grade || null,
    `trim=start_frame=${prerollFrames}`,
    'scale=in_color_matrix=bt709:in_range=tv',
    'format=rgb24',
  ].filter(Boolean).join(',');
  ff(['-ss', (start - preroll).toFixed(4), '-i', src, '-an', '-vf', vf, '-frames:v', String(count), '-f', 'rawvideo', '-y', rawPath]);
  const frameBytes = w * h * 3;
  const got = fs.statSync(rawPath).size / frameBytes;
  if (got < count) throw new Error(`extracted ${got} frames, needed ${count} (${rawPath})`);
  return frameBytes;
}

function readFrame(fd, i, frameBytes, buf) {
  fs.readSync(fd, buf, 0, frameBytes, i * frameBytes);
  return buf;
}

function blendInto(out, a, b, wB) {
  const wA = 1 - wB;
  for (let i = 0; i < out.length; i++) out[i] = a[i] * wA + b[i] * wB + 0.5;
}

const smooth = x => x * x * (3 - 2 * x);

// Returns a list of [indexA, indexB, weightB] per output frame.
function loopPlan(v) {
  if (v.mode === 'pingpong') {
    const n = Math.round(v.span * FPS) + 1;
    const P = v.periodFrames;
    const plan = [];
    for (let k = 0; k < P; k++) {
      const u = (1 - Math.cos((2 * Math.PI * k) / P)) / 2;
      const pos = u * (n - 1);
      const i = Math.floor(pos), w = pos - i;
      plan.push([i, Math.min(i + 1, n - 1), w]);
    }
    return { sourceFrames: n, plan };
  }
  const D = Math.round(v.loop * FPS), X = Math.round(v.fade * FPS);
  const plan = [];
  for (let k = 0; k < D; k++) {
    if (k < D - X) plan.push([k + X, k + X, 0]);
    else { const j = k - (D - X); plan.push([k + X, j, smooth((j + 1) / (X + 1))]); }
  }
  return { sourceFrames: D + X, plan };
}

function renderLoop(rawIn, rawOut, frameBytes, plan) {
  const fdIn = fs.openSync(rawIn, 'r');
  const fdOut = fs.openSync(rawOut, 'w');
  const a = Buffer.alloc(frameBytes), b = Buffer.alloc(frameBytes), o = Buffer.alloc(frameBytes);
  for (const [ia, ib, w] of plan) {
    readFrame(fdIn, ia, frameBytes, a);
    if (w <= 0.0005 || ia === ib) { fs.writeSync(fdOut, a); continue; }
    readFrame(fdIn, ib, frameBytes, b);
    blendInto(o, a, b, w);
    fs.writeSync(fdOut, o);
  }
  fs.closeSync(fdIn); fs.closeSync(fdOut);
}

function encode(rawPath, inSize, outSize, dest, crf, preset) {
  const [iw, ih] = inSize, [ow, oh] = outSize;
  const vf = [
    (iw !== ow || ih !== oh) ? `scale=${ow}:${oh}:flags=lanczos` : null,
    'scale=out_color_matrix=bt709:out_range=tv',
    'format=yuv420p',
    'setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv',
  ].filter(Boolean).join(',');
  ff(['-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${iw}x${ih}`, '-framerate', `${FPS_NUM}/${FPS_DEN}`, '-i', rawPath,
    '-vf', vf, '-c:v', 'libx264', '-profile:v', 'high', '-preset', preset, '-crf', String(crf),
    '-x264-params', 'aq-mode=3:keyint=120:min-keyint=24', '-pix_fmt', 'yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-movflags', '+faststart', '-an', '-y', dest]);
  return fs.statSync(dest).size;
}

// Lowest CRF (best quality) whose veryslow encode fits the budget, by binary search.
function encodeToBudget(rawPath, inSize, outSize, dest, budget) {
  let lo = 16, hi = 42, best = null;
  const tmp = dest + '.search.mp4';
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const size = encode(rawPath, inSize, outSize, tmp, mid, 'veryslow');
    if (size <= budget) { best = { crf: mid, size }; fs.copyFileSync(tmp, dest); hi = mid - 1; } else lo = mid + 1;
  }
  fs.rmSync(tmp, { force: true });
  if (!best) throw new Error(`no CRF up to 42 fits ${budget} bytes for ${dest}`);
  return best;
}

async function posterFromRaw(rawPath, frameBytes, size, name, widths) {
  const [w, h] = size;
  const fd = fs.openSync(rawPath, 'r');
  const buf = readFrame(fd, 0, frameBytes, Buffer.alloc(frameBytes));
  fs.closeSync(fd);
  const img = () => sharp(buf, { raw: { width: w, height: h, channels: 3 } });
  const files = { webp: {}, avif: {} };
  for (const pw of widths) {
    const wf = `${name}-${pw}.webp`, af = `${name}-${pw}.avif`;
    await img().resize({ width: pw, kernel: 'lanczos3' }).webp({ quality: 74, effort: 6, smartSubsample: true }).toFile(path.join(VID_OUT, wf));
    files.webp[pw] = `/assets/media/${wf}`;
    const ab = await img().resize({ width: pw, kernel: 'lanczos3' }).avif({ quality: 50, effort: 6 }).toBuffer();
    if (ab.length < fs.statSync(path.join(VID_OUT, wf)).size) { await fsp.writeFile(path.join(VID_OUT, af), ab); files.avif[pw] = `/assets/media/${af}`; }
    else fs.rmSync(path.join(VID_OUT, af), { force: true });
  }
  return files;
}

async function runVideos() {
  await fsp.mkdir(VID_OUT, { recursive: true });
  const dir = path.join(SCRATCH, 'video');
  await fsp.mkdir(dir, { recursive: true });
  const report = [];
  for (const v of pick(VIDEOS)) {
    const { sourceFrames, plan } = loopPlan(v);
    const dur = plan.length / FPS;
    const src = path.join(...v.src);
    const variants = [{ key: 'landscape', crop: v.crop, size: [1920, 1080], outs: [['1080', [1920, 1080], 450000], ['720', [1280, 720], 180000]] }];
    if (v.portrait) variants.push({ key: 'portrait', crop: v.portrait.crop, size: v.portrait.size, outs: [['portrait-720', v.portrait.size, 200000]] });
    for (const va of variants) {
      const rawIn = path.join(dir, `${v.name}-${va.key}-src.rgb`);
      const rawOut = path.join(dir, `${v.name}-${va.key}-loop.rgb`);
      log(`video ${v.name} ${va.key}: extracting ${sourceFrames} frames from ${v.src[1]} @ ${v.start}s`);
      const frameBytes = extractFrames({ src, start: v.start, count: sourceFrames, crop: va.crop, size: va.size, grade: v.grade, rawPath: rawIn });
      renderLoop(rawIn, rawOut, frameBytes, plan);
      fs.rmSync(rawIn, { force: true });
      for (const [suffix, outSize, perSecond] of va.outs) {
        const dest = path.join(VID_OUT, `${v.name}-${suffix}.mp4`);
        const budget = Math.floor(perSecond * dur);
        const r = encodeToBudget(rawOut, va.size, outSize, dest, budget);
        log(`  ${path.basename(dest)}: crf ${r.crf}, ${(r.size / 1e6).toFixed(2)} MB (budget ${(budget / 1e6).toFixed(2)} MB), ${dur.toFixed(2)} s`);
        report.push({ file: path.basename(dest), crf: r.crf, bytes: r.size, seconds: +dur.toFixed(3) });
      }
      if (va.key === 'landscape') await posterFromRaw(rawOut, frameBytes, va.size, `${v.name}-poster`, [1920, 960]);
      else await posterFromRaw(rawOut, frameBytes, va.size, `${v.name}-portrait-poster`, [va.size[0]]);
      fs.rmSync(rawOut, { force: true });
    }
  }
  await fsp.writeFile(path.join(SCRATCH, 'video-report.json'), JSON.stringify(report, null, 2));
}

// ---------- manifest ----------
function listFiles(dir, prefix) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.startsWith(prefix));
}

function imageFilesFor(name) {
  const files = { webp: {}, avif: {} };
  const re = new RegExp(`^${name}-(\\d+)\\.(webp|avif)$`);
  for (const f of fs.readdirSync(IMG_OUT)) {
    const m = f.match(re);
    if (m) files[m[2]][m[1]] = `/assets/images/${f}`;
  }
  return files;
}

function mp4Duration(file) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-i', file], { encoding: 'utf8' });
  const m = (r.stderr || '').match(/Duration: (\d+):(\d+):([\d.]+)/);
  return m ? +(Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])).toFixed(2) : null;
}

async function runManifest() {
  const out = [];
  const photoEntry = async (p, source) => {
    const files = imageFilesFor(p.name);
    const widths = Object.keys(files.webp).map(Number).filter(w => w !== THUMB);
    if (!widths.length) return null;
    const largest = Math.max(...widths);
    const meta = await sharp(path.join(IMG_OUT, `${p.name}-${largest}.webp`)).metadata();
    return {
      name: p.name, kind: 'photo', source,
      files: { thumb: files.webp[THUMB], webp: Object.fromEntries(Object.entries(files.webp).filter(([w]) => +w !== THUMB)), avif: files.avif },
      widths: widths.sort((a, b) => a - b), width: meta.width, height: meta.height,
      orientation: meta.height > meta.width * 1.05 ? 'portrait' : (meta.width > meta.height * 1.05 ? 'landscape' : 'square'),
      caption: p.caption, alt: p.alt, subject: p.subject, tone: p.tone, focal: p.focal, uses: p.uses,
    };
  };
  for (const p of PHOTOS.filter(x => !x.skip)) { const e = await photoEntry(p, 'company-photo'); if (e) out.push(e); }
  for (const s of STILLS) { const e = await photoEntry(s, 'footage-still'); if (e) out.push(e); }
  for (const v of VIDEOS) {
    const f = n => fs.existsSync(path.join(VID_OUT, n)) ? `/assets/media/${n}` : undefined;
    const d1080 = path.join(VID_OUT, `${v.name}-1080.mp4`);
    if (!fs.existsSync(d1080)) continue;
    const poster = { webp: {}, avif: {} };
    for (const w of [1920, 960]) { if (f(`${v.name}-poster-${w}.webp`)) poster.webp[w] = f(`${v.name}-poster-${w}.webp`); if (f(`${v.name}-poster-${w}.avif`)) poster.avif[w] = f(`${v.name}-poster-${w}.avif`); }
    const entry = {
      name: v.name, kind: 'video', source: 'drone-footage',
      files: { mp4: { 1080: f(`${v.name}-1080.mp4`), 720: f(`${v.name}-720.mp4`) }, poster },
      width: 1920, height: 1080, duration: mp4Duration(d1080), loop: v.mode === 'pingpong' ? 'eased forward and back sweep' : 'crossfade tail into head',
      bytes: { 1080: fs.statSync(d1080).size, 720: fs.statSync(path.join(VID_OUT, `${v.name}-720.mp4`)).size },
      caption: v.caption, alt: v.alt, subject: v.subject, tone: v.tone, focal: v.focal, uses: v.uses,
    };
    if (v.portrait && f(`${v.name}-portrait-720.mp4`)) {
      const [pw, ph] = v.portrait.size;
      entry.files.portrait = {
        mp4: f(`${v.name}-portrait-720.mp4`),
        poster: { webp: { [pw]: f(`${v.name}-portrait-poster-${pw}.webp`) }, avif: f(`${v.name}-portrait-poster-${pw}.avif`) ? { [pw]: f(`${v.name}-portrait-poster-${pw}.avif`) } : {} },
        width: pw, height: ph, focal: v.portraitFocal,
      };
      entry.bytes.portrait = fs.statSync(path.join(VID_OUT, `${v.name}-portrait-720.mp4`)).size;
    }
    out.push(entry);
  }
  await fsp.writeFile(MANIFEST, JSON.stringify(out, null, 2) + '\n');
  log(`manifest: ${out.length} entries -> ${path.relative(ROOT, MANIFEST)}`);
}

if (stage === 'photos' || stage === 'all') await runPhotos();
if (stage === 'stills' || stage === 'all') await runStills();
if (stage === 'videos' || stage === 'all') await runVideos();
if (stage === 'manifest' || stage === 'all' || stage === 'photos' || stage === 'stills' || stage === 'videos') await runManifest();
