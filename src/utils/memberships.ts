import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  Entitlement,
  Events,
  PermissionFlagsBits,
} from 'discord.js';
import { GuildConfig } from '../types/ping';
import { ConfigManager } from './configManager';
import { panelUrl } from './panelLink';
import { botBrandName, getEffectiveTier, hasActiveSubscription, hasTimedPremium, premiumEndsAt, premiumSkuId, premiumStoreUrl } from './plans';

/**
 * Membresías Premium. Un servidor es Premium si tiene CUALQUIERA de estas fuentes vigente:
 *  - Suscripción de Discord (entitlement del SKU PREMIUM_SKU_ID): Discord cobra y renueva.
 *  - Tiempo concedido: a mano por el dueño (panel o /plan-admin) o canjeando un código.
 * Las fuentes no se pisan: cancelar la suscripción no borra los días canjeados y al revés.
 *
 * Todo cambio queda en el historial (data/memberships.json), junto con los códigos.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const STORE_PATH = path.join(process.cwd(), 'data', 'memberships.json');
const MAX_HISTORY = 5000;
/** El historial de Premium se guarda 2 años (lo indica la política de privacidad). */
const HISTORY_RETENTION_MS = 2 * 365 * DAY_MS;
const WARN_BEFORE_MS = 3 * DAY_MS;
const CHECK_EVERY_MS = 60 * 60 * 1000;

export type MembershipEventType =
  | 'grant' // el dueño fija Premium (N días o de por vida)
  | 'extend' // el dueño suma días
  | 'revoke' // el dueño lo quita
  | 'code_redeemed'
  | 'subscription_started'
  | 'subscription_updated'
  | 'subscription_ended'
  | 'expired'; // se acabó el tiempo concedido

export interface MembershipEvent {
  at: number;
  guildId: string;
  guildName?: string;
  type: MembershipEventType;
  actorId?: string; // usuario que lo hizo (dueño, quien canjea o quien paga)
  days?: number | null; // null = de por vida
  until?: number | null; // fin resultante del Premium por tiempo (null = de por vida)
  code?: string;
  note?: string;
}

export interface RedeemCode {
  code: string;
  days: number | null; // null = de por vida
  maxUses: number;
  uses: Array<{ guildId: string; guildName?: string; userId: string; at: number }>;
  createdAt: number;
  createdBy: string;
  expiresAt?: number; // el código deja de servir (no el Premium)
  note?: string;
  disabled?: boolean;
}

interface Store {
  codes: Record<string, RedeemCode>;
  history: MembershipEvent[];
}

export class MembershipError extends Error {}

// ---------- Almacenamiento ----------
let store: Store | null = null;

function load(): Store {
  if (store) return store;
  try {
    const raw = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8')) as Partial<Store>;
    store = { codes: raw.codes ?? {}, history: raw.history ?? [] };
  } catch {
    store = { codes: {}, history: [] };
  }
  return store;
}

function persist() {
  const s = load();
  const cutoff = Date.now() - HISTORY_RETENTION_MS;
  s.history = s.history.filter((e) => e.at >= cutoff).slice(-MAX_HISTORY);
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  const tmp = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(s, null, 2), 'utf-8');
  fs.renameSync(tmp, STORE_PATH);
}

function log(event: Omit<MembershipEvent, 'at'> & { at?: number }) {
  load().history.push({ at: Date.now(), ...event });
  persist();
}

export function getHistory(opts: { guildId?: string; limit?: number } = {}): MembershipEvent[] {
  const all = load().history;
  const filtered = opts.guildId ? all.filter((e) => e.guildId === opts.guildId) : all;
  return filtered.slice(-(opts.limit ?? 200)).reverse();
}

// ---------- Premium por tiempo (manual) ----------

/** Fija el Premium por tiempo: N días desde hoy, o de por vida si days es null. */
export function grantPremium(config: GuildConfig, days: number | null, actorId: string, note?: string): GuildConfig {
  config.plan = 'premium';
  config.premiumUntil = days ? Date.now() + days * DAY_MS : undefined;
  config.premiumSource = 'manual';
  config.notices = {};
  ConfigManager.saveConfig(config);
  log({ guildId: config.guildId, guildName: config.guildName, type: 'grant', actorId, days, until: config.premiumUntil ?? null, note });
  return config;
}

/** Suma días al Premium por tiempo (desde su fin actual, o desde hoy si no tiene). */
export function extendPremium(config: GuildConfig, days: number, actorId: string, note?: string): GuildConfig {
  addDays(config, days);
  config.premiumSource = 'manual';
  ConfigManager.saveConfig(config);
  log({ guildId: config.guildId, guildName: config.guildName, type: 'extend', actorId, days, until: config.premiumUntil ?? null, note });
  return config;
}

