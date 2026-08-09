import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { armServo, mechanicalClick, needleDrop, platterMotor } from '../lib/sfx';

/**
 * El ritual de poner un disco, en segundos desde el click. Los tiempos son de
 * acá y de ningún otro lado: el CSS del brazo los repite y la máquina de
 * estados los agenda, así que mover un número mueve la secuencia entera.
 */
export const CUE = {
  /** Se aprieta el botón y el plato empieza a tomar velocidad. */
  click: 0,
  /** El brazo arranca a cruzar hacia el disco. */
  arm: 0.38,
  /** Llega al surco exterior y empieza a bajar. */
  reach: 1.1,
  /**
   * La púa toca. Son los 260ms que tarda el brazo en apoyarse desde que llega:
   * el golpe tiene que sonar cuando la aguja aterriza, no mientras baja.
   */
  drop: 1.36,
  /** Entra la canción. Lo que hay en el medio es el surco de entrada. */
  music: 3,
} as const;

/** Cuánto tarda la canción en llegar a volumen pleno. */
export const MUSIC_FADE = 0.5;

type Steps = {
  /** El brazo llegó al surco y la púa empieza a bajar. */
  onReach: () => void;
  /** Se terminó el surco de entrada. */
  onMusic: () => void;
};

/**
 * Los sonidos se agendan contra el reloj del audio, que no se desfasa; los
 * pasos visuales van por setTimeout, que alcanza para lo que se ve. Todo el
 * mecanismo cuelga de un solo nodo para poder cortarlo de una si el usuario
 * se va a mitad del ritual.
 */
export function useCue(
  ctxRef: RefObject<AudioContext | null>,
  destRef: RefObject<GainNode | null>,
) {
  const timers = useRef<number[]>([]);
  const busRef = useRef<GainNode | null>(null);

  const cancel = useCallback(() => {
    for (const timer of timers.current) window.clearTimeout(timer);
    timers.current = [];

    const bus = busRef.current;
    const ctx = ctxRef.current;
    busRef.current = null;
    if (!bus) return;
    // Los sonidos ya están agendados y van a sonar igual: lo que se corta es la
    // salida. Una rampa corta y no un corte seco, que se oiría como un click.
    if (ctx) {
      bus.gain.cancelScheduledValues(ctx.currentTime);
      bus.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
    }
    window.setTimeout(() => bus.disconnect(), 400);
  }, [ctxRef]);

  const start = useCallback(
    (steps: Steps) => {
      cancel();

      const ctx = ctxRef.current;
      const dest = destRef.current;
      if (ctx && dest) {
        const bus = ctx.createGain();
        bus.connect(dest);
        busRef.current = bus;

        // Un respiro antes de empezar: agendar en `currentTime` exacto llega
        // tarde y el primer sonido sale recortado.
        const t = ctx.currentTime + 0.02;
        mechanicalClick(ctx, bus, t + CUE.click);
        platterMotor(ctx, bus, t + CUE.click + 0.05, CUE.music - 0.05);
        armServo(ctx, bus, t + CUE.arm, CUE.reach - CUE.arm);
        needleDrop(ctx, bus, t + CUE.drop);
      }

      const at = (seconds: number, run: () => void) =>
        timers.current.push(window.setTimeout(run, seconds * 1000));

      at(CUE.reach, steps.onReach);
      at(CUE.music, steps.onMusic);
    },
    [cancel, ctxRef, destRef],
  );

  /**
   * Sólo el golpe de la púa, sin ritual: cuando el usuario apoya el brazo con
   * la mano no hay botón que apretar ni motor que arrancar, ya está todo hecho.
   */
  const drop = useCallback(() => {
    const ctx = ctxRef.current;
    const dest = destRef.current;
    if (!ctx || !dest) return;
    needleDrop(ctx, dest, ctx.currentTime + 0.02);
  }, [ctxRef, destRef]);

  useEffect(() => cancel, [cancel]);

  return { start, cancel, drop };
}
