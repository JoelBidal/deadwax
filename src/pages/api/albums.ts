import type { APIRoute } from 'astro';
import { json } from '../../lib/http';
import { getAlbum } from '../../lib/itunes';
import { MAX_RECORDS } from '../../lib/shelf';

export const prerender = false;

/**
 * Las portadas de una estantería compartida, en un pedido en vez de N. Devuelve
 * sólo el resumen: los tracks se traen al poner el disco.
 */
export const GET: APIRoute = async ({ url }) => {
  const ids = (url.searchParams.get('ids') ?? '')
    .split(',')
    .filter((id) => /^\d+$/.test(id))
    .slice(0, MAX_RECORDS);

  if (!ids.length) return json({ albums: [] });

  // Un disco que ya no existe no puede tumbar la estantería entera.
  const found = await Promise.all(ids.map((id) => getAlbum(id).catch(() => null)));
  const albums = found.flatMap((album) => {
    if (!album) return [];
    const { tracks: _tracks, ...summary } = album;
    return [summary];
  });

  return json({ albums }, 200, 600);
};
