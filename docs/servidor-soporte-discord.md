# Servidor oficial: MassUp · Soporte y Comunidad

- **ID del servidor:** `1568989522413228123`
- **Web:** https://www.massup.shop · **Panel:** https://panel.massup.shop
- **Invitar el bot:** el enlace de "Añadir a Discord" de la web (permisos `395539893264`).
- **Invitación al servidor:** la web ya enlaza `https://discord.gg/PwePmR8gak`. Si no es de este
  servidor, crea una nueva (paso 10) y cámbiala en la web.

Todo lo de abajo se hace a mano desde Discord. El orden importa: primero roles, luego canales,
luego Comunidad (que pide canales que ya existan), y al final el bot.

---

## Parte 1 · Pasos para montarlo

### 1. Ajustes básicos y seguridad de la cuenta
1. Activa la **autenticación en dos pasos** en tu cuenta (Ajustes de usuario → Mi cuenta).
2. Ajustes del servidor → **Seguridad / Moderación**:
   - **Requerir 2FA para acciones de moderación**: activado.
   - **Nivel de verificación: Alto** (correo verificado y 10 minutos en el servidor antes de escribir).
   - **Filtro de contenido explícito:** analizar mensajes de todos los miembros.
   - **Protección de MD/spam:** activa el aviso de mensajes sospechosos y la protección contra raids.
3. Sube el icono (el logo de MassUp) y el banner si tienes.

### 2. Roles (Ajustes → Roles), de arriba abajo
Crea los roles en este orden: Discord pone arriba el último que creas, así que luego
arrástralos para que queden así. **Ninguno lleva el permiso Administrador.**

| # | Rol | Color / mostrar aparte | Permisos de servidor (todo lo demás, desactivado) |
|---|---|---|---|
| 1 | `@Staff` | Rojo, mostrar aparte | Ver canales · Enviar mensajes · Enviar en hilos · Crear hilos públicos/privados · Insertar enlaces · Adjuntar · Historial · Añadir reacciones · Usar emojis externos · Conectar · Hablar · **Gestionar mensajes · Gestionar hilos · Aislar temporalmente · Expulsar · Banear · Gestionar apodos · Ver registro de auditoría · Silenciar/ensordecer/mover miembros** |
| 2 | `@Soporte` | Azul, mostrar aparte | Ninguno extra (los permisos van por canal, ver paso 4) |
| 3 | `@MassUp` | (lo crea el bot) | Ver paso 9 |
| 4 | `@Premium` | Dorado, mostrar aparte | Ninguno extra |
| 5 | `@Verificado` | Sin color | Adjuntar archivos · Insertar enlaces · Conectar · Hablar · Vídeo · Usar actividad de voz |
| 6 | `@Avisos` | Sin color | Ninguno. **"Permitir que cualquiera mencione este rol": desactivado** |
| 7 | `@Líder/Caller`, `@Jugador` | Sin color | Ninguno |
| 8 | `@América`, `@Europa`, `@Asia` | Sin color | Ninguno |

**`@everyone` (lo más importante):**
- Activado: Ver canales · Enviar mensajes · Enviar mensajes en hilos · Leer historial · Añadir
  reacciones · Usar emojis externos · Cambiar apodo · Usar comandos de aplicación.
- **Desactivado:** Mencionar @everyone, @here y todos los roles · **Crear invitación** · Gestionar
  cualquier cosa · **Usar aplicaciones externas** · Crear expresiones · Crear encuestas · Enviar
  mensajes de voz · Usar actividades · Adjuntar archivos · Insertar enlaces · Crear hilos (públicos y
  privados) · Conectar/Hablar (la voz es para `@Verificado`).

> Por qué: sin *Crear invitación* nadie reparte enlaces raros con el nombre del servidor; sin
> *Usar aplicaciones externas* nadie mete spam con apps instaladas en su cuenta; sin *Mencionar
> @everyone* el bot tampoco dejará a nadie usar `@here`/`@everyone` en `/ping`, porque comprueba ese
> permiso en el canal.

