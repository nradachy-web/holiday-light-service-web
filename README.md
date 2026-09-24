# Holiday Light Service website

Static site for **holidaylightservicemi.com**, the Southeast Michigan holiday lighting company. A Node build script turns `content/*.json` and the prepared media in `public/assets/` into plain HTML, CSS and JavaScript in `dist/`. There is no framework runtime. GitHub Actions deploys `dist/` to GitHub Pages.

Facts, forbidden claims, the URL plan and the design bar live in `research/BRIEF.md` and `research/design-decisions.md`. Read both before changing copy or templates.

## Requirements

- Node 22. On the Modern Apex Mac, run `export PATH=~/.local/bin:$PATH` first.
- `npm ci` to install the pinned dev dependencies.
- Google Chrome installed. The browser tests and Lighthouse use real Chrome (Playwright channel `chrome`) so the H.264 background video actually plays.

## Commands

| Command | What it does |
| --- | --- |
| `npm run build` | Generates `dist/` from `content/` and `public/` |
| `npm run check` | Static gate over every page in `dist/` (seconds, no browser). Runs in CI before every deploy |
| `npm test` | Browser gate in Chrome: representative pages at 1440, 390 and 320 wide, reduced motion, JavaScript off, video, form flows |
| `npm run lighthouse` | Lighthouse mobile for home, one local page and one service page |
| `npm run preview` | Serves `dist/` with the base path at http://127.0.0.1:4188/holiday-light-service-web/ |
| `npm run live-check` | After a deploy: every route in `dist/route-manifest.json` must answer 200 at the live URL, and the live site must load the same `site.js` version as `dist/` (so an old deploy is caught before anyone sees dead links). Pass another origin as `npm run live-check -- https://holidaylightservicemi.com` |

`npm run serve` (Python) serves `dist/` at the root, so it only works for a build made with `BASE_PATH=` (empty). Use `npm run preview` otherwise.

## Build settings

Every script reads the same environment variables. Pass the same values to `build`, `check` and `test`.

| Variable | Default | Meaning |
| --- | --- | --- |
| `BASE_PATH` | `/holiday-light-service-web` | Path prefix for every URL. Empty at launch (custom domain at the root) |
| `SITE_ORIGIN` | `https://nradachy-web.github.io` | Origin for canonical URLs, the sitemap and the form redirect |
| `INDEXABLE` | unset (false) | `true` removes `noindex`. Otherwise every page carries `<meta name="robots" content="noindex,follow">`. `/thank-you/` is always noindex |
| `WEB3FORMS_KEY` | unset | When set, the estimate form posts to Web3Forms (fetch with JavaScript, plain POST with a redirect without it). When unset, submitting shows a preview notice and a call button and sends nothing |
| `GTM_ID` | unset | Loads Google Tag Manager only when set |
| `APEX_FORM_TOKEN` | unset | Includes the vendored `assets/js/apex-attribution.js` with this token and attaches each confirmed lead |

`check` and `test` infer `BASE_PATH` and `SITE_ORIGIN` from the canonical tag of `dist/index.html` when those two are not set, and print that they did.

Extra switches for the quality tools:

- `ALLOW_PLANNED=1 npm run check` turns links to planned but unbuilt pages into a separate warning list (useful mid-build). Without it they fail.
- `VERBOSE=1 npm run check` prints every example of every failure and the allowed claim-pattern hits with context.
- `PAGES=/,/faq/ npm test` limits the browser run to those routes. `BROWSER_CONCURRENCY=1` slows it down on a busy machine. `HEADED=1` shows the browser.
- `LH_RUNS=5 npm run lighthouse` runs each page five times and reports the median and the worst run. `npm run lighthouse -- /faq/ /contact/` audits other routes. `LH_NO_FAIL=1` reports without failing.

### Presetting the estimate card from an ad

Any page's estimate card can be preset from its URL, so each Google Ads ad group can land on the right choices:

- `?property=home`, `hoa`, `business` or `downtown` picks the property type. On a city page the card then reads, for example, "HOA or entrance in Troy, MI".
- `?lights=` takes a comma list of `roofline`, `trees`, `entrance`, `building`, `poles`, `bistro`, `permanent`, `landscape`, `unsure`.

Example final URL: `/commercial-holiday-lighting/troy-mi/?property=hoa&lights=entrance,trees`.

Tracking events pushed to the dataLayer: `contact_click` (every `tel:` link, with `placement`), `estimate_cta_click` (every estimate button, with `placement`), `estimate_start`, `estimate_step` (once per step reached) and `generate_lead` (only after Web3Forms confirms the request, with no personal details). With Tag Manager on the page, the redirect to `/thank-you/` waits for the tags through `eventCallback` (at most 1.5 seconds), so the conversion is not cut off by the navigation.

### Common recipes

```sh
# Default review build (noindex, preview form, GitHub Pages path)
npm run build && npm run check && npm test

# Exercise direct form delivery without sending anything (every request to Web3Forms is intercepted)
export WEB3FORMS_KEY=00000000-0000-4000-8000-000000000000
npm run build && npm run check && npm test
unset WEB3FORMS_KEY

# Launch-shaped build checked locally
SITE_ORIGIN=https://holidaylightservicemi.com BASE_PATH= INDEXABLE=true npm run build
SITE_ORIGIN=https://holidaylightservicemi.com BASE_PATH= INDEXABLE=true npm run check
```

