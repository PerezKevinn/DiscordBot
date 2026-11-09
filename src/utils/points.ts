import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { ActivePing, GuildConfig, PointsSettings } from '../types/ping';
import { getLimits } from './plans';

/**
 * Puntos de actividad: al terminar una salida (GG), el Caller (o un oficial) reparte puntos
 * a cada participante. Los puntos solo sirven para el ranking del servidor; no se canjean.
 *
 * Se guardan por servidor en data/points/<guildId>.json:
 *  - awards: un registro por actividad puntuada (clave = id del ping, se puede corregir)
 *    y por cada ajuste manual (Premium).
 *  - seasonStart: inicio de la temporada actual (Premium); el ranking "total" cuenta desde ahí.
 *  - base: totales de registros antiguos ya compactados (para no crecer sin límite).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const POINTS_DIR = path.join(process.cwd(), 'data', 'points');
/** Registros detallados por servidor; los más antiguos se resumen en `base`. */
const MAX_AWARDS = 3000;
export const MAX_ADJUST = 100_000;

export const DEFAULT_POINTS: PointsSettings = { enabled: true, defaultAward: 10, maxPerActivity: 100 };

export type RankingPeriod = 'total' | 'month' | 'week';
export const PERIOD_LABEL: Record<RankingPeriod, string> = {
  total: 'Temporada',
  month: 'Últimos 30 días',
  week: 'Últimos 7 días',
};

export interface PointsEntry {
  userId: string;
  name: string;
  points: number;
}

export interface PointsAward {
  id: string; // id del ping (actividad) o adj-<hex> (ajuste)
  kind: 'activity' | 'adjust';
  title: string;
  contentName?: string;
  callerId?: string;
  by: string; // quien repartió o ajustó
  at: number;
  updatedAt?: number;
  note?: string;
  entries: PointsEntry[];
}

interface GuildPoints {
  awards: PointsAward[];
  seasonStart?: number;
  base?: Record<string, { name: string; points: number; activities: number }>;
}

export class PointsError extends Error {}

const cache = new Map<string, GuildPoints>();

function filePath(guildId: string) {
  if (!/^\d{5,25}$/.test(guildId)) throw new Error(`guildId inválido: ${guildId}`);
  return path.join(POINTS_DIR, `${guildId}.json`);
}

function load(guildId: string): GuildPoints {
  const hit = cache.get(guildId);
  if (hit) return hit;
  let data: GuildPoints = { awards: [] };
  const file = filePath(guildId);
  if (fs.existsSync(file)) {
    try {
      data = JSON.parse(fs.readFileSync(file, 'utf-8')) as GuildPoints;
      data.awards ||= [];
    } catch (err) {
      console.error(`Puntos de ${guildId} dañados; se empieza de cero:`, err);
    }
  }
  cache.set(guildId, data);
  return data;
}

function save(guildId: string, data: GuildPoints) {
  compact(data);
  if (!fs.existsSync(POINTS_DIR)) fs.mkdirSync(POINTS_DIR, { recursive: true });
  const file = filePath(guildId);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data), 'utf-8');
  fs.renameSync(tmp, file);
}

/** Resume los registros más antiguos en `base` cuando se pasa del máximo. */
function compact(data: GuildPoints) {
  if (data.awards.length <= MAX_AWARDS) return;
  data.awards.sort((a, b) => a.at - b.at);
  const old = data.awards.splice(0, data.awards.length - MAX_AWARDS);
  data.base ||= {};
  for (const a of old) {
    // Lo anterior a la temporada ya no cuenta para el ranking: no hace falta conservarlo
    if (data.seasonStart && a.at < data.seasonStart) continue;
    for (const e of a.entries) {
      const b = (data.base[e.userId] ||= { name: e.name, points: 0, activities: 0 });
      b.name = e.name;
      b.points += e.points;
      if (a.kind === 'activity') b.activities++;
    }
  }
}

