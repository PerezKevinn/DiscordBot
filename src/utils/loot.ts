/**
 * Reparto de loot: al terminar una salida (GG) se vende el loot y la plata se reparte a partes
 * iguales entre los que fueron, después de descontar reparaciones, el recargo del gremio y el pago
 * a quien vendió.
 *
 * Cálculo (todo en plata entera):
 *   1. afterRepairs = total − reparaciones (se le devuelven a quien las pagó)
 *   2. recargo del gremio = afterRepairs × % (redondeado hacia abajo)
 *   3. pago al vendedor  = afterRepairs × % (redondeado hacia abajo)
 *   4. neto = afterRepairs − recargo − vendedor
 *   5. cada jugador = neto / jugadores, redondeado hacia abajo a la unidad del servidor
 *   6. lo que sobra del redondeo va al gremio, así la suma cuadra siempre
 *
 * Se guarda por servidor en data/loot/<guildId>.json. El id de cada reparto es el del ping, así que
 * hay como mucho un reparto por salida y se puede corregir.
 */
import fs from 'fs';
import path from 'path';
import { ActivePing, GuildConfig, LootSettings } from '../types/ping';
import { participantsOf } from './points';

const DAY_MS = 24 * 60 * 60 * 1000;
const LOOT_DIR = path.join(process.cwd(), 'data', 'loot');
/** Repartos guardados por servidor; los más antiguos se descartan. */
const MAX_SPLITS = 1000;
/** Total máximo de un reparto: 100 mil millones de plata (de sobra para cualquier salida). */
export const MAX_TOTAL = 100_000_000_000;
/** Suma máxima de recargo del gremio y pago al vendedor, en %. */
export const MAX_DEDUCTION_PCT = 90;
/** Unidades de redondeo permitidas. */
export const ROUND_OPTIONS = [1, 100, 1_000, 10_000, 100_000] as const;
/** Días de historial que se ven sin Premium. */
export const FREE_HISTORY_DAYS = 30;
/** Jugadores máximos en un reparto. */
export const MAX_LOOT_MEMBERS = 100;

/** Ajustes de un servidor que nunca los ha cambiado. */
export const DEFAULT_LOOT: LootSettings = { enabled: true, guildTaxPct: 0, sellerPct: 0, roundTo: 1 };

/** Error con un mensaje apto para mostrar al usuario tal cual. */
export class LootError extends Error {}

/** Jugador que cobra una parte. */
export interface LootMember {
  userId: string;
  name: string;
  paid: boolean;
}

/** Lo que recogió un jugador según el log del loot logger. */
export interface LootLooter {
  /** Nombre del personaje en Albion. */
  name: string;
  /** Miembro de Discord al que corresponde, si se encontró. */
  userId?: string;
  /** Unidades recogidas en total. */
  count: number;
  /** Ítems agrupados, de más a menos unidades (recortado a MAX_ITEMS_PER_LOOTER). */
  items: Array<{ name: string; qty: number }>;
}

/** Resumen de un log importado. */
export interface LootLogSummary {
  fileName: string;
  /** Eventos de loot usados (los de la ventana de la salida, o todos si no hubo ninguno en ella). */
  events: number;
  /** No hubo eventos en el horario de la salida y se usó el archivo entero. */
  outsideWindow: boolean;
  /** Jugadores de la party que recogieron algo. */
  looters: LootLooter[];
  /** Eventos de jugadores que no son de la party (enemigos, otros grupos), que no se cuentan. */
  othersEvents: number;
}

/** Parámetros del reparto que elige el Caller. */
export interface LootParams {
  total: number;
  repairs: number;
  /** Quién pagó las reparaciones; se le devuelven. */
  repairsUserId?: string;
  guildTaxPct: number;
  sellerPct: number;
  /** Quién vende el loot; cobra el pago al vendedor. */
  sellerId?: string;
  roundTo: number;
}

/** Reparto guardado. */
export interface LootSplit extends LootParams {
  /** Id del ping. */
  id: string;
  title: string;
  contentName?: string;
  callerId: string;
  /** Canal del ping, donde se publica el reparto. */
  channelId: string;
  /** Fecha de la salida (cierre del ping). */
  at: number;
  /** Hora de salida del ping, para buscar en el log solo lo de esta salida. */
  startAt?: number;
  createdBy: string;
  createdAt: number;
  updatedBy?: string;
  updatedAt?: number;
  members: LootMember[];
  log?: LootLogSummary;
  /** Mensaje publicado con el reparto. */
  messageId?: string;
  messageChannelId?: string;
}

