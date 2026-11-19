/**
 * Sistema de tickets y fichas de Albion.
 *
 * Flujo: un panel con un botón por tipo de ticket → formulario (personaje de Albion en los de
 * reclutamiento y las preguntas configuradas) → canal privado o hilo privado con el aspirante y el
 * staff → Atender, Cerrar (con transcripción al canal de registro), Reabrir, Borrar y, en
 * reclutamiento, Aceptar (da roles y apodo) o Rechazar.
 *
 * Prefijo de customId: tk_*. El id de un ticket es el de su canal o hilo.
 */
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
  escapeMarkdown,
  Guild,
  GuildMember,
  Interaction,
  LabelBuilder,
  Message,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  OverwriteResolvable,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
  ThreadChannel,
} from 'discord.js';
import { GuildConfig, TicketPanel, TicketSettings, TicketType } from '../types/ping';
import {
  ALBION_NAME_RE,
  ALBION_SERVERS,
  AlbionError,
  AlbionServer,
  exactMatch,
  getPlayerProfile,
  PlayerMatch,
  PlayerProfile,
  searchPlayers,
  SERVER_LABEL,
  shortNumber,
} from '../utils/albion';
import { ConfigManager } from '../utils/configManager';
import { botBrandName, getLimits } from '../utils/plans';
import { isGuildManager } from '../utils/permissions';
import { cleanUserText, takeCooldown } from '../utils/security';
import {
  createTicket,
  defaultTicketSettings,
  deleteTicket,
  getTicket,
  openTicketOf,
  peekNextNumber,
  saveTicket,
  Ticket,
  ticketNumber,
} from '../utils/tickets';
import { baseEmbed, UI_COLORS } from '../utils/ui';
import { reportError } from '../utils/alerts';

type TicketChannel = TextChannel | ThreadChannel;

/** Error con un mensaje apto para mostrar al usuario tal cual. */
export class TicketError extends Error {}

const BUTTON_STYLE: Record<TicketType['buttonStyle'], ButtonStyle> = {
  primary: ButtonStyle.Primary,
  secondary: ButtonStyle.Secondary,
  success: ButtonStyle.Success,
  danger: ButtonStyle.Danger,
};

/** Preguntas como máximo por tipo: Discord admite 5 campos por formulario y el reclutamiento usa 2. */
export const MAX_QUESTIONS = 5;
export const MAX_RECRUIT_QUESTIONS = 3;

/** Ajustes de tickets del servidor (los valores por defecto si nunca se configuraron). */
export function ticketSettings(config: GuildConfig): TicketSettings {
  return config.tickets ?? defaultTicketSettings();
}

// Permisos del aspirante y el staff dentro de un canal de ticket.
const MEMBER_ALLOW = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.EmbedLinks,
];

// ---------- Permisos ----------

function memberRoleIds(interaction: Interaction): string[] {
  const roles = interaction.member?.roles;
  if (!roles) return [];
  return Array.isArray(roles) ? roles : [...roles.cache.keys()];
}

/** Staff del ticket: quien tiene uno de sus roles de staff o Gestionar servidor. */
function isStaff(interaction: Interaction, type: TicketType | undefined): boolean {
  if (isGuildManager(interaction)) return true;
  if (!type) return false;
  const roles = memberRoleIds(interaction);
  return type.staffRoleIds.some((r) => roles.includes(r));
}

/**
 * Problemas de permisos del bot para los tickets configurados, en texto para el panel. Lista vacía
 * si está todo bien.
 */
export function ticketPermissionIssues(guild: Guild, settings: TicketSettings): string[] {
  const me = guild.members.me;
  if (!me) return [];
  const issues: string[] = [];
  const need = (flag: bigint, label: string, why: string) => {
    if (!me.permissions.has(flag)) issues.push(`Falta el permiso **${label}**: ${why}.`);
  };
  if (settings.types.some((t) => t.mode === 'channel')) {
    need(PermissionFlagsBits.ManageChannels, 'Gestionar canales', 'para crear los canales de los tickets');
    need(PermissionFlagsBits.ManageRoles, 'Gestionar roles', 'para dar acceso al aspirante y cerrar el canal');
  }
  if (settings.types.some((t) => t.mode === 'thread')) {
    need(PermissionFlagsBits.CreatePrivateThreads, 'Crear hilos privados', 'para los tickets en hilo');
    need(PermissionFlagsBits.ManageThreads, 'Gestionar hilos', 'para cerrar los hilos');
  }
  const recruit = settings.types.filter((t) => t.recruitment);
  if (recruit.some((t) => t.acceptRoleIds.length > 0 || t.removeRoleIds.length > 0)) {
    need(PermissionFlagsBits.ManageRoles, 'Gestionar roles', 'para dar los roles al aceptar');
    const top = me.roles.highest.position;
    const high = new Set<string>();
    for (const t of recruit) {
      for (const id of [...t.acceptRoleIds, ...t.removeRoleIds]) {
        const role = guild.roles.cache.get(id);
        if (role && role.position >= top) high.add(role.name);
      }
    }
    if (high.size > 0) issues.push(`Mi rol está por debajo de **${[...high].join(', ')}**: súbelo en Ajustes del servidor > Roles para poder darlos.`);
  }
  if (recruit.some((t) => t.setNickname)) need(PermissionFlagsBits.ManageNicknames, 'Gestionar apodos', 'para poner el nombre del personaje');
  if (settings.logChannelId) {
    const log = guild.channels.cache.get(settings.logChannelId);
    const perms = log && me && log.permissionsFor(me);
    if (!perms || !perms.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles])) {
      issues.push('No puedo enviar mensajes con archivos en el canal de registro.');
    }
  }
  return [...new Set(issues)];
}

// ---------- Panel ----------

/** Mensaje del panel: un botón por tipo de ticket, de 5 en 5. */
export function buildTicketPanelMessage(config: GuildConfig, panel: TicketPanel) {
  const settings = ticketSettings(config);
  const types = panel.typeIds.map((id) => settings.types.find((t) => t.id === id)).filter((t): t is TicketType => Boolean(t));
  const lines = types.map((t) => `${t.emoji} **${t.name}**${t.description ? `\n-# ${t.description}` : ''}`);
  const embed = baseEmbed(config, 'Tickets')
    .setTitle(panel.title || 'Tickets')
    .setDescription([panel.description, lines.join('\n')].filter(Boolean).join('\n\n').slice(0, 4000) || 'Pulsa un botón para abrir un ticket.');
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < types.length && rows.length < 5; i += 5) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        types.slice(i, i + 5).map((t) =>
          new ButtonBuilder()
            .setCustomId(`tk_open:${t.id}`)
            .setLabel(t.name.slice(0, 80))
            .setStyle(BUTTON_STYLE[t.buttonStyle])
            .setEmoji(t.emoji)
        )
      )
    );
  }
  return { embeds: [embed], components: rows };
}

