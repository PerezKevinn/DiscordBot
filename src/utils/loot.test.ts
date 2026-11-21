/** Tests del cálculo del reparto de loot y de la lectura de cantidades de plata. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { amountFor, computeSplit, formatSilver, LootError, LootParams, parsePct, parseSilver, shortSilver, splitsCsv, LootSplit } from './loot';

const base: LootParams = { total: 0, repairs: 0, guildTaxPct: 0, sellerPct: 0, roundTo: 1 };

test('partes iguales sin descuentos', () => {
  const b = computeSplit({ ...base, total: 10_000_000 }, 4);
  assert.equal(b.perPlayer, 2_500_000);
  assert.equal(b.remainder, 0);
  assert.equal(b.guildTotal, 0);
});

test('reparaciones, recargo y vendedor en orden, y la suma cuadra', () => {
  const p = { ...base, total: 12_500_000, repairs: 500_000, guildTaxPct: 10, sellerPct: 5, roundTo: 1_000 };
  const b = computeSplit(p, 7);
  assert.equal(b.afterRepairs, 12_000_000);
  assert.equal(b.guildTax, 1_200_000);
  assert.equal(b.sellerFee, 600_000);
  assert.equal(b.net, 10_200_000);
  assert.equal(b.perPlayer, 1_457_000); // 1.457.142,8 redondeado a mil hacia abajo
  assert.equal(b.remainder, 10_200_000 - 1_457_000 * 7);
  assert.equal(b.repairs + b.guildTax + b.sellerFee + b.perPlayer * 7 + b.remainder, p.total);
});

test('porcentajes con decimales sin errores de coma flotante', () => {
  const b = computeSplit({ ...base, total: 1_000_000, guildTaxPct: 2.5, sellerPct: 0.1 }, 3);
  assert.equal(b.guildTax, 25_000);
  assert.equal(b.sellerFee, 1_000);
  assert.equal(b.perPlayer, 324_666);
  assert.equal(b.remainder, 2);
});

test('lo que cobra el vendedor y quien pagó las reparaciones', () => {
  const p = { ...base, total: 1_000_000, repairs: 100_000, sellerPct: 10, sellerId: 'S', repairsUserId: 'R' };
  const b = computeSplit(p, 3);
  assert.equal(amountFor(p, b, 'X'), 270_000);
  assert.equal(amountFor(p, b, 'S'), 270_000 + 90_000);
  assert.equal(amountFor(p, b, 'R'), 270_000 + 100_000);
});

test('sin jugadores todo queda en el gremio', () => {
  const b = computeSplit({ ...base, total: 1000 }, 0);
  assert.equal(b.perPlayer, 0);
  assert.equal(b.guildTotal, 1000);
});

test('parámetros inválidos', () => {
  assert.throws(() => computeSplit({ ...base, total: 100, repairs: 200 }, 1), LootError);
  assert.throws(() => computeSplit({ ...base, total: 100, guildTaxPct: 60, sellerPct: 40 }, 1), LootError);
  assert.throws(() => computeSplit({ ...base, total: -1 }, 1), LootError);
  assert.throws(() => computeSplit({ ...base, total: 1, roundTo: 7 }, 1), LootError);
});

test('parseSilver entiende cómo lo escribe la gente', () => {
  assert.equal(parseSilver('12500000'), 12_500_000);
  assert.equal(parseSilver('12.500.000'), 12_500_000);
  assert.equal(parseSilver('12,500,000'), 12_500_000);
  assert.equal(parseSilver('12.5m'), 12_500_000);
  assert.equal(parseSilver('12,5 M'), 12_500_000);
  assert.equal(parseSilver('800k'), 800_000);
  assert.equal(parseSilver('1.2kk'), 1_200_000);
  assert.equal(parseSilver('3b'), 3_000_000_000);
  assert.equal(parseSilver('1.500'), 1500);
  assert.equal(parseSilver('0'), 0);
  assert.equal(parseSilver('12,5'), null);
  assert.equal(parseSilver('abc'), null);
  assert.equal(parseSilver(''), null);
});

test('formatos de plata y porcentaje', () => {
  assert.equal(formatSilver(12_500_000), '12.500.000');
  assert.equal(formatSilver(950), '950');
  assert.equal(shortSilver(12_500_000), '12,5 M');
  assert.equal(shortSilver(800_000), '800 K');
  assert.equal(parsePct('10%'), 10);
  assert.equal(parsePct('2,5'), 2.5);
  assert.equal(parsePct(''), 0);
  assert.equal(parsePct('x'), null);
});

test('CSV con una fila por jugador', () => {
  const split = {
    id: 'p1', title: 'Gank; "Martlock"', callerId: '1', channelId: '2', at: Date.UTC(2026, 10, 20), createdBy: '1', createdAt: 0,
    ...base, total: 1000,
    members: [{ userId: '111111', name: 'Ana', paid: true }, { userId: '222222', name: 'Beto', paid: false }],
  } as LootSplit;
  const lines = splitsCsv([split]).split('\n');
  assert.equal(lines.length, 3);
  assert.equal(lines[1], '2026-11-20,"Gank; ""Martlock""",1000,0,0,0,1000,500,Ana,111111,500,si');
});
