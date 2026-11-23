# MassUp · «MassUp ahora hace más» (novedades)

- **Duración:** 35 s a 30 fps (1050 fotogramas). Composiciones `NovedadesVertical` (1080×1920) y `NovedadesHorizontal` (1920×1080)
- **Archivos** (en `out/`): `massup-novedades-9x16-con-audio.mp4`, `massup-novedades-16x9-con-audio.mp4` y sus versiones `-sin-audio`
- **Para qué:** anunciar la actualización a quien ya usa el bot (canal de anuncios, servidor de soporte, YouTube) y redes
- **Mismo estilo** que el video del concepto A: oro y azul pizarra, Cinzel e Inter, maquetas de Discord con los textos reales del bot

## Guion con tiempos

| Tiempo | Escena | Lo que se ve | Texto en pantalla |
|---|---|---|---|
| 0:00–0:03 | **Gancho** | Entran seis iconos (⏰ 🧩 💰 🎫 🖥️ 💎) y un contador hasta +6. | «NUEVA ACTUALIZACIÓN» · «MassUp ya no solo **tira pings**» · «+6 novedades» |
| 0:03–0:09 | **Novedad 1 · Mando del Caller** | Mando privado con su descripción real. Clic en ⏰ **Cambiar hora** → panel «Ahora / Nueva», menús `21:xx UTC` y `21:45 UTC` → ✅ **Guardar 21:45 UTC**. El Mando vuelve con «✅ Salida movida a 21:45 UTC» y en el hilo sale «⏰ El Caller cambió la hora de salida… Antes era 21:15.» | «Cambia la hora **sin cerrar** el ping» / «Los anotados, la voz y el hilo se mantienen, y se avisa en el hilo.» |
| 0:09–0:14 | **Novedad 2 · Builds** | La tarjeta de builds real del hilo (generada con el renderizador del bot y los iconos oficiales). Se iluminan los swaps «Boss» del tanque y «Boss» y «Falce 3» del daño. | «**Swaps** en las builds» / «Hasta 3 por rol («Boss», «Falce 3»…) con solo lo que cambia. Se editan en el panel y salen en el hilo.» |
| 0:14–0:19,3 | **Novedad 3 · Loot** | Mensaje público «💰 Loot · Gankeo en Caminos de Avalon»: total, reparaciones, recargo, vendedor y «1.469.000 cada uno». | «Reparto de loot **a partes iguales**» / «Tras el GG: plata, reparaciones, recargo del gremio y vendedor. Con Premium, importa AO Loot Logger.» |
| 0:19,3–0:25,3 | **Novedad 4 · Tickets** | Ticket «🛡️ Reclutamiento · #0042» con Atender, Cerrar, Aceptar y Rechazar. Aparece la ficha de Albion (gremio, alianza, PvP, PvE y recolección). Clic en ✅ **Aceptar** → «✅ @Kaelthorn ha sido aceptado por @Oficial. ¡Bienvenido!» | «Recluta con su **ficha de Albion**» / «PvP, PvE, recolección, gremio y alianza. Al aceptar, el bot le da los roles y el apodo.» |
| 0:25,3–0:30 | **Novedad 5 · Panel web** | panel.massup.shop con la barra lateral por secciones (Actividad, Gremio, Configuración, Cuenta). Pasa de tema claro a oscuro y se pulsa **Recuperar** en el aviso de borrador. | «Panel nuevo, **claro u oscuro**» / «Por secciones y con borradores: si caduca la sesión, no pierdes los cambios.» |
| 0:30–0:35 | **Novedad 6 · Cierre** | Logo, MassUp y el lema. Chips «Gratis · Premium desde $15.000 COP · Mercado Pago» y botón massup.shop. | «Organiza. Convoca. Conquista.» · «Premium con Mercado Pago: tarjeta, PSE o Efecty» |

**Datos de ejemplo:** el personaje (Kaelthorn), su gremio (Iron Wolves), la alianza (Northern Pact) y los números de su ficha son inventados, pero con el formato real de la ficha (`shortNumber`: «48,2 M»). Los números del loot salen de la lógica real del bot (`scripts/lootNumbers.ts`).

### Locución opcional (≈ 32 s)

> MassUp ya no solo tira pings. Esto es lo nuevo.
> ¿Se retrasa la party? Cambia la hora desde el Mando, sin cerrar el ping: nadie pierde su sitio.
> Swaps en las builds: para el boss, solo lo que cambia.
> Al dar GG, reparte el loot a partes iguales, con reparaciones y recargo del gremio.
> Tickets de reclutamiento con la ficha de Albion del jugador. Aceptas y el bot le da roles y apodo.
> Y un panel nuevo, claro u oscuro, que no pierde tus cambios.
> MassUp. Gratis, y Premium desde quince mil pesos con Mercado Pago.

### Texto para la publicación

> ⚔️ Nueva actualización de MassUp: cambia la hora sin cerrar el ping, swaps en las builds, reparto de loot, tickets con ficha de Albion y panel nuevo. Gratis y en español 👉 massup.shop
> #AlbionOnline #Albion #Discord #BotDeDiscord #Gremio #AlbionLatam

## Sonido (versión con audio)

Pista original generada por código (`node scripts/synthAudio.js novedades`), con la misma base épica que el concepto A:

| Tiempo | Efecto |
|---|---|
| 0:00–0:03 | dron grave, subida, un «pop» por icono, campanita en «+6» y golpe en 2,9 s |
| 0:03 | entra la base (bombo, bajo y acordes) |
| 0:04,1 / 0:05,3 / 0:06,5 | clics en Cambiar hora, en el minuto y en Guardar |
| 0:06,7 | campanita del aviso en el hilo |
| 0:10 / 0:10,7 | «pop» al iluminarse cada swap |
| 0:14,4–0:16,4 | monedas al salir cada línea del reparto y campanita en «cada uno» |
| 0:23,1 | clic en Aceptar y acorde de «aceptado» |
| 0:26,9 | clic y barrido descendente al pasar a tema oscuro |
| 0:28,7 | clic en Recuperar |
| 0:30 | golpe, cuerno de guerra y tambores del cierre |

## Grabaciones reales (opcional)

| # | Toma | Sustituye a |
|---|---|---|
| D1 | `/mando` → Cambiar hora → elegir minuto → Guardar, y el aviso en el hilo | 0:03–0:09 |
| D2 | El hilo de un ping con swaps configurados, abriendo la tarjeta de builds | 0:09–0:14 |
| D3 | GG → 💰 Repartir loot → Plata y descuentos → Publicar reparto | 0:14–0:19 |
| D4 | Botón del panel de tickets → formulario con personaje y servidor → ficha → Aceptar | 0:19–0:25 |
| P1 | Panel web: cambiar de tema y recuperar un borrador en Contenidos y builds | 0:25–0:30 |