### 3. Categorías y canales
Crea las categorías y pon los permisos **en la categoría**; luego crea los canales dentro y deja
que se sincronicen. Leyenda: ✅ permitir · ❌ denegar · (vacío) heredar.

**📌 INFORMACIÓN**: `@everyone`: Enviar mensajes ❌ · Crear hilos ❌ · Añadir reacciones ✅ · `@Staff`: Enviar mensajes ✅
- `#bienvenida`
- `#reglas`
- `#anuncios`: tipo **Anuncios**. Extra: `@Staff` → Mencionar @everyone ✅ (solo aquí, para poder mencionar `@Avisos`).
- `#novedades`: tipo **Anuncios**.
- `#estado-del-bot`: tipo **Anuncios**.

**📘 GUÍAS**: `@everyone`: Enviar mensajes ❌ · Crear publicaciones ❌ · Enviar mensajes en hilos ❌ · `@Staff`: todo eso ✅
- `#empieza-aquí` (texto)
- `#guías` (**foro**). Etiquetas: Pings · Mando · Puntos y ranking · Tickets · Panel web · Premium. Vista: lista.
- `#preguntas-frecuentes` (texto)

**🛟 SOPORTE**: `@Soporte`: Gestionar hilos ✅ · Gestionar mensajes ✅
- `#ayuda` (**foro**)
  - Etiquetas: Pings · Mando · Puntos y ranking · Tickets · Panel web · Premium/Pagos · Otro, más las de
    estado Pendiente · ✅ Resuelto · Esperando respuesta. Las de estado se marcan como **"Solo
    moderadores"** para que solo el staff pueda ponerlas.
  - **Requerir etiqueta**: activado.
  - Modo lento de publicaciones: 10 min · Ocultar tras inactividad: 3 días · Orden: actividad reciente.
  - `@everyone`: Crear publicaciones ✅ · Enviar mensajes en hilos ✅ · Adjuntar ✅ · Insertar enlaces ✅
    (en soporte hacen falta las capturas).
  - Pautas: texto **B2** de abajo.
- `#reportar-bug` (**foro**), con los mismos permisos que `#ayuda`.
  - Etiquetas: Pings · Mando · Puntos · Tickets · Panel web · Pagos · Otro, más En revisión · Confirmado ·
    Arreglado · No reproducible (estas cuatro, solo moderadores).
  - Requerir etiqueta. Pautas: texto **B3**.
- `#sugerencias` (**foro**)
  - Etiquetas: En estudio · Planeado · Hecho · Descartado (solo moderadores), más una de tema.
  - Reacción por defecto 👍 · Modo lento de publicaciones: 1 h · Pautas: texto **B4**.
- `#soporte-privado` (texto): el sistema de tickets sin bot.
  - `@everyone`: Enviar mensajes ❌ · Crear hilos públicos ❌ · **Crear hilos privados ✅** ·
    Enviar mensajes en hilos ✅ · Adjuntar ✅.
  - `@Staff` ya tiene Gestionar hilos, así que ve todos los hilos privados; cada usuario solo ve el suyo.
  - Fija el mensaje **B5**.

**💬 COMUNIDAD**
- `#general`: modo lento 5 s.
- `#off-topic`
- `#busco-gremio` (**foro**)
  - Etiquetas: Busco gremio · Gremio recluta · América · Europa · Asia · ZvZ · Pequeña escala · PvE ·
    Gathering · Avalon.
  - `@everyone`: Crear publicaciones ✅ · Enviar mensajes en hilos ✅. Modo lento de publicaciones: 6 h (el máximo de Discord).
  - Pautas: texto **B6**. Este canal se excluye de la regla de AutoMod de invitaciones.
- `#muestra-tu-gremio` (canal de **Multimedia**, o de texto): `@Verificado`: Adjuntar ✅.
- 🔊 `Charla`: la voz ya está limitada a `@Verificado` por los permisos de servidor.

