import { useCallback, useRef } from 'react';

/**
 * Un único AudioContext y un único MediaElementAudioSourceNode para toda la
 * sesión: el nodo sólo puede crearse una vez por elemento <audio>, y crear un
 * contexto por reproducción termina en "too many AudioContexts".
 *
 * El <audio> tiene que llevar crossOrigin="anonymous". El CDN de iTunes manda
 * access-control-allow-origin, pero sin el atributo el medio queda "tainted" y
 * el grafo de Web Audio devuelve silencio en vez de fallar visiblemente.
 *
 * El grafo:
 *
 *   <audio> ─→ music ─┐
 *   crackle ──────────┼─→ master ─→ destino
 *   mecanismo ────────┘
 *
 * `master` es el volumen, y todo pasa por ahí: antes el crackle iba directo al
 * destino y el control de volumen no lo tocaba. `music` existe aparte para
 * poder entrar con la canción sin cortar el ruido de superficie.
 */
export function useAudioEngine() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const musicRef = useRef<GainNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  /** El volumen elegido sobrevive a que todavía no exista el contexto. */
  const volumeRef = useRef(1);

  /** Llamar dentro del handler del gesto del usuario, nunca después de un await. */
  const ensureContext = useCallback(() => {
    if (!ctxRef.current) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      const ctx = new Ctor();
      ctxRef.current = ctx;

      masterRef.current = ctx.createGain();
      masterRef.current.gain.value = volumeRef.current;
      masterRef.current.connect(ctx.destination);

      musicRef.current = ctx.createGain();
      musicRef.current.connect(masterRef.current);
    }

    const ctx = ctxRef.current;
    const audio = audioRef.current;
    if (audio && musicRef.current && !sourceRef.current) {
      sourceRef.current = ctx.createMediaElementSource(audio);
      sourceRef.current.connect(musicRef.current);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  }, []);

  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return false;
    ensureContext();
    try {
      await audio.play();
      return true;
    } catch {
      return false;
    }
  }, [ensureContext]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const load = useCallback((src: string) => {
    const audio = audioRef.current;
    if (!audio || audio.src === src) return;
    audio.src = src;
    audio.load();
  }, []);

  /**
   * Rampa corta en vez de asignación directa: mover un gain de golpe mientras
   * suena algo produce un click. Arrastrar el control dispara decenas de
   * llamadas por segundo, y cada salto se escucharía.
   */
  const setVolume = useCallback((value: number) => {
    volumeRef.current = value;
    const gain = masterRef.current;
    const ctx = ctxRef.current;
    if (gain && ctx) gain.gain.setTargetAtTime(value, ctx.currentTime, 0.015);
  }, []);

  /** La canción entra desde el silencio: aparecer de golpe tapa la caída de la púa. */
  const fadeMusicIn = useCallback((seconds: number) => {
    const gain = musicRef.current;
    const ctx = ctxRef.current;
    if (!gain || !ctx) return;
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(1, ctx.currentTime + seconds);
  }, []);

  const resetMusicGain = useCallback(() => {
    const gain = musicRef.current;
    const ctx = ctxRef.current;
    if (!gain || !ctx) return;
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setValueAtTime(1, ctx.currentTime);
  }, []);

  return {
    audioRef,
    ctxRef,
    masterRef,
    ensureContext,
    play,
    pause,
    load,
    setVolume,
    fadeMusicIn,
    resetMusicGain,
  };
}
