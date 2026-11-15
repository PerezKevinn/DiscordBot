/**
 * Enlaces al panel web desde Discord. Toda la configuración del bot se hace en el panel; en
 * Discord solo se usa.
 */
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';

/** Pestañas del panel; coinciden con las rutas #/g/<guildId>/<pestaña> de dashboard/. */
export type PanelTab = 'pings' | 'contenidos' | 'ajustes' | 'puntos' | 'marca' | 'plan';

/** URL del panel, de un servidor y pestaña si se indica. null si PANEL_URL no está configurada. */
export function panelUrl(guildId?: string, tab: PanelTab = 'contenidos'): string | null {
  const base = process.env.PANEL_URL?.replace(/\/$/, '');
  if (!base) return null;
  return guildId ? `${base}/#/g/${guildId}/${tab}` : base;
}

/** Fila con el botón de enlace al panel, o una lista vacía si el panel no está configurado. */
export function panelButtonRow(guildId: string, tab: PanelTab = 'contenidos', label = 'Abrir el panel web') {
  const url = panelUrl(guildId, tab);
  if (!url) return [];
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(url).setLabel(label).setEmoji('🖥️')
    ),
  ];
}

/** Respuesta estándar para los comandos de configuración que se movieron de Discord al panel. */
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
