/**
 * Punto de entrada de todas las interacciones de Discord: comandos, botones, menús y formularios.
 * Enruta por tipo y customId a los handlers de cada módulo y contiene el flujo principal de los
 * pings: asistente de creación, publicación, roster y Mando del Caller.
 *
 * Prefijos de customId: ping_* (mensaje público del ping), wizard_* (asistente), caller_action:* (Mando),
 * compo_* (editor de compos), pts_* (puntos), loot_* (reparto de loot), tk_* (tickets). Los de versiones anteriores (tpl_*, config…) se
 * siguen atendiendo para redirigir al panel web cuando alguien pulsa un mensaje antiguo.
 */
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  Guild,
  ChatInputCommandInteraction,
  Interaction,
  MessageMentionOptions,
  ModalBuilder,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
} from 'discord.js';
import { ActivePing, ContentTypeConfig, DraftPingSession, GuildConfig, MentionType, RoleTemplate } from '../types/ping';
import { ConfigManager } from '../utils/configManager';
import {
  buildFixedCallerPanel,
  buildWizardStepMessage,
  utcTimeSelects,
  resolvePingRoleId,
} from '../utils/panelBuilder';
import { buildPingMessagePayload } from '../utils/pingBuilder';
import { generateBuildCard } from '../utils/buildCard';
import { cleanupPingChannels, deletePingMessage } from '../utils/pingSweeper';
import { getLimits, PREMIUM_UPSELL } from '../utils/plans';
import { baseEmbed, fitEmbed, hexToInt, UI_COLORS } from '../utils/ui';
import { cleanPlayerText, cleanUserText, clearCooldown, COOLDOWNS, takeCooldown } from '../utils/security';
import { canCreatePings, canMentionEveryone, displayNameOf, isGuildManager } from '../utils/permissions';
import { handleCompoInteraction, parseRolesText } from './compoEditor';
import { handlePanelCommand, handlePlanAdminCommand, handlePlanCommand, handleRedeemCommand } from './configCommands';
import { applyEntitlement } from '../utils/memberships';
import { movedToPanelReply } from '../utils/panelLink';
import { defaultUtcSlot, draftSlot, formatUtc, nextUtcStartUnix } from '../utils/pingTime';
import { handlePointsCommand, handlePointsInteraction, handleRankingCommand, pointsButton } from './pointsHandler';
import { handleLootAutocomplete, handleLootCommand, handleLootInteraction, lootButton } from './lootHandler';
import { handleStatsCommand, handleTicketCommand, handleTicketInteraction } from './ticketHandler';
import { reportError } from '../utils/alerts';
import { cleanPartySize, joinGoesToBench, partyJoined, partyMax } from '../utils/party';

const NO_CALLER_PERMS = '⛔ Solo los Callers (o admins) pueden tirar pings en este servidor.';
const NO_ADMIN_PERMS = '⛔ Necesitas el permiso **Gestionar servidor** para hacer esto.';

function defaultMentionFor(config: GuildConfig, contentTypeId: string): MentionType {
  return resolvePingRoleId(config, contentTypeId) ? 'ROLE' : 'NONE';
}

// Devuelve el borrador del Caller en este servidor o crea uno con el primer contenido.
function getOrInitDraft(
  config: GuildConfig,
  userId: string,
  username: string,
  avatarUrl?: string
): DraftPingSession {
  let draft = ConfigManager.getDraft(config.guildId, userId);
  if (!draft) {
    const firstContent = config.contentTypes[0];
    const slot = defaultUtcSlot();
    draft = {
      guildId: config.guildId,
      callerId: userId,
      callerName: username,
      callerAvatarUrl: avatarUrl,
      contentTypeId: firstContent.id,
      title: firstContent.name,
      departureLocation: firstContent.defaultZone,
      gearTier: firstContent.defaultGearTier,
      mountRequired: firstContent.defaultMount,
      utcHour: slot.hour,
      utcMinute: slot.minute,
      startTimeUnix: nextUtcStartUnix(slot),
      timeLabel: formatUtc(slot),
      notes: '',
      targetChannelId: config.pingTargetChannelId,
      mentionType: defaultMentionFor(config, firstContent.id),
      createThread: firstContent.createThread !== false,
      createVoice: firstContent.createVoice !== false,
    };
    ConfigManager.setDraft(config.guildId, userId, draft);
  }
  return draft;
}

function fallbackContentConfig(ping: ActivePing): ContentTypeConfig {
  return {
    id: ping.contentTypeId,
    name: ping.contentName,
    emoji: '⚔️',
    subtitle: 'LLAMADO DE CONTENIDO',
    accentColor: '#D4AF37',
    defaultGearTier: ping.gearTier,
    defaultMount: ping.mountRequired,
    defaultZone: ping.departureLocation,
    roles: ping.roles,
  };
}

// Redibuja el mensaje público del ping tras un cambio de roster o de estado.
async function refreshActivePingMessage(interaction: Interaction, config: GuildConfig, ping: ActivePing) {
  if (ping.messageDeleted) return;

  // Si la interacción viene del propio mensaje del ping, se confirma a Discord antes de nada:
  // generar el banner puede pasar de los 3 s que da Discord y la interacción caducaría
  // ("Unknown interaction").
  const fromPingMessage = interaction.isMessageComponent() && interaction.message.id === ping.messageId;
  let deferredHere = false;
  if (fromPingMessage && !interaction.deferred && !interaction.replied) {
    await interaction.deferUpdate();
    deferredHere = true;
  }

  const contentConfig = ConfigManager.getContentType(config.guildId, ping.contentTypeId) || fallbackContentConfig(ping);
  // Si alguien borró a mano la voz temporal, se deja de enlazar.
  if (ping.voiceChannelId && interaction.guild && !interaction.guild.channels.cache.has(ping.voiceChannelId)) {
    ping.voiceChannelId = undefined;
    ConfigManager.savePing(config.guildId, ping);
  }

  const payload = await buildPingMessagePayload(ping, contentConfig, config);

  if (fromPingMessage && interaction.isMessageComponent()) {
    // Tras deferUpdate, editReply edita el mensaje del ping (el token dura 15 min).
    // Si ya se había respondido de otra forma, se edita el mensaje directamente.
    if (deferredHere) await interaction.editReply(payload);
    else await interaction.message.edit(payload);
    return;
  }
  if (interaction.guild) {
    const channel = await interaction.guild.channels.fetch(ping.channelId).catch(() => null);
    if (channel && channel.isTextBased()) {
      const msg = await (channel as TextChannel).messages.fetch(ping.messageId).catch(() => null);
      if (msg) await msg.edit(payload);
    }
  }
}

// Quita a un jugador de todos los roles, la banca y los ausentes. Devuelve el arma o IP que había indicado, para conservarla si cambia de rol.
function removeUserFromPing(ping: ActivePing, userId: string): string | undefined {
  let previousWeapon: string | undefined;

  for (const roleId of Object.keys(ping.roster)) {
    const existing = ping.roster[roleId].find((u) => u.userId === userId);
    if (existing?.customWeapon) previousWeapon = existing.customWeapon;
    ping.roster[roleId] = ping.roster[roleId].filter((u) => u.userId !== userId);
  }

  const inBench = ping.bench.find((u) => u.userId === userId);
  if (inBench?.customWeapon) previousWeapon = inBench.customWeapon;
  ping.bench = ping.bench.filter((u) => u.userId !== userId);

  ping.absent = ping.absent.filter((u) => u.userId !== userId);
  return previousWeapon;
}

