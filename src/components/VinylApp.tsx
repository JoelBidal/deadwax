import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import gsap from 'gsap';
import type { AlbumDetail, CrackleLevel, LibraryRecord, Seed } from '../lib/types';
import { fetchAlbum, fetchAlbums } from '../lib/client';
import { extractAccent } from '../lib/accent';
import { decodeShelf } from '../lib/shelf';
import { SITE_TITLE } from '../lib/meta';
import {
  loadCrackle,
  loadHiddenIds,
  loadOrder,
  loadShelfName,
  loadUserRecords,
  loadVolume,
  saveCrackle,
  saveHiddenIds,
  saveOrder,
  saveShelfName,
  saveUserRecords,
  saveVolume,
} from '../lib/storage';
import { useAudioEngine } from '../hooks/useAudioEngine';
import { useCrackle } from '../hooks/useCrackle';
import { MUSIC_FADE, useCue } from '../hooks/useCue';
import { useTheme } from '../hooks/useTheme';
import Gallery from './gallery/Gallery';
import AddPanel, { type PickableAlbum } from './gallery/AddPanel';
import About from './About';
import SharePanel from './gallery/SharePanel';
import Turntable from './player/Turntable';
import MiniPlayer from './player/MiniPlayer';

type State = {
  view: 'gallery' | 'player';
  record: LibraryRecord | null;
  album: AlbumDetail | null;
  status: 'loading' | 'ready' | 'error';
  trackIndex: number;
  playing: boolean;
  time: number;
  duration: number;
  /**
   * Dónde está la púa en este disco. `up` es un disco recién puesto que todavía
   * no sonó; el ritual de bajarla ocurre una sola vez por disco, y de ahí en
   * más pasar de tema es instantáneo. `held` es el brazo en la mano del usuario.
   */
  needle: 'up' | 'cueing' | 'down' | 'held';
  /** Entre la caída de la púa y la primera nota: sólo se escucha la superficie. */
  lead: boolean;
};

type Action =
  | { type: 'select'; record: LibraryRecord }
  | { type: 'loaded'; album: AlbumDetail }
  | { type: 'failed' }
  | { type: 'minimize' }
  | { type: 'expand' }
  | { type: 'stop' }
  | { type: 'cue' }
  | { type: 'drop' }
  | { type: 'groove' }
  | { type: 'grab' }
  | { type: 'place' }
  | { type: 'park' }
  | { type: 'track'; index: number }
  | { type: 'playing'; value: boolean }
  | { type: 'time'; value: number }
  | { type: 'duration'; value: number };

