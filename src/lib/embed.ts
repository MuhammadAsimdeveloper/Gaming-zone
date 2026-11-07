export type EmbedValidation =
  | { ok: true; url: string; origin: string }
  | { ok: false; reason: string };

function normalizeAllowedOrigin(entry: string): string | null {
  const trimmed = entry.trim().toLowerCase().replace(/\/+$/, '');
  if (!trimmed) return null;

  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    try {
      const url = new URL(trimmed);
      return url.origin;
    } catch {
      return null;
    }
  }

  return `https://${trimmed}`;
}

export function validateExternalGameUrl(
  rawUrl: string,
  allowedOrigins: string[],
  options: { allowLocalhost?: boolean; siteOrigin?: string } = {},
): EmbedValidation {
  const candidate = rawUrl.trim();
  if (!candidate) {
    return { ok: false, reason: 'Enter a game URL.' };
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false, reason: 'That is not a valid URL.' };
  }

  const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  const allowedProtocol = url.protocol === 'https:' || (options.allowLocalhost && isLocalhost);
  if (!allowedProtocol) {
    return { ok: false, reason: 'External games must use HTTPS.' };
  }

  if (url.username || url.password) {
    return { ok: false, reason: 'URLs with embedded credentials are not allowed.' };
  }

  if (allowedOrigins.length === 0) {
    return {
      ok: false,
      reason: 'No approved game origins are configured. Add them to VITE_EXTERNAL_GAME_ORIGINS.',
    };
  }

  const normalizedAllowed = allowedOrigins
    .map(normalizeAllowedOrigin)
    .filter((origin): origin is string => Boolean(origin));

  const origin = url.origin.toLowerCase();
  const siteOrigin = options.siteOrigin?.trim().toLowerCase().replace(/\/+$/, '');
  if (siteOrigin && origin === siteOrigin) {
    return {
      ok: false,
      reason: 'External games cannot run on the same origin as this site.',
    };
  }

  if (!normalizedAllowed.includes(origin)) {
    return {
      ok: false,
      reason: `The origin ${url.origin} is not in the approved game origin list.`,
    };
  }

  return { ok: true, url: url.toString(), origin: url.origin };
}

export function sanitizeThumbnailUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  if (value.startsWith('/') && !value.startsWith('//')) {
    return value;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}