function isPingFinished(ping: ActivePing) {
  return ping.status === 'CLOSED' || ping.status === 'CANCELLED';
}

/**
 * Atiende cualquier interacción. Nunca lanza: los errores se registran con reportError y, si se
 * puede, se responde al usuario con un mensaje genérico.
 */
export async function handleInteraction(interaction: Interaction) {
  try {
    if (interaction.isAutocomplete()) {
      // Solo /loot repartir usa autocompletado (elegir la salida).
      if (interaction.commandName === 'loot' && interaction.inGuild()) await handleLootAutocomplete(interaction);
      else await interaction.respond([]);
      return;
    }

    if (!interaction.inGuild()) {
      if (interaction.isRepliable()) {
        await interaction.reply({ content: 'Este bot solo funciona dentro de servidores.', flags: MessageFlags.Ephemeral });
      }
      return;
    }

    const config = ConfigManager.getConfig(interaction.guildId, interaction.guild?.name);
    if (interaction.guild) ConfigManager.syncGuildIcon(config, interaction.guild);
    // Cada interacción trae las suscripciones vigentes: así un pago recién hecho se nota al instante.
    for (const e of interaction.entitlements.values()) applyEntitlement(interaction.client, e);
    const displayName = displayNameOf(interaction);

    // Reparto de loot: botones, menús y formularios con prefijo loot_.
    if (
      (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isUserSelectMenu() || interaction.isModalSubmit()) &&
      interaction.customId.startsWith('loot_')
    ) {
      await handleLootInteraction(interaction, config);
      return;
    }

    // Tickets: botones, menús y formularios con prefijo tk_.
    if ((interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) && interaction.customId.startsWith('tk_')) {
      await handleTicketInteraction(interaction, config);
      return;
    }

    // 1. Comandos de barra.
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;

      if (commandName === 'panel') return handlePanelCommand(interaction);
      // /config ya no existe (se configura en el panel), pero Discord puede seguir mostrándolo en caché.
      if (commandName === 'config') {
        await interaction.reply({ ...movedToPanelReply(config.guildId, 'ajustes'), flags: MessageFlags.Ephemeral });
        return;
      }
      if (commandName === 'plan') return handlePlanCommand(interaction, config);
      if (commandName === 'plan-admin') return handlePlanAdminCommand(interaction);
      if (commandName === 'canjear') return handleRedeemCommand(interaction, config);
      if (commandName === 'ranking') return handleRankingCommand(interaction, config);
      if (commandName === 'puntos') return handlePointsCommand(interaction, config);
      if (commandName === 'loot') return handleLootCommand(interaction, config);
      if (commandName === 'mando') return handleMandoCommand(interaction, config);
      if (commandName === 'ticket') return handleTicketCommand(interaction, config);
      if (commandName === 'stats') return handleStatsCommand(interaction, config);

      if (commandName === 'panel-ping') {
        if (!isGuildManager(interaction) && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
          await interaction.reply({ content: NO_ADMIN_PERMS, flags: MessageFlags.Ephemeral });
          return;
        }
        await interaction.reply({ content: '✅ **Panel de Callers desplegado en este canal.**', flags: MessageFlags.Ephemeral });
        if (interaction.channel && 'send' in interaction.channel) {
          await interaction.channel.send(buildFixedCallerPanel(config));
        }
        return;
      }

      if (commandName === 'ping') {
        if (!canCreatePings(interaction, config)) {
          await interaction.reply({ content: NO_CALLER_PERMS, flags: MessageFlags.Ephemeral });
          return;
        }
        const draft = getOrInitDraft(config, interaction.user.id, displayName, interaction.user.displayAvatarURL());
        await interaction.reply({ ...buildWizardStepMessage(draft, config), flags: MessageFlags.Ephemeral });
        return;
      }
    }

    // 2. Botones.
    if (interaction.isButton()) {
      const { customId } = interaction;

      // --- Botones del ping publicado; los usa cualquier jugador ---
      if (customId.startsWith('ping_btn_')) {
        await handlePingActionButtons(interaction, config, displayName);
        return;
      }
      if (customId.startsWith('caller_action:')) {
        await handleCallerStatusAction(interaction, config);
        return;
      }
      if (customId.startsWith('caller_time:')) {
        await handleCallerTime(interaction, config);
        return;
      }
      if (customId.startsWith('pts_')) {
        await handlePointsInteraction(interaction, config);
        return;
      }

      // --- Editor de compos; los permisos dependen de lo que se edite ---
      if (customId.startsWith('compo_')) {
        await handleCompoInteraction(interaction, config);
        return;
      }

      // --- Recargar el panel de Callers; no cambia nada, así que puede cualquiera ---
      if (customId === 'panel_refresh') {
        await interaction.update(buildFixedCallerPanel(config));
        return;
      }

      // --- Botones de paneles antiguos que configuraban desde Discord: ahora llevan al panel web ---
      if (customId === 'panel_manage_templates' || customId.startsWith('tpl_')) {
        await interaction.reply({ ...movedToPanelReply(config.guildId), flags: MessageFlags.Ephemeral });
        return;
      }

      // --- Todo lo demás es del asistente de creación y requiere ser Caller ---
      if (customId.startsWith('wizard_') || customId === 'panel_start_ping_wizard') {
        if (!canCreatePings(interaction, config)) {
          await interaction.reply({ content: NO_CALLER_PERMS, flags: MessageFlags.Ephemeral });
          return;
        }
      }

      if (customId === 'panel_start_ping_wizard') {
        ConfigManager.clearDraft(config.guildId, interaction.user.id);
        const draft = getOrInitDraft(config, interaction.user.id, displayName, interaction.user.displayAvatarURL());
        await interaction.reply({ ...buildWizardStepMessage(draft, config), flags: MessageFlags.Ephemeral });
        return;
      }

      const draft = getOrInitDraft(config, interaction.user.id, displayName);
      // Detalles, compo, aviso, voz e hilo ya no se ajustan por ping: salen del panel web. Si alguien
      // pulsa uno de esos botones en un mensaje antiguo, se le muestra el asistente actual.
      if (['wizard_btn_edit_details', 'wizard_btn_edit_roles', 'wizard_btn_cycle_mention', 'wizard_btn_toggle_extras'].includes(customId)) {
        await interaction.update(buildWizardStepMessage(draft, config));
        return;
      }

      if (customId === 'wizard_btn_cancel') {
        ConfigManager.clearDraft(config.guildId, interaction.user.id);
        await interaction.update({ content: '❌ Creación de ping cancelada.', embeds: [], components: [] });
        return;
      }

      if (customId === 'wizard_btn_launch_ping') {
        await launchOfficialPing(interaction, config, displayName);
        return;
      }
    }

    // 3. Menús desplegables.
    if (interaction.isStringSelectMenu()) {
      const { customId, values } = interaction;

      if (customId.startsWith('compo_')) {
        await handleCompoInteraction(interaction, config);
        return;
      }

      // --- /mando con varios pings: el Caller elige cuál ---
      // --- Mando: cambiar la hora de un ping publicado ---
      if (customId.startsWith('caller_time:')) {
        await handleCallerTime(interaction, config);
        return;
      }

      if (customId === 'mando_select') {
        const ping = ConfigManager.getPing(config.guildId, values[0]);
        if (!ping) {
          await interaction.update({ content: '⚠️ Esa salida ya no está guardada.', components: [] });
          return;
        }
        if (!canCommandPing(interaction, ping)) {
          await interaction.update({ content: '⛔ No eres el Caller de esta salida.', components: [] });
          return;
        }
        await interaction.update({ ...callerPanel(config, ping), allowedMentions: { parse: [] } });
        return;
      }

      // --- Ping publicado: el jugador elige su rol ---
      if (customId.startsWith('ping_role_select:')) {
        if (takeCooldown(`roster:${interaction.user.id}`, COOLDOWNS.rosterAction) > 0) {
          await interaction.reply({ content: '⏳ Despacio, vuelve a intentarlo en un segundo.', flags: MessageFlags.Ephemeral });
          return;
        }
        const pingId = customId.split(':')[1];
        const ping = ConfigManager.getPing(config.guildId, pingId);
        if (!ping || isPingFinished(ping)) {
          await interaction.reply({ content: '⚠️ Este ping ya no está activo.', flags: MessageFlags.Ephemeral });
          return;
        }
        const selectedRoleId = values[0];
        const roleObj = ping.roles.find((r) => r.id === selectedRoleId);
        if (!roleObj) {
          await interaction.reply({ content: '⚠️ Rol inválido.', flags: MessageFlags.Ephemeral });
          return;
        }

        const prevWeapon = removeUserFromPing(ping, interaction.user.id);
        ping.roster[selectedRoleId] ||= [];
        const currentList = ping.roster[selectedRoleId];
        const isFull = joinGoesToBench(ping, roleObj);
        const entry = {
          userId: interaction.user.id,
          username: interaction.user.username,
          displayName,
          joinedAt: Date.now(),
        };

        if (isFull) {
          // Rol lleno o party completa: va a la banca, con el rol que quería como nota.
          ping.bench.push({
            ...entry,
            customWeapon: prevWeapon ? `${prevWeapon} (Cola: ${roleObj.label})` : `Cola: ${roleObj.label}`,
          });
        } else {
          currentList.push({ ...entry, customWeapon: prevWeapon });
        }

        ConfigManager.savePing(config.guildId, ping);
        await refreshActivePingMessage(interaction, config, ping);
        return;
      }

      // --- Menús de plantillas de versiones anteriores: ahora se gestionan en el panel web ---
      if (customId.startsWith('tpl_')) {
        await interaction.reply({ ...movedToPanelReply(config.guildId), flags: MessageFlags.Ephemeral });
        return;
      }

      // --- Asistente, solo para Callers ---
      if (customId.startsWith('wizard_')) {
        if (!canCreatePings(interaction, config)) {
          await interaction.reply({ content: NO_CALLER_PERMS, flags: MessageFlags.Ephemeral });
          return;
        }
        const draft = getOrInitDraft(config, interaction.user.id, displayName);

        if (customId === 'wizard_select_content') {
          const selected = ConfigManager.getContentType(config.guildId, values[0]) || config.contentTypes[0];
          draft.contentTypeId = selected.id;
          draft.title = selected.name;
          draft.departureLocation = selected.defaultZone;
          draft.gearTier = selected.defaultGearTier;
          draft.mountRequired = selected.defaultMount;
          draft.customRoles = undefined;
          draft.mentionType = defaultMentionFor(config, selected.id);
          draft.createVoice = selected.createVoice !== false;
          draft.createThread = selected.createThread !== false;
        }

        if (customId === 'wizard_select_hour' || customId === 'wizard_select_minute') {
          const slot = draftSlot(draft);
          const n = parseInt(values[0], 10);
          if (customId === 'wizard_select_hour' && n >= 0 && n <= 23) slot.hour = n;
          if (customId === 'wizard_select_minute' && n >= 0 && n <= 59) slot.minute = n;
          draft.utcHour = slot.hour;
          draft.utcMinute = slot.minute;
          draft.startTimeUnix = nextUtcStartUnix(slot);
          draft.timeLabel = formatUtc(slot);
        }

        ConfigManager.setDraft(config.guildId, interaction.user.id, draft);
        await interaction.update(buildWizardStepMessage(draft, config));
        return;
      }
    }

    // Añadir jugadores al reparto de puntos.
    if (interaction.isUserSelectMenu() && interaction.customId.startsWith('pts_')) {
      await handlePointsInteraction(interaction, config);
      return;
    }

    // 4. Selector del canal de destino en el asistente.
    if (interaction.isChannelSelectMenu() && interaction.customId === 'wizard_select_channel') {
      if (!canCreatePings(interaction, config)) {
        await interaction.reply({ content: NO_CALLER_PERMS, flags: MessageFlags.Ephemeral });
        return;
      }
      const draft = getOrInitDraft(config, interaction.user.id, displayName);
      draft.targetChannelId = interaction.values[0];
      ConfigManager.setDraft(config.guildId, interaction.user.id, draft);
      await interaction.update(buildWizardStepMessage(draft, config));
      return;
    }

    // 5. Formularios.
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('pts_')) {
        await handlePointsInteraction(interaction, config);
        return;
      }
      await handleModalSubmissions(interaction, config, displayName);
      return;
    }
  } catch (err) {
    const where = interaction.isCommand()
      ? `/${interaction.commandName}`
      : 'customId' in interaction
        ? String(interaction.customId).split(':')[0]
        : String(interaction.type);
    void reportError(`Interacción ${where}`, err);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction
        .reply({ content: '⚠️ Ocurrió un error procesando esta acción. Inténtalo de nuevo.', flags: MessageFlags.Ephemeral })
        .catch(() => null);
    }
  }
}

