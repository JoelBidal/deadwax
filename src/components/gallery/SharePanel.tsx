import { useEffect, useRef, useState } from 'react';
import { encodeShelf, MAX_NAME } from '../../lib/shelf';
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

  const shelfName = name.trim() || 'A shelf';
  const url = `${location.origin}${location.pathname}?shelf=${encodeShelf({ name: shelfName, ids })}`;

  const copy = async () => {
    onSaveName(name.trim());
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
          {ids.length} {ids.length === 1 ? 'record' : 'records'}, packed into a link.
        </p>
        <p className={styles.body}>
          The link carries the shelf itself, so there is nothing to sign up for and nothing stored on
          a server. Whoever opens it sees your name on it and can play every record.
        </p>

        <div className={styles.linkRow}>
          <span className={styles.url}>{url}</span>
          <button type="button" className={styles.copy} onClick={copy}>
            {copied === 'ok' ? 'Copied' : copied === 'fail' ? 'Copy failed' : 'Copy link'}
          </button>
        </div>
      </div>
    </div>
  );
}
