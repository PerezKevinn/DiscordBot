/**
 * Reparto de loot en Discord: el editor tras el GG (botón del Mando o /loot repartir), la
 * importación del log de AO Loot Logger, el mensaje público con el reparto y los pagos, y los
 * comandos /loot pendientes, /loot historial y /loot guia.
 *
 * El reparto es siempre a partes iguales sobre el total de plata (ver utils/loot.ts). El editor es
 * efímero y trabaja sobre un borrador en memoria; al publicar se guarda y se publica (o se edita) un
 * mensaje en el canal del ping.
 */
import {
  ActionRowBuilder,
  AttachmentBuilder,
  AutocompleteInteraction,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
  escapeMarkdown,
  FileUploadBuilder,
  Guild,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  UserSelectMenuInteraction,
} from 'discord.js';
import { ActivePing, GuildConfig } from '../types/ping';
import { ConfigManager } from '../utils/configManager';
import {
  amountFor,
  computeSplit,
  formatPct,
  formatSilver,
  getSplit,
  isFullyPaid,
  listSplits,
  LootError,
  LootSplit,
  lootSettings,
  MAX_LOOT_MEMBERS,
  newSplitFor,
  parsePct,
  parseSilver,
  pendingFor,
  saveSplit,
  setPaid,
  shortSilver,
  FREE_HISTORY_DAYS,
} from '../utils/loot';
import { MAX_LOG_BYTES, normName, parseLootLog, partyGuild, summarizeLog } from '../utils/lootLog';
import { getLimits, PREMIUM_UPSELL } from '../utils/plans';
import { baseEmbed, fitEmbed } from '../utils/ui';

const LOOT_LOGGER_URL = 'https://github.com/matheussampaio/ao-loot-logger/releases/latest';
const NPCAP_URL = 'https://npcap.com/#download';
const MIN_MS = 60 * 1000;

// ---------- Borradores ----------

interface Draft {
  split: LootSplit;
  /** Jugadores del log que son de Discord pero no están en el reparto. */
  suggestions: Array<{ userId: string; name: string }>;
  at: number;
}

// Borradores del editor por servidor, reparto y usuario. Caducan a los 30 min.
const DRAFT_TTL_MS = 30 * MIN_MS;
const drafts = new Map<string, Draft>();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of drafts) if (now - v.at > DRAFT_TTL_MS) drafts.delete(k);
}, 5 * MIN_MS).unref();

const draftKey = (guildId: string, id: string, userId: string) => `${guildId}:${id}:${userId}`;

// ---------- Permisos ----------

type PermInteraction = {
  user: { id: string };
  memberPermissions: Readonly<{ has(p: bigint): boolean }> | null;
  member: { roles: string[] | { cache: { has(id: string): boolean } } } | null;
};

/** Puede gestionar el reparto: el Caller, el rol de tesorería, o quien tenga Gestionar servidor o canales. */
function canManageLoot(interaction: PermInteraction, config: GuildConfig, callerId: string): boolean {
  if (interaction.user.id === callerId) return true;
  if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) || interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) return true;
  const roleId = lootSettings(config).managerRoleId;
  const roles = interaction.member?.roles;
  if (!roleId || !roles) return false;
  return Array.isArray(roles) ? roles.includes(roleId) : roles.cache.has(roleId);
}

/** Un reparto ya pagado entero solo lo cambia quien tenga Gestionar servidor. */
function isLockedFor(interaction: PermInteraction, split: LootSplit): boolean {
  return isFullyPaid(split) && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
}

/** Botón "Repartir loot" para un ping terminado con GG, o null si el loot está desactivado. */
export function lootButton(config: GuildConfig, ping: ActivePing): ButtonBuilder | null {
  if (!lootSettings(config).enabled || ping.status !== 'CLOSED') return null;
  const done = Boolean(getSplit(config.guildId, ping.id));
  return new ButtonBuilder()
    .setCustomId(`loot_open:${ping.id}`)
    .setLabel(done ? 'Editar loot' : 'Repartir loot')
    .setEmoji('💰')
    .setStyle(done ? ButtonStyle.Secondary : ButtonStyle.Success);
}

// ---------- Texto del reparto ----------

const userRef = (id: string | undefined) => (id ? `<@${id}>` : '_nadie_');

/** Líneas del cálculo: total, descuentos y lo que toca a cada uno. */
function breakdownText(split: LootSplit): string {
  if (split.total <= 0) return '💵 **Total:** sin poner todavía. Pulsa **Plata y descuentos** y escribe la plata que se sacó al vender.';
  const b = computeSplit(split, split.members.length);
  const lines = [`💵 Total vendido: **${formatSilver(b.total)}**`];
  if (b.repairs > 0) lines.push(`🔧 − Reparaciones: ${formatSilver(b.repairs)} → ${userRef(split.repairsUserId)}`);
  if (split.guildTaxPct > 0) lines.push(`🏰 − Recargo del gremio (${formatPct(split.guildTaxPct)} %): ${formatSilver(b.guildTax)}`);
  if (split.sellerPct > 0) lines.push(`🤝 − Vendedor (${formatPct(split.sellerPct)} %): ${formatSilver(b.sellerFee)} → ${userRef(split.sellerId)}`);
  lines.push(`🟰 A repartir: **${formatSilver(b.net)}** entre **${b.players}** ${b.players === 1 ? 'jugador' : 'jugadores'}`);
  lines.push(`💰 **${formatSilver(b.perPlayer)}** cada uno`);
  if (b.remainder > 0) lines.push(`-# Sobrante del redondeo (${formatSilver(b.remainder)}) al gremio · el gremio recibe ${formatSilver(b.guildTotal)} en total`);
  return lines.join('\n');
}

