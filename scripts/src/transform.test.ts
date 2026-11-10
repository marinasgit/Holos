import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TcgdexCard } from './tcgdex.js';
import { chunk, extractPriceRows, toCardDetailsRow, todayUtc } from './transform.js';

// Trimmed from a real TCGdex response for /cards/base1-4.
const charizard: TcgdexCard = {
  id: 'base1-4',
  localId: '4',
  name: 'Charizard',
  image: 'https://assets.tcgdex.net/en/base/base1/4',
  category: 'Pokemon',
  rarity: 'Rare Holo',
  hp: 120,
  types: ['Fire'],
  set: { id: 'base1', name: 'Base Set' },
  variants: { firstEdition: true, holo: true, normal: false, reverse: false, wPromo: false },
  pricing: {
    cardmarket: {
      updated: '2026-11-09T23:49:36.461Z',
      unit: 'EUR',
      avg: 453.87,
      low: 89.99,
      trend: 402.26,
      'avg-holo': null,
      'low-holo': null,
      'trend-holo': 123.63,
    },
    tcgplayer: {
      unit: 'USD',
      updated: '2026-11-09T23:49:37.076Z',
      holofoil: { productId: 42382, lowPrice: 475, midPrice: 675.1, highPrice: 3499.1, marketPrice: 987.13 },
      '1stEditionHolofoil': { lowPrice: 9000, marketPrice: 0 },
    },
  },
};

test('extractPriceRows flattens tcgplayer variants and cardmarket prices', () => {
  const rows = extractPriceRows(charizard, '2026-11-10');
  assert.deepEqual(
    rows.map((r) => [r.source, r.variant, r.currency, r.market, r.low]),
    [
      ['tcgplayer', 'holofoil', 'USD', 987.13, 475],
      ['tcgplayer', '1stEditionHolofoil', 'USD', null, 9000], // 0 means "no data"
      ['cardmarket', 'default', 'EUR', 402.26, 89.99],
      ['cardmarket', 'foil', 'EUR', 123.63, null],
    ],
  );
  assert.ok(rows.every((r) => r.card_id === 'base1-4' && r.recorded_on === '2026-11-10'));
});

test('extractPriceRows handles cards without pricing', () => {
  assert.deepEqual(extractPriceRows({ ...charizard, pricing: null }, '2026-11-10'), []);
  assert.deepEqual(extractPriceRows({ ...charizard, pricing: undefined }, '2026-11-10'), []);
  assert.deepEqual(
    extractPriceRows({ ...charizard, pricing: { tcgplayer: { unit: 'USD', normal: { marketPrice: null } } } }, 'x'),
    [],
  );
});

test('toCardDetailsRow keeps only printings that exist', () => {
  const row = toCardDetailsRow(charizard);
  assert.deepEqual(row.variants, ['firstEdition', 'holo']);
  assert.equal(row.set_id, 'base1');
  assert.equal(row.local_id, '4');
  assert.equal(row.hp, 120);
});

test('helpers', () => {
  assert.equal(todayUtc(new Date('2026-11-10T23:59:00Z')), '2026-11-10');
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});
