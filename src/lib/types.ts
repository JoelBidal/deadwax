export type Track = {
  id: string;
  title: string;
  /** Segundos reproducibles: los ~30 que dura el preview. */
  duration: number;
  /** Duración real del track en el álbum. Sólo para mostrar; no es reproducible. */
  fullLength?: number;
  src: string;
};

export type Vinyl = {
  id: string;
  title: string;
  artist: string;
  year: number | null;
  coverUrl: string;
  /** Hex dominante del cover. Precomputado en el seed, en canvas para los del usuario. */
  accent: string;
  tracks: Track[];
  source: 'seed' | 'user';
};

/** Lo que sabemos de un disco antes de tocarlo. Los tracks se traen al hacer click. */
export type Seed = Omit<Vinyl, 'tracks' | 'source'>;

/** Un disco en la estantería: semilla o agregado por el usuario. */
export type LibraryRecord = Seed & {
  source: 'seed' | 'user';
};

export type AlbumSummary = {
  id: string;
  title: string;
  artist: string;
  year: number | null;
  coverUrl: string;
  trackCount: number;
  /** Ficha del álbum en Apple Music, para escucharlo completo. */
  url?: string;
};

export type AlbumDetail = AlbumSummary & { tracks: Track[] };
