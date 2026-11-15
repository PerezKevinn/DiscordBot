/**
 * Sesiones del panel, solo en memoria. Al reiniciar el bot hay que volver a iniciar sesión (un clic
 * con Discord), a cambio de no guardar nunca en disco los tokens de acceso de los usuarios.
 */
import crypto from 'crypto';

/** Servidor tal como lo devuelve GET /users/@me/guilds; permissions es un bitfield en texto. */
export interface DiscordGuildSummary {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

/** Sesión de un usuario del panel. La cookie solo lleva el id; el resto se queda en el servidor. */
export interface PanelSession {
  id: string;
  userId: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
  accessToken: string;
  tokenExpiresAt: number;
  /** Lista de servidores en caché; server.ts la refresca cuando caduca. */
  guilds: DiscordGuildSummary[];
  guildsFetchedAt: number;
  createdAt: number;
  lastSeenAt: number;
}

/** Nombre de la cookie firmada que lleva el id de sesión. */
export const SESSION_COOKIE = 'massup_session';
/** Duración máxima de una sesión desde el login. */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// Una sesión sin actividad durante un día caduca aunque no haya llegado a SESSION_TTL_MS.
const IDLE_TTL_MS = 24 * 60 * 60 * 1000;

const sessions = new Map<string, PanelSession>();

/** Crea una sesión con un id aleatorio de 256 bits. */
export function createSession(data: Omit<PanelSession, 'id' | 'createdAt' | 'lastSeenAt'>): PanelSession {
  const id = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  const session: PanelSession = { ...data, id, createdAt: now, lastSeenAt: now };
  sessions.set(id, session);
  return session;
}

/**
 * Devuelve la sesión si sigue vigente y renueva su última actividad. Borra la sesión si caducó
 * por tiempo total, por inactividad o porque venció el token de Discord.
 */
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

/** Cierra la sesión (logout). */
export function destroySession(id: string | undefined): void {
  if (id) sessions.delete(id);
}

// Limpieza periódica de las sesiones caducadas: getSession las borra al consultarlas.
setInterval(() => {
  for (const [id] of sessions) getSession(id);
}, 60 * 60 * 1000).unref();
