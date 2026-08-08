import { TTLCache } from './cache';
import type { AlbumDetail, AlbumSummary, Track } from './types';

const ITUNES = 'https://itunes.apple.com';
const COUNTRY = 'US';
const TIMEOUT_MS = 8000;

/** Los previewUrl de iTunes duran ~30s. El cliente lo refina con `loadedmetadata`. */
export const PREVIEW_SECONDS = 30;

const searchCache = new TTLCache<AlbumSummary[]>(60 * 60 * 1000);
const albumCache = new TTLCache<AlbumDetail | null>(24 * 60 * 60 * 1000);
const artistCache = new TTLCache<RawAlbum[]>(6 * 60 * 60 * 1000, 80);

type RawAlbum = {
  wrapperType?: string;
  collectionType?: string;
  collectionId?: number;
  collectionName?: string;
  artistName?: string;
  artworkUrl100?: string;
  releaseDate?: string;
  trackCount?: number;
  collectionViewUrl?: string;
};

type RawArtist = {
  artistId?: number;
  artistName?: string;
};

type RawTrack = {
  wrapperType?: string;
  kind?: string;
  trackId?: number;
  trackName?: string;
  trackNumber?: number;
  discNumber?: number;
  trackTimeMillis?: number;
  previewUrl?: string;
};

export class ITunesError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'ITunesError';
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });
  } catch (cause) {
    throw new ITunesError(`iTunes inalcanzable: ${String(cause)}`);
  }
  if (!res.ok) throw new ITunesError(`iTunes respondió ${res.status}`, res.status);
  // iTunes sirve el JSON como text/javascript; res.json() lo parsea igual.
  return (await res.json()) as T;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const dropArticle = (s: string) => s.replace(/^the/, '');

const EDITION_SRC =
  "\\((?:[^)]*\\b(?:deluxe|anniversary|remaster(?:ed)?|master(?:ed)?|expanded|collector'?s|bonus|legacy|special|edition|version|mono|stereo)\\b[^)]*)\\)" +
  '|\\[[^\\]]*\\b(?:deluxe|remaster(?:ed)?|master(?:ed)?|edition)\\b[^\\]]*\\]';
const EDITION_ALL = new RegExp(EDITION_SRC, 'gi');
const EDITION_ONE = new RegExp(EDITION_SRC, 'i');

/** "Disintegration (2010 Remaster)" → "Disintegration". */
export function cleanTitle(name: string): string {
  const stripped = name.replace(EDITION_ALL, '').replace(/\s{2,}/g, ' ').trim();
  return stripped.replace(/[-–—:,]\s*$/, '').trim() || name;
}

/** artworkUrl100 → 600x600bb, que es lo que sirve para una funda. */
export function upgradeArtwork(url: string, size = 600): string {
  return url.replace(/\/\d+x\d+bb\.(jpg|png)$/i, `/${size}x${size}bb.$1`);
}

function titleScore(rest: string, title: string): number {
  const titles = [title, dropArticle(title)];
  const rests = [rest, dropArticle(rest)].filter(Boolean);
  for (const t of titles) {
    for (const r of rests) {
      if (t === r) return 6;
      if (t.startsWith(r)) return 4;
      if (t.includes(r)) return 2;
    }
  }
  return 0;
}

/**
 * El orden que devuelve iTunes no es confiable: "the strokes is this it" trae
 * Angles primero, "pink floyd dark side of the moon" trae The Wall. Rankeamos
 * nosotros separando artista de título.
 */
function score(query: string, r: RawAlbum): number {
  const q = norm(query);
  const artist = norm(r.artistName ?? '');
  const title = norm(cleanTitle(r.collectionName ?? ''));
  let s = 0;

  if (artist && q.includes(artist)) {
    s += 3;
    const rest = q.replace(artist, '');
    s += rest ? titleScore(rest, title) : 2;
  } else {
    s += titleScore(q, title);
  }

  if (EDITION_ONE.test(r.collectionName ?? '')) s -= 2;
  if (r.collectionType && r.collectionType !== 'Album') s -= 1;
  if ((r.trackCount ?? 0) < 4) s -= 2;
  return s;
}

