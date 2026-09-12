# 26: La entrada al quiz son 3 saltos, no 1

**What to build:** `/` no lleva a `/survey` de una:

```
/  →307→  /tenant-site/{sub}/survey  →308→  /survey  →200
```

El 307 sale de `page.tsx:177`, que redirige a la ruta interna absoluta; el 308 es
el middleware canonicalizando de vuelta a la ruta pública. El 307 se sirve
cacheado (`x-vercel-cache: HIT`), pero el **308 no**: el middleware corre en cada
visita. Medido: ~195 ms de sobrecosto en escritorio, y en móvil 4G los dos saltos
extra cuestan más porque cada uno paga su RTT.

**Blocked by:** 04 (línea base medida) — hecho

**Status:** ready-for-agent

**Evidencia:** `../mediciones/04-linea-base-web-vitals.md`, sección "Cadena de
entrada" y cuello de botella 3.

## La restricción que hace que esto no sea un parche

La ruta interna absoluta es **deliberada**. El comentario en `src/middleware.ts`
lo explica: le permite a la landing redirigir al quiz sin leer `host` con
`headers()`, que volvería la página dinámica y tiraría toda la caché que ganó el
issue 03. Redirigir directo a `/survey` a lo ingenuo revierte 03.

- [ ] La entrada llega al quiz en menos saltos, sin volver dinámica ninguna página
- [ ] `/` sigue sirviéndose desde caché (`x-vercel-cache: HIT`)
- [ ] El Live Preview del admin sigue funcionando (es el otro consumidor de
      `/tenant-site/...`, ver el guard del middleware)
- [ ] Un tenant CON landing sigue mostrándola en vez de saltar al quiz
- [ ] Remedición de la cadena contra los ~195 ms de la línea base de 04
