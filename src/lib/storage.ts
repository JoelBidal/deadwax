import type { LibraryRecord } from './types';

const KEY = 'vinyl:records';
const HIDDEN_KEY = 'vinyl:hidden';
const NAME_KEY = 'vinyl:shelf-name';

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
