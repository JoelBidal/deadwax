import { useEffect, useRef, type RefObject } from 'react';
import type { CrackleLevel } from '../lib/types';

const SECONDS = 4;

/**
 * `high` no llega al doble: por encima de eso el ruido deja de leerse como
 * superficie del disco y empieza a competir con la música.
 */
const GAIN: Record<CrackleLevel, number> = { off: 0, normal: 0.06, high: 0.105 };

/**
 * Ruido de superficie generado, no sampleado: hiss de fondo constante más pops
 * dispersos con caída exponencial. Filtrado en banda para sacarle los graves
 * (que embarrarían la mezcla) y los agudos más finos (que suenan a estática
 * digital, no a polvo).
 */
function buildCrackle(ctx: AudioContext): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * SECONDS);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * 0.05;

  const pops = Math.floor(SECONDS * 55);
  for (let p = 0; p < pops; p++) {
    const at = Math.floor(Math.random() * (length - 400));
    const amp = 0.25 + Math.random() * 0.7;
    const decay = 30 + Math.random() * 110;
    for (let k = 0; k < decay; k++) {
      const sample = data[at + k];
      if (sample === undefined) break;
      data[at + k] = sample + amp * Math.exp(-k / (decay * 0.22)) * (Math.random() * 2 - 1);
    }
  }

  for (let i = 0; i < length; i++) data[i] = Math.max(-1, Math.min(1, data[i]!));
  return buffer;
}

export function useCrackle(
  ctxRef: RefObject<AudioContext | null>,
  destRef: RefObject<GainNode | null>,
  level: CrackleLevel,
  active: boolean,
  /** En el surco de entrada el ruido de superficie es lo único que suena. */
  boost = 1,
) {
  const nodesRef = useRef<{ source: AudioBufferSourceNode; gain: GainNode } | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const target = level === 'off' ? 0 : GAIN[level] * boost;

  useEffect(() => {
    const ctx = ctxRef.current;

    if (!active || !ctx) {
      const nodes = nodesRef.current;
      if (nodes) {
        // Rampa corta: cortar en seco produce un click audible.
        nodes.gain.gain.setTargetAtTime(0, ctx?.currentTime ?? 0, 0.05);
        const source = nodes.source;
        nodesRef.current = null;
        setTimeout(() => {
          try {
            source.stop();
          } catch {
            /* ya detenido */
          }
        }, 250);
      }
      return;
    }

    // Ya sonando: cambiar de intensidad mueve el gain, no rearma el grafo. Cortar
    // y volver a arrancar reiniciaría el loop y se oiría el salto.
    if (nodesRef.current) {
      nodesRef.current.gain.gain.setTargetAtTime(target, ctx.currentTime, 0.15);
      return;
    }

    bufferRef.current ??= buildCrackle(ctx);

    const source = ctx.createBufferSource();
    source.buffer = bufferRef.current;
    source.loop = true;

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 1100;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 6500;

    const gain = ctx.createGain();
    gain.gain.value = 0;
    // Ataque corto: el ruido entra con la púa, no se desvanece hacia adentro.
    gain.gain.setTargetAtTime(target, ctx.currentTime, 0.12);

    source
      .connect(highpass)
      .connect(lowpass)
      .connect(gain)
      .connect(destRef.current ?? ctx.destination);
    source.start();
    nodesRef.current = { source, gain };
  }, [ctxRef, destRef, active, target]);

  useEffect(
    () => () => {
      try {
        nodesRef.current?.source.stop();
      } catch {
        /* ya detenido */
      }
    },
    [],
  );
}