## What the gates enforce

`npm run check` (static, all pages): the three `hub.highlights` lines of every city file sit in their service slots (0 residential, 1 commercial, 2 permanent: each is the H2 of that service's landing page and the line on its hub card); permanent and landscape pages never promise a season-end takedown; exactly one H1; unique titles under 65 characters and unique meta descriptions; canonical equals `SITE_ORIGIN + BASE_PATH + route`; robots meta matches `INDEXABLE`; JSON-LD parses, uses schema.org, has no ratings or reviews and only the verified phone; every internal `href`, `src`, `srcset`, `poster`, `data-*` asset path, CSS `url()` and in-page anchor resolves inside `dist/` with the base path; no U+2013 or U+2014 (or their entities and escapes) in `dist/` or in the source folders; a forbidden-claims scan of visible text, alt text, meta text and site JavaScript strings (reviews, stars, ratings, testimonials, insured, licensed, certified, OSHA, warranty, guarantee, #1, best in, top rated, leading, lifespan, hour counts, prices, per foot, storage, response times, brand names, awards, install counts, ownership), with every hit printed in context and only process or direction wording allowed; the exact footer credit; the header phone and estimate button (on `/thank-you/` the header offers the phone and no estimate, and there is no sticky bar); the mobile bar, whose call button shows the number itself; the quote form contract (steps, submit, `city`, `property_type`, `what_to_light`, honeypot, status region, labels, direct or preview mode); two forms, the city preset and the literal H1 on every local landing page; no duplicate ids or dangling id references; the sitemap lists every indexable page and nothing else; every image or video path comes from `content/media.json` and its `srcset` width matches the real pixel width; `og:image:width` and `og:image:height` match the real size of the share card file; page weight (HTML, CSS, JS, first-screen images and preloaded fonts, no video) with a warning over 600 KB. Results also go to `reports/check-results.json`.

`npm test` (Chrome): for home, every service page, six local pages across the three services and five counties, two city hubs, the service area, two commercial verticals (HOA and the downtowns frame-crossing hero), our-work, about, faq, contact, process, the guides hub, one guide, privacy and the thank-you page, at 1440x900, 390x844 and 320x640: no horizontal overflow, no text cut off by its container or the screen edge (a clipping ancestor can hide a too-wide panel from the overflow test), no console errors or failed requests (video range requests ignored, third parties blocked and reported), no visible text under 12.5px, header phone and estimate visible and uncovered with the header controls ending at the right gutter, the local form's first step inside the first desktop viewport beside the H1 and right after the H1 on phones with its first choices on the first 390x844 screen, the mobile bar (showing the phone number) hidden while a form's controls are on screen and shown elsewhere on phones and never on desktop, no framed photo shown past its own pixels and every photo either in a `.fit1x` frame or a full-bleed backdrop (the 1x rule in DESIGN.md), the home property cards' photos, titles, buttons and links lined up in each row, and axe WCAG 2.1 A/AA with zero violations. Home, a local page, a service page, the FAQ and a hub are also checked at 768x1024, 834x1112 and 1024x768 (overflow, clipping, header alignment, the 1x rule and the card rows), and the phone menu must fill the screen, hold the page still and close on Escape. Then reduced motion (everything fully lit at once, no video starts), JavaScript off (every `[data-reveal]` and all text visible), background video (plays, pause and play work, held back for saveData, 3g and 2g) and the estimate flow (steps, `estimate_start`, `estimate_step`, `contact_click`, validation, preview notice or intercepted Web3Forms POST with `access_key` and the thank-you redirect, `generate_lead` only after a confirmed success, no personal details in the dataLayer, the plain no-JavaScript POST in direct mode), plus the form details: `?property=` and `?lights=` presets, Enter in a field before the last step moving on instead of showing errors, inline field messages (a short phone number asks for the area code), one `estimate_step` per step reached and `estimate_cta_click` on estimate buttons. Screenshots go to `reports/browser/`, results to `reports/browser-results.json`.

`npm run lighthouse`: mobile preset against the locally served build, budgets performance 95+, accessibility 100 and best practices 100, with LCP, CLS and TBT printed. SEO loses points on preview builds because they are noindex; that is expected until launch. Reports go to `reports/lighthouse/`.

## Deploy

`.github/workflows/deploy.yml` runs on every push to `main` (and by hand from the Actions tab): Node 22, `npm ci`, `npm run build`, `npm run check`, upload `dist/`, deploy to GitHub Pages. A failed check stops the deploy.

One-time setup: Settings, Pages, Source: **GitHub Actions**. Build settings come from repository variables (Settings, Secrets and variables, Actions, Variables): `SITE_ORIGIN`, `BASE_PATH`, `INDEXABLE`, `WEB3FORMS_KEY`, `GTM_ID`, `APEX_FORM_TOKEN`. Anything unset falls back to the noindex preview at https://nradachy-web.github.io/holiday-light-service-web/. GitHub does not allow an empty variable, so the workflow builds at the root automatically when `SITE_ORIGIN` is a custom domain; `BASE_PATH` set to `/` or `none` also means the root.

## Launch checklist

The print ad with this address goes out October 1. Finish these before then.

1. **DNS at Namecheap** (Domain List, holidaylightservicemi.com, Manage, Advanced DNS). Delete the parking records (the `www` CNAME to parkingpage.namecheap.com and any URL Redirect on `@`). Add:

   | Type | Host | Value |
   | --- | --- | --- |
   | A | `@` | `185.199.108.153` |
   | A | `@` | `185.199.109.153` |
   | A | `@` | `185.199.110.153` |
   | A | `@` | `185.199.111.153` |
   | CNAME | `www` | `nradachy-web.github.io.` |

   Optional IPv6: AAAA on `@` for `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`. Verify over DNS over HTTPS, since local `dig` on this Mac can be hijacked: `curl -s -H 'accept: application/dns-json' 'https://cloudflare-dns.com/dns-query?name=holidaylightservicemi.com&type=A'`.
2. **Repository variables**: `SITE_ORIGIN=https://holidaylightservicemi.com`, `BASE_PATH` empty (leave it unset; the custom-domain origin builds at the root), `INDEXABLE=true`, `WEB3FORMS_KEY=<the client's access key>`, plus `GTM_ID` and `APEX_FORM_TOKEN` if they are in use.
3. **CNAME file**: add `public/CNAME` containing `holidaylightservicemi.com` (the build copies `public/` into `dist/`, so it lands at `dist/CNAME`; `npm run check` warns when a custom-domain build lacks it and fails when it names a different host). Then Settings, Pages, Custom domain: `holidaylightservicemi.com`. Wait for the DNS check to pass and tick **Enforce HTTPS** (the certificate can take up to an hour).
4. **Redeploy**: Actions, Deploy Holiday Light Service to GitHub Pages, Run workflow. Variable changes only apply on the next run.
5. **Verify the live site**: first run the automated pass, with the launch build in `dist/`: `SITE_ORIGIN=https://holidaylightservicemi.com BASE_PATH= INDEXABLE=true npm run build && npm run live-check`. It must print PASS (every route 200, and the live build is the current source). The same check works for the preview: `npm run build && npm run live-check`. Then:
   - https://holidaylightservicemi.com loads over HTTPS and `www` redirects to it.
   - View source on a few pages: no `noindex`, canonical and sitemap URLs use `https://holidaylightservicemi.com`, `/thank-you/` is still noindex.
   - **The form delivers a real email.** Submit a real request from a local landing page and from the home page, confirm each email arrives in the destination inbox (and in the Web3Forms dashboard), and that the thank-you page loads. Repeat once with JavaScript turned off. If GTM is on, confirm `generate_lead` fires once per submission in Tag Assistant.
   - On a phone, tap the header and sticky-bar phone links: the dialer opens (248) 756-8915.
   - Locally, with the launch variables exported: `npm run build && npm run check && npm test && npm run lighthouse`.
6. **Search Console**: add the domain property, submit `https://holidaylightservicemi.com/sitemap.xml`, request indexing for the home page and the main service pages.
7. **Open items for Aaron** before any copy change: the Ace Outdoor Services family line (one About mention, one footer line), and any insurance, licensing, warranty or storage wording, which stays off the site until he confirms it in writing. Also ask for:
   - The city on the Google Business Profile and its Maps URL. The LocalBusiness markup (`businessNode()` in `scripts/lib/shell.mjs`) carries only `addressRegion: MI` until then; add `addressLocality`, and the Maps URL to `sameAs`. No street address (service-area business).
   - The original, full-resolution photos. Every residential photo came in at 960px wide or less (the large lit house is 960 by 446), so it looks soft on retina screens wherever it is shown large. With originals, rerun `npm run assets` and the house can return to large slots.
   - Three to five photos of permanent lighting installs, by day and by night. The permanent pages use the labeled illustration and seasonal roofline work (tagged "Seasonal work") until then.
   - Landscape lighting photos. `/landscape-lighting/` shows warm white tree lighting at night tagged "Seasonal work" until then.
8. **Yearly content refresh (each August, before the season)**: local pages cite dated events. Update or generalize each one: Clarkston (2026 Holiday Lights Parade date), Davison hub (Trail of Lights, 10th year in 2025), Farmington Hills (2025 lights celebration date), Flint hub and residential page (2025 Holiday Walk), Grand Blanc hub and residential page (2025 tree lighting trails), Howell residential and commercial pages (2026 Fantasy of Lights Parade date), Macomb Township hub (2024 planning quote, 2026 tree lighting), Novi residential page (Light the Lights, November 20, 2026), Plymouth commercial page (2025 Walk of Trees, 2026 Ice Festival), Troy hub (2025 tree lighting venue). `node -e` over `content/cities/*.json` for `/20(2[4-9])/` lists them.

Website & marketing by Modern Apex Strategies.