/** Quita el Premium por tiempo. La suscripción de Discord (si hay) solo la cancela quien paga. */
export function revokePremium(config: GuildConfig, actorId: string, note?: string): GuildConfig {
  config.plan = 'free';
  config.premiumUntil = undefined;
  config.premiumSource = undefined;
  ConfigManager.saveConfig(config);
  log({ guildId: config.guildId, guildName: config.guildName, type: 'revoke', actorId, note });
  return config;
}

function addDays(config: GuildConfig, days: number) {
  if (hasTimedPremium(config) && !config.premiumUntil) {
    throw new MembershipError('Este servidor ya tiene Premium de por vida.');
  }
  const base = hasTimedPremium(config) && config.premiumUntil ? config.premiumUntil : Date.now();
  config.plan = 'premium';
  config.premiumUntil = base + days * DAY_MS;
  config.notices = {};
}

// ---------- Códigos canjeables ----------
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I

function randomCode(): string {
  const bytes = crypto.randomBytes(8);
  const chars = [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
  return `MASS-${chars.slice(0, 4)}-${chars.slice(4)}`;
}

export function normalizeCode(input: string): string {
  const clean = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const body = clean.startsWith('MASS') ? clean.slice(4) : clean;
  return body.length === 8 ? `MASS-${body.slice(0, 4)}-${body.slice(4)}` : input.trim().toUpperCase();
}

export function createCodes(opts: {
  days: number | null;
  maxUses: number;
  count: number;
  expiresInDays?: number | null;
  note?: string;
  actorId: string;
}): RedeemCode[] {
  const s = load();
  const created: RedeemCode[] = [];
  for (let i = 0; i < opts.count; i++) {
    let code = randomCode();
    while (s.codes[code]) code = randomCode();
    const entry: RedeemCode = {
      code,
      days: opts.days,
      maxUses: opts.maxUses,
      uses: [],
      createdAt: Date.now(),
      createdBy: opts.actorId,
      expiresAt: opts.expiresInDays ? Date.now() + opts.expiresInDays * DAY_MS : undefined,
      note: opts.note || undefined,
    };
    s.codes[code] = entry;
    created.push(entry);
  }
  persist();
  return created;
}

export function listCodes(): RedeemCode[] {
  return Object.values(load().codes).sort((a, b) => b.createdAt - a.createdAt);
}

export function setCodeDisabled(code: string, disabled: boolean): RedeemCode {
  const entry = load().codes[code];
  if (!entry) throw new MembershipError('Código no encontrado.');
  entry.disabled = disabled;
  persist();
  return entry;
}

export function deleteCode(code: string): void {
  const s = load();
  if (!s.codes[code]) throw new MembershipError('Código no encontrado.');
  if (s.codes[code].uses.length > 0) throw new MembershipError('Ese código ya se usó: desactívalo en vez de borrarlo.');
  delete s.codes[code];
  persist();
}

export function codeStatus(c: RedeemCode, now = Date.now()): 'active' | 'used' | 'expired' | 'disabled' {
  if (c.disabled) return 'disabled';
  if (c.uses.length >= c.maxUses) return 'used';
  if (c.expiresAt && c.expiresAt < now) return 'expired';
  return 'active';
}

// Freno contra probar códigos al azar: 5 fallos cada 15 min por usuario
const failedAttempts = new Map<string, { count: number; resetAt: number }>();

export function redeemCode(input: string, config: GuildConfig, userId: string): { days: number | null; until: number | null } {
  const now = Date.now();
  const fails = failedAttempts.get(userId);
  if (fails && fails.resetAt > now && fails.count >= 5) {
    throw new MembershipError('Demasiados intentos fallidos. Prueba de nuevo en unos minutos.');
  }
  const fail = (msg: string): never => {
    const f = fails && fails.resetAt > now ? fails : { count: 0, resetAt: now + 15 * 60 * 1000 };
    f.count++;
    failedAttempts.set(userId, f);
    throw new MembershipError(msg);
  };

  const code = normalizeCode(input);
  const entry = load().codes[code];
  if (!entry) return fail('Ese código no existe. Revisa que esté bien escrito.');
  const status = codeStatus(entry, now);
  if (status === 'disabled') return fail('Ese código está desactivado.');
  if (status === 'expired') return fail('Ese código ya caducó.');
  if (status === 'used') return fail('Ese código ya se usó.');
  if (entry.uses.some((u) => u.guildId === config.guildId)) return fail('Este servidor ya canjeó ese código.');

  if (entry.days === null) {
    config.plan = 'premium';
    config.premiumUntil = undefined;
    config.notices = {};
  } else {
    addDays(config, entry.days); // lanza si ya es de por vida
  }
  config.premiumSource = 'code';
  entry.uses.push({ guildId: config.guildId, guildName: config.guildName, userId, at: now });
  ConfigManager.saveConfig(config);
  failedAttempts.delete(userId);
  log({
    guildId: config.guildId,
    guildName: config.guildName,
    type: 'code_redeemed',
    actorId: userId,
    days: entry.days,
    until: config.premiumUntil ?? null,
    code,
  });
  return { days: entry.days, until: config.premiumUntil ?? null };
}

// ---------- Suscripciones de Discord ----------

function isPremiumEntitlement(e: Entitlement): e is Entitlement & { guildId: string } {
  const sku = premiumSkuId();
  return Boolean(sku && e.skuId === sku && e.guildId);
}

/**
 * Aplica un entitlement de Discord a la config del servidor.
 * Devuelve el tipo de evento registrado (o null si no cambió nada relevante).
 */
export function applyEntitlement(client: Client, e: Entitlement, removed = false): MembershipEventType | null {
  if (!isPremiumEntitlement(e)) return null;
  const guildName = client.guilds.cache.get(e.guildId)?.name;
  const config = ConfigManager.getConfig(e.guildId, guildName);
  const prev = config.subscription;
  const active = !removed && !e.deleted && e.isActive();
  const next = {
    entitlementId: e.id,
    userId: e.userId,
    startsAt: e.startsTimestamp ?? undefined,
    endsAt: e.endsTimestamp ?? undefined,
    active,
    updatedAt: Date.now(),
  };

  // Otro entitlement ya inactivo no debe pisar una suscripción vigente distinta
  if (!active && prev?.active && prev.entitlementId !== e.id) return null;

  const same = prev && prev.entitlementId === next.entitlementId && prev.active === next.active && prev.endsAt === next.endsAt;
  if (same) return null;

  config.subscription = next;
  if (active) config.notices = {};
  ConfigManager.saveConfig(config);

  const type: MembershipEventType = !active
    ? 'subscription_ended'
    : !prev?.active || prev.entitlementId !== e.id
      ? 'subscription_started'
      : 'subscription_updated';
  log({
    guildId: e.guildId,
    guildName: config.guildName,
    type,
    actorId: e.userId,
    until: next.endsAt ?? null,
    note: next.endsAt && active ? 'Cancelada: no se renovará' : undefined,
  });
  return type;
}

/** Descarga de Discord todas las suscripciones vigentes y corrige las guardadas. */
export async function syncEntitlements(client: Client): Promise<{ active: number; ended: number }> {
  const sku = premiumSkuId();
  if (!sku || !client.application) return { active: 0, ended: 0 };
  const seen = new Set<string>();
  let after: string | undefined;
  for (let page = 0; page < 100; page++) {
    const batch = await client.application.entitlements.fetch({ skus: [sku], excludeEnded: true, limit: 100, after, cache: false });
    for (const e of batch.values()) {
      if (!isPremiumEntitlement(e)) continue;
      if (e.isActive()) seen.add(e.guildId);
      applyEntitlement(client, e);
    }
    if (batch.size < 100) break;
    after = [...batch.keys()].sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1)).pop();
  }

  // Las guardadas como activas que Discord ya no devuelve: terminaron mientras el bot estaba apagado
  let ended = 0;
  for (const guildId of ConfigManager.listStoredGuildIds()) {
    const stored = ConfigManager.peekConfig(guildId);
    if (!stored?.subscription?.active || seen.has(guildId)) continue;
    const config = ConfigManager.getConfig(guildId);
    config.subscription = { ...config.subscription!, active: false, updatedAt: Date.now() };
    ConfigManager.saveConfig(config);
    log({ guildId, guildName: config.guildName, type: 'subscription_ended', actorId: config.subscription.userId });
    ended++;
  }
  return { active: seen.size, ended };
}