**🧪 ZONA DE PRUEBAS**: `@everyone`: Ver canal ❌ · `@Verificado`: Ver canal ✅
- `#probar-bot`: modo lento 30 s. Fija el mensaje **B8**.
- Categoría aparte **🔊 VOCES DE PRUEBA** (vacía): `@everyone`: Ver ❌ · `@Verificado`: Ver ✅ ·
  Conectar ✅ · `@MassUp`: Ver ✅ · **Gestionar canales ✅** · Conectar ✅. El bot crea aquí las voces
  temporales.

**⭐ PREMIUM**
- `#premium` (texto, visible para todos, solo lectura): `@everyone`: Enviar mensajes ❌. Fija **B9**.
- `#club-premium`: `@everyone`: Ver ❌ · `@Premium`: Ver ✅ · `@Staff`: Ver ✅.

**🛡️ STAFF**: `@everyone`: Ver ❌ · `@Staff`: Ver ✅ · `@MassUp`: no lo añadas.
- `#staff`
- `#registro-mod`
- 🔊 `Staff`

### 4. Activar Comunidad
Ajustes → **Activar Comunidad**. El asistente pide:
- Nivel de verificación (ya está), filtro (ya está).
- **Canal de reglas:** `#reglas`.
- **Canal de actualizaciones de la comunidad** (avisos de Discord para moderadores): `#registro-mod`.
- Notificaciones por defecto: **Solo menciones** (esto evita que la gente silencie el servidor).

Luego, en Ajustes → Comunidad → Información general:
- Idioma principal: **Español**.
- Descripción: texto **C1**.
- Canal de avisos de seguridad: `#registro-mod`.

### 5. Reglas del servidor (pantalla de aceptación)
Ajustes → **Acceso** (en versiones antiguas, *Verificación de miembros*): activa
**"Los miembros deben aceptar las reglas"** y pega las reglas cortas del texto **A2**, una por línea.
Pega también la versión larga **A1** como mensaje en `#reglas`.

### 6. Onboarding (Ajustes → Onboarding)
1. **Canales predeterminados.** Discord pide al menos 7, y en 5 de ellos `@everyone` debe poder
   escribir. Marca:
   - Para escribir: `#ayuda`, `#reportar-bug`, `#sugerencias`, `#general`, `#busco-gremio`.
   - Solo lectura: `#bienvenida`, `#anuncios`, `#novedades`, `#empieza-aquí`, `#premium`.
2. **Preguntas** (texto **D**):
   - Pregunta 1, **obligatoria**: cualquier respuesta da `@Verificado`.
   - Preguntas 2 a 4, opcionales: rol en el gremio, servidor de Albion y avisos.
3. **Guía del servidor**:
   - Mensaje de bienvenida: **C2**.
   - Tareas para nuevos miembros: **C3**.
   - Páginas de recursos: `#empieza-aquí`, `#premium`, `#soporte-privado`, `#preguntas-frecuentes`.
4. Activa el onboarding y pruébalo con *Ver servidor como rol*.

### 7. AutoMod (Ajustes → AutoMod)
Envía todas las alertas a `#registro-mod`. Exime a `@Staff` en todas las reglas.

| Regla | Ajuste |
|---|---|
| Spam de menciones | Bloquear y aislar 10 min con **5** menciones únicas o más |
| Contenido sospechoso de spam | Bloquear |
| Palabras marcadas con frecuencia | Activar las 3 listas (insultos, contenido sexual, ofensas) |
| Nombres de perfil | Bloquear nombres con las palabras de "Estafas" (abajo) |
| **Estafas** (palabras clave) | Bloquear + alerta. Lista en **E1** |
| **Invitaciones** (regex) | Bloquear + alerta. Regex en **E2**. Exime `#busco-gremio` |
| **Compraventa en Albion** (palabras clave) | Bloquear + alerta. Lista en **E3** |

