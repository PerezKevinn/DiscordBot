import { Interaction, PermissionFlagsBits } from 'discord.js';
import { GuildConfig } from '../types/ping';

function memberRoleIds(interaction: Interaction): string[] {
  const member = interaction.member;
  if (!member) return [];
  const roles = member.roles;
  if (Array.isArray(roles)) return roles;
  return [...roles.cache.keys()];
}

/** Admin del bot en este servidor = permiso "Gestionar servidor". */
export function isGuildManager(interaction: Interaction): boolean {
  return Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild));
}

/** Puede tirar pings: si hay rol de Caller configurado, hay que tenerlo (o ser admin). */
export function canCreatePings(interaction: Interaction, config: GuildConfig): boolean {
  if (!config.callerRoleId) return true;
  if (isGuildManager(interaction)) return true;
  return memberRoleIds(interaction).includes(config.callerRoleId);
}

/** @here / @everyone solo para quien ya tiene ese permiso en Discord (evita abusos). */
export function canMentionEveryone(interaction: Interaction): boolean {
  return Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.MentionEveryone));
}

export function displayNameOf(interaction: Interaction): string {
  const member = interaction.member;
  if (member && 'displayName' in member && typeof member.displayName === 'string') return member.displayName;
  if (member && 'nick' in member && member.nick) return member.nick;
  return interaction.user.displayName;
}
