import { getDomain as tldGetDomain } from 'tldts';

export function formatWhen(ts, opts = {}, locale) {
  const d = new Date(ts);
  return new Intl.DateTimeFormat(
    locale ?? undefined,
    {
      dateStyle: 'medium',
      timeStyle: 'short',
      ...opts,
    }
  ).format(d);
}

export function getDomainAccurate(url) {
  const d = tldGetDomain(url);
  return d ?? '';
}