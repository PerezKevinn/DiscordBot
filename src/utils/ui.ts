import { EmbedBuilder } from 'discord.js';
import { GuildConfig, RoleTemplate } from '../types/ping';
import { botBrandName, brandForRender } from './plans';

/** Colores de sistema (mensajes del bot que no son un ping). */
export const UI_COLORS = {
  brand: 0xd4af37,
  success: 0x2a9d8f,
  danger: 0xe63946,
  muted: 0x4f545c,
};

/** Convierte "#9D4EDD" en número para setColor. */
export function hexToInt(hex: string, fallback = UI_COLORS.brand): number {
  const n = parseInt(hex.replace('#', ''), 16);
  return Number.isNaN(n) ? fallback : n;
}

/** Embed base con la marca del servidor arriba y el nombre del bot abajo. */
export function baseEmbed(rawConfig: GuildConfig, section: string): EmbedBuilder {
  const config = brandForRender(rawConfig);
  const guildLabel = `${config.guildName} ${config.guildTag}`.trim();
  return new EmbedBuilder()
    .setColor(config.colors.embedHex)
    .setAuthor({ name: `${guildLabel} • ${section}`.slice(0, 256) })
    .setFooter({ text: botBrandName() });
}

/**
 * Separa "Tanque de atrape (Maza pesada / Patas de oso)" en nombre corto + armas sugeridas,
 * para que los títulos de los roles no ocupen tres líneas.
 */
export function splitRoleLabel(label: string): { name: string; weapons?: string } {
  const match = label.match(/^(.*?)\s*\((.+)\)\s*$/);
  if (!match) return { name: label };
  return { name: match[1], weapons: match[2] };
}

/** Total de cupos de una compo (null si algún rol no tiene límite). */
export function totalSlots(roles: RoleTemplate[]): number | null {
  if (roles.some((r) => r.maxSlots <= 0)) return null;
  return roles.reduce((acc, r) => acc + r.maxSlots, 0);
}

/** Compo en una línea por rol: "⛓️ **Catch** ×3  -# Patas de Oso / Doble Filo" */
export function formatCompo(roles: RoleTemplate[]): string {
  return roles
    .map((r) => {
      const { name, weapons } = splitRoleLabel(r.label);
      const slots = r.maxSlots > 0 ? `×${r.maxSlots}` : '×∞';
      return `${r.emoji} **${name}** ${slots}${weapons ? `\n-# ${weapons}` : ''}`;
    })
    .join('\n');
}

/** Compo resumida en una sola línea: "⛓️3 · 🔮2 · 🗡️5" */
export function formatCompoInline(roles: RoleTemplate[]): string {
  return roles.map((r) => `${r.emoji}${r.maxSlots > 0 ? r.maxSlots : '∞'}`).join(' · ');
}

/**
 * Discord rechaza embeds de más de 6000 caracteres en total. Si nos pasamos (muchos
 * contenidos o roles con nombres largos), se quitan campos del final y se avisa.
 */
export function fitEmbed(embed: EmbedBuilder, limit = 5900): EmbedBuilder {
  const size = () => {
    const d = embed.data;
    return (
      (d.title?.length ?? 0) +
      (d.description?.length ?? 0) +
      (d.author?.name.length ?? 0) +
      (d.footer?.text.length ?? 0) +
      (d.fields ?? []).reduce((acc, f) => acc + f.name.length + f.value.length, 0)
    );
  };
  if (size() <= limit) return embed;
  const fields = [...(embed.data.fields ?? [])];
  let removed = 0;
  while (fields.length > 0 && size() > limit - 40) {
    fields.pop();
    removed++;
    embed.setFields(fields);
  }
  if (removed > 0) embed.addFields({ name: '​', value: `-# …y ${removed} más (no caben en un mensaje)` });
  return embed;
}
