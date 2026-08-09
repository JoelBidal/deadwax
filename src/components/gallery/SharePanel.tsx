import { useEffect, useRef, useState } from 'react';
import { encodeShelf, MAX_NAME, MIN_RECORDS } from '../../lib/shelf';
import styles from './SharePanel.module.css';

type Props = {
  ids: string[];
  initialName: string;
  onSaveName: (name: string) => void;
  onClose: () => void;
};

export default function SharePanel({ ids, initialName, onSaveName, onClose }: Props) {
  const [name, setName] = useState(initialName);
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // El nombre no es decoración: es lo primero que ve quien abre el enlace, y sin
  // él la estantería llega firmada como "A shelf". Hasta que exista, no hay link.
  const shelfName = name.trim();
  const named = shelfName.length > 0;
  // Faltan discos pesa más que falta el nombre: el nombre se arregla acá mismo,
  // los discos obligan a cerrar el panel. Se avisa primero lo que cuesta más.
  const missing = Math.max(MIN_RECORDS - ids.length, 0);
  const ready = named && missing === 0;
  const url = ready
    ? `${location.origin}${location.pathname}?${encodeShelf({ name: shelfName, ids })}`
    : '';

  const copy = async () => {
    if (!ready) return;
    onSaveName(shelfName);
    try {
      await navigator.clipboard.writeText(url);
      setCopied('ok');
    } catch {
      setCopied('fail');
    }
    setTimeout(() => setCopied('idle'), 2400);
  };

  return (
    <div className={styles.stage} role="dialog" aria-modal="true" aria-label="Share your shelf">
      <div className={styles.panel}>
        <div className={styles.field}>
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            value={name}
            maxLength={MAX_NAME}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name this shelf"
            aria-label="Name this shelf"
            autoComplete="off"
          />
          <button type="button" className={styles.close} onClick={onClose}>
            Close
          </button>
        </div>

        <p className={styles.lead}>
          {missing > 0
            ? `${ids.length} ${ids.length === 1 ? 'record' : 'records'} so far. A shelf travels with ${MIN_RECORDS}.`
            : `${ids.length} records, packed into a link.`}
        </p>
        <p className={styles.body}>
          The link carries the shelf itself, so there is nothing to sign up for and nothing stored on
          a server. Whoever opens it sees your name on it and can play every record.
        </p>

        <div className={styles.linkRow}>
          {ready ? (
            <span className={styles.url}>{url}</span>
          ) : (
            <span className={styles.waiting}>
              {missing > 0
                ? `Add ${missing} more ${missing === 1 ? 'record' : 'records'} and the link appears.`
                : 'Name the shelf and the link appears.'}
            </span>
          )}
          <button type="button" className={styles.copy} onClick={copy} disabled={!ready}>
            {copied === 'ok' ? 'Copied' : copied === 'fail' ? 'Copy failed' : 'Copy link'}
          </button>
        </div>
      </div>
    </div>
  );
}
