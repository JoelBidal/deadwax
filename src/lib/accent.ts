import { dominantColor } from './color';

const FALLBACK = '#8a918c';

/**
 * Mismo algoritmo que el seed, pero en canvas. El CDN de Apple manda
 * access-control-allow-origin: *, así que con crossOrigin="anonymous" el canvas
 * no queda tainted y getImageData funciona.
 */
export async function extractAccent(url: string): Promise<string> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.decoding = 'async';
  img.src = url;

  try {
    await img.decode();
  } catch {
    return FALLBACK;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 10;
  canvas.height = 10;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return FALLBACK;

  ctx.drawImage(img, 0, 0, 10, 10);
  try {
    const { data } = ctx.getImageData(0, 0, 10, 10);
    return dominantColor(data, 4, 100);
  } catch {
    return FALLBACK;
  }
}
