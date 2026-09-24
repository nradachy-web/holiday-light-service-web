# Holiday Light Service: design system and page recipes

For anyone editing this site. The visual base is concept c1 "Lights On" with the judge panel grafts
(see `research/design-decisions.md`). Facts and forbidden claims live in `research/BRIEF.md`; read it
before writing a word of copy. All copy comes from `content/site-copy.json` and `content/cities/*.json`.

Hard rules that the build and checks enforce:

- No en or em dashes anywhere (copy, HTML, CSS, JS, comments, alt text). The build fails on them.
- One `<h1>` per page. The build fails otherwise.
- Nothing is hidden at rest. With JavaScript off or reduced motion on, every element is visible and
  the form shows all of its steps. `html.js` and `html.motion` only add pre-animation states.
- Photos only at widths listed in `content/media.json`. The build fails if a referenced file is missing.
- Footer credit, exact text: "Website & marketing by Modern Apex Strategies", linked to
  https://modernapexstrategies.com.

## Build

```
npm run build                     # dist/ for GitHub Pages at /holiday-light-service-web
BASE_PATH="" npm run build        # local preview at the server root
python3 -m http.server 4188 --directory dist
```

| Env | Default | Effect |
|---|---|---|
| `BASE_PATH` | `/holiday-light-service-web` | Prefix for every internal URL. Empty for the real domain. |
| `SITE_ORIGIN` | `https://nradachy-web.github.io` | Canonical, Open Graph and sitemap origin. |
| `INDEXABLE` | unset | `true` drops `noindex` (thank-you and 404 stay noindex). |
| `WEB3FORMS_KEY` | unset | Forms post to Web3Forms (fetch with JS, normal POST plus redirect without). Unset means a preview form that sends nothing. |
| `GTM_ID` | unset | Loads Google Tag Manager. |
| `APEX_FORM_TOKEN` | unset | Adds `/assets/js/apex-attribution.js` with `data-token`; the form calls `apexAttribution.attach()` after a confirmed submit. |

Code map:

- `scripts/build.mjs` entry. Loads content, discovers page modules, renders, writes `dist/`,
  `sitemap.xml`, `robots.txt`, `route-manifest.json` and the Open Graph images.
- `scripts/lib/pages/*.mjs` one module per page family. Each default export takes the build context
  and returns page objects `{ path, title, description, body(ctx, page), type, crumbs, schemas,
  estimateHref, noindex, listed, file }`. To add pages (about, our work, verticals, guides), drop a new
  module in this folder; it is picked up automatically. Duplicate paths fail the build.
- `scripts/lib/shell.mjs` head, JSON-LD graph (LocalBusiness, BreadcrumbList, page schemas), header,
  footer and mobile bar. `layout.mjs` header, footer, phone links. `form.mjs` the quote form.
  `blocks.mjs` FAQ, breadcrumbs, county pills, switcher, season string, scene switcher, statement.
  `heroes.mjs` home hero and split hero. `sections.mjs` closing block and photo compositions.
  `media.mjs` photo and video helpers. `roofline.mjs` light strings. `icons.mjs` sprite and wordmark.
- `public/assets/css/site.css` the only stylesheet. `public/assets/js/site.js` the only script.
- `scripts/lib/subset-fonts.py` regenerates the font subsets; `scripts/lib/make-icons.mjs` the favicons.

## Tokens

| Token | Value | Use |
|---|---|---|
| `--night` | `#05070d` | Page ground |
| `--night-1` / `--night-2` / `--night-3` | `#080b15` / `#0c111e` / `#121a2b` | Alternating sections, cards |
| `--line` / `--line-2` | `rgba(190,206,240,.13)` / `.24` | Hairlines, card borders |
| `--fg` / `--fg-2` / `--fg-3` | `#f6f3ee` / `#d0d4dd` / `#a3abbb` | Headings / body / captions |
| `--glow` | `#ffd18a` | The only accent: warm white bulb glow |
| `--glow-hi` / `--glow-deep` / `--glow-ink` | `#fff0d4` / `#f0ad55` / `#1d1406` | Bulb highlight, deep amber, text on glow |
| `--ivory` | `#fffaf3` | Quote card, the brightest object on the page |
| `--ink` / `--ink-2` / `--ink-3` | `#16120b` / `#574e41` / `#6b5f4e` | Text on ivory |
| `--r` / `--r-sm` | `6px` / `4px` | Radii. Pills are fully round. |

