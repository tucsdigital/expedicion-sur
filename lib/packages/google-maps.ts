export function extractGoogleMapsEmbedUrl(input: string): string {
  const trimmed = String(input ?? '').trim();
  if (!trimmed) return '';

  const iframeMatch = trimmed.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  const candidate = iframeMatch?.[1]?.trim() || trimmed;
  if (!candidate) return '';

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return '';
  }

  const hostname = parsed.hostname.toLowerCase();
  const isGoogleMapsHost =
    hostname === 'www.google.com' ||
    hostname === 'google.com' ||
    hostname === 'maps.google.com' ||
    hostname.endsWith('.google.com');

  if (!isGoogleMapsHost) return '';

  const pathname = parsed.pathname.toLowerCase();
  const output = parsed.searchParams.get('output');
  if (pathname.includes('/maps/embed') || pathname.includes('/maps/d/embed') || output === 'embed') {
    return parsed.toString();
  }

  const query = parsed.searchParams.get('q')?.trim();
  if (!query) return '';

  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}

export function isGoogleMapsEmbedUrl(value: string): boolean {
  const normalized = extractGoogleMapsEmbedUrl(value);
  return normalized.length > 0;
}