// Texto de la mención y allowedMentions correspondiente, para que Discord no notifique a nadie más.
function buildMention(
  draft: DraftPingSession,
  config: GuildConfig,
  title: string,
  callerCanMentionEveryone: boolean
): { content: string; allowedMentions: MessageMentionOptions } {
  const upperTitle = title.toUpperCase();
  const roleId = resolvePingRoleId(config, draft.contentTypeId);

  if (draft.mentionType === 'ROLE' && roleId) {
    return {
      content: `<@&${roleId}> — **¡SALE ${upperTitle}! ANÓTENSE ABAJO Y VAYAN EQUIPÁNDOSE**`,
      allowedMentions: { roles: [roleId] },
    };
  }
  if (draft.mentionType === 'HERE' && callerCanMentionEveryone) {
    return {
      content: `🔔 @here — **¡SALE ${upperTitle}! ANÓTENSE ABAJO Y VAYAN EQUIPÁNDOSE**`,
      allowedMentions: { parse: ['everyone'] },
    };
  }
  if (draft.mentionType === 'EVERYONE' && callerCanMentionEveryone) {
    return {
      content: `📢 @everyone — **¡MASS UP: ${upperTitle}!**`,
      allowedMentions: { parse: ['everyone'] },
    };
  }
  return { content: `⚔️ **¡ARMANDO PARTY: ${upperTitle}!** ⚔️`, allowedMentions: { parse: [] } };
}

