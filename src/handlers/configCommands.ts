import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
} from 'discord.js';
import { GuildConfig } from '../types/ping';
import { ConfigManager } from '../utils/configManager';
import { grantPremium, MembershipError, redeemCode, revokePremium } from '../utils/memberships';
import { epaycoEnv } from '../payments/epayco';
import { getEffectiveTier, hasActiveSubscription, hasTimedPremium, PLAN_LIMITS, botBrandName, premiumSkuId } from '../utils/plans';
import { panelButtonRow, panelUrl } from '../utils/panelLink';
import { baseEmbed, fitEmbed } from '../utils/ui';

/** /panel: enlace directo al panel web, donde se configura todo. */
export async function handlePanelCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.inGuild()) return;
  const url = panelUrl(interaction.guildId, 'contenidos');
  if (!url) {
    await interaction.reply({ content: 'El panel web todavía no está activado en este bot.', flags: MessageFlags.Ephemeral });
    return;
  }
  const config = ConfigManager.getConfig(interaction.guildId, interaction.guild?.name);
  const embed = baseEmbed(config, 'Panel web')
    .setTitle('🖥️ Panel de administración')
    .setDescription(
      [
        'Desde el panel configuras todo el bot en este servidor:',
        '',
        '⚔️ **Contenidos, compos y builds** por rol con los ítems del juego',
        '🔔 **A quién avisa** cada contenido y **quién** puede tirar pings',
        '🏆 **Puntos**: ranking, historial y temporadas',
        '📺 **Canal** de pings y **categoría** de las voces',
        '👑 **Pings activos**: verlos y cerrarlos',
        '💎 **Marca y logo** del gremio (Premium)',
        '',
        '-# Entras con tu cuenta de Discord. Necesitas el permiso Gestionar servidor.',
      ].join('\n')
    );
  await interaction.reply({
    embeds: [fitEmbed(embed)],
    components: panelButtonRow(interaction.guildId, 'contenidos'),
    flags: MessageFlags.Ephemeral,
  });
}

/** Texto con el estado de la membresía: fuentes y fin. */
function membershipSummary(config: GuildConfig): string {
  const tier = getEffectiveTier(config);
  if (tier === 'free') return 'Este servidor está en **🆓 Gratis**.';
  const lines: string[] = [];
  if (hasActiveSubscription(config)) {
    const s = config.subscription!;
    lines.push(
      s.endsAt
        ? `💳 Suscripción de Discord cancelada: termina <t:${Math.floor(s.endsAt / 1000)}:D>`
        : '💳 Suscripción de Discord activa (se renueva sola)'
    );
  }
  if (hasTimedPremium(config)) {
    const origin = { code: 'Código canjeado', payment: 'Premium pagado', manual: 'Premium concedido' }[config.premiumSource ?? 'manual'];
    lines.push(
      config.premiumUntil
        ? `🎟️ ${origin}: hasta <t:${Math.floor(config.premiumUntil / 1000)}:D>`
        : `🎟️ ${origin}: de por vida`
    );
  }
  return `Este servidor está en **💎 Premium**.\n${lines.join('\n')}`;
}

/** Botón nativo de compra (SKU) + enlace al panel. */
function planComponents(guildId: string, showBuy: boolean) {
  const row = new ActionRowBuilder<ButtonBuilder>();
  const sku = premiumSkuId();
  if (showBuy && sku) row.addComponents(new ButtonBuilder().setStyle(ButtonStyle.Premium).setSKUId(sku));
  const url = panelUrl(guildId, 'plan');
  if (url) {
    const sells = Boolean(epaycoEnv());
    row.addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setURL(url)
        .setLabel(sells ? 'Comprar Premium' : 'Ver en el panel')
        .setEmoji(sells ? '💎' : '🖥️')
    );
  }
  return row.components.length ? [row] : [];
}

export async function handlePlanCommand(interaction: ChatInputCommandInteraction, config: GuildConfig) {
  const tier = getEffectiveTier(config);
  const free = PLAN_LIMITS.free;
  const premium = PLAN_LIMITS.premium;

  const embed = baseEmbed(config, 'Planes')
    .setTitle(`💎 Planes de ${botBrandName()}`)
    .setDescription(
      `${membershipSummary(config)}\n\n-# ¿Tienes un código? Canjéalo con \`/canjear\`.`
    )
    .addFields(
      {
        name: tier === 'free' ? '🆓 Gratis · tu plan' : '🆓 Gratis',
        value: [
          `✓ **${free.maxActivePings}** pings abiertos a la vez`,
          `✓ **${free.maxContentTypes}** contenidos`,
          '✓ Roster, banca, voz e hilo',
          '✓ Aviso por rol en cada contenido',
          `✓ Puntos y ranking (top ${free.pointsRankingSize})`,
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
          '✓ Ranking semanal/mensual, temporadas y ajustes',
        ].join('\n'),
        inline: true,
      }
    );
  await interaction.reply({
    embeds: [fitEmbed(embed)],
    components: planComponents(config.guildId, tier === 'free' || !hasActiveSubscription(config)),
    flags: MessageFlags.Ephemeral,
  });
}

/** /canjear: aplica un código de Premium al servidor actual. */
export async function handleRedeemCommand(interaction: ChatInputCommandInteraction, config: GuildConfig) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({ content: '⛔ Necesitas el permiso **Gestionar servidor** para canjear códigos.', flags: MessageFlags.Ephemeral });
    return;
  }
  const code = interaction.options.getString('codigo', true);
  try {
    const { days, until } = redeemCode(code, config, interaction.user.id);
    await interaction.reply({
      content: `✅ **Código canjeado.** ${days === null ? 'Este servidor tiene Premium **de por vida**.' : `Se sumaron **${days} días** de Premium: hasta <t:${Math.floor((until ?? 0) / 1000)}:D>.`}`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (err) {
    if (!(err instanceof MembershipError)) throw err;
    await interaction.reply({ content: `❌ ${err.message}`, flags: MessageFlags.Ephemeral });
  }
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
  if (plan === 'premium') grantPremium(target, days ?? null, interaction.user.id, '/plan-admin');
  else revokePremium(target, interaction.user.id, '/plan-admin');

  await interaction.reply({
    content: `✅ ${guildName ?? guildId}: plan **${plan}**${
      target.premiumUntil ? ` hasta <t:${Math.floor(target.premiumUntil / 1000)}:D>` : plan === 'premium' ? ' de por vida' : ''
    }.`,
    flags: MessageFlags.Ephemeral,
  });
}