/** Reparte una lista de líneas en campos de embed de hasta 1024 caracteres. */
function addListFields(embed: EmbedBuilder, title: string, lines: string[], maxFields = 4) {
  let chunk = '';
  let n = 0;
  for (let i = 0; i < lines.length; i++) {
    if (chunk.length + lines[i].length + 1 > 1000) {
      embed.addFields({ name: n === 0 ? title : '​', value: chunk });
      n++;
      chunk = '';
      if (n >= maxFields) {
        embed.addFields({ name: '​', value: `-# …y ${lines.length - i} más` });
        return;
      }
    }
    chunk += (chunk ? '\n' : '') + lines[i];
  }
  if (chunk) embed.addFields({ name: n === 0 ? title : '​', value: chunk });
}

/** Quién tiene el loot según el log, una línea por jugador. */
function looterLines(split: LootSplit): string[] {
  if (!split.log) return [];
  const inSplit = new Set(split.members.map((m) => m.userId));
  return split.log.looters.map((l) => {
    const who = l.userId ? `<@${l.userId}>` : '';
    const warn = l.userId && !inSplit.has(l.userId) ? ' · ⚠️ no está en el reparto' : !l.userId ? ' · ❔ sin cuenta de Discord' : '';
    return `**${escapeMarkdown(l.name)}** ${who} — ${l.count} ${l.count === 1 ? 'ítem' : 'ítems'}${warn}`;
  });
}

function logNote(split: LootSplit): string {
  const log = split.log!;
  const parts = [`📄 ${escapeMarkdown(log.fileName)} · ${log.events} ${log.events === 1 ? 'ítem recogido' : 'recogidas'} por la party`];
  if (log.othersEvents) parts.push(`${log.othersEvents} de otros jugadores (no cuentan)`);
  if (log.outsideWindow) parts.push('⚠️ nada coincidía con el horario de la salida: usé el archivo entero');
  return `-# ${parts.join(' · ')}`;
}

/** Mensaje efímero del editor. */
function editorMessage(config: GuildConfig, draft: Draft, notice?: string) {
  const { split } = draft;
  const embed = baseEmbed(config, 'Reparto de loot')
    .setTitle(`💰 Loot · ${split.title}`.slice(0, 256))
    .setDescription(`${notice ? `${notice}\n\n` : ''}${breakdownText(split)}\n-# Todos reciben lo mismo. Vende: ${userRef(split.sellerId)}`.slice(0, 4000));

  const players = split.members.map((m, i) => `\`#${i + 1}\` ${escapeMarkdown(m.name)}${m.paid ? ' ✅' : ''}`);
  addListFields(embed, `👥 Jugadores (${split.members.length})`, players.length ? players : ['Nadie todavía. Añádelos con el menú de abajo.'], 3);
  if (split.log) {
    addListFields(embed, '📦 ¿Quién tiene el loot?', looterLines(split), 2);
    embed.addFields({ name: '​', value: logNote(split) });
  }

  const add = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId(`loot_add:${split.id}`)
      .setPlaceholder('➕ Añadir a alguien que fue y no se anotó')
      .setMinValues(1)
      .setMaxValues(10)
  );
  const tools = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`loot_money:${split.id}`).setLabel('Plata y descuentos').setEmoji('💵').setStyle(split.total > 0 ? ButtonStyle.Secondary : ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`loot_who:${split.id}`).setLabel('Vendedor').setEmoji('🤝').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`loot_rm:${split.id}`).setLabel('Quitar').setEmoji('➖').setStyle(ButtonStyle.Secondary).setDisabled(split.members.length === 0),
    new ButtonBuilder().setCustomId(`loot_log:${split.id}`).setLabel('Importar log').setEmoji('📄').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('loot_help').setLabel('Guía').setEmoji('❓').setStyle(ButtonStyle.Secondary)
  );
  const finish = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`loot_save:${split.id}`)
      .setLabel(split.messageId ? 'Guardar y actualizar' : 'Publicar reparto')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success)
      .setDisabled(split.total <= 0 || split.members.length === 0)
  );
  if (draft.suggestions.length) {
    finish.addComponents(
      new ButtonBuilder()
        .setCustomId(`loot_addlog:${split.id}`)
        .setLabel(`Añadir ${draft.suggestions.length} del log`)
        .setEmoji('📥')
        .setStyle(ButtonStyle.Primary)
    );
  }
  finish.addComponents(new ButtonBuilder().setCustomId(`loot_cancel:${split.id}`).setLabel('Cancelar').setStyle(ButtonStyle.Secondary));
  return { content: '', embeds: [fitEmbed(embed)], components: [add, tools, finish] };
}

