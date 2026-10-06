import type { InteractionAcquisitionInput } from './interaction-service';

const bounded = (value: string | null, max: number) => value && value.length <= max && /^[\x20-\x7e]+$/.test(value) ? value : null;

export function acquisitionInputFromRequest(request: Request): InteractionAcquisitionInput {
  const url = new URL(request.url);
  const referrerHeader = request.headers.get('referer');
  let referrer: string | null = null;
  if (referrerHeader) {
    try {
      const parsed = new URL(referrerHeader);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') referrer = `${parsed.origin}${parsed.pathname}`.slice(0, 2048);
    } catch { referrer = null; }
  }
  return {
    landingPath: url.pathname.slice(0, 2048) || '/',
    referrer,
    utmSource: bounded(url.searchParams.get('utm_source'), 200),
    utmMedium: bounded(url.searchParams.get('utm_medium'), 200),
    utmCampaign: bounded(url.searchParams.get('utm_campaign'), 200),
    utmContent: bounded(url.searchParams.get('utm_content'), 200),
    utmTerm: bounded(url.searchParams.get('utm_term'), 200),
  };
}
