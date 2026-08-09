/**
 * Los ruidos del mecanismo, sintetizados como el crackle y por la misma razón:
 * no hay samples que licenciar y un tocadiscos suena a física, no a grabación.
 * Cada función agenda su sonido contra el reloj del AudioContext, que es
 * preciso al sample; `setTimeout` serviría para la vista pero no para el oído.
 *
 * Los niveles están arriba y sueltos a propósito: son lo primero que se toca
 * cuando algo suena de más o de menos.
 */

/*
 * Multiplicadores de gain, no niveles de salida: cada filtro se come una parte,
 * así que el pico real se mide, no se deduce. Los de acá están calibrados
 * renderizando cada sonido en un OfflineAudioContext y mirando la onda.
 */
const LEVEL = {
  clickTick: 0.5,
  clickBody: 0.42,
  motor: 0.26,
  servo: 0.2,
  dropThud: 0.6,
  dropTick: 0.26,
} as const;

/** Dos segundos de ruido blanco, reusados con desfases al azar. */
const noiseCache = new WeakMap<AudioContext, AudioBuffer>();

function noise(ctx: AudioContext): AudioBuffer {
  const cached = noiseCache.get(ctx);
  if (cached) return cached;
  const length = Math.floor(ctx.sampleRate * 2);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  noiseCache.set(ctx, buffer);
  return buffer;
}

function noiseSource(ctx: AudioContext, at: number, dur: number): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  src.loop = true;
  // Arrancar siempre en el mismo punto haría que dos clicks seguidos suenen
  // idénticos, y el oído lo nota enseguida.
  src.start(at, Math.random() * 1.5, dur);
  src.stop(at + dur);
  return src;
}

/** Las rampas exponenciales no aceptan el cero. */
const SILENT = 0.0001;

function envelope(
  ctx: AudioContext,
  at: number,
  peak: number,
  attack: number,
  decay: number,
): GainNode {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(SILENT, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + attack);
  gain.gain.exponentialRampToValueAtTime(SILENT, at + attack + decay);
  return gain;
}

/**
 * El botón mecánico: un tic seco y agudo del plástico, y debajo el golpe grave
 * del mecanismo que se mueve. Dos cuerpos, no uno, porque un click que es sólo
 * transiente agudo suena a interfaz y no a algo con peso adentro.
 */
export function mechanicalClick(ctx: AudioContext, dest: AudioNode, at: number): void {
  const tick = noiseSource(ctx, at, 0.06);
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 2400;
  band.Q.value = 0.9;
  tick.connect(band).connect(envelope(ctx, at, LEVEL.clickTick, 0.002, 0.04)).connect(dest);

  const body = ctx.createOscillator();
  body.type = 'triangle';
  body.frequency.setValueAtTime(210, at);
  body.frequency.exponentialRampToValueAtTime(72, at + 0.08);
  body.connect(envelope(ctx, at, LEVEL.clickBody, 0.003, 0.085)).connect(dest);
  body.start(at);
  body.stop(at + 0.12);

  // El botón tocando fondo, un pelo después y más apagado.
  const bottom = noiseSource(ctx, at + 0.045, 0.04);
  const low = ctx.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.value = 1400;
  bottom.connect(low).connect(envelope(ctx, at + 0.045, LEVEL.clickTick * 0.4, 0.002, 0.028)).connect(dest);
}

/**
 * El motor tomando velocidad. El corte del filtro sube mientras arranca: a
 * plato parado el rumble es sordo y se abre a medida que gira.
 *
 * El corte no baja de 120Hz aunque un motor real retumbe más abajo. Filtrado a
 * 45Hz el ruido medía un pico de 0.016 y no lo reproduce ningún parlante de
 * laptop: sonaba a nada. El pico resonante es lo que lo vuelve un motor y no
 * aire filtrado.
 */
export function platterMotor(
  ctx: AudioContext,
  dest: AudioNode,
  at: number,
  dur: number,
): void {
  const src = noiseSource(ctx, at, dur);
  const low = ctx.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.setValueAtTime(120, at);
  low.frequency.linearRampToValueAtTime(340, at + 0.9);
  low.Q.value = 1.1;

  const hum = ctx.createBiquadFilter();
  hum.type = 'peaking';
  hum.frequency.value = 150;
  hum.Q.value = 3.5;
  hum.gain.value = 9;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(SILENT, at);
  gain.gain.linearRampToValueAtTime(LEVEL.motor, at + 0.35);
  gain.gain.setValueAtTime(LEVEL.motor, at + dur - 0.35);
  gain.gain.linearRampToValueAtTime(SILENT, at + dur);

  src.connect(low).connect(hum).connect(gain).connect(dest);
}

/** El brazo cruzando: el roce del mecanismo, apenas por encima del motor. */
export function armServo(ctx: AudioContext, dest: AudioNode, at: number, dur: number): void {
  const src = noiseSource(ctx, at, dur);
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.setValueAtTime(700, at);
  band.frequency.linearRampToValueAtTime(1100, at + dur);
  band.Q.value = 0.9;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(SILENT, at);
  gain.gain.linearRampToValueAtTime(LEVEL.servo, at + 0.14);
  gain.gain.setValueAtTime(LEVEL.servo, at + dur - 0.18);
  gain.gain.linearRampToValueAtTime(SILENT, at + dur);

  src.connect(band).connect(gain).connect(dest);
}

/**
 * La púa tocando el disco: el golpe grave del contacto y, encima, el raspón
 * corto y ancho de la aguja encontrando el surco.
 */
export function needleDrop(ctx: AudioContext, dest: AudioNode, at: number): void {
  const thud = ctx.createOscillator();
  thud.type = 'sine';
  thud.frequency.setValueAtTime(96, at);
  thud.frequency.exponentialRampToValueAtTime(42, at + 0.13);
  thud.connect(envelope(ctx, at, LEVEL.dropThud, 0.004, 0.14)).connect(dest);
  thud.start(at);
  thud.stop(at + 0.2);

  const scrape = noiseSource(ctx, at, 0.1);
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.setValueAtTime(2200, at);
  band.frequency.exponentialRampToValueAtTime(700, at + 0.09);
  band.Q.value = 0.7;
  scrape.connect(band).connect(envelope(ctx, at, LEVEL.dropTick, 0.003, 0.075)).connect(dest);
}
