import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

/** Comandos públicos (se registran globalmente, en todos los servidores). */
export const publicCommands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Arma un ping de contenido (Gankeo, Grupal, Azules, Facciones, ZvZ...)')
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('panel-ping')
    .setDescription('Pone el panel fijo de Callers en este canal')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configura el bot en este servidor')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((s) => s.setName('ver').setDescription('Muestra la configuración actual'))
    .addSubcommand((s) =>
      s
        .setName('rol-ping')
        .setDescription('Rol a mencionar cuando sale un contenido (ej: Gankeo -> @Gankeo)')
        .addStringOption((o) =>
          o.setName('contenido').setDescription('Tipo de contenido').setRequired(true).setAutocomplete(true)
        )
        .addRoleOption((o) => o.setName('rol').setDescription('Rol a mencionar (vacío = quitar)'))
    )
    .addSubcommand((s) =>
      s
        .setName('rol-ping-defecto')
        .setDescription('Rol a mencionar si el contenido no tiene uno propio')
        .addRoleOption((o) => o.setName('rol').setDescription('Rol (vacío = quitar)'))
    )
    .addSubcommand((s) =>
      s
        .setName('rol-caller')
        .setDescription('Solo este rol podrá tirar pings (vacío = cualquiera)')
        .addRoleOption((o) => o.setName('rol').setDescription('Rol de Caller'))
    )
    .addSubcommand((s) =>
      s
        .setName('canal-pings')
        .setDescription('Canal por defecto donde se publican los pings')
        .addChannelOption((o) =>
          o
            .setName('canal')
            .setDescription('Canal (vacío = el canal donde se use el comando)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
    )
    .addSubcommand((s) =>
      s
        .setName('categoria-voz')
        .setDescription('Categoría donde se crean los canales de voz temporales')
        .addChannelOption((o) =>
          o.setName('categoria').setDescription('Categoría (vacío = sin categoría)').addChannelTypes(ChannelType.GuildCategory)
        )
    )
    .addSubcommand((s) =>
      s
        .setName('marca')
        .setDescription('💎 Premium: nombre, siglas, lema, color y logo del gremio en los pings')
        .addStringOption((o) => o.setName('nombre').setDescription('Nombre del gremio').setMaxLength(40))
        .addStringOption((o) => o.setName('siglas').setDescription('Ej: [KOS]').setMaxLength(8))
        .addStringOption((o) => o.setName('lema').setDescription('Frase del gremio').setMaxLength(80))
        .addStringOption((o) => o.setName('color').setDescription('Color hex del embed, ej: #D4AF37').setMaxLength(7))
        .addAttachmentOption((o) =>
          o.setName('logo').setDescription('Logo del gremio para el banner (PNG/JPG/WEBP, se recorta en cuadrado)')
        )
        .addBooleanOption((o) => o.setName('quitar-logo').setDescription('Volver a usar el icono del servidor'))
    )
    .addSubcommand((s) =>
      s
        .setName('restablecer-plantillas')
        .setDescription('Vuelve a las plantillas de contenido por defecto (borra las personalizadas)')
        .addBooleanOption((o) => o.setName('confirmar').setDescription('Escribe True para confirmar').setRequired(true))
    ),

  new SlashCommandBuilder()
    .setName('plan')
    .setDescription('Muestra el plan del servidor (Gratis / Premium) y qué incluye')
    .setDMPermission(false),
].map((c) => c.toJSON());

/** Comandos del dueño del bot: solo se registran en el servidor de desarrollo (OWNER_GUILD_ID). */
export const ownerCommands = [
  new SlashCommandBuilder()
    .setName('plan-admin')
    .setDescription('[Dueño del bot] Cambia el plan de un servidor')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addStringOption((o) => o.setName('servidor').setDescription('ID del servidor').setRequired(true))
    .addStringOption((o) =>
      o
        .setName('plan')
        .setDescription('Plan')
        .setRequired(true)
        .addChoices({ name: 'Gratis', value: 'free' }, { name: 'Premium', value: 'premium' })
    )
    .addIntegerOption((o) =>
      o.setName('dias').setDescription('Días de Premium (vacío = de por vida)').setMinValue(1).setMaxValue(3650)
    ),
].map((c) => c.toJSON());
