export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [hue(h + 1 / 3), hue(h), hue(h - 1 / 3)].map((v) => Math.round(v * 255)) as [
    number,
    number,
    number,
  ];
}

/**
 * Promedio ponderado por croma sobre una miniatura ya decodificada.
 *
 * El promedio plano devuelve gris sucio en cualquier portada oscura, así que
 * pesamos por saturación. Pero una portada realmente acromática (Mezzanine,
 * The 1975) tiene que dar un neutro: forzarle saturación inventa un color que
 * no está en la imagen. De ahí el umbral de 0.15.
 */
export function dominantColor(
  data: Uint8Array | Uint8ClampedArray | number[],
  channels: number,
  pixels: number,
): string {
  let wr = 0;
  let wg = 0;
  let wb = 0;
  let total = 0;

  for (let i = 0; i < pixels; i++) {
    const o = i * channels;
    const r = data[o]!;
    const g = channels < 3 ? r : data[o + 1]!;
    const b = channels < 3 ? r : data[o + 2]!;
    if (channels === 4 && data[o + 3]! < 128) continue;

    const [, s, l] = rgbToHsl(r, g, b);
    const lightness = 1 - Math.abs(l - 0.5) * 1.6;
    const w = (0.08 + Math.pow(s, 1.5)) * Math.max(lightness, 0.05);
    wr += r * w;
    wg += g * w;
    wb += b * w;
    total += w;
  }

  if (total === 0) return '#8a918c';

  const [h, rawS, rawL] = rgbToHsl(wr / total, wg / total, wb / total);
  const s = rawS > 0.15 ? Math.min(Math.max(rawS, 0.3), 0.85) : Math.min(rawS, 0.15);
  // El accent se usa sobre fondo oscuro: lo llevamos a una banda legible.
  const l = Math.min(Math.max(rawL, 0.48), 0.7);
  const [r, g, b] = hslToRgb(h, s, l);
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}
