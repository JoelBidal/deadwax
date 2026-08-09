import styles from './Tonearm.module.css';

export const ARM_START = 18;
export const ARM_END = 32;
/**
 * En reposo el brazo queda fuera del disco, sobre su apoyo. El surco exterior
 * empieza recién a los 18°; por debajo de 6° la púa ya no pisa vinilo.
 */
export const ARM_PARK = 2;
/** Cuánto se levanta el brazo al pausar, en grados hacia afuera. */
const LIFT = -5;

/** Dónde está el brazo: guardado, cruzando hacia el disco, o sobre el surco. */
export type ArmPhase = 'parked' | 'cueing' | 'down';

type Props = {
  /** 0 a 1: posición dentro del track. */
  progress: number;
  phase: ArmPhase;
  /** La púa toca el disco. Suelta al pausar, aunque el brazo siga sobre el surco. */
  contact: boolean;
};

export default function Tonearm({ progress, phase, contact }: Props) {
  const clamped = Math.min(Math.max(progress, 0), 1);
  const angle =
    phase === 'parked'
      ? ARM_PARK
      : phase === 'cueing'
        ? ARM_START
        : ARM_START + (ARM_END - ARM_START) * clamped;

  return (
    <div className={styles.tonearm} aria-hidden="true">
      <div
        className={`${styles.arm} ${contact ? '' : styles.lifted} ${
          phase === 'cueing' ? styles.crossing : ''
        }`}
        style={
          {
            '--angle': angle.toFixed(2),
            '--lift': contact ? 0 : LIFT,
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
