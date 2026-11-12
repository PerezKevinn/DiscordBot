import type {
  AdminGuild,
  AdminOverview,
  CatalogItem,
  Content,
  GuildData,
  Me,
  MembershipEvent,
  PaymentOrder,
  PointsData,
  PointsEditor,
  RankingPeriod,
  RedeemCode,
} from './types';

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
  redeem: (id: string, code: string) => request<GuildData>('POST', `/api/guilds/${id}/redeem`, { code }),
  checkout: (id: string, packageId: string) =>
    request<{ url: string; test: boolean; invoice: string }>('POST', `/api/guilds/${id}/checkout`, { packageId }),
  order: (id: string, invoice: string) =>
    request<{ status: PaymentOrder['status']; days: number; amount: number }>('GET', `/api/guilds/${id}/orders/${encodeURIComponent(invoice)}`),

  // Puntos de actividad
  points: (id: string, period: RankingPeriod) => request<PointsData>('GET', `/api/guilds/${id}/points?period=${period}`),
  savePointsSettings: (id: string, period: RankingPeriod, body: Partial<PointsData['settings']>) =>
    request<PointsData>('PATCH', `/api/guilds/${id}/points/settings?period=${period}`, body),
  pointsEditor: (id: string, pingId: string) =>
    request<PointsEditor>('GET', `/api/guilds/${id}/points/pings/${encodeURIComponent(pingId)}`),
  saveActivityPoints: (id: string, period: RankingPeriod, pingId: string, entries: Array<{ userId: string; points: number }>) =>
    request<PointsData>('PUT', `/api/guilds/${id}/points/pings/${encodeURIComponent(pingId)}?period=${period}`, { entries }),
  adjustPoints: (id: string, period: RankingPeriod, body: { userId: string; points: number; note?: string }) =>
    request<PointsData>('POST', `/api/guilds/${id}/points/adjust?period=${period}`, body),
  deletePointsAward: (id: string, period: RankingPeriod, awardId: string) =>
    request<PointsData>('DELETE', `/api/guilds/${id}/points/awards/${encodeURIComponent(awardId)}?period=${period}`),
  newSeason: (id: string, period: RankingPeriod) =>
    request<PointsData>('POST', `/api/guilds/${id}/points/season?period=${period}`, {}),

  // Administración (solo el dueño del bot)
  adminOverview: () => request<AdminOverview>('GET', '/api/admin/overview'),
  adminPlan: (
    guildId: string,
    body:
      | { action: 'grant'; days: number | null; note?: string }
      | { action: 'extend'; days: number; note?: string }
      | { action: 'revoke'; note?: string }
  ) => request<{ guild: AdminGuild; history: MembershipEvent[] }>('POST', `/api/admin/guilds/${guildId}/plan`, body),
  createCodes: (body: { days: number | null; maxUses: number; count: number; expiresInDays?: number | null; note?: string }) =>
    request<{ created: RedeemCode[]; codes: RedeemCode[] }>('POST', '/api/admin/codes', body),
  setCodeDisabled: (code: string, disabled: boolean) =>
    request<{ codes: RedeemCode[] }>('PATCH', `/api/admin/codes/${encodeURIComponent(code)}`, { disabled }),
  deleteCode: (code: string) => request<{ codes: RedeemCode[] }>('DELETE', `/api/admin/codes/${encodeURIComponent(code)}`),
};
