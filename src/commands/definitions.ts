import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

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
    .setName('panel')
    .setDescription('Abre el panel web para configurar contenidos, builds, avisos y marca')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

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