### 8. Foros: detalles útiles
- En cada foro, **Pautas de publicación** = el texto correspondiente (B2, B3, B4, B6). Discord las
  muestra al crear un post.
- Cuando un post de `#ayuda` se resuelve, el staff pone **✅ Resuelto** y lo **cierra** (Cerrar
  publicación). Así queda como FAQ que se puede buscar, sin que nadie siga escribiendo ahí.
- Si un problema de `#ayuda` es un bug, pásalo a `#reportar-bug` con la etiqueta *Confirmado* y
  enlaza el post original.
- Respuesta rápida para pedir datos de pago: "Eso mejor por `#soporte-privado`, no publiques datos
  de pagos aquí."

### 9. Añadir el bot MassUp y recortarle permisos
1. Invita el bot con el enlace de la web y elige este servidor.
2. Ajustes → Roles → `@MassUp`: **desactiva *Gestionar canales* y *Mencionar @everyone***. Los
   demás permisos que trae (ver, enviar, insertar enlaces, adjuntar, historial, hilos públicos,
   enviar en hilos, gestionar hilos) se quedan.
3. *Gestionar canales* ya se lo diste solo en **🔊 VOCES DE PRUEBA** (paso 3). Es lo único que necesita
   para crear y borrar las voces temporales.
4. Ajustes → **Integraciones → MassUp → Comandos**:
   - Permisos de canales: **"Todos los canales" ❌**, y permitidos solo `#probar-bot` y `#club-premium`.
   - `/canjear`, `/panel`, `/panel-ping` y `/plan-admin` ya piden Gestionar servidor, Gestionar
     mensajes o Administrador, así que nadie más los ve. No hace falta tocarlos.
5. En el **panel web** (`/panel` en `#probar-bot`), configura este servidor:
   - **Rol de Caller:** `@Verificado`, para que cualquiera pueda probar `/ping`.
   - **Canal:** `#probar-bot`.
   - **Categoría de voz:** 🔊 VOCES DE PRUEBA.
6. Opcional: dale Premium a este servidor con `/plan-admin` desde tu servidor, para enseñar el logo
   y la marca propia. Ojo: con Premium caben 25 pings abiertos en lugar de 3. El modo lento de 30 s
   lo frena, pero vigila el canal la primera semana.
7. Haz una prueba completa con una cuenta secundaria o *Ver servidor como rol → Verificado*:
   `/ping`, apuntarse, `/mando`, la voz temporal, `/puntos` y `/ranking`.

### 10. Invitación permanente
- Botón derecho en `#bienvenida` → Invitar → editar: **No caduca nunca**, usos ilimitados, sin
  "membresía temporal". Es el único enlace oficial.
- Si el servidor llega a nivel 3 de mejoras, pide la URL personalizada (p. ej. `discord.gg/massup`).
- Revisa de vez en cuando Ajustes → **Invitaciones** y borra las que no reconozcas.

### 11. Comprobación final (*Ver servidor como rol*)
- **`@everyone` sin verificar:** ve INFORMACIÓN, GUÍAS, SOPORTE, COMUNIDAD y `#premium`; puede
  escribir en foros de soporte, `#general` y `#busco-gremio`; **no** ve PRUEBAS, STAFF ni
  `#club-premium`; no puede adjuntar fuera de soporte ni crear invitaciones.
- **`@Verificado`:** además ve PRUEBAS y la voz, y `/ping` solo funciona en `#probar-bot`.
- **`@Premium`:** además ve `#club-premium`.
- **`@Staff`:** ve STAFF, puede cerrar posts y aislar, pero **no** puede tocar roles, canales ni webhooks.

---

## Parte 2 · Textos listos para pegar

Cada bloque cabe en un mensaje de Discord (menos de 2000 caracteres).

### A1 · `#reglas` (mensaje)

