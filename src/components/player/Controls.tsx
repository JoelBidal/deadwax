import styles from './Controls.module.css';

type Props = {
  playing: boolean;
  canPrev: boolean;
  canNext: boolean;
  onToggle: () => void;
  onPrev: () => void;
  onNext: () => void;
};

export default function Controls({ playing, canPrev, canNext, onToggle, onPrev, onNext }: Props) {
  return (
    <div className={styles.controls}>
      <button type="button" className={styles.button} onClick={onPrev} disabled={!canPrev}>
        Previous
      </button>
      <button type="button" className={`${styles.button} ${styles.play}`} onClick={onToggle}>
        {playing ? 'Pause' : 'Play'}
      </button>
      <button type="button" className={styles.button} onClick={onNext} disabled={!canNext}>
        Next
      </button>
    </div>
  );
}
