import { useRef, useState } from 'react';
import styles from './Tonearm.module.css';

export const ARM_START = 18;
export const ARM_END = 32;
/**
 * En reposo el brazo queda fuera del disco, sobre su apoyo. El surco exterior
 * empieza recién a los 18°; por debajo de 6° la púa ya no pisa vinilo.
 */
export const ARM_PARK = 2;
/** Soltar por debajo de acá devuelve el brazo al apoyo en vez de pinchar. */
const ARM_REST = (ARM_PARK + ARM_START) / 2;
/** Cuánto se levanta el brazo al pausar, en grados hacia afuera. */
const LIFT = -5;

/** Dónde está el brazo: guardado, cruzando, sobre el surco, o en la mano. */
export type ArmPhase = 'parked' | 'cueing' | 'down' | 'held';

type Props = {
  /** 0 a 1: posición dentro del track. */
  progress: number;
  phase: ArmPhase;
  /** La púa toca el disco. Suelta al pausar, aunque el brazo siga sobre el surco. */
  contact: boolean;
  /** Se puede agarrar: hay disco cargado y no está a mitad del ritual. */
  grabbable: boolean;
  onGrab: () => void;
  /** Se apoyó sobre el surco, en 0 a 1 del tema. */
  onPlace: (progress: number) => void;
  /** Volvió al apoyo, fuera del disco. */
  onPark: () => void;
};

export default function Tonearm({
  progress,
  phase,
  contact,
  grabbable,
  onGrab,
  onPlace,
  onPark,
}: Props) {
  const pivotRef = useRef<HTMLDivElement>(null);
  /** El ángulo mientras el brazo está en la mano; null cuando lo maneja el estado. */
  const [held, setHeld] = useState<number | null>(null);

  /**
   * El brazo cuelga del pivote hacia abajo y rota en horario, así que el ángulo
   * es el que forma el puntero con la vertical, medido desde el pivote real y
   * no desde una posición calculada: el plato se reescala con el viewport.
   */
  const angleAt = (e: React.PointerEvent): number | null => {
    const box = pivotRef.current?.getBoundingClientRect();
    if (!box) return null;
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    const deg = (Math.atan2(cx - e.clientX, e.clientY - cy) * 180) / Math.PI;
    return Math.min(Math.max(deg, ARM_PARK), ARM_END);
  };

  const grab = (e: React.PointerEvent) => {
    if (!grabbable) return;
    const deg = angleAt(e);
    if (deg === null) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setHeld(deg);
    onGrab();
  };

  const move = (e: React.PointerEvent) => {
    if (held === null) return;
    const deg = angleAt(e);
    if (deg !== null) setHeld(deg);
  };

  const release = (e: React.PointerEvent) => {
    if (held === null) return;
    const deg = angleAt(e) ?? held;
    setHeld(null);
    if (deg < ARM_REST) {
      onPark();
      return;
    }
    // Entre el apoyo y el surco exterior no hay dónde pinchar: cae al principio.
    const at = Math.max(deg - ARM_START, 0) / (ARM_END - ARM_START);
    onPlace(at);
  };

  const clamped = Math.min(Math.max(progress, 0), 1);
  const angle =
    held ??
    (phase === 'parked'
      ? ARM_PARK
      : phase === 'cueing'
        ? ARM_START
        : ARM_START + (ARM_END - ARM_START) * clamped);

  return (
    <div className={styles.tonearm} aria-hidden="true">
      <div
        className={`${styles.arm} ${contact ? '' : styles.lifted} ${
          phase === 'cueing' ? styles.crossing : ''
        } ${held === null ? '' : styles.holding}`}
        style={
          {
            '--angle': angle.toFixed(2),
            // En la mano el brazo va exactamente donde va el dedo: el alzado de
            // la pausa lo dejaría 5° por detrás del puntero.
            '--lift': contact || held !== null ? 0 : LIFT,
          } as React.CSSProperties
        }
      >
        <div className={styles.tube} />
        <div className={styles.head} />
        {grabbable && (
          <div
            className={styles.grip}
            onPointerDown={grab}
            onPointerMove={move}
            onPointerUp={release}
            onPointerCancel={release}
          />
        )}
      </div>
      <div ref={pivotRef} className={styles.pivot} />
    </div>
  );
}