/**
 * Publica el panel o edita el mensaje que ya se publicó. Devuelve el enlace al mensaje.
 * @throws TicketError con un mensaje apto para el panel web.
 */
export async function publishTicketPanel(client: Client, config: GuildConfig, panelId: string): Promise<string> {
  const settings = ticketSettings(config);
  const panel = settings.panels.find((p) => p.id === panelId);
  if (!panel) throw new TicketError('Ese panel no existe. Guarda los cambios antes de publicar.');
  if (!panel.typeIds.some((id) => settings.types.some((t) => t.id === id))) throw new TicketError('El panel no tiene ningún tipo de ticket.');
  const channel = await client.channels.fetch(panel.channelId).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText || channel.guildId !== config.guildId) throw new TicketError('El canal del panel no existe.');
  const me = channel.guild.members.me;
  if (!me || !channel.permissionsFor(me).has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
    throw new TicketError(`No puedo escribir en #${channel.name}.`);
  }
  const payload = buildTicketPanelMessage(config, panel);
  let message: Message | null = null;
  if (panel.messageId) {
    const old = await channel.messages.fetch(panel.messageId).catch(() => null);
    if (old) message = await old.edit(payload);
  }
  if (!message) message = await channel.send(payload);
  panel.messageId = message.id;
  ConfigManager.saveConfig(config);
  return message.url;
}

// ---------- Entrada ----------

/** Botones, menús y formularios con prefijo tk_. */
export async function handleTicketInteraction(interaction: Interaction, config: GuildConfig): Promise<void> {
  if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit()) return;
  const [action, arg, arg2] = interaction.customId.split(':');
  try {
    if (interaction.isButton()) {
      if (action === 'tk_open') return await onOpenButton(interaction, config, arg);
      if (action === 'tk_claim') return await onClaim(interaction, config, arg);
      if (action === 'tk_close') return await showReasonModal(interaction, config, arg, 'close');
      if (action === 'tk_reject') return await showReasonModal(interaction, config, arg, 'reject');
      if (action === 'tk_accept') return await onAccept(interaction, config, arg);
      if (action === 'tk_reopen') return await onReopen(interaction, config, arg);
      if (action === 'tk_delete') return await onDelete(interaction, config, arg);
      if (action === 'tk_char') return await showCharacterModal(interaction, config, arg);
      if (action === 'tk_refresh') return await onRefresh(interaction, config, arg);
    }
    if (interaction.isStringSelectMenu()) {
      if (action === 'tk_pick') return await onPick(interaction, config, arg);
      if (action === 'tk_stats') return await onStatsPick(interaction, config, arg as AlbionServer, arg2);
    }
    if (interaction.isModalSubmit()) {
      if (action === 'tk_form') return await onForm(interaction, config, arg);
      if (action === 'tk_closeform') return await onCloseForm(interaction, config, arg);
      if (action === 'tk_rejectform') return await onRejectForm(interaction, config, arg);
      if (action === 'tk_charform') return await onCharacterForm(interaction, config, arg);
    }
  } catch (err) {
    if (err instanceof TicketError || err instanceof AlbionError) {
      await replyError(interaction, err.message);
      return;
    }
    throw err;
  }
}

async function replyError(interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction | ChatInputCommandInteraction, text: string) {
  const content = `⚠️ ${text}`;
  if (interaction.deferred || interaction.replied) await interaction.followUp({ content, flags: MessageFlags.Ephemeral }).catch(() => null);
  else await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => null);
}

// Ticket y tipo a partir del id, comprobando que existe y que quien pulsa puede tocarlo.
function loadTicket(
  interaction: Interaction,
  config: GuildConfig,
  ticketId: string,
  who: 'staff' | 'owner-or-staff'
): { ticket: Ticket; type: TicketType | undefined } {
  const ticket = getTicket(config.guildId, ticketId);
  if (!ticket) throw new TicketError('Este ticket ya no está registrado.');
  const type = ticketSettings(config).types.find((t) => t.id === ticket.typeId);
  const staff = isStaff(interaction, type);
  if (who === 'staff' && !staff) throw new TicketError('Solo el staff del ticket puede hacer esto.');
  if (who === 'owner-or-staff' && !staff && interaction.user.id !== ticket.userId) throw new TicketError('Solo el autor del ticket o el staff pueden hacer esto.');
  return { ticket, type };
}

async function ticketChannel(client: Client, ticket: Ticket): Promise<TicketChannel | null> {
  const ch = await client.channels.fetch(ticket.channelId).catch(() => null);
  if (ch && (ch.type === ChannelType.GuildText || ch.type === ChannelType.PrivateThread)) return ch as TicketChannel;
  return null;
}

// ---------- Abrir ----------

async function onOpenButton(interaction: ButtonInteraction, config: GuildConfig, typeId: string) {
  const settings = ticketSettings(config);
  const type = settings.types.find((t) => t.id === typeId);
  if (!type) throw new TicketError('Este tipo de ticket ya no existe. Avisa a un admin para que actualice el panel.');

  const existing = openTicketOf(config.guildId, interaction.user.id, type.id);
  if (existing) {
    if (await ticketChannel(interaction.client, existing)) throw new TicketError(`Ya tienes un ticket abierto: <#${existing.channelId}>`);
    deleteTicket(config.guildId, existing.id); // Borraron el canal a mano.
  }

  const askServer = type.recruitment && settings.albionServer === 'ask';
  if (!type.recruitment && type.questions.length === 0) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await openTicket(interaction, config, type, [], undefined);
    return;
  }

  const modal = new ModalBuilder().setCustomId(`tk_form:${type.id}`).setTitle(`${type.name}`.slice(0, 45));
  if (type.recruitment) {
    modal.addLabelComponents(
      new LabelBuilder()
        .setLabel('Nombre de tu personaje en Albion')
        .setTextInputComponent(
          new TextInputBuilder().setCustomId('char').setStyle(TextInputStyle.Short).setMinLength(3).setMaxLength(16).setRequired(true).setPlaceholder('Tal cual sale en el juego')
        )
    );
  }
  if (askServer) {
    modal.addLabelComponents(
      new LabelBuilder()
        .setLabel('Servidor de Albion')
        .setStringSelectMenuComponent(
          new StringSelectMenuBuilder()
            .setCustomId('server')
            .setRequired(true)
            .addOptions(ALBION_SERVERS.map((s) => ({ label: SERVER_LABEL[s], value: s })))
        )
    );
  }
  const room = 5 - (type.recruitment ? 1 : 0) - (askServer ? 1 : 0);
  for (const q of type.questions.slice(0, room)) {
    const input = new TextInputBuilder()
      .setCustomId(`q_${q.id}`)
      .setStyle(q.style === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
      .setRequired(q.required)
      .setMaxLength(q.style === 'paragraph' ? 1000 : 200);
    if (q.placeholder) input.setPlaceholder(q.placeholder.slice(0, 100));
    modal.addLabelComponents(new LabelBuilder().setLabel(q.label.slice(0, 45)).setTextInputComponent(input));
  }
  await interaction.showModal(modal);
}

