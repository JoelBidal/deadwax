import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import type { LibraryRecord } from '../../lib/types';
import { softHome } from '../../lib/nav';
import Sleeve from './Sleeve';
import AddSlot from './AddSlot';
import styles from './Gallery.module.css';

type Props = {
  records: LibraryRecord[];
  editing: boolean;
  theme: 'dark' | 'light';
  /** Con nombre, esta estantería es de otro: no se edita ni se le agregan discos. */
  shelfName: string | null;
  /** Hay un disco sonando en la barra de abajo, que se come el pie de página. */
  playerBar: boolean;
  onSelect: (id: string, from: HTMLElement) => void;
  onOpenAdd: () => void;
  onOpenAbout: () => void;
  onOpenShare: () => void;
  onToggleEdit: () => void;
  onToggleTheme: () => void;
  onDelete: (id: string) => void;
  onReorder: (ids: string[]) => void;
  onRemoveAll: () => void;
  onHome: () => void;
};

type Slot = { left: number; top: number; right: number; bottom: number };

type Drag = {
  id: string;
  el: HTMLLIElement;
  pointerId: number;
  /** Dónde agarró el puntero dentro de la funda, para que no salte al tomarla. */
  grabX: number;
  grabY: number;
  /** Posición de layout de la funda, sin el transform que la sigue. */
  baseLeft: number;
  baseTop: number;
  lastX: number;
  lastY: number;
  /**
   * Las casillas de la grilla en coordenadas de página, medidas una sola vez.
   * Las fundas se permutan entre casillas fijas, así que la geometría no cambia
   * durante el arrastre; leerla de los elementos daría posiciones a mitad de
   * animación y el objetivo saltaría de una a otra.
   */
  slots: Slot[];
  /** Hasta cruzar el umbral no es un arrastre: es un click que todavía no soltó. */
  active: boolean;
  fromX: number;
  fromY: number;
};

