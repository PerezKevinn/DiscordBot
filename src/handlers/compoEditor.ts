import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ModalBuilder,
  ModalSubmitInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  LabelBuilder,
  TextDisplayBuilder,
  MessageFlags,
} from 'discord.js';
import { GuildConfig, RoleTemplate } from '../types/ping';
import { ConfigManager } from '../utils/configManager';
import { buildWizardStepMessage } from '../utils/panelBuilder';
import { canCreatePings, isGuildManager } from '../utils/permissions';
import { cleanUserText } from '../utils/security';
import { baseEmbed, composeRoleLabel, fitEmbed, hexToInt, splitRoleLabel, totalSlots, UI_COLORS } from '../utils/ui';

/**
 * Editor visual de la compo (roles y cupos) del ping que el Caller está armando (solo ese ping).
 * Las plantillas permanentes, con sus builds, se editan en el panel web.
 *
 * Sustituye al formulario de texto "Emoji | Rol | Cupos | Descripción", que sigue
 * disponible como "Editar como texto" para quien quiera pegar varios roles de golpe.
 */

const MAX_ROLES = 20;
const MAX_SLOTS = 100;

type CompoTarget = { kind: 'draft' } | { kind: 'template'; contentId: string };

interface CompoSession {
  target: CompoTarget;
  title: string;
  accentColor: string;
  roles: RoleTemplate[];
  original: RoleTemplate[];
  selected: number;
}

const sessions = new Map<string, CompoSession>();
const SESSION_TTL_MS = 30 * 60 * 1000;
const sessionTouched = new Map<string, number>();

/** Las sesiones del editor caducan a los 30 min para no acumular memoria. */
function pruneSessions() {
  const now = Date.now();
  for (const [k, at] of sessionTouched) {
    if (now - at > SESSION_TTL_MS) {
      sessions.delete(k);
      sessionTouched.delete(k);
    }
  }
}
setInterval(pruneSessions, 5 * 60 * 1000).unref();
const key = (guildId: string, userId: string) => `${guildId}:${userId}`;
const clone = (roles: RoleTemplate[]) => roles.map((r) => ({ ...r }));

type AnyInteraction = ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction;

// ---------- Utilidades de roles ----------

const EMOJI_RE = /^(\p{Extended_Pictographic}|\p{Regional_Indicator}{2})(️|‍|\p{Extended_Pictographic}|\p{Emoji_Modifier})*$/u;
const CUSTOM_EMOJI_RE = /^<a?:\w{2,32}:\d{15,25}>$/;

/** Devuelve un emoji válido para Discord o el de respaldo (un emoji inválido rompe los menús). */
export function sanitizeEmoji(raw: string, fallback = '⚔️'): string {
  const e = raw.trim();
  return EMOJI_RE.test(e) || CUSTOM_EMOJI_RE.test(e) ? e : fallback;
}

function joinLabel(name: string, weapons: string): string {
  return composeRoleLabel(cleanUserText(name, 60), cleanUserText(weapons, 80));
}

function newRoleId(name: string): string {
  const slug = name.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '').slice(0, 12);
  return `r_${slug || 'rol'}_${Date.now().toString(36)}`;
}

const clampSlots = (n: number) => (Number.isNaN(n) || n < 0 ? 0 : Math.min(n, MAX_SLOTS));
const normName = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/**
 * Formato de texto amigable, una línea por rol:
 *   🛡️ Tanque x1: Maza íncubo / Maza
 * - El emoji es opcional (sin emoji = ⚔️).
 * - "x2" son los cupos; sin "x" o con "x∞" = sin límite.
 * - Después de ":" van las armas sugeridas (opcional).
 */
export function serializeRolesText(roles: RoleTemplate[]): string {
  return roles
    .map((r) => {
      const { name, weapons } = splitRoleLabel(r.label);
      return `${r.emoji} ${name} x${r.maxSlots > 0 ? r.maxSlots : '∞'}${weapons ? `: ${weapons}` : ''}`;
    })
    .join('\n');
}