async function onForm(interaction: ModalSubmitInteraction, config: GuildConfig, typeId: string) {
  const settings = ticketSettings(config);
  const type = settings.types.find((t) => t.id === typeId);
  if (!type) throw new TicketError('Este tipo de ticket ya no existe.');

  let albion: Ticket['albion'];
  if (type.recruitment) {
    const name = interaction.fields.getTextInputValue('char').trim();
    if (!ALBION_NAME_RE.test(name)) throw new TicketError('El nombre del personaje tiene de 3 a 16 letras o números, sin espacios.');
    const server = settings.albionServer === 'ask' ? (interaction.fields.getStringSelectValues('server')[0] as AlbionServer) : settings.albionServer;
    if (!ALBION_SERVERS.includes(server)) throw new TicketError('Servidor de Albion no válido.');
    albion = { server, name };
  }
  const answers: Ticket['answers'] = [];
  for (const q of type.questions) {
    let value = '';
    try {
      value = interaction.fields.getTextInputValue(`q_${q.id}`);
    } catch {
      continue; // La pregunta no cabía en el formulario o se añadió después de abrirlo.
    }
    const answer = cleanUserText(value, 1000);
    if (answer) answers.push({ question: q.label, answer });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await openTicket(interaction, config, type, answers, albion);
}

/** Crea el canal o hilo, publica la bienvenida y, en reclutamiento, la ficha. */
async function openTicket(
  interaction: ButtonInteraction | ModalSubmitInteraction,
  config: GuildConfig,
  type: TicketType,
  answers: Ticket['answers'],
  albion: Ticket['albion']
) {
  const guild = interaction.guild;
  if (!guild) throw new TicketError('No encuentro el servidor.');
  if (openTicketOf(config.guildId, interaction.user.id, type.id)) throw new TicketError('Ya tienes un ticket abierto de este tipo.');
  const wait = takeCooldown(`tkopen:${config.guildId}:${interaction.user.id}`, 30_000);
  if (wait) throw new TicketError(`Espera ${wait} s antes de abrir otro ticket.`);

  const me = guild.members.me ?? (await guild.members.fetchMe());
  const number = peekNextNumber(config.guildId);
  const slug = type.name.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20) || 'ticket';
  const name = `${slug}-${ticketNumber(number)}`;
  const reason = `Ticket de ${interaction.user.tag} (${type.name})`;
  const staffRoles = type.staffRoleIds.filter((id) => guild.roles.cache.has(id));

  let channel: TicketChannel;
  if (type.mode === 'thread') {
    const parentId = type.threadChannelId || interaction.channelId;
    const parent = parentId ? await guild.channels.fetch(parentId).catch(() => null) : null;
    if (!parent || parent.type !== ChannelType.GuildText) throw new TicketError('El canal de los hilos de este ticket no existe. Avisa a un admin.');
    if (!parent.permissionsFor(me).has([PermissionFlagsBits.CreatePrivateThreads, PermissionFlagsBits.SendMessagesInThreads])) {
      throw new TicketError(`No puedo crear hilos privados en #${parent.name}. Avisa a un admin.`);
    }
    channel = await parent.threads.create({ name, type: ChannelType.PrivateThread, invitable: false, autoArchiveDuration: 10080, reason });
    await channel.members.add(interaction.user.id);
  } else {
    let parentId: string | undefined = type.categoryId;
    if (!parentId && interaction.channel && 'parentId' in interaction.channel) parentId = interaction.channel.parentId ?? undefined;
    if (parentId && guild.channels.cache.get(parentId)?.type !== ChannelType.GuildCategory) parentId = undefined;
    if (!me.permissions.has([PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles])) {
      throw new TicketError('Me faltan los permisos **Gestionar canales** y **Gestionar roles** para crear tickets. Avisa a un admin.');
    }
    const overwrites: OverwriteResolvable[] = [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: me.id, allow: [...MEMBER_ALLOW, PermissionFlagsBits.ManageChannels] },
      { id: interaction.user.id, allow: MEMBER_ALLOW },
      ...staffRoles.map((id) => ({ id, allow: MEMBER_ALLOW })),
    ];
    channel = await guild.channels.create({
      name,
      type: ChannelType.GuildText,
      parent: parentId,
      permissionOverwrites: overwrites,
      topic: `Ticket #${ticketNumber(number)} · ${type.name} · ${interaction.user.tag}`.slice(0, 1024),
      reason,
    });
  }

  const ticket = createTicket(config.guildId, {
    typeId: type.id,
    typeName: type.name,
    userId: interaction.user.id,
    userName: interaction.user.tag,
    channelId: channel.id,
    kind: type.mode,
    answers,
    albion,
  });

  // En los hilos privados, mencionar a un rol es lo que añade a sus miembros.
  const mentionStaff = type.pingStaff || type.mode === 'thread';
  await channel.send({
    content: [`<@${ticket.userId}>`, ...(mentionStaff ? staffRoles.map((r) => `<@&${r}>`) : [])].join(' '),
    allowedMentions: { users: [ticket.userId], roles: mentionStaff ? staffRoles : [] },
    ...buildWelcome(config, type, ticket),
  });
  await interaction.editReply({ content: `✅ Ticket creado: ${channel.toString()}` });
  void logEvent(interaction.client, config, ticket, 'open');

  if (ticket.albion) {
    const payload = await recruitStatsPayload(config, ticket).catch((err) => statsErrorPayload(ticket, err));
    await channel.send(payload).catch((err) => console.warn(`[${config.guildId}] Ficha del ticket:`, (err as Error).message));
  }
}

