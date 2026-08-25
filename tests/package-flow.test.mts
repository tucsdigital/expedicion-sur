import test from 'node:test';
import assert from 'node:assert/strict';
import { extractGoogleMapsEmbedUrl, isGoogleMapsEmbedUrl } from '../lib/packages/google-maps.ts';
import {
  buildBookingCalendarMonth,
  buildBookingWindowMonths,
  filterAvailabilityToBookingWindow,
  getMaxSelectablePeople,
} from '../lib/packages/booking-calendar.ts';
import {
  clampPeopleBreakdownToMax,
  getDefaultPeopleCategories,
  getPeopleBreakdownTotal,
  normalizePeopleBreakdown,
  normalizePeopleCategories,
} from '../lib/packages/people-categories.ts';

test('extrae el src de un iframe de Google Maps', () => {
  const iframe = '<iframe src="https://www.google.com/maps/embed?pb=!1m18!2m3"></iframe>';
  assert.equal(extractGoogleMapsEmbedUrl(iframe), 'https://www.google.com/maps/embed?pb=!1m18!2m3');
  assert.equal(isGoogleMapsEmbedUrl(iframe), true);
});

test('convierte una URL con query en una URL embed válida', () => {
  const rawUrl = 'https://www.google.com/maps?q=El%20Calafate';
  assert.equal(
    extractGoogleMapsEmbedUrl(rawUrl),
    'https://www.google.com/maps?q=El%20Calafate&output=embed'
  );
});

test('acepta mapas en modo embed de Google My Maps', () => {
  const rawUrl = 'https://www.google.com/maps/d/embed?mid=1YoK4qkrza8ehIbUp0cZj_7IJH_fiu2Wy&ehbc=2E312F';
  assert.equal(extractGoogleMapsEmbedUrl(rawUrl), rawUrl);
  assert.equal(isGoogleMapsEmbedUrl(rawUrl), true);
});

test('rechaza URLs que no son de Google Maps', () => {
  assert.equal(extractGoogleMapsEmbedUrl('https://example.com/mapa'), '');
  assert.equal(isGoogleMapsEmbedUrl('https://example.com/mapa'), false);
});

test('filtra la disponibilidad al mes actual y siguiente', () => {
  const baseDate = new Date('2026-08-03T12:00:00');
  const filtered = filterAvailabilityToBookingWindow(
    [
      { date: '2026-08-05', available: 4, capacity: 8 },
      { date: '2026-09-10', available: 2, capacity: 8 },
      { date: '2026-10-02', available: 6, capacity: 10 },
    ],
    baseDate
  );

  assert.deepEqual(
    filtered.map((item) => item.date),
    ['2026-08-05', '2026-09-10']
  );
});

test('genera los meses visibles del calendario', () => {
  const months = buildBookingWindowMonths(new Date('2026-12-18T12:00:00'));
  assert.deepEqual(months, [
    { year: 2026, month: 11 },
    { year: 2027, month: 0 },
  ]);
});

test('arma celdas seleccionables y agotadas en el calendario', () => {
  const cells = buildBookingCalendarMonth({
    year: 2026,
    month: 7,
    entries: [
      { date: '2026-08-05', available: 3, capacity: 8 },
      { date: '2026-08-06', available: 0, capacity: 8 },
    ],
  });

  const availableCell = cells.find((cell) => cell.isoDate === '2026-08-05');
  const soldOutCell = cells.find((cell) => cell.isoDate === '2026-08-06');

  assert.ok(availableCell);
  assert.equal(availableCell?.isSelectable, true);
  assert.equal(availableCell?.isAvailable, true);

  assert.ok(soldOutCell);
  assert.equal(soldOutCell?.isSoldOut, true);
  assert.equal(soldOutCell?.isSelectable, false);
});

test('bloquea días sin cupo suficiente para el grupo', () => {
  const cells = buildBookingCalendarMonth({
    year: 2026,
    month: 7,
    requiredPeople: 4,
    entries: [{ date: '2026-08-05', available: 3, capacity: 8 }],
  });
  const cell = cells.find((item) => item.isoDate === '2026-08-05');
  assert.ok(cell);
  assert.equal(cell?.isSelectable, false);
  assert.equal(cell?.isAvailable, false);
});

test('limita la cantidad de personas por disponibilidad y máximo por reserva', () => {
  assert.equal(getMaxSelectablePeople(8, 5), 5);
  assert.equal(getMaxSelectablePeople(3, 6), 3);
  assert.equal(getMaxSelectablePeople(0, 6), 0);
});

test('normaliza categorías de pasajeros y evita duplicados', () => {
  const cats = normalizePeopleCategories(
    [
      { key: 'Adults', label: 'Adultos', min: 1, max: 6 },
      { key: 'adults', label: 'Duplicado', min: 0, max: 6 },
      { key: 'minors', label: 'Menores', min: 0, max: 6 },
    ],
    6
  );
  assert.equal(cats.length, 2);
  assert.equal(cats[0].key, 'adults');
  assert.equal(cats[1].key, 'minors');
});

test('normaliza pax por mínimos y clampa al máximo por reserva', () => {
  const categories = getDefaultPeopleCategories(4);
  const base = normalizePeopleBreakdown({ breakdown: null, categories });
  assert.equal(getPeopleBreakdownTotal(base), 1);

  const pax = normalizePeopleBreakdown({ breakdown: { adults: 3, minors: 3 }, categories });
  const clamped = clampPeopleBreakdownToMax({ breakdown: pax, categories, maxPeoplePerBooking: 4 });
  assert.equal(getPeopleBreakdownTotal(clamped), 4);
  assert.equal(clamped.adults >= 1, true);
});
