# Videos cortos diarios para TikTok

Cada día se genera un video vertical de 13–20 s a partir de la siguiente idea sin usar de `ideas.json`.

```bash
cd promo
npm run daily                 # video de hoy (si ya existe, no hace nada)
npm run daily -- <id>         # una idea concreta (si es de hoy, la vuelve a generar)
npm run daily -- --force      # otro video más hoy
```

Sale en `out/diario/<fecha>-<id>/`:
- `video-con-audio.mp4`: con pista propia, sin derechos de terceros.
- `video-sin-audio.mp4`: para ponerle un sonido en tendencia desde TikTok.
- `portada.png`.
- `publicacion.md`: texto de portada, descripción con CTA y hashtags, comentario para fijar y ajustes.

Lo ya publicado queda en `historial.json`.

## Estructura del video

1. **Gancho (2,5–3 s):** frase grande arriba (`hook.title`, con `*palabra*` en oro) y un chat de Discord con el problema (`hook.chat`, de 2 a 5 mensajes cortos). Al final, el chat tiembla.
2. **Giro (1,1 s):** frase a pantalla completa con destello (`turn`).
3. **Demostración:** escenas reales del bot (`payoff`). Se ocultan los «Paso N».
4. **Cierre (4 s):** logo, `tagline`, `chips`, botón massup.shop y «Link en el perfil 👆».

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
  - Sin hashtags: van en `hashtags`, 2 o 3 específicos; los generales se añaden solos.
- **`comment`:** una pregunta que invite a comentar o a etiquetar a alguien.
- **`cover`:** texto de portada de 30–55 caracteres.
- **Variedad:** no repitas la misma escena de `payoff` dos días seguidos y alterna temas (party, loot, Caller, reclutamiento, panel).
- **`id`:** en kebab-case y único. No borres ideas ya usadas, porque el historial apunta a ellas.