/** Mensaje de bienvenida del ticket con las respuestas y los botones de control. */
function buildWelcome(config: GuildConfig, type: TicketType | undefined, ticket: Ticket) {
  const embed = baseEmbed(config, 'Tickets')
    .setTitle(`${type?.emoji ?? '🎫'} ${ticket.typeName} · #${ticketNumber(ticket.number)}`)
    .setDescription(
      (type?.welcome || 'Gracias por escribir. El staff te atenderá pronto.').slice(0, 2000) +
        `\n\n-# Abierto por <@${ticket.userId}> <t:${Math.floor(ticket.createdAt / 1000)}:R>`
    );
  if (ticket.albion) embed.addFields({ name: '🧙 Personaje', value: `**${ticket.albion.name}** · ${SERVER_LABEL[ticket.albion.server]}` });
  for (const a of ticket.answers.slice(0, 10)) embed.addFields({ name: a.question.slice(0, 256), value: a.answer.slice(0, 1024) });
  if (ticket.claimedBy) embed.addFields({ name: '🙋 Atiende', value: `<@${ticket.claimedBy}>`, inline: true });
  if (ticket.decision) {
    embed.addFields({ name: ticket.decision.result === 'accepted' ? '✅ Aceptado' : '❌ Rechazado', value: `por <@${ticket.decision.by}>`, inline: true });
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`tk_claim:${ticket.id}`).setLabel('Atender').setEmoji('🙋').setStyle(ButtonStyle.Secondary).setDisabled(Boolean(ticket.claimedBy)),
    new ButtonBuilder().setCustomId(`tk_close:${ticket.id}`).setLabel('Cerrar').setEmoji('🔒').setStyle(ButtonStyle.Secondary)
  );
  if (type?.recruitment) {
    row.addComponents(
      new ButtonBuilder().setCustomId(`tk_accept:${ticket.id}`).setLabel('Aceptar').setEmoji('✅').setStyle(ButtonStyle.Success).setDisabled(Boolean(ticket.decision)),
      new ButtonBuilder().setCustomId(`tk_reject:${ticket.id}`).setLabel('Rechazar').setEmoji('❌').setStyle(ButtonStyle.Danger).setDisabled(Boolean(ticket.decision))
    );
  }
  return { embeds: [embed], components: [row] };
}

// ---------- Controles ----------

async function onClaim(interaction: ButtonInteraction, config: GuildConfig, ticketId: string) {
  const { ticket, type } = loadTicket(interaction, config, ticketId, 'staff');
  if (ticket.status !== 'open') throw new TicketError('El ticket está cerrado.');
  if (ticket.claimedBy) throw new TicketError(`Ya lo atiende <@${ticket.claimedBy}>.`);
  ticket.claimedBy = interaction.user.id;
  saveTicket(config.guildId, ticket);
  await interaction.update(buildWelcome(config, type, ticket));
  await interaction.followUp({ content: `🙋 <@${interaction.user.id}> atiende este ticket.`, allowedMentions: { parse: [] } });
}

async function showReasonModal(interaction: ButtonInteraction, config: GuildConfig, ticketId: string, kind: 'close' | 'reject') {
  const { ticket } = loadTicket(interaction, config, ticketId, kind === 'close' ? 'owner-or-staff' : 'staff');
  if (ticket.status !== 'open') throw new TicketError('El ticket ya está cerrado.');
  if (kind === 'reject' && ticket.decision) throw new TicketError('Este ticket ya tiene una decisión.');
  const modal = new ModalBuilder()
    .setCustomId(`${kind === 'close' ? 'tk_closeform' : 'tk_rejectform'}:${ticket.id}`)
    .setTitle(kind === 'close' ? 'Cerrar ticket' : 'Rechazar aspirante')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Motivo (opcional)')
        .setTextInputComponent(new TextInputBuilder().setCustomId('reason').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500))
    );
  await interaction.showModal(modal);
}

async function onCloseForm(interaction: ModalSubmitInteraction, config: GuildConfig, ticketId: string) {
  const { ticket } = loadTicket(interaction, config, ticketId, 'owner-or-staff');
  const reason = cleanUserText(interaction.fields.getTextInputValue('reason') || '', 500);
  await interaction.deferReply();
  await closeTicket(interaction, config, ticket, reason);
}

/** Cierra el ticket: transcripción al registro, aviso al aspirante y canal sin acceso para él. */
async function closeTicket(interaction: ModalSubmitInteraction | ChatInputCommandInteraction, config: GuildConfig, ticket: Ticket, reason: string) {
  if (ticket.status !== 'open') throw new TicketError('El ticket ya está cerrado.');
  const channel = await ticketChannel(interaction.client, ticket);
  ticket.status = 'closed';
  ticket.closedAt = Date.now();
  ticket.closedBy = interaction.user.id;
  ticket.closeReason = reason || undefined;
  saveTicket(config.guildId, ticket);

  if (channel) {
    await logEvent(interaction.client, config, ticket, 'close', channel);
    if (channel.isThread()) {
      await channel.members.remove(ticket.userId).catch(() => null);
    } else {
      await (channel as TextChannel).permissionOverwrites.edit(ticket.userId, { ViewChannel: false }).catch(() => null);
      void channel.setName(`cerrado-${ticketNumber(ticket.number)}`).catch(() => null);
    }
  }
  if (ticketSettings(config).dmUser) {
    const embed = baseEmbed(config, 'Tickets')
      .setColor(UI_COLORS.muted)
      .setTitle(`🔒 Tu ticket #${ticketNumber(ticket.number)} se ha cerrado`)
      .setDescription(`${ticket.typeName} en **${interaction.guild?.name ?? 'el servidor'}**${reason ? `\n\n**Motivo:** ${reason}` : ''}`);
    await interaction.client.users.send(ticket.userId, { embeds: [embed] }).catch(() => null);
  }

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(UI_COLORS.muted)
        .setDescription(`🔒 Ticket cerrado por <@${interaction.user.id}>${reason ? `\n**Motivo:** ${reason}` : ''}`),
    ],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`tk_reopen:${ticket.id}`).setLabel('Reabrir').setEmoji('🔓').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`tk_delete:${ticket.id}`).setLabel('Borrar').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
      ),
    ],
    allowedMentions: { parse: [] },
  });
  // El hilo se bloquea al final: después ya solo el staff puede escribir en él.
  if (channel?.isThread()) await channel.setLocked(true).catch(() => null);
}

