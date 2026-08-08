type Entry<T> = { value: T; expires: number };

/**
 * Caché de proceso, no de sesión: se comparte entre todos los visitantes.
 * Está bien acá porque los datos de iTunes son públicos e inmutables.
 * Con @astrojs/node standalone el proceso persiste y esto cachea de verdad;
 * en serverless viviría lo que dure la instancia.
 */
export class TTLCache<T> {
  #store = new Map<string, Entry<T>>();
  #ttl: number;
  #max: number;

  constructor(ttlMs: number, max = 300) {
    this.#ttl = ttlMs;
    this.#max = max;
  }

  get(key: string): T | undefined {
    const hit = this.#store.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) {
      this.#store.delete(key);
      return undefined;
    }
    // reinsertar mantiene el orden de la Map como LRU aproximado
    this.#store.delete(key);
    this.#store.set(key, hit);
    return hit.value;
  }

  set(key: string, value: T): void {
    if (this.#store.size >= this.#max) {
      const oldest = this.#store.keys().next();
      if (!oldest.done) this.#store.delete(oldest.value);
    }
    this.#store.set(key, { value, expires: Date.now() + this.#ttl });
  }
}
