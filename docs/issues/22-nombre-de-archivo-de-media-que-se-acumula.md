# 22: El nombre de archivo de un media se acumula en cada edición

**Ola:** 1 (lanzamiento)

**What to build:** Cada vez que se recorta o se cambia el focal point de una
imagen, el nombre del archivo en Vercel Blob gana **otro** sufijo aleatorio
encima del que ya traía, en vez de reemplazarlo. El nombre crece sin techo hasta
toparse con el límite de longitud de pathname del store.

**Blocked by:** None (can start immediately)

**Status:** Hecho en la rama, falta verlo en producción con Vercel Blob real.
Localmente no hay `BLOB_READ_WRITE_TOKEN` (los uploads van a disco), así que no
se puede reproducir el sufijo real de Vercel; se verificó el mecanismo con un
script que simula el nombre acumulado directo en la base y dispara un cambio de
focal point por la Local API — confirma que `beforeOperation` repone la base
antes de que Payload arme el nuevo archivo. Falta migrar producción
(`original_filename` es columna nueva) y confirmar con una imagen real que el
nombre ya no crece.

- [x] Editar la misma imagen N veces deja el nombre con longitud estable, no
      creciente — verificado localmente simulando el nombre acumulado; falta
      confirmar contra Vercel Blob real
- [x] Cada edición sigue produciendo una URL distinta (la inmutabilidad es lo que
      permite el caché agresivo del CDN; ver issue 01) — no se tocó
      `addRandomSuffix`
- [x] El archivo anterior se sigue borrando, sin huérfanos — el hook `afterChange`
      que lo hace no cambió
- [x] Los media ya existentes con nombres acumulados siguen resolviendo — `url`
      no se toca, solo `filename`/`originalFilename`

## Evidencia

Observado en el archivo demo `id=39` durante la verificación del issue 01. Base
más **nueve** sufijos encadenados tras unas pocas ediciones:

```
Screenshot 2026-09-07 at 9.57.53
  -JsGEAS8YltkSfzKzA9umDjIUavM3Jl
  -JjlJU6D75qa7k62D4nSBHvM9mgEeE0
  -hgdK1XJE6QHb4dNTXg4m5wA8hf6UNF
  -ee1TrPoA24jNdrHdmh2gerbdDJMfUb
  -h73xeHRVOS0lWr8bfOyMlf7myUu1Gv
  -H3ajE2Kw6uPGFsrSR0ZhBdUl8nYq2m
  -4Asdnc00BUNUpFy641whDbOAoCc2lm
  -lr3S6.png
```

**Señal de que ya está cerca del límite:** el último sufijo (`-lr3S6`) salió
mucho más corto que los anteriores, lo que apunta a que Vercel empezó a truncar
porque el pathname se acerca a su tope.

Reproducido también con la configuración anterior al issue 01, así que **no lo
introdujo aquel cambio**.

## Causa

`@payloadcms/storage-vercel-blob/dist/uploadFile.js` sube con
`put(fileKey, ...)` donde `fileKey` sale de `data.filename`, y después hace
`data.filename = result.filename` (el nombre ya sufijado). En la siguiente
edición ese nombre sufijado es la **base** de la subida, y Vercel le agrega otro
sufijo encima:

```
logo.png → logo-AAA.png → logo-AAA-BBB.png → logo-AAA-BBB-CCC.png …
```

## Opción descartada: sobrescribir en el mismo pathname

Se evaluó `addRandomSuffix: false` + sobrescritura en sitio. Se descarta por dos
razones:

1. **No es posible hoy.** `@vercel/blob` expone `allowOverwrite`, pero el plugin
   de Payload nunca lo pasa a `put()` (solo `access`, `addRandomSuffix`,
   `cacheControlMaxAge`, `contentType`, `token`). Sin él, escribir sobre un
   pathname existente lanza error, así que la segunda edición rompería la subida.
2. **Sería mal negocio.** El plugin sube con `cacheControlMaxAge` de un año. Una
   URL estable con caché de un año significa que cambiar el logo de un Tenant
   puede seguir sirviendo el viejo desde el CDN y desde los navegadores por mucho
   tiempo — en landings con pauta corriendo eso es más caro que el problema que
   resuelve. Bajar el `cacheControlMaxAge` desharía justo lo que ganó el issue 01.

## Dirección propuesta

Conservar el sufijo aleatorio (es lo que hace la URL inmutable y permite cachear
fuerte) y hacer que la **base** del nombre vuelva siempre al original antes de
cada re-subida.

Ojo: los sufijos tienen longitud variable —y Vercel los trunca cerca del
límite—, así que recortarlos con un regex es frágil. La vía sólida es guardar el
nombre original y reponerlo, no intentar deducirlo del nombre acumulado.