async function onReopen(interaction: ButtonInteraction, config: GuildConfig, ticketId: string) {
  const { ticket } = loadTicket(interaction, config, ticketId, 'staff');
  if (ticket.status === 'open') throw new TicketError('El ticket ya está abierto.');
  const channel = await ticketChannel(interaction.client, ticket);
  if (!channel) throw new TicketError('El canal del ticket ya no existe.');
  if (channel.isThread()) {
    await channel.setLocked(false);
    await channel.members.add(ticket.userId).catch(() => null);
  } else {
    await (channel as TextChannel).permissionOverwrites.edit(ticket.userId, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true, EmbedLinks: true });
    const slug = channel.name.replace(/^cerrado-/, 'ticket-');
    void channel.setName(slug).catch(() => null);
  }
  ticket.status = 'open';
  ticket.closedAt = undefined;
  ticket.closedBy = undefined;
  ticket.closeReason = undefined;
  saveTicket(config.guildId, ticket);
  await interaction.update({ components: [] });
  await interaction.followUp({ content: `🔓 <@${interaction.user.id}> reabrió el ticket. <@${ticket.userId}>`, allowedMentions: { users: [ticket.userId] } });
}

async function onDelete(interaction: ButtonInteraction, config: GuildConfig, ticketId: string) {
  const { ticket } = loadTicket(interaction, config, ticketId, 'staff');
  if (ticket.status === 'open') throw new TicketError('Cierra el ticket antes de borrarlo.');
  const channel = await ticketChannel(interaction.client, ticket);
  await interaction.update({ content: '🗑️ Borrando el ticket en 5 segundos…', components: [] });
  deleteTicket(config.guildId, ticket.id);
  setTimeout(() => {
    void channel?.delete(`Ticket borrado por ${interaction.user.tag}`).catch((err) => console.warn(`[${config.guildId}] No se pudo borrar el ticket:`, (err as Error).message));
  }, 5_000);
}

async function onAccept(interaction: ButtonInteraction, config: GuildConfig, ticketId: string) {
  const { ticket, type } = loadTicket(interaction, config, ticketId, 'staff');
  if (!type?.recruitment) throw new TicketError('Este ticket no es de reclutamiento.');
  if (ticket.status !== 'open') throw new TicketError('El ticket está cerrado.');
  if (ticket.decision) throw new TicketError('Este ticket ya tiene una decisión.');
  await interaction.deferUpdate();

  const problems: string[] = [];
  const member: GuildMember | null = interaction.guild ? await interaction.guild.members.fetch(ticket.userId).catch(() => null) : null;
  if (!member) {
    problems.push('El aspirante ya no está en el servidor: no le di roles.');
  } else {
    const add = type.acceptRoleIds.filter((id) => interaction.guild!.roles.cache.has(id));
    const remove = type.removeRoleIds.filter((id) => member.roles.cache.has(id));
    if (add.length) await member.roles.add(add, `Aceptado en el ticket #${ticketNumber(ticket.number)}`).catch(() => problems.push('No pude dar los roles (revisa que mi rol esté por encima).'));
    if (remove.length) await member.roles.remove(remove, `Aceptado en el ticket #${ticketNumber(ticket.number)}`).catch(() => problems.push('No pude quitar los roles.'));
    if (type.setNickname && ticket.albion?.name) {
      await member.setNickname(ticket.albion.name, 'Nombre del personaje de Albion').catch(() => problems.push('No pude cambiar el apodo (el dueño del servidor o roles por encima del mío no se pueden cambiar).'));
    }
  }
  ticket.decision = { result: 'accepted', by: interaction.user.id, at: Date.now() };
  saveTicket(config.guildId, ticket);
  await interaction.editReply(buildWelcome(config, type, ticket));
  await interaction.followUp({
    embeds: [
      new EmbedBuilder()
        .setColor(UI_COLORS.success)
        .setDescription(`✅ <@${ticket.userId}> ha sido **aceptado** por <@${interaction.user.id}>. ¡Bienvenido!${problems.length ? `\n\n${problems.map((p) => `⚠️ ${p}`).join('\n')}` : ''}`),
    ],
    allowedMentions: { users: [ticket.userId] },
    content: `<@${ticket.userId}>`,
  });
  if (ticketSettings(config).dmUser) {
    await interaction.client.users
      .send(ticket.userId, { embeds: [baseEmbed(config, 'Reclutamiento').setColor(UI_COLORS.success).setTitle('✅ ¡Has sido aceptado!').setDescription(`Tu solicitud en **${interaction.guild?.name}** fue aceptada.`)] })
      .catch(() => null);
  }
}

async function onRejectForm(interaction: ModalSubmitInteraction, config: GuildConfig, ticketId: string) {
  const { ticket, type } = loadTicket(interaction, config, ticketId, 'staff');
  if (ticket.decision) throw new TicketError('Este ticket ya tiene una decisión.');
  const reason = cleanUserText(interaction.fields.getTextInputValue('reason') || '', 500);
  ticket.decision = { result: 'rejected', by: interaction.user.id, at: Date.now() };
  saveTicket(config.guildId, ticket);
  if (interaction.isFromMessage()) await interaction.update(buildWelcome(config, type, ticket));
  else await interaction.deferReply();
  await interaction.followUp({
    embeds: [new EmbedBuilder().setColor(UI_COLORS.danger).setDescription(`❌ Solicitud **rechazada** por <@${interaction.user.id}>.${reason ? `\n**Motivo:** ${reason}` : ''}`)],
    allowedMentions: { parse: [] },
  });
  if (ticketSettings(config).dmUser) {
    await interaction.client.users
      .send(ticket.userId, {
        embeds: [
          baseEmbed(config, 'Reclutamiento')
            .setColor(UI_COLORS.danger)
            .setTitle('Solicitud rechazada')
            .setDescription(`Tu solicitud en **${interaction.guild?.name}** no fue aceptada.${reason ? `\n\n**Motivo:** ${reason}` : ''}`),
        ],
      })
      .catch(() => null);
  }
}

// ---------- Ficha de Albion en el ticket ----------

function statsButtons(ticket: Ticket) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`tk_refresh:${ticket.id}`).setLabel('Actualizar').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`tk_char:${ticket.id}`).setLabel('Cambiar personaje').setEmoji('✏️').setStyle(ButtonStyle.Secondary)
  );
}

function statsErrorPayload(ticket: Ticket, err: unknown) {
  const text = err instanceof AlbionError ? err.message : 'No pude consultar la API de Albion.';
  if (!(err instanceof AlbionError)) void reportError('Ficha de Albion', err);
  return { content: `⚠️ ${text}`, embeds: [], components: [statsButtons(ticket)] };
}