/** Cuánto hay que moverse para que deje de ser un click. */
const THRESHOLD = 5;

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function Gallery({
  records,
  editing,
  theme,
  shelfName,
  playerBar,
  onSelect,
  onOpenAdd,
  onOpenAbout,
  onOpenShare,
  onToggleEdit,
  onToggleTheme,
  onDelete,
  onReorder,
  onRemoveAll,
  onHome,
}: Props) {
  const visiting = shelfName !== null;
  const gridRef = useRef<HTMLUListElement>(null);
  const prevCount = useRef(records.length);
  const dragRef = useRef<Drag | null>(null);
  /** Dónde estaba cada funda antes del último reordenamiento, para el FLIP. */
  const prevRects = useRef<Map<string, DOMRect> | null>(null);
  const [announce, setAnnounce] = useState('');
  const [confirmWipe, setConfirmWipe] = useState(false);

  const ids = records.map((r) => r.id);
  const showHint = editing && !visiting && records.length > 1;

  /** Mueve un id de una posición a otra y devuelve la lista entera. */
  const moved = (id: string, to: number) => {
    const next = ids.filter((other) => other !== id);
    next.splice(Math.max(0, Math.min(next.length, to)), 0, id);
    return next;
  };

  const sleeves = () =>
    [...(gridRef.current?.querySelectorAll<HTMLLIElement>(':scope > li[data-id]') ?? [])];

  const snapshot = () => {
    const map = new Map<string, DOMRect>();
    for (const li of sleeves()) map.set(li.dataset.id!, li.getBoundingClientRect());
    prevRects.current = map;
  };

  const startDrag = (e: React.PointerEvent<HTMLUListElement>) => {
    if (!editing || visiting || dragRef.current) return;
    // Sólo el botón principal: el secundario abre el menú del navegador.
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-action]')) return;
    const li = target.closest<HTMLLIElement>('li[data-id]');
    if (!li) return;

    const rect = li.getBoundingClientRect();
    dragRef.current = {
      id: li.dataset.id!,
      el: li,
      pointerId: e.pointerId,
      grabX: e.clientX - rect.left,
      grabY: e.clientY - rect.top,
      baseLeft: rect.left,
      baseTop: rect.top,
      lastX: e.clientX,
      lastY: e.clientY,
      slots: sleeves().map((cell) => {
        const r = cell.getBoundingClientRect();
        return {
          left: r.left + window.scrollX,
          top: r.top + window.scrollY,
          right: r.right + window.scrollX,
          bottom: r.bottom + window.scrollY,
        };
      }),
      active: false,
      fromX: e.clientX,
      fromY: e.clientY,
    };
  };

  const onDragMove = (e: React.PointerEvent<HTMLUListElement>) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;

    if (!drag.active) {
      if (Math.hypot(e.clientX - drag.fromX, e.clientY - drag.fromY) < THRESHOLD) return;
      // Recién ahora se captura: hacerlo en el pointerdown le roba el click a
      // cualquier botón de adentro, aunque el usuario nunca haya arrastrado.
      drag.active = true;
      drag.el.setPointerCapture(drag.pointerId);
      drag.el.classList.add(styles.lifted!);
    }

    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    gsap.set(drag.el, {
      x: e.clientX - drag.grabX - drag.baseLeft,
      y: e.clientY - drag.grabY - drag.baseTop,
    });

    // Qué casilla pisa el puntero. Contra las casillas fijas y no contra las
    // fundas: mientras el FLIP corre, sus rects están a mitad de camino y el
    // objetivo oscilaba entre dos posiciones.
    const px = e.clientX + window.scrollX;
    const py = e.clientY + window.scrollY;
    const over = drag.slots.findIndex(
      (s) => px >= s.left && px <= s.right && py >= s.top && py <= s.bottom,
    );
    if (over < 0 || over === ids.indexOf(drag.id)) return;

    snapshot();
    onReorder(moved(drag.id, over));
  };

  const endDrag = (e: React.PointerEvent<HTMLUListElement>) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    if (!drag.active) return;

    drag.el.classList.remove(styles.lifted!);
    try {
      drag.el.releasePointerCapture(drag.pointerId);
    } catch {
      /* el puntero ya se fue */
    }
    if (reduced()) gsap.set(drag.el, { x: 0, y: 0 });
    else gsap.to(drag.el, { x: 0, y: 0, duration: 0.3, ease: 'power3.out' });
  };

  /**
   * Después de cada reordenamiento las fundas ya están en su lugar nuevo: se las
   * devuelve al viejo con un transform y se las suelta. La que se arrastra no
   * entra en el FLIP, pero sí hay que re-anclarla: su posición de layout cambió
   * y el transform que la pega al puntero se mide contra esa posición.
   */
  useLayoutEffect(() => {
    const prev = prevRects.current;
    if (!prev) return;
    prevRects.current = null;

    const drag = dragRef.current;
    const soft = !reduced();

    for (const li of sleeves()) {
      const before = prev.get(li.dataset.id!);
      if (!before) continue;

      if (drag?.active && li === drag.el) {
        const x = Number(gsap.getProperty(li, 'x')) || 0;
        const y = Number(gsap.getProperty(li, 'y')) || 0;
        const now = li.getBoundingClientRect();
        drag.baseLeft = now.left - x;
        drag.baseTop = now.top - y;
        gsap.set(li, {
          x: drag.lastX - drag.grabX - drag.baseLeft,
          y: drag.lastY - drag.grabY - drag.baseTop,
        });
        continue;
      }

      const now = li.getBoundingClientRect();
      const dx = before.left - now.left;
      const dy = before.top - now.top;
      if (!dx && !dy) continue;
      if (soft) gsap.fromTo(li, { x: dx, y: dy }, { x: 0, y: 0, duration: 0.3, ease: 'power3.out' });
      else gsap.set(li, { x: 0, y: 0 });
    }
  }, [records]);

  /**
   * Flechas para moverse por la estantería, como quien pasa discos con la mano.
   * Las columnas se leen de la grilla ya resuelta en vez de duplicar los
   * breakpoints acá: una sola fuente de verdad, y sigue siendo el CSS.
   */
  const onGridKey = (e: React.KeyboardEvent<HTMLUListElement>) => {
    const grid = gridRef.current;
    if (!grid) return;

    // Con Alt, las flechas mueven el disco en vez de mover el foco: es el camino
    // de teclado para lo mismo que hace el arrastre, que con teclado no existe.
    if (editing && !visiting && e.altKey && e.key.startsWith('Arrow')) {
      const li = (e.target as HTMLElement).closest<HTMLLIElement>('li[data-id]');
      if (!li) return;
      const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
      const jump =
        e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowDown' ? cols : -cols;
      const id = li.dataset.id!;
      const to = ids.indexOf(id) + jump;
      if (to < 0 || to >= ids.length) return;
      e.preventDefault();
      snapshot();
      onReorder(moved(id, to));
      setAnnounce(`Moved to position ${to + 1} of ${ids.length}`);
      return;
    }

    const steps: Record<string, number | 'first' | 'last'> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: 0,
      ArrowUp: 0,
      Home: 'first',
      End: 'last',
    };
    const step = steps[e.key];
    if (step === undefined) return;

    const cells = [...grid.querySelectorAll<HTMLButtonElement>(':scope > li > button')];
    const from = (e.target as HTMLElement).closest('li');
    const current = from ? cells.findIndex((b) => b.closest('li') === from) : -1;
    if (current < 0) return;

    const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
    const delta = e.key === 'ArrowDown' ? cols : e.key === 'ArrowUp' ? -cols : step;
    const next =
      step === 'first' ? 0 : step === 'last' ? cells.length - 1 : current + (delta as number);

    const target = cells[Math.max(0, Math.min(cells.length - 1, next))];
    if (!target || target === cells[current]) return;
    e.preventDefault();
    target.focus();
  };

  // La estantería aparece sin animación: ya está ahí cuando entrás.
  // Lo único que se anima es un disco recién agregado.
  useEffect(() => {
    const grid = gridRef.current;
    if (grid && records.length > prevCount.current && !reduced()) {
      const entering = grid.querySelectorAll('li')[records.length - 1];
      if (entering) {
        gsap.from(entering, {
          opacity: 0,
          scale: 0.84,
          duration: 0.75,
          ease: 'expo.out',
          clearProps: 'opacity,transform',
        });
      }
    }
    prevCount.current = records.length;
  }, [records.length]);

  return (
    <div className={`${styles.gallery}`}>
      <header className={styles.nav}>
        {/* El logo dibuja la marca pero no la dice: el h1 necesita texto. */}
        <a className={styles.name} href="/" aria-label="deadwax" onClick={softHome(onHome)}>
          <span className="visually-hidden">deadwax</span>
          <svg
            aria-hidden="true"
            width="110"
            height="20"
            viewBox="0 0 110 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M19.8608 19.8608H0V0H19.8608V19.8608ZM9.93191 2.29164C5.71316 2.29164 2.29313 5.71167 2.29313 9.93042C2.29313 14.1492 5.71316 17.5692 9.93191 17.5692C14.1507 17.5692 17.5707 14.1492 17.5707 9.93042C17.5707 5.71167 14.1507 2.29164 9.93191 2.29164Z" fill="currentColor"/>
            <path d="M10.6958 9.93042C10.6958 10.3523 10.3538 10.6943 9.93191 10.6943C9.51004 10.6943 9.16803 10.3523 9.16803 9.93042C9.16803 9.50855 9.51004 9.16654 9.93191 9.16654C10.3538 9.16654 10.6958 9.50855 10.6958 9.93042Z" fill="currentColor"/>
            <path d="M30.7641 17.7207C29.7858 17.7207 28.9298 17.4762 28.1961 16.987C27.4767 16.4979 26.9229 15.8073 26.5344 14.9154C26.1604 14.009 25.9734 12.9444 25.9734 11.7216C25.9734 10.4987 26.1676 9.44134 26.556 8.54937C26.9444 7.64303 27.4983 6.94528 28.2177 6.45614C28.937 5.967 29.7858 5.72243 30.7641 5.72243C31.5553 5.72243 32.2602 5.88788 32.8789 6.21877C33.4975 6.54966 33.965 7.01002 34.2815 7.59987V2.1402H36.569V17.4618H34.4326L34.3679 15.7354C34.0514 16.354 33.5694 16.8432 32.922 17.2028C32.289 17.5481 31.5697 17.7207 30.7641 17.7207ZM31.3683 15.7354C31.9869 15.7354 32.512 15.5772 32.9436 15.2607C33.3752 14.9442 33.7061 14.4838 33.9363 13.8796C34.1665 13.2753 34.2815 12.556 34.2815 11.7216C34.2815 10.8584 34.1665 10.1319 33.9363 9.54204C33.7061 8.93781 33.3752 8.48464 32.9436 8.18252C32.512 7.86602 31.9869 7.70777 31.3683 7.70777C30.4476 7.70777 29.7138 8.06743 29.1672 8.78675C28.6205 9.49169 28.3471 10.47 28.3471 11.7216C28.3471 12.9588 28.6205 13.9371 29.1672 14.6564C29.7138 15.3758 30.4476 15.7354 31.3683 15.7354Z" fill="currentColor"/>
            <path d="M43.2508 17.7207C42.1286 17.7207 41.1575 17.4762 40.3375 16.987C39.5319 16.4979 38.9061 15.8002 38.4601 14.8938C38.0285 13.9875 37.8127 12.9301 37.8127 11.7216C37.8127 10.5131 38.0285 9.46292 38.4601 8.57095C38.9061 7.66461 39.5319 6.96686 40.3375 6.47772C41.1432 5.9742 42.0927 5.72243 43.186 5.72243C44.2219 5.72243 45.1354 5.967 45.9267 6.45614C46.7179 6.9309 47.3293 7.62145 47.7609 8.52779C48.2069 9.43414 48.4299 10.5275 48.4299 11.8079V12.3906H40.1865C40.244 13.5127 40.5389 14.3543 41.0712 14.9154C41.6179 15.4765 42.3516 15.757 43.2724 15.757C43.9485 15.757 44.5096 15.5987 44.9556 15.2822C45.4016 14.9657 45.7109 14.5413 45.8835 14.009L48.2573 14.1601C47.9552 15.2247 47.3581 16.0879 46.4662 16.7497C45.5886 17.3971 44.5168 17.7207 43.2508 17.7207ZM40.1865 10.6642H46.013C45.941 9.64275 45.6461 8.88746 45.1282 8.39832C44.6247 7.90918 43.9773 7.66461 43.186 7.66461C42.366 7.66461 41.6898 7.92356 41.1575 8.44148C40.6396 8.945 40.3159 9.68591 40.1865 10.6642Z" fill="currentColor"/>
            <path d="M53.1159 17.7207C51.9218 17.7207 50.9651 17.4474 50.2458 16.9007C49.5409 16.354 49.1884 15.5844 49.1884 14.5917C49.1884 13.599 49.4833 12.8293 50.0732 12.2827C50.6774 11.7216 51.6053 11.3188 52.857 11.0742L56.806 10.3189C56.806 9.42695 56.5974 8.76517 56.1802 8.33358C55.763 7.8876 55.1444 7.66461 54.3244 7.66461C53.5907 7.66461 53.0152 7.83005 52.598 8.16094C52.1808 8.47744 51.8931 8.9522 51.7348 9.5852L49.3826 9.43414C49.5984 8.28323 50.1307 7.37688 50.9795 6.7151C51.8427 6.05332 52.9577 5.72243 54.3244 5.72243C55.8781 5.72243 57.0578 6.13964 57.8634 6.97406C58.6835 7.79409 59.0935 8.9522 59.0935 10.4484V14.9154C59.0935 15.1887 59.1366 15.3829 59.223 15.498C59.3237 15.5987 59.4819 15.6491 59.6977 15.6491H60.1077V17.4618C60.0358 17.4762 59.9207 17.4906 59.7625 17.505C59.6042 17.5193 59.4388 17.5265 59.2661 17.5265C58.777 17.5265 58.3526 17.4474 57.9929 17.2892C57.6476 17.1309 57.3887 16.8719 57.216 16.5123C57.0434 16.1382 56.9571 15.6419 56.9571 15.0233L57.1945 15.1312C57.0794 15.6347 56.8276 16.0807 56.4392 16.4691C56.0651 16.8576 55.5832 17.1669 54.9933 17.3971C54.4179 17.6129 53.7921 17.7207 53.1159 17.7207ZM53.4828 15.9081C54.1733 15.9081 54.7632 15.7786 55.2523 15.5196C55.7414 15.2463 56.1227 14.8722 56.396 14.3975C56.6694 13.9227 56.806 13.3832 56.806 12.779V12.0453L53.4396 12.6927C52.7491 12.8222 52.2599 13.0308 51.9722 13.3185C51.6988 13.5918 51.5622 13.9443 51.5622 14.3759C51.5622 14.865 51.7276 15.2463 52.0585 15.5196C52.4038 15.7786 52.8785 15.9081 53.4828 15.9081Z" fill="currentColor"/>
            <path d="M64.9544 17.7207C63.9761 17.7207 63.1201 17.4762 62.3864 16.987C61.6671 16.4979 61.1132 15.8073 60.7248 14.9154C60.3507 14.009 60.1637 12.9444 60.1637 11.7216C60.1637 10.4987 60.3579 9.44134 60.7464 8.54937C61.1348 7.64303 61.6887 6.94528 62.408 6.45614C63.1273 5.967 63.9761 5.72243 64.9544 5.72243C65.7457 5.72243 66.4506 5.88788 67.0692 6.21877C67.6878 6.54966 68.1554 7.01002 68.4719 7.59987V2.1402H70.7593V17.4618H68.6229L68.5582 15.7354C68.2417 16.354 67.7598 16.8432 67.1124 17.2028C66.4794 17.5481 65.76 17.7207 64.9544 17.7207ZM65.5586 15.7354C66.1772 15.7354 66.7024 15.5772 67.1339 15.2607C67.5655 14.9442 67.8964 14.4838 68.1266 13.8796C68.3568 13.2753 68.4719 12.556 68.4719 11.7216C68.4719 10.8584 68.3568 10.1319 68.1266 9.54204C67.8964 8.93781 67.5655 8.48464 67.1339 8.18252C66.7024 7.86602 66.1772 7.70777 65.5586 7.70777C64.6379 7.70777 63.9042 8.06743 63.3575 8.78675C62.8108 9.49169 62.5375 10.47 62.5375 11.7216C62.5375 12.9588 62.8108 13.9371 63.3575 14.6564C63.9042 15.3758 64.6379 15.7354 65.5586 15.7354Z" fill="currentColor"/>
            <path d="M75.0674 17.4618L71.5714 5.98139H73.9668L76.4269 14.9585L78.9517 5.98139H81.1097L83.6345 14.9585L86.1162 5.98139H88.5115L85.0156 17.4618H82.4476L80.0307 9.2615L77.6138 17.4618H75.0674Z" fill="currentColor"/>
            <path d="M92.2165 17.7207C91.0224 17.7207 90.0657 17.4474 89.3464 16.9007C88.6414 16.354 88.289 15.5844 88.289 14.5917C88.289 13.599 88.5839 12.8293 89.1737 12.2827C89.778 11.7216 90.7059 11.3188 91.9575 11.0742L95.9066 10.3189C95.9066 9.42695 95.698 8.76517 95.2808 8.33358C94.8636 7.8876 94.245 7.66461 93.4249 7.66461C92.6912 7.66461 92.1158 7.83005 91.6986 8.16094C91.2814 8.47744 90.9936 8.9522 90.8354 9.5852L88.4832 9.43414C88.699 8.28323 89.2313 7.37688 90.0801 6.7151C90.9433 6.05332 92.0582 5.72243 93.4249 5.72243C94.9787 5.72243 96.1584 6.13964 96.964 6.97406C97.784 7.79409 98.194 8.9522 98.194 10.4484V14.9154C98.194 15.1887 98.2372 15.3829 98.3235 15.498C98.4242 15.5987 98.5825 15.6491 98.7983 15.6491H99.2083V17.4618C99.1364 17.4762 99.0213 17.4906 98.863 17.505C98.7048 17.5193 98.5393 17.5265 98.3667 17.5265C97.8776 17.5265 97.4531 17.4474 97.0935 17.2892C96.7482 17.1309 96.4893 16.8719 96.3166 16.5123C96.144 16.1382 96.0577 15.6419 96.0577 15.0233L96.295 15.1312C96.1799 15.6347 95.9282 16.0807 95.5397 16.4691C95.1657 16.8576 94.6837 17.1669 94.0939 17.3971C93.5184 17.6129 92.8926 17.7207 92.2165 17.7207ZM92.5833 15.9081C93.2739 15.9081 93.8637 15.7786 94.3529 15.5196C94.842 15.2463 95.2232 14.8722 95.4966 14.3975C95.7699 13.9227 95.9066 13.3832 95.9066 12.779V12.0453L92.5402 12.6927C91.8496 12.8222 91.3605 13.0308 91.0727 13.3185C90.7994 13.5918 90.6627 13.9443 90.6627 14.3759C90.6627 14.865 90.8282 15.2463 91.1591 15.5196C91.5043 15.7786 91.9791 15.9081 92.5833 15.9081Z" fill="currentColor"/>
            <path d="M98.9296 17.4618L103.094 11.5921L99.1022 5.98139H101.649L104.476 10.1031L107.216 5.98139H109.827L105.878 11.6353L110 17.4618H107.454L104.497 13.0811L101.519 17.4618H98.9296Z" fill="currentColor"/>
          </svg>
        </a>
        <nav className={styles.links}>
          <button type="button" className={styles.link} onClick={onOpenAbout}>
            About
          </button>
          {visiting ? (
            <a className={styles.link} href="/" onClick={softHome(onHome)}>
              Open your own shelf
            </a>
          ) : (
            <>
              {/* Sin discos no hay nada que ordenar ni que sacar. */}
              {records.length > 0 && (
                <button
                  type="button"
                  className={`${styles.link} ${editing ? styles.linkOn : ''}`}
                  onClick={() => {
                    setConfirmWipe(false);
                    onToggleEdit();
                  }}
                  aria-pressed={editing}
                >
                  {editing ? 'Done' : 'Edit shelf'}
                </button>
              )}
              {/* Editar y agregar son dos modos distintos: mientras se ordena y
                  se saca, la puerta de entrada estorba. */}
              {editing ? (
                records.length > 0 && (
                  // Vaciar la estantería no se deshace, así que el primer click
                  // sólo pregunta. Un confirm() nativo rompería el tono del sitio.
                  <button
                    type="button"
                    className={`${styles.link} ${confirmWipe ? styles.linkOn : ''}`}
                    onClick={() => {
                      if (!confirmWipe) {
                        setConfirmWipe(true);
                        return;
                      }
                      setConfirmWipe(false);
                      onRemoveAll();
                    }}
                  >
                    {confirmWipe ? 'Remove all, really?' : 'Remove all'}
                  </button>
                )
              ) : (
                <button type="button" className={styles.link} onClick={onOpenAdd}>
                  Add a record
                </button>
              )}
              <button type="button" className={styles.link} onClick={onOpenShare}>
                Share shelf
              </button>
            </>
          )}
          {/* El tema no es una sección del sitio: va aparte, detrás de la regla. */}
          <button
            type="button"
            className={`${styles.link} ${styles.theme}`}
            onClick={onToggleTheme}
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </nav>
      </header>

      {visiting && (
        <div className={styles.shelfHead}>
          <h2 className={styles.shelfName}>{shelfName}</h2>
          <p className={styles.shelfNote}>A shelf someone put together and sent you.</p>
        </div>
      )}


      <div className={styles.shelf}>
        <ul
          ref={gridRef}
          className={styles.grid}
          onKeyDown={onGridKey}
          onPointerDown={startDrag}
          onPointerMove={onDragMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {records.map((record, i) => (
            <Sleeve
              key={record.id}
              record={record}
              index={i}
              editing={editing}
              onSelect={onSelect}
              onDelete={onDelete}
            />
          ))}
          {!visiting && !editing && <AddSlot onOpen={onOpenAdd} />}
        </ul>
      </div>

      {/*
        Siempre en el DOM y sólo oculto: si apareciera al entrar en edición, se
        comería alto del contenedor de la estantería y la grilla, que está
        centrada, daría un salto. Reservado, el modo se enciende sin mover nada.
      */}
      <p
        className={`${styles.hint} ${showHint ? '' : styles.hintOff}`}
        aria-hidden={showHint ? undefined : true}
      >
        Drag a sleeve to move it, or hold Alt and use the arrow keys.
      </p>

      {/* Lo que el arrastre muestra sin decir, el teclado tiene que decirlo. */}
      <span className="visually-hidden" role="status" aria-live="polite">
        {announce}
      </span>
    </div>
  );
}
