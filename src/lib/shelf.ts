/**
 * Una estantería compartida viaja entera en la URL: el nombre legible y los ids
 * de iTunes en base36. Sin base de datos y sin cuentas, el enlace es el dato.
 *
 * Los ids son números de hasta diez dígitos y en base36 quedan en seis, así que
 * nueve discos entran en unos 60 caracteres. El nombre va aparte y sin codificar
 * para que el enlace se lea: quien lo recibe ve de qué estantería se trata antes
 * de abrirla.
 */
export type Shelf = { name: string; ids: string[] };

export const MAX_RECORDS = 60;
export const MAX_NAME = 60;
/**
 * Se exige al armar el enlace, no al leerlo: un enlace viejo con menos discos
 * tiene que seguir abriendo. Validar de nuevo acá sólo rompería links que ya
 * andan sin impedir ninguno nuevo.
 */
export const MIN_RECORDS = 3;

const validId = (id: string) => /^\d+$/.test(id);

/** Los dos parámetros que llevan una estantería, listos para pegar tras el `?`. */
export function encodeShelf(shelf: Shelf): string {
  const params = new URLSearchParams();
  // El nombre primero: es lo único de la URL que se lee de un vistazo.
  const name = shelf.name.trim().slice(0, MAX_NAME);
  if (name) params.set('name', name);
  params.set(
    'shelf',
    shelf.ids
      .filter(validId)
      .slice(0, MAX_RECORDS)
      .map((id) => Number(id).toString(36))
      .join('.'),
  );
  return params.toString();
}

/**
 * Formato viejo: todo el objeto en base64url dentro de `?shelf=`. Se sigue
 * leyendo porque hay enlaces sueltos por ahí y no cuesta nada; no se genera más.
 * El JSON siempre arrancaba en `{"n`, que en base64 es `eyJu`.
 */
function decodeLegacy(value: string): Shelf | null {
  try {
    const bin = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { n, r } = parsed as { n?: unknown; r?: unknown };
    if (!Array.isArray(r)) return null;
    const ids = r.filter((id): id is string => typeof id === 'string' && validId(id));
    if (!ids.length) return null;
    return {
      name: (typeof n === 'string' ? n : '').trim().slice(0, MAX_NAME),
      ids: ids.slice(0, MAX_RECORDS),
    };
  } catch {
    return null;
  }
}

/** Todo lo que llega por acá es texto de un desconocido: se valida entero. */
export function decodeShelf(params: URLSearchParams): Shelf | null {
  const raw = params.get('shelf') ?? '';
  if (!raw || raw.length > 4000) return null;
  if (raw.startsWith('eyJ')) return decodeLegacy(raw);

  const ids: string[] = [];
  for (const token of raw.split('.')) {
    if (!/^[0-9a-z]{1,11}$/.test(token)) return null;
    const value = parseInt(token, 36);
    if (!Number.isSafeInteger(value) || value <= 0) return null;
    ids.push(String(value));
  }
  if (!ids.length) return null;

  return {
    name: (params.get('name') ?? '').trim().slice(0, MAX_NAME),
    ids: ids.slice(0, MAX_RECORDS),
  };
}
