function normalizeHtml(value: string | undefined | null) {
  return String(value ?? '').trim();
}

export function extractPlainTextFromRichText(value: string | undefined | null) {
  return normalizeHtml(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h1|h2|h3|blockquote)>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getRichTextPlainLength(value: string | undefined | null) {
  return extractPlainTextFromRichText(value).length;
}

export function hasMeaningfulRichText(value: string | undefined | null) {
  return getRichTextPlainLength(value) > 0;
}

export function normalizeRichTextContent(value: string | undefined | null) {
  return normalizeHtml(value);
}
