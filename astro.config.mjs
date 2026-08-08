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
});
