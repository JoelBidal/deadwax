/**
 * Una estantería compartida viaja entera en la URL: nombre más ids de iTunes,
 * en base64url. Sin base de datos y sin cuentas, el enlace es el dato. Nueve
 * discos entran en unos 160 caracteres, así que no hay riesgo de pasarse.
 */
export type Shelf = { name: string; ids: string[] };

export const MAX_RECORDS = 60;
export const MAX_NAME = 60;

const b64url = (s: string): string => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const unb64url = (v: string): string => {
  const bin = atob(v.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

export function encodeShelf(shelf: Shelf): string {
  const payload = {
    n: shelf.name.trim().slice(0, MAX_NAME),
    r: shelf.ids.filter((id) => /^\d+$/.test(id)).slice(0, MAX_RECORDS),
  };
  return b64url(JSON.stringify(payload));
}

/** Todo lo que llega por acá es texto de un desconocido: se valida entero. */
export function decodeShelf(value: string): Shelf | null {
  if (!value || value.length > 4000) return null;
  try {
    const parsed: unknown = JSON.parse(unb64url(value));
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { n, r } = parsed as { n?: unknown; r?: unknown };
    if (!Array.isArray(r)) return null;

    const ids = r.filter((id): id is string => typeof id === 'string' && /^\d+$/.test(id));
    if (!ids.length) return null;

    return {
      name: (typeof n === 'string' ? n : '').trim().slice(0, MAX_NAME),
      ids: ids.slice(0, MAX_RECORDS),
    };
  } catch {
    return null;
  }
}
