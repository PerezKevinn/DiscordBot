/** Tests del formato de cifras y de los enlaces de perfil de la ficha de Albion. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALBION_NAME_RE, profileLinks, shortNumber } from './albion';

test('cifras abreviadas en español', () => {
  assert.equal(shortNumber(0), '0');
  assert.equal(shortNumber(999), '999');
  assert.equal(shortNumber(204_741), '204,7 K');
  assert.equal(shortNumber(2_635_870), '2,64 M');
  assert.equal(shortNumber(243_800_663), '243,8 M');
  assert.equal(shortNumber(1_200_000_000), '1,2 B');
});

test('nombres de personaje válidos', () => {
  assert.ok(ALBION_NAME_RE.test('DeiSchl'));
  assert.ok(!ALBION_NAME_RE.test('ab'));
  assert.ok(!ALBION_NAME_RE.test('con espacio'));
  assert.ok(!ALBION_NAME_RE.test('a'.repeat(17)));
});

test('enlaces de perfil por servidor', () => {
  const am = profileLinks('americas', 'abc123', 'DeiSchl');
  assert.equal(am[0].url, 'https://albiononline.com/killboard/player/abc123');
  assert.match(am[1].url, /playerName=DeiSchl&server=west$/);
  const eu = profileLinks('europe', 'abc123', 'DeiSchl');
  assert.match(eu[0].label, /Europa/);
  assert.match(eu[1].url, /server=europe$/);
  assert.match(profileLinks('asia', 'x', 'y')[1].url, /server=east$/);
});
