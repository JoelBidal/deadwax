/*
 * En serverless el caché en memoria del proceso no sobrevive a un arranque en
 * frío, así que el que absorbe el tráfico real es el CDN. `s-maxage` es para él
 * y `max-age` para el navegador, que se queda corto a propósito: un caché fuerte
 * en el cliente lo deja con la forma vieja de los datos cada vez que cambia el
 * endpoint. `stale-while-revalidate` evita que un arranque en frío se le note al
 * usuario y le saca pedidos de encima a iTunes.
 */
export function json(data: unknown, status = 200, cacheSeconds = 0): Response {
  const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8' };
  if (cacheSeconds > 0) {
    headers['Cache-Control'] =
      `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}, stale-while-revalidate=86400`;
  }
  return new Response(JSON.stringify(data), { status, headers });
}