No red and green in the brand palette. Color only appears in real photos and in the permanent
lighting scene presets.

## Type

Inter Tight (display) and Inter (body), self-hosted as Basic Latin subsets with the weight axis kept
(`public/assets/fonts/*-subset.woff2`, about 19 KB and 18 KB). Only Inter Tight is preloaded. Both use
`font-display: swap` with size-adjusted Arial fallback faces ("Inter Tight Fallback", "Inter Fallback")
so the swap does not shift layout.

| Role | Size | Line height | Tracking | Weight |
|---|---|---|---|---|
| Home H1 | clamp(44px, 4.75vw, 74px); phones 34 to 44px | .99 | -.04em | 600 |
| Page H1 (split hero) | clamp(38px, 4vw, 62px); phones 32 to 42px | 1 | -.04em | 600 |
| H2 | clamp(34px, 3.8vw, 56px) | 1.03 | -.034em | 600 |
| Quiet H2 (section labels) | clamp(26px, 2.3vw, 34px) | 1.1 | -.028em | 600 |
| Statement | clamp(28px, 3.1vw, 46px) | 1.2 | -.028em | 500 |
| H3 | 21px | 1.22 | -.016em | 600 |
| Lead | clamp(18px, 1.45vw, 21px) | 1.6 | | 400 |
| Body | 17px | 1.65 | | 400 |
| Captions, small UI | 13.5 to 15px; never under 12.5px | | | |
| Eyebrow | 13px uppercase, .16em, glow color, with a lit dot | | | 600 |

## Components

- **Wordmark**: a C9 bulb hanging from a draped wire, "Holiday Light" at 650 and "Service" at 350,
  warm white. Stacks to two lines under 760px; text hides under 340px (the link keeps its name).
- **Header** `header.site-header`: transparent over heroes, solid `rgba(6,9,17,.96)` after 24px of
  scroll. Never uses backdrop-filter (it would re-blur playing video every frame). Phone link
  `data-contact="phone" data-placement="header"` shows the number from 761px up and an icon with an
  accessible name below. The "Free estimate" button (`data-cta="estimate" data-placement="header"`)
  shows at every width. Main nav collapses into the menu below 1120px.
- **Buttons**: `.btn-glow` (primary, lit amber gradient), `.btn-line` (secondary on night),
  `.btn-night` (primary inside the ivory card), `.btn-quiet` (Back). Heights 44, 52, 58px.
- **Quote card** `form[data-quote]` (`scripts/lib/form.mjs`): ivory "lit window". Steps are
  `[data-step]` fieldsets; the active one carries `[data-step-active]`. Three steps (what, where, you)
  by default, two steps (what plus property type, then contact) when the city is known. Presets:
  `lights`, `property`, `city`. The context tag ("Home in Fenton, MI") updates live. Honeypot
  `botcheck`, status region `[role="status"]`, strong focus ring (2px ink outline plus amber halo).
  The card switches on through its glow only; its content is never faded.
- **Preset triggers**: any element with `data-preset-property` and/or `data-preset-light` fills the
  page's primary form (`#estimate`), scrolls to it and pulses it. Used by the property path cards,
  switcher buttons and the commercial band.
- **Mobile bar** `div.mobile-bar`: Call plus Get my free estimate, phones only, gets `is-hidden` while
  any quote form (or the home hero CTAs, `[data-bar-hide]`) is on screen.
- **Light strings** (`roofline.mjs`): one wire path, one path for all unlit bulbs, one `<use>` per lit
  bulb, one shared SVG glow filter. Shapes: `hero` (eave, gable, dormer, corner with a downspout drop),
  `eave` (residential), `outline` (commercial parapet, bare wire on the short vertical steps so no
  bulb turns sideways), `track` (permanent pixels), `scene` (runs edge to edge of its stage, so no
  string ends in mid-air).
- **Scene switcher** (permanent lighting): the C9 roofline recolored by preset (Warm white, Christmas,
  Game day, Fourth of July, Halloween) with a chase. Always labeled as an illustration.
