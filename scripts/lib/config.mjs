// Build settings from the environment plus the verified business facts.
// Every page reads these through the shared context, never from process.env directly.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DIST = path.resolve(process.env.DIST_DIR || path.join(ROOT, 'dist'));
export const PUBLIC = path.join(ROOT, 'public');
export const CONTENT = path.join(ROOT, 'content');

const trimSlash = (s) => String(s).replace(/\/+$/, '');

export function readConfig(env = process.env) {
  const rawBase = env.BASE_PATH ?? '/holiday-light-service-web';
  const base = rawBase === '' || rawBase === '/' ? '' : '/' + trimSlash(rawBase).replace(/^\/+/, '');
  const origin = trimSlash(env.SITE_ORIGIN ?? 'https://nradachy-web.github.io');
  const indexable = env.INDEXABLE === 'true';
  const formKey = (env.WEB3FORMS_KEY ?? '').trim();
  const gtmId = (env.GTM_ID ?? '').trim();
  const apexToken = (env.APEX_FORM_TOKEN ?? '').trim();
  if (formKey && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(formKey)) {
    throw new Error('WEB3FORMS_KEY is not a valid access key (expected a uuid)');
  }
  if (gtmId && !/^GTM-[A-Z0-9]+$/.test(gtmId)) throw new Error('GTM_ID is not a valid container id (GTM-XXXX)');
  if (apexToken && !/^[A-Za-z0-9._:-]{8,200}$/.test(apexToken)) throw new Error('APEX_FORM_TOKEN has unexpected characters');
  return { base, origin, indexable, formKey, gtmId, apexToken };
}

// Verified facts only (see research/BRIEF.md). Do not add claims here.
export const BUSINESS = {
  name: 'Holiday Light Service',
  phone: '(248) 756-8915',
  tel: 'tel:+12487568915',
  telE164: '+12487568915',
  founded: '2003',
  facebook: 'https://www.facebook.com/holidaylightexpress',
  family: 'Holiday Light Service is part of the Ace Outdoor Services family.',
  credit: 'Website & marketing by Modern Apex Strategies',
  creditUrl: 'https://modernapexstrategies.com',
  region: 'Southeast Michigan',
};

export const COUNTY_ORDER = ['Oakland County', 'Genesee County', 'Livingston County', 'Wayne County', 'Macomb County'];

// The three services that have 25 local landing pages each.
export const LOCAL_SERVICES = ['christmas-light-installation', 'commercial-holiday-lighting', 'permanent-lighting'];
