import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSearchHref,
  buildSearchIndex,
  findExperience,
  getAvailableMonths,
  getExperiences,
  normalizeSearchText,
  toSearchEntry,
} from '../lib/search/home-search.ts';

const salida = (fecha: string) => ({ id: fecha, fecha, ciudadSalida: '', precio: 1, moneda: 'ARS' as const });

const categorias: any[] = [
  { id: 'cat-cal', nombre: 'El Calafate', slug: 'el-calafate', activa: true },
  { id: 'cat-chal', nombre: 'El Chaltén', slug: 'el-chalten', activa: true },
];

const paquetes: any[] = [
  { slug: 'glaciar', titulo: 'Glaciar Perito Moreno', categoriaIds: ['cat-cal'], destino: 'El Calafate', salidas: [salida('2026-01-10'), salida('2026-11-05'), salida('2026-12-20')] },
  { slug: 'fitz-roy', titulo: 'Trekking Fitz Roy', categoriaIds: ['cat-chal', 'cat-cal'], destino: 'El Chaltén', salidas: [salida('2026-12-02')] },
  { slug: 'laguna', titulo: 'Laguna Azul', categoriaIds: ['cat-cal'], destino: 'El Calafate', salidas: [] },
  { slug: 'fantasma', titulo: 'Experiencia fantasma', categoriaIds: ['cat-borrada'], destino: 'Destino Eliminado', salidas: [salida('2026-11-30')] },
];

const entries = paquetes.map((p) => toSearchEntry(p, categorias)).filter(Boolean) as any[];
const index = buildSearchIndex(entries, categorias, '2026-10-06');

test('normaliza texto sin tildes ni mayusculas', () => {
  assert.equal(normalizeSearchText('  El Chaltén '), 'el chalten');
});

test('solo existen destinos que estan en las categorias', () => {
  assert.deepEqual(index.destinations.map((d) => [d.label, d.count]), [['El Calafate', 3], ['El Chaltén', 1]]);
  assert.ok(!index.destinations.some((d) => d.label === 'Destino Eliminado'));
  assert.deepEqual(findExperience(index, 'fantasma')?.destinationIds, []);
});

test('una categoria inactiva o inexistente no genera destino', () => {
  const onlyCalafate = buildSearchIndex(entries, [categorias[0]], '2026-10-06');
  assert.deepEqual(onlyCalafate.destinations.map((d) => d.label), ['El Calafate']);
});

test('descarta fechas pasadas', () => {
  assert.deepEqual(findExperience(index, 'glaciar')?.months, ['2026-11', '2026-12']);
});

test('filtra experiencias por destino y texto, con varios destinos por paquete', () => {
  assert.equal(getExperiences(index, 'cat-cal').length, 3);
  assert.deepEqual(getExperiences(index, 'cat-chal').map((e) => e.slug), ['fitz-roy']);
  assert.deepEqual(getExperiences(index, '', 'FITZ').map((e) => e.slug), ['fitz-roy']);
});

test('los meses dependen del destino y la experiencia', () => {
  assert.deepEqual(getAvailableMonths(index, 'cat-chal'), ['2026-12']);
  assert.deepEqual(getAvailableMonths(index, '', 'laguna'), []);
});

test('arma la url', () => {
  assert.equal(buildSearchHref({ slug: 'glaciar' }), '/experiencia/glaciar');
  assert.equal(buildSearchHref({ destinationLabel: 'El Calafate', month: '2026-11' }), '/experiencias?destino=El+Calafate&mes=2026-11');
  assert.equal(buildSearchHref({}), '/experiencias');
});

