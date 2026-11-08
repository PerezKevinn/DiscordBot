export type ItemSlot = 'weapon' | 'offhand' | 'head' | 'armor' | 'shoes' | 'cape' | 'mount' | 'food' | 'potion';

export interface CatalogItem {
  id: string;
  slot: ItemSlot;
  name: string;
  en: string;
  icon: string;
  tier?: number;
}

export type RoleBuild = Partial<Record<ItemSlot, string>>;

export interface Role {
  id?: string;
  name: string;
  weapons: string;
  emoji: string;
  maxSlots: number;
  description: string;
  build: RoleBuild;
}

export interface Content {
  id: string;
  name: string;
  emoji: string;
  subtitle: string;
  accentColor: string;
  defaultGearTier: string;
  defaultMount: string;
  defaultZone: string;
  roles: Role[];
  createVoice?: boolean;
  createThread?: boolean;
}

export interface Me {
  user: { id: string; name: string; avatar: string | null };
  guilds: Array<{ id: string; name: string; icon: string | null; botPresent: boolean; inviteUrl: string }>;
}

export interface GuildData {
  guild: { id: string; name: string; icon: string | null };
  plan: {
    tier: 'free' | 'premium';
    limits: { maxActivePings: number; maxContentTypes: number; customBranding: boolean; hideBotFooter: boolean };
    premiumUntil: number | null;
  };
  settings: {
    callerRoleId: string | null;
    defaultPingRoleId: string | null;
    pingTargetChannelId: string | null;
    voiceCategoryId: string | null;
    pingRoles: Record<string, string>;
  };
  branding: { guildName: string; guildTag: string; motto: string; color: string; customLogo: boolean };
  contents: Content[];
  discord: {
    roles: Array<{ id: string; name: string; color: string; mentionable: boolean }>;
    channels: Array<{ id: string; name: string; botCanSend: boolean }>;
    categories: Array<{ id: string; name: string }>;
  };
  pings: Array<{
    id: string;
    title: string;
    contentName: string;
    status: 'OPEN' | 'IN_PROGRESS';
    callerName: string;
    startTimeUnix: number;
    channelId: string;
    url: string;
    joined: number;
    max: number;
  }>;
}

export const BUILD_SLOTS: Array<{ slot: ItemSlot; label: string }> = [
  { slot: 'weapon', label: 'Arma' },
  { slot: 'offhand', label: 'Mano secundaria' },
  { slot: 'head', label: 'Cabeza' },
  { slot: 'armor', label: 'Armadura' },
  { slot: 'shoes', label: 'Botas' },
  { slot: 'cape', label: 'Capa' },
  { slot: 'food', label: 'Comida' },
  { slot: 'potion', label: 'Poción' },
  { slot: 'mount', label: 'Montura' },
];

export function iconUrl(item: CatalogItem, size = 64) {
  return `https://render.albiononline.com/v1/item/${encodeURIComponent(item.icon)}.png?size=${size}`;
}
