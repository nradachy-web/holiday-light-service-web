// The one quote request component: the ivory "lit window" card.
// Three steps by default (what, where, you). Two steps when the city is already known.
// Works without JavaScript: all steps show as one form, and with a Web3Forms key it posts
// directly with a redirect to /thank-you/. With no key it is a preview that sends nothing.
import { esc } from './html.mjs';
import { icon } from './icons.mjs';
import { BUSINESS as B } from './config.mjs';

export const LIGHTS = ['Roofline', 'Trees and shrubs', 'Entrance or sign', 'Building outline', 'Poles and lampposts', 'Bistro lights', 'Permanent lighting', 'Landscape lighting', 'Not sure yet'];
export const PROPERTIES = ['Home', 'HOA or subdivision', 'Business', 'Downtown or municipality'];
export const PROPERTY_SHORT = { Home: 'Home', 'HOA or subdivision': 'HOA or entrance', Business: 'Business', 'Downtown or municipality': 'Downtown' };
// Without a city the tag names the property type ("For a home"), with a house icon rather than a map pin.
export const PROPERTY_FOR = { Home: 'For a home', 'HOA or subdivision': 'For an HOA or entrance', Business: 'For a business', 'Downtown or municipality': 'For a downtown' };

let formCount = 0;
export const resetFormIds = () => {
  formCount = 0;
};

/**
 * quoteForm(ctx, page, opts)
 * opts.placement  data-placement value ("hero", "closing", ...)
 * opts.anchor     id on the wrapper, "estimate" for the page's primary form
 * opts.city       city slug to preselect (switches to the two-step flow)
 * opts.lights     what_to_light values to preselect
 * opts.property   property_type value to preselect
 * opts.heading    card title
 * opts.compact    skip the q-note and q-call lines (the section beside the card already shows the next steps and the phone)
 */
