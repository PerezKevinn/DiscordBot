import type { CatalogItem, Content, GuildData, Me } from './types';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error || `Error ${res.status}`);
  return data as T;
}

type ContentBody = Omit<Content, 'id'>;

export const api = {
  me: () => request<Me>('GET', '/api/me'),
  logout: () => request<{ ok: true }>('POST', '/api/logout', {}),
  items: () => request<CatalogItem[]>('GET', '/api/items'),
  guild: (id: string) => request<GuildData>('GET', `/api/guilds/${id}`),
  saveSettings: (id: string, body: Partial<GuildData['settings']>) =>
    request<GuildData>('PATCH', `/api/guilds/${id}/settings`, body),
  createContent: (id: string, body: ContentBody) => request<GuildData>('POST', `/api/guilds/${id}/contents`, body),
  saveContent: (id: string, contentId: string, body: ContentBody) =>
    request<GuildData>('PUT', `/api/guilds/${id}/contents/${encodeURIComponent(contentId)}`, body),
  deleteContent: (id: string, contentId: string) =>
    request<GuildData>('DELETE', `/api/guilds/${id}/contents/${encodeURIComponent(contentId)}`),
  resetContents: (id: string) => request<GuildData>('POST', `/api/guilds/${id}/contents/reset`, {}),
  saveBranding: (id: string, body: { guildName?: string; guildTag?: string; motto?: string; color?: string }) =>
    request<GuildData>('PATCH', `/api/guilds/${id}/branding`, body),
  uploadLogo: (id: string, dataUrl: string) => request<GuildData>('PUT', `/api/guilds/${id}/logo`, { dataUrl }),
  deleteLogo: (id: string) => request<GuildData>('DELETE', `/api/guilds/${id}/logo`),
  closePing: (id: string, pingId: string, status: 'CLOSED' | 'CANCELLED') =>
    request<GuildData>('POST', `/api/guilds/${id}/pings/${encodeURIComponent(pingId)}/close`, { status }),
};
