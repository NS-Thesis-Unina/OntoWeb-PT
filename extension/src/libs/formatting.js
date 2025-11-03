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

export function prettyBytes(n = 0) {
  if (!Number.isFinite(n)) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let u = 0;
  while (n >= 1024 && u < units.length - 1) { n /= 1024; u++; }
  return `${n.toFixed((u === 0) ? 0 : 1)} ${units[u]}`;
}

export function getHeader(headers = {}, name = "") {
  if (!headers) return undefined;
  const target = String(name).toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (String(k).toLowerCase() === target) return v;
  }
  return undefined;
}