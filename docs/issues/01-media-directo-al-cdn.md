# 01: Media servido directo desde el CDN

**What to build:** Las imágenes de las landings y los quizzes se sirven directo
desde el almacenamiento público en vez de pasar por una función serverless que
las descarga y reenvía en cada visita. Es el cambio más barato de toda la Fase 1
y el que más pesa en tráfico pagado móvil.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Las URLs de media apuntan al blob público, no a una ruta servida por la app
- [x] La optimización de imágenes de Next sigue funcionando con esas URLs remotas
- [x] Logo, hero y las imágenes de los bloques cargan correctamente en las
      landings de los Tenants existentes (bloques: no renderizan imágenes hoy)
- [x] El panel de Payload sigue mostrando y subiendo media sin errores (el
      preview desactualizado al editar es un bug previo, ver punto 4)
- [x] Ninguna petición de imagen pasa ya por la ruta de media de la app
      (`/api/media/file/...`). Criterio reescrito: ver decisión 1.

## Notas de verificación

- `disablePayloadAccessControl: true` hace que la `url` de cada media se genere
  contra el blob. Payload la recalcula en cada lectura (hook `afterRead`), así
  que **no hizo falta migrar** los documentos existentes.
- Los 5 media de la base responden 200 desde el blob, incluidos los nombres con
  espacios y acentos. Los logos de `avril-ramos`, `rosessa-muebles` y `pgc`
  resuelven al blob.
- El optimizador de Next acepta el host del blob (200) y rechaza un host ajeno
  (400), así que `remotePatterns` está realmente en vigor.

## Puntos cerrados

1. **DECIDIDO — se conserva `/_next/image`.** Los criterios 2 y 5 originales se
   contradecían: mantener la optimización de Next *implica* que la petición pase
   por la app. Se optó por conservarla (resize/WebP, cacheada en el edge de
   Vercel) y eliminar lo caro: la invocación serverless de Payload que descargaba
   del blob y lo reenviaba en cada visita. El criterio 5 queda reescrito como
   "ninguna petición pasa por la ruta de media de la app".

2. **Los bloques de la landing no renderizan imágenes hoy.** `LandingBlock` en
   `src/app/(frontend)/tenant-site/[subdomain]/page.tsx` no pinta ninguna imagen,
   aunque los bloques tengan campo `image`. El criterio 3 se verificó sobre logo
   y hero (en el quiz y en el `og:image`); de bloques no había nada que verificar.

3. **Subida desde `/admin`: verificada a mano, sin problemas.**

4. **Preview desactualizado al editar: bug PREVIO, no lo introduce este cambio.**
   Reproducido con las dos configuraciones. La respuesta del `PATCH` es
   inconsistente consigo misma en ambas — devuelve el `filename` nuevo junto a
   una `url` construida con el nombre anterior:

   | | `filename` | `url` |
   |---|---|---|
   | antes (`main`) | `…myUu1Gv-H3ajE2Kw…png` | `/api/media/file/…myUu1Gv.png` |
   | después | `…dDJMfUb-h73xeHRV…png` | `…blob…/…dDJMfUb.png` |

   Causa: el hook `beforeChange` del campo `url` calcula la URL *antes* de que la
   subida asigne el nombre con sufijo; el `afterChange` del plugin mezcla el
   `filename` nuevo en la respuesta pero no regenera la `url`. Recargar lo arregla
   porque la lectura sí la regenera (hook `afterRead`).

   Lo único que cambia es el **síntoma**: esa URL vieja apunta a un archivo que se
   borra, así que según si el CDN aún lo tiene cacheado se ve la imagen vieja (200)
   o un icono roto (404). Verificado: un blob viejo daba 404 y otro, borrado
   minutos después, seguía dando 200.

5. **CORRECCIÓN — el `del()` de `Media.afterChange` sí se ejecuta, pero es
   redundante.** Instrumentado: el hook corre **dos veces** por guardado. En la
   primera `previousDoc.url === doc.url` (por la `url` desactualizada de arriba) y
   sale sin hacer nada; en la segunda —el `update` interno que el plugin hace para
   persistir el nombre nuevo— las URLs difieren y **sí borra**. Como el plugin ya
   borra los archivos anteriores por su cuenta (`adapter.handleDelete`, en su
   propio `afterChange`), nuestro hook está duplicando ese trabajo. No hace daño;
   es candidato a eliminarse.

6. **`/api/media/file/<archivo>` ahora responde 500.** Sí lo introduce este
   cambio: al pasar `disablePayloadAccessControl` el plugin deja de registrar su
   `staticHandler` y esa ruta se queda sin quien la atienda. Nada del sistema
   apunta ya ahí, pero una URL vieja cacheada afuera (p. ej. un `og:image` en
   Facebook) recibe un 500 en vez de un 404.

## Derivados

- Issue **22** — el nombre de archivo de un media se acumula en cada edición.
