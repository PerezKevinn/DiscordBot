/**
 * Tiempos de los videos cortos diarios (30 fps). Sin React: lo usan la composición `Short`
 * y `scripts/daily.ts` (para sincronizar el audio).
 */

/** Escenas reutilizables como «demostración» y su duración en fotogramas */
export const PAYOFF_DUR = {
  ping: 120, // /ping → asistente → Publicar
  roster: 240, // ping publicado, mención al rol, roster que se llena y banca
  mando: 130, // Mando del Caller: ¡A voz! y GG que limpia voz e hilo
  gg: 90, // GG → Repartir loot
  plata: 120, // formulario «Plata y descuentos»
  reparto: 235, // mensaje público del reparto y pagos marcados
  log: 100, // 💎 Importar log de AO Loot Logger
  hora: 180, // ⏰ Cambiar hora desde el Mando
  swaps: 150, // tarjeta de builds con swaps
  lootcorto: 160, // reparto compacto
  tickets: 180, // ticket de reclutamiento con ficha de Albion → Aceptar
  panel: 140, // panel web: tema claro/oscuro y borrador recuperado
} as const;

export type PayoffKey = keyof typeof PAYOFF_DUR;

export type ChatLine = { who: string; text: string };

export type ShortProps = {
  /** Gancho: texto grande arriba y chat de Discord con el problema */
  hook: { kicker?: string; title: string; sub?: string; channel?: string; chat: ChatLine[] };
  /** Golpe de giro a pantalla completa, p. ej. «Hasta que llegó *MassUp*» */
  turn: string;
  /** Escenas de demostración, en orden (máx. ~10 s en total) */
  payoff: PayoffKey[];
  /** Cierre */
  tagline: string;
  chips: string[];
  footer?: string;
};

export const HOOK_CHAT_START = 14;
export const HOOK_CHAT_STEP = 10;
export const TURN_DUR = 34;
export const OUTRO_DUR = 120;

export function shortTimeline(p: Pick<ShortProps, 'hook' | 'payoff'>) {
  const chat = p.hook.chat.map((_, i) => HOOK_CHAT_START + i * HOOK_CHAT_STEP);
  const hookDur = Math.max(75, (chat[chat.length - 1] ?? 40) + 36);
  const turn = hookDur;
  let t = turn + TURN_DUR;
  const scenes = p.payoff.map((key) => {
    const s = { key, from: t, dur: PAYOFF_DUR[key] };
    t += s.dur;
    return s;
  });
  const outro = t;
  return { chat, hookDur, turn, scenes, outro, total: outro + OUTRO_DUR };
}