/**
 * Lee el formato amigable y también el antiguo "Emoji | Rol (armas) | Cupos | Descripción".
 * Si un rol ya existía con el mismo nombre, conserva su id (la gente anotada no se pierde)
 * y su descripción.
 */
export function parseRolesText(rawText: string, existing: RoleTemplate[] = []): RoleTemplate[] {
  const byName = new Map(existing.map((r) => [normName(splitRoleLabel(r.label).name), r]));

  return rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, MAX_ROLES)
    .flatMap((line): RoleTemplate[] => {
      let emoji = '';
      let name = '';
      let weapons = '';
      let slots = 0;
      let description: string | undefined;

      if (line.includes('|')) {
        // Formato antiguo
        const parts = line.split('|').map((p) => p.trim());
        if (parts.length < 2) return [];
        emoji = sanitizeEmoji(parts[0] || '');
        ({ name, weapons = '' } = splitRoleLabel(parts[1] || ''));
        slots = clampSlots(parseInt(parts[2] || '0', 10));
        description = parts[3] || undefined;
      } else {
        // Formato amigable
        let rest = line;
        const first = rest.split(/\s+/)[0];
        if (first && sanitizeEmoji(first, '') !== '') {
          emoji = first;
          rest = rest.slice(first.length).trim();
        }
        const colon = rest.indexOf(':');
        if (colon >= 0) {
          weapons = rest.slice(colon + 1).trim();
          rest = rest.slice(0, colon).trim();
        }
        const m = rest.match(/^(.*?)\s*[x×]\s*(\d+|∞)\s*$/i);
        if (m) {
          name = m[1];
          slots = m[2] === '∞' ? 0 : clampSlots(parseInt(m[2], 10));
        } else {
          name = rest;
        }
      }

      name = name.trim();
      if (!name) return [];
      const prev = byName.get(normName(name));
      return [
        {
          id: prev?.id ?? newRoleId(name),
          emoji: emoji || prev?.emoji || '⚔️',
          label: joinLabel(name, weapons),
          maxSlots: slots,
          description: cleanUserText(description ?? prev?.description ?? '', 100),
          ...(prev?.build ? { build: prev.build } : {}),
        },
      ];
    });
}

/** Formulario "Editar como texto": instrucciones dentro del propio formulario. */
export function buildCompoTextModal(title: string, roles: RoleTemplate[]): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('compo_modal_text')
    .setTitle(`Compo: ${title}`.slice(0, 45))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          '**Un rol por línea:** `emoji Nombre xCupos: armas`',
          '`🛡️ Tanque x1: Maza íncubo / Maza`',
          '`💚 Sanador x2: Bastón sagrado`',
          '`🗡️ Daño x∞` ← sin límite de cupos',
          '-# Para cambiar descripciones usa el editor con botones.',
        ].join('\n')
      )
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Roles')
        .setDescription(`Hasta ${MAX_ROLES} roles. El emoji y las armas son opcionales.`)
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId('input_roles_lines')
            .setStyle(TextInputStyle.Paragraph)
            .setValue(serializeRolesText(roles).slice(0, 4000))
            .setRequired(true)
        )
    );
}

// ---------- Vista del editor ----------

