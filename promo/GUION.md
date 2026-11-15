# MassUp · Video promo «De 0 a party en 15 segundos» (Concepto A)

- **Duración:** 25 s a 30 fps (750 fotogramas)
- **Formatos:** vertical 9:16, 1080×1920 (TikTok, Reels, Shorts) y horizontal 16:9, 1920×1080 (YouTube, Discord, X)
- **Archivos renderizados** (en `out/`):
  - Con audio: `massup-party-15s-9x16-con-audio.mp4` y `massup-party-15s-16x9-con-audio.mp4`
  - Sin audio: `massup-party-15s-9x16-sin-audio.mp4` y `massup-party-15s-16x9-sin-audio.mp4`
- **Identidad:** fondo negro azulado, oro `#e3c060`, azul pizarra; títulos en Cinzel y texto en Inter; banner real del bot

## Guion con tiempos

| Tiempo | Escena | Lo que se ve | Texto en pantalla |
|---|---|---|---|
| 0:00–0:03 | **Gancho** | Pregunta grande y un cronómetro que se dispara de 00:00 a 10:00, se pone rojo y tiembla. Corte seco a «Con MassUp: 15 segundos». | «¿Tu Caller tarda **10 minutos** en armar party?» → «CON MASSUP · **15 segundos**» |
| 0:03–0:07 | **Paso 1 · /ping** | En #callers se escribe `/ping` y sale el asistente privado («Solo tú puedes ver esto»). El puntero elige Gankeo en Caminos de Avalon, 21 h, :15 y #pings, y pulsa 🚀 Publicar ping. | «Un ping en **segundos**» / «Asistente privado: eliges contenido, hora y canal, y publicas.» |
| 0:07–0:10,7 | **Paso 2 · Aviso** | Sale el ping en #pings. La mención @Gankeo brilla y aparece la notificación «MassUp te mencionó en #pings». | «Avisa solo al **rol que toca**» / «Gankeo avisa a @Gankeo. Sin molestar a todos con @everyone.» |
| 0:10,7–0:15 | **Paso 3 · Roster** | Se anotan Bruno (purga), Kael (atrape) y Lyra (daño). La party va de 4/7 a 7/7, el contador del banner sube a la vez y queda «completa 🔒». Sylas llega tarde y entra a la 🔄 Banca. | «Cada uno en **su rol**» / «Cupos por rol y banca automática cuando se llena.» |
| 0:15–0:17,2 | **Mando del Caller** | Mando privado con En ruta, ¡A voz!, GG y Cancelar. Clic en ¡A voz!: los 7 avatares entran a la voz temporal. | «Tú **mandas** la party» / «En ruta, ¡A voz!, GG y Cancelar, en privado.» |
| 0:17,2–0:19,3 | **Paso 4 · GG** | Clic en GG: la voz y el hilo de builds se tachan y desaparecen, y queda «Canal limpio, listo para la siguiente salida ✨». | «GG y se **limpia solo**» / «La voz y el hilo de builds se borran al terminar.» |
| 0:19,3–0:25 | **Cierre** | Logo con brillo, MassUp en Cinzel dorado y el lema palabra a palabra. Chips «Gratis · En español · Sin permisos de admin» y botón dorado massup.shop. | «Organiza. Convoca. Conquista.» · **massup.shop** · «Bot de Discord para gremios de Albion Online» |

### Locución opcional (≈ 22 s, tono de Caller con energía)

> ¿Tu Caller tarda diez minutos en armar party?
> Con MassUp, quince segundos.
> Escribes /ping, eliges contenido y hora… y publicas.
> Avisa solo a @Gankeo, no a todo el servidor.
> Cada uno se anota en su rol; si se llena, a la banca.
> ¡A voz!… GG. Y la voz y el hilo se borran solos.
> MassUp. Organiza, convoca, conquista. Gratis en massup.shop.

### Texto para la publicación

> Arma party en Albion en 15 segundos ⚔️ /ping, roster por roles, banca, voz e hilo que se limpian solos. Gratis y en español 👉 massup.shop
> #AlbionOnline #Albion #Discord #BotDeDiscord #Gremio #Gankeo #AlbionLatam

## Música y sonido

Hay dos versiones de cada formato:

- **Con audio:** lleva una pista original generada por código (`scripts/synthAudio.js`), sin samples ni música de terceros, así que no tiene problemas de derechos. Es una base épica en re menor a 120 bpm (bombo, bajo, pad y cuerno de guerra en el cierre) con efectos sincronizados según la tabla de abajo. Está mezclada a unos −13 dBFS RMS, cerca de los −14 LUFS habituales en redes. Úsala en YouTube, Discord o anuncios.
- **Sin audio:** para ponerle un sonido en tendencia desde TikTok o Reels, que suele dar más alcance, o una locución.

