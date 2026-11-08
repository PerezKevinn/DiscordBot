import { DiscordGuildSummary } from './sessions';

/**
 * Login con Discord (OAuth2, scopes "identify" y "guilds"): solo leemos quién eres y
 * en qué servidores estás. Nunca pedimos permisos para actuar en tu nombre.
 */

const API = 'https://discord.com/api/v10';

export interface PanelEnv {
  clientId: string;
  clientSecret: string;
  panelUrl: string; // https://panel.massup.shop (sin barra final)
}

export function redirectUri(env: PanelEnv) {
  return `${env.panelUrl}/auth/callback`;
}

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

async function discordFetch<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, { ...init, signal: AbortSignal.timeout(8000) });
  if (!res.ok) {
    const err = new Error(`Discord respondió ${res.status} en ${path}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return (await res.json()) as T;
}

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

export async function fetchUser(accessToken: string) {
  return discordFetch<{ id: string; username: string; global_name: string | null; avatar: string | null }>(
    '/users/@me',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
}

export async function fetchUserGuilds(accessToken: string): Promise<DiscordGuildSummary[]> {
  const guilds = await discordFetch<DiscordGuildSummary[]>('/users/@me/guilds', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return guilds.map(({ id, name, icon, owner, permissions }) => ({ id, name, icon, owner, permissions }));
}

const MANAGE_GUILD = 0x20n;
const ADMINISTRATOR = 0x8n;

/** Permiso de "Gestionar servidor" según la lista de servidores de Discord. */
export function canManage(g: DiscordGuildSummary): boolean {
  if (g.owner) return true;
  try {
    const p = BigInt(g.permissions);
    return (p & MANAGE_GUILD) === MANAGE_GUILD || (p & ADMINISTRATOR) === ADMINISTRATOR;
  } catch {
    return false;
  }
}
