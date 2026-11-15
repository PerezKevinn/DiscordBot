/** Tests del tamaño de la party, los cupos y el paso a la banca. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanPartySize, isPartyFull, joinGoesToBench, partyCountLabel, partyMax } from './party';
import type { ActivePing, RoleTemplate } from '../types/ping';

const role = (id: string, maxSlots: number): RoleTemplate => ({ id, label: id, emoji: '⚔️', maxSlots });
const player = (n: number) => ({ userId: String(n), username: `u${n}`, displayName: `U${n}`, joinedAt: n });

// Compo del Gankeo Ava: 4 roles de 1 cupo y 5 armas de daño sin límite, party de 7.
const gankeoAva = [
  role('catch', 1),
  role('retencion', 1),
  role('cc_dps', 1),
  role('healer', 1),
  role('dagas', 0),
  role('patas', 0),
  role('maldito', 0),
  role('susurrante', 0),
  role('claymore', 0),
];

function ping(roster: Record<string, number>, partySize?: number): Pick<ActivePing, 'roles' | 'roster' | 'partySize'> {
  let n = 0;
  const r: ActivePing['roster'] = {};
  for (const ro of gankeoAva) r[ro.id] = Array.from({ length: roster[ro.id] ?? 0 }, () => player(++n));
  return { roles: gankeoAva, roster: r, partySize };
}

test('cleanPartySize solo acepta enteros entre 1 y 100', () => {
  assert.equal(cleanPartySize(7), 7);
  for (const bad of [0, -1, 101, 7.5, '7', null, undefined]) assert.equal(cleanPartySize(bad), undefined, String(bad));
});

test('partyMax usa el tamaño fijo aunque haya roles sin límite', () => {
  assert.equal(partyMax(gankeoAva, 7), 7);
});

test('partyMax sin tamaño fijo: suma si todos tienen cupo, null si alguno es ilimitado', () => {
  assert.equal(partyMax([role('a', 2), role('b', 3)]), 5);
  assert.equal(partyMax(gankeoAva), null, 'antes daba 4 sumando solo los roles con cupo');
});

test('el contador muestra 1/7 en vez de 1/4', () => {
  assert.equal(partyCountLabel(ping({ patas: 1 }, 7)), '1/7');
  assert.equal(partyCountLabel(ping({ patas: 1 })), '1');
});

test('con la party completa, cualquier rol manda a banca', () => {
  const full = ping({ catch: 1, retencion: 1, cc_dps: 1, healer: 1, dagas: 1, patas: 1, claymore: 1 }, 7);
  assert.equal(isPartyFull(full), true);
  assert.equal(joinGoesToBench(full, gankeoAva[5]), true, 'daño sin límite');
});

test('con hueco en la party, los roles sin límite admiten gente y los de cupo respetan su límite', () => {
  const p = ping({ catch: 1, patas: 2 }, 7);
  assert.equal(isPartyFull(p), false);
  assert.equal(joinGoesToBench(p, gankeoAva[5]), false, 'otro de daño cabe');
  assert.equal(joinGoesToBench(p, gankeoAva[0]), true, 'catch ya tiene a su 1');
  assert.equal(joinGoesToBench(p, gankeoAva[3]), false, 'healer libre');
});

test('sin tamaño fijo se mantiene el comportamiento de siempre', () => {
  const p = ping({ patas: 20 });
  assert.equal(isPartyFull(p), false);
  assert.equal(joinGoesToBench(p, gankeoAva[5]), false);
});