/** Borra los puntos de un servidor (retención de datos). */
export function purgePoints(guildId: string) {
  cache.delete(guildId);
  const file = filePath(guildId);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

export function evictPoints(guildId: string) {
  cache.delete(guildId);
}

export function pointsSettings(config: GuildConfig): PointsSettings {
  return { ...DEFAULT_POINTS, ...config.points };
}

export function updatePointsSettings(config: GuildConfig, patch: Partial<PointsSettings>): PointsSettings {
  const next = { ...pointsSettings(config), ...patch };
  next.defaultAward = Math.min(next.defaultAward, next.maxPerActivity);
  config.points = next;
  return next;
}

/** Jugadores que participaron en un ping: anotados en un rol y en banca (no los que se bajaron). */
export function participantsOf(ping: ActivePing): Array<{ userId: string; name: string }> {
  const seen = new Map<string, string>();
  for (const list of Object.values(ping.roster)) for (const u of list) seen.set(u.userId, u.displayName || u.username);
  for (const u of ping.bench) if (!seen.has(u.userId)) seen.set(u.userId, u.displayName || u.username);
  return [...seen].map(([userId, name]) => ({ userId, name }));
}

export function getActivityAward(guildId: string, pingId: string): PointsAward | undefined {
  return load(guildId).awards.find((a) => a.kind === 'activity' && a.id === pingId);
}

/** Puntos propuestos para el editor: lo ya repartido o el valor por defecto para cada participante. */
export function proposedEntries(config: GuildConfig, ping: ActivePing): PointsEntry[] {
  const existing = getActivityAward(config.guildId, ping.id);
  const { defaultAward } = pointsSettings(config);
  const out: PointsEntry[] = existing ? existing.entries.map((e) => ({ ...e })) : [];
  for (const p of participantsOf(ping)) {
    if (!out.some((e) => e.userId === p.userId)) out.push({ ...p, points: existing ? 0 : defaultAward });
  }
  return out;
}

export function assertCanAward(config: GuildConfig, ping: ActivePing) {
  if (!pointsSettings(config).enabled) throw new PointsError('Los puntos están desactivados en este servidor.');
  if (ping.status === 'CANCELLED') throw new PointsError('Esta salida se canceló: no da puntos.');
  if (ping.status !== 'CLOSED') throw new PointsError('Los puntos se reparten cuando la salida termina (GG).');
}

/**
 * Guarda (o corrige) los puntos de una actividad. Los jugadores con 0 no se guardan;
 * si nadie recibe puntos, se borra el registro.
 */
export function setActivityAward(config: GuildConfig, ping: ActivePing, entries: PointsEntry[], byUserId: string, now = Date.now()) {
  assertCanAward(config, ping);
  const { maxPerActivity } = pointsSettings(config);
  const clean = new Map<string, PointsEntry>();
  for (const e of entries) {
    if (!/^\d{5,25}$/.test(e.userId)) continue;
    if (!Number.isInteger(e.points) || e.points < 0 || e.points > maxPerActivity) {
      throw new PointsError(`Cada jugador puede recibir de 0 a ${maxPerActivity} puntos.`);
    }
    if (e.points > 0) clean.set(e.userId, { userId: e.userId, name: e.name.slice(0, 64), points: e.points });
  }

  const data = load(config.guildId);
  const idx = data.awards.findIndex((a) => a.kind === 'activity' && a.id === ping.id);
  const previous = idx >= 0 ? data.awards[idx] : undefined;
  if (clean.size === 0) {
    if (idx >= 0) data.awards.splice(idx, 1);
    save(config.guildId, data);
    return { award: null, previous };
  }
  const award: PointsAward = {
    id: ping.id,
    kind: 'activity',
    title: ping.title.slice(0, 100),
    contentName: ping.contentName,
    callerId: ping.callerId,
    by: byUserId,
    // La fecha de la actividad es la del cierre: así una corrección no la mueve de semana
    at: previous?.at ?? ping.closedAt ?? now,
    updatedAt: previous ? now : undefined,
    entries: [...clean.values()].sort((a, b) => b.points - a.points),
  };
  if (idx >= 0) data.awards[idx] = award;
  else data.awards.push(award);
  save(config.guildId, data);
  return { award, previous };
}

/** Ajuste manual (Premium): suma o resta puntos a un jugador. */
export function addAdjustment(config: GuildConfig, userId: string, name: string, points: number, byUserId: string, note = '', now = Date.now()) {
  if (!getLimits(config).pointsPro) throw new PointsError('Los ajustes manuales son Premium.');
  if (!Number.isInteger(points) || points === 0 || Math.abs(points) > MAX_ADJUST) {
    throw new PointsError(`El ajuste debe ser un número entero entre -${MAX_ADJUST} y ${MAX_ADJUST}, distinto de 0.`);
  }
  const data = load(config.guildId);
  const award: PointsAward = {
    id: `adj-${crypto.randomBytes(6).toString('hex')}`,
    kind: 'adjust',
    title: 'Ajuste manual',
    by: byUserId,
    at: now,
    note: note.slice(0, 120) || undefined,
    entries: [{ userId, name: name.slice(0, 64), points }],
  };
  data.awards.push(award);
  save(config.guildId, data);
  return award;
}

/** Deshace un reparto o un ajuste. */
export function deleteAward(guildId: string, awardId: string): PointsAward {
  const data = load(guildId);
  const idx = data.awards.findIndex((a) => a.id === awardId);
  if (idx < 0) throw new PointsError('Ese registro ya no existe.');
  const [removed] = data.awards.splice(idx, 1);
  save(guildId, data);
  return removed;
}

/** Empieza una temporada nueva (Premium): el ranking total vuelve a cero. El historial se conserva. */
export function startSeason(config: GuildConfig, now = Date.now()) {
  if (!getLimits(config).pointsPro) throw new PointsError('Las temporadas son Premium.');
  const data = load(config.guildId);
  data.seasonStart = now;
  delete data.base;
  save(config.guildId, data);
  return now;
}

export function seasonStart(guildId: string): number | null {
  return load(guildId).seasonStart ?? null;
}

function periodFrom(guildId: string, period: RankingPeriod, now: number): number {
  if (period === 'week') return now - 7 * DAY_MS;
  if (period === 'month') return now - 30 * DAY_MS;
  return load(guildId).seasonStart ?? 0;
}

export interface RankingRow {
  userId: string;
  name: string;
  points: number;
  activities: number;
  rank: number;
}

/** Ranking completo de un periodo, ordenado (empates comparten puesto). */
export function ranking(guildId: string, period: RankingPeriod = 'total', now = Date.now()): RankingRow[] {
  const data = load(guildId);
  const from = periodFrom(guildId, period, now);
  const rows = new Map<string, { name: string; nameAt: number; points: number; activities: number }>();
  if (period === 'total' && data.base) {
    for (const [userId, b] of Object.entries(data.base)) rows.set(userId, { name: b.name, nameAt: 0, points: b.points, activities: b.activities });
  }
  for (const a of data.awards) {
    if (a.at < from) continue;
    for (const e of a.entries) {
      const r = rows.get(e.userId) ?? { name: e.name, nameAt: 0, points: 0, activities: 0 };
      r.points += e.points;
      if (a.kind === 'activity') r.activities++;
      if (a.at >= r.nameAt) {
        r.name = e.name;
        r.nameAt = a.at;
      }
      rows.set(e.userId, r);
    }
  }
  const sorted = [...rows]
    .filter(([, r]) => r.points !== 0)
    .map(([userId, r]) => ({ userId, name: r.name, points: r.points, activities: r.activities, rank: 0 }))
    .sort((a, b) => b.points - a.points || b.activities - a.activities || a.name.localeCompare(b.name));
  sorted.forEach((r, i) => {
    r.rank = i > 0 && sorted[i - 1].points === r.points ? sorted[i - 1].rank : i + 1;
  });
  return sorted;
}

/** Puntos de un jugador: puesto en el periodo y sus últimos movimientos. */
export function playerStats(guildId: string, userId: string, period: RankingPeriod = 'total', now = Date.now()) {
  const row = ranking(guildId, period, now).find((r) => r.userId === userId) ?? null;
  const from = periodFrom(guildId, period, now);
  const recent = load(guildId)
    .awards.filter((a) => a.at >= from && a.entries.some((e) => e.userId === userId))
    .sort((a, b) => b.at - a.at)
    .slice(0, 5)
    .map((a) => ({ id: a.id, kind: a.kind, title: a.title, at: a.at, points: a.entries.find((e) => e.userId === userId)!.points }));
  return { row, recent };
}

/** Últimos registros (repartos y ajustes), del más reciente al más antiguo. */
export function recentAwards(guildId: string, limit: number): PointsAward[] {
  return [...load(guildId).awards].sort((a, b) => b.at - a.at).slice(0, limit);
}

export function totalAwards(guildId: string): number {
  return load(guildId).awards.length;
}
