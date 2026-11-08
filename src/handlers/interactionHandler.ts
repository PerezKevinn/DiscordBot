import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  Interaction,
  MessageMentionOptions,
  ModalBuilder,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} from 'discord.js';
import { ActivePing, ContentTypeConfig, DraftPingSession, GuildConfig, MentionType } from '../types/ping';
import { ConfigManager } from '../utils/configManager';
import {
  buildDetailsModal,
  buildFixedCallerPanel,
  buildWizardStepMessage,
  resolvePingRoleId,
} from '../utils/panelBuilder';
import { buildPingMessagePayload } from '../utils/pingBuilder';
import { cleanupPingChannels } from '../utils/pingSweeper';
import { getLimits, PREMIUM_UPSELL } from '../utils/plans';
import { baseEmbed, fitEmbed, formatCompoInline, hexToInt, splitRoleLabel, UI_COLORS } from '../utils/ui';
import { cleanPlayerText, cleanUserText, clearCooldown, COOLDOWNS, takeCooldown } from '../utils/security';
import { canCreatePings, canMentionEveryone, displayNameOf, isGuildManager } from '../utils/permissions';
import { handleCompoInteraction, openDraftCompoEditor, openTemplateCompoEditor, parseRolesText } from './compoEditor';
import { handleConfigAutocomplete, handleConfigCommand, handlePlanAdminCommand, handlePlanCommand } from './configCommands';

const NO_CALLER_PERMS = '⛔ Solo los Callers (o admins) pueden tirar pings en este servidor.';
const NO_ADMIN_PERMS = '⛔ Necesitas el permiso **Gestionar servidor** para hacer esto.';

function defaultMentionFor(config: GuildConfig, contentTypeId: string): MentionType {
  return resolvePingRoleId(config, contentTypeId) ? 'ROLE' : 'NONE';
}

/**
 * Inicializa o recupera el borrador de un Caller en un servidor
 */
