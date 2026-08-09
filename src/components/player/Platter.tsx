import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import styles from './Platter.module.css';

type Props = {
  coverUrl: string;
  spinning: boolean;
};

const REDUCED = '(prefers-reduced-motion: reduce)';

export default function Platter({ coverUrl, spinning }: Props) {
  const vinylRef = useRef<HTMLDivElement>(null);
  const spinRef = useRef<gsap.core.Tween | null>(null);
  /** La velocidad actual, para que una rampa nueva arranque donde quedó la anterior. */
  const speed = useRef({ value: 0 });

  useEffect(() => {
    const el = vinylRef.current;
    if (!el || window.matchMedia(REDUCED).matches) return;

    /*
     * 33⅓ RPM son 1.8s por vuelta, igual que antes. Lo que cambió es quién lo
     * mueve: con `@keyframes` la velocidad es fija, y acelerar cambiando la
     * duración a mitad de animación salta de ángulo. El disco lleva la tapa
     * encima, así que ese salto se ve. Con un tween se manipula el timeScale,
     * que es continuo por definición.
     */
    const tween = gsap.to(el, { rotation: 360, duration: 1.8, ease: 'none', repeat: -1 });
    tween.timeScale(0);
    spinRef.current = tween;
    return () => {
      tween.kill();
      spinRef.current = null;
    };
  }, []);

  useEffect(() => {
    const tween = spinRef.current;
    if (!tween) return;
    const ramp = speed.current;
    /*
     * El plato tiene masa: tarda en tomar velocidad y sigue girando al frenar.
     * Se anima un objeto suelto y se aplica en onUpdate en vez de animar el
     * timeScale directo, para no depender de que GSAP acepte una animación
     * como target de otra.
     */
    gsap.to(ramp, {
      value: spinning ? 1 : 0,
      duration: spinning ? 0.9 : 1.4,
      ease: spinning ? 'power1.in' : 'power2.out',
      overwrite: true,
      onUpdate: () => tween.timeScale(ramp.value),
    });
    return () => void gsap.killTweensOf(ramp);
  }, [spinning]);

  return (
    <div className={styles.platter}>
      <div ref={vinylRef} className={styles.vinyl}>
        <div className={styles.label}>
          <img src={coverUrl} alt="" width={600} height={600} draggable={false} />
        </div>
      </div>
      <div className={styles.sheen} aria-hidden="true" />
      <div className={styles.spindle} aria-hidden="true" />
    </div>
  );
}
