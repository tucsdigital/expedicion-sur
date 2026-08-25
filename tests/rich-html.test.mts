import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizePackageRichHtml } from '../lib/packages/rich-text-sanitize.ts';
import {
  extractPlainTextFromRichText,
  getRichTextPlainLength,
  hasMeaningfulRichText,
} from '../lib/packages/rich-text-validation.ts';

test('preserva etiquetas HTML permitidas en contenido enriquecido', () => {
  const html = '<h2 style="text-align:center">Itinerario</h2><p><strong>Día 1</strong> <em>Llegada</em><br />Check-in</p><ul><li>Traslado</li></ul>';
  const sanitized = sanitizePackageRichHtml(html);

  assert.match(sanitized, /<h2 style="text-align:center">Itinerario<\/h2>/);
  assert.match(sanitized, /<strong>Día 1<\/strong>/);
  assert.match(sanitized, /<em>Llegada<\/em>/);
  assert.match(sanitized, /<ul><li>Traslado<\/li><\/ul>/);
});

test('elimina scripts, iframes y atributos peligrosos', () => {
  const html = '<p onclick="alert(1)">Hola</p><script>alert(1)</script><iframe src="https://evil.test"></iframe><a href="javascript:alert(1)">link</a>';
  const sanitized = sanitizePackageRichHtml(html);

  assert.equal(sanitized.includes('<script'), false);
  assert.equal(sanitized.includes('<iframe'), false);
  assert.equal(sanitized.includes('onclick='), false);
  assert.equal(sanitized.includes('javascript:'), false);
});

test('normaliza enlaces seguros con target y rel', () => {
  const sanitized = sanitizePackageRichHtml('<a href="https://Expedicion Sur.com">Expedicion Sur</a>');
  assert.equal(
    sanitized,
    '<a href="https://Expedicion Sur.com" target="_blank" rel="noopener noreferrer nofollow">Expedicion Sur</a>'
  );
});

test('extrae texto plano desde HTML enriquecido', () => {
  const html = '<p>Hola <strong>mundo</strong></p><ul><li>Uno</li><li>Dos</li></ul>';
  assert.equal(extractPlainTextFromRichText(html), 'Hola mundo Uno Dos');
  assert.equal(getRichTextPlainLength(html), 'Hola mundo Uno Dos'.length);
  assert.equal(hasMeaningfulRichText(html), true);
  assert.equal(hasMeaningfulRichText('<p><br></p>'), false);
});
