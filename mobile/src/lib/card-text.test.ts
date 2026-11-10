import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseCardText } from './card-text';

test('modern card: number, set size and name', () => {
  const parsed = parseCardText([
    'STAGE 2',
    'Evolves from Charmeleon',
    'Charizard ex',
    'HP330',
    'Brave Wing 60+',
    'If this Pokémon has any damage counters on it, this attack does 100 more damage.',
    'Explosive Vortex 330',
    'Discard 3 Energy from this Pokémon.',
    'weakness ×2 resistance retreat',
    'Illus. PLANETA Mochizuki',
    'G MEW EN 006/165 ★★',
  ]);
  assert.equal(parsed.number, '006');
  assert.equal(parsed.setTotal, 165);
  assert.equal(parsed.name, 'Charizard ex');
});

test('vintage card with HP on the name line', () => {
  const parsed = parseCardText(['Charizard 120 HP', 'Pokémon Power: Energy Burn', 'Illus. Mitsuhiro Arita', '4/102 ★', '©1995, 96, 98, 99 Nintendo']);
  assert.equal(parsed.number, '4');
  assert.equal(parsed.setTotal, 102);
  assert.equal(parsed.name, 'Charizard');
});

test('subset numbers keep their prefix and have no plain set size', () => {
  const parsed = parseCardText(['BASIC Pikachu', 'TG05/TG30']);
  assert.equal(parsed.number, 'TG05');
  assert.equal(parsed.setTotal, null);
  assert.equal(parsed.name, 'Pikachu');
});

test('fixes common misreads of 0 and 1', () => {
  assert.deepEqual(
    (({ number, setTotal }) => ({ number, setTotal }))(parseCardText(['O06/l65'])),
    { number: '006', setTotal: 165 },
  );
});

test('multi-line blocks and nothing recognizable', () => {
  const parsed = parseCardText(['Mew ex\nHP 180', 'random words that are a full sentence here.']);
  assert.equal(parsed.name, 'Mew ex');
  assert.equal(parsed.number, null);
  assert.deepEqual(parseCardText([]), { number: null, setTotal: null, name: null, nameCandidates: [] });
});