/** Mensaje público del reparto, con los pagos. `withFiles` adjunta la lista completa del log. */
function publicMessage(config: GuildConfig, split: LootSplit, withFiles: boolean) {
  const b = computeSplit(split, split.members.length);
  const paid = split.members.filter((m) => m.paid).length;
  const done = isFullyPaid(split);
  const embed = baseEmbed(config, 'Reparto de loot')
    .setTitle(`💰 Loot · ${split.title}`.slice(0, 256))
    .setDescription(breakdownText(split))
    .setFooter({ text: `${done ? '✅ Pagado a todos' : `Pagados ${paid}/${split.members.length}`} · ${config.guildName || 'MassUp'}`.slice(0, 2048) })
    .setTimestamp(split.updatedAt ?? split.createdAt);
  const extra = (id: string) => {
    const tags: string[] = [];
    if (split.sellerId === id && b.sellerFee > 0) tags.push('vendedor');
    if (split.repairsUserId === id && b.repairs > 0) tags.push('reparaciones');
    return tags.length ? ` _(+${tags.join(' y ')})_` : '';
  };
  const players = split.members.map((m) => `${m.paid ? '✅' : '⏳'} <@${m.userId}> — **${formatSilver(amountFor(split, b, m.userId))}**${extra(m.userId)}`);
  addListFields(embed, `👥 Jugadores · ${paid}/${split.members.length} pagados`, players, 4);
  if (split.log?.looters.length) addListFields(embed, '📦 ¿Quién tiene el loot? (log)', looterLines(split), 1);
  embed.addFields({ name: '​', value: `-# Repartido por <@${split.updatedBy ?? split.createdBy}> · Caller <@${split.callerId}> · \`/loot pendientes\` para ver lo que te deben` });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`loot_pay:${split.id}`).setLabel('Marcar pagos').setEmoji('💸').setStyle(done ? ButtonStyle.Secondary : ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`loot_edit:${split.id}`).setLabel('Editar').setEmoji('✏️').setStyle(ButtonStyle.Secondary)
  );
  const msg: { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[]; files?: AttachmentBuilder[]; attachments?: [] } = {
    embeds: [fitEmbed(embed)],
    components: [row],
  };
  if (withFiles) {
    msg.attachments = [];
    msg.files = split.log?.looters.length ? [logAttachment(split)] : [];
  }
  return msg;
}

// Lista completa de lo que recogió cada uno, para que el vendedor sepa qué pedirle a quién.
function logAttachment(split: LootSplit): AttachmentBuilder {
  const lines = [`Loot de "${split.title}" (${new Date(split.at).toISOString().slice(0, 16).replace('T', ' ')} UTC)`, ''];
  for (const l of split.log!.looters) {
    lines.push(`${l.name} — ${l.count} ítems`);
    for (const it of l.items) lines.push(`  ${it.qty}× ${it.name}`);
    lines.push('');
  }
  return new AttachmentBuilder(Buffer.from(lines.join('\n'), 'utf-8'), { name: `loot-${split.id}.txt` });
}

/** Publica el reparto o edita el mensaje ya publicado. Devuelve el enlace al mensaje, o null. */
async function publishSplit(client: Client, config: GuildConfig, split: LootSplit, fallbackChannelId: string | null): Promise<string | null> {
  const body = publicMessage(config, split, true);
  if (split.messageId && split.messageChannelId) {
    const channel = await client.channels.fetch(split.messageChannelId).catch(() => null);
    if (channel?.isTextBased()) {
      const msg = await channel.messages.edit(split.messageId, body).catch(() => null);
      if (msg) return msg.url;
    }
  }
  for (const channelId of [split.channelId, fallbackChannelId]) {
    if (!channelId) continue;
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased() || !('send' in channel)) continue;
    const msg = await channel.send({ ...body, allowedMentions: { parse: [] } }).catch(() => null);
    if (!msg) continue;
    split.messageId = msg.id;
    split.messageChannelId = msg.channelId;
    saveSplit(config.guildId, split);
    return msg.url;
  }
  return null;
}

/** Actualiza el mensaje publicado de un reparto (p. ej. tras marcar pagos desde el panel). */
export async function refreshLootMessage(client: Client, config: GuildConfig, split: LootSplit) {
  if (!split.messageId || !split.messageChannelId) return;
  const channel = await client.channels.fetch(split.messageChannelId).catch(() => null);
  if (channel?.isTextBased()) await channel.messages.edit(split.messageId, publicMessage(config, split, false)).catch(() => null);
}

// ---------- Log ----------

