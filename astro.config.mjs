import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';

/*
 * `site` se resuelve en el build, no en runtime, y sin él og:url y el canonical
 * salen con el host de la request, que detrás del proxy de Vercel es el interno.
 * SITE_URL manda; si no está, Vercel expone el dominio de producción.
 */
const site =
  process.env.SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:4321');

// 'static' + adapter: la galería se prerenderiza, sólo /api y la home corren
// on-demand vía `export const prerender = false`.
export default defineConfig({
  site,
  output: 'static',
  adapter: vercel(),
  integrations: [react()],
  vite: {
    ssr: {
      /*
       * GSAP entra al bundle del servidor en vez de quedar como dependencia
       * externa. Su package.json publica `module: "index.js"` pero no declara
       * `"type": "module"`, así que ese archivo es ESM con nombre de CJS. Node
       * 22 local lo salva detectando la sintaxis; el runtime de Vercel lo carga
       * por el loader CJS y revienta con "Cannot use import statement outside a
       * module". Empaquetado, Node nunca lo resuelve desde node_modules.
       *
       * Sólo se usa en el navegador: en el servidor es peso muerto que igual se
       * evalúa en cada arranque en frío. Sacarlo del todo es mover los imports
       * adentro de los efectos, pero eso vuelve async el useLayoutEffect que
       * mide el FLIP del disco, y ahí la transición pierde su cuadro inicial.
       */
      noExternal: ['gsap'],
    },
  },
});
