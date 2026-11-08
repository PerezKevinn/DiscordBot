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

## Vista previa del banner

`npm run preview:card -- "NOMBRE DEL GREMIO" "[TAG]"` genera `data/preview_banner.png`.