/** Lee el log subido, lo resume para la salida y busca a cada jugador en Discord. */
async function importLog(guild: Guild, draft: Draft, fileName: string, text: string): Promise<string> {
  const { events, skipped } = parseLootLog(text);
  if (events.length === 0) {
    return '❌ No encontré ningún ítem en ese archivo. Tiene que ser el `loot-events-….txt` que crea AO Loot Logger.';
  }
  const { split } = draft;
  const ping = ConfigManager.getPing(guild.id, split.id);
  const start = split.startAt ?? (ping ? ping.startTimeUnix * 1000 : split.at - 6 * 60 * MIN_MS);
  const window = { from: Math.min(start, split.at) - 30 * MIN_MS, to: split.at + 60 * MIN_MS };

  // Primero, los que ya están en el reparto; luego, los de su mismo gremio.
  const known = new Map<string, string>();
  for (const m of split.members) known.set(normName(m.name), m.userId);
  const guildOf = new Map(events.map((e) => [normName(e.looter), e.looterGuild]));
  const ourGuild = partyGuild(events, (n) => known.has(normName(n)));
  const isParty = (n: string) => known.has(normName(n)) || Boolean(ourGuild && guildOf.get(normName(n)) === ourGuild);
  const summary = summarizeLog(events, fileName, window, isParty);

  // Busca en Discord a los que no están en el reparto (por apodo o nombre de usuario).
  let searches = 0;
  for (const l of summary.looters) {
    const key = normName(l.name);
    const already = known.get(key);
    if (already) {
      l.userId = already;
      continue;
    }
    if (searches++ >= 25 || !key) continue;
    const found = await guild.members.search({ query: l.name.slice(0, 32), limit: 10 }).catch(() => null);
    const cached = [...(found?.values() ?? []), ...guild.members.cache.values()];
    const match = cached.find((m) => !m.user.bot && [m.displayName, m.user.username, m.user.globalName ?? ''].some((n) => normName(n) === key));
    if (match) l.userId = match.id;
  }
  split.log = summary;
  const inSplit = new Set(split.members.map((m) => m.userId));
  draft.suggestions = summary.looters
    .filter((l) => l.userId && !inSplit.has(l.userId))
    .map((l) => ({ userId: l.userId!, name: guild.members.cache.get(l.userId!)?.displayName ?? l.name }));

  const parts = [`📄 Log importado: **${summary.looters.length}** jugadores de la party recogieron **${summary.events}** ítems.`];
  if (skipped) parts.push(`-# ${skipped} líneas no se entendieron y se saltaron.`);
  if (draft.suggestions.length) parts.push(`📥 ${draft.suggestions.length} lootearon y no están en el reparto: pulsa **Añadir ${draft.suggestions.length} del log** si fueron.`);
  return parts.join('\n');
}

// ---------- Guía ----------

/** Guía para instalar y usar AO Loot Logger, explicada para Callers. */
export function lootGuideEmbed(config: GuildConfig): EmbedBuilder {
  return baseEmbed(config, 'Reparto de loot')
    .setTitle('📄 Cómo registrar el loot con AO Loot Logger')
    .setDescription(
      [
        'AO Loot Logger es un programa **gratis y de código abierto** que anota lo que se recoge de las bolsas de loot. MassUp lee ese archivo y te dice **quién tiene qué** y **quién fue**. La plata se reparte igual: a partes iguales del total vendido.',
        '',
        `**1. Instala Npcap** (solo la primera vez): [descárgalo aquí](${NPCAP_URL}) y, al instalar, deja marcada la opción **"WinPcap API-compatible Mode"**.`,
        `**2. Descarga AO Loot Logger:** [última versión](${LOOT_LOGGER_URL}). Baja el **.zip de Windows** y descomprímelo en una carpeta (por ejemplo, en el Escritorio).`,
        '**3. Antes de salir:** abre `ao-loot-logger.cmd` y déjalo abierto mientras juegas. La ventana muestra dónde guarda el archivo.',
        '**4. Al terminar:** cierra la ventana (o pulsa **Ctrl+C**). El archivo se llama `loot-events-<fecha>.txt` y está en la misma carpeta. Si vas a hacer otra salida, pulsa **D** para empezar un archivo nuevo.',
        '**5. En Discord:** dale **GG** en el Mando → **💰 Repartir loot** → **📄 Importar log** y sube el `.txt`.',
      ].join('\n')
    )
    .addFields(
      {
        name: '💡 Tenlo en cuenta',
        value: [
          '• Basta con que lo use **una persona** de la party (el Caller o quien vaya a vender), cerca de donde se lootea.',
          '• **No funciona con VPN ni ExitLag**, ni jugando por GeForce Now.',
          '• Linux: instala `libpcap-dev` y baja la versión de Linux. En Mac no funciona.',
          '• Si no lo usas, no pasa nada: el reparto funciona igual escribiendo el total de plata.',
        ].join('\n'),
      },
      {
        name: '⚖️ ¿Está permitido?',
        value:
          'Solo **lee** el tráfico del juego; no lo modifica ni juega por ti, como el Albion Data Project o los medidores de daño. Sandbox Interactive no lo apoya oficialmente ni lo ha prohibido: úsalo bajo tu responsabilidad. MassUp nunca lo ejecuta; solo lee el archivo que subes.',
      }
    );
}

// ---------- Interacciones ----------

type LootInteraction = ButtonInteraction | UserSelectMenuInteraction | StringSelectMenuInteraction | ModalSubmitInteraction;

