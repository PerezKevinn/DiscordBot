# MassUp — Bot de Discord para gremios de Albion Online

MassUp es el centro de mando de tu gremio en Discord. Organiza, convoca y conquista.

**Módulo actual: Pings de contenido.** Pings con roster por roles para
**Gankeo, Grupales, Azules, Dorados, Ava, Facciones, ZvZ/CTA, Hellgate, Rastreo, Escolta** y los que cada servidor cree.
Más módulos de gestión de gremio irán sumándose.

## Cómo funciona

- `/ping` (o el botón del panel) abre un asistente privado: contenido, hora de salida, lugar de masa, IP/tier, montura, compo de roles, canal y a quién avisar.
- El ping sale con banner, roster por rol (los jugadores se anotan desde el menú), banca si el rol está lleno, voz temporal e hilo de builds.
- El Caller tiene **Mando Caller**: *En ruta*, *¡Todos a voz!*, *GG* y *Cancelar*. GG y Cancelar borran la voz y el hilo.
- Limpieza automática: si la party usó la voz y la deja vacía 10 min, el ping se cierra y se borran voz e hilo.
  Si nadie entró nunca a la voz, se borra 30 min después de la salida. Cualquier ping abierto se cierra a las 6 h.

## Comandos

| Comando | Quién | Qué hace |
|---|---|---|
| `/ping` | Callers | Arma un ping |
| `/panel-ping` | Gestionar mensajes | Pone el panel fijo de Callers |
| `/config ver` | Gestionar servidor | Muestra la configuración |
| `/config rol-ping contenido rol` | Gestionar servidor | Rol a avisar por contenido (Gankeo → @Gankeo) |
| `/config rol-ping-defecto rol` | Gestionar servidor | Rol si el contenido no tiene uno propio |
| `/config rol-caller rol` | Gestionar servidor | Solo ese rol puede tirar pings |
| `/config canal-pings canal` | Gestionar servidor | Canal por defecto de los pings |
| `/config categoria-voz categoria` | Gestionar servidor | Dónde se crean las voces temporales |
| `/config marca ...` | Gestionar servidor 💎 | Nombre, siglas, lema, color y logo propios |
| `/config restablecer-plantillas` | Gestionar servidor | Vuelve a las plantillas por defecto |
| `/plan` | Todos | Plan del servidor y qué incluye |
| `/plan-admin` | Solo `BOT_OWNER_ID`, solo en tu servidor | Da o quita Premium a un servidor |

`@here` / `@everyone` solo aparecen en el asistente para quien ya tiene ese permiso en Discord.

## Gratis vs Premium

Los límites están en `src/utils/plans.ts` (`PLAN_LIMITS`). Ahora mismo:

| | Gratis | Premium |
|---|---|---|
| Pings abiertos a la vez | 3 | 25 |
| Tipos de contenido | 12 | 25 |
| Logo en el banner | Icono del servidor | Logo propio |
| Marca propia (nombre/siglas/lema/color) | — | ✅ |
| Pie "Creado con MassUp" | Sí | No |

Hoy el Premium se activa a mano con `/plan-admin`. Para cobrar, el siguiente paso es usar
**Discord App Subscriptions** (SKUs del Developer Portal): en cada interacción `interaction.entitlements`
dice si el servidor pagó, y `getEffectiveTier()` es el único sitio que hay que cambiar.

## Instalación

1. `npm install`
2. Copia `.env.example` a `.env` y rellena `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`, `BOT_OWNER_ID`.
3. `npm run dev` (con `DEV_MODE=true` los comandos aparecen al instante en tu servidor).
4. El enlace de invitación sale en consola al arrancar, con permisos mínimos (sin Administrador).

Para producción: `DEV_MODE=false`, `npm run build` y `npm run start:prod` (o `npm start`) en un VPS.
Los comandos globales pueden tardar un rato en aparecer la primera vez.

## Datos

- `data/guilds/<id>.json`: config de cada servidor (se crea sola al entrar el bot).
- `data/pings/<id>.json`: pings de cada servidor. Los cerrados se limpian a los 3 días.
- `data/logos/<id>.png`: logo propio del servidor (Premium).

### Retención de datos (para la política de privacidad)

| Dato | Cuánto se guarda |
|---|---|
| Pings (IDs, nombres de usuario y apodos de los jugadores anotados) | Hasta 3 días después de cerrarse |
| Configuración, plantillas y logo de un servidor | Mientras el bot esté en él |
| Todo lo anterior si el servidor expulsa al bot | 30 días; si el bot vuelve antes, se conserva |
| Borradores del asistente y editor de compo | Solo en memoria, 30-45 min |

