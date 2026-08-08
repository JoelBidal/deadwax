import type { CrackleLevel, LibraryRecord } from './types';

const KEY = 'vinyl:records';
const HIDDEN_KEY = 'vinyl:hidden';
const NAME_KEY = 'vinyl:shelf-name';
const ORDER_KEY = 'vinyl:order';
const CRACKLE_KEY = 'vinyl:crackle';
const VOLUME_KEY = 'vinyl:volume';

/** Sólo metadata: el audio siempre viene de iTunes, nunca se guarda. */
export function loadUserRecords(): LibraryRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is LibraryRecord =>
        typeof r === 'object' && r !== null && typeof (r as LibraryRecord).id === 'string',
    );
  } catch {
    return [];
  }
}

export function saveUserRecords(records: LibraryRecord[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(records));
  } catch {
    /* cuota llena o modo privado: la sesión sigue, no se persiste */
  }
}

/** El nombre con el que el usuario firma su estantería al compartirla. */
export function loadShelfName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveShelfName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* ídem */
  }
}

/** Discos semilla que el usuario sacó de su estantería. */
export function loadHiddenIds(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function saveHiddenIds(ids: string[]): void {
  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(ids));
  } catch {
    /* ídem */
  }
}

/**
 * El orden en que el usuario dejó los discos. Se guarda aparte de los discos
 * porque tiene que ordenar también las semillas, que no viven en localStorage.
 * Lo que no figure acá va al final: un disco recién agregado no se cuela al medio.
 */
export function loadOrder(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(ORDER_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function saveOrder(ids: string[]): void {
  try {
    localStorage.setItem(ORDER_KEY, JSON.stringify(ids));
  } catch {
    /* ídem */
  }
}

export function loadCrackle(): CrackleLevel {
  try {
    const raw = localStorage.getItem(CRACKLE_KEY);
    return raw === 'off' || raw === 'high' ? raw : 'normal';
  } catch {
    return 'normal';
  }
}

export function saveCrackle(level: CrackleLevel): void {
  try {
    localStorage.setItem(CRACKLE_KEY, level);
  } catch {
    /* ídem */
  }
}

export function loadVolume(): number {
  try {
    // Sin la comprobación de null, `Number(null)` es 0 y el sitio abre mudo.
    const raw = localStorage.getItem(VOLUME_KEY);
    if (raw === null) return 1;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 && value <= 1 ? value : 1;
  } catch {
    return 1;
  }
}

export function saveVolume(value: number): void {
  try {
    localStorage.setItem(VOLUME_KEY, String(value));
  } catch {
    /* ídem */
  }
}