```
📜 **Reglas de MassUp · Soporte y Comunidad**

**1. Respeto ante todo.** Nada de insultos, acoso, racismo, homofobia ni ataques personales. Discutir está bien; faltar al respeto, no.
**2. Nada de spam.** Ni flood, ni mayúsculas sin parar, ni menciones masivas, ni publicidad que nadie pidió.
**3. Invitaciones solo en #busco-gremio.** Ahí puedes reclutar o buscar gremio. En el resto del servidor no se comparten invitaciones.
**4. Sin compraventa.** Prohibido vender o comprar silver, oro, cuentas o servicios de Albion (RMT). Va contra las reglas del juego y suele ser estafa.
**5. Cada cosa en su canal.** Las dudas van a #ayuda, los errores a #reportar-bug y las ideas a #sugerencias. Antes de preguntar, busca: quizá ya está resuelto.
**6. Tus datos son tuyos.** No publiques correos, comprobantes de pago ni datos personales. Para pagos y Premium usa #soporte-privado.
**7. El staff nunca te pedirá tu contraseña** ni que escanees un QR. Si alguien lo hace, avísanos.
**8. Nada de contenido NSFW, gore ni ilegal.**
**9. Nombres y avatares apropiados.** Sin suplantar al staff ni a MassUp.
**10. Sigue las normas de Discord:** https://discord.com/terms y https://discord.com/guidelines

El staff puede aislar, expulsar o banear según la gravedad. Si ves algo raro, menciona a un @Staff o escribe en #soporte-privado.

¡Gracias por ayudar a que este sea un buen sitio! ⚔️
```

### A2 · Reglas cortas (pantalla de aceptación, una por línea)

```
Respeta a todos: sin insultos, acoso ni discriminación.
Nada de spam, flood ni menciones masivas.
Las invitaciones a otros servidores solo van en #busco-gremio.
Prohibido comprar o vender silver, oro o cuentas de Albion.
Pregunta en el canal correcto: #ayuda, #reportar-bug o #sugerencias.
No publiques datos personales ni de pagos; para eso está #soporte-privado.
El staff nunca te pedirá tu contraseña ni que escanees un QR.
Sigue las Condiciones y las Normas de la comunidad de Discord.
```

### A3 · `#bienvenida`

```
⚔️ **¡Bienvenido a MassUp · Soporte y Comunidad!**

MassUp es el bot de Discord para gremios de **Albion Online**: pings de contenido con roster, roles y builds con swaps, voz e hilo temporales, Mando del Caller, puntos de actividad con ranking y tickets de reclutamiento con la ficha de Albion del aspirante. Todo en español.

**Empieza por aquí**
📜 Lee #reglas
🚀 Guía rápida en #empieza-aquí
🧪 Prueba el bot en #probar-bot

**¿Necesitas ayuda?**
❓ Dudas → #ayuda
🐞 Errores → #reportar-bug
💡 Ideas → #sugerencias
🔒 Pagos y Premium → #soporte-privado

**Enlaces**
🌐 Web: https://www.massup.shop
🛠️ Panel: https://panel.massup.shop
➕ Añadir MassUp a tu servidor: https://www.massup.shop/#como-empezar

📣 Sigue #anuncios desde tu propio servidor (botón **Seguir**) y recibirás las novedades sin salir de él.
```

### B1 · `#empieza-aquí` (guía rápida)

