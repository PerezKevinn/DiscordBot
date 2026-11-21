/**
 * Definición de los comandos de barra. Se registran en src/index.ts y se atienden en
 * src/handlers/interactionHandler.ts. setDefaultMemberPermissions es solo el valor por defecto:
 * los administradores de cada servidor pueden cambiarlo en Ajustes > Integraciones.
 */
import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

/** Comandos públicos; se registran globalmente, en todos los servidores. */
export const publicCommands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Arma un ping de contenido (Gankeo, Grupal, Azules, Facciones, ZvZ...)')
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('mando')
    .setDescription('Abre el Mando del Caller de tus pings (En ruta, ¡A voz!, GG, Cancelar, puntos y loot)')
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

  new SlashCommandBuilder()
    .setName('ranking')
    .setDescription('Ranking de puntos de actividad del servidor')
    .setDMPermission(false)
    .addStringOption((o) =>
      o
        .setName('periodo')
        .setDescription('Periodo del ranking (semana y mes son Premium)')
        .addChoices(
          { name: 'Temporada', value: 'total' },
          { name: 'Últimos 30 días', value: 'month' },
          { name: 'Últimos 7 días', value: 'week' }
        )
    ),

  new SlashCommandBuilder()
    .setName('puntos')
    .setDescription('Tus puntos de actividad (o los de otro jugador) y tu puesto')
    .setDMPermission(false)
    .addUserOption((o) => o.setName('jugador').setDescription('Jugador a consultar (vacío = tú)')),

  new SlashCommandBuilder()
    .setName('loot')
    .setDescription('Reparto de loot de las salidas: a partes iguales del total de plata')
    .addSubcommand((s) =>
      s
        .setName('repartir')
        .setDescription('Reparte (o corrige) el loot de una salida terminada')
        .addStringOption((o) => o.setName('salida').setDescription('Salida terminada con GG').setRequired(true).setAutocomplete(true))
    )
    .addSubcommand((s) =>
      s
        .setName('pendientes')
        .setDescription('Plata de loot que te deben (o que le deben a otro jugador)')
        .addUserOption((o) => o.setName('jugador').setDescription('Jugador a consultar (vacío = tú)'))
    )
    .addSubcommand((s) => s.setName('historial').setDescription('Últimos repartos de loot del servidor'))
    .addSubcommand((s) =>
      s
        .setName('guia')
        .setDescription('Cómo instalar y usar AO Loot Logger para registrar el loot')
        .addBooleanOption((o) => o.setName('publicar').setDescription('Publicarla en el canal para que la vean todos'))
    ),
  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Ficha de un jugador de Albion: PvP, PvE, recolección y gremios')
    .setDMPermission(false)
    .addStringOption((o) =>
      o.setName('personaje').setDescription('Nombre del personaje, tal cual sale en el juego').setRequired(true).setMinLength(3).setMaxLength(16)
    )
    .addStringOption((o) =>
      o
        .setName('servidor')
        .setDescription('Servidor de Albion (vacío = el del gremio)')
        .addChoices({ name: 'América', value: 'americas' }, { name: 'Europa', value: 'europe' }, { name: 'Asia', value: 'asia' })
    ),

  new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Gestiona el ticket de este canal')
    .setDMPermission(false)
    .addSubcommand((s) =>
      s
        .setName('añadir')
        .setDescription('Da acceso a este ticket a otro miembro (staff)')
        .addUserOption((o) => o.setName('usuario').setDescription('Miembro a añadir').setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName('quitar')
        .setDescription('Quita a un miembro de este ticket (staff)')
        .addUserOption((o) => o.setName('usuario').setDescription('Miembro a quitar').setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName('renombrar')
        .setDescription('Cambia el nombre del canal del ticket (staff)')
        .addStringOption((o) => o.setName('nombre').setDescription('Nuevo nombre').setRequired(true).setMaxLength(90))
    )
    .addSubcommand((s) =>
      s
        .setName('cerrar')
        .setDescription('Cierra este ticket y guarda la transcripción')
        .addStringOption((o) => o.setName('motivo').setDescription('Motivo del cierre').setMaxLength(500))
    ),

  new SlashCommandBuilder()
    .setName('canjear')
    .setDescription('Canjea un código de Premium para este servidor')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addStringOption((o) =>
      o.setName('codigo').setDescription('Código, ej: MASS-ABCD-EFGH').setRequired(true).setMinLength(8).setMaxLength(32)
    ),
].map((c) => c.toJSON());

/** Comandos del dueño del bot; solo se registran en su servidor (GUILD_ID). */
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
