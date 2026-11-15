# Contribuir a MassUp

## Antes de abrir un PR

```bash
npx tsc --noEmit -p .
```

```bash
cd dashboard && npx tsc --noEmit -p .
```

```bash
npm test
```

Las tres tienen que pasar. Los tests usan `node:test` y están junto al código (`*.test.ts`).

## Estilo de los comentarios

Todo el código se comenta en español, con frases completas y punto final. Los nombres de APIs,
campos y variables de entorno van tal cual (`external_reference`, `MP_TEST`, `customId`).

### Qué va en cada sitio

- **Cabecera de módulo.** Cada archivo empieza con un bloque `/** … */`, antes de los imports, que
  dice para qué sirve el módulo en una o dos frases. Si el módulo tiene un flujo no evidente, un
  formato de datos en disco o variables de entorno propias, se explica ahí.
- **JSDoc `/** … */` en todo lo exportado:** funciones, componentes, clases, interfaces, tipos y
  constantes. Se documenta el contrato, no la implementación: qué devuelve, cuándo devuelve
  `null`/`undefined`, qué lanza y qué efectos tiene (guarda en disco, envía un mensaje…). `@param`
  y `@returns` solo cuando aportan algo que la firma no dice.
- **Campos de interfaces:** `/** … */` encima del campo, y solo si el nombre no basta (unidades,
  significado de `null`, de dónde sale el valor). Nada de `// …` al final de la línea en los campos:
  el editor no lo muestra al pasar el ratón.
- **Lo interno** (funciones y constantes no exportadas, closures) se comenta con `//` encima, y solo
  si hace falta.
- **`//` dentro del código** para el porqué: decisiones, casos raros, límites de Discord o de
  Mercado Pago, cosas que parecen un error y no lo son. Si el código ya lo dice, no se comenta.
- **Shell y Caddyfile:** `#`, con una cabecera que diga qué hace el script, cómo se ejecuta y qué
  variables acepta.

### Tono

- Sobrio y técnico, como una nota para el siguiente desarrollador. Sin adjetivos de relleno ni
  frases del tipo "potente", "robusto" o "elegante".
- Sin emojis ni mayúsculas para enfatizar (`NO`, `IMPORTANTE`). Si algo es importante, se explica
  por qué.
- Sin comentarios que repitan el código (`// Guarda la config` encima de `saveConfig(config)`).
- Sin referencias a conversaciones, tickets internos o historia que no esté en el repo. Si algo
  existe por compatibilidad con datos o mensajes antiguos, se dice así.

### Excepciones

- Los textos que ve el usuario (mensajes de Discord, logs, textos del panel) llevan los emojis que
  necesiten: son parte del producto, no comentarios.
- Un comentario que documenta un formato visible puede citarlo tal cual, emojis incluidos, p. ej.
  `"⛓️3 · 🔮2 · 🗡️5"` en `src/utils/ui.ts`.

### Ejemplo

```ts
/**
 * Consulta un pago a la API. Devuelve null si no existe o no es de nuestra cuenta (la API da 404).
 */
export async function getPayment(env: MercadoPagoEnv, paymentId: string): Promise<MpPayment | null> {
  // ...
}

// Timeout de 10 s para que una API lenta no deje colgada la petición del panel o del webhook.
async function mpFetch(env: MercadoPagoEnv, path: string, init: RequestInit = {}) {
  // ...
}
```

## Commits

Mensajes en español con prefijo de tipo, como en el historial: `feat:`, `fix:`, `chore:`, `docs:`.
