/**
 * Discord va por detrás de Unicode: los emojis más nuevos (Emoji 16.0 en adelante) se ven en el
 * texto, pero si se mandan en un menú o botón la API responde COMPONENT_INVALID_EMOJI y rechaza
 * el mensaje entero. Casi todos los emojis nuevos caen en el bloque U+1FA70–U+1FAFF, así que aquí
 * se listan los rangos de ese bloque que existían hasta Emoji 15.1 (lo que Discord sí admite).
 */
const EXT_A_START = 0x1fa70;
const EXT_A_END = 0x1faff;
const EXT_A_SUPPORTED: Array<[number, number]> = [
  [0x1fa70, 0x1fa7c],
  [0x1fa80, 0x1fa88],
  [0x1fa90, 0x1fabd],
  [0x1fabf, 0x1fac5],
  [0x1face, 0x1fadb],
  [0x1fae0, 0x1fae8],
  [0x1faf0, 0x1faf8],
];

/** true si Discord puede mostrar este emoji en menús y botones. */
export function isDiscordSupportedEmoji(emoji: string): boolean {
  for (const ch of emoji) {
    const cp = ch.codePointAt(0)!;
    if (cp < EXT_A_START || cp > EXT_A_END) continue;
    if (!EXT_A_SUPPORTED.some(([a, b]) => cp >= a && cp <= b)) return false;
  }
  return true;
}

/** Emoji listo para `setEmoji` de un componente, o undefined si Discord lo rechazaría. */
export function componentEmoji(emoji: string | undefined | null): string | undefined {
  return emoji && isDiscordSupportedEmoji(emoji) ? emoji : undefined;
}