/** Atiende los botones, menús y formularios del reparto (customId loot_*). */
export async function handleLootInteraction(interaction: LootInteraction, config: GuildConfig) {
  const [action, id] = interaction.customId.split(':');
  const ephemeral = { flags: MessageFlags.Ephemeral } as const;

  if (action === 'loot_help') {
    await interaction.reply({ embeds: [lootGuideEmbed(config)], ...ephemeral });
    return;
  }
  if (!lootSettings(config).enabled) {
    await interaction.reply({ content: 'El reparto de loot está desactivado en este servidor (se activa en el panel).', ...ephemeral });
    return;
  }

  // Marcar pagos desde el mensaje público.
  if (action === 'loot_pay' || action === 'loot_paysel') return handlePayments(interaction, config, action, id);

  // Abrir el editor: desde el Mando (id de ping) o desde el mensaje público (id de reparto).
  if ((action === 'loot_open' || action === 'loot_edit') && interaction.isButton()) {
    await openEditor(interaction, config, id);
    return;
  }

  const key = draftKey(config.guildId, id, interaction.user.id);
  const draft = drafts.get(key);
  if (!draft) {
    const content = '⌛ Este editor caducó (30 min sin usarlo). Vuelve a abrirlo con `/loot repartir` o con el botón **Editar** del reparto.';
    if (interaction.isModalSubmit() && !interaction.isFromMessage()) await interaction.reply({ content, ...ephemeral });
    else if (interaction.isModalSubmit() || interaction.isMessageComponent()) await interaction.update({ content, embeds: [], components: [] });
    return;
  }
  draft.at = Date.now();
  const { split } = draft;
  const update = async (notice?: string) => {
    if (interaction.isModalSubmit() && !interaction.isFromMessage()) await interaction.reply({ ...editorMessage(config, draft, notice), ...ephemeral });
    else if (interaction.isModalSubmit() || interaction.isMessageComponent()) await interaction.update(editorMessage(config, draft, notice));
  };

  if (action === 'loot_cancel' && interaction.isButton()) {
    drafts.delete(key);
    await interaction.update({ content: 'Reparto cancelado. No se guardó nada.', embeds: [], components: [] });
    return;
  }

  if (action === 'loot_add' && interaction.isUserSelectMenu()) {
    for (const user of interaction.users.values()) {
      if (user.bot || split.members.some((m) => m.userId === user.id)) continue;
      if (split.members.length >= MAX_LOOT_MEMBERS) break;
      const member = interaction.guild?.members.cache.get(user.id);
      split.members.push({ userId: user.id, name: member?.displayName ?? user.globalName ?? user.username, paid: false });
    }
    draft.suggestions = draft.suggestions.filter((s) => !split.members.some((m) => m.userId === s.userId));
    await update();
    return;
  }

  if (action === 'loot_addlog' && interaction.isButton()) {
    for (const s of draft.suggestions) {
      if (split.members.length >= MAX_LOOT_MEMBERS) break;
      if (!split.members.some((m) => m.userId === s.userId)) split.members.push({ ...s, paid: false });
    }
    draft.suggestions = [];
    await update('📥 Añadí a los del log.');
    return;
  }

  if (action === 'loot_money' && interaction.isButton()) {
    const input = (cid: string, label: string, description: string, value: string, placeholder: string, required = false) =>
      new LabelBuilder()
        .setLabel(label)
        .setDescription(description)
        .setTextInputComponent(
          new TextInputBuilder().setCustomId(cid).setStyle(TextInputStyle.Short).setRequired(required).setMaxLength(20).setPlaceholder(placeholder).setValue(value)
        );
    const modal = new ModalBuilder()
      .setCustomId(`loot_mmoney:${split.id}`)
      .setTitle('Plata y descuentos')
      .addLabelComponents(
        input('total', 'Total de plata', 'Lo que se sacó al vender todo el loot. Ej: 12.500.000 o 12.5m', split.total ? formatSilver(split.total) : '', '12.5m', true),
        input('repairs', 'Reparaciones', 'Se le devuelven a quien las pagó (botón Vendedor). 0 si no hubo.', split.repairs ? formatSilver(split.repairs) : '', '0'),
        input('tax', 'Recargo del gremio (%)', 'Lo que se queda el gremio. 0 si no hay.', formatPct(split.guildTaxPct), '10'),
        input('seller', 'Pago al vendedor (%)', 'Lo que cobra quien vende el loot. 0 si no hay.', formatPct(split.sellerPct), '5')
      );
    await interaction.showModal(modal);
    return;
  }

  if (action === 'loot_mmoney' && interaction.isModalSubmit()) {
    const total = parseSilver(interaction.fields.getTextInputValue('total'));
    const repairs = parseSilver(interaction.fields.getTextInputValue('repairs') || '0');
    const tax = parsePct(interaction.fields.getTextInputValue('tax'));
    const seller = parsePct(interaction.fields.getTextInputValue('seller'));
    const errors: string[] = [];
    if (total === null) errors.push('No entendí el **total**. Escríbelo así: `12500000`, `12.500.000` o `12.5m`.');
    if (repairs === null) errors.push('No entendí las **reparaciones**.');
    if (tax === null || seller === null) errors.push('Los porcentajes van como número: `10` o `2,5`.');
    const next = { ...split, total: total ?? 0, repairs: repairs ?? 0, guildTaxPct: tax ?? 0, sellerPct: seller ?? 0 };
    if (!errors.length) {
      try {
        computeSplit(next, next.members.length);
      } catch (err) {
        if (!(err instanceof LootError)) throw err;
        errors.push(err.message);
      }
    }
    if (errors.length) {
      await update(`❌ ${errors.join('\n❌ ')}`);
      return;
    }
    Object.assign(split, next);
    await update();
    return;
  }

  if (action === 'loot_who' && interaction.isButton()) {
    const pick = (cid: string, label: string, description: string, current?: string) => {
      const menu = new UserSelectMenuBuilder().setCustomId(cid).setMinValues(0).setMaxValues(1).setRequired(false);
      if (current) menu.setDefaultUsers(current);
      return new LabelBuilder().setLabel(label).setDescription(description).setUserSelectMenuComponent(menu);
    };
    const modal = new ModalBuilder()
      .setCustomId(`loot_mwho:${split.id}`)
      .setTitle('Vendedor y reparaciones')
      .addLabelComponents(
        pick('seller', 'Quién vende el loot', 'Cobra el pago al vendedor, además de su parte.', split.sellerId),
        pick('repairs', 'Quién pagó las reparaciones', 'Se le devuelve lo de reparaciones.', split.repairsUserId)
      );
    await interaction.showModal(modal);
    return;
  }

  if (action === 'loot_mwho' && interaction.isModalSubmit()) {
    split.sellerId = interaction.fields.getSelectedUsers('seller')?.first()?.id;
    split.repairsUserId = interaction.fields.getSelectedUsers('repairs')?.first()?.id;
    await update();
    return;
  }

  if (action === 'loot_rm' && interaction.isButton()) {
    let list = '';
    split.members.forEach((m, i) => {
      const line = `#${i + 1} ${m.name.replace(/[*_`~|]/g, '')}`;
      if (list.length + line.length < 3800) list += (list ? '\n' : '') + line;
    });
    const modal = new ModalBuilder()
      .setCustomId(`loot_mrm:${split.id}`)
      .setTitle('Quitar jugadores')
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(list))
      .addLabelComponents(
        new LabelBuilder()
          .setLabel('Números a quitar')
          .setDescription('Separados por comas o espacios. Ej: 3, 7')
          .setTextInputComponent(new TextInputBuilder().setCustomId('nums').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(200))
      );
    await interaction.showModal(modal);
    return;
  }

  if (action === 'loot_mrm' && interaction.isModalSubmit()) {
    const nums = new Set(
      interaction.fields
        .getTextInputValue('nums')
        .split(/[^\d]+/)
        .filter(Boolean)
        .map(Number)
    );
    const before = split.members.length;
    split.members = split.members.filter((_, i) => !nums.has(i + 1));
    await update(`➖ Quité ${before - split.members.length} ${before - split.members.length === 1 ? 'jugador' : 'jugadores'}.`);
    return;
  }

  if (action === 'loot_log' && interaction.isButton()) {
    if (!getLimits(config).lootPro) {
      await interaction.reply({ content: `Importar el log del loot logger es Premium. ${PREMIUM_UPSELL}\nEl reparto por total de plata es gratis.`, ...ephemeral });
      return;
    }
    const modal = new ModalBuilder()
      .setCustomId(`loot_mlog:${split.id}`)
      .setTitle('Importar log de AO Loot Logger')
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          'Sube el archivo `loot-events-….txt` que crea AO Loot Logger (está en su misma carpeta). Solo se usa lo recogido durante esta salida. ¿No lo tienes instalado? Pulsa **❓ Guía** en el editor.'
        )
      )
      .addLabelComponents(
        new LabelBuilder()
          .setLabel('Archivo del log (.txt)')
          .setFileUploadComponent(new FileUploadBuilder().setCustomId('file').setMinValues(1).setMaxValues(1).setRequired(true))
      );
    await interaction.showModal(modal);
    return;
  }

  if (action === 'loot_mlog' && interaction.isModalSubmit()) {
    const file = interaction.fields.getUploadedFiles('file', true).first();
    if (!file || !interaction.guild) return update('❌ No me llegó ningún archivo.');
    if (file.size > MAX_LOG_BYTES) return update(`❌ El archivo pesa demasiado (máximo ${MAX_LOG_BYTES / 1024 / 1024} MB).`);
    if (!/\.(txt|csv|log)$/i.test(file.name)) return update('❌ Tiene que ser el `.txt` que crea AO Loot Logger.');
    await interaction.deferUpdate();
    const text = await fetch(file.url)
      .then((r) => (r.ok ? r.text() : null))
      .catch(() => null);
    const notice = text === null ? '❌ No pude descargar el archivo. Prueba otra vez.' : await importLog(interaction.guild, draft, file.name, text);
    await interaction.editReply(editorMessage(config, draft, notice));
    return;
  }

  if (action === 'loot_save' && interaction.isButton()) {
    const now = Date.now();
    const existing = getSplit(config.guildId, split.id);
    if (existing && isLockedFor(interaction, existing)) {
      await update('🔒 Este reparto ya está pagado entero: solo alguien con **Gestionar servidor** puede cambiarlo.');
      return;
    }
    if (existing) {
      split.updatedBy = interaction.user.id;
      split.updatedAt = now;
      split.messageId = existing.messageId;
      split.messageChannelId = existing.messageChannelId;
    }
    let saved: LootSplit;
    try {
      saved = saveSplit(config.guildId, split).split;
    } catch (err) {
      if (err instanceof LootError) return update(`❌ ${err.message}`);
      throw err;
    }
    drafts.delete(key);
    await interaction.update({ content: '⏳ Publicando el reparto…', embeds: [], components: [] });
    const url = await publishSplit(interaction.client, config, saved, interaction.channelId);
    const b = computeSplit(saved, saved.members.length);
    await interaction.editReply({
      content: url
        ? `✅ ${existing ? 'Reparto actualizado' : 'Reparto publicado'}: **${formatSilver(b.perPlayer)}** para cada uno de los ${b.players}. ${url}\n-# Marca quién cobró con el botón **💸 Marcar pagos** del mensaje.`
        : '✅ Reparto guardado, pero no pude publicarlo en el canal del ping (¿me faltan permisos?). Lo ves en el panel y con `/loot historial`.',
    });
  }
}

