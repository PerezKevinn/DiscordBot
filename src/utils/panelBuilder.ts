import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { ContentTypeConfig, DraftPingSession, GuildConfig, MentionType } from '../types/ping';
import { panelUrl } from './panelLink';
import { baseEmbed, fitEmbed, formatCompo, formatCompoInline, hexToInt, totalSlots } from './ui';

/** Rol que se mencionará para un contenido (el propio del contenido o el rol por defecto). */
export function resolvePingRoleId(config: GuildConfig, contentTypeId: string): string | undefined {
  return config.pingRoles[contentTypeId] || config.defaultPingRoleId;
}

const TIME_OPTIONS = [
  { minutes: 2, label: '¡Ya mismo! (2 min)', description: 'Para caerle a alguien o defender' },
  { minutes: 10, label: 'En 10 minutos', description: 'Masa rápida en portal o HO' },
  { minutes: 15, label: 'En 15 minutos', description: 'Lo clásico: build, comida y montura' },
  { minutes: 30, label: 'En 30 minutos', description: 'Para armar con calma' },
  { minutes: 45, label: 'En 45 minutos', description: 'Para ir avisando a la gente' },
  { minutes: 60, label: 'En 1 hora', description: 'Masa grande con tiempo de sobra' },
];

/**
 * Panel fijo de Callers que queda en un canal
 */
export function buildFixedCallerPanel(config: GuildConfig) {
  const embed = baseEmbed(config, 'Mesa de Callers')
    .setTitle('⚔️ ¿Qué sale hoy?')
    .setDescription(
      [
        'Arma un ping con roster por roles, aviso al rol del contenido, voz temporal e hilo de builds.',
        '',
        '**1.** Pulsa **Crear ping**',
        '**2.** Elige contenido, hora y lugar de masa',
        '**3.** Pulsa **Publicar** y la gente se anota en su rol',
      ].join('\n')
    );

  // Contenidos en dos columnas para que el panel no sea una lista eterna
  const lines = config.contentTypes.map((c) => {
    const roleId = config.pingRoles[c.id];
    return `${c.emoji} ${c.name}${roleId ? ` · <@&${roleId}>` : ''}`;
  });
  const half = Math.ceil(lines.length / 2);
  const cols = [lines.slice(0, half), lines.slice(half)].filter((c) => c.length);
  cols.forEach((col, i) =>
    embed.addFields({ name: i === 0 ? 'Contenidos' : '​', value: col.join('\n').slice(0, 1024), inline: true })
  );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('panel_start_ping_wizard')
      .setLabel('Crear ping')
      .setEmoji('⚔️')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('panel_refresh').setEmoji('🔄').setStyle(ButtonStyle.Secondary)
  );
  // La configuración (contenidos, compos, builds, avisos) se hace en el panel web
  const url = panelUrl(config.guildId, 'contenidos');
  if (url) {
    row.addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(url).setLabel('Configurar').setEmoji('🖥️'));
  }

  return { embeds: [fitEmbed(embed)], components: [row] };
}

function mentionLabel(type: MentionType, roleId?: string): string {
  switch (type) {
    case 'ROLE':
      return roleId ? `<@&${roleId}>` : '⚠️ Sin rol configurado';
    case 'HERE':
      return '@here';
    case 'EVERYONE':
      return '@everyone';
    default:
      return '🔕 Sin aviso';
  }
}

const MENTION_BUTTON: Record<MentionType, string> = {
  ROLE: 'Aviso: rol',
  HERE: 'Aviso: @here',
  EVERYONE: 'Aviso: @everyone',
  NONE: 'Sin aviso',
};

/**
 * Vista privada del Caller mientras arma el ping (asistente)
 */