```
🚀 **Guía rápida de MassUp**

**1. Añádelo a tu servidor**
Desde https://www.massup.shop pulsa **Añadir a Discord**. No pide Administrador: solo lo justo para publicar pings, crear el hilo y la voz temporal.

**2. Configúralo en el panel**
Escribe `/panel` (necesitas *Gestionar servidor*) y entra en https://panel.massup.shop. Ahí eliges:
• el **rol de Caller** (quién puede hacer pings),
• el **canal** de pings y la **categoría** de las voces temporales,
• los **contenidos** con su compo y builds por rol,
• los avisos por contenido y la marca (Premium),
• los **tickets**: tipos (reclutamiento, soporte…), staff, preguntas y el panel con los botones.

**3. Comandos**
`/ping`: el Caller arma un ping (contenido, hora, roster con roles y builds).
`/mando`: Mando del Caller privado: En ruta, ¡A voz!, GG, Cancelar y puntos.
`/panel-ping`: deja en un canal un panel fijo para que los Callers abran pings con un botón.
`/plan`: plan del servidor (Gratis o Premium) y qué incluye.
`/ranking`: ranking de puntos de actividad.
`/puntos`: tus puntos o los de otro jugador.
`/stats`: ficha de Albion de un jugador (PvP, PvE, recolección y gremios).
`/ticket`: añade o quita gente, renombra o cierra el ticket del canal.
`/canjear`: canjea un código de Premium (necesitas *Gestionar servidor*).

**4. Pruébalo aquí**
En #probar-bot puedes usar `/ping` y `/mando` sin miedo: es una zona de pruebas.

¿Te atascas? Abre un post en #ayuda 💬
```

### B2 · Pautas del foro `#ayuda`

```
❓ **Cómo pedir ayuda (y que te respondan rápido)**

1. **Busca primero**: puede que ya esté resuelto (mira los posts con ✅ Resuelto y #preguntas-frecuentes).
2. **Un post por problema**, con un título claro. Ejemplo: "El ping no crea la voz temporal".
3. **Elige la etiqueta** del tema.
4. Cuenta:
   • qué intentabas hacer y qué comando usaste,
   • qué pasó (el mensaje de error exacto o una captura),
   • si es en tu servidor, su **ID** (Ajustes del servidor → Widget, o botón derecho en el servidor → Copiar ID con el modo desarrollador activado).
5. **No pongas datos de pago ni correos aquí**. Para eso está #soporte-privado.

Cuando se resuelva, el staff lo marcará con ✅ y lo cerrará. ¡Gracias!
```

### B3 · Pautas del foro `#reportar-bug`

```
🐞 **Reportar un error**

Copia esta plantilla en tu post:

**Qué hice:** (comando y pasos, uno por línea)
**Qué esperaba:**
**Qué pasó:** (mensaje de error o captura)
**¿Pasa siempre?** Sí / A veces / Solo una vez
**ID del servidor:**
**Fecha y hora aproximada** (y tu país):

Un bug por post. Si ya existe uno igual, deja un 👍 o comenta en ese en lugar de abrir otro.
⚠️ Si encuentras un fallo de seguridad, no lo publiques: escríbelo en #soporte-privado.
```

### B4 · Pautas del foro `#sugerencias`

```
💡 **Sugerencias**

¿Qué echas en falta en MassUp? Cuéntalo aquí:
• **Una idea por post**, con un título que la resuma.
• Explica **el problema** que resuelve en tu gremio, no solo la solución.
• Antes de publicar, busca: si ya existe, vota con 👍 y comenta.

El staff irá marcando: 🔍 En estudio · 📅 Planeado · ✅ Hecho · ❌ Descartado (con el motivo).
```

### B5 · `#soporte-privado` (mensaje fijado)

```
🔒 **Soporte privado**

Úsalo para **pagos, Premium, códigos o cualquier tema con datos personales**.

**Cómo abrir un caso:**
1. Pulsa el botón **#** (Hilos) de arriba a la derecha → **Crear hilo**.
2. Elige **Hilo privado** y ponle tu nombre de usuario como título.
3. Escribe tu caso. Solo tú y el staff podréis verlo.

Para pagos, incluye:
• el **ID del servidor** donde querías el Premium,
• la **fecha** y el **plan** (1, 3 o 12 meses),
• el **número de operación** de Mercado Pago (nunca la tarjeta ni la contraseña).

⏰ Respondemos lo antes posible. No hace falta mencionar al staff.
```

### B6 · Pautas del foro `#busco-gremio`