// Abre el editor con un borrador nuevo: el reparto guardado si existe o uno nuevo para el ping.
async function openEditor(interaction: ButtonInteraction | ChatInputCommandInteraction, config: GuildConfig, id: string) {
  const ephemeral = { flags: MessageFlags.Ephemeral } as const;
  const saved = getSplit(config.guildId, id);
  const ping = saved ? undefined : ConfigManager.getPing(config.guildId, id);
  if (!saved && !ping) {
    await interaction.reply({ content: '⚠️ Esa salida ya no está guardada (los pings se borran 3 días después de cerrarse).', ...ephemeral });
    return;
  }
  const callerId = saved?.callerId ?? ping!.callerId;
  if (!canManageLoot(interaction as unknown as PermInteraction, config, callerId)) {
    const role = lootSettings(config).managerRoleId;
    await interaction.reply({
      content: `⛔ Solo el Caller (<@${callerId}>)${role ? `, la tesorería (<@&${role}>)` : ''} o un oficial pueden repartir este loot.`,
      allowedMentions: { parse: [] },
      ...ephemeral,
    });
    return;
  }
  if (ping && ping.status !== 'CLOSED') {
    await interaction.reply({ content: ping.status === 'CANCELLED' ? 'Esta salida se canceló: no hay loot que repartir.' : 'El loot se reparte cuando la salida termina (GG en el Mando).', ...ephemeral });
    return;
  }
  if (saved && isLockedFor(interaction as unknown as PermInteraction, saved)) {
    await interaction.reply({ content: '🔒 Este reparto ya está pagado entero: solo alguien con **Gestionar servidor** puede cambiarlo.', ...ephemeral });
    return;
  }
  const split: LootSplit = saved ? structuredClone(saved) : newSplitFor(config, ping!, interaction.user.id);
  const draft: Draft = { split, suggestions: [], at: Date.now() };
  drafts.set(draftKey(config.guildId, split.id, interaction.user.id), draft);
  const intro = saved ? undefined : '👥 Están los anotados del ping. Quita a los que no fueron, añade a los que faltan y pon la plata.';
  await interaction.reply({ ...editorMessage(config, draft, intro), ...ephemeral });
}

