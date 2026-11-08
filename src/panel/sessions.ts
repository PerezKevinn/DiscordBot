import crypto from 'crypto';

/**
 * Sesiones del panel en memoria. Al reiniciar el bot hay que volver a iniciar sesión
 * (es solo un clic con Discord), a cambio de no guardar tokens de Discord en disco.
 */

export interface DiscordGuildSummary {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

export interface PanelSession {
  id: string;
  userId: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
  accessToken: string;
  tokenExpiresAt: number;
  guilds: DiscordGuildSummary[];
  guildsFetchedAt: number;
  createdAt: number;
  lastSeenAt: number;
}

export const SESSION_COOKIE = 'massup_session';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const IDLE_TTL_MS = 24 * 60 * 60 * 1000;

const sessions = new Map<string, PanelSession>();

export function createSession(data: Omit<PanelSession, 'id' | 'createdAt' | 'lastSeenAt'>): PanelSession {
  const id = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  const session: PanelSession = { ...data, id, createdAt: now, lastSeenAt: now };
  sessions.set(id, session);
  return session;
}

export function getSession(id: string | undefined): PanelSession | undefined {
  if (!id) return undefined;
  const s = sessions.get(id);
  if (!s) return undefined;
  const now = Date.now();
  if (now - s.createdAt > SESSION_TTL_MS || now - s.lastSeenAt > IDLE_TTL_MS || now > s.tokenExpiresAt) {
    sessions.delete(id);
    return undefined;
  }
  s.lastSeenAt = now;
  return s;
}

export function destroySession(id: string | undefined): void {
  if (id) sessions.delete(id);
}

setInterval(() => {
  for (const [id] of sessions) getSession(id);
}, 60 * 60 * 1000).unref();
