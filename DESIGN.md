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
  `pagekit.mjs` helpers for the company and editorial pages: `processSteps(ctx, audience)`, the
  full-bleed `mediaHero`, the compact `pageHead`, guide cards and reading time.
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
  warm white. Stacks to two lines under 760px; the bulb shrinks under 390px and steps aside under
  360px, so the name itself stays on every screen.
- **Header** `header.site-header`: transparent over heroes, solid `rgba(6,9,17,.96)` after 24px of
  scroll. Never uses backdrop-filter (it would re-blur playing video every frame). Phone link
  `data-contact="phone" data-placement="header"` shows the number from 761px up and an icon with an
  accessible name below (the sticky bar carries the number on phones). The "Free estimate" button
  (`data-cta="estimate" data-placement="header"`) shows on one line at every width. The controls always
  end at the right gutter. Main nav collapses into the menu below 1200px. "Commercial" opens the four
  commercial property types on hover or keyboard focus, and the phone menu lists them under Commercial.
  The phone menu fills the screen below the header and the page behind it does not scroll.
  On `/thank-you/` the header shows the number and no estimate button, and there is no sticky bar.
- **Buttons**: `.btn-glow` (primary, lit amber gradient), `.btn-line` (secondary on night),
  `.btn-night` (primary inside the ivory card), `.btn-quiet` (Back). Heights 44, 52, 58px.
- **Quote card** `form[data-quote]` (`scripts/lib/form.mjs`): ivory "lit window". Steps are
  `[data-step]` fieldsets; the active one carries `[data-step-active]`. Three steps (what, where, you)
  by default, two steps (what plus property type, then contact) when the city is known. Presets:
  `lights`, `property`, `city`, and from the page URL (`?property=hoa&lights=roofline,trees`, see the
  README). The context tag updates live: a map pin with "Home in Fenton, MI" when the place is known,
  a house icon with "For a home" when it is not. Nine light chips, including "Poles and lampposts".
  Honeypot `botcheck`, status region `[role="status"]`, inline messages under invalid fields linked
  with `aria-describedby` (a short phone number asks for the area code), strong focus ring (2px ink
  outline plus amber halo). Enter in a field before the last step moves to the next step. A new step
  that opens under the fixed header scrolls the card head back into view. On phones up to 480px the
  step bulbs sit beside the title and the chips are compact, so a landing page's first choices land on
  the first screen. The card switches on through its glow only; its content is never faded.
- **Preset triggers**: any element with `data-preset-property` and/or `data-preset-light` fills the
  page's primary form (`#estimate`), scrolls to it and pulses it. Used by the property path cards,
  switcher buttons and the commercial band.
- **Mobile bar** `div.mobile-bar`: the phone number itself plus Free estimate, phones only. From 320
  to 350px the call button takes a little more of the bar and the number sets at 14px, so it keeps
  about 8px of room inside its button. It gets
  `is-hidden` while a quote form's controls (its step fieldsets and buttons, not the card's footer) or
  any hero action row (`[data-bar-hide]`, on every page with hero buttons) are on screen.
- **Planning for** row (`planRow()`, commercial service page and commercial local pages): property-type
  pills that preset the card, kept in step with it, plus text links to the four commercial pages.
- **Related guide** card (`relatedGuide()`): beside the questions on service, vertical and local pages.
  `/landscape-lighting/` has none, since no guide covers landscape lighting yet.
- **Light strings** (`roofline.mjs`): one wire path, one path for all unlit bulbs, one `<use>` per lit
  bulb, one shared SVG glow filter. Shapes: `hero` (eave, gable, dormer, corner with a downspout drop),
  `eave` (residential), `outline` (commercial parapet, bare wire on the short vertical steps so no
  bulb turns sideways), `track` (permanent pixels), `scene` (runs edge to edge of its stage, so no
  string ends in mid-air).