/** Resultado del cálculo. */
export interface LootBreakdown {
  total: number;
  repairs: number;
  afterRepairs: number;
  guildTax: number;
  sellerFee: number;
  net: number;
  players: number;
  perPlayer: number;
  /** Sobrante del redondeo; va al gremio. */
  remainder: number;
  /** Todo lo que se queda el gremio: recargo + sobrante. */
  guildTotal: number;
}

// ---------- Cálculo ----------

const toBasisPoints = (pct: number) => Math.round(pct * 100);

/** Comprueba los parámetros y lanza LootError con un mensaje legible si algo no cuadra. */
export function validateParams(p: LootParams) {
  if (!Number.isSafeInteger(p.total) || p.total < 0 || p.total > MAX_TOTAL) throw new LootError('El total tiene que ser una cantidad de plata válida.');
  if (!Number.isSafeInteger(p.repairs) || p.repairs < 0) throw new LootError('Las reparaciones tienen que ser una cantidad de plata válida.');
  if (p.repairs > p.total) throw new LootError('Las reparaciones no pueden superar el total.');
  for (const [label, pct] of [
    ['El recargo del gremio', p.guildTaxPct],
    ['El pago al vendedor', p.sellerPct],
  ] as const) {
    if (!Number.isFinite(pct) || pct < 0 || pct > MAX_DEDUCTION_PCT) throw new LootError(`${label} tiene que estar entre 0 y ${MAX_DEDUCTION_PCT} %.`);
  }
  if (p.guildTaxPct + p.sellerPct > MAX_DEDUCTION_PCT) throw new LootError(`El recargo y el pago al vendedor juntos no pueden pasar del ${MAX_DEDUCTION_PCT} %.`);
  if (!(ROUND_OPTIONS as readonly number[]).includes(p.roundTo)) throw new LootError('Redondeo no válido.');
}

/** Calcula el reparto a partes iguales entre `players` jugadores. */
export function computeSplit(p: LootParams, players: number): LootBreakdown {
  validateParams(p);
  const afterRepairs = p.total - p.repairs;
  const guildTax = Math.floor((afterRepairs * toBasisPoints(p.guildTaxPct)) / 10_000);
  const sellerFee = Math.floor((afterRepairs * toBasisPoints(p.sellerPct)) / 10_000);
  const net = afterRepairs - guildTax - sellerFee;
  const perPlayer = players > 0 ? Math.floor(net / players / p.roundTo) * p.roundTo : 0;
  const remainder = net - perPlayer * players;
  return { total: p.total, repairs: p.repairs, afterRepairs, guildTax, sellerFee, net, players, perPlayer, remainder, guildTotal: guildTax + remainder };
}

// ---------- Plata ----------

/**
 * Lee una cantidad de plata como la escribe la gente: "12500000", "12.500.000", "12,500,000",
 * "12.5m", "12,5 M", "800k", "1.2kk", "3b". Devuelve null si no se entiende.
 */
export function parseSilver(raw: string): number | null {
  let s = raw.trim().toLowerCase().replace(/\s+/g, '').replace(/plata|silver|\$/g, '');
  if (!s) return null;
  let mult = 1;
  const suffix = s.match(/(kk|mm|k|m|b)$/);
  if (suffix) {
    mult = { k: 1e3, kk: 1e6, m: 1e6, mm: 1e6, b: 1e9 }[suffix[1] as 'k' | 'kk' | 'm' | 'mm' | 'b'];
    s = s.slice(0, -suffix[1].length);
  }
  if (!/^\d[\d.,]*$/.test(s)) return null;
  let n: number;
  if (mult > 1) {
    // Con sufijo, la última coma o punto es el decimal: "12,5m", "1.25m".
    n = Number(s.replace(/[.,](?=.*[.,])/g, '').replace(',', '.'));
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s) || /^\d{1,3}(,\d{3})+$/.test(s)) {
    // Separadores de miles: 12.500.000 o 12,500,000 (también 1.500).
    n = Number(s.replace(/[.,]/g, ''));
  } else if (/^\d+$/.test(s)) {
    n = Number(s);
  } else {
    return null;
  }
  if (!Number.isFinite(n)) return null;
  const out = Math.round(n * mult);
  return Number.isSafeInteger(out) && out >= 0 ? out : null;
}