function buildEditorView(config: GuildConfig, s: CompoSession) {
  const total = totalSlots(s.roles);
  const sel = s.roles[s.selected];
  const isTemplate = s.target.kind === 'template';

  const lines = s.roles.map((r, i) => {
    const { name, weapons } = splitRoleLabel(r.label);
    const slots = r.maxSlots > 0 ? `×${r.maxSlots}` : '×∞';
    const marker = i === s.selected ? '▶' : `\`${i + 1}.\``;
    const hasBuild = Boolean(r.build && Object.values(r.build).some(Boolean));
    return `${marker} ${r.emoji} **${name}** ${slots}${hasBuild ? ' · 🧩' : ''}${weapons ? `\n-# ${weapons}` : ''}`;
  });

  const embed = baseEmbed(config, isTemplate ? 'Plantilla de contenido' : 'Compo de este ping')
    .setColor(hexToInt(s.accentColor))
    .setTitle(`👥 Compo · ${s.title}`.slice(0, 256))
    .setDescription(
      [
        lines.join('\n').slice(0, 3700) || '*Sin roles. Añade uno.*',
        '',
        `**${s.roles.length}** roles · ${total ? `**${total}** cupos` : 'cupos sin límite en algún rol'}`,
        isTemplate
          ? '-# Los cambios se guardan en la plantilla y valen para los próximos pings.'
          : '-# Los cambios solo valen para este ping.',
        s.roles.some((r) => r.build && Object.values(r.build).some(Boolean))
          ? '-# 🧩 = el rol tiene build. Las builds se editan desde el panel web.'
          : '',
      ].join('\n')
    );

  const select = new StringSelectMenuBuilder().setCustomId('compo_select').setPlaceholder('Elige un rol para editarlo');
  if (s.roles.length === 0) {
    select.addOptions(new StringSelectMenuOptionBuilder().setLabel('Sin roles').setValue('none')).setDisabled(true);
  } else {
    s.roles.forEach((r, i) => {
      const { name, weapons } = splitRoleLabel(r.label);
      select.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(`${name} · ${r.maxSlots > 0 ? r.maxSlots : '∞'} cupos`.slice(0, 100))
          .setDescription((weapons || r.description || 'Sin armas sugeridas').slice(0, 100))
          .setValue(String(i))
          .setEmoji(r.emoji)
          .setDefault(i === s.selected)
      );
    });
  }

  const noSel = !sel;
  const roleRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('compo_slots_down').setEmoji('➖').setStyle(ButtonStyle.Secondary).setDisabled(noSel || sel.maxSlots === 0),
    new ButtonBuilder()
      .setCustomId('compo_slots_label')
      .setLabel(noSel ? 'Cupos' : `${sel.maxSlots > 0 ? sel.maxSlots : '∞'} cupos`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder().setCustomId('compo_slots_up').setEmoji('➕').setStyle(ButtonStyle.Secondary).setDisabled(noSel || sel.maxSlots >= MAX_SLOTS),
    new ButtonBuilder().setCustomId('compo_move_up').setEmoji('⬆️').setStyle(ButtonStyle.Secondary).setDisabled(noSel || s.selected === 0),
    new ButtonBuilder().setCustomId('compo_edit').setLabel('Editar').setEmoji('✏️').setStyle(ButtonStyle.Primary).setDisabled(noSel)
  );

  const listRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('compo_add')
      .setLabel('Añadir rol')
      .setEmoji('➕')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(s.roles.length >= MAX_ROLES),
    new ButtonBuilder().setCustomId('compo_remove').setLabel('Quitar').setEmoji('🗑️').setStyle(ButtonStyle.Secondary).setDisabled(noSel || s.roles.length <= 1),
    new ButtonBuilder().setCustomId('compo_text').setLabel('Editar como texto').setEmoji('📝').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('compo_reset').setLabel('Deshacer cambios').setEmoji('↩️').setStyle(ButtonStyle.Secondary)
  );

  const saveRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('compo_save')
      .setLabel(isTemplate ? 'Guardar plantilla' : 'Listo')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success)
      .setDisabled(s.roles.length === 0),
    new ButtonBuilder().setCustomId('compo_cancel').setLabel(isTemplate ? 'Cancelar' : 'Volver sin cambios').setStyle(ButtonStyle.Danger)
  );

  return {
    content: '',
    embeds: [fitEmbed(embed)],
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select), roleRow, listRow, saveRow],
  };
}