const initial: State = {
  view: 'gallery',
  record: null,
  album: null,
  status: 'loading',
  trackIndex: 0,
  playing: false,
  time: 0,
  duration: 30,
  needle: 'up',
  lead: false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'select':
      return { ...initial, view: 'player', record: action.record };
    case 'loaded':
      return { ...state, album: action.album, status: 'ready' };
    case 'failed':
      return { ...state, status: 'error' };
    // Minimizar guarda el tocadiscos sin tocar el audio: el disco sigue sonando.
    case 'minimize':
      return { ...state, view: 'gallery' };
    case 'expand':
      return { ...state, view: 'player' };
    case 'stop':
      return initial;
    case 'cue':
      return { ...state, needle: 'cueing' };
    case 'drop':
      return { ...state, needle: 'down', lead: true };
    // La púa dejó el surco de entrada: entra la canción.
    case 'groove':
      return { ...state, lead: false };
    // Brazo en la mano: no hay surco de entrada que respetar, el usuario elige
    // dónde apoya y ahí empieza.
    case 'grab':
      return { ...state, needle: 'held', lead: false };
    case 'place':
      return { ...state, needle: 'down', lead: false };
    // De vuelta al apoyo. El tema vuelve al principio porque el brazo se fue del
    // disco: dejar el minuto guardado haría que el próximo ritual baje la púa en
    // el surco exterior y suene desde el medio.
    case 'park':
      return { ...state, needle: 'up', lead: false, time: 0 };
    case 'track':
      return { ...state, trackIndex: action.index, time: 0 };
    case 'playing':
      return { ...state, playing: action.value };
    case 'time':
      return { ...state, time: action.value };
    case 'duration':
      return { ...state, duration: action.value };
  }
}

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function VinylApp({ seed }: { seed: Seed[] }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const [userRecords, setUserRecords] = useState<LibraryRecord[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [about, setAbout] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [visited, setVisited] = useState<{ name: string; records: LibraryRecord[] } | null>(null);
  const [shelfName, setShelfName] = useState('');
  const [order, setOrder] = useState<string[]>([]);
  const [theme, toggleTheme] = useTheme();
  const [crackle, setCrackle] = useState<CrackleLevel>('normal');
  const [volume, setVolume] = useState(1);
  const {
    audioRef,
    ctxRef,
    masterRef,
    ensureContext,
    play,
    pause,
    load,
    setVolume: applyVolume,
    fadeMusicIn,
    resetMusicGain,
  } = useAudioEngine();
  const cue = useCue(ctxRef, masterRef);

  // El ruido de superficie corre mientras la púa toca: durante el surco de
  // entrada suena solo, y ahí se lo escucha de verdad. Sube un poco en ese
  // tramo porque el surco de entrada de un disco es más sucio que el grabado.
  useCrackle(ctxRef, masterRef, crackle, state.playing || state.lead, state.lead ? 1.9 : 1);

  const galleryRef = useRef<HTMLDivElement>(null);
  const originRef = useRef<DOMRect | null>(null);
  /** La funda desde la que se entró, para devolverle el foco al salir. */
  const returnFocus = useRef<HTMLElement | null>(null);
  const wantsPlay = useRef(false);

  // Los discos del usuario se mergean después del montaje: leer localStorage
  // durante el render rompería la hidratación.
  useEffect(() => {
    setUserRecords(loadUserRecords());
    setHidden(loadHiddenIds());
    setShelfName(loadShelfName());
    setOrder(loadOrder());
    const stored = loadVolume();
    setVolume(stored);
    applyVolume(stored);
    setCrackle(loadCrackle());
  }, [applyVolume]);

  const own = useMemo<LibraryRecord[]>(() => {
    const gone = new Set(hidden);
    const all = [
      ...seed.filter((r) => !gone.has(r.id)).map((r) => ({ ...r, source: 'seed' as const })),
      ...userRecords,
    ];
    if (!order.length) return all;
    // Lo que no está en el orden guardado queda al final, en el orden en que
    // vino: un disco recién agregado aparece último, no en un lugar al azar.
    const place = new Map(order.map((id, i) => [id, i]));
    return all
      .map((record, i) => ({ record, at: place.get(record.id) ?? order.length + i }))
      .sort((a, b) => a.at - b.at)
      .map((entry) => entry.record);
  }, [seed, userRecords, hidden, order]);

  // Mirando una estantería compartida, la propia queda intacta detrás.
  const library = visited?.records ?? own;

  const track = state.album?.tracks[state.trackIndex] ?? null;
  const total = state.album?.tracks.length ?? 0;

  /**
   * Cortar el ritual. Devuelve el gain de la música a tope: si se cancela justo
   * durante el fundido de entrada, quedaría a media asta y el próximo disco
   * arrancaría bajito sin motivo visible.
   */
  const stopCue = useCallback(() => {
    cue.cancel();
    resetMusicGain();
  }, [cue, resetMusicGain]);

  const handleSelect = useCallback(
    (id: string, from: HTMLElement) => {
      const record = library.find((r) => r.id === id);
      if (!record) return;
      originRef.current = from.getBoundingClientRect();
      returnFocus.current = from;
      // Dentro del gesto del usuario, antes de cualquier await: si no, el
      // AudioContext nace suspendido y el primer play falla en silencio.
      ensureContext();
      // El disco entra al plato con la púa afuera. Sacar un disco de la funda no
      // es lo mismo que ponerlo a sonar, y acá esa diferencia es el proyecto.
      stopCue();
      wantsPlay.current = false;
      dispatch({ type: 'select', record });
    },
    [library, ensureContext, stopCue],
  );

  /**
   * Bajar la púa: el botón mecánico, el plato tomando velocidad, el brazo
   * cruzando y la aguja tocando. Sólo la primera vez de cada disco; después,
   * pasar de tema es inmediato.
   */
  const lowerNeedle = useCallback(() => {
    ensureContext();
    wantsPlay.current = false;
    dispatch({ type: 'cue' });
    cue.start({
      onReach: () => dispatch({ type: 'drop' }),
      onMusic: () => {
        dispatch({ type: 'groove' });
        wantsPlay.current = true;
        fadeMusicIn(MUSIC_FADE);
        void play();
      },
    });
  }, [ensureContext, cue, fadeMusicIn, play]);

  const handleToggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    // A mitad del ritual el botón no hace nada: la púa ya está bajando.
    if (state.needle === 'cueing') return;
    if (state.needle === 'up') {
      lowerNeedle();
      return;
    }
    if (audio.paused) {
      wantsPlay.current = true;
      void play();
    } else {
      wantsPlay.current = false;
      pause();
    }
  }, [audioRef, track, state.needle, lowerNeedle, play, pause]);

  /** Volver a la estantería no interrumpe la música: el disco queda en la barra. */
  const handleClose = useCallback(() => {
    if (state.album && (state.playing || state.time > 0)) {
      dispatch({ type: 'minimize' });
      return;
    }
    // Nunca llegó a sonar: no hay nada que dejar prendido. Si estaba a mitad del
    // ritual, irse lo cancela; nadie quiere oír caer una púa sobre un disco que
    // ya no está en pantalla.
    stopCue();
    wantsPlay.current = false;
    pause();
    dispatch({ type: 'stop' });
  }, [state.album, state.playing, state.time, pause, stopCue]);

  const handleStop = useCallback(() => {
    stopCue();
    wantsPlay.current = false;
    pause();
    dispatch({ type: 'stop' });
  }, [pause, stopCue]);

  /**
   * Volver a la estantería propia sin recargar: cierra lo que haya abierto y
   * suelta la estantería ajena. El disco no se detiene, sólo se minimiza; una
   * navegación de verdad cortaría la música, que es lo que se quiere evitar.
   */
  const handleHome = useCallback(() => {
    setAdding(false);
    setAbout(false);
    setSharing(false);
    setEditing(false);
    setVisited(null);
    if (state.album && (state.playing || state.time > 0)) dispatch({ type: 'minimize' });
    else {
      wantsPlay.current = false;
      pause();
      dispatch({ type: 'stop' });
    }
    const url = new URL(window.location.href);
    url.searchParams.delete('shelf');
    url.searchParams.delete('record');
    window.history.replaceState(null, '', url);
  }, [state.album, state.playing, state.time, pause]);

  const handleExpand = useCallback((rect: DOMRect, from: HTMLElement) => {
    originRef.current = rect;
    returnFocus.current = from;
    dispatch({ type: 'expand' });
  }, []);

  const step = useCallback(
    (delta: number) => {
      const next = state.trackIndex + delta;
      if (next < 0 || next >= total) return;
      dispatch({ type: 'track', index: next });
    },
    [state.trackIndex, total],
  );

  /** Elegir un tema de la lista es poner el disco: con la púa arriba, hay ritual. */
  const pick = useCallback(
    (index: number) => {
      if (state.needle === 'cueing') return;
      dispatch({ type: 'track', index });
      if (state.needle === 'up') {
        lowerNeedle();
        return;
      }
      wantsPlay.current = true;
    },
    [state.needle, lowerNeedle],
  );

  /**
   * Levantar el brazo con la mano. Callar el audio no es un efecto: una púa
   * fuera del surco no suena, y el silencio es lo que hace creíble el gesto.
   */
  const handleGrabArm = useCallback(() => {
    ensureContext();
    stopCue();
    wantsPlay.current = false;
    pause();
    dispatch({ type: 'grab' });
  }, [ensureContext, stopCue, pause]);

  /** Apoyarlo sobre el surco: suena desde donde cayó, sin ritual de por medio. */
  const handlePlaceArm = useCallback(
    (progress: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      const length = Number.isFinite(audio.duration) ? audio.duration : state.duration;
      // Nunca exactamente en el final: caería en `ended` y saltaría de tema sin
      // que se oiga nada, que parece un bug y no el final de una cara.
      const at = Math.min(progress * length, Math.max(length - 0.25, 0));
      try {
        audio.currentTime = at;
      } catch {
        /* sin metadata todavía: arranca donde esté */
      }
      dispatch({ type: 'time', value: at });
      dispatch({ type: 'place' });
      cue.drop();
      wantsPlay.current = true;
      void play();
    },
    [audioRef, state.duration, cue, play],
  );

  /** Devolverlo al apoyo sin apoyarlo en el disco: queda como recién puesto. */
  const handleParkArm = useCallback(() => {
    wantsPlay.current = false;
    pause();
    const audio = audioRef.current;
    if (audio) {
      try {
        audio.currentTime = 0;
      } catch {
        /* ídem */
      }
    }
    dispatch({ type: 'park' });
  }, [audioRef, pause]);

  const handleDelete = useCallback(
    (id: string) => {
      if (userRecords.some((r) => r.id === id)) {
        setUserRecords((prev) => {
          const next = prev.filter((r) => r.id !== id);
          saveUserRecords(next);
          return next;
        });
        return;
      }

      // Una semilla no se borra: se marca como sacada de la estantería.
      setHidden((prev) => {
        if (prev.includes(id)) return prev;
        const next = [...prev, id];
        saveHiddenIds(next);
        return next;
      });
    },
    [userRecords],
  );

  const handleReorder = useCallback((ids: string[]) => {
    setOrder(ids);
    saveOrder(ids);
  }, []);

  /** Vaciar la estantería: los del usuario se borran, las semillas se esconden. */
  const handleRemoveAll = useCallback(() => {
    setUserRecords(() => {
      saveUserRecords([]);
      return [];
    });
    const all = seed.map((r) => r.id);
    setHidden(() => {
      saveHiddenIds(all);
      return all;
    });
    setOrder(() => {
      saveOrder([]);
      return [];
    });
    // Sin discos no hay nada que editar, y el modo edición esconde justo la
    // única salida que queda: agregar uno.
    setEditing(false);
  }, [seed]);

  const handleCrackle = useCallback(() => {
    setCrackle((level) => {
      const next: CrackleLevel = level === 'off' ? 'normal' : level === 'normal' ? 'high' : 'off';
      saveCrackle(next);
      return next;
    });
  }, []);

  const handleVolume = useCallback(
    (value: number) => {
      setVolume(value);
      applyVolume(value);
      saveVolume(value);
    },
    [applyVolume],
  );

  const handleAdd = useCallback(async (album: PickableAlbum) => {
    setAdding(false);
    const accent = await extractAccent(album.coverUrl);
    setUserRecords((prev) => {
      if (prev.some((r) => r.id === album.id)) return prev;
      const next: LibraryRecord[] = [
        ...prev,
        {
          id: album.id,
          title: album.title,
          artist: album.artist,
          year: album.year,
          coverUrl: album.coverUrl,
          accent,
          source: 'user',
        },
      ];
      saveUserRecords(next);
      return next;
    });
  }, []);

  // Handlers siempre frescos para listeners que se registran una sola vez.
  const latest = useRef({ handleToggle, handleClose, step, total, trackIndex: state.trackIndex });
  latest.current = { handleToggle, handleClose, step, total, trackIndex: state.trackIndex };

  // Enlace compartido: ?shelf= trae una estantería entera, ?record= un disco.
  const bootstrapped = useRef(false);
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    const params = new URLSearchParams(window.location.search);

    const shelf = decodeShelf(params.get('shelf') ?? '');
    if (shelf) {
      void (async () => {
        const albums = await fetchAlbums(shelf.ids).catch(() => []);
        if (!albums.length) return;
        const records = await Promise.all(
          albums.map(async (album) => ({
            id: album.id,
            title: album.title,
            artist: album.artist,
            year: album.year,
            coverUrl: album.coverUrl,
            accent: await extractAccent(album.coverUrl),
            source: 'user' as const,
          })),
        );
        setVisited({ name: shelf.name || 'A shelf', records });
      })();
    }

    const id = params.get('record');
    if (!id || !/^\d+$/.test(id)) return;

    // Sin gesto del usuario el audio no puede arrancar: abre en pausa.
    wantsPlay.current = false;
    originRef.current = null;

    const known = library.find((r) => r.id === id);
    if (known) {
      dispatch({ type: 'select', record: known });
      return;
    }

    void (async () => {
      try {
        const album = await fetchAlbum(id);
        const accent = await extractAccent(album.coverUrl);
        dispatch({
          type: 'select',
          record: {
            id: album.id,
            title: album.title,
            artist: album.artist,
            year: album.year,
            coverUrl: album.coverUrl,
            accent,
            source: 'user',
          },
        });
      } catch {
        /* enlace roto: se queda en la estantería */
      }
    })();
  }, [library]);

  // Reescribe lo que puso el servidor, así que tiene que decir lo mismo cuando
  // no hay nada abierto: si no, el título se acortaba solo al hidratar.
  useEffect(() => {
    if (state.view === 'player' && state.record) {
      document.title = `deadwax · ${state.record.title} by ${state.record.artist}`;
      return;
    }
    document.title = visited ? `deadwax · ${visited.name}` : SITE_TITLE;
  }, [state.view, state.record, visited]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (state.view === 'player' && state.record) url.searchParams.set('record', state.record.id);
    else url.searchParams.delete('record');
    window.history.replaceState(null, '', url);
  }, [state.view, state.record]);

  // Depende del disco y no de la vista: minimizar y volver a abrir no vuelve a
  // pedir el álbum ni reinicia el track que está sonando.
  useEffect(() => {
    if (!state.record) return;
    const record = state.record;
    const ctrl = new AbortController();
    let cancelled = false;

    void (async () => {
      try {
        const album = await fetchAlbum(record.id, ctrl.signal);
        if (!cancelled) dispatch({ type: 'loaded', album });
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        if (!cancelled) dispatch({ type: 'failed' });
      }
    })();

    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [state.record]);

  useEffect(() => {
    if (!track) return;
    load(track.src);
    if (wantsPlay.current) void play();
  }, [track, load, play]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => dispatch({ type: 'time', value: audio.currentTime });
    const onMeta = () =>
      dispatch({ type: 'duration', value: Number.isFinite(audio.duration) ? audio.duration : 30 });
    const onPlay = () => dispatch({ type: 'playing', value: true });
    const onPause = () => dispatch({ type: 'playing', value: false });
    const onEnded = () => {
      const { trackIndex, total: n, step: go } = latest.current;
      if (trackIndex < n - 1) go(1);
      else wantsPlay.current = false;
    };

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
    };
  }, [audioRef]);

  useEffect(() => {
    const el = galleryRef.current;
    if (!el) return;
    const open = state.view === 'player' || adding || about || sharing;
    if (reduced()) {
      gsap.set(el, { opacity: open ? 0 : 1 });
      return;
    }
    gsap.to(el, {
      opacity: open ? 0 : 1,
      scale: open ? 0.965 : 1,
      duration: open ? 0.5 : 0.6,
      ease: 'power3.out',
    });
  }, [state.view, adding, about, sharing]);

  useEffect(() => {
    if (state.view !== 'player') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        latest.current.handleClose();
        return;
      }
      // Que las teclas no le roben la activación a un control enfocado. El
      // input incluido: sobre el volumen, las flechas son suyas, no del disco.
      if (e.target instanceof HTMLElement && e.target.closest('button, input')) return;

      if (e.key === ' ') {
        e.preventDefault();
        latest.current.handleToggle();
        return;
      }
      // Izquierda y derecha pasan de tema, como los botones de abajo. Arriba y
      // abajo quedan libres para moverse por la lista.
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        latest.current.step(e.key === 'ArrowRight' ? 1 : -1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.view]);

  // Al volver de un disco, el foco no puede quedar en el vacío: vuelve a la
  // funda de donde salió, si sigue en la estantería.
  useEffect(() => {
    if (state.view === 'player') return;
    const el = returnFocus.current;
    if (el?.isConnected) el.focus();
  }, [state.view]);

  const open = state.view === 'player';

  return (
    <>
      <div ref={galleryRef} inert={open || adding || about || sharing || undefined}>
        <Gallery
          records={library}
          editing={editing}
          theme={theme}
          shelfName={visited?.name ?? null}
          playerBar={Boolean(state.record && state.album)}
          onSelect={handleSelect}
          onOpenAdd={() => setAdding(true)}
          onOpenAbout={() => setAbout(true)}
          onOpenShare={() => setSharing(true)}
          onToggleEdit={() => setEditing((v) => !v)}
          onToggleTheme={toggleTheme}
          onDelete={handleDelete}
          onReorder={handleReorder}
          onRemoveAll={handleRemoveAll}
          onHome={handleHome}
        />
      </div>

      {adding && (
        <AddPanel
          existingIds={new Set(library.map((r) => r.id))}
          onPick={handleAdd}
          onClose={() => setAdding(false)}
        />
      )}

      {about && <About onClose={() => setAbout(false)} onHome={handleHome} />}

      {sharing && (
        <SharePanel
          ids={own.map((r) => r.id)}
          initialName={shelfName}
          onSaveName={(name) => {
            setShelfName(name);
            saveShelfName(name);
          }}
          onClose={() => setSharing(false)}
        />
      )}

      {open && state.record && (
        <Turntable
          record={state.record}
          album={state.album}
          status={state.status}
          track={track}
          trackIndex={state.trackIndex}
          playing={state.playing}
          time={state.time}
          duration={state.duration}
          crackle={crackle}
          volume={volume}
          needle={state.needle}
          lead={state.lead}
          originRect={originRef.current}
          onGrabArm={handleGrabArm}
          onPlaceArm={handlePlaceArm}
          onParkArm={handleParkArm}
          onToggle={handleToggle}
          onPrev={() => step(-1)}
          onNext={() => step(1)}
          onPick={pick}
          onCrackle={handleCrackle}
          onVolume={handleVolume}
          onHome={handleHome}
          onClose={handleClose}
        />
      )}

      {/* Los paneles se declaran modales, así que la barra no puede quedar
          flotando encima: la música sigue, sólo se esconde el control. */}
      {!open && !adding && !about && !sharing && state.record && state.album && (
        <MiniPlayer
          record={state.record}
          track={track}
          trackIndex={state.trackIndex}
          total={total}
          playing={state.playing}
          time={state.time}
          duration={state.duration}
          volume={volume}
          onToggle={handleToggle}
          onPrev={() => step(-1)}
          onNext={() => step(1)}
          onVolume={handleVolume}
          onExpand={handleExpand}
          onStop={handleStop}
        />
      )}

      <audio ref={audioRef} crossOrigin="anonymous" preload="auto" />
    </>
  );
}
