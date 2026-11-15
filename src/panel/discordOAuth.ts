/**
 * Login del panel con Discord (OAuth2, scopes "identify" y "guilds"). Solo se lee quién es el
 * usuario y en qué servidores está; nunca se piden permisos para actuar en su nombre.
 */
import { DiscordGuildSummary } from './sessions';

const API = 'https://discord.com/api/v10';

/** Configuración OAuth del panel, leída del .env. */
export interface PanelEnv {
  clientId: string;
  clientSecret: string;
  /** URL pública del panel sin barra final, p. ej. https://panel.massup.shop. */
  panelUrl: string;
}

/** URL de vuelta del login; tiene que coincidir con la registrada en el Developer Portal. */
export function redirectUri(env: PanelEnv) {
  return `${env.panelUrl}/auth/callback`;
}

/**
 * URL de autorización de Discord. `state` es el valor anti-CSRF que server.ts guarda en una cookie
 * y comprueba en el callback. prompt=none evita la pantalla de consentimiento si ya se aceptó antes.
 */
export function authorizeUrl(env: PanelEnv, state: string): string {
  const p = new URLSearchParams({
    client_id: env.clientId,
    redirect_uri: redirectUri(env),
    response_type: 'code',
    scope: 'identify guilds',
    state,
    prompt: 'none',
  });
  return `https://discord.com/oauth2/authorize?${p}`;
}

// Los errores llevan el status HTTP para que quien llama distinga un token caducado (401).
async function discordFetch<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, { ...init, signal: AbortSignal.timeout(8000) });
  if (!res.ok) {
    const err = new Error(`Discord respondió ${res.status} en ${path}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return (await res.json()) as T;
}

/** Cambia el código del callback por un token de acceso del usuario. */
export async function exchangeCode(env: PanelEnv, code: string) {
  return discordFetch<{ access_token: string; expires_in: number; token_type: string }>('/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.clientId,
      client_secret: env.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(env),
    }),
  });
}

/** Datos básicos del usuario dueño del token. */
export async function fetchUser(accessToken: string) {
  return discordFetch<{ id: string; username: string; global_name: string | null; avatar: string | null }>(
    '/users/@me',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
}

/** Servidores del usuario, reducidos a los campos que usa el panel. */
export async function fetchUserGuilds(accessToken: string): Promise<DiscordGuildSummary[]> {
  const guilds = await discordFetch<DiscordGuildSummary[]>('/users/@me/guilds', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return guilds.map(({ id, name, icon, owner, permissions }) => ({ id, name, icon, owner, permissions }));
}

const MANAGE_GUILD = 0x20n;
const ADMINISTRATOR = 0x8n;

/**
 * Indica si el usuario puede gestionar el servidor según la lista de Discord (dueño, Gestionar
 * servidor o Administrador). Es solo un primer filtro: server.ts vuelve a comprobarlo con los
 * datos reales del servidor en cada petición.
 */
export function canManage(g: DiscordGuildSummary): boolean {
  if (g.owner) return true;
  try {
    const p = BigInt(g.permissions);
    return (p & MANAGE_GUILD) === MANAGE_GUILD || (p & ADMINISTRATOR) === ADMINISTRATOR;
  } catch {
    return false;
  }
}