/** Ficha del personaje del ticket, o un menú si hay varios con nombre parecido. */
async function recruitStatsPayload(config: GuildConfig, ticket: Ticket, fresh = false) {
  const a = ticket.albion!;
  let playerId = a.playerId;
  if (!playerId) {
    const matches = await searchPlayers(a.server, a.name);
    const exact = exactMatch(matches, a.name);
    if (!exact) {
      if (matches.length === 0) {
        return { content: `🔎 No encontré a **${a.name}** en ${SERVER_LABEL[a.server]}. Revisa el nombre o el servidor.`, embeds: [], components: [statsButtons(ticket)] };
      }
      return { content: `🔎 No hay nadie llamado exactamente **${a.name}** en ${SERVER_LABEL[a.server]}. ¿Es alguno de estos?`, embeds: [], components: [pickRow(`tk_pick:${ticket.id}`, matches), statsButtons(ticket)] };
    }
    playerId = exact.id;
    a.playerId = playerId;
    saveTicket(config.guildId, ticket);
  }
  const profile = await getPlayerProfile(a.server, playerId, fresh);
  if (profile.name !== a.name) {
    a.name = profile.name;
    saveTicket(config.guildId, ticket);
  }
  return { content: '', embeds: [buildProfileEmbed(config, profile)], components: [statsButtons(ticket)] };
}

function pickRow(customId: string, matches: PlayerMatch[]) {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder('Elige el personaje')
      .addOptions(
        matches.slice(0, 25).map((m) => ({
          label: m.name,
          value: m.id,
          description: `${m.guildName || 'Sin gremio'} · ${shortNumber(m.killFame)} fama PvP`.slice(0, 100),
        }))
      )
  );
}

async function onPick(interaction: StringSelectMenuInteraction, config: GuildConfig, ticketId: string) {
  const { ticket } = loadTicket(interaction, config, ticketId, 'owner-or-staff');
  if (!ticket.albion) throw new TicketError('Este ticket no tiene personaje.');
  await interaction.deferUpdate();
  ticket.albion.playerId = interaction.values[0];
  saveTicket(config.guildId, ticket);
  await interaction.editReply(await recruitStatsPayload(config, ticket).catch((err) => statsErrorPayload(ticket, err)));
}

async function onRefresh(interaction: ButtonInteraction, config: GuildConfig, ticketId: string) {
  const { ticket } = loadTicket(interaction, config, ticketId, 'owner-or-staff');
  if (!ticket.albion) throw new TicketError('Este ticket no tiene personaje.');
  const wait = takeCooldown(`tkrefresh:${ticket.id}`, 2 * 60_000);
  if (wait) throw new TicketError(`La ficha se actualizó hace poco. Prueba en ${wait} s.`);
  await interaction.deferUpdate();
  await interaction.editReply(await recruitStatsPayload(config, ticket, true).catch((err) => statsErrorPayload(ticket, err)));
}

async function showCharacterModal(interaction: ButtonInteraction, config: GuildConfig, ticketId: string) {
  const { ticket } = loadTicket(interaction, config, ticketId, 'owner-or-staff');
  const current = ticket.albion?.server ?? (ticketSettings(config).albionServer === 'ask' ? 'americas' : (ticketSettings(config).albionServer as AlbionServer));
  const modal = new ModalBuilder()
    .setCustomId(`tk_charform:${ticket.id}`)
    .setTitle('Personaje de Albion')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Nombre del personaje')
        .setTextInputComponent(
          new TextInputBuilder().setCustomId('char').setStyle(TextInputStyle.Short).setMinLength(3).setMaxLength(16).setRequired(true).setValue(ticket.albion?.name ?? '')
        ),
      new LabelBuilder()
        .setLabel('Servidor')
        .setStringSelectMenuComponent(
          new StringSelectMenuBuilder()
            .setCustomId('server')
            .setRequired(true)
            .addOptions(ALBION_SERVERS.map((s) => ({ label: SERVER_LABEL[s], value: s, default: s === current })))
        )
    );
  await interaction.showModal(modal);
}

async function onCharacterForm(interaction: ModalSubmitInteraction, config: GuildConfig, ticketId: string) {
  const { ticket } = loadTicket(interaction, config, ticketId, 'owner-or-staff');
  const name = interaction.fields.getTextInputValue('char').trim();
  const server = interaction.fields.getStringSelectValues('server')[0] as AlbionServer;
  if (!ALBION_NAME_RE.test(name)) throw new TicketError('El nombre del personaje tiene de 3 a 16 letras o números, sin espacios.');
  if (!ALBION_SERVERS.includes(server)) throw new TicketError('Servidor de Albion no válido.');
  ticket.albion = { server, name };
  saveTicket(config.guildId, ticket);
  const payload = async () => recruitStatsPayload(config, ticket).catch((err) => statsErrorPayload(ticket, err));
  if (interaction.isFromMessage()) {
    await interaction.deferUpdate();
    await interaction.editReply(await payload());
  } else {
    await interaction.deferReply();
    await interaction.editReply(await payload());
  }
}

// ---------- Ficha ----------

const MONTH_FMT = new Intl.DateTimeFormat('es-ES', { month: 'short', year: 'numeric', timeZone: 'UTC' });

