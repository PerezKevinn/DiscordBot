# Videos cortos diarios para TikTok

Cada día se genera un video vertical de 13–20 s a partir de la siguiente idea sin usar de `ideas.json`.

```bash
cd promo
npm run daily                 # video de hoy (si ya existe, no hace nada)
npm run daily -- <id>         # una idea concreta (si es de hoy, la vuelve a generar)
npm run daily -- --force      # otro video más hoy
npm run portada               # rehace las portadas de los videos ya generados
```

Sale en `out/diario/<fecha>-<id>/`:
- `video-con-audio.mp4`: con pista propia, sin derechos de terceros.
- `video-sin-audio.mp4`: para ponerle un sonido en tendencia desde TikTok.
- `portada.png`: portada personalizada con la misma plantilla en todos los videos (etiqueta «Albion Online», texto de `cover` con lo destacado en dorado, dos mensajes del chat y el logo). Todo cabe en el recorte 3:4 de la cuadrícula del perfil.
- `publicacion.md`: texto de portada, descripción con CTA y hashtags, comentario para fijar y ajustes.

Lo ya publicado queda en `historial.json`.

## Estructura del video

Ritmo TikTok: nada sale en negro, hay un corte cada 1–4 s y una barra de progreso dorada arriba.

1. **Gancho (2,5–3 s):** titular estilo TikTok (Inter Black blanco con contorno; `*palabra*` en recuadro dorado) visible **desde el fotograma 0**, `kicker` como etiqueta roja («POV», «Nadie:»), y chat de Discord con el problema (`hook.chat`, de 2 a 5 mensajes cortos) que se acerca, suma menciones sin leer y al final tiembla con un destello rojo.
2. **Giro (1,1 s):** destello blanco, sacudida y las palabras de `turn` caen una a una.
3. **Demostración:** escenas reales del bot (`payoff`), cada una entra con golpe de zoom y destello. Se ocultan los «Paso N».
4. **Cierre (3 s):** logo, `tagline`, `chips`, botón massup.shop y «Link en el perfil 👆». Los últimos 8 fotogramas funden con el primero: el video se repite sin corte y suma tiempo de visualización.

Audio: golpe en el primer fotograma, avisos de Discord con cada mensaje, «rayón» y golpe en el giro y golpe seco en cada corte.

Si Remotion no puede descargar su Chrome, usa otro con `REMOTION_BROWSER=/ruta/al/chrome npm run daily`.

Escenas disponibles para `payoff` (duración en fotogramas a 30 fps; conviene que sumen 10 s o menos):

| Clave | Qué muestra | Fotogramas |
|---|---|---|
| `ping` | /ping → asistente → Publicar | 120 |
| `roster` | ping publicado, mención al rol, roster que se llena y banca | 240 |
| `mando` | Mando del Caller: ¡A voz! y GG que borra voz e hilo | 130 |
| `gg` | GG → Repartir loot | 90 |
| `plata` | formulario «Plata y descuentos» | 120 |
| `reparto` | reparto público y pagos marcados | 235 |
| `log` | 💎 Importar log de AO Loot Logger (Premium) | 100 |
| `hora` | ⏰ Cambiar hora desde el Mando | 180 |
| `swaps` | tarjeta de builds con swaps | 150 |
| `lootcorto` | reparto compacto | 160 |
| `tickets` | ticket de reclutamiento con ficha de Albion → Aceptar | 180 |
| `panel` | panel web: claro/oscuro y borrador recuperado | 140 |

## Reglas para escribir ideas nuevas

- **Gancho:** un dolor real de gremio de Albion, con tono de meme. Formatos que funcionan: «POV: …», «Nadie: / El Caller: …», «Tipos de Caller: …», «El que siempre …», «¿Otra vez …?» y «Gremios con vs. sin».
  - Título de 3 líneas como máximo, unos 45 caracteres.
  - Los mensajes del chat, de menos de 40 caracteres, en español latino y con jerga del juego (gank, repas, compo, Caller, wipe).
- **Solo funciones reales del bot**, como las de la tabla.
  - El reparto por total es gratis.
  - El log de AO Loot Logger es Premium.
  - Premium cuesta desde $15.000 COP con Mercado Pago (tarjeta, PSE o Efecty).
  - No inventes funciones ni números.
- **Descripción (`caption`):**
  - Primera línea: el gancho, con humor y un emoji.
  - Después, qué hace MassUp en 1–2 frases.
  - Al final, el CTA: «Gratis y en español 👉 link en el perfil».
  - Sin hashtags: van en `hashtags`, 2 o 3 específicos; los generales (#AlbionOnline #AlbionLatam #MMORPG #Discord) y la línea de búsqueda 🔎 se añaden solos. Máximo 6 en total.
- **`comment`:** una pregunta que invite a comentar o a etiquetar a alguien.
- **`cover`:** texto de portada de 30–55 caracteres. Marca con `*…*` lo que va en dorado; si no marcas nada, se destacan las dos últimas palabras.
- **Variedad:** no repitas la misma escena de `payoff` dos días seguidos y alterna temas (party, loot, Caller, reclutamiento, panel).
- **`id`:** en kebab-case y único. No borres ideas ya usadas, porque el historial apunta a ellas.