/** Plata con separador de miles: 12.500.000. */
export function formatSilver(n: number): string {
  const sign = n < 0 ? '-' : '';
  return sign + String(Math.abs(Math.trunc(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Plata corta: 12,5 M · 800 K · 950. */
export function shortSilver(n: number): string {
  const abs = Math.abs(n);
  const fmt = (v: number, unit: string) => `${(Math.floor(v * 10) / 10).toString().replace('.', ',')} ${unit}`;
  if (abs >= 1e9) return fmt(n / 1e9, 'B');
  if (abs >= 1e6) return fmt(n / 1e6, 'M');
  if (abs >= 1e4) return fmt(n / 1e3, 'K');
  return formatSilver(n);
}

/** Porcentaje legible: 10 → "10", 2.5 → "2,5". */
export function formatPct(n: number): string {
  return String(Math.round(n * 100) / 100).replace('.', ',');
}

/** Lee un porcentaje: "10", "10%", "2,5". Devuelve null si no se entiende. */
export function parsePct(raw: string): number | null {
  const s = raw.trim().replace(/\s|%/g, '').replace(',', '.');
  if (!s) return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Number(s);
}

// ---------- Ajustes ----------

/** Ajustes de loot del servidor, completados con los valores por defecto. */
export function lootSettings(config: GuildConfig): LootSettings {
  return { ...DEFAULT_LOOT, ...config.loot };
}

/** Aplica un cambio parcial a los ajustes. No guarda la config: lo hace quien llama. */
export function updateLootSettings(config: GuildConfig, patch: Partial<Omit<LootSettings, 'managerRoleId'>> & { managerRoleId?: string | null }): LootSettings {
  const next: LootSettings = { ...lootSettings(config) };
  if (patch.enabled !== undefined) next.enabled = patch.enabled;
  if (patch.guildTaxPct !== undefined) next.guildTaxPct = patch.guildTaxPct;
  if (patch.sellerPct !== undefined) next.sellerPct = patch.sellerPct;
  if (patch.roundTo !== undefined) next.roundTo = patch.roundTo;
  if (patch.managerRoleId !== undefined) next.managerRoleId = patch.managerRoleId || undefined;
  validateParams({ total: 0, repairs: 0, guildTaxPct: next.guildTaxPct, sellerPct: next.sellerPct, roundTo: next.roundTo });
  config.loot = next;
  return next;
}

// ---------- Almacenamiento ----------

interface GuildLoot {
  splits: LootSplit[];
}

const cache = new Map<string, GuildLoot>();

function filePath(guildId: string) {
  if (!/^\d{5,25}$/.test(guildId)) throw new Error(`guildId inválido: ${guildId}`);
  return path.join(LOOT_DIR, `${guildId}.json`);
}

function load(guildId: string): GuildLoot {
  const hit = cache.get(guildId);
  if (hit) return hit;
  let data: GuildLoot = { splits: [] };
  const file = filePath(guildId);
  if (fs.existsSync(file)) {
    try {
      data = JSON.parse(fs.readFileSync(file, 'utf-8')) as GuildLoot;
      data.splits ||= [];
    } catch (err) {
      console.error(`Loot de ${guildId} dañado; se empieza de cero:`, err);
    }
  }
  cache.set(guildId, data);
  return data;
}

function save(guildId: string, data: GuildLoot) {
  if (data.splits.length > MAX_SPLITS) {
    data.splits.sort((a, b) => a.at - b.at);
    data.splits.splice(0, data.splits.length - MAX_SPLITS);
  }
  if (!fs.existsSync(LOOT_DIR)) fs.mkdirSync(LOOT_DIR, { recursive: true });
  const file = filePath(guildId);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data), 'utf-8');
  fs.renameSync(tmp, file);
}

/** Borra los repartos de un servidor (retención de datos). */
export function purgeLoot(guildId: string) {
  cache.delete(guildId);
  const file = filePath(guildId);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

/** Libera la caché de un servidor sin tocar el archivo. */
export function evictLoot(guildId: string) {
  cache.delete(guildId);
}

/** Reparto guardado de una salida. */
export function getSplit(guildId: string, id: string): LootSplit | undefined {
  return load(guildId).splits.find((s) => s.id === id);
}

/** Limpia y comprueba un reparto antes de guardarlo. */
function cleanSplit(split: LootSplit): LootSplit {
  validateParams(split);
  const seen = new Set<string>();
  const members = split.members.filter((m) => /^\d{5,25}$/.test(m.userId) && !seen.has(m.userId) && seen.add(m.userId));
  if (members.length === 0) throw new LootError('Añade al menos un jugador al reparto.');
  if (members.length > MAX_LOOT_MEMBERS) throw new LootError(`Un reparto admite como mucho ${MAX_LOOT_MEMBERS} jugadores.`);
  return {
    ...split,
    title: split.title.slice(0, 100),
    members: members.map((m) => ({ userId: m.userId, name: m.name.slice(0, 64), paid: Boolean(m.paid) })),
  };
}

/** Guarda (o sustituye) un reparto. Devuelve el guardado y el anterior. */
export function saveSplit(guildId: string, split: LootSplit): { split: LootSplit; previous?: LootSplit } {
  const clean = cleanSplit(split);
  const data = load(guildId);
  const idx = data.splits.findIndex((s) => s.id === clean.id);
  const previous = idx >= 0 ? data.splits[idx] : undefined;
  if (idx >= 0) data.splits[idx] = clean;
  else data.splits.push(clean);
  save(guildId, data);
  return { split: clean, previous };
}

/** Marca como pagados (o no) a algunos jugadores de un reparto. */
export function setPaid(guildId: string, id: string, changes: Record<string, boolean>, byUserId: string, now = Date.now()): LootSplit {
  const data = load(guildId);
  const split = data.splits.find((s) => s.id === id);
  if (!split) throw new LootError('Ese reparto ya no existe.');
  for (const m of split.members) if (m.userId in changes) m.paid = changes[m.userId];
  split.updatedBy = byUserId;
  split.updatedAt = now;
  save(guildId, data);
  return split;
}

/** Borra un reparto. */
export function deleteSplit(guildId: string, id: string): LootSplit {
  const data = load(guildId);
  const idx = data.splits.findIndex((s) => s.id === id);
  if (idx < 0) throw new LootError('Ese reparto ya no existe.');
  const [removed] = data.splits.splice(idx, 1);
  save(guildId, data);
  return removed;
}

/** Repartos del más reciente al más antiguo; sin Premium, solo los de los últimos 30 días. */
export function listSplits(guildId: string, full: boolean, now = Date.now()): LootSplit[] {
  const from = full ? 0 : now - FREE_HISTORY_DAYS * DAY_MS;
  return load(guildId)
    .splits.filter((s) => s.at >= from)
    .sort((a, b) => b.at - a.at);
}

/** Lo que se le debe a un jugador: repartos donde aún no cobró, del más antiguo al más reciente. */
export function pendingFor(guildId: string, userId: string): Array<{ split: LootSplit; amount: number }> {
  const out: Array<{ split: LootSplit; amount: number }> = [];
  for (const split of load(guildId).splits) {
    const me = split.members.find((m) => m.userId === userId);
    if (!me || me.paid) continue;
    const b = computeSplit(split, split.members.length);
    out.push({ split, amount: amountFor(split, b, userId) });
  }
  return out.sort((a, b) => a.split.at - b.split.at);
}

/** Lo que cobra un jugador: su parte, más el pago al vendedor y las reparaciones si le tocan. */
export function amountFor(split: LootParams, b: LootBreakdown, userId: string): number {
  let n = b.perPlayer;
  if (split.sellerId === userId) n += b.sellerFee;
  if (split.repairsUserId === userId) n += b.repairs;
  return n;
}

/** Reparto nuevo para un ping, con los anotados (roles y banca) y los valores por defecto del servidor. */
export function newSplitFor(config: GuildConfig, ping: ActivePing, byUserId: string, now = Date.now()): LootSplit {
  const s = lootSettings(config);
  return {
    id: ping.id,
    title: ping.title,
    contentName: ping.contentName,
    callerId: ping.callerId,
    channelId: ping.channelId,
    at: ping.closedAt ?? now,
    startAt: ping.startTimeUnix * 1000,
    createdBy: byUserId,
    createdAt: now,
    total: 0,
    repairs: 0,
    guildTaxPct: s.guildTaxPct,
    sellerPct: s.sellerPct,
    sellerId: ping.callerId,
    roundTo: s.roundTo,
    members: participantsOf(ping).map((p) => ({ ...p, paid: false })),
  };
}

/** Indica si ya se pagó a todos. */
export function isFullyPaid(split: LootSplit): boolean {
  return split.members.length > 0 && split.members.every((m) => m.paid);
}

/** CSV del historial (Premium), con una fila por jugador y reparto. */
export function splitsCsv(splits: LootSplit[]): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [['fecha', 'salida', 'total', 'reparaciones', 'recargo_gremio', 'vendedor', 'neto', 'por_jugador', 'jugador', 'discord_id', 'cobra', 'pagado']];
  for (const s of splits) {
    const b = computeSplit(s, s.members.length);
    for (const m of s.members) {
      rows.push([
        new Date(s.at).toISOString().slice(0, 10),
        s.title,
        String(b.total),
        String(b.repairs),
        String(b.guildTax),
        String(b.sellerFee),
        String(b.net),
        String(b.perPlayer),
        m.name,
        m.userId,
        String(amountFor(s, b, m.userId)),
        m.paid ? 'si' : 'no',
      ]);
    }
  }
  return rows.map((r) => r.map(esc).join(',')).join('\n');
}