/** Embed con la ficha del jugador, con los colores y la marca del servidor. */
export function buildProfileEmbed(config: GuildConfig, p: PlayerProfile): EmbedBuilder {
  const limits = getLimits(config);
  const esc = (s: string) => escapeMarkdown(s);
  const guildLine = p.guild
    ? `🛡️ **${esc(p.guild.name)}**${p.guild.allianceTag ? ` · [${esc(p.guild.allianceTag)}]` : ''}${p.guild.allianceName ? ` ${esc(p.guild.allianceName)}` : ''}${p.guild.members ? ` · ${p.guild.members} miembros` : ''}`
    : '🛡️ Sin gremio';
  const ratio = p.pvp.ratio.toLocaleString('es-ES', { maximumFractionDigits: 2 });

  const zones = (pairs: Array<[string, number]>) =>
    pairs
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} **${shortNumber(v)}**`)
      .join('\n');

  const embed = baseEmbed(config, 'Ficha de Albion')
    .setTitle(`⚔️ ${p.name} · ${SERVER_LABEL[p.server]}`)
    .setDescription(guildLine)
    .addFields(
      { name: '⚔️ PvP', value: `Kills **${shortNumber(p.pvp.killFame)}**\nMuertes **${shortNumber(p.pvp.deathFame)}**\nRatio **${ratio}**`, inline: true },
      {
        name: `🐉 PvE · ${shortNumber(p.pve.total)}`,
        value:
          zones([
            ['Avalon', p.pve.avalon],
            ['Outlands', p.pve.outlands],
            ['Royal', p.pve.royal],
            ['Hellgate', p.pve.hellgate],
            ['Corrupted', p.pve.corrupted],
            ['Mists', p.pve.mists],
          ]) || '-# Sin fama PvE',
        inline: true,
      },
      {
        name: `⛏️ Recolección · ${shortNumber(p.gathering.total)}`,
        value:
          zones([
            ['Fibra', p.gathering.fiber],
            ['Piel', p.gathering.hide],
            ['Mineral', p.gathering.ore],
            ['Piedra', p.gathering.rock],
            ['Madera', p.gathering.wood],
          ]) || '-# Sin recolección',
        inline: true,
      }
    );

  const others = zones([
    ['Crafteo', p.crafting],
    ['Pesca', p.fishing],
    ['Granja', p.farming],
    ['Crystal League', p.crystalLeague],
  ]).replace(/\n/g, ' · ');
  if (others) embed.addFields({ name: '🔨 Otros', value: others });

  if (limits.albionGuildHistory) {
    const lines = p.pastGuilds.slice(0, 6).map((g) => {
      const from = MONTH_FMT.format(g.firstSeen);
      const to = MONTH_FMT.format(g.lastSeen);
      return `**${esc(g.name)}**${g.allianceName ? ` [${esc(g.allianceName)}]` : ''} · ${from === to ? from : `${from} – ${to}`}`;
    });
    embed.addFields({
      name: '📜 Gremios anteriores',
      value: lines.length ? `${lines.join('\n')}\n-# Según sus últimos kills y muertes y las consultas de ${botBrandName()}.` : '-# No aparece en otros gremios en sus kills y muertes recientes.',
    });
  } else {
    embed.addFields({ name: '📜 Gremios anteriores', value: '-# 💎 Con Premium la ficha muestra en qué gremios estuvo antes.' });
  }

  embed.addFields({ name: '🔗 Perfiles', value: p.links.map((l) => `[${l.label}](${l.url})`).join(' · ') });
  embed.setFooter({ text: `Datos de la API pública de Albion · ${botBrandName()}` });
  if (p.updatedAt) embed.setTimestamp(p.updatedAt);
  return embed;
}

// ---------- Registro y transcripción ----------

async function logEvent(client: Client, config: GuildConfig, ticket: Ticket, event: 'open' | 'close', channel?: TicketChannel) {
  const logId = ticketSettings(config).logChannelId;
  if (!logId) return;
  try {
    const log = await client.channels.fetch(logId).catch(() => null);
    if (!log || log.type !== ChannelType.GuildText) return;
    const embed = baseEmbed(config, 'Registro de tickets')
      .setColor(event === 'open' ? UI_COLORS.success : UI_COLORS.muted)
      .setTitle(`${event === 'open' ? '📬 Abierto' : '🔒 Cerrado'} · ${ticket.typeName} #${ticketNumber(ticket.number)}`)
      .addFields(
        { name: 'Autor', value: `<@${ticket.userId}>`, inline: true },
        { name: 'Canal', value: `<#${ticket.channelId}>`, inline: true }
      );
    if (ticket.albion) embed.addFields({ name: 'Personaje', value: `${ticket.albion.name} · ${SERVER_LABEL[ticket.albion.server]}`, inline: true });
    const files: AttachmentBuilder[] = [];
    if (event === 'close') {
      if (ticket.claimedBy) embed.addFields({ name: 'Atendió', value: `<@${ticket.claimedBy}>`, inline: true });
      embed.addFields({ name: 'Cerró', value: `<@${ticket.closedBy}>`, inline: true });
      if (ticket.decision) embed.addFields({ name: 'Decisión', value: ticket.decision.result === 'accepted' ? '✅ Aceptado' : '❌ Rechazado', inline: true });
      if (ticket.closeReason) embed.addFields({ name: 'Motivo', value: ticket.closeReason.slice(0, 1024) });
      if (channel) {
        const html = getLimits(config).htmlTranscripts;
        const messages = await fetchAllMessages(channel);
        const body = html ? transcriptHtml(config, ticket, messages) : transcriptText(ticket, messages);
        files.push(new AttachmentBuilder(Buffer.from(body, 'utf-8'), { name: `ticket-${ticketNumber(ticket.number)}.${html ? 'html' : 'txt'}` }));
        embed.addFields({ name: 'Mensajes', value: String(messages.length), inline: true });
      }
    }
    await log.send({ embeds: [embed], files, allowedMentions: { parse: [] } });
  } catch (err) {
    console.warn(`[${config.guildId}] Registro de tickets:`, (err as Error).message);
  }
}

// Hasta 2000 mensajes, del más antiguo al más nuevo.
async function fetchAllMessages(channel: TicketChannel): Promise<Message[]> {
  const out: Message[] = [];
  let before: string | undefined;
  for (let i = 0; i < 20; i++) {
    const batch = await channel.messages.fetch({ limit: 100, before }).catch(() => null);
    if (!batch || batch.size === 0) break;
    out.push(...batch.values());
    before = batch.last()?.id;
    if (batch.size < 100) break;
  }
  return out.reverse();
}

function messageText(m: Message): string {
  const parts = [m.cleanContent];
  for (const e of m.embeds) parts.push([e.title, e.description, ...e.fields.map((f) => `${f.name}: ${f.value}`)].filter(Boolean).join('\n'));
  for (const a of m.attachments.values()) parts.push(`[Adjunto] ${a.name}: ${a.url}`);
  return parts.filter(Boolean).join('\n');
}

function transcriptText(ticket: Ticket, messages: Message[]): string {
  const head = [
    `Ticket #${ticketNumber(ticket.number)} · ${ticket.typeName}`,
    `Autor: ${ticket.userName} (${ticket.userId})`,
    `Abierto: ${new Date(ticket.createdAt).toISOString()}`,
    `Cerrado: ${ticket.closedAt ? new Date(ticket.closedAt).toISOString() : '-'}`,
    '',
  ];
  const lines = messages.map((m) => `[${m.createdAt.toISOString().replace('T', ' ').slice(0, 16)}] ${m.author.tag}: ${messageText(m)}`);
  return [...head, ...lines].join('\n');
}