/** Emojis típicos de roles de Albion para elegir sin teclear. */
const ROLE_EMOJIS: Array<[string, string]> = [
  ['🛡️', 'Tanque'],
  ['⚔️', 'Tanque secundario / genérico'],
  ['⛓️', 'Atrape / control'],
  ['💚', 'Sanador'],
  ['✨', 'Sanador principal'],
  ['🌿', 'Sanador natural'],
  ['🍃', 'Sanador de grupo'],
  ['🔮', 'Soporte / purga'],
  ['⚡', 'Soporte'],
  ['🗡️', 'Daño cuerpo a cuerpo'],
  ['🔥', 'Daño mágico'],
  ['💥', 'Daño en área'],
  ['🏹', 'Daño a distancia'],
  ['❄️', 'Daño de hielo / control'],
  ['👁️', 'Explorador'],
  ['🔍', 'Rastreador'],
  ['⛏️', 'Recolector'],
  ['🐎', 'Montura / transporte'],
  ['💰', 'Saqueador / botín'],
  ['🚩', 'Banderas / objetivos'],
];

const SLOT_CHOICES = ['0', ...Array.from({ length: 20 }, (_, i) => String(i + 1)), '25', '30', '40', '50'];

export function buildRoleModal(index: number | 'new', role?: RoleTemplate): ModalBuilder {
  const { name, weapons } = role ? splitRoleLabel(role.label) : { name: '', weapons: '' };
  const currentEmoji = role?.emoji || '🛡️';
  const currentSlots = role ? role.maxSlots : 1;

  const nameInput = new TextInputBuilder()
    .setCustomId('role_name')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(60)
    .setPlaceholder('Tanque, Sanador, Soporte, Daño...')
    .setRequired(true);
  if (name) nameInput.setValue(name.slice(0, 60));

  const weaponsInput = new TextInputBuilder()
    .setCustomId('role_weapons')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(80)
    .setPlaceholder('Maza pesada / Maza íncubo')
    .setRequired(false);
  if (weapons) weaponsInput.setValue(weapons.slice(0, 80));

  const descInput = new TextInputBuilder()
    .setCustomId('role_desc')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(100)
    .setPlaceholder('Qué hace este rol en la party')
    .setRequired(false);
  if (role?.description) descInput.setValue(role.description.slice(0, 100));

  // Cupos: si el valor actual no está en la lista (p. ej. 35), se añade para no perderlo
  const slotValues = SLOT_CHOICES.includes(String(currentSlots))
    ? SLOT_CHOICES
    : [...SLOT_CHOICES, String(currentSlots)].sort((a, b) => Number(a) - Number(b));
  const slotsSelect = new StringSelectMenuBuilder()
    .setCustomId('role_slots')
    .setRequired(true)
    .addOptions(
      slotValues.slice(0, 25).map((v) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(v === '0' ? 'Sin límite' : `${v} ${v === '1' ? 'cupo' : 'cupos'}`)
          .setValue(v)
          .setDefault(Number(v) === currentSlots)
      )
    );

  // Emoji: lista típica + el emoji actual si es otro (p. ej. un emoji propio del servidor)
  const emojiChoices = ROLE_EMOJIS.some(([e]) => e === currentEmoji)
    ? ROLE_EMOJIS
    : [[currentEmoji, 'Emoji actual'] as [string, string], ...ROLE_EMOJIS];
  const emojiSelect = new StringSelectMenuBuilder()
    .setCustomId('role_emoji')
    .setRequired(true)
    .addOptions(
      emojiChoices.slice(0, 25).map(([e, desc]) =>
        new StringSelectMenuOptionBuilder().setLabel(desc).setValue(e).setEmoji(e).setDefault(e === currentEmoji)
      )
    );

  return new ModalBuilder()
    .setCustomId(`compo_modal_role:${index}`)
    .setTitle(index === 'new' ? 'Nuevo rol' : `Editar rol: ${name}`.slice(0, 45))
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Nombre del rol')
        .setDescription('Como aparecerá en el ping')
        .setTextInputComponent(nameInput),
      new LabelBuilder()
        .setLabel('Armas sugeridas')
        .setDescription('Opcional. Sepáralas con /')
        .setTextInputComponent(weaponsInput),
      new LabelBuilder().setLabel('Cupos').setStringSelectMenuComponent(slotsSelect),
      new LabelBuilder().setLabel('Emoji').setStringSelectMenuComponent(emojiSelect),
      new LabelBuilder()
        .setLabel('Descripción')
        .setDescription('Opcional. Se ve al elegir el rol en el ping')
        .setTextInputComponent(descInput)
    );
}

