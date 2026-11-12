import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  escapeMarkdown,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  UserSelectMenuInteraction,
} from 'discord.js';
import { ActivePing, GuildConfig } from '../types/ping';
import { ConfigManager } from '../utils/configManager';
import { DELETE_AFTER_POINTS_MS, schedulePingMessageDelete } from '../utils/pingSweeper';
import { getLimits, PREMIUM_UPSELL } from '../utils/plans';
import {
  assertCanAward,
  PERIOD_LABEL,
  playerStats,
  pointsSettings,
  PointsEntry,
  PointsError,
  proposedEntries,
  ranking,
  RankingPeriod,
  seasonStart,
  setActivityAward,
} from '../utils/points';
import { takeCooldown } from '../utils/security';
import { baseEmbed, fitEmbed } from '../utils/ui';

/**
 * Reparto de puntos en Discord. Tras el GG, el Caller (o un oficial) abre un editor efímero:
 * todos los participantes salen con los puntos por defecto y puede cambiarlos uno a uno,
 * poner a todos igual o añadir a alguien que no se anotó. Al guardar se publica el resumen.
 */

const DRAFT_TTL_MS = 30 * 60 * 1000;
const drafts = new Map<string, { entries: PointsEntry[]; at: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of drafts) if (now - v.at > DRAFT_TTL_MS) drafts.delete(k);
}, 5 * 60 * 1000).unref();

const draftKey = (guildId: string, pingId: string, userId: string) => `${guildId}:${pingId}:${userId}`;

/** Botón "Repartir puntos" para un ping terminado (o nada si no aplica). */
export function pointsButton(config: GuildConfig, ping: ActivePing): ButtonBuilder | null {
  if (!pointsSettings(config).enabled || ping.status !== 'CLOSED') return null;
  return new ButtonBuilder().setCustomId(`pts_open:${ping.id}`).setLabel('Repartir puntos').setEmoji('🏆').setStyle(ButtonStyle.Success);
}

function canManagePing(interaction: { user: { id: string }; memberPermissions: Readonly<{ has(p: bigint): boolean }> | null }, ping: ActivePing) {
  return interaction.user.id === ping.callerId || Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels));
}

function editorMessage(config: GuildConfig, ping: ActivePing, entries: PointsEntry[]) {
  const { maxPerActivity } = pointsSettings(config);
  const lines = entries.map((e, i) => `\`#${i + 1}\` ${escapeMarkdown(e.name)} — ${e.points ? `**${e.points}**` : '·'}`);
  let desc = '';
  for (let i = 0; i < lines.length; i++) {
    if (desc.length + lines[i].length > 3600) {
      desc += `\n… y ${lines.length - i} más`;
      break;
    }
    desc += (desc ? '\n' : '') + lines[i];
  }
  const given = entries.filter((e) => e.points > 0);
  const total = given.reduce((s, e) => s + e.points, 0);
  const embed = baseEmbed(config, 'Puntos')
    .setTitle(`🏆 Puntos · ${ping.title}`.slice(0, 256))
    .setDescription(desc || 'Nadie se anotó. Añade a los que fueron con el menú de abajo.')
    .setFooter({ text: `${total} pts para ${given.length} jugadores · máximo ${maxPerActivity} por jugador · 0 = sin puntos` });

  const add = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId(`pts_add:${ping.id}`)
      .setPlaceholder('➕ Añadir a alguien que fue y no se anotó')
      .setMinValues(1)
      .setMaxValues(10)
  );
  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`pts_edit:${ping.id}`).setLabel('Cambiar puntos').setEmoji('✏️').setStyle(ButtonStyle.Primary).setDisabled(entries.length === 0),
    new ButtonBuilder().setCustomId(`pts_all:${ping.id}`).setLabel('Todos igual').setEmoji('🔁').setStyle(ButtonStyle.Secondary).setDisabled(entries.length === 0),
    new ButtonBuilder().setCustomId(`pts_save:${ping.id}`).setLabel('Guardar').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`pts_cancel:${ping.id}`).setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
  );
  return { content: '', embeds: [fitEmbed(embed)], components: [add, buttons] };
}

type PointsInteraction = ButtonInteraction | UserSelectMenuInteraction | ModalSubmitInteraction;