// ---------- Avisos de vencimiento ----------

function noticeComponents(guildId: string) {
  const row = new ActionRowBuilder<ButtonBuilder>();
  const store = premiumStoreUrl();
  if (store) row.addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(store).setLabel('Suscribirse a Premium').setEmoji('💎'));
  const panel = panelUrl(guildId, 'plan');
  if (panel) row.addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(panel).setLabel('Ver el plan').setEmoji('🖥️'));
  return row.components.length ? [row] : [];
}

/** Avisa al dueño del servidor por MD; si no se puede, en el canal de pings o el de sistema. */
async function notifyGuild(client: Client, guildId: string, embed: EmbedBuilder) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;
  const payload = { embeds: [embed], components: noticeComponents(guildId) };
  try {
    const owner = await guild.fetchOwner();
    await owner.send(payload);
    return;
  } catch {
    // MD cerrados: probamos en el servidor
  }
  const config = ConfigManager.getConfig(guildId);
  const me = guild.members.me;
  for (const id of [config.pingTargetChannelId, guild.systemChannelId]) {
    const channel = id ? guild.channels.cache.get(id) : undefined;
    if (!channel?.isTextBased() || !me || !channel.permissionsFor(me)?.has(PermissionFlagsBits.SendMessages)) continue;
    try {
      await channel.send(payload);
      return;
    } catch {
      // siguiente opción
    }
  }
}