// ---------- Entrada al editor ----------

/** Abre el editor de la compo del ping que el Caller está armando. */
export async function openDraftCompoEditor(interaction: ButtonInteraction, config: GuildConfig) {
  const draft = ConfigManager.getDraft(config.guildId, interaction.user.id);
  if (!draft) {
    await interaction.reply({ content: '⚠️ El borrador expiró. Vuelve a usar `/ping`.', flags: MessageFlags.Ephemeral });
    return;
  }
  const content = config.contentTypes.find((c) => c.id === draft.contentTypeId) || config.contentTypes[0];
  const roles = clone(draft.customRoles || content.roles);
  const s: CompoSession = {
    target: { kind: 'draft' },
    title: draft.title || content.name,
    accentColor: content.accentColor,
    roles,
    original: clone(roles),
    selected: 0,
  };
  sessions.set(key(config.guildId, interaction.user.id), s);
  sessionTouched.set(key(config.guildId, interaction.user.id), Date.now());
  await interaction.update(buildEditorView(config, s));
}

// ---------- Interacciones dentro del editor ----------

function allowed(interaction: AnyInteraction, config: GuildConfig, s: CompoSession) {
  return s.target.kind === 'template' ? isGuildManager(interaction) : canCreatePings(interaction, config);
}

export async function handleCompoInteraction(interaction: AnyInteraction, config: GuildConfig) {
  const s = sessions.get(key(config.guildId, interaction.user.id));
  if (s) sessionTouched.set(key(config.guildId, interaction.user.id), Date.now());
  if (!s) {
    const msg = { content: '⚠️ Este editor expiró. Ábrelo de nuevo.', flags: MessageFlags.Ephemeral } as const;
    if (interaction.isModalSubmit() || interaction.isMessageComponent()) await interaction.reply(msg);
    return;
  }
  if (!allowed(interaction, config, s)) {
    await interaction.reply({ content: '⛔ No tienes permiso para editar esta compo.', flags: MessageFlags.Ephemeral });
    return;
  }

  const id = interaction.customId;
  const update = async () => {
    s.selected = Math.max(0, Math.min(s.selected, s.roles.length - 1));
    if (interaction.isModalSubmit()) {
      if (interaction.isFromMessage()) await interaction.update(buildEditorView(config, s));
      else await interaction.reply({ ...buildEditorView(config, s), flags: MessageFlags.Ephemeral });
    } else {
      await interaction.update(buildEditorView(config, s));
    }
  };

  // --- Menú de roles ---
  if (interaction.isStringSelectMenu() && id === 'compo_select') {
    const idx = parseInt(interaction.values[0], 10);
    if (!Number.isNaN(idx)) s.selected = idx;
    return update();
  }

  // --- Formularios ---
  if (interaction.isModalSubmit()) {
    if (id === 'compo_modal_text') {
      const parsed = parseRolesText(interaction.fields.getTextInputValue('input_roles_lines'), s.roles);
      if (parsed.length === 0) {
        await interaction.reply({ content: '❌ No leí ningún rol. Usa una línea por rol, por ejemplo: `🛡️ Tanque x1: Maza íncubo`', flags: MessageFlags.Ephemeral });
        return;
      }
      s.roles = parsed;
      s.selected = 0;
      return update();
    }

    if (id.startsWith('compo_modal_role:')) {
      const which = id.split(':')[1];
      const name = interaction.fields.getTextInputValue('role_name');
      const weapons = interaction.fields.getTextInputValue('role_weapons');
      const slotsRaw = parseInt(interaction.fields.getStringSelectValues('role_slots')[0] ?? '0', 10);
      const slots = Number.isNaN(slotsRaw) || slotsRaw < 0 ? 0 : Math.min(slotsRaw, MAX_SLOTS);
      const emoji = sanitizeEmoji(interaction.fields.getStringSelectValues('role_emoji')[0] ?? '');
      const description = cleanUserText(interaction.fields.getTextInputValue('role_desc'), 100);

      if (which === 'new') {
        if (s.roles.length >= MAX_ROLES) {
          await interaction.reply({ content: `⚠️ Máximo ${MAX_ROLES} roles por compo.`, flags: MessageFlags.Ephemeral });
          return;
        }
        s.roles.push({ id: newRoleId(name), label: joinLabel(name, weapons), emoji, maxSlots: slots, description });
        s.selected = s.roles.length - 1;
      } else {
        const idx = parseInt(which, 10);
        const role = s.roles[idx];
        if (role) {
          // Se conserva el id para no perder a la gente ya anotada en ese rol
          s.roles[idx] = { ...role, label: joinLabel(name, weapons), emoji, maxSlots: slots, description };
          s.selected = idx;
        }
      }
      return update();
    }
    return;
  }

  if (!interaction.isButton()) return;
  const sel = s.roles[s.selected];

  switch (id) {
    case 'compo_slots_up':
      if (sel) sel.maxSlots = Math.min(MAX_SLOTS, sel.maxSlots + 1);
      return update();
    case 'compo_slots_down':
      if (sel) sel.maxSlots = Math.max(0, sel.maxSlots - 1);
      return update();
    case 'compo_move_up':
      if (sel && s.selected > 0) {
        [s.roles[s.selected - 1], s.roles[s.selected]] = [s.roles[s.selected], s.roles[s.selected - 1]];
        s.selected -= 1;
      }
      return update();
    case 'compo_remove':
      if (sel && s.roles.length > 1) s.roles.splice(s.selected, 1);
      return update();
    case 'compo_reset':
      s.roles = clone(s.original);
      s.selected = 0;
      return update();
    case 'compo_add':
      await interaction.showModal(buildRoleModal('new'));
      return;
    case 'compo_edit':
      if (sel) await interaction.showModal(buildRoleModal(s.selected, sel));
      return;
    case 'compo_text':
      await interaction.showModal(buildCompoTextModal(s.title, s.roles));
      return;
    case 'compo_cancel':
    case 'compo_save':
      return finish(interaction, config, s, id === 'compo_save');
  }
}