- **What we light switcher**: tabs with a progress bar in the active pill, 6.5s loop that pauses on
  hover, focus, its own button and reduced motion. Inactive panels are `inert`. Without JS all panels
  stack.
- **Season string**: five stations on a draped wire; bulbs light up to today, "We are here" and "Now"
  tags come from the visitor's date. No countdowns, no deadlines.
- **FAQ**: `<details>` with the first item open, height transition via `::details-content`, FAQPage
  JSON-LD from the same array.
- **Breadcrumbs**: visible trail plus BreadcrumbList JSON-LD (from the page's `crumbs`).
- **County pills**: all 25 communities by county; used on home, service pages and the footer.

## Motion rules

- One orchestrated load moment, pure CSS under `html.motion` so it never waits for `site.js`:
  strings draw and bulbs flicker on from about 90ms to 1.3s; the H1 rises word by word from 100 to
  160ms (32ms stagger) and is fully set by about 0.9s; sub and CTAs land by 0.6 to 0.7s; the hero
  lifts from a .55 dim; the wordmark bulb lights at 1.3s; everything settles by about 2.2s.
- Reveals: `[data-reveal]` blocks below the fold fade up once as they enter. JS adds the hidden state
  only to blocks that start below the fold.
- Videos (`video[data-bg-video]`): no autoplay attribute. First-screen videos start after load, idle
  and about 1.8s; others start after the first scroll or tap. Never on reduced motion, Save-Data or
  2g/3g. 720p unless the viewport is at least 1920px wide; the portrait loop only on portrait screens
  (encoded at 540x960, about 650 KB, with a 720x1280 poster).
  Each has a Pause/Play button. The video fades in with a warm-up (brightness, saturation and blur
  settle with a slight flicker). The video box sits 1px inside its poster and full-bleed media stops
  1px short of the right edge, so the poster, not a later video frame, is the LCP.
- Reduced motion: every animation and transition resolves to its final state.

## Photo rules

- Only our own photos and footage, captioned from `content/media.json`. No gallery grid, no lightbox,
  no expand icons. Northern Michigan footage keeps "Northern Michigan" and never names a town.
- Warm white first. Keep the red and white birch, the red and green canopy and the green HOA shots
  out of hero and first-tab slots.
- Text over footage needs 4.5:1 (3:1 for large type) against the brightest 5% of the pixels behind
  it; scrims are tuned for that. On phones the home hero text sits on a near-solid scrim below the
  gable.
- Local pages rotate photo variants with a neighbor-aware coloring (`content.colorOf`), so adjacent
  communities do not get the same page.

## Page recipes

- **Home**: hero (footage, roofline, H1, CTAs, "Every estimate spells out"), lit statement, property
  path cards (preset the form, link to vertical pages; the four cards share subgrid rows so titles and
  buttons line up), What we light, season string, commercial band with the site's one frame-crossing
  headline, permanent lighting scenes, crew composition (copy beside the bucket photo, then the wide
  night office beside an offset daylight gable) with the four reasons, service-area county pills,
  closing (next steps, big phone, form).
- **Service page** (6): split hero with the literal H1 and the form beside it (after the H1 on
  phones) and service media (photo, pair, footage or the scene switcher), "One company, start to
  finish" with the scope card, our own photos, considerations, process, FAQ, local page links (or the
  service area for services without local pages), closing form.
- **Local landing** (75, `/<service>/<city>/`): split hero with the city H1, county eyebrow, service
  string, sharp photo (residential), full-bleed downtown footage (commercial) or scene switcher
  (permanent), two-step form preset to the city with smart defaults (Home plus Roofline, Business,
  Home plus Permanent lighting), proof row and checks; local paragraph with a photo composition;
  considerations; included scope with a CTA row and a short process; "Before you book" FAQ (3 city plus 2 service
  questions, FAQPage schema); nearby communities; closing form. Service schema with areaServed.
- **City hub** (25) and `/service-area/`: split hero with the hub intro and form, local context
  beside a captioned photo (a different frame from the hero, captions without place names), links to
  the three local pages, nearby communities, closing form preset to the city. The directory groups
  every community by county.
- **Thank-you** (noindex, no events of its own) and **404**.