- **Scene switcher** (permanent lighting): the C9 roofline recolored by preset (Warm white, Christmas,
  Game day, Fourth of July, Halloween) with a chase. Always labeled as an illustration.
- **What we light switcher**: tabs with a progress bar in the active pill, 6.5s loop that pauses on
  hover, focus, its own button and reduced motion. Inactive panels are `inert`. Without JS all panels
  stack. The Rooflines panel shows the 900px house photo at its own proportions (`layout: 'native'`),
  no more than 560px wide on a soft warm glow, instead of enlarging it. Up to 560px the four tabs sit two by two and the pause button rides on the
  photo's corner.
- **Season string**: five stations on a draped wire; bulbs light up to today, "We are here" and "Now"
  tags come from the visitor's date. No countdowns, no deadlines.
- **FAQ**: `<details>` with the first item open, height transition via `::details-content`, FAQPage
  JSON-LD from the same array.
- **Breadcrumbs**: visible trail plus BreadcrumbList JSON-LD (from the page's `crumbs`).
- **County pills**: all 25 communities by county; used on home, service pages and the footer.

## Motion rules

- The hero string: long eave, main gable, dormer, then the eave runs on toward the right edge and fades
  out (a mask fades both ends), sitting about 20px above the eyebrow.
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
- Warm white first. Hero and hero-adjacent slots carry warm white or neutral daylight work only; the
  red and white birch, the multicolor and red and green canopies and the green HOA and spruce shots sit
  lower, each paired with a warm photo, never a section of color alone.
- **The 1x rule**: a framed photo never displays past its own pixels, at any viewport. Every frame
  that holds one of our photos (`figure()`, hero frames, local and guide figures, cards) carries the
  class `fit1x` and, from `media.fit(name)`, its largest source size (`--pw`, `--ph`) and its own
  proportions (`--pr`). A slot sets its crop as `--crop` (width over height, which is also the
  picture's aspect ratio; `--crop:initial` for a slot with a set height). `.fit1x` then stops the
  frame at the widest size the source fills at that crop and centers it in a wider slot, so a tall
  crop of a wide photo stops sooner. Set crops through `--crop`, never `aspect-ratio` on the picture.
  Full-bleed backdrops under a scrim (closings, bleed and page heroes, the contact and FAQ grounds) are
  not frames and are not capped. Where the cap would leave a photo small in a single column, the
  layout pairs it instead: the permanent local photo beside the estimate checklist (761 to 980px), the
  guides feature photo beside its text (from 761px), the our-work Homes squares three across.
- The residential photos are 960px wide or less. Never stretch one across a column: in heroes they
  appear as one of a pair (`heroFrame` gives a landscape photo the wider slot and both one height), in
  the switcher at their own proportions. The 900px house stays at 560px or less in the switcher and
  the our-work Homes chapter; elsewhere the 1x rule caps it. A panorama wider than 2.5:1 (the
  pavilion) keeps its own proportions in every composition: paired on a service page it shares one
  height with its partner in a strip (`composition()`), alone it fills the HOA page hero frame, and
  the home HOA card shows it whole at the foot of its frame on the black of its own night sky
  (`.path-native`), so the four card frames still line up. Tall portrait crops stop at 4:5, and a photo whose subject
  fills only part of it carries its own crop in media.json (`frame`, with a raised `focal`; the
  evergreens photo is shown square because its lower third is dark gravel).
- Under a local H1 (landing pages, hubs, their closing sections) use only photos whose captions name no
  place; "Northern Michigan" footage belongs on brand pages (home, our work, commercial verticals) and
  on some commercial landing heroes, where the caption rides on the footage itself.
- A photo that stands in for work we have no photos of yet carries an honest tag before its caption
  ("Seasonal work" on the permanent pages and on `/landscape-lighting/`, in the hero, the local section
  and the closing, via `closing({ label })`). Their closings use our own warm white work, never the
  Northern Michigan footage. Holiday footage stays off the landscape page.
- Share cards (`og:image`): brand pages use the Northern Michigan footage cards, and their alt text
  names the region. The 100 local pages and the permanent and landscape pages use cards cut from our
  own photos whose captions name no place (`OG_CARDS` in `build.mjs`: the lit house for residential,
  hubs and permanent, the lit office trees for commercial and landscape), with the photo's alt text,
  prefixed "Seasonal holiday work:" on permanent and landscape pages. Every card (guides too) is the
  largest 1200:630 crop its source holds, 1200x630 at most and never enlarged: the 900px house makes a
  796x418 card. `og:image:width` and `og:image:height` carry each card's real size, and `npm run check`
  fails if they differ from the file.
- Text over footage needs 4.5:1 (3:1 for large type) against the brightest 5% of the pixels behind
  it; scrims are tuned for that. On phones the home hero text sits on a near-solid scrim below the
  gable.
- Local pages rotate photo variants with a neighbor-aware coloring (`content.colorOf`), so adjacent
  communities do not get the same page.

## Page recipes

- **Home**: hero (footage, roofline, H1, CTAs, "Every estimate spells out"; on portrait tablets the
  phone layout, on landscape tablets a deeper scrim, so text never sits on the lit tree), lit statement,
  property path cards (preset the form, link to vertical pages; stacked cards four across from 1241px
  and two by two from 761px, sharing three subgrid rows (photo, text, actions) so photos, titles and
  buttons line up at every width; the button and its text link always stack; each card's own column
  is `minmax(0,1fr)`, so a long button label never widens a card or enlarges its photo; each has its
  own photo and line, the HOA card the whole pavilion panorama), What we light, season string, commercial band with a frame-crossing section
  headline (the H1 version lives only on the downtowns page), permanent lighting scenes, crew composition (copy beside the bucket photo, then the wide
  night office beside an offset daylight gable) with the four reasons, service-area county pills,
  closing (next steps, big phone, form).
- **Service page** (6): split hero with the literal H1 and the form beside it (after the H1 on
  phones) and service media (photo, pair, footage or the scene switcher), "One company, start to
  finish" with the scope card, our own photos, considerations, process, FAQ, local page links (or the
  service area for services without local pages), closing form.
- **Local landing** (75, `/<service>/<city>/`): split hero with the city H1, county eyebrow, service
  string, a call line ("Call (248) 756-8915") that shows on phones too, a warm photo pair (residential,
  four variants), full-bleed footage or a still of our own work (commercial, four variants, plus the
  "Planning for" row) or the scene switcher (permanent), two-step form preset to the city with smart
  defaults (Home plus Roofline, Business, Home plus Permanent lighting), proof row and checks; local
  paragraph with a photo composition (permanent: a "Seasonal work" photo beside the estimate
  checklist); considerations; included scope with a CTA row and a short process; "Before you book" FAQ
  (3 city questions plus 2 service questions on topics the city questions do not already cover,
  FAQPage schema) with the related guide; nearby communities in both directions with descriptive
  anchors, the same city's other services; closing form over a photo without a place name. Service
  schema with areaServed. On phones the crumbs, the hero caption and the decorative string step aside,
  and a footage caption rides on the footage.
- **City hub** (25) and `/service-area/`: split hero with the hub intro, a photo pair of a home and
  commercial work (five variants, captions without place names) and the form, local context beside a
  captioned photo (a different frame from the hero), links to the three local pages, nearby communities
  in both directions, a closing line for that city ("Get on the Fenton schedule"). The directory
  groups every community by county.
- **Commercial verticals** (4, `/commercial/<slug>/`, `pages/verticals.mjs`): split hero with the literal
  H1 and the form preset to the property type plus the first scope chip (Downtown or municipality plus
  Trees and shrubs, HOA or subdivision plus Entrance or sign, Business plus Building outline, Business
  plus Entrance or sign); "One company, start to finish" with the scope card; what we plan for (the
  three needs); our own photos; the commercial process; "Before you book" FAQ with FAQPage schema; the
  other property types; commercial local links; closing form with the same presets.
  **Downtowns** carries the site's one frame-crossing H1 (c2): the downtown-wraps footage sits in a
  wide film frame (`.xf-frame`, 2.1:1, 4:3 on phones) and the H1 overlaps its lower edge by two lines
  (`margin-top:-1.94em`), so it starts on the footage and ends on the night. Its needs cards overlap
  the town-aerial footage band. Do not repeat the frame-crossing H1 anywhere else.
- **Our work** (`pages/work.mjs`): footage hero, then one chapter per `our_work` section, each a
  bespoke captioned composition (placements in `.wk-<subject> .wk-<slot>`), a preset button for the
  closing form and a link to the matching page. No filters, no expand icons, no lightbox, no grid.
  Every chapter leads with warm white work: Entrances and grounds opens on the pavilion roofline and
  the lit office grounds, with the green entrance smaller beside them.
- **About**: photo hero, the first story paragraph as the lit statement, the rest beside crew photos,
  the single Ace Outdoor Services family line (from the copy), values cards, what we light, closing form.
- **Process**: split hero with the form beside a warm-white photo pair, the five steps on a vertical
  string (numbers light as each step arrives) with photos and the estimate checklist, the season
  string, practical questions, closing form.
- **FAQ**: every question grouped under short labels (groups match the opening words of each
  question, and the build fails if one is dropped), FAQPage schema, topic pills, the form sticky
  beside the list on desktop and after it on phones, then the guides.
- **Contact**: the form first (beside the H1, right after it on phones), the big phone, what happens
  next, the service area pills and four questions. No street address.
- **Guides** hub (feature card plus three) and **guide** articles: head with the photo (or, for
  permanent lighting, the labeled scene illustration), contents rail, 680px reading measure at 18px,
  an in-text call to action from the related service, a sticky related service card, Article schema,
  more guides and a closing form preset to the related service.
- **Privacy**: written from the build settings. The form paragraph follows `WEB3FORMS_KEY`, the tag
  paragraph follows `GTM_ID`, and the `apx_attr` attribution cookie is described only when
  `APEX_FORM_TOKEN` is set. The delivery sentence names both Holiday Light Service and Modern Apex
  Strategies, so it stays true whether the form key delivers to the agency inbox (which passes
  requests on) or to the company office. No form; it closes with a call and estimate strip.
- **Landscape lighting** (`/landscape-lighting/`): no holiday wording in the shared parts. Its proof
  row reads "Free estimates for homes and businesses" instead of the bucket trucks (`PROOF_LANDSCAPE`),
  its closing lists `contact.next_steps_landscape` ("We plan the lighting"), and its questions link
  reads "All lighting questions".
- **Process copy by audience**: residential pages use `processSteps(ctx, 'residential')`, which drops
  sentences about commercial projects; commercial pages and `/process/` keep the full copy. Permanent and
  landscape pages use `'permanent'` and `'landscape'`: the residential copy with a last step about setup
  and support instead of takedown (those lights stay up), and a service-neutral intro
  (`processIntro`). Landscape also swaps the roof and bucket-truck installation step for its own
  (`process.year_round.installation.landscape`). `audienceFor(slug)` picks the audience.
- **Closings**: each page family has its own closing line (`closing` in site-copy for about, process,
  our work, the guides hub and the service area; `service_area.hub_closing` for hubs).
- **Thank-you** (noindex, no events of its own): the phone instead of another estimate, what happens
  next, and a recap of the request's choices from sessionStorage (never name, phone or email).
  **404**.
- **Guides**: Article markup with `datePublished` and `dateModified` from site-copy, `og:type`
  article and a 1200x630 card cropped from each guide's photo (`dist/assets/og/guide-<slug>.jpg`).
