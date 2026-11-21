/** Tests del lector del log de AO Loot Logger. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { itemLabel, normName, parseLootLog, partyGuild, summarizeLog } from './lootLog';

const HEADER = 'timestamp_utc;looted_by__alliance;looted_by__guild;looted_by__name;item_id;item_name;quantity;looted_from__alliance;looted_from__guild;looted_from__name';
const LOG = [
  HEADER,
  '2026-11-20T01:10:00.000Z;ALI;Kingdom Of Silent;Pepito;T6_MAIN_SWORD@2;Expert\'s Broadsword;1;;Enemies;Victima',
  '2026-11-20T01:11:00.000Z;ALI;Kingdom Of Silent;Pepito;T5_RUNE;Adept\'s Rune;12;;Enemies;Victima',
  '2026-11-20T01:12:00.000Z;ALI;Kingdom Of Silent;Juana;T8_BAG@1;Elder\'s Bag;1;;Enemies;Victima',
  '2026-11-20T01:13:00.000Z;;Enemies;Malo;T4_POTION_HEAL;Healing Potion;5;ALI;Kingdom Of Silent;Juana',
  '2026-11-20T01:14:00.000Z;ALI;Kingdom Of Silent;Pepito;T5_RUNE;Adept\'s Rune;3;;Enemies;Victima',
  'basura sin sentido',
  '2026-11-19T10:00:00.000Z;ALI;Kingdom Of Silent;Pepito;T4_HIDE;Hide;100;;;Mob',
].join('\r\n');

test('lee el formato de AO Loot Logger y cuenta las líneas rotas', () => {
  const { events, skipped } = parseLootLog(LOG);
  assert.equal(events.length, 6);
  assert.equal(skipped, 1);
  assert.deepEqual(events[0], {
    at: Date.parse('2026-11-20T01:10:00.000Z'),
    looter: 'Pepito',
    looterGuild: 'Kingdom Of Silent',
    itemId: 'T6_MAIN_SWORD@2',
    itemName: "Expert's Broadsword",
    qty: 1,
    from: 'Victima',
  });
});

test('sin cabecera usa el orden de AO Loot Logger', () => {
  const { events } = parseLootLog(LOG.split('\r\n').slice(1, 3).join('\n'));
  assert.equal(events.length, 2);
  assert.equal(events[1].qty, 12);
});

test('resume por jugador dentro de la ventana de la salida', () => {
  const { events } = parseLootLog(LOG);
  const party = new Set(['pepito', 'juana']);
  const window = { from: Date.parse('2026-11-20T01:00:00Z'), to: Date.parse('2026-11-20T02:00:00Z') };
  const s = summarizeLog(events, 'loot.txt', window, (n) => party.has(normName(n)));
  assert.equal(s.outsideWindow, false);
  assert.equal(s.othersEvents, 1);
  assert.equal(s.events, 4);
  assert.equal(s.looters[0].name, 'Pepito');
  assert.equal(s.looters[0].count, 16);
  assert.deepEqual(s.looters[0].items[0], { name: "Adept's Rune · 5.0", qty: 15 });
  assert.equal(s.looters[1].name, 'Juana');
});

test('si nada cae en la ventana se usa el archivo entero y se avisa', () => {
  const { events } = parseLootLog(LOG);
  const s = summarizeLog(events, 'loot.txt', { from: 0, to: 1 }, () => true);
  assert.equal(s.outsideWindow, true);
  assert.equal(s.events, 6);
});

test('gremio de la party y nombres', () => {
  const { events } = parseLootLog(LOG);
  assert.equal(partyGuild(events, (n) => n === 'Pepito'), 'Kingdom Of Silent');
  assert.equal(normName('[KOS] Pepito_99'), 'pepito99');
  assert.equal(itemLabel('T6_MAIN_SWORD@2', 'Broadsword'), 'Broadsword · 6.2');
  assert.equal(itemLabel('UNIQUE_X', ''), 'UNIQUE_X');
});