```
🛡️ **Busco gremio / Gremio recluta**

Pon las etiquetas: si **buscas** o **reclutas**, tu **servidor** (América, Europa o Asia) y el **contenido**.

**Si reclutas:** nombre del gremio y alianza, horario (con zona horaria), contenido, requisitos (IP, fama, specs) y la invitación a tu Discord.
**Si buscas:** tu nick, rol y armas principales, horario y qué contenido te gusta.

Un post por gremio o jugador; actualízalo en lugar de abrir otro. Modo lento: 1 post cada 6 h.
🚫 Nada de compraventa de silver, oro ni cuentas.
```

### B7 · `#preguntas-frecuentes`

```
❓ **Preguntas frecuentes**

**¿MassUp es gratis?**
Sí. El plan Gratis incluye pings con roster, builds, voz e hilo temporales, Mando del Caller, puntos y tickets con ficha de Albion. Premium amplía los límites y añade marca propia, gremios anteriores en la ficha y transcripciones con formato (mira #premium).

**El bot no crea los tickets.**
Necesita *Gestionar canales* y *Gestionar roles* (o *Crear hilos privados* si el ticket es en hilo). Si añadiste MassUp antes de que existieran los tickets, dale esos permisos a su rol o vuelve a invitarlo. La pestaña Tickets del panel avisa de lo que falta.

**¿Por qué no aparece /ping?**
Revisa que tengas el rol de Caller configurado en el panel, y que el comando no esté bloqueado en ese canal (Ajustes del servidor → Integraciones → MassUp).

**No se crea la voz temporal.**
El bot necesita *Gestionar canales* en la categoría de voz elegida en el panel. Revisa los permisos de esa categoría.

**¿Por qué no puedo usar @here o @everyone en el ping?**
MassUp solo lo permite si tú ya tienes ese permiso en Discord, en ese canal.

**¿El Premium es por usuario o por servidor?**
Por servidor. Lo activa quien lo paga o canjea el código en el servidor del gremio.

**Pagué y no se activó el Premium.**
Abre un hilo en #soporte-privado con el ID del servidor y el número de operación.

**¿Necesita permisos de Administrador?**
No, y no se los des. Pide solo lo necesario.
```

### B8 · `#probar-bot` (mensaje fijado)

```
🧪 **Zona de pruebas**

Aquí puedes probar MassUp sin miedo:
• `/ping` para armar un ping de prueba y apuntarte con los botones.
• `/mando` para abrir el Mando del Caller de tus pings.
• `/puntos` y `/ranking` para ver los puntos.
• `/stats` con el nombre de tu personaje para ver tu ficha de Albion.

Las voces temporales aparecen en 🔊 VOCES DE PRUEBA y se borran solas.
Hay modo lento de 30 s y como mucho unos pocos pings abiertos a la vez: ciérralos cuando acabes con `/mando` → Cancelar.

¿Algo no funciona como esperabas? Cuéntalo en #reportar-bug 🐞
```

### B9 · `#premium`

```
⭐ **MassUp Premium**

Premium es **por servidor**: lo activas una vez y lo aprovecha todo tu gremio.

| | Gratis | Premium |
|---|---|---|
| Pings abiertos a la vez | 3 | 25 |
| Tipos de contenido | 12 | 25 |
| Ranking semanal y mensual | — | ✅ |
| Logo propio en el banner | — | ✅ |
| Marca propia (nombre, siglas, lema, color) | — | ✅ |
| Sin el pie "Creado con MassUp" | — | ✅ |

**Precios** (Colombia, COP, con Mercado Pago)
• 1 mes: **$15.000**
• 3 meses: **$40.000**
• 12 meses: **$150.000**

**Cómo conseguirlo**
💳 En https://www.massup.shop/#planes, pagando con Mercado Pago.
🎟️ Con un código: `/canjear` en tu servidor (necesitas *Gestionar servidor*).
💜 Con la suscripción de Discord, desde el perfil del bot.

Con `/plan` ves el plan actual de tu servidor.
¿Dudas con un pago? Ve a #soporte-privado.
Si tienes Premium, pide el rol @Premium en #soporte-privado y entra en #club-premium ✨
```
> Discord no dibuja tablas: si la ves descuadrada, cámbiala por una lista. Publica este mensaje
> **cuando los pagos salgan del modo prueba**. Hasta entonces, cambia la línea de Mercado Pago por
> "💳 Pago con Mercado Pago: muy pronto".