// Publica el ping: mensaje con banner y embed, voz temporal, hilo de builds y Mando del Caller.
/**
 * Dónde crear la voz temporal: la categoría del panel; si no hay, la del canal del ping; si
 * tampoco, la raíz del servidor. Solo vale un sitio donde el bot tenga Gestionar canales (así no
 * hace falta dárselo en todo el servidor). Devuelve el id de la categoría, null para la raíz, o
 * undefined si no tiene permiso en ninguno de los sitios posibles.
 */
async function pickVoiceParent(
  guild: Guild,
  configuredCategoryId: string | undefined,
  pingCategoryId: string | null
): Promise<string | null | undefined> {
  const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
  if (!me) return undefined;
  const canCreateIn = async (categoryId: string) => {
    const cat = await guild.channels.fetch(categoryId).catch(() => null);
    return cat?.type === ChannelType.GuildCategory && cat.permissionsFor(me).has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels]);
  };
  // Si hay categoría configurada, se respeta: no se crea en otro sitio a espaldas del admin.
  if (configuredCategoryId) return (await canCreateIn(configuredCategoryId)) ? configuredCategoryId : undefined;
  if (pingCategoryId && (await canCreateIn(pingCategoryId))) return pingCategoryId;
  return me.permissions.has(PermissionFlagsBits.ManageChannels) ? null : undefined;
}

async function launchOfficialPing(interaction: ButtonInteraction, config: GuildConfig, callerDisplayName: string) {
  const limits = getLimits(config);
  if (ConfigManager.countOpenPings(config.guildId) >= limits.maxActivePings) {
    await interaction.reply({
      content: `⚠️ Ya hay **${limits.maxActivePings} pings abiertos** en este servidor (límite de tu plan). Cierra alguno con \`/mando\` → **GG** antes de tirar otro.\n${PREMIUM_UPSELL}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const wait = takeCooldown(`publish:${config.guildId}:${interaction.user.id}`, COOLDOWNS.publishPing);
  if (wait > 0) {
    await interaction.reply({ content: `⏳ Espera **${wait} s** antes de publicar otro ping.`, flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferUpdate();

  const draft = getOrInitDraft(config, interaction.user.id, callerDisplayName);
  const contentConfig = ConfigManager.getContentType(config.guildId, draft.contentTypeId) || config.contentTypes[0];

  // El ping usa siempre lo configurado en el panel para ese contenido.
  draft.title = contentConfig.name;
  draft.departureLocation = contentConfig.defaultZone;
  draft.gearTier = contentConfig.defaultGearTier;
  draft.mountRequired = contentConfig.defaultMount;
  draft.notes = '';
  draft.customRoles = undefined;
  draft.mentionType = defaultMentionFor(config, contentConfig.id);
  draft.createVoice = contentConfig.createVoice !== false;
  draft.createThread = contentConfig.createThread !== false;

  const pingId = `${Date.now().toString(36).toUpperCase()}`;
  const rolesToUse: RoleTemplate[] = JSON.parse(JSON.stringify(draft.customRoles || contentConfig.roles));
  const initialRoster: ActivePing['roster'] = {};
  for (const r of rolesToUse) initialRoster[r.id] = [];

  // Se recalcula al publicar: si la hora elegida ya pasó, sale al día siguiente.
  const slot = draftSlot(draft);
  const startTimeUnix = nextUtcStartUnix(slot);

  const newPing: ActivePing = {
    id: pingId,
    guildId: config.guildId,
    messageId: '',
    channelId: draft.targetChannelId || interaction.channelId,
    callerId: interaction.user.id,
    callerName: callerDisplayName,
    callerAvatarUrl: interaction.user.displayAvatarURL(),
    contentTypeId: contentConfig.id,
    contentName: contentConfig.name,
    title: draft.title || contentConfig.name,
    departureLocation: draft.departureLocation || contentConfig.defaultZone,
    gearTier: draft.gearTier || contentConfig.defaultGearTier,
    mountRequired: draft.mountRequired || contentConfig.defaultMount,
    startTimeUnix,
    timeLabel: formatUtc(slot),
    notes: draft.notes || '',
    roles: rolesToUse,
    ...(cleanPartySize(contentConfig.partySize) ? { partySize: contentConfig.partySize } : {}),
    roster: initialRoster,
    bench: [],
    absent: [],
    status: 'OPEN',
    createdAt: Date.now(),
  };

  // 1. Canal de texto de destino.
  let targetChannel: TextChannel | null = null;
  if (interaction.guild) {
    const ch = await interaction.guild.channels.fetch(newPing.channelId).catch(() => null);
    if (ch && (ch.type === ChannelType.GuildText || ch.type === ChannelType.GuildAnnouncement)) {
      targetChannel = ch as TextChannel;
    }
  }
  const fail = async (content: string) => {
    // No se consume el cooldown si no se llegó a publicar.
    clearCooldown(`publish:${config.guildId}:${interaction.user.id}`);
    await interaction.editReply({ content, embeds: [], components: [] });
  };
  if (!targetChannel || !interaction.guild) {
    await fail('❌ Ese canal no sirve para pings. Elige un canal de texto o de anuncios.');
    return;
  }

  // El Caller tiene que poder escribir en ese canal; si no, el bot publicaría por él en canales
  // donde no tiene permiso (p. ej. #anuncios).
  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  const callerPerms = member ? targetChannel.permissionsFor(member) : null;
  if (!callerPerms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
    await fail(`⛔ No tienes permiso para escribir en <#${targetChannel.id}>, así que no puedo publicar ahí por ti.`);
    return;
  }
  const me = interaction.guild.members.me;
  const botPerms = me ? targetChannel.permissionsFor(me) : null;
  const needed = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.AttachFiles,
  ];
  if (!botPerms?.has(needed)) {
    await fail(`❌ Me faltan permisos en <#${targetChannel.id}>: Ver canal, Enviar mensajes, Insertar enlaces y Adjuntar archivos.`);
    return;
  }

  // 2. Canal de voz temporal. Si no se puede crear, el ping sale igual y se avisa al Caller.
  let voiceWarning = '';
  if (draft.createVoice && interaction.guild) {
    const parentId = await pickVoiceParent(interaction.guild, config.voiceCategoryId, targetChannel.parentId);
    if (parentId === undefined) {
      voiceWarning = config.voiceCategoryId
        ? '⚠️ No pude crear la voz temporal: me falta **Gestionar canales** en la categoría de voz elegida en el panel.'
        : '⚠️ No pude crear la voz temporal: elige en el panel una **categoría de voz** donde tenga **Gestionar canales**.';
    } else {
      try {
        const voiceChannel = await interaction.guild.channels.create({
          name: `${contentConfig.emoji}︱${newPing.title.slice(0, 22)} (${callerDisplayName.slice(0, 12)})`,
          type: ChannelType.GuildVoice,
          parent: parentId ?? undefined,
          reason: `Voz temporal para el ping ${newPing.title} de ${callerDisplayName}`,
        });
        newPing.voiceChannelId = voiceChannel.id;
      } catch (err) {
        voiceWarning = '⚠️ No pude crear la voz temporal. Revisa mis permisos en la categoría de voz del panel.';
        console.warn(`[${config.guildId}] No se pudo crear la voz temporal:`, (err as Error).message);
      }
    }
  }

  // 3. Mensaje del ping.
  const messagePayload = await buildPingMessagePayload(newPing, contentConfig, config);
  const mention = buildMention(draft, config, newPing.title, canMentionEveryone(interaction));

  const sentMsg = await targetChannel.send({
    content: mention.content,
    allowedMentions: mention.allowedMentions,
    ...messagePayload,
  });
  newPing.messageId = sentMsg.id;

  // 4. Hilo de builds y swaps.
  if (draft.createThread) {
    try {
      const thread = await sentMsg.startThread({
        name: `⚔️ ${newPing.title.slice(0, 50)} — ${callerDisplayName}`.slice(0, 100),
        autoArchiveDuration: 60,
        reason: 'Hilo de builds, swaps y coordinación de la party',
      });
      newPing.threadId = thread.id;

      const buildCard = await generateBuildCard(newPing.title, newPing.roles).catch(() => null);
      await thread.send({
        files: buildCard ? [new AttachmentBuilder(buildCard, { name: 'builds.png' })] : [],
        embeds: [
          baseEmbed(config, 'Hilo de la party')
            .setColor(hexToInt(contentConfig.accentColor))
            .setTitle(`💬 Builds y swaps · ${newPing.title}`.slice(0, 256))
            .setDescription(
              [
                `👑 Caller: <@${newPing.callerId}>`,
                `📍 Masa en **${newPing.departureLocation}** · <t:${newPing.startTimeUnix}:R>`,
                newPing.voiceChannelId ? `🔊 Voz: <#${newPing.voiceChannelId}>` : '',
                '',
                'Pasa tu build si tienes dudas, avisa qué swaps llevas y coordina con el Caller.',
                '-# Este hilo se borra solo cuando termina la actividad.',
              ]
                .filter((l) => l !== null)
                .join('\n')
                .replace(/\n{3,}/g, '\n\n')
            ),
        ],
        allowedMentions: { parse: [] },
      });

      await sentMsg.edit(await buildPingMessagePayload(newPing, contentConfig, config));
    } catch (err) {
      console.warn(`[${config.guildId}] No se pudo crear el hilo:`, (err as Error).message);
    }
  }

  ConfigManager.savePing(config.guildId, newPing);
  ConfigManager.clearDraft(config.guildId, interaction.user.id);

  // El Mando del Caller se envía en privado: en el ping público lo verían todos.
  const panel = callerPanel(config, newPing);
  await interaction.editReply({
    content: '',
    embeds: [
      baseEmbed(config, 'Nuevo ping')
        .setColor(UI_COLORS.success)
        .setTitle('✅ Ping publicado')
        .setDescription(
          `${contentConfig.emoji} **${newPing.title}** en <#${newPing.channelId}>\n[Ir al ping](${sentMsg.url})` +
            (voiceWarning ? `\n\n${voiceWarning}` : '')
        ),
      ...panel.embeds,
    ],
    components: panel.components,
  });
}

// ---------- Mando del Caller (privado: al publicar y con /mando) ----------

// Puede usar el Mando el Caller del ping o un oficial con Gestionar canales.
function canCommandPing(
  interaction: { user: { id: string }; memberPermissions: Readonly<{ has(p: bigint): boolean }> | null },
  ping: ActivePing
): boolean {
  return interaction.user.id === ping.callerId || Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels));
}

