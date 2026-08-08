import type { APIRoute } from 'astro';
import { json } from '../../lib/http';
import { ITunesError, searchAlbums } from '../../lib/itunes';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const q = (url.searchParams.get('q') ?? '').trim();
  if (q.length < 2) return json({ albums: [] });

  try {
    return json({ albums: await searchAlbums(q) }, 200, 600);
  } catch (err) {
    const status = err instanceof ITunesError && err.status === 403 ? 429 : 502;
    // El texto que ve el usuario lo escribe la UI, no el endpoint.
    return json({ error: status === 429 ? 'rate_limited' : 'upstream' }, status);
  }
};