Golpes y efectos (los mismos de la versión con audio; sirven de guía si montas tu propio sonido):

| Tiempo | Efecto |
|---|---|
| 0:00–0:01,7 | tic-tac acelerándose |
| 0:01,9 | golpe grave o *whoosh* al aparecer «15 segundos» |
| 0:03,3–0:03,6 | teclas al escribir `/ping` |
| 0:04,5 / 0:05 / 0:05,4 / 0:05,8 | clics suaves en los menús |
| 0:06,3 | clic + «ding» al publicar |
| 0:07,6 | notificación de Discord |
| 0:11,4 / 0:12 / 0:12,7 | «pop» al anotarse cada jugador |
| 0:13,5 | «pop» más grave en la banca |
| 0:15,9 | clic en ¡A voz! (y el sonido de unirse a voz, opcional) |
| 0:17,2 | clic en GG y *swoosh* al borrarse la voz y el hilo |
| 0:19,3 | golpe épico o cuerno con el logo |

Usa música sin derechos de autor (biblioteca de YouTube Audio o la de TikTok). No uses música del juego.

## Grabaciones reales (opcional, para una versión «en vivo»)

El video ya está entero animado y no necesita grabaciones. Si quieres sustituir alguna escena por pantalla real o hacer una segunda versión, graba esto:

**Preparación:** usa un servidor de pruebas con roles @Gankeo y @Caller, canales #callers y #pings y 6–7 cuentas o amigos para anotarse. Pon Discord en tema oscuro, con zoom al 125–150 % y la barra de miembros oculta, y graba a 1080p 60 fps (OBS). En las versiones verticales, recorta a 1080×1920 centrado en el chat.

| # | Toma | Duración útil | Sustituye a |
|---|---|---|---|
| D1 | Escribir `/ping` en #callers y completar el asistente: contenido, hora, minuto, canal y 🚀 Publicar ping | 4 s | 0:03–0:07 |
| D2 | El ping publicado en #pings, con la mención al rol, visto desde una cuenta que tiene ese rol (que salga la notificación) | 3 s | 0:07–0:10 |
| D3 | 3 cuentas eligen rol en «¿De qué vas? Elige tu rol…» hasta 7/7; una cuarta intenta entrar y va a Banca. Graba el embed fijo y acelera ×2 | 4–5 s | 0:10–0:15 |
| D4 | `/mando` → ¡A voz! (con la lista de canales visible y la voz temporal llenándose) | 2 s | 0:15–0:17 |
| D5 | GG en el Mando: la voz temporal y el hilo desaparecen de la lista de canales | 2 s | 0:17–0:19 |
| P1 | *(Extra, para la versión de YouTube)* Panel web panel.massup.shop: pestaña Contenidos → compo y builds por rol con iconos | 5 s | — |
| P2 | *(Extra)* Panel → Ajustes: rol de Caller y aviso por contenido | 3 s | — |

Los títulos animados se pueden mantener encima de las grabaciones: en Remotion, cambia la maqueta de la escena por `<OffthreadVideo src={staticFile('d1.mp4')} />`.

## Zona segura (vertical)

Los textos y la acción importante quedan entre y = 170 y y ≈ 1590 px, y fuera del 10 % derecho, para no chocar con los botones, el nombre de usuario y el pie de TikTok, Reels o Shorts. En la escena del ping el selector «¿De qué vas?» queda en el borde inferior a propósito: si lo tapa la interfaz, no se pierde nada.

## Cómo editar y volver a renderizar

```bash
cd promo
npm install                # solo la primera vez
npm run studio             # vista previa interactiva en el navegador
npm run render:all         # video (2 formatos) + audio + versiones con audio en out/
npm run audio && npm run mux   # solo rehacer el audio sin volver a renderizar el video
```

- Los tiempos de las escenas están en `src/theme.ts` (`T`). Cada escena está en `src/scenes/`.
- Los nombres de los jugadores y los momentos en que se anotan están en `ROLES` (`src/scenes/PingRoster.tsx`).
- Los banners `public/banner-4…7.png` salen del renderizador real del bot: `npx tsx promo/scripts/renderBanners.ts` (desde la raíz del repo).
- Todo es fiel al bot: la compo por defecto de «Gankeo en Caminos de Avalon», los textos del aviso, el embed, la banca y los botones del Mando.
