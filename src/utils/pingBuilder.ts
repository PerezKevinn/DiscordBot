import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { ActivePing, ContentTypeConfig, GuildConfig, RoleTemplate, RosterSlotUser } from '../types/ping';
import { generatePingBanner } from './canvasGenerator';
import { botBrandName, brandForRender, getLimits } from './plans';
import { fitEmbed, splitRoleLabel } from './ui';
import { componentEmoji } from './emoji';
import { getItem, isTwoHanded } from '../data/items';
import { hasAnyBuild } from './buildCard';

/** Barra de progreso de la party con caracteres finos (se ve bien en modo claro y oscuro). */
function buildProgressBar(current: number, max: number, length = 10): string {
  if (max <= 0) return '';
  const filled = Math.round(Math.min(1, Math.max(0, current / max)) * length);
  return '▰'.repeat(filled) + '▱'.repeat(length - filled);
}

function formatPlayer(u: RosterSlotUser, idx: number): string {
  return `\`${idx + 1}.\` <@${u.userId}>${u.customWeapon ? ` · *${u.customWeapon}*` : ''}`;
}

function buildRoleField(role: RoleTemplate, signed: RosterSlotUser[]) {
  const { name, weapons: labelWeapons } = splitRoleLabel(role.label);
  // Si el rol tiene build, se muestra su arma (nombre oficial) cuando el nombre no trae armas
  const buildWeapon = getItem(role.build?.weapon)?.name;
  const buildOff = isTwoHanded(role.build?.weapon) ? undefined : getItem(role.build?.offhand)?.name;
  const weapons = labelWeapons || (buildWeapon ? (buildOff ? `${buildWeapon} + ${buildOff}` : buildWeapon) : undefined);
  const count = role.maxSlots > 0 ? `${signed.length}/${role.maxSlots}` : `${signed.length}`;
  const isFull = role.maxSlots > 0 && signed.length >= role.maxSlots;
  const free = role.maxSlots > 0 ? role.maxSlots - signed.length : 0;

  const lines: string[] = [];
  if (weapons) lines.push(`-# ${weapons}`);
  lines.push(...signed.map(formatPlayer));
  if (signed.length === 0) lines.push(role.maxSlots > 0 ? `*${role.maxSlots} libre${role.maxSlots > 1 ? 's' : ''}*` : '*Libre*');
  else if (free > 0) lines.push(`*+${free} libre${free > 1 ? 's' : ''}*`);

  return {
    name: `${role.emoji} ${name} · ${count}${isFull ? ' 🔒' : ''}`.slice(0, 256),
    value: lines.join('\n').slice(0, 1024),
    inline: true,
  };
}

/**
 * Mensaje completo del Ping:
 * - Cabecera gráfica (banner) con el título y el contador de la party
 * - Embed con los datos en vivo (hora relativa, masa, IP, voz, hilo) y el roster por rol
 * - Menú para elegir rol y botones
 */