// Botones de una salida terminada: repartir puntos y repartir loot (los que estén activados).
function finishedButtons(config: GuildConfig, ping: ActivePing): ButtonBuilder[] {
  return [pointsButton(config, ping), lootButton(config, ping)].filter((b): b is ButtonBuilder => b !== null);
}

// Controles del Caller para un ping (mensaje efímero). `notice` es el resultado de la última acción.
function callerPanel(config: GuildConfig, ping: ActivePing, notice?: string) {
  const joined = partyJoined(ping);
  const max = partyMax(ping.roles, ping.partySize);

  // Salida terminada: lo único que queda por hacer es repartir los puntos y el loot.
  if (isPingFinished(ping)) {
    const btns = finishedButtons(config, ping);
    const head = notice ? `${notice}\n` : '';
    return {
      content: btns.length
        ? `${head}🔒 **${ping.title}** ya terminó (${joined} anotados · ${ping.bench.length} en banca). Reparte o corrige los puntos y el loot:`
        : `${head}🔒 **${ping.title}** ya terminó.`,
      embeds: [],
      components: btns.length ? [new ActionRowBuilder<ButtonBuilder>().addComponents(btns)] : [],
    };
  }

  const embed = baseEmbed(config, 'Mando del Caller')
    .setTitle(`👑 ${ping.title}`.slice(0, 256))
    .setDescription(
      [
        `📍 <#${ping.channelId}> · ${ping.status === 'IN_PROGRESS' ? '⚔️ **En ruta**' : '🟢 Abierto'}`,
        `👥 **${joined}${max ? `/${max}` : ''}** anotados · ${ping.bench.length} en banca`,
        `⏰ Salida <t:${ping.startTimeUnix}:R>`,
        '',
        '**En ruta:** marca que ya salieron',
        '**¡A voz!:** menciona a todos los anotados en el hilo del ping',
        '**Cambiar hora:** mueve la salida sin cerrar el ping',
        '**GG / Cancelar:** cierra el ping y borra voz e hilo',
        '',
        '-# Solo tú ves esto. Si lo cierras, vuelve a abrirlo con `/mando`.',
      ].join('\n')
    );
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`caller_action:in_progress:${ping.id}`)
      .setLabel('En ruta')
      .setEmoji('⚔️')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(ping.status === 'IN_PROGRESS'),
    new ButtonBuilder().setCustomId(`caller_action:notify_voice:${ping.id}`).setLabel('¡A voz!').setEmoji('📢').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`caller_action:close:${ping.id}`).setLabel('GG').setEmoji('🔒').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`caller_action:cancel:${ping.id}`).setLabel('Cancelar').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
  );
  // Fila aparte: Discord admite como máximo 5 botones por fila
  const timeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`caller_time:open:${ping.id}`)
      .setLabel('Cambiar hora')
      .setEmoji('⏰')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(ping.status !== 'OPEN')
  );
  return { content: notice ?? '', embeds: [fitEmbed(embed)], components: [row, timeRow] };
}