El borrado lo hace `src/utils/dataRetention.ts` cada 6 horas, y también detecta expulsiones ocurridas con el bot apagado.
- Si existe el `data/config.json` antiguo (versión de un solo servidor), al arrancar se migra a `GUILD_ID`
  como Premium y el original queda renombrado a `.migrated`.

Con muchos servidores conviene pasar este almacenamiento a SQLite o Postgres; todo el acceso a datos
está en `src/utils/configManager.ts`.

## Web (inicio, privacidad y términos)

Está en `web/` (HTML y CSS estáticos, sin compilar). Para verla en local: `node scripts/serveWeb.js` y abre http://localhost:4321.

**Antes de publicarla**, busca y rellena lo marcado en rojo:
- `[TU NOMBRE O ALIAS]`, `[TU CORREO DE CONTACTO]`, `[TU PAÍS]`, `[PROVEEDOR]`, `[PAÍS DEL SERVIDOR]` en `privacidad.html` y `terminos.html`.
- `https://discord.gg/CAMBIAR` (en las 3 páginas): la invitación permanente de tu servidor de soporte.

**Publicarla gratis en Vercel** (`web/vercel.json` ya activa URLs limpias y cabeceras de seguridad):

```bash
npx vercel --cwd web          # primera vez: inicia sesión y crea el proyecto
npx vercel --cwd web --prod   # publicar / actualizar
```

DNS en Hostinger: `A @ 76.76.21.21` y `CNAME www cname.vercel-dns.com` (o los valores que muestre Vercel en Settings → Domains).

Luego pon en el Developer Portal (General Information) las URLs `https://massup.shop/terminos` y `https://massup.shop/privacidad`.

La política promete que los registros técnicos duran como máximo 14 días. En el VPS:
`pm2 install pm2-logrotate && pm2 set pm2-logrotate:retain 14`.

## Panel web (panel.massup.shop)

Corre **dentro del proceso del bot** (Fastify) y comparte su configuración en memoria: lo que se cambia en el panel se ve al instante en Discord. La interfaz es una app React en `dashboard/`.

- Login con Discord (scopes `identify` y `guilds`). Solo ves los servidores donde tienes **Gestionar servidor** y el bot está dentro; el permiso se comprueba de nuevo con los datos reales del servidor en cada petición.
- Pestañas: pings activos (cerrar / cancelar), contenidos con su compo y **builds por rol** (buscador con los ítems e iconos oficiales), ajustes (rol de Caller, avisos por contenido, canal, categoría de voz) y marca/logo (Premium).
- Las builds salen en Discord como imagen en el hilo de cada ping y con el botón **📋 Builds**.

### Puesta en marcha

1. **Developer Portal → OAuth2**: añade el redirect `https://panel.massup.shop/auth/callback` y copia el *Client Secret*.
2. **.env** del VPS: `PANEL_URL`, `PANEL_PORT=3000`, `DISCORD_CLIENT_SECRET` y `SESSION_SECRET` (ver `.env.example`). Sin ellas el panel simplemente no arranca.
3. **Compila el panel** (y repite al actualizar):
   ```bash
   npm run panel:install && npm run panel:build
   ```
4. **DNS**: registro `A` `panel` → IP del VPS (en Hostinger o donde gestiones el dominio).
5. **HTTPS con Caddy** en el VPS (certificado automático). `/etc/caddy/Caddyfile`:
   ```
   panel.massup.shop {
       reverse_proxy 127.0.0.1:3000
   }
   ```
   El panel solo escucha en `127.0.0.1`: no es accesible desde fuera sin Caddy.

### Seguridad del panel
Cookies firmadas `HttpOnly` + `SameSite=Lax` (+ `Secure` con HTTPS), comprobación de `Origin` en toda petición que cambia datos (CSRF), límite de peticiones, cabeceras CSP/HSTS, validación estricta con Zod (ítems del catálogo en su hueco, roles/canales que existan en el servidor, textos limpiados) y sesiones solo en memoria.

### Desarrollo
`npm run panel:dev` levanta la interfaz en http://localhost:5173 con recarga en caliente (redirige `/api` y `/auth` al bot en el puerto 3000; pon `PANEL_URL=http://localhost:5173` y ese redirect en el portal).

### Catálogo de ítems
`src/data/itemCatalog.json` sale de los datos públicos del juego. Para actualizarlo tras un parche: `npm run items:update`.

## Vista previa del banner

`npm run samples` genera en `samples/` un banner y una tarjeta de builds de ejemplo (sirve para comprobar fuentes e iconos en un servidor nuevo).