function noticeEmbed(config: GuildConfig, title: string, text: string) {
  return new EmbedBuilder()
    .setColor(0xd4af37)
    .setAuthor({ name: `${botBrandName()} • ${config.guildName}`.slice(0, 256) })
    .setTitle(title)
    .setDescription(text);
}

/**
 * Revisa vencimientos de todos los servidores donde está el bot:
 * avisa 3 días antes y cuando vuelven a gratis, y limpia el Premium por tiempo vencido.
 */
export async function checkExpirations(client: Client, now = Date.now()) {
  for (const guild of client.guilds.cache.values()) {
    const config = ConfigManager.getConfig(guild.id, guild.name);
    config.notices ||= {};
    let changed = false;

    // 1. Se acabó el tiempo concedido
    if (config.plan === 'premium' && config.premiumUntil && config.premiumUntil <= now) {
      const endedAt = config.premiumUntil;
      config.plan = 'free';
      config.premiumUntil = undefined;
      config.premiumSource = undefined;
      changed = true;
      log({ guildId: guild.id, guildName: config.guildName, type: 'expired', until: endedAt });
      if (!hasActiveSubscription(config, now) && config.notices.expiredFor !== endedAt) {
        config.notices.expiredFor = endedAt;
        await notifyGuild(
          client,
          guild.id,
          noticeEmbed(config, 'Tu Premium terminó', `**${guild.name}** volvió al plan gratis. Tus contenidos y ajustes se conservan; la marca propia deja de mostrarse en los pings.`)
        );
      }
    }

    // 2. La suscripción cancelada llegó a su fin
    const sub = config.subscription;
    if (sub?.active && sub.endsAt && sub.endsAt <= now) {
      config.subscription = { ...sub, active: false, updatedAt: now };
      changed = true;
      log({ guildId: guild.id, guildName: config.guildName, type: 'subscription_ended', actorId: sub.userId, until: sub.endsAt });
      if (getEffectiveTier(config, now) === 'free' && config.notices.expiredFor !== sub.endsAt) {
        config.notices.expiredFor = sub.endsAt;
        await notifyGuild(client, guild.id, noticeEmbed(config, 'Tu suscripción Premium terminó', `**${guild.name}** volvió al plan gratis. Puedes suscribirte otra vez cuando quieras.`));
      }
    }

    // 3. Aviso previo
    const endsAt = premiumEndsAt(config, now);
    if (endsAt && endsAt - now <= WARN_BEFORE_MS && config.notices.warnedFor !== endsAt) {
      config.notices.warnedFor = endsAt;
      changed = true;
      await notifyGuild(
        client,
        guild.id,
        noticeEmbed(
          config,
          'Tu Premium está por vencer',
          `El Premium de **${guild.name}** termina <t:${Math.floor(endsAt / 1000)}:R> (<t:${Math.floor(endsAt / 1000)}:f>).\nPara no perder la marca propia y los límites ampliados, renueva o canjea un código con \`/canjear\`.`
        )
      );
    }

    if (changed) ConfigManager.saveConfig(config);
  }
}

export function startMemberships(client: Client) {
  client.on(Events.EntitlementCreate, (e) => void applyEntitlement(client, e));
  client.on(Events.EntitlementUpdate, (_old, e) => void applyEntitlement(client, e));
  client.on(Events.EntitlementDelete, (e) => void applyEntitlement(client, e, true));

  const run = async () => {
    try {
      const r = await syncEntitlements(client);
      if (premiumSkuId()) console.log(`💎 Suscripciones: ${r.active} activas${r.ended ? `, ${r.ended} terminadas mientras el bot estaba apagado` : ''}.`);
    } catch (err) {
      console.error('Error sincronizando suscripciones de Discord:', err);
    }
    try {
      await checkExpirations(client);
    } catch (err) {
      console.error('Error revisando vencimientos de Premium:', err);
    }
  };
  void run();
  setInterval(() => void checkExpirations(client).catch((err) => console.error('Error revisando vencimientos:', err)), CHECK_EVERY_MS).unref();
  // Resincroniza con Discord cada 12 h por si se perdió algún evento
  setInterval(() => void syncEntitlements(client).catch(() => null), 12 * CHECK_EVERY_MS).unref();
}