export function quoteForm(ctx, page, { placement = 'hero', anchor = 'estimate', city = null, lights = [], property = null, heading = 'Get my free estimate', steps, compact = false } = {}) {
  const { counties } = ctx.content;
  const n = ++formCount;
  const uid = `q${n}`;
  const cityObj = city ? ctx.content.city(city) : null;
  const total = steps || (cityObj ? 2 : 3);
  const live = Boolean(ctx.cfg.formKey);

  const chip = (type, name, value, checked) =>
    `<label class="chip"><input type="${type}" name="${name}" value="${esc(value)}"${checked ? ' checked' : ''}><span>${esc(value)}</span></label>`;
  const lightChips = `<div class="chips">${LIGHTS.map((v) => chip('checkbox', 'what_to_light', v, lights.includes(v))).join('')}</div>`;
  const propertyGroup = `<fieldset class="q-sub"><legend class="q-sublabel">Property type</legend><div class="chips chips-radio">${PROPERTIES.map((v) => chip('radio', 'property_type', v, v === property)).join('')}</div></fieldset>`;
  const citySelect = `<div class="field"><label for="${uid}-city">City</label><select id="${uid}-city" name="city" autocomplete="address-level2"><option value="">Choose your community</option>${counties
    .map((g) => `<optgroup label="${esc(g.county)}">${g.cities.map((c) => `<option value="${c.slug}"${c.slug === city ? ' selected' : ''}>${esc(c.display)}</option>`).join('')}</optgroup>`)
    .join('')}<option value="other">Somewhere else in Michigan</option></select></div>`;
  const address = `<div class="field"><label for="${uid}-address">Street address <span class="opt">(optional)</span></label><input id="${uid}-address" name="address" type="text" autocomplete="street-address"></div>`;
  // Each field has an empty error slot; site.js fills it and links it with aria-describedby only while invalid.
  const err = (f) => `<p class="field-err" id="${uid}-${f}-err" data-err hidden></p>`;
  const contact = `<div class="field"><label for="${uid}-name">Name</label><input id="${uid}-name" name="name" type="text" autocomplete="name" required>${err('name')}</div>
      <div class="field-row">
        <div class="field"><label for="${uid}-phone">Phone</label><input id="${uid}-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" required>${err('phone')}</div>
        <div class="field"><label for="${uid}-email">Email <span class="opt">(optional)</span></label><input id="${uid}-email" name="email" type="email" autocomplete="email">${err('email')}</div>
      </div>`;

  const stepDefs =
    total === 2
      ? [
          { dot: 'What', legend: 'What should we light?', next: 'Next: your details', body: `<p class="q-hint">Choose any that apply.</p>${lightChips}${propertyGroup}` },
          { dot: 'You', legend: 'How do we reach you?', body: `${contact}${citySelect}${address}` },
        ]
      : [
          { dot: 'What', legend: 'What should we light?', next: 'Next: the property', body: `<p class="q-hint">Choose any that apply.</p>${lightChips}` },
          { dot: 'Where', legend: 'Where is the property?', next: 'Next: your details', body: `${propertyGroup}${citySelect}${address}` },
          { dot: 'You', legend: 'How do we reach you?', body: contact },
        ];

  const stepsHtml = stepDefs
    .map(
      (s, i) => `<fieldset class="q-step" data-step="${i + 1}"${s.next ? ` data-next-label="${esc(s.next)}"` : ''}${i === 0 ? ' data-step-active' : ''}>
      <legend class="q-legend">${esc(s.legend)}</legend>
      ${s.body}
      ${i === stepDefs.length - 1 ? '<p class="q-summary" data-summary hidden></p>' : ''}
    </fieldset>`
    )
    .join('');

  const ctxText = contextText(property, cityObj);
  const thanks = ctx.abs('/thank-you/');
  const hidden = live
    ? `<input type="hidden" name="access_key" value="${esc(ctx.cfg.formKey)}"><input type="hidden" name="subject" value="New estimate request from the Holiday Light Service website"><input type="hidden" name="from_name" value="Holiday Light Service website"><input type="hidden" name="redirect" value="${esc(thanks)}"><input type="hidden" name="page" value="${esc(page.path)}">`
    : '';
  const formAttrs = live ? ` action="https://api.web3forms.com/submit" method="post"` : ` method="post"`;
  const nextSteps = ctx.content.copy.contact.next_steps;
  const note = `What happens next: ${nextSteps[0][1]} ${nextSteps[2][1]}`;

  return `<div class="quote-wrap" id="${anchor}">
<form class="quote" data-quote data-placement="${esc(placement)}" data-steps="${total}" data-mode="${live ? 'live' : 'preview'}"${formAttrs} aria-labelledby="${uid}-title"${cityObj ? ` data-city="${cityObj.slug}"` : ''}>
  <div class="q-head">
    <h2 class="q-title" id="${uid}-title" tabindex="-1">${esc(heading)}</h2>
    <p class="q-context" data-context${cityObj ? ' data-has-city' : ''}${ctxText ? '' : ' hidden'}>${icon('pin', 'i-pin')}${icon('home', 'i-prop')}<span data-context-text>${esc(ctxText)}</span></p>
    <ol class="q-dots" aria-hidden="true">${stepDefs.map((s, i) => `<li${i === 0 ? ' class="is-on"' : ''}><span class="q-bulb"></span>${s.dot}</li>`).join('')}</ol>
  </div>
  ${hidden}
  <input type="checkbox" name="botcheck" class="hp" tabindex="-1" autocomplete="off" style="display:none">
  ${stepsHtml}
  <div class="q-actions">
    <button class="btn btn-quiet q-back" type="button" data-back hidden>${icon('back')}<span>Back</span></button>
    <button class="btn btn-night q-next" type="button" data-next><span data-next-text>${esc(stepDefs[0].next)}</span>${icon('arrow')}</button>
    <button class="btn btn-night q-submit" type="submit"${live ? '' : ' disabled data-preview-lock'}><span>Get my free estimate</span>${icon('arrow')}</button>
  </div>
  <p class="q-status" role="status" data-status></p>
  <p class="sr-only" aria-live="polite" data-step-announce></p>
  ${live ? '' : `<noscript><p class="q-noscript">This preview form needs JavaScript. Call <a href="${B.tel}" data-contact="phone" data-placement="${esc(placement)}_noscript">${B.phone}</a> for your free estimate.</p></noscript>`}
  ${compact ? '' : `<p class="q-note">${esc(note)}</p>
  <p class="q-call">Prefer to talk? <a href="${B.tel}" data-contact="phone" data-placement="${esc(placement)}_card">${icon('phone')}<span>Call ${B.phone}</span></a></p>`}
</form>
</div>`;
}

export function contextText(property, cityObj) {
  const p = property ? PROPERTY_SHORT[property] || property : '';
  if (p && cityObj) return `${p} in ${cityObj.display}`;
  if (cityObj) return `Estimate for ${cityObj.display}`;
  return property ? PROPERTY_FOR[property] || p : '';
}
