import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import type { AlbumDetail, LibraryRecord, Track } from '../../lib/types';
import { mmss } from '../../lib/format';
import Platter from './Platter';
import Tonearm from './Tonearm';
import Tracklist from './Tracklist';
import Controls from './Controls';
import styles from './Turntable.module.css';

type Props = {
  record: LibraryRecord;
  album: AlbumDetail | null;
  status: 'loading' | 'ready' | 'error';
  track: Track | null;
  trackIndex: number;
  playing: boolean;
  time: number;
  duration: number;
  crackle: boolean;
  originRect: DOMRect | null;
  onToggle: () => void;
  onPrev: () => void;
  onNext: () => void;
  onPick: (index: number) => void;
  onCrackle: () => void;
  onClose: () => void;
};

const REDUCED = '(prefers-reduced-motion: reduce)';

export default function Turntable(props: Props) {
  const { record, album, status, track, trackIndex, playing, time, duration, originRect } = props;
  const stageRef = useRef<HTMLDivElement>(null);
  const deckRef = useRef<HTMLDivElement>(null);
  const armRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  const [copied, setCopied] = useState(false);

  /** Distancia y escala entre la funda clickeada y el plato ya montado. */
  const flip = useCallback(() => {
    const el = deckRef.current;
    if (!el || !originRect) return null;
    const target = el.getBoundingClientRect();
    if (!target.width) return null;
    return {
      x: originRect.left + originRect.width / 2 - (target.left + target.width / 2),
      y: originRect.top + originRect.height / 2 - (target.top + target.height / 2),
      scale: originRect.width / target.width,
    };
  }, [originRect]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const deck = deckRef.current;
    if (!stage || !deck) return;

    stage.focus({ preventScroll: true });

    if (window.matchMedia(REDUCED).matches) {
      const tw = gsap.fromTo(stage, { opacity: 0 }, { opacity: 1, duration: 0.25 });
      return () => void tw.kill();
    }

    const from = flip();
    const tl = gsap.timeline();
    tl.fromTo(stage, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' }, 0);

    if (from) {
      // El disco sale de la funda y se apoya en el plato. Es el único momento
      // audaz del proyecto; el resto se mantiene callado.
      tl.fromTo(
        deck,
        { x: from.x, y: from.y, scale: from.scale, rotate: -14, opacity: 0.6 },
        { x: 0, y: 0, scale: 1, rotate: 0, opacity: 1, duration: 0.8, ease: 'expo.out' },
        0,
      );
    } else {
      tl.fromTo(deck, { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6 }, 0);
    }

    // El brazo baja recién cuando el disco ya está apoyado.
    if (armRef.current) {
      tl.fromTo(armRef.current, { opacity: 0 }, { opacity: 1, duration: 0.45 }, 0.5);
    }
    if (infoRef.current) {
      tl.fromTo(
        infoRef.current,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' },
        0.28,
      );
    }

    return () => void tl.kill();
    // Sólo en el montaje: es una transición de entrada, no reacciona a cambios.
  }, []);

  const handleClose = useCallback(() => {
    if (closing.current) return;
    closing.current = true;

    const stage = stageRef.current;
    const deck = deckRef.current;
    if (!stage || !deck || window.matchMedia(REDUCED).matches) {
      props.onClose();
      return;
    }

    const to = flip();
    const tl = gsap.timeline({ onComplete: props.onClose });
    if (to) {
      tl.to(
        deck,
        { x: to.x, y: to.y, scale: to.scale, rotate: -10, opacity: 0.4, duration: 0.55, ease: 'power3.inOut' },
        0,
      );
    }
    tl.to(stage, { opacity: 0, duration: 0.45, ease: 'power2.in' }, 0.1);
    if (infoRef.current) tl.to(infoRef.current, { opacity: 0, y: 8, duration: 0.25 }, 0);
  }, [flip, props]);

  const handleShare = useCallback(async () => {
    const url = `${location.origin}${location.pathname}?record=${record.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      /* sin permiso de portapapeles: la URL ya está en la barra igual */
    }
  }, [record.id]);

  const total = album?.tracks.length ?? 0;
  const progress = duration > 0 ? time / duration : 0;

  return (
    <div
      ref={stageRef}
      className={styles.stage}
      role="region"
      aria-label="Turntable"
      // Foco en la escena y no en un botón: así Espacio y las flechas llegan al
      // reproductor en vez de activar el control que quedó enfocado.
      tabIndex={-1}
      // El único color de la escena sale de la portada: el punto del track
      // activo y el tinte de la sombra del plato.
      style={{ '--accent': record.accent } as React.CSSProperties}
    >
      <div className={styles.topBar}>
        <button type="button" className={styles.link} onClick={handleClose}>
          Back
        </button>
        <button type="button" className={styles.link} onClick={handleShare}>
          {copied ? 'Link copied' : 'Share'}
        </button>
      </div>

      <div className={styles.inner}>
        <div className={styles.deckSide}>
          <div className={styles.platterWrap}>
            <div ref={deckRef} className={styles.deck}>
              <Platter coverUrl={record.coverUrl} spinning={playing} />
              <div ref={armRef} className={styles.armLayer}>
                <Tonearm progress={progress} playing={playing} />
              </div>
            </div>
          </div>

          {status === 'ready' && track && (
            <div className={styles.transport}>
              <Controls
                playing={playing}
                canPrev={trackIndex > 0}
                canNext={trackIndex < total - 1}
                onToggle={props.onToggle}
                onPrev={props.onPrev}
                onNext={props.onNext}
              />
              <div className={styles.meters}>
                <span className={`${styles.time} tabular`}>
                  {mmss(time)} / {mmss(duration)}
                </span>
                <span className={styles.crackleWrap}>
                  <button
                    type="button"
                    className={`${styles.crackle} ${props.crackle ? styles.crackleOn : ''}`}
                    onClick={props.onCrackle}
                    aria-pressed={props.crackle}
                    aria-describedby="crackle-tip"
                  >
                    <span
                      className={`${styles.dot} ${props.crackle ? styles.dotOn : ''}`}
                      aria-hidden="true"
                    />
                    Crackle
                  </button>
                  <span id="crackle-tip" role="tooltip" className={styles.tip}>
                    The dust and static a needle picks up out of the groove. Synthesised here, not
                    recorded.
                  </span>
                </span>
              </div>
            </div>
          )}
        </div>

        <div ref={infoRef} className={styles.info}>
          <div className={styles.titles}>
            <h2 className={styles.album}>{record.title}</h2>
            <p className={styles.artist}>
              {record.artist}
              {record.year !== null && <span className={styles.year}> · {record.year}</span>}
            </p>
          </div>

          {status === 'loading' && <p className={styles.message}>Loading tracks.</p>}
          {status === 'error' && (
            <p className={styles.message}>This record did not load. Try again.</p>
          )}
          {status === 'ready' && !track && (
            <p className={styles.message}>No previews available for this record.</p>
          )}

          {status === 'ready' && album && track && (
            <Tracklist
              tracks={album.tracks}
              activeIndex={trackIndex}
              albumUrl={album.url}
              onPick={props.onPick}
            />
          )}
        </div>
      </div>
    </div>
  );
}