/**
 * Cambio de hora de un ping publicado. La hora elegida viaja en los customId de los menús y
 * del botón de guardar, así que no hace falta guardar estado mientras el Caller decide.
 *   caller_time:open:<ping>              abre el selector con la hora actual
 *   caller_time:h:<ping>:<minuto>        menú de hora (conserva el minuto elegido)
 *   caller_time:m:<ping>:<hora>          menú de minuto (conserva la hora elegida)
 *   caller_time:ok:<ping>:<hora>:<min>   guarda
 *   caller_time:back:<ping>              vuelve al Mando sin cambiar nada
 */
function callerTimePanel(config: GuildConfig, ping: ActivePing, slot: { hour: number; minute: number }) {
  const start = nextUtcStartUnix(slot);
  const embed = baseEmbed(config, 'Mando del Caller')
    .setTitle(`⏰ Cambiar hora · ${ping.title}`.slice(0, 256))
    .setDescription(
      [
        `Ahora: **${ping.timeLabel || formatUtc(draftSlotFromUnix(ping.startTimeUnix))}** · <t:${ping.startTimeUnix}:t> (<t:${ping.startTimeUnix}:R>)`,
        `Nueva: **${formatUtc(slot)}** · <t:${start}:t> (<t:${start}:R>)`,
        '',
        '-# Si la hora elegida ya pasó hoy, la salida queda para mañana. Los anotados se mantienen y se avisa en el hilo.',
      ].join('\n')
    );
  const [hourRow, minuteRow] = utcTimeSelects(`caller_time:h:${ping.id}:${slot.minute}`, `caller_time:m:${ping.id}:${slot.hour}`, slot);
  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`caller_time:ok:${ping.id}:${slot.hour}:${slot.minute}`)
      .setLabel(`Guardar ${formatUtc(slot)}`)
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success)
      .setDisabled(start === ping.startTimeUnix),
    new ButtonBuilder().setCustomId(`caller_time:back:${ping.id}`).setLabel('Volver').setStyle(ButtonStyle.Secondary)
  );
  return { content: '', embeds: [fitEmbed(embed)], components: [hourRow, minuteRow, buttons] };
}

/** Hora y minuto UTC de un instante (para preseleccionar la hora actual del ping). */
function draftSlotFromUnix(unix: number) {
  const d = new Date(unix * 1000);
  return { hour: d.getUTCHours(), minute: d.getUTCMinutes() };
}

/** Menús y botones de caller_time:* */
async function handleCallerTime(interaction: ButtonInteraction | StringSelectMenuInteraction, config: GuildConfig) {
  const [, step, pingId, a, b] = interaction.customId.split(':');
  const ping = ConfigManager.getPing(config.guildId, pingId);
  if (!ping) {
    await interaction.update({ content: '⚠️ Esa salida ya no está guardada.', embeds: [], components: [] });
    return;
  }
  if (!canCommandPing(interaction, ping)) {
    await interaction.reply({ content: '⛔ No eres el Caller de esta salida.', flags: MessageFlags.Ephemeral });
    return;
  }
  if (step === 'back') {
    await interaction.update({ ...callerPanel(config, ping), allowedMentions: { parse: [] } });
    return;
  }
  // Solo antes de salir: en ruta o terminada ya no tiene sentido mover la hora
  if (ping.status !== 'OPEN') {
    await interaction.update({ ...callerPanel(config, ping, '⚠️ La hora solo se puede cambiar mientras el ping está abierto.'), allowedMentions: { parse: [] } });
    return;
  }

  const num = (v: string | undefined, max: number) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 && n <= max ? n : null;
  };
  const current = draftSlotFromUnix(ping.startTimeUnix);
  let slot = current;
  if (step === 'h' && interaction.isStringSelectMenu()) slot = { hour: num(interaction.values[0], 23) ?? current.hour, minute: num(a, 59) ?? current.minute };
  if (step === 'm' && interaction.isStringSelectMenu()) slot = { hour: num(a, 23) ?? current.hour, minute: num(interaction.values[0], 59) ?? current.minute };

  if (step !== 'ok') {
    await interaction.update({ ...callerTimePanel(config, ping, slot), allowedMentions: { parse: [] } });
    return;
  }

  const hour = num(a, 23);
  const minute = num(b, 59);
  if (hour === null || minute === null) {
    await interaction.update({ ...callerTimePanel(config, ping, current), allowedMentions: { parse: [] } });
    return;
  }
  const before = ping.startTimeUnix;
  ping.startTimeUnix = nextUtcStartUnix({ hour, minute });
  ping.timeLabel = formatUtc({ hour, minute });
  ConfigManager.savePing(config.guildId, ping);
  console.log(`⏰ [${config.guildId}] Ping ${ping.id} "${ping.title}": hora cambiada a ${ping.timeLabel} por ${displayNameOf(interaction)}`);

  // Primero se responde (Discord da 3 s) y después se rehace el mensaje del ping, que tarda más
  await interaction.update({
    ...callerPanel(config, ping, `✅ Salida movida a **${ping.timeLabel}** (<t:${ping.startTimeUnix}:R>).`),
    allowedMentions: { parse: [] },
  });
  await refreshActivePingMessage(interaction, config, ping);

  // Aviso en el hilo, sin mencionar a nadie: quien sigue el hilo ya recibe la notificación
  if (ping.threadId) {
    const thread = await interaction.guild?.channels.fetch(ping.threadId).catch(() => null);
    if (thread?.isThread()) {
      if (thread.archived) await thread.setArchived(false).catch(() => null);
      await thread
        .send({
          content: `⏰ El Caller cambió la hora de salida: **${ping.timeLabel}** · <t:${ping.startTimeUnix}:t> (<t:${ping.startTimeUnix}:R>). Antes era <t:${before}:t>.`,
          allowedMentions: { parse: [] },
        })
        .catch(() => null);
    }
  }
}

// Pings que creó este usuario: abiertos, o terminados con puntos por repartir. Solo los suyos,
// aunque sea oficial: los oficiales gestionan los de otros desde el panel web.
function commandablePings(interaction: ChatInputCommandInteraction, config: GuildConfig): ActivePing[] {
  return Object.values(ConfigManager.getActivePings(config.guildId))
    .filter((p) => p.status === 'OPEN' || p.status === 'IN_PROGRESS' || (p.status === 'CLOSED' && finishedButtons(config, p).length > 0))
    .filter((p) => p.callerId === interaction.user.id)
    .sort((a, b) => Number(isPingFinished(a)) - Number(isPingFinished(b)) || b.createdAt - a.createdAt)
    .slice(0, 25);
}

