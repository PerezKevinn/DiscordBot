import { z } from 'zod';
import { getItem, ItemSlot } from '../data/items';
import { sanitizeEmoji } from '../handlers/compoEditor';
import { cleanUserText } from '../utils/security';
import { composeRoleLabel } from '../utils/ui';
import { ContentTypeConfig, RoleBuild, RoleTemplate } from '../types/ping';

/**
 * Esquemas de lo que acepta el panel. Nada de lo que llega del navegador se guarda
 * sin pasar por aquí: largos máximos, emojis válidos, IDs con formato correcto e ítems
 * que existen en el catálogo y van en su hueco.
 */

export const snowflake = z.string().regex(/^\d{15,25}$/);
const optionalSnowflake = snowflake.nullable().optional();
const text = (max: number) => z.string().max(max * 2).transform((s) => cleanUserText(s, max));
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const SLOTS = ['weapon', 'offhand', 'head', 'armor', 'shoes', 'cape', 'mount', 'food', 'potion'] as const;

const buildSchema = z
  .object(Object.fromEntries(SLOTS.map((s) => [s, z.string().max(60).nullable().optional()])) as Record<
    (typeof SLOTS)[number],
    z.ZodOptional<z.ZodNullable<z.ZodString>>
  >)
  .partial()
  .transform((b, ctx) => {
    const out: RoleBuild = {};
    for (const slot of SLOTS) {
      const id = b[slot];
      if (!id) continue;
      const item = getItem(id);
      if (!item || item.slot !== (slot as ItemSlot)) {
        ctx.addIssue({ code: 'custom', message: `Ítem no válido en ${slot}: ${id}` });
        continue;
      }
      out[slot] = id;
    }
    return out;
  });

const roleSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,60}$/).optional(),
  name: text(60).refine((s) => s.length > 0, 'El rol necesita nombre'),
  weapons: text(80).optional().default(''),
  emoji: z.string().max(64).transform((e) => sanitizeEmoji(e)),
  maxSlots: z.number().int().min(0).max(100),
  description: text(100).optional().default(''),
  build: buildSchema.optional(),
});

export const contentSchema = z.object({
  name: text(60).refine((s) => s.length > 0, 'El contenido necesita nombre'),
  emoji: z.string().max(64).transform((e) => sanitizeEmoji(e)),
  subtitle: text(60),
  accentColor: hexColor,
  defaultGearTier: text(100),
  defaultMount: text(100),
  defaultZone: text(100),
  roles: z.array(roleSchema).min(1).max(20),
});

export type ContentInput = z.infer<typeof contentSchema>;

function newRoleId(name: string, used: Set<string>): string {
  const slug = name.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '').slice(0, 12) || 'rol';
  let id = `r_${slug}`;
  for (let i = 2; used.has(id); i++) id = `r_${slug}_${i}`;
  used.add(id);
  return id;
}

/** Convierte lo que envía el panel en una plantilla del bot. */
export function toContentType(id: string, input: ContentInput): ContentTypeConfig {
  const used = new Set<string>();
  const roles: RoleTemplate[] = input.roles.map((r) => {
    const roleId = r.id && !used.has(r.id) ? (used.add(r.id), r.id) : newRoleId(r.name, used);
    const build = r.build && Object.keys(r.build).length > 0 ? r.build : undefined;
    return {
      id: roleId,
      label: composeRoleLabel(r.name, r.weapons),
      emoji: r.emoji,
      maxSlots: r.maxSlots,
      description: r.description,
      ...(build ? { build } : {}),
    };
  });
  return {
    id,
    name: input.name,
    emoji: input.emoji,
    subtitle: input.subtitle.toUpperCase(),
    accentColor: input.accentColor.toUpperCase(),
    defaultGearTier: input.defaultGearTier,
    defaultMount: input.defaultMount,
    defaultZone: input.defaultZone,
    roles,
  };
}

export const settingsSchema = z.object({
  callerRoleId: optionalSnowflake,
  defaultPingRoleId: optionalSnowflake,
  pingTargetChannelId: optionalSnowflake,
  voiceCategoryId: optionalSnowflake,
  pingRoles: z.record(z.string().regex(/^[a-zA-Z0-9_-]{1,60}$/), snowflake.nullable()).optional(),
});

export const brandingSchema = z.object({
  guildName: text(40).optional(),
  guildTag: text(8).optional(),
  motto: text(80).optional(),
  color: hexColor.optional(),
});

export const logoSchema = z.object({
  // data:image/png;base64,....  (máx. ~4 MB de imagen)
  dataUrl: z
    .string()
    .max(6 * 1024 * 1024)
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/),
});

export const closePingSchema = z.object({ status: z.enum(['CLOSED', 'CANCELLED']) });

/** Formatea el primer error de validación en español para mostrarlo en el panel. */
export function firstIssue(err: z.ZodError): string {
  const i = err.issues[0];
  return i ? `${i.path.join('.') || 'datos'}: ${i.message}` : 'Datos no válidos';
}
