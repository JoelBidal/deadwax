/**
  * Resuelve los collectionId de src/data/records.ts contra iTunes y escribe src/data/records.ts con
 * portada y accent ya calculados, para que la galería pinte sin trabajo en runtime.
 *
 *   node scripts/build-seed.mjs
 *
 * El accent sale de la miniatura de 10x10 que sirve el CDN de Apple. La pedimos
 * en PNG para poder decodificarla con node:zlib y no depender de un decoder JPEG.
 */
import { inflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dominantColor } from '../src/lib/color.ts';

// 9 discos de arranque. El usuario puede sacar cualquiera y agregar los que quiera.
const IDS = [
  '1443160553', // Kanye West: My Beautiful Dark Twisted Fantasy
  '800092985', // The Smiths: The Queen Is Dead
  '1408996052', // Mac Miller: Swimming
  '663097964', // Arctic Monkeys: AM
  '1793702595', // The Weeknd: Hurry Up Tomorrow
  '1853635930', // Tems: Love Is A Kingdom
  '1526194184', // The Killers: Hot Fuss
  '1146195596', // Frank Ocean: Blonde
  '1810267152', // Parcels: LOVED
];

// Sugerencias del panel de agregar: discos afines que no están en la estantería.
// Ocho y no diez: entran en dos filas parejas de cuatro.
const RECOMMENDED_IDS = [
  '1065973699', // Pink Floyd: The Dark Side of the Moon
  '594061854', // Fleetwood Mac: Rumours
  '266376953', // The Strokes: Is This It
  '1406109769', // Drake: Scorpion
  '1589272584', // Interpol: Turn On the Bright Lights
  '1442966257', // Kanye West: The Life of Pablo
  '1440851613', // The Velvet Underground & Nico
  '300948043', // Talking Heads: Remain In Light
];

const EDITION =
  /\((?:[^)]*\b(?:deluxe|anniversary|remaster(?:ed)?|master(?:ed)?|expanded|collector'?s|bonus|legacy|special|edition|version|mono|stereo)\b[^)]*)\)|\[[^\]]*\b(?:deluxe|remaster(?:ed)?|master(?:ed)?|edition)\b[^\]]*\]/gi;

const cleanTitle = (n) =>
  n.replace(EDITION, '').replace(/\s{2,}/g, ' ').trim().replace(/[-–—:,]\s*$/, '').trim() || n;

const artworkAt = (url, size) => url.replace(/\/\d+x\d+bb\.(jpg|png)$/i, `/${size}x${size}bb.$1`);

// --- PNG mínimo: 8 bits, sin entrelazar, gris/RGB/RGBA -----------------------

function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('no es PNG');
  let pos = 8;
  let width = 0, height = 0, depth = 0, colorType = 0;
  const idat = [];

  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8];
      colorType = data[9];
      if (data[12] !== 0) throw new Error('PNG entrelazado no soportado');
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (depth !== 8) throw new Error(`profundidad ${depth} no soportada`);

  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`colorType ${colorType} no soportado`);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? out[y * stride + x - channels] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= channels && y > 0 ? out[(y - 1) * stride + x - channels] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[y * stride + x] = v & 0xff;
    }
  }
  return { width, height, channels, data: out };
}

// --- Fetch -------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchAlbum(id) {
  const res = await fetch(
    `https://itunes.apple.com/lookup?id=${id}&entity=song&country=US`,
    { headers: { Accept: 'application/json' } },
  );
  if (!res.ok) throw new Error(`lookup ${id} → ${res.status}`);
  const { results = [] } = await res.json();
  const album = results.find((r) => r.wrapperType === 'collection');
  if (!album) throw new Error(`lookup ${id} sin collection`);
  const tracks = results.filter((r) => r.wrapperType === 'track' && r.previewUrl);
  return { album, trackCount: tracks.length };
}

async function accentFor(artworkUrl100) {
  const res = await fetch(artworkAt(artworkUrl100, 10).replace(/\.jpg$/i, '.png'));
  if (!res.ok) throw new Error(`artwork → ${res.status}`);
  const img = decodePng(Buffer.from(await res.arrayBuffer()));
  return dominantColor(img.data, img.channels, img.width * img.height);
}

async function resolve(ids, label) {
  const out = [];
  const problems = [];
  for (const id of ids) {
    try {
      const { album, trackCount } = await fetchAlbum(id);
      const accent = await accentFor(album.artworkUrl100);
      const year = Number(album.releaseDate?.slice(0, 4));
      out.push({
        id: String(album.collectionId),
        title: cleanTitle(album.collectionName),
        artist: album.artistName,
        year: Number.isFinite(year) ? year : null,
        coverUrl: artworkAt(album.artworkUrl100, 600),
        accent,
      });
      const flag = trackCount === 0 ? '  \u2190 SIN PREVIEWS' : '';
      console.log(
        `${accent}  ${String(id).padStart(11)}  ${album.artistName} \u2014 ${cleanTitle(album.collectionName)} (${year})  ${trackCount} tracks${flag}`,
      );
      if (trackCount === 0) problems.push(`${id} sin previews`);
    } catch (err) {
      problems.push(`${id}: ${err.message}`);
      console.error(`FALL\u00d3 ${id}: ${err.message}`);
    }
    await sleep(400);
  }
  console.log(`${out.length}/${ids.length} \u2192 ${label}\n`);
  return { out, problems };
}

function serialize(records) {
  return records
    .map(
      (r) =>
        `  {\n` +
        `    id: '${r.id}',\n` +
        `    title: ${JSON.stringify(r.title)},\n` +
        `    artist: ${JSON.stringify(r.artist)},\n` +
        `    year: ${r.year},\n` +
        `    coverUrl: '${r.coverUrl}',\n` +
        `    accent: '${r.accent}',\n` +
        `  },`,
    )
    .join('\n');
}

const HEADER = "// Generado por scripts/build-seed.mjs \u2014 no editar a mano.\n";

console.log('Estanter\u00eda:');
const seed = await resolve(IDS, 'src/data/records.ts');
console.log('Recomendados:');
const rec = await resolve(RECOMMENDED_IDS, 'src/data/recommended.ts');

const dir = fileURLToPath(new URL('../src/data/', import.meta.url));
await mkdir(dir, { recursive: true });
await writeFile(
  dir + 'records.ts',
  `import type { Seed } from '../lib/types';\n\n${HEADER}export const SEED: Seed[] = [\n${serialize(seed.out)}\n];\n`,
  'utf8',
);
await writeFile(
  dir + 'recommended.ts',
  `import type { Seed } from '../lib/types';\n\n${HEADER}export const RECOMMENDED: Seed[] = [\n${serialize(rec.out)}\n];\n`,
  'utf8',
);

const problems = [...seed.problems, ...rec.problems];
if (problems.length) {
  console.error('Problemas:\n  ' + problems.join('\n  '));
  process.exitCode = 1;
}