export async function buildPingMessagePayload(
  ping: ActivePing,
  contentConfig: ContentTypeConfig,
  rawConfig: GuildConfig
) {
  const guildConfig = brandForRender(rawConfig);
  const limits = getLimits(rawConfig);
  const bannerBuffer = await generatePingBanner(ping, contentConfig, guildConfig);
  const attachmentName = `ping-${ping.id}.png`;
  const attachment = new AttachmentBuilder(bannerBuffer, { name: attachmentName });

  const totalJoined = Object.values(ping.roster).reduce((acc, list) => acc + list.length, 0);
  const totalMax = ping.roles.reduce((acc, r) => acc + (r.maxSlots || 0), 0);
  const isClosed = ping.status === 'CLOSED' || ping.status === 'CANCELLED';
  const departed = Date.now() / 1000 >= ping.startTimeUnix;

  const statusText: Record<ActivePing['status'], string> = {
    OPEN: departed ? '🟠 **Saliendo** — si llegas tarde, pide inv al Caller' : '🟢 **Abierto** — ¡anótate en tu rol!',
    IN_PROGRESS: '⚔️ **En ruta** — pide inv al Caller si llegas',
    CLOSED: '🔒 **GG** — contenido terminado',
    CANCELLED: '🔴 **Cancelado**',
  };

  const extras = [
    ping.voiceChannelId && !isClosed ? `🔊 <#${ping.voiceChannelId}>` : '',
    ping.threadId ? `💬 <#${ping.threadId}>` : '',
  ].filter(Boolean);

  const description = [
    statusText[ping.status],
    '',
    `⏰ **Salida:** ${ping.timeLabel?.endsWith('UTC') ? `**${ping.timeLabel}** · ` : ''}<t:${ping.startTimeUnix}:t> · <t:${ping.startTimeUnix}:R>`,
    `📍 **Masa en:** ${ping.departureLocation}`,
    `🛡️ **IP / Build:** ${ping.gearTier}`,
    `🐎 **Montura:** ${ping.mountRequired}`,
    `👑 **Caller:** <@${ping.callerId}>`,
    extras.length ? extras.join('  ·  ') : '',
    ping.notes ? `\n📜 **Notas del Caller**\n${ping.notes.split('\n').map((l) => `> ${l}`).join('\n')}` : '',
    '',
    `👥 **Party:** ${totalJoined}${totalMax > 0 ? `/${totalMax}` : ''}  ${buildProgressBar(totalJoined, totalMax)}`,
  ]
    .filter((l, i, arr) => l !== '' || (arr[i - 1] !== '' && i > 0))
    .join('\n');

  const embed = new EmbedBuilder()
    .setColor(isClosed ? 0x4f545c : guildConfig.colors.embedHex)
    .setAuthor({
      name: `${`${guildConfig.guildName} ${guildConfig.guildTag}`.trim()} • ${contentConfig.name}`.slice(0, 256),
    })
    .setTitle(`${contentConfig.emoji}  ${ping.title.toUpperCase()}`.slice(0, 256))
    .setDescription(description.slice(0, 4096))
    .setImage(`attachment://${attachmentName}`)
    .setFooter({
      text: `ID ${ping.id}${limits.hideBotFooter ? '' : ` • Creado con ${botBrandName()}`}`,
    })
    .setTimestamp(new Date(ping.createdAt));

  for (const role of ping.roles.slice(0, 22)) {
    embed.addFields(buildRoleField(role, ping.roster[role.id] || []));
  }

  if (ping.bench.length > 0) {
    embed.addFields({
      name: `🔄 Banca · ${ping.bench.length}`,
      value: ping.bench.map(formatPlayer).join('\n').slice(0, 1024),
      inline: false,
    });
  }

  if (ping.absent.length > 0) {
    embed.addFields({
      name: `❌ No van · ${ping.absent.length}`,
      value: ping.absent.map((u) => `<@${u.userId}>`).join(', ').slice(0, 1024),
      inline: false,
    });
  }

  // Componentes interactivos (Desactivados si ya cerró o canceló)

  // Fila 1: Select Menu con todos los roles configurados para este contenido
  const roleSelect = new StringSelectMenuBuilder()
    .setCustomId(`ping_role_select:${ping.id}`)
    .setPlaceholder(
      isClosed ? '🔒 Esta salida ya terminó' : '⚔️ ¿De qué vas? Elige tu rol...'
    )
    .setDisabled(isClosed);

  for (const role of ping.roles.slice(0, 24)) {
    const signedCount = (ping.roster[role.id] || []).length;
    const isFull = role.maxSlots > 0 && signedCount >= role.maxSlots;
    const slotText = role.maxSlots > 0 ? `[${signedCount}/${role.maxSlots}]` : `[${signedCount}]`;

    const option = new StringSelectMenuOptionBuilder()
      .setLabel(`${splitRoleLabel(role.label).name} ${slotText}${isFull ? ' · lleno → Banca' : ''}`.slice(0, 100))
      .setValue(role.id)
      .setDescription(
        (splitRoleLabel(role.label).weapons || role.description || 'Meterme con este rol').slice(0, 100)
      );

    const emoji = componentEmoji(role.emoji);
    if (emoji) option.setEmoji(emoji);
    roleSelect.addOptions(option);
  }

  const rowSelect = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(roleSelect);

  // Fila 2: Botones de Acción Rápida para Jugadores y Gestión para el Caller
  const btnNote = new ButtonBuilder()
    .setCustomId(`ping_btn_weapon:${ping.id}`)
    .setLabel('Poner mi Arma / IP')
    .setEmoji('🗡️')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(isClosed);

  const btnLeave = new ButtonBuilder()
    .setCustomId(`ping_btn_leave:${ping.id}`)
    .setLabel('Bajarme')
    .setEmoji('❌')
    .setStyle(ButtonStyle.Danger)
    .setDisabled(isClosed);

  const btnCallerManage = new ButtonBuilder()
    .setCustomId(`ping_btn_caller:${ping.id}`)
    .setLabel('Mando Caller')
    .setEmoji('👑')
    .setStyle(ButtonStyle.Success);

  const btnBuilds = new ButtonBuilder()
    .setCustomId(`ping_btn_builds:${ping.id}`)
    .setLabel('Builds')
    .setEmoji('📋')
    .setStyle(ButtonStyle.Secondary);

  const rowButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(btnNote,
    btnLeave,
    btnCallerManage);
  if (hasAnyBuild(ping.roles)) rowButtons.addComponents(btnBuilds);

  return {
    embeds: [fitEmbed(embed)],
    files: [attachment],
    components: [rowSelect, rowButtons],
  };
}

