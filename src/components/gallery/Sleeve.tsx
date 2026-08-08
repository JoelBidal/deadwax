import { useState } from 'react';
import type { LibraryRecord } from '../../lib/types';
import styles from './Sleeve.module.css';

type Props = {
  record: LibraryRecord;
  index: number;
  editing: boolean;
  onSelect: (id: string, from: HTMLElement) => void;
  onDelete: (id: string) => void;
};

export default function Sleeve({ record, index, editing, onSelect, onDelete }: Props) {
  const [shareLabel, setShareLabel] = useState<'Share' | 'Copied' | 'Copy failed'>('Share');
  const eager = index < 6;

  const share = async () => {
    const url = `${location.origin}${location.pathname}?record=${record.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareLabel('Copied');
    } catch {
      // Contexto inseguro o permiso denegado: sin aviso, el botón parece roto.
      setShareLabel('Copy failed');
    }
    setTimeout(() => setShareLabel('Share'), 2000);
  };

  return (
    <li
      className={`${styles.cell} ${editing ? styles.editing : ''}`}
      style={{ '--accent': record.accent } as React.CSSProperties}
    >
      <button
        type="button"
        className={styles.button}
        onClick={(e) => !editing && onSelect(record.id, e.currentTarget)}
        aria-disabled={editing}
        aria-label={editing ? record.title : `Play ${record.title} by ${record.artist}`}
      >
        <span className={styles.frame}>
          <span className={styles.disc} aria-hidden="true" />
          <span className={styles.cover}>
            <img
              src={record.coverUrl}
              alt=""
              width={600}
              height={600}
              loading={eager ? 'eager' : 'lazy'}
              fetchPriority={eager ? 'high' : 'auto'}
              decoding="async"
              draggable={false}
            />
          </span>
        </span>
      </button>

      <span className={styles.meta}>
        <span className={styles.artist} aria-hidden="true">
          {record.artist}
        </span>
        <span className={styles.title} aria-hidden="true">
          {record.title}
        </span>
        {editing ? (
          <button
            type="button"
            className={styles.action}
            onClick={() => onDelete(record.id)}
            aria-label={`Remove ${record.title}`}
          >
            Remove
          </button>
        ) : (
          <button
            type="button"
            className={styles.action}
            onClick={share}
            aria-label={`Copy link to ${record.title}`}
          >
            {shareLabel}
          </button>
        )}
      </span>
    </li>
  );
}
