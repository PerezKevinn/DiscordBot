import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags,
} from 'discord.js';
import { GuildConfig } from '../types/ping';
import { ConfigManager } from '../utils/configManager';
import { getEffectiveTier, getLimits, PLAN_LIMITS, PREMIUM_UPSELL, botBrandName } from '../utils/plans';
import { isGuildManager } from '../utils/permissions';
import { baseEmbed, fitEmbed } from '../utils/ui';
import { deleteCustomLogo, saveCustomLogo } from '../utils/logo';

const roleOrNone = (id?: string) => (id ? `<@&${id}>` : '_ninguno_');
const channelOrNone = (id?: string) => (id ? `<#${id}>` : '_ninguno_');

export async function handleConfigAutocomplete(interaction: AutocompleteInteraction) {
  if (!interaction.inGuild() || interaction.commandName !== 'config') {
    await interaction.respond([]);
    return;
  }
  const config = ConfigManager.getConfig(interaction.guildId, interaction.guild?.name);
  const query = interaction.options.getFocused().toLowerCase();
  const choices = config.contentTypes
    .filter((c) => c.name.toLowerCase().includes(query) || c.id.includes(query))
    .slice(0, 25)
    .map((c) => ({ name: `${c.emoji} ${c.name}`.slice(0, 100), value: c.id }));
  await interaction.respond(choices);
}