async function finish(interaction: ButtonInteraction, config: GuildConfig, s: CompoSession, save: boolean) {
  sessions.delete(key(config.guildId, interaction.user.id));

  if (s.target.kind === 'draft') {
    const draft = ConfigManager.getDraft(config.guildId, interaction.user.id);
    if (!draft) {
      await interaction.update({ content: '⚠️ El borrador expiró. Vuelve a usar `/ping`.', embeds: [], components: [] });
      return;
    }
    if (save) {
      draft.customRoles = clone(s.roles);
      ConfigManager.setDraft(config.guildId, interaction.user.id, draft);
    }
    await interaction.update({ content: '', ...buildWizardStepMessage(draft, config) });
    return;
  }

  if (save) {
    ConfigManager.updateContentRoles(config.guildId, s.target.contentId, clone(s.roles));
  }
  await interaction.update({
    content: '',
    embeds: [
      baseEmbed(config, 'Plantilla de contenido')
        .setColor(save ? UI_COLORS.success : UI_COLORS.muted)
        .setTitle(save ? `✅ Compo guardada · ${s.title}` : 'Sin cambios')
        .setDescription(
          save
            ? `${s.roles.length} roles. Los próximos pings de **${s.title}** usarán esta compo.`
            : 'No se guardó nada.'
        ),
    ],
    components: [],
  });
}