// Botón "Marcar pagos" y su menú.
async function handlePayments(interaction: LootInteraction, config: GuildConfig, action: string, id: string) {
  const ephemeral = { flags: MessageFlags.Ephemeral } as const;
  const split = getSplit(config.guildId, id);
  if (!split) {
    await interaction.reply({ content: 'Ese reparto ya no existe.', ...ephemeral });
    return;
  }
  if (!canManageLoot(interaction as unknown as PermInteraction, config, split.callerId)) {
    await interaction.reply({ content: '⛔ Solo el Caller, la tesorería o un oficial pueden marcar pagos.', ...ephemeral });
    return;
  }
  // Primero los que faltan por cobrar; Discord admite 25 opciones por menú.
  const shown = [...split.members].sort((a, b) => Number(a.paid) - Number(b.paid)).slice(0, 25);
  const b = computeSplit(split, split.members.length);

  if (action === 'loot_pay' && interaction.isButton()) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`loot_paysel:${split.id}`)
      .setPlaceholder('Marca a los que ya cobraron')
      .setMinValues(0)
      .setMaxValues(shown.length)
      .addOptions(
        shown.map((m) => ({
          label: m.name.slice(0, 100),
          value: m.userId,
          description: `${formatSilver(amountFor(split, b, m.userId))} de plata`,
          default: m.paid,
        }))
      );
    const more = split.members.length > shown.length ? `\n-# Salen ${shown.length} de ${split.members.length}: primero los que faltan por cobrar.` : '';
    await interaction.reply({
      content: `💸 **${escapeMarkdown(split.title)}** — marca a los que ya cobraron y desmarca si te equivocaste.${more}`,
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],
      ...ephemeral,
    });
    return;
  }

  if (action === 'loot_paysel' && interaction.isStringSelectMenu()) {
    const selected = new Set(interaction.values);
    const changes: Record<string, boolean> = {};
    for (const m of shown) changes[m.userId] = selected.has(m.userId);
    const updated = setPaid(config.guildId, split.id, changes, interaction.user.id);
    const paid = updated.members.filter((m) => m.paid).length;
    await interaction.update({
      content: isFullyPaid(updated) ? `✅ Pagado a todos (${paid}/${updated.members.length}). El reparto queda cerrado.` : `💾 Guardado: ${paid}/${updated.members.length} pagados.`,
      components: [],
    });
    await refreshLootMessage(interaction.client, config, updated);
  }
}

