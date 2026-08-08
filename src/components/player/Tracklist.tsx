import { useEffect, useRef } from 'react';
import type { Track } from '../../lib/types';
import { mmss } from '../../lib/format';
import styles from './Tracklist.module.css';

type Props = {
  tracks: Track[];
  activeIndex: number;
  /** Ficha en Apple Music, para escuchar el álbum completo. */
  albumUrl?: string | undefined;
  onPick: (index: number) => void;
};

export default function Tracklist({ tracks, activeIndex, albumUrl, onPick }: Props) {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    listRef.current?.children[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  /** Arriba y abajo recorren la lista; Enter o Espacio ponen la púa ahí. */
  const onKey = (e: React.KeyboardEvent<HTMLUListElement>) => {
    const map: Record<string, number | 'first' | 'last'> = {
      ArrowDown: 1,
      ArrowUp: -1,
      Home: 'first',
      End: 'last',
    };
    const move = map[e.key];
    if (move === undefined) return;

    const rows = [...(listRef.current?.querySelectorAll('button') ?? [])];
    const current = rows.indexOf(e.target as HTMLButtonElement);
    if (current < 0) return;

    const next =
      move === 'first' ? 0 : move === 'last' ? rows.length - 1 : current + move;
    const target = rows[Math.max(0, Math.min(rows.length - 1, next))];
    if (!target || target === rows[current]) return;
    e.preventDefault();
    target.focus();
  };

  return (
    <div className={styles.wrap}>
      {/* Lista de verdad: un <button role="listitem"> pierde su rol de botón y
          el lector de pantalla deja de anunciar que se puede activar. */}
      <ul ref={listRef} className={styles.list} onKeyDown={onKey}>
        {tracks.map((track, i) => (
          <li key={track.id} className={styles.item}>
            <button
              type="button"
              className={`${styles.row} ${i === activeIndex ? styles.active : ''}`}
              onClick={() => onPick(i)}
              aria-current={i === activeIndex ? 'true' : undefined}
            >
              <span className={styles.mark} aria-hidden="true" />
              <span className={styles.name}>{track.title}</span>
              {/* La duración que se muestra es la del álbum, no la del preview. */}
              <span className={`${styles.length} tabular`}>
                {track.fullLength ? mmss(track.fullLength) : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {/* La duración de la lista es la del álbum; lo que suena son 30 segundos. */}
      <div className={styles.foot}>
        <p className={styles.note}>30-second previews, via iTunes.</p>
        {albumUrl && (
          <a className={styles.full} href={albumUrl} target="_blank" rel="noreferrer">
            Hear the full album on Apple Music
          </a>
        )}
      </div>
    </div>
  );
}
