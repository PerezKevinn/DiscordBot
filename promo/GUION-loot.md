# MassUp · «Del GG a la plata» (reparto de loot)

- **Duración:** 25 s a 30 fps (750 fotogramas). Composiciones `LootVertical` (1080×1920) y `LootHorizontal` (1920×1080)
- **Archivos** (en `out/`): `massup-loot-9x16-con-audio.mp4`, `massup-loot-16x9-con-audio.mp4` y sus versiones `-sin-audio`
- **Para qué:** captar gremios nuevos en TikTok, Reels y Shorts con un dolor muy conocido en Albion, las peleas por el reparto

## Guion con tiempos

| Tiempo | Escena | Lo que se ve | Texto en pantalla |
|---|---|---|---|
| 0:00–0:02,5 | **Gancho** | #general se llena de quejas: «@Draven ¿y mi parte? 👀», «¿cuánto le toca a cada uno?», «yo pagué las repas, eh 😤», «¿quién vendió el loot?», «a mí me pagaron menos 🤨». El chat tiembla. | «¿Otra vez peleando por el **loot**?» / «Después de cada salida, el mismo caos en el chat.» |
| 0:02,5–0:05,5 | **Paso 1 · GG** | Mando del Caller: clic en 🔒 GG → «🔒 Gankeo en Caminos de Avalon ya terminó (7 anotados · 0 en banca)…» → clic en 💰 **Repartir loot**. | «Del GG al reparto en **un clic**» / «Al cerrar la salida, el Mando del Caller ofrece repartir el loot.» |
| 0:05,5–0:09,5 | **Paso 2 · La plata** | Formulario real «Plata y descuentos»: se escriben 12.500.000, 400.000, 10 y 5 → **Enviar**. | «Pones el **total**… y listo» / «Reparaciones, recargo del gremio y pago al vendedor, incluidos.» |
| 0:09,5–0:14,8 | **Paso 3 · El reparto** | El mensaje público se arma línea a línea, con contadores: total, reparaciones → @Vortex, recargo del 10 %, vendedor 5 % → @Draven, «A repartir: 10.285.000 entre 7 jugadores», «💰 **1.469.000 cada uno**» y el sobrante al gremio. Debajo, los jugadores con ⏳. | «Cada uno, **su parte**» / «Todos cobran lo mismo y el sobrante va al gremio.» |
| 0:14,8–0:17,3 | **Paso 4 · Pagos** | Clic en 💸 **Marcar pagos**: los ⏳ pasan a ✅ uno a uno y el pie queda «✅ Pagado a todos». | «Nadie se queda **sin cobrar**» / «Marca quién ya cobró. Con /loot pendientes cada uno ve lo que le deben.» |
| 0:17,3–0:20,7 | **💎 Premium · AO Loot Logger** | Editor del reparto: clic en 📄 **Importar log** y entra `loot-events.txt`. Sale «📦 ¿Quién tiene el loot? (log)»: Lyra 14 ítems, Nyx 9, Bruno 6, Sylas 3 «⚠️ no está en el reparto» y Zorak 1 «❔ sin cuenta de Discord». | «¿Quién se llevó **qué**?» / «Importa el log y verás quién tiene el loot y quién falta en el reparto.» |
| 0:20,7–0:25 | **Cierre** | Logo y MassUp. Chips «Reparto gratis · En español · Log del loot: Premium» y botón massup.shop. | «Cada uno su parte, sin discusiones.» |

**Los números son los del bot:** salen de `computeSplit()` (`src/utils/loot.ts`) con total 12.500.000, reparaciones 400.000, recargo 10 %, vendedor 5 %, 7 jugadores y redondeo a 1.000. Draven cobra 1.469.000 + 605.000 por vender = 2.074.000, y Vortex 1.469.000 + 400.000 de reparaciones = 1.869.000. Para recalcular: `npx tsx promo/scripts/lootNumbers.ts`.

**Gratis o Premium:** el reparto por total de plata es gratis. Importar el log de AO Loot Logger, el historial completo y el CSV son Premium (`lootPro` en `src/utils/plans.ts`).

### Locución opcional (≈ 22 s)

> ¿Otra vez peleando por el loot?
> Con MassUp, das GG y pulsas Repartir loot.
> Pones el total, las reparaciones y el recargo del gremio… y listo.
> Cada uno cobra lo mismo, y el sobrante va al gremio.
> Marca quién ya cobró, y nadie se queda sin su parte.
> Con Premium, importa el log de AO Loot Logger y mira quién se llevó qué.
> MassUp: cada uno su parte, sin discusiones.

### Texto para la publicación

> Se acabaron las peleas por el loot 💰 GG → Repartir loot → cada uno cobra su parte, con reparaciones y recargo del gremio. Gratis y en español 👉 massup.shop
> #AlbionOnline #Albion #Discord #Loot #Gremio #AlbionLatam

## Sonido (versión con audio)

Pista original generada por código (`node scripts/synthAudio.js loot`):

| Tiempo | Efecto |
|---|---|
| 0:00–0:01,5 | dron tenso y un aviso de mensaje por cada queja |
| 0:01,3–0:02,4 | subida y golpe al temblar el chat |
| 0:02,5 | entra la base |
| 0:03 / 0:04,6 | clic en GG y en Repartir loot |
| 0:06–0:08 | teclas al escribir cada campo; clic en Enviar a 0:08,7 |
| 0:09,8–0:11,9 | monedas al salir cada línea; campanita en «cada uno» |
| 0:15 | clic en Marcar pagos; un «pop» por cada ✅ y acorde de «pagado a todos» |
| 0:17,5 | clic en Importar log y *whoosh* del archivo; «pops» por fila (más graves en los avisos) |
| 0:20,7 | golpe, cuerno de guerra y tambores del cierre |

## Grabaciones reales (opcional)

| # | Toma | Sustituye a |
|---|---|---|
| D1 | Captura de un chat real con gente preguntando por su parte (con permiso, o recreado en un servidor de pruebas) | 0:00–0:02,5 |
| D2 | `/mando` de una salida → GG → 💰 Repartir loot | 0:02,5–0:05,5 |
| D3 | Plata y descuentos con los valores del guion → Enviar → Publicar reparto | 0:05,5–0:14,8 |
| D4 | Marcar pagos sobre el mensaje público | 0:14,8–0:17,3 |
| D5 | Importar log con un archivo de AO Loot Logger (Premium) | 0:17,3–0:20,7 |