/** Botones, menú y formularios del editor de puntos (customId pts_*). */
export async function handlePointsInteraction(interaction: PointsInteraction, config: GuildConfig) {
  const [action, pingId] = interaction.customId.split(':');
  const ping = ConfigManager.getPing(config.guildId, pingId);
  const fail = async (content: string) => {
    if (interaction.isButton() && action === 'pts_open') await interaction.reply({ content, flags: MessageFlags.Ephemeral });
    else if (interaction.isModalSubmit() && !interaction.isFromMessage()) await interaction.reply({ content, flags: MessageFlags.Ephemeral });
    else await interaction.update({ content, embeds: [], components: [] });
  };

  if (!ping) return fail('⚠️ Esta salida ya no está guardada (los pings se borran 3 días después de cerrarse).');
  if (!canManagePing(interaction, ping)) {
    await interaction.reply({ content: `⛔ Solo el Caller (<@${ping.callerId}>) o un oficial puede repartir los puntos.`, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    return;
  }
  try {
    assertCanAward(config, ping);
  } catch (err) {
    if (err instanceof PointsError) return fail(`❌ ${err.message}`);
    throw err;
  }

  const key = draftKey(config.guildId, ping.id, interaction.user.id);
  const getDraft = () => {
    let d = drafts.get(key);
    if (!d) {
      d = { entries: proposedEntries(config, ping), at: Date.now() };
      drafts.set(key, d);
    }
    d.at = Date.now();
    return d;
  };

  if (action === 'pts_open' && interaction.isButton()) {
    drafts.delete(key); // empezar siempre desde lo guardado
    await interaction.reply({ ...editorMessage(config, ping, getDraft().entries), flags: MessageFlags.Ephemeral });
    return;
  }

  if (action === 'pts_cancel' && interaction.isButton()) {
    drafts.delete(key);
    await interaction.update({ content: 'Reparto de puntos cancelado. No se guardó nada.', embeds: [], components: [] });
    return;
  }

  if (action === 'pts_add' && interaction.isUserSelectMenu()) {
    const draft = getDraft();
    const { defaultAward } = pointsSettings(config);
    for (const user of interaction.users.values()) {
      if (user.bot || draft.entries.some((e) => e.userId === user.id)) continue;
      const member = interaction.guild?.members.cache.get(user.id);
      draft.entries.push({ userId: user.id, name: member?.displayName ?? user.globalName ?? user.username, points: defaultAward });
    }
    await interaction.update(editorMessage(config, ping, draft.entries));
    return;
  }

  if (action === 'pts_edit' && interaction.isButton()) {
    const draft = getDraft();
    let value = '';
    draft.entries.forEach((e, i) => {
      const line = `${e.points}  ${e.name.replace(/#/g, '').slice(0, 24)}  #${i + 1}`;
      if (value.length + line.length + 1 <= 4000) value += (value ? '\n' : '') + line;
    });
    const modal = new ModalBuilder().setCustomId(`pts_modal_edit:${ping.id}`).setTitle('Cambiar puntos');
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('lines')
          .setLabel('Cambia el número al inicio de cada línea')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(value)
          .setMaxLength(4000)
          .setRequired(true)
      )
    );
    await interaction.showModal(modal);
    return;
  }

  if (action === 'pts_all' && interaction.isButton()) {
    const { defaultAward, maxPerActivity } = pointsSettings(config);
    const modal = new ModalBuilder().setCustomId(`pts_modal_all:${ping.id}`).setTitle('Mismos puntos para todos');
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('points')
          .setLabel(`Puntos para cada jugador (0 a ${maxPerActivity})`)
          .setStyle(TextInputStyle.Short)
          .setValue(String(defaultAward))
          .setMaxLength(6)
          .setRequired(true)
      )
    );
    await interaction.showModal(modal);
    return;
  }

  if ((action === 'pts_modal_edit' || action === 'pts_modal_all') && interaction.isModalSubmit() && interaction.isFromMessage()) {
    const draft = getDraft();
    const { maxPerActivity } = pointsSettings(config);
    const valid = (n: number) => Number.isInteger(n) && n >= 0 && n <= maxPerActivity;
    if (action === 'pts_modal_all') {
      const n = Number(interaction.fields.getTextInputValue('points').trim());
      if (!valid(n)) {
        await interaction.reply({ content: `❌ Escribe un número de 0 a ${maxPerActivity}.`, flags: MessageFlags.Ephemeral });
        return;
      }
      for (const e of draft.entries) e.points = n;
    } else {
      const bad: string[] = [];
      for (const raw of interaction.fields.getTextInputValue('lines').split('\n')) {
        const line = raw.trim();
        if (!line) continue;
        const ref = line.match(/#(\d+)\s*$/);
        const pts = line.match(/^(\d+)/);
        const entry = ref ? draft.entries[Number(ref[1]) - 1] : undefined;
        if (!entry) continue; // línea sin referencia: se ignora
        const n = pts ? Number(pts[1]) : NaN;
        if (!valid(n)) bad.push(entry.name);
        else entry.points = n;
      }
      if (bad.length) {
        await interaction.update(editorMessage(config, ping, draft.entries));
        await interaction.followUp({
          content: `⚠️ No cambié a ${bad.map((n) => `**${escapeMarkdown(n)}**`).join(', ')}: los puntos deben ir de 0 a ${maxPerActivity}.`.slice(0, 1900),
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }
    await interaction.update(editorMessage(config, ping, draft.entries));
    return;
  }

  if (action === 'pts_save' && interaction.isButton()) {
    const draft = getDraft();
    let result;
    try {
      result = setActivityAward(config, ping, draft.entries, interaction.user.id);
    } catch (err) {
      if (err instanceof PointsError) {
        await interaction.reply({ content: `❌ ${err.message}`, flags: MessageFlags.Ephemeral });
        return;
      }
      throw err;
    }
    drafts.delete(key);
    const { award, previous } = result;
    if (!award) {
      // Sin reparto el mensaje vuelve a quedarse hasta la limpieza de los 3 días
      if (ping.messageDeleteAt && !ping.messageDeleted) {
        ping.messageDeleteAt = undefined;
        ConfigManager.savePing(config.guildId, ping);
      }
      await interaction.update({ content: previous ? '🗑️ Quité los puntos de esta salida.' : 'Nadie tenía puntos: no se guardó nada.', embeds: [], components: [] });
      return;
    }
    const total = award.entries.reduce((s, e) => s + e.points, 0);
    // El anuncio de puntos queda como registro; el mensaje del ping se borra en unos minutos
    const deleteMinutes = Math.round(DELETE_AFTER_POINTS_MS / 60000);
    const scheduleDelete = !ping.messageDeleted;
    if (scheduleDelete) schedulePingMessageDelete(config.guildId, ping, DELETE_AFTER_POINTS_MS);
    await interaction.update({
      content:
        `✅ ${previous ? 'Puntos corregidos' : 'Puntos repartidos'}: **${total}** entre **${award.entries.length}** jugadores. Míralos con \`/ranking\`.` +
        (scheduleDelete
          ? `\n-# El mensaje del ping se borra en ${deleteMinutes} min; si te equivocaste, corrige antes con \`/mando\` (o después desde el panel).`
          : ''),
      embeds: [],
      components: [],
    });
    await announceAward(interaction, ping, award.entries, Boolean(previous));
  }
}

/**
 * Publica el resumen del reparto en el canal del ping (sin mencionar a nadie).
 * No responde al mensaje del ping porque ese mensaje se borra después del reparto.
 */
async function announceAward(interaction: ButtonInteraction, ping: ActivePing, entries: PointsEntry[], corrected: boolean) {
  const channel = await interaction.client.channels.fetch(ping.channelId).catch(() => null);
  if (!channel || !channel.isTextBased() || !('send' in channel)) return;
  const head = `🏆 **Puntos${corrected ? ' corregidos' : ''} · ${escapeMarkdown(ping.title)}** — repartidos por <@${interaction.user.id}>\n`;
  let body = '';
  for (const [i, e] of entries.entries()) {
    const part = `<@${e.userId}> **${e.points}**`;
    if (head.length + body.length + part.length > 1900) {
      body += ` … y ${entries.length - i} más`;
      break;
    }
    body += (body ? ' · ' : '') + part;
  }
  await channel
    .send({ content: head + body, allowedMentions: { parse: [] } })
    .catch(() => null);
}

// ---------- Comandos ----------

function periodOption(interaction: ChatInputCommandInteraction): RankingPeriod {
  const p = interaction.options.getString('periodo');
  return p === 'week' || p === 'month' ? p : 'total';
}

function seasonText(guildId: string) {
  const start = seasonStart(guildId);
  return start ? `desde <t:${Math.floor(start / 1000)}:D>` : 'desde el principio';
}

/** /ranking: tabla de puntos del servidor (pública). */
export async function handleRankingCommand(interaction: ChatInputCommandInteraction, config: GuildConfig) {
  if (!pointsSettings(config).enabled) {
    await interaction.reply({ content: 'Los puntos están desactivados en este servidor.', flags: MessageFlags.Ephemeral });
    return;
  }
  const limits = getLimits(config);
  const period = periodOption(interaction);
  if (period !== 'total' && !limits.pointsPro) {
    await interaction.reply({ content: `El ranking semanal y mensual es Premium. ${PREMIUM_UPSELL}`, flags: MessageFlags.Ephemeral });
    return;
  }
  const wait = takeCooldown(`ranking:${config.guildId}:${interaction.channelId}`, 15_000);
  if (wait > 0) {
    await interaction.reply({ content: `⏳ El ranking se acaba de mostrar aquí. Espera ${wait} s.`, flags: MessageFlags.Ephemeral });
    return;
  }

  const rows = ranking(config.guildId, period);
  const top = rows.slice(0, limits.pointsRankingSize);
  const medal = (rank: number) => ['🥇', '🥈', '🥉'][rank - 1] ?? `\`${String(rank).padStart(2, ' ')}.\``;
  const lines = top.map((r) => `${medal(r.rank)} <@${r.userId}> — **${r.points}** pts · ${r.activities} ${r.activities === 1 ? 'actividad' : 'actividades'}`);
  const embed = baseEmbed(config, 'Ranking')
    .setTitle(`🏆 Ranking · ${PERIOD_LABEL[period]}`)
    .setDescription(
      lines.length
        ? `${period === 'total' ? `-# Temporada ${seasonText(config.guildId)}\n` : ''}${lines.join('\n')}`
        : 'Todavía nadie tiene puntos. Se reparten al terminar cada salida (botón **GG** del Caller).'
    );
  if (rows.length > top.length) {
    embed.addFields({ name: '​', value: `-# ${rows.length - top.length} jugadores más con puntos.${limits.pointsPro ? '' : ' Premium muestra el top 25.'}` });
  }
  await interaction.reply({ embeds: [fitEmbed(embed)], allowedMentions: { parse: [] } });
}

/** /puntos [jugador]: puntos y puesto de un jugador (efímero). */
export async function handlePointsCommand(interaction: ChatInputCommandInteraction, config: GuildConfig) {
  if (!pointsSettings(config).enabled) {
    await interaction.reply({ content: 'Los puntos están desactivados en este servidor.', flags: MessageFlags.Ephemeral });
    return;
  }
  const user = interaction.options.getUser('jugador') ?? interaction.user;
  const pro = getLimits(config).pointsPro;
  const { row, recent } = playerStats(config.guildId, user.id, 'total');
  const self = user.id === interaction.user.id;

  const embed = baseEmbed(config, 'Puntos').setTitle(`🏆 Puntos de ${self ? 'ti' : user.displayName}`.slice(0, 256));
  if (!row) {
    embed.setDescription(`${self ? 'Todavía no tienes' : `<@${user.id}> todavía no tiene`} puntos en esta temporada. Se ganan participando en las salidas.`);
  } else {
    const desc = [`**${row.points}** pts · puesto **#${row.rank}** · ${row.activities} ${row.activities === 1 ? 'actividad' : 'actividades'}`, `-# Temporada ${seasonText(config.guildId)}`];
    if (pro) {
      const week = playerStats(config.guildId, user.id, 'week').row;
      const month = playerStats(config.guildId, user.id, 'month').row;
      desc.push('', `📅 Últimos 7 días: **${week?.points ?? 0}** pts${week ? ` (#${week.rank})` : ''}`, `🗓️ Últimos 30 días: **${month?.points ?? 0}** pts${month ? ` (#${month.rank})` : ''}`);
    }
    if (recent.length) {
      desc.push('', '**Últimos puntos**', ...recent.map((a) => `${a.points > 0 ? '+' : ''}${a.points} · ${escapeMarkdown(a.title)} · <t:${Math.floor(a.at / 1000)}:R>`));
    }
    embed.setDescription(desc.join('\n'));
  }
  await interaction.reply({ embeds: [fitEmbed(embed)], flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
}

