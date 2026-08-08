# deadwax

Un tocadiscos en la web. Sacás una funda de la estantería, el disco cae en el
plato, la púa baja. Todo lo que se ve es DOM y CSS: los surcos, el plato, el
brazo que entra hacia el centro, el polvo bajo la púa. No hay motor 3D ni video.

## Correrlo

Necesita **Node 20 o superior**.

```bash
npm install
npm run dev        # http://localhost:4321
```

| script | qué hace |
| --- | --- |
| `npm run dev` | servidor de desarrollo |
| `npm run build` | build de producción |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run seed` | regenera los discos de arranque |

## Los discos

La estantería inicial y los recomendados del buscador **no se piden en runtime**:
están precomputados en `src/data/`, incluido el color dominante de cada portada.
Para cambiarlos, editá las listas de IDs de iTunes en `scripts/build-seed.mjs` y
corré `npm run seed`. El script descarga la portada de 10×10 y saca el acento con
un decodificador PNG hecho a mano sobre `node:zlib`, para no depender de `sharp`.

## Por qué hay endpoints propios

La Search API de iTunes **no manda CORS** en el JSON, así que el navegador no
puede llamarla directo. `src/pages/api/` la envuelve. Las portadas y el audio sí
mandan `access-control-allow-origin`, y por eso se consumen directo desde el
cliente.

No hay API key ni cuenta: iTunes es público y sólo pide no abusar. Los endpoints
mandan `s-maxage` para que el CDN absorba el tráfico repetido.

## Deploy en Vercel

El proyecto usa `@astrojs/vercel`. Importá el repositorio y Vercel detecta Astro
solo; no hace falta tocar el build command.

**Variable de entorno, en Production y Preview:**

| variable | ejemplo | para qué |
| --- | --- | --- |
| `SITE_URL` | `https://deadwax.app` | canonical y `og:url` |

`SITE_URL` se lee **en el build**, no en runtime: si la cambiás, hay que volver a
deployar. Sin ella, el build toma el dominio de producción que expone Vercel, y
en local cae a `http://localhost:4321`. Si queda mal, los enlaces compartidos
previsualizan con el host equivocado.

### Qué corre en el servidor

Casi todo es estático. Sólo son funciones:

- `/` — porque un enlace compartido (`?record=` o `?shelf=`) tiene que llegar con
  su título y su portada ya en el HTML: los crawlers no ejecutan JS.
- `/api/search`, `/api/album/[id]`, `/api/albums` — el proxy a iTunes.

### Si algún día cambia la plataforma

Cambiar de destino es editar `astro.config.mjs` y una dependencia:

```bash
npm uninstall @astrojs/vercel && npm install @astrojs/netlify   # o @astrojs/node
```

Con `@astrojs/node` en modo `standalone` el servidor arranca con
`node ./dist/server/entry.mjs` y lee `HOST` y `PORT`. Ahí el caché en memoria de
`src/lib/cache.ts` sí sobrevive entre pedidos, cosa que en serverless no pasa.

## Lo que el usuario guarda

Nada sale del navegador y no hay cuentas. En `localStorage` viven los discos que
agregó, los que sacó de la estantería, el nombre de su estantería y el tema. Una
estantería compartida viaja entera en la URL, en base64url: el enlace **es** el
dato, no hay base de datos detrás.

## Límites conocidos

- **Los temas duran 30 segundos.** Son los previews oficiales que publica Apple.
  Un álbum completo necesita licencias que un experimento personal no tiene. La
  lista muestra la duración real de cada tema para que la diferencia se vea.
- iTunes puede responder **403** si le pegás muy seguido; los endpoints lo
  traducen a **429** y la interfaz lo cuenta como "probá de nuevo".