function getOrInitDraft(
  config: GuildConfig,
  userId: string,
  username: string,
  avatarUrl?: string
): DraftPingSession {
  let draft = ConfigManager.getDraft(config.guildId, userId);
  if (!draft) {
    const firstContent = config.contentTypes[0];
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
      minutesFromNow: 15,
      startTimeUnix: Math.floor(Date.now() / 1000) + 15 * 60,
      timeLabel: 'En 15 minutos',
      notes: '',
      targetChannelId: config.pingTargetChannelId,
      mentionType: defaultMentionFor(config, firstContent.id),
      createThread: true,
      createVoice: true,
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

/**
 * Actualiza el mensaje original de un Ping activo en Discord tras un cambio de Roster o Estado
 */
async function refreshActivePingMessage(interaction: Interaction, config: GuildConfig, ping: ActivePing) {
  const contentConfig = ConfigManager.getContentType(config.guildId, ping.contentTypeId) || fallbackContentConfig(ping);
  // Si alguien borró a mano la voz temporal, no la seguimos enlazando
  if (ping.voiceChannelId && interaction.guild && !interaction.guild.channels.cache.has(ping.voiceChannelId)) {
    ping.voiceChannelId = undefined;
    ConfigManager.savePing(config.guildId, ping);
  }

  const payload = await buildPingMessagePayload(ping, contentConfig, config);

  // Si la interacción viene del propio mensaje del ping, lo actualizamos directamente
  if (interaction.isMessageComponent() && interaction.message.id === ping.messageId) {
    await interaction.update(payload);
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

/**
 * Remueve a un jugador de todos los slots del Roster, Banca y Ausentes de un Ping
 */
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

export async function handleInteraction(interaction: Interaction) {
  try {
    if (interaction.isAutocomplete()) {
      await handleConfigAutocomplete(interaction);
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
    const displayName = displayNameOf(interaction);

    // 1. Slash Commands
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;

      if (commandName === 'config') return handleConfigCommand(interaction, config);
      if (commandName === 'plan') return handlePlanCommand(interaction, config);
      if (commandName === 'plan-admin') return handlePlanAdminCommand(interaction);

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

    // 2. Botones
    if (interaction.isButton()) {
      const { customId } = interaction;

      // --- Botones de un Ping Publicado (los usa cualquier jugador) ---
      if (customId.startsWith('ping_btn_')) {
        await handlePingActionButtons(interaction, config, displayName);
        return;
      }
      if (customId.startsWith('caller_action:')) {
        await handleCallerStatusAction(interaction, config);
        return;
      }

      // --- Editor visual de compo (permisos según lo que se edite) ---
      if (customId.startsWith('compo_')) {
        await handleCompoInteraction(interaction, config);
        return;
      }

      // --- Panel: Recargar (inofensivo, cualquiera) ---
      if (customId === 'panel_refresh') {
        await interaction.update(buildFixedCallerPanel(config));
        return;
      }

      // --- Panel / Plantillas: solo admins ---
      if (customId === 'panel_manage_templates' || customId.startsWith('tpl_')) {
        if (!isGuildManager(interaction)) {
          await interaction.reply({ content: NO_ADMIN_PERMS, flags: MessageFlags.Ephemeral });
          return;
        }
        if (customId === 'panel_manage_templates') {
          await showTemplateManagerMenu(interaction, config);
          return;
        }
        if (customId === 'tpl_btn_create_new') {
          if (config.contentTypes.length >= getLimits(config).maxContentTypes) {
            await interaction.reply({
              content: `⚠️ Llegaste al límite de **${getLimits(config).maxContentTypes} plantillas** de tu plan. Borra alguna primero.\n${PREMIUM_UPSELL}`,
              flags: MessageFlags.Ephemeral,
            });
            return;
          }
          await interaction.showModal(buildCreateTemplateModal());
          return;
        }
      }

      // --- Todo lo demás es del asistente de creación: requiere ser Caller ---
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
      const content = ConfigManager.getContentType(config.guildId, draft.contentTypeId) || config.contentTypes[0];

      if (customId === 'wizard_btn_edit_details') {
        await interaction.showModal(buildDetailsModal(draft, content));
        return;
      }

      if (customId === 'wizard_btn_edit_roles') {
        await openDraftCompoEditor(interaction, config);
        return;
      }

      if (customId === 'wizard_btn_cycle_mention') {
        const order: MentionType[] = ['ROLE'];
        if (canMentionEveryone(interaction)) order.push('HERE', 'EVERYONE');
        order.push('NONE');
        const nextIdx = (order.indexOf(draft.mentionType) + 1) % order.length;
        draft.mentionType = order[nextIdx];
        ConfigManager.setDraft(config.guildId, interaction.user.id, draft);
        await interaction.update(buildWizardStepMessage(draft, config));
        return;
      }

      if (customId === 'wizard_btn_toggle_extras') {
        // Ciclo: Voz+Hilo -> solo Hilo -> solo Voz -> nada
        if (draft.createVoice && draft.createThread) {
          draft.createVoice = false;
        } else if (!draft.createVoice && draft.createThread) {
          draft.createVoice = true;
          draft.createThread = false;
        } else if (draft.createVoice && !draft.createThread) {
          draft.createVoice = false;
        } else {
          draft.createVoice = true;
          draft.createThread = true;
        }
        ConfigManager.setDraft(config.guildId, interaction.user.id, draft);
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

    // 3. Menús desplegables
    if (interaction.isStringSelectMenu()) {
      const { customId, values } = interaction;

      if (customId.startsWith('compo_')) {
        await handleCompoInteraction(interaction, config);
        return;
      }

      // --- Ping Publicado: Jugador elige su Rol ---
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
        const isFull = roleObj.maxSlots > 0 && currentList.length >= roleObj.maxSlots;
        const entry = {
          userId: interaction.user.id,
          username: interaction.user.username,
          displayName,
          joinedAt: Date.now(),
        };

        if (isFull) {
          // Rol lleno: va a Banca con nota del rol que quería
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

      // --- Plantillas (solo admins) ---
      if (customId.startsWith('tpl_')) {
        if (!isGuildManager(interaction)) {
          await interaction.reply({ content: NO_ADMIN_PERMS, flags: MessageFlags.Ephemeral });
          return;
        }
        const contentId = values[0];

        if (customId === 'tpl_select_edit_roles') {
          await openTemplateCompoEditor(interaction, config, contentId);
          return;
        }

        if (customId === 'tpl_select_delete') {
          if (config.contentTypes.length <= 1) {
            await interaction.reply({ content: '⚠️ Debe existir al menos 1 plantilla.', flags: MessageFlags.Ephemeral });
            return;
          }
          const deleted = ConfigManager.deleteContentType(config.guildId, contentId);
          await interaction.update({
            content: deleted
              ? `✅ Plantilla \`${contentId}\` eliminada. Dale a **Recargar Panel** para verlo en el canal.`
              : '❌ No se encontró la plantilla.',
            embeds: [],
            components: [],
          });
          return;
        }
      }

      // --- Asistente (solo Callers) ---
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
          // Al cambiar de contenido, sugerimos avisar a su rol si tiene uno
          if (draft.mentionType === 'ROLE' || draft.mentionType === 'NONE') {
            draft.mentionType = defaultMentionFor(config, selected.id);
          }
        }

        if (customId === 'wizard_select_time') {
          const minutes = parseInt(values[0], 10);
          draft.minutesFromNow = minutes;
          draft.startTimeUnix = Math.floor(Date.now() / 1000) + minutes * 60;
          draft.timeLabel = minutes <= 2 ? '¡SALIMOS YA MISMO!' : `En ${minutes} minutos`;
        }

        ConfigManager.setDraft(config.guildId, interaction.user.id, draft);
        await interaction.update(buildWizardStepMessage(draft, config));
        return;
      }
    }

    // 4. Selector de canal destino en el asistente
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

    // 5. Formularios (Modals)
    if (interaction.isModalSubmit()) {
      await handleModalSubmissions(interaction, config, displayName);
      return;
    }
  } catch (err) {
    console.error('[Error en Interacción]:', err);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction
        .reply({ content: '⚠️ Ocurrió un error procesando esta acción. Inténtalo de nuevo.', flags: MessageFlags.Ephemeral })
        .catch(() => null);
    }
  }
}

export function buildCreateTemplateModal(): ModalBuilder {
  const field = (id: string, label: string, style: TextInputStyle, value: string) =>
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setValue(value).setRequired(true)
    );

  return new ModalBuilder()
    .setCustomId('tpl_modal_create_content')
    .setTitle('Nuevo Tipo de Contenido')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('tpl_name')
          .setLabel('Nombre (Ej: Cristales 5v5, Abismo)')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(60)
          .setRequired(true)
      ),
      field('tpl_emoji', 'Emoji', TextInputStyle.Short, '🔥'),
      field('tpl_subtitle', 'Subtítulo del banner', TextInputStyle.Short, 'OBJETIVO DEL GREMIO'),
      field('tpl_defaults', 'Tier | Montura | Salida (separados con |)', TextInputStyle.Short, 'Equivalente T8 | Garrapresta | Escondite (HO)'),
      field(
        'tpl_roles',
        'Roles: emoji Nombre xCupos: armas',
        TextInputStyle.Paragraph,
        '🛡️ Tanque x1: Maza íncubo / Maza\n💚 Sanador x2: Bastón sagrado\n🔮 Soporte x1\n🗡️ Daño x6'
      )
    );
}

/**
 * Panel efímero para que los admins editen plantillas de Contenidos y Roles
 */
async function showTemplateManagerMenu(interaction: ButtonInteraction, config: GuildConfig) {
  const limits = getLimits(config);
  const embed = baseEmbed(config, 'Contenidos y roles')
    .setTitle('⚙️ Contenidos y roles')
    .setDescription(
      [
        `Tienes **${config.contentTypes.length} de ${limits.maxContentTypes}** contenidos.`,
        'Edita la compo de uno, crea otro nuevo o borra los que no uses.',
        '-# El rol al que avisa cada contenido se cambia con `/config rol-ping`.',
      ].join('\n')
    );

  for (const c of config.contentTypes.slice(0, 24)) {
    const roleId = config.pingRoles[c.id];
    embed.addFields({
      name: `${c.emoji} ${c.name}`.slice(0, 256),
      value: [
        ...c.roles.map((r) => `${r.emoji} ${splitRoleLabel(r.label).name} ×${r.maxSlots || '∞'}`),
        `-# ${roleId ? `avisa a <@&${roleId}>` : 'sin rol de aviso'} · \`${c.id}\``,
      ]
        .join('\n')
        .slice(0, 1024),
      inline: true,
    });
  }

  const editRolesSelect = new StringSelectMenuBuilder()
    .setCustomId('tpl_select_edit_roles')
    .setPlaceholder('👥 Editar la compo de un contenido...');
  const deleteSelect = new StringSelectMenuBuilder()
    .setCustomId('tpl_select_delete')
    .setPlaceholder('🗑️ Borrar un contenido...');

  for (const c of config.contentTypes.slice(0, 25)) {
    const optEdit = new StringSelectMenuOptionBuilder()
      .setLabel(c.name.slice(0, 100))
      .setValue(c.id)
      .setDescription(formatCompoInline(c.roles).slice(0, 100));
    const optDel = new StringSelectMenuOptionBuilder().setLabel(c.name.slice(0, 100)).setValue(c.id);
    if (c.emoji) {
      optEdit.setEmoji(c.emoji);
      optDel.setEmoji(c.emoji);
    }
    editRolesSelect.addOptions(optEdit);
    deleteSelect.addOptions(optDel);
  }

  const btnCreateNew = new ButtonBuilder()
    .setCustomId('tpl_btn_create_new')
    .setLabel('Nuevo contenido')
    .setEmoji('➕')
    .setStyle(ButtonStyle.Success);

  await interaction.reply({
    embeds: [fitEmbed(embed)],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(editRolesSelect),
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(deleteSelect),
      new ActionRowBuilder<ButtonBuilder>().addComponents(btnCreateNew),
    ],
    flags: MessageFlags.Ephemeral,
  });
}

/**
 * Arma el texto de mención y qué menciones permite Discord (para no taggear de más).
 */
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

/**
 * Publica el Ping con banner, embed, hilo y voz temporal
 */
async function launchOfficialPing(interaction: ButtonInteraction, config: GuildConfig, callerDisplayName: string) {
  const limits = getLimits(config);
  if (ConfigManager.countOpenPings(config.guildId) >= limits.maxActivePings) {
    await interaction.reply({
      content: `⚠️ Ya hay **${limits.maxActivePings} pings abiertos** en este servidor (límite de tu plan). Cierra alguno con **Mando Caller → GG** antes de tirar otro.\n${PREMIUM_UPSELL}`,
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

  const pingId = `${Date.now().toString(36).toUpperCase()}`;
  const rolesToUse = draft.customRoles || contentConfig.roles;
  const initialRoster: ActivePing['roster'] = {};
  for (const r of rolesToUse) initialRoster[r.id] = [];

  const minutes = draft.minutesFromNow || 15;
  const startTimeUnix = Math.floor(Date.now() / 1000) + minutes * 60;

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
    timeLabel: draft.timeLabel || `En ${minutes} minutos`,
    notes: draft.notes || '',
    roles: rolesToUse,
    roster: initialRoster,
    bench: [],
    absent: [],
    status: 'OPEN',
    createdAt: Date.now(),
  };

  // 1. Canal de texto destino
  let targetChannel: TextChannel | null = null;
  if (interaction.guild) {
    const ch = await interaction.guild.channels.fetch(newPing.channelId).catch(() => null);
    if (ch && (ch.type === ChannelType.GuildText || ch.type === ChannelType.GuildAnnouncement)) {
      targetChannel = ch as TextChannel;
    }
  }
  const fail = async (content: string) => {
    // No consumir el cooldown si no se llegó a publicar
    clearCooldown(`publish:${config.guildId}:${interaction.user.id}`);
    await interaction.editReply({ content, embeds: [], components: [] });
  };
  if (!targetChannel || !interaction.guild) {
    await fail('❌ Ese canal no sirve para pings. Elige un canal de texto o de anuncios.');
    return;
  }

  // Seguridad: el Caller debe poder escribir en ese canal. Si no, el bot publicaría por él
  // en canales donde no tiene permiso (p. ej. #anuncios).
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

  // 2. Canal de voz temporal
  if (draft.createVoice && interaction.guild) {
    try {
      const voiceChannel = await interaction.guild.channels.create({
        name: `${contentConfig.emoji}︱${newPing.title.slice(0, 22)} (${callerDisplayName.slice(0, 12)})`,
        type: ChannelType.GuildVoice,
        parent: config.voiceCategoryId || undefined,
        reason: `Voz temporal para el ping ${newPing.title} de ${callerDisplayName}`,
      });
      newPing.voiceChannelId = voiceChannel.id;
    } catch (err) {
      console.warn(`[${config.guildId}] No se pudo crear la voz temporal (¿falta Gestionar canales?):`, (err as Error).message);
    }
  }

  // 3. Mensaje del ping
  const messagePayload = await buildPingMessagePayload(newPing, contentConfig, config);
  const mention = buildMention(draft, config, newPing.title, canMentionEveryone(interaction));

  const sentMsg = await targetChannel.send({
    content: mention.content,
    allowedMentions: mention.allowedMentions,
    ...messagePayload,
  });
  newPing.messageId = sentMsg.id;

  // 4. Hilo de builds/swaps
  if (draft.createThread) {
    try {
      const thread = await sentMsg.startThread({
        name: `⚔️ ${newPing.title.slice(0, 50)} — ${callerDisplayName}`.slice(0, 100),
        autoArchiveDuration: 60,
        reason: 'Hilo de builds, swaps y coordinación de la party',
      });
      newPing.threadId = thread.id;

      await thread.send({
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

  await interaction.editReply({
    content: '',
    embeds: [
      baseEmbed(config, 'Nuevo ping')
        .setColor(UI_COLORS.success)
        .setTitle('✅ Ping publicado')
        .setDescription(`${contentConfig.emoji} **${newPing.title}** en <#${newPing.channelId}>\n[Ir al ping](${sentMsg.url})`),
    ],
    components: [],
  });
}

/**
 * Botones bajo un Ping activo: Arma/IP, Bajarme, Mando Caller
 */
async function handlePingActionButtons(interaction: ButtonInteraction, config: GuildConfig, displayName: string) {
  const [action, pingId] = interaction.customId.split(':');
  const ping = ConfigManager.getPing(config.guildId, pingId);

  if (!ping) {
    await interaction.reply({ content: '⚠️ Este ping ya no está activo.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (action === 'ping_btn_caller') {
    const isCaller = interaction.user.id === ping.callerId;
    const isOfficer = interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels);
    if (!isCaller && !isOfficer) {
      await interaction.reply({
        content: `⛔ Solo el Caller (<@${ping.callerId}>) o un Oficial puede tocar esto.`,
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
      });
      return;
    }

    const joined = Object.values(ping.roster).reduce((acc, l) => acc + l.length, 0);
    const max = ping.roles.reduce((acc, r) => acc + (r.maxSlots || 0), 0);
    const embed = baseEmbed(config, 'Mando del Caller')
      .setTitle(`👑 ${ping.title}`.slice(0, 256))
      .setDescription(
        [
          `👥 **${joined}${max ? `/${max}` : ''}** anotados · ${ping.bench.length} en banca`,
          `⏰ Salida <t:${ping.startTimeUnix}:R>`,
          '',
          '**En ruta:** marca que ya salieron',
          '**¡A voz!:** menciona a todos los anotados',
          '**GG / Cancelar:** cierra el ping y borra voz e hilo',
        ].join('\n')
      );
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`caller_action:in_progress:${ping.id}`).setLabel('En ruta').setEmoji('⚔️').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`caller_action:notify_voice:${ping.id}`).setLabel('¡A voz!').setEmoji('📢').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`caller_action:close:${ping.id}`).setLabel('GG').setEmoji('🔒').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`caller_action:cancel:${ping.id}`).setLabel('Cancelar').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
    );
    await interaction.reply({ embeds: [fitEmbed(embed)], components: [row], flags: MessageFlags.Ephemeral });
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

/**
 * Acciones del Caller sobre un Ping: En Ruta, Llamar a Voz, Terminar, Cancelar
 */
async function handleCallerStatusAction(interaction: ButtonInteraction, config: GuildConfig) {
  const [, subAction, pingId] = interaction.customId.split(':');
  const ping = ConfigManager.getPing(config.guildId, pingId);

  if (!ping) {
    await interaction.update({ content: '⚠️ Ping no encontrado.', components: [] });
    return;
  }

  // Re-chequeo de permisos (el mensaje efímero podría reenviarse)
  const isCaller = interaction.user.id === ping.callerId;
  const isOfficer = interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels);
  if (!isCaller && !isOfficer) {
    await interaction.reply({ content: '⛔ No eres el Caller de esta salida.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (subAction === 'notify_voice') {
    const wait = takeCooldown(`notify:${ping.id}`, COOLDOWNS.notifyVoice);
    if (wait > 0) {
      await interaction.update({ content: `⏳ Ya llamaste a voz hace poco. Espera ${wait} s.`, embeds: [], components: [] });
      return;
    }
    const allUserIds = new Set<string>();
    for (const list of Object.values(ping.roster)) for (const u of list) allUserIds.add(u.userId);
    for (const u of ping.bench) allUserIds.add(u.userId);

    if (allUserIds.size === 0) {
      await interaction.update({ content: '⚠️ Todavía no se anotó nadie para taggear.', components: [] });
      return;
    }

    const ids = Array.from(allUserIds);
    const voiceText = ping.voiceChannelId ? ` al canal de voz <#${ping.voiceChannelId}>` : ' a voz';
    if (interaction.channel && 'send' in interaction.channel) {
      await interaction.channel.send({
        content: `🎺 **¡A VOZ TODO EL MUNDO — ${ping.title.toUpperCase()}!**\nEl Caller <@${ping.callerId}> los quiere YA en${voiceText} y montados en \`${ping.departureLocation}\`:\n${ids.map((id) => `<@${id}>`).join(' ')}`,
        allowedMentions: { users: ids.slice(0, 100) },
      });
    }
    await interaction.update({ content: '✅ Taggeé a toda la party para que entren a voz.', components: [] });
    return;
  }

  if (subAction === 'in_progress') {
    ping.status = 'IN_PROGRESS';
    ConfigManager.savePing(config.guildId, ping);
    await interaction.update({ content: '⚔️ Party marcada como **EN RUTA**.', components: [] });
    await refreshActivePingMessage(interaction, config, ping);
    return;
  }

  if (subAction === 'close' || subAction === 'cancel') {
    ping.status = subAction === 'close' ? 'CLOSED' : 'CANCELLED';
    ping.closedAt = Date.now();

    if (interaction.guild) {
      await cleanupPingChannels(
        interaction.guild,
        ping,
        subAction === 'close' ? 'Contenido terminado por el Caller' : 'Salida cancelada por el Caller'
      );
    }

    ConfigManager.savePing(config.guildId, ping);
    await interaction.update({
      content: subAction === 'close' ? '🔒 **¡GG!** Salida terminada; borré la voz y el hilo.' : '🔴 Salida cancelada (F); borré la voz y el hilo.',
      components: [],
    });
    await refreshActivePingMessage(interaction, config, ping);
  }
}

/**
 * Formularios: Detalles del Ping, Roles, Arma/IP, Nueva Plantilla
 */
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

  // 1. Detalles del asistente
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

  // 2. Roles personalizados para este ping
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

  // 3. Guardar roles de una plantilla (admins)
  if (customId.startsWith('tpl_modal_save_roles:')) {
    if (!isGuildManager(interaction)) {
      await interaction.reply({ content: NO_ADMIN_PERMS, flags: MessageFlags.Ephemeral });
      return;
    }
    const contentId = customId.split(':')[1];
    const parsedRoles = parseRolesText(interaction.fields.getTextInputValue('input_roles_lines'));
    if (parsedRoles.length === 0) {
      await interaction.reply({ content: '❌ Formato inválido. Usa `Emoji | Nombre | Cupos | Descripción`.', flags: MessageFlags.Ephemeral });
      return;
    }
    ConfigManager.updateContentRoles(config.guildId, contentId, parsedRoles);
    await interaction.reply({ content: `✅ Roles de la plantilla guardados (${parsedRoles.length}).`, flags: MessageFlags.Ephemeral });
    return;
  }

  // 4. Nueva plantilla (admins)
  if (customId === 'tpl_modal_create_content') {
    if (!isGuildManager(interaction)) {
      await interaction.reply({ content: NO_ADMIN_PERMS, flags: MessageFlags.Ephemeral });
      return;
    }
    if (config.contentTypes.length >= getLimits(config).maxContentTypes) {
      await interaction.reply({ content: `⚠️ Límite de plantillas alcanzado.\n${PREMIUM_UPSELL}`, flags: MessageFlags.Ephemeral });
      return;
    }

    const name = cleanUserText(interaction.fields.getTextInputValue('tpl_name'), 60) || 'Contenido';
    const emoji = interaction.fields.getTextInputValue('tpl_emoji').trim() || '⚔️';
    const subtitle = cleanUserText(interaction.fields.getTextInputValue('tpl_subtitle'), 60);
    const [defaultGearTier, defaultMount, defaultZone] = interaction.fields
      .getTextInputValue('tpl_defaults')
      .split('|')
      .map((s) => cleanUserText(s, 100));
    const roles = parseRolesText(interaction.fields.getTextInputValue('tpl_roles'));

    let newId =
      name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 24) || `custom_${Date.now().toString(36)}`;
    // Evitar pisar una plantilla existente con el mismo id
    if (config.contentTypes.some((c) => c.id === newId)) newId = `${newId}_${Date.now().toString(36)}`;

    const newContent: ContentTypeConfig = {
      id: newId,
      name,
      emoji,
      subtitle: subtitle || 'CONTENIDO DEL GREMIO',
      accentColor: '#D4AF37',
      defaultGearTier: defaultGearTier || 'T8 Equiv',
      defaultMount: defaultMount || 'Garrapresta',
      defaultZone: defaultZone || 'HO / Ciudad',
      roles:
        roles.length > 0
          ? roles
          : [
              { id: 'tank', emoji: '🛡️', label: 'Tanque', maxSlots: 1 },
              { id: 'healer', emoji: '✨', label: 'Sanador', maxSlots: 1 },
              { id: 'dps', emoji: '🗡️', label: 'Daño', maxSlots: 5 },
            ],
    };

    ConfigManager.upsertContentType(config.guildId, newContent);
    await interaction.reply({
      content: `✅ Nuevo contenido: ${newContent.emoji} **${newContent.name}** (${newContent.roles.length} roles).\nPara avisar a un rol: \`/config rol-ping contenido:${newContent.id}\`.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // 5. Arma/IP del jugador
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
