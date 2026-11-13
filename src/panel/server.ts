import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import Fastify, { FastifyReply, FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { ChannelType, Client, Guild, PermissionFlagsBits } from 'discord.js';
import { allItems } from '../data/items';
import { cloneDefaultContentTypes } from '../data/defaultTemplates';
import { ConfigManager } from '../utils/configManager';
import { deleteCustomLogo, saveCustomLogoBuffer } from '../utils/logo';
import { closePingExternally } from '../utils/pingSweeper';
import {
  botBrandName,
  getEffectiveTier,
  getLimits,
  hasActiveSubscription,
  hasTimedPremium,
  premiumEndsAt,
  premiumPackages,
  premiumSkuId,
  premiumStoreUrl,
} from '../utils/plans';
import { createPreference, getPayment, isValidSignature, mapStatus, mercadoPagoEnv } from '../payments/mercadopago';
import {
  codeStatus,
  createCodes,
  createOrder,
  getOrder,
  listOrders,
  settleOrder,
  deleteCode,
  extendPremium,
  getHistory,
  grantPremium,
  listCodes,
  MembershipError,
  redeemCode,
  RedeemCode,
  revokePremium,
  setCodeDisabled,
} from '../utils/memberships';
import { splitRoleLabel } from '../utils/ui';
import {
  addAdjustment,
  deleteAward,
  getActivityAward,
  participantsOf,
  pointsSettings,
  PointsError,
  proposedEntries,
  ranking,
  recentAwards,
  seasonStart,
  setActivityAward,
  startSeason,
  updatePointsSettings,
} from '../utils/points';
import { authorizeUrl, canManage, exchangeCode, fetchUser, fetchUserGuilds, PanelEnv } from './discordOAuth';
import { createSession, destroySession, getSession, PanelSession, SESSION_COOKIE, SESSION_TTL_MS } from './sessions';
import {
  brandingSchema,
  adminPlanSchema,
  checkoutSchema,
  closePingSchema,
  pointsAdjustSchema,
  pointsAwardSchema,
  pointsSettingsSchema,
  rankingPeriodSchema,
  codeUpdateSchema,
  contentSchema,
  createCodesSchema,
  redeemSchema,
  firstIssue,
  logoSchema,
  settingsSchema,
  snowflake,
  toContentType,
} from './validation';
import { GuildConfig } from '../types/ping';
import { z } from 'zod';

/**
 * Panel web de administración (https://panel.massup.shop).
 * Corre dentro del mismo proceso que el bot: lee y guarda la misma configuración en memoria,
 * así un cambio en el panel se ve al instante en Discord.
 *
 * Variables de entorno: PANEL_URL, PANEL_PORT, DISCORD_CLIENT_SECRET, SESSION_SECRET.
 */

const STATE_COOKIE = 'massup_oauth_state';
const DIST = path.join(process.cwd(), 'dashboard', 'dist');
const GUILDS_REFRESH_MS = 5 * 60 * 1000;

declare module 'fastify' {
  interface FastifyRequest {
    panelSession?: PanelSession;
  }
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Caché corta del permiso real (miembro del servidor) para no consultar a Discord en cada clic
const permCache = new Map<string, { ok: boolean; at: number }>();

export async function startPanel(client: Client) {
  const panelUrl = process.env.PANEL_URL?.replace(/\/$/, '');
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const sessionSecret = process.env.SESSION_SECRET;
  const clientId = process.env.CLIENT_ID;
  if (!panelUrl || !clientSecret || !sessionSecret || !clientId) {
    console.log('ℹ️ Panel web desactivado (faltan PANEL_URL, DISCORD_CLIENT_SECRET o SESSION_SECRET en .env).');
    return;
  }
  if (sessionSecret.length < 32) {
    console.error('❌ SESSION_SECRET debe tener al menos 32 caracteres. Panel desactivado.');
    return;
  }

  const env: PanelEnv = { clientId, clientSecret, panelUrl };
  const panelOrigin = new URL(panelUrl).origin;
  const secureCookies = panelUrl.startsWith('https://');
  const port = Number(process.env.PANEL_PORT) || 3000;

  const app = Fastify({ logger: false, bodyLimit: 7 * 1024 * 1024, trustProxy: true });
  await app.register(cookie, { secret: sessionSecret });
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  // ---------- Cabeceras de seguridad ----------
  app.addHook('onSend', async (_req, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        // El pago con Mercado Pago es una redirección a su web: no carga nada de terceros aquí
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https://cdn.discordapp.com https://render.albiononline.com",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'none'",
        "form-action 'self'",
      ].join('; ')
    );
    if (secureCookies) reply.header('Strict-Transport-Security', 'max-age=31536000');
    return payload;
  });

  // ---------- Sesión y protección CSRF ----------
  app.addHook('preHandler', async (req) => {
    const raw = req.cookies[SESSION_COOKIE];
    const unsigned = raw ? req.unsignCookie(raw) : null;
    req.panelSession = unsigned?.valid ? getSession(unsigned.value ?? undefined) : undefined;

    // Cualquier petición que cambie datos debe venir del propio panel (no de otra web)
    if (req.url.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.headers.origin;
      if (origin !== panelOrigin) throw new HttpError(403, 'Origen no permitido');
    }
  });

  app.setErrorHandler((err, _req, reply) => {
    const e = err as Error & { status?: number; statusCode?: number };
    const status = e instanceof HttpError ? e.status : e.statusCode && e.statusCode < 500 ? e.statusCode : 500;
    if (status >= 500) console.error('[Panel] Error:', err);
    reply.status(status).send({ error: status >= 500 ? 'Error interno' : e.message });
  });

  const requireSession = (req: FastifyRequest): PanelSession => {
    if (!req.panelSession) throw new HttpError(401, 'Inicia sesión');
    return req.panelSession;
  };

  /** Comprueba (con datos reales del servidor) que el usuario puede gestionarlo y que el bot está dentro. */
  const requireGuild = async (req: FastifyRequest): Promise<{ guild: Guild; config: GuildConfig; session: PanelSession }> => {
    const session = requireSession(req);
    const id = (req.params as { guildId?: string }).guildId;
    if (!id || !snowflake.safeParse(id).success) throw new HttpError(400, 'Servidor no válido');
    const guild = client.guilds.cache.get(id);
    if (!guild) throw new HttpError(404, 'El bot no está en ese servidor');

    const key = `${id}:${session.userId}`;
    const cached = permCache.get(key);
    let ok = cached && Date.now() - cached.at < 60_000 ? cached.ok : undefined;
    if (ok === undefined) {
      const member = await guild.members.fetch(session.userId).catch(() => null);
      ok = Boolean(member?.permissions.has(PermissionFlagsBits.ManageGuild));
      permCache.set(key, { ok, at: Date.now() });
    }
    if (!ok) throw new HttpError(403, 'Necesitas el permiso Gestionar servidor');
    return { guild, config: ConfigManager.getConfig(guild.id, guild.name), session };
  };

  const parse = <S extends z.ZodType>(schema: S, body: unknown): z.output<S> => {
    const r = schema.safeParse(body);
    if (!r.success) throw new HttpError(400, firstIssue(r.error));
    return r.data;
  };

  // ---------- Login con Discord ----------
  app.get('/auth/login', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (_req, reply) => {
    const state = crypto.randomBytes(24).toString('base64url');
    reply.setCookie(STATE_COOKIE, state, {
      path: '/auth',
      httpOnly: true,
      secure: secureCookies,
      sameSite: 'lax',
      signed: true,
      maxAge: 600,
    });
    return reply.redirect(authorizeUrl(env, state));
  });

  app.get('/auth/callback', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { code, state } = req.query as { code?: string; state?: string };
    const raw = req.cookies[STATE_COOKIE];
    const expected = raw ? req.unsignCookie(raw) : null;
    reply.clearCookie(STATE_COOKIE, { path: '/auth' });
    if (!code || !state || !expected?.valid || expected.value !== state) {
      return reply.redirect('/?error=login');
    }
    try {
      const token = await exchangeCode(env, code);
      const [user, guilds] = await Promise.all([fetchUser(token.access_token), fetchUserGuilds(token.access_token)]);
      const session = createSession({
        userId: user.id,
        username: user.username,
        globalName: user.global_name,
        avatar: user.avatar,
        accessToken: token.access_token,
        tokenExpiresAt: Date.now() + token.expires_in * 1000,
        guilds,
        guildsFetchedAt: Date.now(),
      });
      reply.setCookie(SESSION_COOKIE, session.id, {
        path: '/',
        httpOnly: true,
        secure: secureCookies,
        sameSite: 'lax',
        signed: true,
        maxAge: Math.floor(SESSION_TTL_MS / 1000),
      });
      return reply.redirect('/');
    } catch (err) {
      console.warn('[Panel] Login fallido:', (err as Error).message);
      return reply.redirect('/?error=login');
    }
  });

  app.post('/api/logout', async (req, reply) => {
    destroySession(req.panelSession?.id);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  // ---------- Usuario y servidores ----------
  app.get('/api/me', async (req) => {
    const session = requireSession(req);
    if (Date.now() - session.guildsFetchedAt > GUILDS_REFRESH_MS) {
      try {
        session.guilds = await fetchUserGuilds(session.accessToken);
        session.guildsFetchedAt = Date.now();
      } catch (err) {
        if ((err as { status?: number }).status === 401) {
          destroySession(session.id);
          throw new HttpError(401, 'La sesión caducó, vuelve a entrar');
        }
      }
    }
    const invite = `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=326417763344&integration_type=0&scope=bot+applications.commands`;
    return {
      user: {
        id: session.userId,
        name: session.globalName || session.username,
        avatar: session.avatar ? `https://cdn.discordapp.com/avatars/${session.userId}/${session.avatar}.png?size=64` : null,
        isOwner: Boolean(process.env.BOT_OWNER_ID && session.userId === process.env.BOT_OWNER_ID),
      },
      guilds: session.guilds
        .filter(canManage)
        .map((g) => ({
          id: g.id,
          name: g.name,
          icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=64` : null,
          botPresent: client.guilds.cache.has(g.id),
          inviteUrl: `${invite}&guild_id=${g.id}&disable_guild_select=true`,
        }))
        .sort((a, b) => Number(b.botPresent) - Number(a.botPresent) || a.name.localeCompare(b.name)),
    };
  });

  // ---------- Datos de un servidor ----------
  const serializeGuild = (guild: Guild, config: GuildConfig) => {
    const tier = getEffectiveTier(config);
    const limits = getLimits(config);
    const me = guild.members.me;
    const roles = [...guild.roles.cache.values()]
      .filter((r) => r.id !== guild.id && !r.managed)
      .sort((a, b) => b.position - a.position)
      .map((r) => ({ id: r.id, name: r.name, color: r.hexColor, mentionable: r.mentionable }));
    const channels = [...guild.channels.cache.values()]
      .filter((c) => c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement)
      .sort((a, b) => ('position' in a && 'position' in b ? a.position - b.position : 0))
      .map((c) => ({ id: c.id, name: c.name, botCanSend: Boolean(me && c.permissionsFor(me)?.has(PermissionFlagsBits.SendMessages)) }));
    const categories = [...guild.channels.cache.values()]
      .filter((c) => c.type === ChannelType.GuildCategory)
      .map((c) => ({ id: c.id, name: c.name }));
    const pings = Object.values(ConfigManager.getActivePings(guild.id))
      .filter((p) => p.status === 'OPEN' || p.status === 'IN_PROGRESS')
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((p) => ({
        id: p.id,
        title: p.title,
        contentName: p.contentName,
        status: p.status,
        callerName: p.callerName,
        startTimeUnix: p.startTimeUnix,
        channelId: p.channelId,
        url: `https://discord.com/channels/${guild.id}/${p.channelId}/${p.messageId}`,
        joined: Object.values(p.roster).reduce((acc, l) => acc + l.length, 0),
        max: p.roles.reduce((acc, r) => acc + (r.maxSlots || 0), 0),
      }));

    return {
      guild: { id: guild.id, name: guild.name, icon: guild.iconURL({ extension: 'png', size: 128 }) },
      plan: {
        tier,
        limits,
        premiumUntil: config.premiumUntil ?? null,
        endsAt: premiumEndsAt(config) ?? null,
        timed: hasTimedPremium(config) ? { source: config.premiumSource ?? 'manual', until: config.premiumUntil ?? null } : null,
        subscription: hasActiveSubscription(config) ? { endsAt: config.subscription!.endsAt ?? null } : null,
        storeUrl: premiumStoreUrl(),
        payments: mercadoPagoEnv()
          ? {
              test: mercadoPagoEnv()!.test,
              packages: premiumPackages().map(({ id, label, days, priceCop }) => ({ id, label, days, priceCop })),
            }
          : null,
        history: getHistory({ guildId: guild.id, limit: 15 }).map(({ at, type, days, until, code }) => ({
          at,
          type,
          days,
          until,
          code: code ? `${code.slice(0, 5)}••••-${code.slice(-4)}` : undefined,
        })),
      },
      settings: {
        callerRoleId: config.callerRoleId ?? null,
        defaultPingRoleId: config.defaultPingRoleId ?? null,
        pingTargetChannelId: config.pingTargetChannelId ?? null,
        voiceCategoryId: config.voiceCategoryId ?? null,
        pingRoles: config.pingRoles,
      },
      branding: {
        guildName: config.guildName,
        guildTag: config.guildTag,
        motto: config.motto,
        color: `#${config.colors.embedHex.toString(16).padStart(6, '0').toUpperCase()}`,
        customLogo: Boolean(config.customLogo),
      },
      contents: config.contentTypes.map((c) => ({
        ...c,
        roles: c.roles.map((r) => {
          const { name, weapons } = splitRoleLabel(r.label);
          return { id: r.id, name, weapons: weapons ?? '', emoji: r.emoji, maxSlots: r.maxSlots, description: r.description ?? '', build: r.build ?? {}, swaps: r.swaps ?? [] };
        }),
      })),
      discord: { roles, channels, categories },
      pings,
    };
  };

  app.get('/api/guilds/:guildId', async (req) => {
    const { guild, config } = await requireGuild(req);
    return serializeGuild(guild, config);
  });

  app.patch('/api/guilds/:guildId/settings', async (req) => {
    const { guild, config } = await requireGuild(req);
    const body = parse(settingsSchema, req.body);
    const roleOk = (id: string | null | undefined) => !id || (guild.roles.cache.has(id) && id !== guild.id);
    const textOk = (id: string | null | undefined) => {
      if (!id) return true;
      const c = guild.channels.cache.get(id);
      return Boolean(c && (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement));
    };
    const catOk = (id: string | null | undefined) => !id || guild.channels.cache.get(id)?.type === ChannelType.GuildCategory;

    if (!roleOk(body.callerRoleId) || !roleOk(body.defaultPingRoleId)) throw new HttpError(400, 'Rol no válido');
    if (!textOk(body.pingTargetChannelId)) throw new HttpError(400, 'Canal no válido');
    if (!catOk(body.voiceCategoryId)) throw new HttpError(400, 'Categoría no válida');

    if (body.callerRoleId !== undefined) config.callerRoleId = body.callerRoleId ?? undefined;
    if (body.defaultPingRoleId !== undefined) config.defaultPingRoleId = body.defaultPingRoleId ?? undefined;
    if (body.pingTargetChannelId !== undefined) config.pingTargetChannelId = body.pingTargetChannelId ?? undefined;
    if (body.voiceCategoryId !== undefined) config.voiceCategoryId = body.voiceCategoryId ?? undefined;
    if (body.pingRoles) {
      const contentIds = new Set(config.contentTypes.map((c) => c.id));
      for (const [contentId, roleId] of Object.entries(body.pingRoles)) {
        if (!contentIds.has(contentId)) continue;
        if (!roleOk(roleId)) throw new HttpError(400, 'Rol de aviso no válido');
        if (roleId) config.pingRoles[contentId] = roleId;
        else delete config.pingRoles[contentId];
      }
    }
    ConfigManager.saveConfig(config);
    return serializeGuild(guild, config);
  });

  // ---------- Contenidos, compos y builds ----------
  app.post('/api/guilds/:guildId/contents', async (req) => {
    const { guild, config } = await requireGuild(req);
    if (config.contentTypes.length >= getLimits(config).maxContentTypes) {
      throw new HttpError(403, `Tu plan permite ${getLimits(config).maxContentTypes} contenidos`);
    }
    const input = parse(contentSchema, req.body);
    let id =
      input.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 24) || 'contenido';
    while (config.contentTypes.some((c) => c.id === id)) id = `${id.slice(0, 20)}_${crypto.randomBytes(2).toString('hex')}`;
    ConfigManager.upsertContentType(guild.id, toContentType(id, input));
    return serializeGuild(guild, ConfigManager.getConfig(guild.id));
  });

  app.put('/api/guilds/:guildId/contents/:contentId', async (req) => {
    const { guild, config } = await requireGuild(req);
    const { contentId } = req.params as { contentId: string };
    if (!config.contentTypes.some((c) => c.id === contentId)) throw new HttpError(404, 'Contenido no encontrado');
    const input = parse(contentSchema, req.body);
    ConfigManager.upsertContentType(guild.id, toContentType(contentId, input));
    return serializeGuild(guild, ConfigManager.getConfig(guild.id));
  });

  app.delete('/api/guilds/:guildId/contents/:contentId', async (req) => {
    const { guild, config } = await requireGuild(req);
    const { contentId } = req.params as { contentId: string };
    if (config.contentTypes.length <= 1) throw new HttpError(400, 'Debe quedar al menos un contenido');
    if (!ConfigManager.deleteContentType(guild.id, contentId)) throw new HttpError(404, 'Contenido no encontrado');
    return serializeGuild(guild, ConfigManager.getConfig(guild.id));
  });

  app.post('/api/guilds/:guildId/contents/reset', async (req) => {
    const { guild } = await requireGuild(req);
    ConfigManager.resetContentTypes(guild.id);
    return serializeGuild(guild, ConfigManager.getConfig(guild.id));
  });

  app.get('/api/default-contents', async (req) => {
    requireSession(req);
    return cloneDefaultContentTypes().map((c) => ({ id: c.id, name: c.name, emoji: c.emoji }));
  });

  // ---------- Marca y logo (Premium) ----------
  const requirePremium = (config: GuildConfig) => {
    if (!getLimits(config).customBranding) throw new HttpError(403, 'Función Premium');
  };

  app.patch('/api/guilds/:guildId/branding', async (req) => {
    const { guild, config } = await requireGuild(req);
    requirePremium(config);
    const body = parse(brandingSchema, req.body);
    if (body.guildName !== undefined && body.guildName) config.guildName = body.guildName.toUpperCase();
    if (body.guildTag !== undefined) config.guildTag = body.guildTag;
    if (body.motto !== undefined) config.motto = body.motto.toUpperCase();
    if (body.color) config.colors.embedHex = parseInt(body.color.slice(1), 16);
    ConfigManager.saveConfig(config);
    return serializeGuild(guild, config);
  });

  app.put('/api/guilds/:guildId/logo', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req) => {
    const { guild, config } = await requireGuild(req);
    requirePremium(config);
    const { dataUrl } = parse(logoSchema, req.body);
    const buf = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
    try {
      await saveCustomLogoBuffer(guild.id, buf);
    } catch (err) {
      throw new HttpError(400, `No pude usar esa imagen: ${(err as Error).message}`);
    }
    config.customLogo = true;
    ConfigManager.saveConfig(config);
    return serializeGuild(guild, config);
  });

  app.delete('/api/guilds/:guildId/logo', async (req) => {
    const { guild, config } = await requireGuild(req);
    deleteCustomLogo(guild.id);
    config.customLogo = false;
    ConfigManager.saveConfig(config);
    return serializeGuild(guild, config);
  });

  // ---------- Pings activos ----------
  app.post('/api/guilds/:guildId/pings/:pingId/close', async (req) => {
    const { guild, config, session } = await requireGuild(req);
    const { pingId } = req.params as { pingId: string };
    const { status } = parse(closePingSchema, req.body);
    const ping = ConfigManager.getPing(guild.id, pingId);
    if (!ping || (ping.status !== 'OPEN' && ping.status !== 'IN_PROGRESS')) throw new HttpError(404, 'Ping no encontrado');
    const member = guild.members.cache.get(session.userId);
    await closePingExternally(guild, ping, status, {
      id: session.userId,
      name: member?.displayName ?? session.globalName ?? session.username,
    });
    return serializeGuild(guild, config);
  });

  // ---------- Puntos de actividad ----------
  const pointsCall = <T>(fn: () => T): T => {
    try {
      return fn();
    } catch (err) {
      if (err instanceof PointsError) throw new HttpError(400, err.message);
      throw err;
    }
  };

  const serializePoints = (guild: Guild, config: GuildConfig, period: 'total' | 'month' | 'week') => {
    const limits = getLimits(config);
    const pro = limits.pointsPro;
    const p = pro ? period : 'total';
    const nameOf = (id: string) => guild.members.cache.get(id)?.displayName ?? null;
    const pending = Object.values(ConfigManager.getActivePings(guild.id))
      .filter((ping) => ping.status === 'CLOSED')
      .sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0))
      .map((ping) => {
        const award = getActivityAward(guild.id, ping.id);
        return {
          pingId: ping.id,
          title: ping.title,
          contentName: ping.contentName,
          callerName: ping.callerName,
          closedAt: ping.closedAt ?? ping.createdAt,
          participants: participantsOf(ping).length,
          awarded: award ? award.entries.reduce((s, e) => s + e.points, 0) : null,
        };
      });
    return {
      settings: pointsSettings(config),
      pro,
      rankingSize: limits.pointsRankingSize,
      period: p,
      seasonStart: seasonStart(guild.id),
      ranking: ranking(guild.id, p).slice(0, pro ? 200 : limits.pointsRankingSize),
      awards: recentAwards(guild.id, pro ? 100 : 10).map((a) => ({
        id: a.id,
        kind: a.kind,
        title: a.title,
        contentName: a.contentName ?? null,
        by: a.by,
        byName: nameOf(a.by),
        at: a.at,
        updatedAt: a.updatedAt ?? null,
        note: a.note ?? null,
        total: a.entries.reduce((s, e) => s + e.points, 0),
        entries: a.entries,
      })),
      pending,
    };
  };

  const periodOf = (req: FastifyRequest) => rankingPeriodSchema.parse((req.query as { period?: string }).period);

  app.get('/api/guilds/:guildId/points', async (req) => {
    const { guild, config } = await requireGuild(req);
    return serializePoints(guild, config, periodOf(req));
  });

  app.patch('/api/guilds/:guildId/points/settings', async (req) => {
    const { guild, config } = await requireGuild(req);
    const body = parse(pointsSettingsSchema, req.body);
    updatePointsSettings(config, body);
    ConfigManager.saveConfig(config);
    return serializePoints(guild, config, periodOf(req));
  });

  const closedPing = (guildId: string, pingId: string) => {
    const ping = ConfigManager.getPing(guildId, pingId);
    if (!ping) throw new HttpError(404, 'Esa salida ya no está guardada (se borran 3 días después de cerrarse)');
    return ping;
  };

  app.get('/api/guilds/:guildId/points/pings/:pingId', async (req) => {
    const { guild, config } = await requireGuild(req);
    const ping = closedPing(guild.id, (req.params as { pingId: string }).pingId);
    return {
      pingId: ping.id,
      title: ping.title,
      max: pointsSettings(config).maxPerActivity,
      entries: proposedEntries(config, ping),
    };
  });

  app.put('/api/guilds/:guildId/points/pings/:pingId', async (req) => {
    const { guild, config, session } = await requireGuild(req);
    const ping = closedPing(guild.id, (req.params as { pingId: string }).pingId);
    const { entries } = parse(pointsAwardSchema, req.body);
    // Solo participantes o jugadores ya puntuados (los nombres salen de ahí, no del navegador)
    const known = new Map(proposedEntries(config, ping).map((e) => [e.userId, e.name]));
    const clean = entries.filter((e) => known.has(e.userId)).map((e) => ({ ...e, name: known.get(e.userId)! }));
    pointsCall(() => setActivityAward(config, ping, clean, session.userId));
    return serializePoints(guild, config, periodOf(req));
  });

  app.post('/api/guilds/:guildId/points/adjust', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req) => {
    const { guild, config, session } = await requireGuild(req);
    const body = parse(pointsAdjustSchema, req.body);
    const member = await guild.members.fetch(body.userId).catch(() => null);
    if (!member) throw new HttpError(400, 'Ese usuario no está en el servidor');
    if (member.user.bot) throw new HttpError(400, 'Los bots no tienen puntos');
    pointsCall(() => addAdjustment(config, member.id, member.displayName, body.points, session.userId, body.note));
    return serializePoints(guild, config, periodOf(req));
  });

  app.delete('/api/guilds/:guildId/points/awards/:awardId', async (req) => {
    const { guild, config } = await requireGuild(req);
    const { awardId } = req.params as { awardId: string };
    if (!/^[\w-]{1,40}$/.test(awardId)) throw new HttpError(400, 'Registro no válido');
    pointsCall(() => deleteAward(guild.id, awardId));
    return serializePoints(guild, config, periodOf(req));
  });

  app.post('/api/guilds/:guildId/points/season', async (req) => {
    const { guild, config } = await requireGuild(req);
    pointsCall(() => startSeason(config));
    return serializePoints(guild, config, periodOf(req));
  });

  // ---------- Plan y membresía del servidor ----------
  app.post('/api/guilds/:guildId/redeem', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req) => {
    const { guild, config, session } = await requireGuild(req);
    const { code } = parse(redeemSchema, req.body);
    try {
      redeemCode(code, config, session.userId);
    } catch (err) {
      if (err instanceof MembershipError) throw new HttpError(400, err.message);
      throw err;
    }
    return serializeGuild(guild, config);
  });

  const membershipCall = <T>(fn: () => T): T => {
    try {
      return fn();
    } catch (err) {
      if (err instanceof MembershipError) throw new HttpError(400, err.message);
      throw err;
    }
  };

  // ---------- Pagos con Mercado Pago (paquetes prepagados) ----------
  app.post('/api/guilds/:guildId/checkout', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req) => {
    const pay = mercadoPagoEnv();
    if (!pay) throw new HttpError(404, 'Los pagos no están activados');
    const { guild, config, session } = await requireGuild(req);
    const { packageId } = parse(checkoutSchema, req.body);
    const pkg = premiumPackages().find((p) => p.id === packageId);
    if (!pkg) throw new HttpError(400, 'Paquete no válido');
    if (hasTimedPremium(config) && !config.premiumUntil) throw new HttpError(400, 'Este servidor ya tiene Premium de por vida');

    const order = createOrder({
      guildId: guild.id,
      guildName: guild.name,
      userId: session.userId,
      packageId: pkg.id,
      days: pkg.days,
      amount: pkg.priceCop,
      currency: 'COP',
      test: pay.test,
      provider: 'mercadopago',
    });
    try {
      const url = await createPreference(pay, {
        invoice: order.invoice,
        title: `${botBrandName()} Premium · ${pkg.label}`,
        description: `Premium ${pkg.label} para ${guild.name}`.slice(0, 250),
        amount: pkg.priceCop,
        returnUrl: `${panelUrl}/pago/respuesta/${order.invoice}`,
        // source_news=webhooks: solo avisos en formato Webhooks (firmados), no IPN antiguo
        notificationUrl: `${panelUrl}/webhooks/mercadopago?source_news=webhooks`,
      });
      return { url, test: pay.test, invoice: order.invoice };
    } catch (err) {
      console.error('[Mercado Pago] Error creando la preferencia:', (err as Error).message);
      throw new HttpError(502, 'No se pudo iniciar el pago. Inténtalo en unos minutos.');
    }
  });

  app.get('/api/guilds/:guildId/orders/:invoice', async (req) => {
    const { guild } = await requireGuild(req);
    const { invoice } = req.params as { invoice: string };
    const order = getOrder(invoice);
    if (!order || order.guildId !== guild.id) throw new HttpError(404, 'Pago no encontrado');
    return { status: order.status, days: order.days, amount: order.amount };
  });

  /**
   * Consulta un pago a la API de Mercado Pago y lo aplica a su orden. Es lo ÚNICO que da o quita
   * Premium: el aviso del webhook o la vuelta del usuario solo traen el id del pago.
   */
  const syncMercadoPagoPayment = async (paymentId: string, source: string) => {
    const pay = mercadoPagoEnv();
    if (!pay || !/^\d{1,20}$/.test(paymentId)) return;
    const p = await getPayment(pay, paymentId);
    if (!p) {
      console.warn(`[Mercado Pago] ${source}: el pago ${paymentId} no existe o no es de esta cuenta.`);
      return;
    }
    const order = getOrder(p.external_reference ?? '');
    if (!order) {
      console.warn(`[Mercado Pago] ${source}: pago ${paymentId} de una orden desconocida (${p.external_reference ?? 'sin referencia'}).`);
      return;
    }
    if (Number(p.transaction_amount) !== order.amount || p.currency_id !== order.currency) {
      console.warn(`[Mercado Pago] ${order.invoice}: importe ${p.transaction_amount} ${p.currency_id} no coincide con ${order.amount} ${order.currency}.`);
      return;
    }
    const state = mapStatus(p.status);
    if (!state) return;
    const { changed } = membershipCall(() => settleOrder(order.invoice, state, { paymentRef: String(p.id) }));
    if (changed) console.log(`💳 Mercado Pago ${order.invoice} (${order.guildName ?? order.guildId}): ${state} · pago ${p.id}${order.test ? ' [prueba]' : ''}.`);
  };

  // Página a la que vuelve el usuario tras pagar. Si trae el id del pago lo consultamos ya
  // (por si el webhook tarda); el resultado se toma de la API, nunca de la URL.
  app.get('/pago/respuesta/:invoice', async (req, reply) => {
    const { invoice } = req.params as { invoice: string };
    const order = /^MU-[0-9A-F]{12}$/.test(invoice) ? getOrder(invoice) : undefined;
    if (!order) return reply.redirect('/', 303);
    const q = req.query as Record<string, unknown>;
    const paymentId = String(q.payment_id ?? q.collection_id ?? '');
    if (paymentId && paymentId !== 'null') {
      await syncMercadoPagoPayment(paymentId, 'vuelta del usuario').catch((err) =>
        console.warn('[Mercado Pago] No se pudo consultar el pago al volver:', (err as Error).message)
      );
    }
    return reply.redirect(`/?pago=${order.invoice}#/g/${order.guildId}/plan`, 303);
  });

  // Avisos de Mercado Pago (servidor a servidor). Formato webhook (?data.id=&type=payment, cuerpo JSON)
  // o IPN antiguo (?topic=payment&id=). Error 500 = Mercado Pago lo reintenta.
  //
  // La firma (x-signature) se comprueba pero NO bloquea: el aviso solo trae un id y el Premium
  // sale siempre de consultar el pago a la API con nuestro token, así que un aviso falso no
  // puede dar nada. Si falla, se registra el detalle para averiguar qué clave/formato usa MP.
  app.post('/webhooks/mercadopago', { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async (req, reply) => {
    const pay = mercadoPagoEnv();
    if (!pay) return reply.status(404).send('pagos desactivados');
    const q = req.query as Record<string, unknown>;
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as { type?: string; data?: { id?: unknown } };
    const type = String(q.type ?? q.topic ?? body.type ?? '');
    if (type !== 'payment') return reply.send('ok'); // merchant_order y demás: no hacen falta
    const dataId = String(q['data.id'] ?? body.data?.id ?? q.id ?? '');

    // Los avisos IPN (?topic=&id=) no usan la firma de Webhooks: no se valida, solo se consulta la API
    const isIpn = q.topic !== undefined && q['data.id'] === undefined;
    const signature = req.headers['x-signature'];
    if (pay.webhookSecret && typeof signature === 'string' && !isIpn) {
      const requestId = typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : undefined;
      const secret = pay.webhookSecret;
      if (!isValidSignature(secret, signature, requestId, String(q['data.id'] ?? dataId))) {
        // Diagnóstico sin datos secretos: qué variante del manifiesto sí cuadraría
        const variants: Record<string, boolean> = {
          'body.data.id': isValidSignature(secret, signature, requestId, String(body.data?.id ?? '')),
          'query.id': isValidSignature(secret, signature, requestId, String(q.id ?? '')),
          'sin request-id': isValidSignature(secret, signature, undefined, dataId),
          'sin data.id': isValidSignature(secret, signature, requestId, ''),
        };
        const match = Object.entries(variants).find(([, ok]) => ok)?.[0] ?? 'ninguna (¿clave de otra app o de Modo productivo?)';
        const b = body as Record<string, unknown>;
        console.warn(
          `[Mercado Pago] Aviso con firma inválida (pago ${dataId || '?'}); se consulta igual a la API. ` +
            `query=${JSON.stringify(q)} request-id=${requestId ? 'sí' : 'no'} ` +
            `ts=${/ts=([^,]+)/.exec(signature)?.[1] ?? '?'} action=${String(b.action ?? '?')} ` +
            `live_mode=${String(b.live_mode ?? '?')} user_id=${String(b.user_id ?? '?')} variante que cuadra: ${match}.`
        );
      }
    }
    try {
      await syncMercadoPagoPayment(dataId, 'webhook');
    } catch (err) {
      console.error('[Mercado Pago] Error procesando el aviso:', (err as Error).message);
      return reply.status(500).send('reintentar');
    }
    return reply.send('ok');
  });

  // ---------- Administración (solo el dueño del bot) ----------
  const ownerId = process.env.BOT_OWNER_ID;
  const isOwner = (s: PanelSession | undefined) => Boolean(ownerId && s?.userId === ownerId);
  const requireOwner = (req: FastifyRequest): PanelSession => {
    const session = requireSession(req);
    if (!isOwner(session)) throw new HttpError(403, 'Solo el dueño del bot');
    return session;
  };
  const adminGuildRow = (guildId: string) => {
    const config = ConfigManager.peekConfig(guildId);
    if (!config) return null;
    const guild = client.guilds.cache.get(guildId);
    const ends = premiumEndsAt(config);
    return {
      id: guildId,
      name: guild?.name ?? config.guildName,
      icon: guild?.iconURL({ extension: 'png', size: 64 }) ?? null,
      members: guild?.memberCount ?? null,
      botPresent: Boolean(guild),
      joinedAt: guild?.joinedTimestamp ?? config.createdAt,
      tier: getEffectiveTier(config),
      endsAt: ends === undefined ? null : ends, // null = no vence (o gratis: mirar tier)
      lifetime: ends === null,
      timed: hasTimedPremium(config)
        ? { source: config.premiumSource ?? 'manual', until: config.premiumUntil ?? null }
        : null,
      subscription: config.subscription
        ? { active: hasActiveSubscription(config), endsAt: config.subscription.endsAt ?? null, userId: config.subscription.userId }
        : null,
    };
  };

  const serializeCode = (c: RedeemCode) => ({ ...c, status: codeStatus(c) });

  app.get('/api/admin/overview', async (req) => {
    requireOwner(req);
    const guilds = ConfigManager.listStoredGuildIds()
      .map(adminGuildRow)
      .filter((g): g is NonNullable<typeof g> => Boolean(g))
      .sort((a, b) => Number(b.tier === 'premium') - Number(a.tier === 'premium') || Number(b.botPresent) - Number(a.botPresent) || a.name.localeCompare(b.name));
    const present = guilds.filter((g) => g.botPresent);
    const premium = present.filter((g) => g.tier === 'premium');
    const soon = Date.now() + 7 * 24 * 60 * 60 * 1000;
    return {
      stats: {
        guilds: present.length,
        premium: premium.length,
        subscriptions: premium.filter((g) => g.subscription?.active).length,
        timed: premium.filter((g) => g.timed).length,
        expiringSoon: premium.filter((g) => g.endsAt && g.endsAt < soon).length,
      },
      skuConfigured: Boolean(premiumSkuId()),
      guilds,
      codes: listCodes().map(serializeCode),
      history: getHistory({ limit: 300 }),
      payments: {
        enabled: Boolean(mercadoPagoEnv()),
        test: mercadoPagoEnv()?.test ?? true,
        orders: listOrders({ limit: 200 }).filter((o) => o.status !== 'created'),
        revenue30d: listOrders({ limit: 100000 })
          .filter((o) => o.status === 'paid' && !o.test && (o.paidAt ?? 0) > Date.now() - 30 * 24 * 60 * 60 * 1000)
          .reduce((acc, o) => acc + o.amount, 0),
      },
    };
  });

  app.post('/api/admin/guilds/:guildId/plan', async (req) => {
    const session = requireOwner(req);
    const { guildId } = req.params as { guildId: string };
    if (!snowflake.safeParse(guildId).success || !ConfigManager.peekConfig(guildId)) throw new HttpError(404, 'Servidor no encontrado');
    const body = parse(adminPlanSchema, req.body);
    const config = ConfigManager.getConfig(guildId);
    membershipCall(() => {
      if (body.action === 'grant') grantPremium(config, body.days, session.userId, body.note);
      else if (body.action === 'extend') extendPremium(config, body.days, session.userId, body.note);
      else revokePremium(config, session.userId, body.note);
    });
    return { guild: adminGuildRow(guildId), history: getHistory({ limit: 300 }) };
  });

  app.post('/api/admin/codes', async (req) => {
    const session = requireOwner(req);
    const body = parse(createCodesSchema, req.body);
    const created = createCodes({ ...body, actorId: session.userId });
    return { created: created.map(serializeCode), codes: listCodes().map(serializeCode) };
  });

  app.patch('/api/admin/codes/:code', async (req) => {
    requireOwner(req);
    const { code } = req.params as { code: string };
    const { disabled } = parse(codeUpdateSchema, req.body);
    membershipCall(() => setCodeDisabled(code, disabled));
    return { codes: listCodes().map(serializeCode) };
  });

  app.delete('/api/admin/codes/:code', async (req) => {
    requireOwner(req);
    const { code } = req.params as { code: string };
    membershipCall(() => deleteCode(code));
    return { codes: listCodes().map(serializeCode) };
  });

  // ---------- Catálogo de ítems ----------
  const itemsJson = JSON.stringify(allItems());
  app.get('/api/items', async (req, reply) => {
    requireSession(req);
    reply.header('Cache-Control', 'private, max-age=3600').type('application/json');
    return itemsJson;
  });

  // ---------- Archivos del panel (aplicación React compilada) ----------
  if (fs.existsSync(DIST)) {
    // wildcard (por defecto): sirve también los archivos creados después de arrancar (al recompilar el panel)
    await app.register(fastifyStatic, { root: DIST, index: 'index.html' });
    app.setNotFoundHandler((req, reply: FastifyReply) => {
      if (req.method === 'GET' && !req.url.startsWith('/api/') && !req.url.startsWith('/auth/')) {
        return reply.type('text/html').sendFile('index.html');
      }
      return reply.status(404).send({ error: 'No encontrado' });
    });
  } else {
    console.warn('⚠️ No existe dashboard/dist: compila el panel con "npm run panel:build".');
  }

  await app.listen({ port, host: '127.0.0.1' });
  console.log(`🖥️ Panel web escuchando en http://127.0.0.1:${port} (público: ${panelUrl})`);
}
