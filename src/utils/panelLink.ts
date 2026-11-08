import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';

/**
 * Enlaces al panel web. Toda la configuración del bot se hace allí; en Discord solo se usa.
 */
export type PanelTab = 'pings' | 'contenidos' | 'ajustes' | 'marca';

export function panelUrl(guildId?: string, tab: PanelTab = 'contenidos'): string | null {
  const base = process.env.PANEL_URL?.replace(/\/$/, '');
  if (!base) return null;
  return guildId ? `${base}/#/g/${guildId}/${tab}` : base;
}

/** Botón de enlace "Abrir panel" (o nada si el panel no está configurado). */
export function panelButtonRow(guildId: string, tab: PanelTab = 'contenidos', label = 'Abrir el panel web') {
  const url = panelUrl(guildId, tab);
  if (!url) return [];
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(url).setLabel(label).setEmoji('🖥️')
    ),
  ];
}

/** Respuesta estándar para lo que antes se configuraba desde Discord. */
export function movedToPanelReply(guildId: string, tab: PanelTab = 'contenidos') {
  const url = panelUrl(guildId, tab);
  const embed = new EmbedBuilder()
    .setColor(0xd4af37)
    .setTitle('🖥️ La configuración ahora está en el panel web')
    .setDescription(
      url
        ? 'Contenidos, compos, builds, roles de aviso, canales y marca se configuran desde el panel. Entra con tu cuenta de Discord.'
        : 'Contenidos, compos, builds, roles de aviso, canales y marca se configuran desde el panel web, que todavía no está activado en este bot.'
    );
  return { embeds: [embed], components: panelButtonRow(guildId, tab) };
}
