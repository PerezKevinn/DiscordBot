/**
 * Borra los pagos de PRUEBA de un servidor y deja su Premium como estaba antes de ellos.
 *
 *   npx tsx scripts/limpiarPagosPrueba.ts <guildId>            → solo muestra qué haría
 *   npx tsx scripts/limpiarPagosPrueba.ts <guildId> --aplicar  → lo hace (con copia de seguridad)
 *   Opcional: --desde=2026-11-12T00:00:00Z  (por defecto: la primera orden de prueba del servidor)
 *
 * Qué hace, solo para ese servidor:
 *  1. Borra las órdenes marcadas como prueba (test: true).
 *  2. Borra del historial TODO lo ocurrido desde --desde (pagos de prueba y los ajustes
 *     manuales que se hicieron mientras se probaba).
 *  3. Deja el Premium por tiempo como quedó tras el último evento que se conserva.
 *
 * ⚠️ Con el bot PARADO (pm2 stop massup): el bot guarda estos archivos en memoria y los
 * sobrescribiría.
 */
import fs from 'fs';
import path from 'path';

type Event = { at: number; guildId: string; type: string; days?: number | null; until?: number | null; note?: string };
type Order = { invoice: string; guildId: string; test: boolean; status: string; amount: number; createdAt: number; paymentRef?: string };
type Store = { codes: Record<string, unknown>; history: Event[]; orders: Record<string, Order> };
type Config = { guildId: string; guildName?: string; plan: string; premiumUntil?: number; premiumSource?: string; notices?: object };

const DATA = path.join(process.cwd(), 'data');
const STORE = path.join(DATA, 'memberships.json');

const args = process.argv.slice(2);
const guildId = args.find((a) => /^\d{15,25}$/.test(a));
const apply = args.includes('--aplicar');
const sinceArg = args.find((a) => a.startsWith('--desde='))?.slice('--desde='.length);
if (!guildId) {
  console.error('Uso: npx tsx scripts/limpiarPagosPrueba.ts <guildId> [--desde=FECHA] [--aplicar]');
  process.exit(1);
}

const CONFIG = path.join(DATA, 'guilds', `${guildId}.json`);
if (!fs.existsSync(STORE) || !fs.existsSync(CONFIG)) {
  console.error(`No encuentro ${STORE} o ${CONFIG}. Ejecuta el script desde la carpeta del bot.`);
  process.exit(1);
}

const store = JSON.parse(fs.readFileSync(STORE, 'utf-8')) as Store;
const config = JSON.parse(fs.readFileSync(CONFIG, 'utf-8')) as Config;
const fmt = (ms?: number | null) => (ms ? new Date(ms).toLocaleString('es-CO', { timeZone: 'America/Bogota' }) : ms === null ? 'de por vida' : '—');

const testOrders = Object.values(store.orders ?? {}).filter((o) => o.guildId === guildId && o.test);
const since = sinceArg ? Date.parse(sinceArg) : Math.min(...testOrders.map((o) => o.createdAt));
if (!Number.isFinite(since)) {
  console.error(sinceArg ? `Fecha no válida: ${sinceArg}` : 'Este servidor no tiene órdenes de prueba. Usa --desde=FECHA si aun así quieres limpiar.');
  process.exit(1);
}

const guildEvents = store.history.filter((e) => e.guildId === guildId);
const removeEvents = guildEvents.filter((e) => e.at >= since);
const keptEvents = guildEvents.filter((e) => e.at < since);

// Estado del Premium por tiempo tras el último evento que se conserva (las suscripciones de Discord van aparte)
const TIMED = ['grant', 'extend', 'revoke', 'code_redeemed', 'expired', 'payment', 'payment_reversed'];
const last = [...keptEvents].reverse().find((e) => TIMED.includes(e.type));
const SOURCE: Record<string, string> = { grant: 'manual', extend: 'manual', code_redeemed: 'code', payment: 'payment', payment_reversed: 'payment' };
let next: Pick<Config, 'plan' | 'premiumUntil' | 'premiumSource'>;
if (!last || last.type === 'revoke' || last.type === 'expired' || (last.type === 'payment_reversed' && !last.until)) {
  next = { plan: 'free', premiumUntil: undefined, premiumSource: undefined };
} else {
  next = { plan: 'premium', premiumUntil: last.until ?? undefined, premiumSource: SOURCE[last.type] };
}

console.log(`Servidor: ${config.guildName ?? guildId} (${guildId})`);
console.log(`Se limpia desde: ${fmt(since)} (hora de Colombia)\n`);
console.log(`Órdenes de prueba a borrar (${testOrders.length}):`);
for (const o of testOrders) console.log(`  - ${o.invoice} · ${o.status} · $${o.amount} · pago ${o.paymentRef ?? '?'} · ${fmt(o.createdAt)}`);
console.log(`\nEventos del historial a borrar (${removeEvents.length}):`);
for (const e of removeEvents) console.log(`  - ${fmt(e.at)} · ${e.type}${e.days ? ` · ${e.days} días` : ''}${e.note ? ` · ${e.note}` : ''}`);
console.log(`\nEventos que se conservan (${keptEvents.length}):`);
for (const e of keptEvents) console.log(`  - ${fmt(e.at)} · ${e.type}${e.days ? ` · ${e.days} días` : ''}`);
console.log(`\nPremium ahora:   ${config.plan}, hasta ${fmt(config.premiumUntil ?? (config.plan === 'premium' ? null : undefined))} (${config.premiumSource ?? '—'})`);
console.log(`Premium después: ${next.plan}, hasta ${fmt(next.premiumUntil ?? (next.plan === 'premium' ? null : undefined))} (${next.premiumSource ?? '—'})`);

if (!apply) {
  console.log('\nSimulación: no se cambió nada. Repite con --aplicar para hacerlo (con el bot parado).');
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
fs.copyFileSync(STORE, `${STORE}.bak-${stamp}`);
fs.copyFileSync(CONFIG, `${CONFIG}.bak-${stamp}`);

for (const o of testOrders) delete store.orders[o.invoice];
store.history = store.history.filter((e) => !(e.guildId === guildId && e.at >= since));
Object.assign(config, next, { notices: {} });
if (next.premiumUntil === undefined) delete config.premiumUntil;
if (next.premiumSource === undefined) delete config.premiumSource;

const write = (file: string, data: unknown) => {
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(`${file}.tmp`, file);
};
write(STORE, store);
write(CONFIG, config);
console.log(`\n✅ Hecho. Copias de seguridad: *.bak-${stamp}. Arranca el bot con: pm2 start massup`);
