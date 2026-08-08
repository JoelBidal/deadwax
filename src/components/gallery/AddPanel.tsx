import { useEffect, useRef, useState } from 'react';
import type { AlbumSummary } from '../../lib/types';
import { RECOMMENDED } from '../../data/recommended';
import styles from './AddPanel.module.css';

type Status = 'idle' | 'loading' | 'ok' | 'empty' | 'error';

export type PickableAlbum = Pick<AlbumSummary, 'id' | 'title' | 'artist' | 'year' | 'coverUrl'>;

type Props = {
  existingIds: Set<string>;
  onPick: (album: PickableAlbum) => void;
  onClose: () => void;
};

export default function AddPanel({ existingIds, onPick, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AlbumSummary[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setStatus('idle');
      setResults([]);
      return;
    }

    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setStatus('loading');
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error('upstream');
        const { albums } = (await res.json()) as { albums: AlbumSummary[] };
        setResults(albums);
        setStatus(albums.length ? 'ok' : 'empty');
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setStatus('error');
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  const showing: PickableAlbum[] = status === 'idle' ? RECOMMENDED : results;

  return (
    <div className={styles.stage} role="dialog" aria-modal="true" aria-label="Add a record">
      <div className={styles.panel}>
        <div className={styles.field}>
          {/* type="text" y no "search": el input de búsqueda trae una "x"
              nativa que no podemos etiquetar ni combina con el resto. */}
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Who do you want to hear?"
            aria-label="Search for an album"
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              type="button"
              className={styles.close}
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
            >
              Clear
            </button>
          )}
          <button type="button" className={styles.close} onClick={onClose}>
            Close
          </button>
        </div>

        {status === 'idle' && (
          <p className={styles.lead}>Records worth putting on first.</p>
        )}
        {status === 'loading' && <p className={styles.message}>Searching.</p>}
        {status === 'empty' && (
          <p className={styles.message}>No album by that name. Try the artist instead.</p>
        )}
        {status === 'error' && (
          <p className={styles.message}>The search did not answer. Try again.</p>
        )}

        {(status === 'idle' || status === 'ok') && (
          <ul className={styles.results}>
            {showing.map((album) => {
              const already = existingIds.has(album.id);
              return (
                <li key={album.id}>
                  <button
                    type="button"
                    className={styles.result}
                    onClick={() => !already && onPick(album)}
                    disabled={already}
                  >
                    <span className={styles.cover}>
                      <img
                        src={album.coverUrl}
                        alt=""
                        width={600}
                        height={600}
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                      />
                    </span>
                    <span className={styles.lines}>
                      <span className={styles.artist}>{album.artist}</span>
                      <span className={already ? styles.already : styles.title}>
                        {already ? 'Already on the shelf' : album.title}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