function toSummary(r: RawAlbum): AlbumSummary {
  const year = r.releaseDate ? Number(r.releaseDate.slice(0, 4)) : NaN;
  return {
    id: String(r.collectionId),
    title: cleanTitle(r.collectionName ?? 'Sin título'),
    artist: r.artistName ?? 'Desconocido',
    year: Number.isFinite(year) ? year : null,
    coverUrl: upgradeArtwork(r.artworkUrl100 ?? ''),
    trackCount: r.trackCount ?? 0,
    ...(r.collectionViewUrl ? { url: r.collectionViewUrl } : {}),
  };
}

function toTrack(t: RawTrack): Track {
  const full = t.trackTimeMillis ? Math.round(t.trackTimeMillis / 1000) : undefined;
  return {
    id: String(t.trackId),
    title: cleanTitle(t.trackName ?? 'Sin título'),
    duration: PREVIEW_SECONDS,
    ...(full ? { fullLength: full } : {}),
    src: t.previewUrl!,
  };
}

/**
 * El índice de álbumes de iTunes tiene huecos: "the strokes is this it" no
 * devuelve Is This It en 25 resultados. Resolver el artista y listar su
 * discografía sí lo encuentra, así que buscamos por los dos caminos y unimos.
 */
async function albumsByArtist(query: string): Promise<RawAlbum[]> {
  const key = norm(query);
  const cached = artistCache.get(key);
  if (cached) return cached;

  try {
    const found = await fetchJson<{ results?: RawArtist[] }>(
      `${ITUNES}/search?term=${encodeURIComponent(query)}&entity=musicArtist&limit=8&country=${COUNTRY}`,
    );
    const artist = (found.results ?? []).find(
      (a) => a.artistId && a.artistName && key.includes(norm(a.artistName)),
    );
    if (!artist) {
      artistCache.set(key, []);
      return [];
    }

    const disco = await fetchJson<{ results?: RawAlbum[] }>(
      `${ITUNES}/lookup?id=${artist.artistId}&entity=album&limit=200&country=${COUNTRY}`,
    );
    const albums = (disco.results ?? []).filter(
      (r) => r.wrapperType === 'collection' && r.collectionId && r.artworkUrl100,
    );
    artistCache.set(key, albums);
    return albums;
  } catch {
    return []; // la búsqueda directa alcanza para responder algo
  }
}

export async function searchAlbums(query: string, limit = 8): Promise<AlbumSummary[]> {
  const key = `${norm(query)}:${limit}`;
  const cached = searchCache.get(key);
  if (cached) return cached;

  const [direct, byArtist] = await Promise.all([
    fetchJson<{ results?: RawAlbum[] }>(
      `${ITUNES}/search?term=${encodeURIComponent(query)}&entity=album&limit=25&country=${COUNTRY}`,
    ).then((d) => d.results ?? []),
    albumsByArtist(query),
  ]);

  // El offset hace que, a igual puntaje, gane el orden de relevancia de iTunes.
  const best = new Map<string, { r: RawAlbum; s: number; i: number }>();
  for (const [offset, list] of [direct, byArtist].entries()) {
    list.forEach((r, i) => {
      if (!r.collectionId || !r.artworkUrl100) return;
      const id = String(r.collectionId);
      const entry = { r, s: score(query, r), i: offset * 1000 + i };
      const prev = best.get(id);
      if (!prev || entry.s > prev.s) best.set(id, entry);
    });
  }

  const ranked = [...best.values()]
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, limit)
    .map(({ r }) => toSummary(r));

  searchCache.set(key, ranked);
  return ranked;
}

export async function getAlbum(id: string): Promise<AlbumDetail | null> {
  const cached = albumCache.get(id);
  if (cached !== undefined) return cached;

  const url = `${ITUNES}/lookup?id=${encodeURIComponent(id)}&entity=song&country=${COUNTRY}`;
  const data = await fetchJson<{ results?: Array<RawAlbum & RawTrack> }>(url);
  const results = data.results ?? [];

  const collection = results.find((r) => r.wrapperType === 'collection');
  if (!collection?.collectionId) {
    albumCache.set(id, null);
    return null;
  }

  const tracks = results
    .filter((r): r is RawTrack => r.wrapperType === 'track' && Boolean(r.previewUrl))
    .sort((a, b) => (a.discNumber ?? 1) - (b.discNumber ?? 1) || (a.trackNumber ?? 0) - (b.trackNumber ?? 0))
    .map(toTrack);

  const album: AlbumDetail = { ...toSummary(collection), tracks };
  albumCache.set(id, album);
  return album;
}