### C1 · Descripción del servidor (Comunidad / Descubrimiento)

```
Servidor oficial de MassUp, el bot en español para gremios de Albion Online: pings con roster y builds, Mando del Caller, voz temporal, puntos de actividad y tickets de reclutamiento. Soporte, guías, novedades y comunidad.
```

### C2 · Mensaje de bienvenida del onboarding

```
¡Hola! Aquí tienes soporte, guías y novedades de MassUp, el bot para gremios de Albion Online. Responde la primera pregunta para desbloquear la zona de pruebas.
```

### C3 · Tareas para nuevos miembros (Guía del servidor)

| Tarea | Canal |
|---|---|
| Lee la guía rápida | `#empieza-aquí` |
| Prueba `/ping` en la zona de pruebas | `#probar-bot` |
| Sigue los anuncios desde tu servidor | `#anuncios` |
| Preséntate o busca gremio | `#busco-gremio` |

### D · Preguntas del onboarding

1. **¿Qué te trae por aquí?** (obligatoria, una respuesta). Todas dan `@Verificado`:
   - 🛠️ Uso MassUp en mi gremio y necesito ayuda
   - 👀 Quiero conocer MassUp antes de añadirlo
   - ⚔️ Busco gremio o jugadores
   - 💬 Solo vengo a pasar el rato
2. **¿Qué haces en tu gremio?** (opcional)
   - 📣 Soy líder u oficial / Caller → `@Líder/Caller`
   - 🗡️ Soy jugador → `@Jugador`
3. **¿En qué servidor de Albion juegas?** (opcional, varias respuestas)
   - 🌎 América → `@América`
   - 🌍 Europa → `@Europa`
   - 🌏 Asia → `@Asia`
4. **¿Quieres que te avisemos de novedades?** (opcional)
   - 🔔 Sí, menciónenme en los anuncios importantes → `@Avisos`

### E · AutoMod

**E1 · Estafas** (palabras clave; el `*` es comodín)
```
*nitro gratis*, *free nitro*, *nitro free*, *discord nitro for free*, *steamcommunity.com/gift*, *steam gift*, *regalo de steam*, *airdrop*, *giveaway*, *@everyone http*, *grabify*, *iplogger*, *bit.ly/*, *tinyurl.com/*, *is.gd/*, *cutt.ly/*, *shorturl*, *qr code login*, *escanea el qr*, *verify your account*, *verifica tu cuenta*
```

**E2 · Invitaciones** (regex, una por línea)
```
(?i)discord(?:app)?\.(?:gg|io|me|li)/\S+
(?i)discord(?:app)?\.com/invite/\S+
```

**E3 · Compraventa en Albion** (palabras clave)
```
*vendo silver*, *compro silver*, *vendo plata*, *compro plata*, *vendo oro*, *compro oro*, *vendo cuenta*, *compro cuenta*, *venta de cuentas*, *silver barato*, *rmt*
```
> Si `*rmt*` bloquea palabras legítimas, cámbialo por `rmt` sin comodines.

### F · Primer anuncio (en `#anuncios`)

```
🎉 **¡Abrimos el servidor oficial de MassUp!** @Avisos

Este es el sitio para:
❓ Resolver dudas en #ayuda
🐞 Reportar errores en #reportar-bug
💡 Proponer ideas en #sugerencias
🧪 Probar el bot en #probar-bot
🛡️ Encontrar gremio o reclutar en #busco-gremio

Pulsa **Seguir** en este canal para recibir las novedades de MassUp directamente en el servidor de tu gremio.

Invita a tus oficiales y Callers: https://discord.gg/PwePmR8gak
```
