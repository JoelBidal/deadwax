import type { AlbumDetail, AlbumSummary } from './types';

export async function fetchAlbum(id: string, signal?: AbortSignal): Promise<AlbumDetail> {
  const res = await fetch(`/api/album/${id}`, { signal });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? 'upstream');
  }
  const { album } = (await res.json()) as { album: AlbumDetail };
  return album;
}

/** Las portadas de una estantería compartida, en un solo pedido. */
export async function fetchAlbums(ids: string[]): Promise<AlbumSummary[]> {
  if (!ids.length) return [];
  const res = await fetch(`/api/albums?ids=${ids.join(',')}`);
  if (!res.ok) throw new Error('upstream');
  const { albums } = (await res.json()) as { albums: AlbumSummary[] };
  return albums;
}