export function buildWizardStepMessage(draft: DraftPingSession, config: GuildConfig) {
  const content: ContentTypeConfig =
    config.contentTypes.find((c) => c.id === draft.contentTypeId) || config.contentTypes[0];
  const roles = draft.customRoles || content.roles;
  const pingRoleId = resolvePingRoleId(config, content.id);
  const slots = totalSlots(roles);
  const minutes = draft.minutesFromNow || 15;

  const embed = baseEmbed(config, 'Nuevo ping')
    .setColor(hexToInt(content.accentColor))
    .setTitle(`${content.emoji}  ${(draft.title || content.name).toUpperCase()}`.slice(0, 256))
    .setDescription('-# Solo tú ves esto. Ajusta con los menús y botones y pulsa **Publicar ping**.')
    .addFields(
      { name: '⏰ Salida', value: minutes <= 2 ? '¡Ya mismo!' : `En ${minutes} min`, inline: true },
      { name: '📍 Masa en', value: draft.departureLocation || content.defaultZone, inline: true },
      { name: '🛡️ IP / Build', value: draft.gearTier || content.defaultGearTier, inline: true },
      { name: '🐎 Montura', value: draft.mountRequired || content.defaultMount, inline: true },
      { name: '🔔 Aviso', value: mentionLabel(draft.mentionType, pingRoleId), inline: true },
      { name: '📺 Canal', value: draft.targetChannelId ? `<#${draft.targetChannelId}>` : 'Este canal', inline: true }
    );

  if (draft.notes) {
    embed.addFields({ name: '📜 Notas', value: draft.notes.slice(0, 1024), inline: false });
  }

  embed.addFields({
    name: `👥 Compo${slots ? ` · ${slots} cupos` : ''}${draft.customRoles ? ' (personalizada)' : ''}`,
    value: formatCompo(roles).slice(0, 1024),
    inline: false,
  });

  if (draft.mentionType === 'ROLE' && !pingRoleId) {
    embed.addFields({
      name: '​',
      value: '-# Este contenido no tiene rol de aviso. Un admin puede ponerlo en el panel web (`/panel`).',
    });
  }

  const contentSelect = new StringSelectMenuBuilder()
    .setCustomId('wizard_select_content')
    .setPlaceholder('¿Qué contenido sale?');
  for (const c of config.contentTypes.slice(0, 25)) {
    const opt = new StringSelectMenuOptionBuilder()
      .setLabel(c.name.slice(0, 100))
      .setValue(c.id)
      .setDescription(formatCompoInline(c.roles).slice(0, 100))
      .setDefault(c.id === content.id);
    if (c.emoji) opt.setEmoji(c.emoji);
    contentSelect.addOptions(opt);
  }

  const timeSelect = new StringSelectMenuBuilder()
    .setCustomId('wizard_select_time')
    .setPlaceholder('¿En cuánto salimos?')
    .addOptions(
      TIME_OPTIONS.map((t) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(t.label)
          .setValue(String(t.minutes))
          .setDescription(t.description)
          .setEmoji('⏰')
          .setDefault(t.minutes === minutes)
      )
    );

  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId('wizard_select_channel')
    .setPlaceholder('Canal donde publicar (por defecto, este)')
    .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);
  if (draft.targetChannelId) channelSelect.setDefaultChannels(draft.targetChannelId);

  return {
    embeds: [fitEmbed(embed)],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(contentSelect),
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(timeSelect),
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('wizard_btn_edit_details')
          .setLabel('Detalles')
          .setEmoji('📝')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('wizard_btn_edit_roles')
          .setLabel('Compo')
          .setEmoji('👥')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('wizard_btn_cycle_mention')
          .setLabel(MENTION_BUTTON[draft.mentionType])
          .setEmoji('🔔')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('wizard_btn_toggle_extras')
          .setLabel(`Voz ${draft.createVoice ? '✓' : '✗'} · Hilo ${draft.createThread ? '✓' : '✗'}`)
          .setEmoji('🔊')
          .setStyle(ButtonStyle.Secondary)
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('wizard_btn_launch_ping')
          .setLabel('Publicar ping')
          .setEmoji('🚀')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('wizard_btn_cancel').setLabel('Cancelar').setStyle(ButtonStyle.Danger)
      ),
    ],
  };
}

/**
 * Modal para editar los detalles del ping (nombre, masa, IP, montura, notas)
 */
export function buildDetailsModal(draft: DraftPingSession, content: ContentTypeConfig): ModalBuilder {
  const input = (id: string, label: string, value: string, max: number) =>
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId(id)
        .setLabel(label)
        .setStyle(TextInputStyle.Short)
        .setValue(value.slice(0, max))
        .setMaxLength(max)
        .setRequired(true)
    );

  return new ModalBuilder()
    .setCustomId('wizard_modal_details')
    .setTitle('Detalles del ping')
    .addComponents(
      input('input_title', 'Nombre de la salida', draft.title || content.name, 80),
      input('input_location', 'Lugar de masa (portal, HO, ciudad)', draft.departureLocation || content.defaultZone, 100),
      input('input_tier', 'IP mínimo / Build', draft.gearTier || content.defaultGearTier, 100),
      input('input_mount', 'Montura, comida y pociones', draft.mountRequired || content.defaultMount, 100),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('input_notes')
          .setLabel('Notas del Caller (opcional)')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(draft.notes || '')
          .setMaxLength(800)
          .setPlaceholder('Venenos T8, swap de pelea en la mochila, en voz 5 min antes...')
          .setRequired(false)
      )
    );
}
