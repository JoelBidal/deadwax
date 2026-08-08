import type { APIRoute } from 'astro';
import { json } from '../../../lib/http';
import { getAlbum, ITunesError } from '../../../lib/itunes';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const id = params.id ?? '';
  if (!/^\d+$/.test(id)) return json({ error: 'bad_id' }, 400);

  try {
    const album = await getAlbum(id);
    if (!album) return json({ error: 'not_found' }, 404);
    if (album.tracks.length === 0) return json({ error: 'no_previews' }, 404);
    // 10 minutos y no un día: el caché fuerte del navegador deja al cliente con
    // la forma vieja de los datos cada vez que cambia el endpoint. El caché en
    // memoria del servidor ya absorbe el tráfico real.
    return json({ album }, 200, 600);
  } catch (err) {
    const status = err instanceof ITunesError && err.status === 403 ? 429 : 502;
    return json({ error: status === 429 ? 'rate_limited' : 'upstream' }, status);
  }
};