// /mando: abre el Mando del Caller, o un selector si tiene varios pings.
async function handleMandoCommand(interaction: ChatInputCommandInteraction, config: GuildConfig) {
  const pings = commandablePings(interaction, config);
  if (pings.length === 0) {
    await interaction.reply({ content: 'No tienes pings abiertos ni puntos o loot por repartir.', flags: MessageFlags.Ephemeral });
    return;
  }
  if (pings.length === 1) {
    await interaction.reply({ ...callerPanel(config, pings[0]), flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    return;
  }
  const status = (p: ActivePing) => (p.status === 'CLOSED' ? 'Terminado · puntos' : p.status === 'IN_PROGRESS' ? 'En ruta' : 'Abierto');
  const select = new StringSelectMenuBuilder()
    .setCustomId('mando_select')
    .setPlaceholder('Elige la salida')
    .addOptions(
      pings.map((p) => ({
        label: p.title.slice(0, 100),
        value: p.id,
        description: `${status(p)} · ${p.contentName}${p.timeLabel ? ` · ${p.timeLabel}` : ''}`.slice(0, 100),
      }))
    );
  await interaction.reply({
    content: '👑 ¿Qué salida quieres mandar?',
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
    flags: MessageFlags.Ephemeral,
  });
}

// Botones del ping publicado: Arma/IP, Bajarme, Builds y, en pings antiguos, el Mando.
async function handlePingActionButtons(interaction: ButtonInteraction, config: GuildConfig, displayName: string) {
  const [action, pingId] = interaction.customId.split(':');
  const ping = ConfigManager.getPing(config.guildId, pingId);

  if (!ping) {
    await interaction.reply({ content: '⚠️ Este ping ya no está activo.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (action === 'ping_btn_builds') {
    if (takeCooldown(`builds:${interaction.user.id}`, 3000) > 0) {
      await interaction.reply({ content: '⏳ Un momento…', flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const card = await generateBuildCard(ping.title, ping.roles).catch(() => null);
    await interaction.editReply(
      card
        ? { files: [new AttachmentBuilder(card, { name: 'builds.png' })] }
        : { content: 'Esta salida no tiene builds definidas.' }
    );
    return;
  }

  // Botón de los pings publicados antes de que el Mando pasara a ser privado.
  if (action === 'ping_btn_caller') {
    if (!canCommandPing(interaction, ping)) {
      await interaction.reply({
        content: `⛔ Solo el Caller (<@${ping.callerId}>) o un Oficial puede tocar esto.`,
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
      });
      return;
    }
    await interaction.reply({ ...callerPanel(config, ping), flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    return;
  }

  if (isPingFinished(ping)) {
    await interaction.reply({ content: '🔒 Esta salida ya terminó.', flags: MessageFlags.Ephemeral });
    return;
  }

  if ((action === 'ping_btn_flex' || action === 'ping_btn_leave') && takeCooldown(`roster:${interaction.user.id}`, COOLDOWNS.rosterAction) > 0) {
    await interaction.reply({ content: '⏳ Despacio, vuelve a intentarlo en un segundo.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (action === 'ping_btn_flex') {
    const prevWeapon = removeUserFromPing(ping, interaction.user.id);
    ping.bench.push({
      userId: interaction.user.id,
      username: interaction.user.username,
      displayName,
      joinedAt: Date.now(),
      customWeapon: prevWeapon || 'Flex / Cualquier Rol',
    });
    ConfigManager.savePing(config.guildId, ping);
    await refreshActivePingMessage(interaction, config, ping);
    return;
  }

  if (action === 'ping_btn_leave') {
    removeUserFromPing(ping, interaction.user.id);
    ping.absent.push({
      userId: interaction.user.id,
      username: interaction.user.username,
      displayName,
      joinedAt: Date.now(),
    });
    ConfigManager.savePing(config.guildId, ping);
    await refreshActivePingMessage(interaction, config, ping);
    return;
  }

  if (action === 'ping_btn_weapon') {
    const modal = new ModalBuilder().setCustomId(`ping_modal_weapon:${ping.id}`).setTitle('Arma e IP');
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('input_weapon_note')
          .setLabel('¿Qué arma e IP llevas?')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ej: Maza íncubo 1500 IP / Santificador 8.2')
          .setMaxLength(45)
          .setRequired(true)
      )
    );
    await interaction.showModal(modal);
  }
}

// Acciones del Mando: En ruta, ¡A voz!, GG y Cancelar.
async function handleCallerStatusAction(interaction: ButtonInteraction, config: GuildConfig) {
  const [, subAction, pingId] = interaction.customId.split(':');
  const ping = ConfigManager.getPing(config.guildId, pingId);

  if (!ping) {
    await interaction.update({ content: '⚠️ Ping no encontrado.', components: [] });
    return;
  }

  // Se vuelven a comprobar los permisos: el customId del Mando no es secreto.
  const isCaller = interaction.user.id === ping.callerId;
  const isOfficer = interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels);
  if (!isCaller && !isOfficer) {
    await interaction.reply({ content: '⛔ No eres el Caller de esta salida.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (subAction === 'notify_voice') {
    if (isPingFinished(ping)) {
      await interaction.update({ ...callerPanel(config, ping), allowedMentions: { parse: [] } });
      return;
    }
    const wait = takeCooldown(`notify:${ping.id}`, COOLDOWNS.notifyVoice);
    if (wait > 0) {
      await interaction.update({ ...callerPanel(config, ping, `⏳ Ya llamaste a voz hace poco. Espera ${wait} s.`), allowedMentions: { parse: [] } });
      return;
    }
    const allUserIds = new Set<string>();
    for (const list of Object.values(ping.roster)) for (const u of list) allUserIds.add(u.userId);
    for (const u of ping.bench) allUserIds.add(u.userId);

    if (allUserIds.size === 0) {
      await interaction.update({ ...callerPanel(config, ping, '⚠️ Todavía no se anotó nadie para taggear.'), allowedMentions: { parse: [] } });
      return;
    }

    // En el hilo del ping para no saturar el canal; si no hay hilo o falla, en el canal del ping.
    // Nunca en interaction.channel: el Mando es privado y puede estar abierto en otro canal (/mando).
    const ids = Array.from(allUserIds);
    const voiceText = ping.voiceChannelId ? ` al canal de voz <#${ping.voiceChannelId}>` : ' a voz';
    const message = {
      content: `🎺 **¡A VOZ TODO EL MUNDO — ${ping.title.toUpperCase()}!**\nEl Caller <@${ping.callerId}> los quiere YA en${voiceText} y montados en \`${ping.departureLocation}\`:\n${ids.map((id) => `<@${id}>`).join(' ')}`,
      allowedMentions: { users: ids.slice(0, 100) },
    };
    const sendTo = async (channelId: string | undefined) => {
      if (!channelId) return false;
      const ch = await interaction.guild?.channels.fetch(channelId).catch(() => null);
      if (!ch || !ch.isTextBased() || !('send' in ch)) return false;
      // Un hilo archivado se reabre al escribir, salvo que esté bloqueado.
      if (ch.isThread() && ch.archived) await ch.setArchived(false).catch(() => null);
      return ch
        .send(message)
        .then(() => true)
        .catch(() => false);
    };
    const where = (await sendTo(ping.threadId)) ? ping.threadId : (await sendTo(ping.channelId)) ? ping.channelId : null;
    await interaction.update({
      ...callerPanel(
        config,
        ping,
        where ? `✅ Taggeé a toda la party en <#${where}> para que entren a voz.` : `❌ No pude escribir en <#${ping.channelId}>.`
      ),
      allowedMentions: { parse: [] },
    });
    return;
  }

  if (subAction === 'in_progress') {
    if (!isPingFinished(ping)) {
      ping.status = 'IN_PROGRESS';
      ConfigManager.savePing(config.guildId, ping);
    }
    await interaction.update({ ...callerPanel(config, ping, isPingFinished(ping) ? undefined : '⚔️ Party marcada como **EN RUTA**.'), allowedMentions: { parse: [] } });
    await refreshActivePingMessage(interaction, config, ping);
    return;
  }

  if (subAction === 'close' || subAction === 'cancel') {
    // Se pulsó un Mando antiguo y la salida ya está cerrada.
    if (isPingFinished(ping)) {
      await interaction.update({ ...callerPanel(config, ping), allowedMentions: { parse: [] } });
      return;
    }
    ping.status = subAction === 'close' ? 'CLOSED' : 'CANCELLED';
    ping.closedAt = Date.now();
    // Quién lo cerró queda en el ping, en el registro de auditoría de Discord y en los logs.
    const who = displayNameOf(interaction);
    const role = interaction.user.id === ping.callerId ? 'Caller' : 'oficial';
    ping.closedBy = interaction.user.id;
    ping.closedByName = who;
    ping.closedVia = 'discord';
    const action = subAction === 'close' ? 'GG' : 'Salida cancelada';
    const reason = `${action} por ${who} (${role}, ${interaction.user.id})`.slice(0, 500);

    ConfigManager.savePing(config.guildId, ping);
    console.log(`🔒 [${config.guildId}] Ping ${ping.id} "${ping.title}": ${reason}`);
    const btns = finishedButtons(config, ping);
    // Se responde antes de borrar la voz y el hilo: si el Mando se abrió dentro de alguno de los
    // dos, su mensaje desaparece con él y editarlo después daría "Unknown Message".
    await interaction.update({
      content:
        subAction === 'close'
          ? `🔒 **¡GG!** Salida terminada; borré la voz y el hilo.${btns.length ? '\nAhora reparte los puntos y el loot de los que fueron:' : ''}`
          : '🔴 Salida cancelada (F); borré el ping, la voz y el hilo.',
      embeds: [],
      components: btns.length ? [new ActionRowBuilder<ButtonBuilder>().addComponents(btns)] : [],
    });
    if (interaction.guild) await cleanupPingChannels(interaction.guild, ping, reason);
    // cleanupPingChannels puede cambiar el ping (p. ej. quitar los ids borrados): se guarda otra vez.
    ConfigManager.savePing(config.guildId, ping);
    // Cancelada: no hay puntos que repartir y el mensaje se borra ya.
    if (subAction === 'cancel' && interaction.guild) await deletePingMessage(interaction.guild, ping);
    else await refreshActivePingMessage(interaction, config, ping);
  }
}

// Formularios: detalles del asistente, roles personalizados, Arma/IP y los de versiones anteriores.
async function handleModalSubmissions(interaction: ModalSubmitInteraction, config: GuildConfig, displayName: string) {
  const { customId } = interaction;

  if (customId.startsWith('compo_')) {
    await handleCompoInteraction(interaction, config);
    return;
  }

  const replyWizard = async (draft: DraftPingSession) => {
    if (interaction.isFromMessage()) await interaction.update(buildWizardStepMessage(draft, config));
    else await interaction.reply({ ...buildWizardStepMessage(draft, config), flags: MessageFlags.Ephemeral });
  };

  // 1. Detalles del asistente.
  if (customId === 'wizard_modal_details') {
    if (!canCreatePings(interaction, config)) {
      await interaction.reply({ content: NO_CALLER_PERMS, flags: MessageFlags.Ephemeral });
      return;
    }
    const draft = getOrInitDraft(config, interaction.user.id, displayName);
    draft.title = cleanUserText(interaction.fields.getTextInputValue('input_title'), 80) || draft.title;
    draft.departureLocation = cleanUserText(interaction.fields.getTextInputValue('input_location'), 100);
    draft.gearTier = cleanUserText(interaction.fields.getTextInputValue('input_tier'), 100);
    draft.mountRequired = cleanUserText(interaction.fields.getTextInputValue('input_mount'), 100);
    draft.notes = cleanUserText(interaction.fields.getTextInputValue('input_notes'), 800);
    ConfigManager.setDraft(config.guildId, interaction.user.id, draft);
    await replyWizard(draft);
    return;
  }

  // 2. Roles personalizados para este ping.
  if (customId === 'wizard_modal_custom_roles') {
    if (!canCreatePings(interaction, config)) {
      await interaction.reply({ content: NO_CALLER_PERMS, flags: MessageFlags.Ephemeral });
      return;
    }
    const parsedRoles = parseRolesText(interaction.fields.getTextInputValue('input_roles_lines'));
    if (parsedRoles.length === 0) {
      await interaction.reply({ content: '❌ No leí ningún rol válido. Formato: `Emoji | Nombre | Cupos`.', flags: MessageFlags.Ephemeral });
      return;
    }
    const draft = getOrInitDraft(config, interaction.user.id, displayName);
    draft.customRoles = parsedRoles;
    ConfigManager.setDraft(config.guildId, interaction.user.id, draft);
    await replyWizard(draft);
    return;
  }

  // 3. Formularios de plantillas de versiones anteriores: ahora se gestionan en el panel web.
  if (customId.startsWith('tpl_modal_')) {
    await interaction.reply({ ...movedToPanelReply(config.guildId), flags: MessageFlags.Ephemeral });
    return;
  }

  // 4. Arma o IP que indica el jugador.
  if (customId.startsWith('ping_modal_weapon:')) {
    const pingId = customId.split(':')[1];
    const weaponNote = cleanPlayerText(interaction.fields.getTextInputValue('input_weapon_note'), 45);
    if (!weaponNote) {
      await interaction.reply({ content: '❌ Escribe tu arma o IP.', flags: MessageFlags.Ephemeral });
      return;
    }
    const ping = ConfigManager.getPing(config.guildId, pingId);

    if (!ping || isPingFinished(ping)) {
      await interaction.reply({ content: '⚠️ Este ping ya no está activo.', flags: MessageFlags.Ephemeral });
      return;
    }

    let found = false;
    for (const list of Object.values(ping.roster)) {
      const entry = list.find((u) => u.userId === interaction.user.id);
      if (entry) {
        entry.customWeapon = weaponNote;
        found = true;
      }
    }
    const benchEntry = ping.bench.find((u) => u.userId === interaction.user.id);
    if (benchEntry) {
      benchEntry.customWeapon = weaponNote;
      found = true;
    }
    if (!found) {
      ping.absent = ping.absent.filter((u) => u.userId !== interaction.user.id);
      ping.bench.push({
        userId: interaction.user.id,
        username: interaction.user.username,
        displayName,
        joinedAt: Date.now(),
        customWeapon: weaponNote,
      });
    }

    ConfigManager.savePing(config.guildId, ping);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await refreshActivePingMessage(interaction, config, ping);
    await interaction.editReply({
      content: found
        ? `🗡️ Tu arma/IP (**${weaponNote}**) quedó registrada en el roster.`
        : `🗡️ Te anoté en **Banca** con **${weaponNote}**. Elige rol en el menú si quieres un puesto fijo.`,
    });
  }
}