// ---------- Comandos ----------

/** /loot repartir | pendientes | historial | guia. */
export async function handleLootCommand(interaction: ChatInputCommandInteraction, config: GuildConfig) {
  const sub = interaction.options.getSubcommand();
  const ephemeral = { flags: MessageFlags.Ephemeral } as const;

  if (sub === 'guia') {
    const pub = interaction.options.getBoolean('publicar') ?? false;
    await interaction.reply({ embeds: [lootGuideEmbed(config)], ...(pub ? {} : ephemeral) });
    return;
  }
  if (!lootSettings(config).enabled) {
    await interaction.reply({ content: 'El reparto de loot está desactivado en este servidor (se activa en el panel).', ...ephemeral });
    return;
  }

  if (sub === 'repartir') {
    const id = interaction.options.getString('salida', true);
    await openEditor(interaction, config, id);
    return;
  }

  if (sub === 'pendientes') {
    const user = interaction.options.getUser('jugador') ?? interaction.user;
    const rows = pendingFor(config.guildId, user.id);
    const total = rows.reduce((s, r) => s + r.amount, 0);
    const embed = baseEmbed(config, 'Reparto de loot').setTitle(`⏳ Plata pendiente de ${user.id === interaction.user.id ? 'cobrar' : user.displayName}`.slice(0, 256));
    if (!rows.length) embed.setDescription('No hay nada pendiente. 🎉');
    else {
      embed.setDescription(`Total: **${formatSilver(total)}** en ${rows.length} ${rows.length === 1 ? 'salida' : 'salidas'}`);
      addListFields(
        embed,
        'Salidas',
        rows.map((r) => `**${formatSilver(r.amount)}** · ${escapeMarkdown(r.split.title)} · <t:${Math.floor(r.split.at / 1000)}:d>${r.split.messageId && r.split.messageChannelId ? ` · [ver](https://discord.com/channels/${config.guildId}/${r.split.messageChannelId}/${r.split.messageId})` : ''}`),
        3
      );
    }
    await interaction.reply({ embeds: [fitEmbed(embed)], allowedMentions: { parse: [] }, ...ephemeral });
    return;
  }

  if (sub === 'historial') {
    const pro = getLimits(config).lootPro;
    const splits = listSplits(config.guildId, pro).slice(0, 15);
    const embed = baseEmbed(config, 'Reparto de loot').setTitle('📜 Últimos repartos de loot');
    if (!splits.length) embed.setDescription('Todavía no hay repartos. Se hacen al terminar una salida: **GG** en el Mando → **💰 Repartir loot**.');
    else {
      embed.setDescription(
        splits
          .map((s) => {
            const b = computeSplit(s, s.members.length);
            const paid = s.members.filter((m) => m.paid).length;
            return `${isFullyPaid(s) ? '✅' : '⏳'} **${escapeMarkdown(s.title)}** · <t:${Math.floor(s.at / 1000)}:d> · ${shortSilver(b.total)} → ${shortSilver(b.perPlayer)} c/u · ${paid}/${s.members.length} pagados`;
          })
          .join('\n')
      );
    }
    if (!pro) embed.addFields({ name: '​', value: `-# Últimos ${FREE_HISTORY_DAYS} días. 💎 Premium guarda todo el historial y lo exporta a CSV desde el panel.` });
    await interaction.reply({ embeds: [fitEmbed(embed)], ...ephemeral });
  }
}

/** Autocompletado de /loot repartir: salidas terminadas que puede repartir este usuario. */
export async function handleLootAutocomplete(interaction: AutocompleteInteraction) {
  if (!interaction.guildId) return interaction.respond([]);
  const config = ConfigManager.getConfig(interaction.guildId);
  const q = interaction.options.getFocused().toLowerCase();
  const can = (callerId: string) => canManageLoot(interaction as unknown as PermInteraction, config, callerId);
  const choices: Array<{ name: string; value: string }> = [];
  const seen = new Set<string>();
  const ago = (at: number) => {
    const h = Math.round((Date.now() - at) / 3_600_000);
    return h < 1 ? 'hace un rato' : h < 48 ? `hace ${h} h` : `hace ${Math.round(h / 24)} días`;
  };
  const pings = Object.values(ConfigManager.getActivePings(config.guildId))
    .filter((p) => p.status === 'CLOSED' && can(p.callerId))
    .sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0));
  for (const p of pings) {
    const done = getSplit(config.guildId, p.id);
    seen.add(p.id);
    choices.push({ name: `${done ? '✏️' : '💰'} ${p.title} · ${ago(p.closedAt ?? p.createdAt)}`.slice(0, 100), value: p.id });
  }
  for (const s of listSplits(config.guildId, true).slice(0, 50)) {
    if (seen.has(s.id) || !can(s.callerId)) continue;
    choices.push({ name: `✏️ ${s.title} · ${ago(s.at)}`.slice(0, 100), value: s.id });
  }
  await interaction.respond(choices.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 25));
}
