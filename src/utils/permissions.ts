/**
 * Comprobaciones de permisos de los miembros que usan el bot desde Discord.
 */
import { Interaction, PermissionFlagsBits } from 'discord.js';
import { GuildConfig } from '../types/ping';

// En interacciones de servidores donde el bot no está en caché, member.roles llega como array de ids.
function memberRoleIds(interaction: Interaction): string[] {
  const member = interaction.member;
  if (!member) return [];
  const roles = member.roles;
  if (Array.isArray(roles)) return roles;
  return [...roles.cache.keys()];
}

/** Es administrador del bot en este servidor quien tiene el permiso "Gestionar servidor". */
export function isGuildManager(interaction: Interaction): boolean {
  return Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild));
}

/** Indica si puede crear pings: sin rol de Caller configurado, cualquiera; si lo hay, quien lo tenga o sea admin. */
export function canCreatePings(interaction: Interaction, config: GuildConfig): boolean {
  if (!config.callerRoleId) return true;
  if (isGuildManager(interaction)) return true;
  return memberRoleIds(interaction).includes(config.callerRoleId);
}

/** @here y @everyone solo se ofrecen a quien ya tiene ese permiso en Discord, para que el bot no lo amplíe. */
export function canMentionEveryone(interaction: Interaction): boolean {
  return Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.MentionEveryone));
}

/** Nombre visible del usuario en el servidor: apodo si lo tiene, si no su nombre global. */
export function displayNameOf(interaction: Interaction): string {
  const member = interaction.member;
  if (member && 'displayName' in member && typeof member.displayName === 'string') return member.displayName;
  if (member && 'nick' in member && member.nick) return member.nick;
  return interaction.user.displayName;
}
