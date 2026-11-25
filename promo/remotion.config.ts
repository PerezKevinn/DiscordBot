import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
// Colores estándar de video web (BT.709, rango limitado). Sin esto, Remotion sacaba
// yuvj420p de rango completo con matriz BT.601, que los reproductores y las redes
// interpretan mal: el video se ve más saturado y con más contraste que el diseño.
Config.setColorSpace('bt709');
Config.setPixelFormat('yuv420p');
// Navegador propio opcional (p. ej. en servidores sin el Chrome que descarga Remotion)
if (process.env.REMOTION_BROWSER) Config.setBrowserExecutable(process.env.REMOTION_BROWSER);