export async function handleConfigCommand(interaction: ChatInputCommandInteraction, config: GuildConfig) {
  // Doble chequeo: los permisos por defecto del comando los puede cambiar el servidor
  if (!isGuildManager(interaction)) {
    await interaction.reply({ content: '⛔ Necesitas **Gestionar servidor**.', flags: MessageFlags.Ephemeral });
    return;
  }

  const sub = interaction.options.getSubcommand();

  if (sub === 'ver') {
    const tier = getEffectiveTier(config);
    const contentLines = config.contentTypes.map(
      (c) => `${c.emoji} ${c.name} → ${roleOrNone(config.pingRoles[c.id])}`
    );
    const embed = baseEmbed(config, 'Configuración')
      .setTitle('⚙️ Configuración del servidor')
      .setDescription(
        [
          '-# Cámbiala con los subcomandos de `/config`.',
          !config.callerRoleId && Object.keys(config.pingRoles).length > 0
            ? '⚠️ **Cualquier miembro puede tirar pings que avisan a tus roles.** Limítalo con `/config rol-caller`.'
            : '',
        ]
          .filter(Boolean)
          .join('\n')
      )
      .addFields(
        { name: 'Plan', value: tier === 'premium' ? '💎 Premium' : '🆓 Gratis', inline: true },
        { name: 'Rol Caller', value: roleOrNone(config.callerRoleId), inline: true },
        { name: 'Aviso por defecto', value: roleOrNone(config.defaultPingRoleId), inline: true },
        { name: 'Canal de pings', value: channelOrNone(config.pingTargetChannelId), inline: true },
        { name: 'Categoría de voz', value: channelOrNone(config.voiceCategoryId), inline: true },
        { name: '​', value: '​', inline: true },
        { name: 'Contenido → rol que avisa', value: contentLines.join('\n').slice(0, 1024) || '_vacío_' }
      );
    await interaction.reply({ embeds: [fitEmbed(embed)], flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    return;
  }

  if (sub === 'rol-ping') {
    const contentId = interaction.options.getString('contenido', true);
    const role = interaction.options.getRole('rol');
    const content = config.contentTypes.find((c) => c.id === contentId);
    if (!content) {
      await interaction.reply({ content: '❌ Ese contenido no existe. Elige uno de la lista.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (role) config.pingRoles[content.id] = role.id;
    else delete config.pingRoles[content.id];
    ConfigManager.saveConfig(config);

    let warning = '';
    const me = interaction.guild?.members.me;
    if (role && !role.mentionable && !me?.permissions.has(PermissionFlagsBits.MentionEveryone)) {
      warning =
        '\n⚠️ Ese rol **no es mencionable** y el bot no tiene permiso de *Mencionar @everyone, @here y todos los roles*. Activa una de las dos cosas o no sonará el aviso.';
    }
    await interaction.reply({
      content: role
        ? `✅ Cuando salga ${content.emoji} **${content.name}** se avisará a <@&${role.id}>.${warning}${
            config.callerRoleId
              ? ''
              : '\n💡 Ahora mismo cualquiera puede tirar pings. Usa `/config rol-caller` para que solo tus Callers avisen a ese rol.'
          }`
        : `✅ ${content.emoji} **${content.name}** ya no tiene rol propio.`,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
    return;
  }

  if (sub === 'rol-ping-defecto') {
    const role = interaction.options.getRole('rol');
    config.defaultPingRoleId = role?.id;
    ConfigManager.saveConfig(config);
    await interaction.reply({
      content: role ? `✅ Rol por defecto para pings: <@&${role.id}>` : '✅ Sin rol por defecto.',
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
    return;
  }

  if (sub === 'rol-caller') {
    const role = interaction.options.getRole('rol');
    config.callerRoleId = role?.id;
    ConfigManager.saveConfig(config);
    await interaction.reply({
      content: role
        ? `✅ Solo <@&${role.id}> (y admins) pueden tirar pings.`
        : '✅ Cualquiera puede tirar pings.',
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
    return;
  }

  if (sub === 'canal-pings') {
    const channel = interaction.options.getChannel('canal');
    config.pingTargetChannelId = channel?.id;
    ConfigManager.saveConfig(config);
    await interaction.reply({
      content: channel ? `✅ Los pings se publicarán en <#${channel.id}> por defecto.` : '✅ Los pings se publicarán donde se use el comando.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (sub === 'categoria-voz') {
    const category = interaction.options.getChannel('categoria');
    config.voiceCategoryId = category?.id;
    ConfigManager.saveConfig(config);
    await interaction.reply({
      content: category ? `✅ Las voces temporales se crearán en **${category.name}**.` : '✅ Voces temporales sin categoría.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (sub === 'marca') {
    if (!getLimits(config).customBranding) {
      await interaction.reply({ content: PREMIUM_UPSELL, flags: MessageFlags.Ephemeral });
      return;
    }
    const nombre = interaction.options.getString('nombre');
    const siglas = interaction.options.getString('siglas');
    const lema = interaction.options.getString('lema');
    const color = interaction.options.getString('color');

    if (color && !/^#?[0-9a-fA-F]{6}$/.test(color)) {
      await interaction.reply({ content: '❌ Color inválido. Usa formato hex, ej: `#D4AF37`.', flags: MessageFlags.Ephemeral });
      return;
    }
    const logo = interaction.options.getAttachment('logo');
    const quitarLogo = interaction.options.getBoolean('quitar-logo');
    let logoMsg = '';
    if (logo) {
      const tooBig = (logo.width ?? 0) > 4096 || (logo.height ?? 0) > 4096;
      if (!logo.contentType?.match(/^image\/(png|jpe?g|webp)/) || logo.size > 4 * 1024 * 1024 || tooBig) {
        await interaction.reply({
          content: '❌ El logo debe ser una imagen PNG, JPG o WEBP de máximo 4 MB.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        await saveCustomLogo(config.guildId, logo.url);
        config.customLogo = true;
        logoMsg = '\n🖼️ Logo guardado: saldrá en los próximos pings.';
      } catch (err) {
        await interaction.editReply({ content: `❌ No pude usar esa imagen: ${(err as Error).message}` });
        return;
      }
    } else if (quitarLogo) {
      deleteCustomLogo(config.guildId);
      config.customLogo = false;
      logoMsg = '\n🖼️ Logo quitado: se usará el icono del servidor.';
    }

    if (nombre) config.guildName = nombre.toUpperCase();
    if (siglas !== null) config.guildTag = siglas;
    if (lema !== null) config.motto = lema.toUpperCase();
    if (color) config.colors.embedHex = parseInt(color.replace('#', ''), 16);
    ConfigManager.saveConfig(config);
    const done = `✅ Marca actualizada: **${config.guildName} ${config.guildTag}** — *${config.motto}*${logoMsg}`;
    if (interaction.deferred) await interaction.editReply({ content: done });
    else await interaction.reply({ content: done, flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === 'restablecer-plantillas') {
    if (!interaction.options.getBoolean('confirmar', true)) {
      await interaction.reply({ content: 'Cancelado. No se cambió nada.', flags: MessageFlags.Ephemeral });
      return;
    }
    ConfigManager.resetContentTypes(config.guildId);
    await interaction.reply({
      content: '✅ Plantillas restablecidas. Los roles de ping por contenido se borraron; vuelve a ponerlos con `/config rol-ping`.',
      flags: MessageFlags.Ephemeral,
    });
  }
}

export async function handlePlanCommand(interaction: ChatInputCommandInteraction, config: GuildConfig) {
  const tier = getEffectiveTier(config);
  const free = PLAN_LIMITS.free;
  const premium = PLAN_LIMITS.premium;
  const until =
    tier === 'premium'
      ? config.premiumUntil
        ? `hasta <t:${Math.floor(config.premiumUntil / 1000)}:D>`
        : 'de por vida'
      : '';

  const embed = baseEmbed(config, 'Planes')
    .setTitle(`💎 Planes de ${botBrandName()}`)
    .setDescription(
      `Este servidor está en ${tier === 'premium' ? `**💎 Premium** ${until}` : '**🆓 Gratis**'}.`
    )
    .addFields(
      {
        name: tier === 'free' ? '🆓 Gratis · tu plan' : '🆓 Gratis',
        value: [
          `✓ **${free.maxActivePings}** pings abiertos a la vez`,
          `✓ **${free.maxContentTypes}** contenidos`,
          '✓ Roster, banca, voz e hilo',
          '✓ Aviso por rol en cada contenido',
        ].join('\n'),
        inline: true,
      },
      {
        name: tier === 'premium' ? '💎 Premium · tu plan' : '💎 Premium',
        value: [
          `✓ **${premium.maxActivePings}** pings abiertos a la vez`,
          `✓ **${premium.maxContentTypes}** contenidos`,
          '✓ Marca propia: nombre, siglas, lema y color',
          `✓ Sin "Creado con ${botBrandName()}"`,
        ].join('\n'),
        inline: true,
      }
    );
  await interaction.reply({ embeds: [fitEmbed(embed)], flags: MessageFlags.Ephemeral });
}

export async function handlePlanAdminCommand(interaction: ChatInputCommandInteraction) {
  const ownerId = process.env.BOT_OWNER_ID;
  if (!ownerId || interaction.user.id !== ownerId) {
    await interaction.reply({ content: '⛔ Solo el dueño del bot puede usar esto.', flags: MessageFlags.Ephemeral });
    return;
  }
  const guildId = interaction.options.getString('servidor', true).trim();
  if (!/^\d{5,25}$/.test(guildId)) {
    await interaction.reply({ content: '❌ ID de servidor inválido.', flags: MessageFlags.Ephemeral });
    return;
  }
  const plan = interaction.options.getString('plan', true) as 'free' | 'premium';
  const days = interaction.options.getInteger('dias');

  const guildName = interaction.client.guilds.cache.get(guildId)?.name;
  const target = ConfigManager.getConfig(guildId, guildName);
  target.plan = plan;
  target.premiumUntil = plan === 'premium' && days ? Date.now() + days * 24 * 60 * 60 * 1000 : undefined;
  ConfigManager.saveConfig(target);

  await interaction.reply({
    content: `✅ ${guildName ?? guildId}: plan **${plan}**${
      target.premiumUntil ? ` hasta <t:${Math.floor(target.premiumUntil / 1000)}:D>` : plan === 'premium' ? ' de por vida' : ''
    }.`,
    flags: MessageFlags.Ephemeral,
  });
}