const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function transcriptHtml(config: GuildConfig, ticket: Ticket, messages: Message[]): string {
  const gold = `#${config.colors.embedHex.toString(16).padStart(6, '0')}`;
  const rows = messages
    .map((m) => {
      const avatar = escHtml(m.author.displayAvatarURL({ size: 64 }));
      const text = escHtml(messageText(m)).replace(/\n/g, '<br>');
      return `<div class="msg"><img src="${avatar}" alt=""><div><b>${escHtml(m.member?.displayName ?? m.author.username)}</b><span>${escHtml(m.createdAt.toISOString().replace('T', ' ').slice(0, 16))} UTC</span><p>${text || '<i>(sin texto)</i>'}</p></div></div>`;
    })
    .join('\n');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ticket #${ticketNumber(ticket.number)}</title>
<style>body{margin:0;background:#0f0f13;color:#ddd;font:15px/1.45 system-ui,sans-serif}header{padding:20px 24px;border-bottom:2px solid ${gold};background:#16161c}h1{margin:0;color:${gold};font-size:20px}header p{margin:4px 0 0;color:#999}.msg{display:flex;gap:12px;padding:10px 24px}.msg:hover{background:#16161c}.msg img{width:40px;height:40px;border-radius:50%}.msg b{color:#fff;margin-right:8px}.msg span{color:#777;font-size:12px}.msg p{margin:2px 0 0;white-space:normal;word-break:break-word}</style></head>
<body><header><h1>${escHtml(ticket.typeName)} · #${ticketNumber(ticket.number)}</h1><p>${escHtml(ticket.userName)} · ${messages.length} mensajes · ${escHtml(botBrandName())}</p></header>
${rows}
</body></html>`;
}

// ---------- Comandos ----------

/** /ticket añadir|quitar|renombrar|cerrar, dentro del canal o hilo de un ticket. */
export async function handleTicketCommand(interaction: ChatInputCommandInteraction, config: GuildConfig) {
  try {
    const sub = interaction.options.getSubcommand();
    const ticket = getTicket(config.guildId, interaction.channelId);
    if (!ticket) throw new TicketError('Usa este comando dentro del canal de un ticket.');
    loadTicket(interaction, config, ticket.id, sub === 'cerrar' ? 'owner-or-staff' : 'staff');
    const channel = await ticketChannel(interaction.client, ticket);
    if (!channel) throw new TicketError('No encuentro el canal del ticket.');

    if (sub === 'cerrar') {
      await interaction.deferReply();
      await closeTicket(interaction, config, ticket, cleanUserText(interaction.options.getString('motivo') ?? '', 500));
      return;
    }
    if (sub === 'renombrar') {
      const name = interaction.options.getString('nombre', true).toLowerCase().replace(/[^a-z0-9ñ-]+/g, '-').slice(0, 90);
      await channel.setName(name || `ticket-${ticketNumber(ticket.number)}`);
      await interaction.reply({ content: `✏️ Ticket renombrado a **${name}**.`, flags: MessageFlags.Ephemeral });
      return;
    }
    const user = interaction.options.getUser('usuario', true);
    if (user.bot) throw new TicketError('No se puede añadir un bot.');
    if (sub === 'añadir') {
      if (channel.isThread()) await channel.members.add(user.id);
      else await (channel as TextChannel).permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true, EmbedLinks: true });
      await interaction.reply({ content: `➕ <@${user.id}> añadido al ticket.`, allowedMentions: { users: [user.id] } });
      return;
    }
    if (sub === 'quitar') {
      if (user.id === ticket.userId) throw new TicketError('No puedes quitar al autor del ticket; ciérralo.');
      if (channel.isThread()) await channel.members.remove(user.id);
      else await (channel as TextChannel).permissionOverwrites.delete(user.id);
      await interaction.reply({ content: `➖ <@${user.id}> quitado del ticket.`, allowedMentions: { parse: [] } });
      return;
    }
  } catch (err) {
    if (err instanceof TicketError) return replyError(interaction, err.message);
    throw err;
  }
}

/** /stats personaje [servidor]: ficha de cualquier jugador, fuera de los tickets. */
export async function handleStatsCommand(interaction: ChatInputCommandInteraction, config: GuildConfig) {
  const name = interaction.options.getString('personaje', true).trim();
  const def = ticketSettings(config).albionServer;
  const server = (interaction.options.getString('servidor') as AlbionServer | null) ?? (def === 'ask' ? 'americas' : def);
  if (!ALBION_NAME_RE.test(name)) return replyError(interaction, 'Los nombres de Albion tienen de 3 a 16 letras o números, sin espacios.');
  const wait = takeCooldown(`stats:${interaction.user.id}`, 10_000);
  if (wait) return replyError(interaction, `Espera ${wait} s antes de otra consulta.`);

  await interaction.deferReply();
  try {
    const matches = await searchPlayers(server, name);
    const exact = exactMatch(matches, name);
    if (exact) {
      await interaction.editReply({ embeds: [buildProfileEmbed(config, await getPlayerProfile(server, exact.id))] });
    } else if (matches.length > 0) {
      await interaction.editReply({
        content: `🔎 No hay nadie llamado exactamente **${name}** en ${SERVER_LABEL[server]}. ¿Es alguno de estos?`,
        components: [pickRow(`tk_stats:${server}:${interaction.user.id}`, matches)],
      });
    } else {
      await interaction.editReply({ content: `🔎 No encontré a **${name}** en ${SERVER_LABEL[server]}.` });
    }
  } catch (err) {
    if (!(err instanceof AlbionError)) void reportError('/stats', err);
    await interaction.editReply({ content: `⚠️ ${err instanceof AlbionError ? err.message : 'No pude consultar la API de Albion.'}` });
  }
}

async function onStatsPick(interaction: StringSelectMenuInteraction, config: GuildConfig, server: AlbionServer, userId: string) {
  if (interaction.user.id !== userId) throw new TicketError('Solo quien hizo la consulta puede elegir.');
  if (!ALBION_SERVERS.includes(server)) throw new TicketError('Servidor no válido.');
  await interaction.deferUpdate();
  try {
    const profile = await getPlayerProfile(server, interaction.values[0]);
    await interaction.editReply({ content: '', embeds: [buildProfileEmbed(config, profile)], components: [] });
  } catch (err) {
    await interaction.editReply({ content: `⚠️ ${err instanceof AlbionError ? err.message : 'No pude consultar la API de Albion.'}`, components: [] });
  }
}
