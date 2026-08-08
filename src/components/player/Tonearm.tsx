import styles from './Tonearm.module.css';

export const ARM_START = 18;
export const ARM_END = 32;
/** Cuánto se levanta el brazo al pausar, en grados hacia afuera. */
const LIFT = -5;

type Props = {
  /** 0 a 1: posición dentro del track. */
  progress: number;
  playing: boolean;
};

export default function Tonearm({ progress, playing }: Props) {
  const clamped = Math.min(Math.max(progress, 0), 1);
  const angle = ARM_START + (ARM_END - ARM_START) * clamped;

  return (
    <div className={styles.tonearm} aria-hidden="true">
      <div
        className={`${styles.arm} ${playing ? '' : styles.lifted}`}
        style={
          {
            '--angle': angle.toFixed(2),
            '--lift': playing ? 0 : LIFT,
          } as React.CSSProperties
        }
      >
        <div className={styles.tube} />
        <div className={styles.head} />
      </div>
      <div className={styles.pivot} />
    </div>
  );
}
