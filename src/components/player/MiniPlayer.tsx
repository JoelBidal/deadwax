import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import type { LibraryRecord, Track } from '../../lib/types';
import { mmss } from '../../lib/format';
import styles from './MiniPlayer.module.css';

type Props = {
  record: LibraryRecord;
  track: Track | null;
  trackIndex: number;
  total: number;
  playing: boolean;
  time: number;
  duration: number;
  onToggle: () => void;
  onPrev: () => void;
  onNext: () => void;
  onExpand: (rect: DOMRect, from: HTMLElement) => void;
  onStop: () => void;
};

export default function MiniPlayer({
  record,
  track,
  trackIndex,
  total,
  playing,
  time,
  duration,
  onToggle,
  onPrev,
  onNext,
  onExpand,
  onStop,
}: Props) {
  const barRef = useRef<HTMLDivElement>(null);
  const discRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const tw = gsap.from(el, {
      y: 24,
      opacity: 0,
      duration: 0.5,
      ease: 'power3.out',
      clearProps: 'opacity,transform',
    });
    return () => void tw.kill();
  }, []);

  const progress = duration > 0 ? Math.min(time / duration, 1) : 0;

  return (
    <div ref={barRef} className={styles.bar} style={{ '--accent': record.accent } as React.CSSProperties}>
      <span className={styles.progress} style={{ scale: `${progress} 1` }} aria-hidden="true" />

      {/* El disco vuelve al plato desde acá: la transición mide esta etiqueta. */}
      <button
        type="button"
        className={styles.open}
        onClick={(e) =>
          discRef.current && onExpand(discRef.current.getBoundingClientRect(), e.currentTarget)
        }
        aria-label={`Back to ${record.title}`}
      >
        <span ref={discRef} className={`${styles.disc} ${playing ? styles.spinning : ''}`}>
          <img src={record.coverUrl} alt="" width={600} height={600} draggable={false} />
        </span>
        <span className={styles.lines}>
          <span className={styles.now}>{track?.title ?? record.title}</span>
          <span className={styles.artist}>{record.artist}</span>
        </span>
      </button>

      <span className={styles.controls}>
        <button
          type="button"
          className={`${styles.action} ${styles.previous}`}
          onClick={onPrev}
          disabled={trackIndex === 0}
        >
          Previous
        </button>
        <button type="button" className={`${styles.action} ${styles.toggle}`} onClick={onToggle}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <button
          type="button"
          className={`${styles.action} ${styles.next}`}
          onClick={onNext}
          disabled={trackIndex >= total - 1}
        >
          Next
        </button>
        <span className={`${styles.time} tabular`}>
          {mmss(time)} / {mmss(duration)}
        </span>
      </span>

      <button
        type="button"
        className={`${styles.action} ${styles.stop}`}
        onClick={onStop}
        aria-label="Stop and put the record away"
      >
        Close
      </button>
    </div>
  );
}
