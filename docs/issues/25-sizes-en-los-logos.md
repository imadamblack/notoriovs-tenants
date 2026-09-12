# 25: `sizes` en los `<Image fill>` de logo

**What to build:** Los `<Image fill>` del tenant-site no llevan `sizes`. Con
`fill` y sin `sizes`, Next asume `100vw` y pide la variante de 1920 px. En
avril-ramos el logo pesa **179 KB** para renderizarse en una caja de 160×64 —
casi lo mismo que el hero (195 KB). En `/survey` además se pinta con
`filter: brightness(0) invert(1)`: 179 KB de PNG a color para dibujar una
silueta blanca sólida.

**Blocked by:** 04 (línea base medida) — hecho

**Status:** hecho en `fix/sizes-en-logos-del-tenant`, sin desplegar

**Evidencia:** `../mediciones/04-linea-base-web-vitals.md`, cuello de botella 2.

Los tres logos (el hero de `survey-form.tsx:157` NO entra: ahí `w=1920` es
correcto porque sí ocupa la pantalla):

- `src/app/(frontend)/tenant-site/[subdomain]/survey/survey-form.tsx:172` — caja `w-40 h-16`
- `src/app/(frontend)/tenant-site/[subdomain]/thankyou/page.tsx:42`
- `src/app/(frontend)/tenant-site/[subdomain]/not-elegible/page.tsx:45`

- [x] `sizes` en los tres, acorde a la caja real en la que se renderizan
- [x] El hero se deja como está, y queda dicho por qué
- [ ] Verificado en el deploy que `/_next/image` ya no pide `w=1920` (pendiente:
      requiere el cambio desplegado)
- [ ] Remedición del peso de imagen de `/survey` contra la tabla de 04
- [ ] Los logos se siguen viendo bien en móvil y en pantalla densa (2x)

## Ahorro medido

`sizes="160px"` en los tres (caja `w-40 h-16` = 160x64 en los tres archivos).
El hero de `survey-form.tsx:157` se deja sin `sizes` a propósito: ocupa la
pantalla completa y ahi `w=1920` es la variante correcta.

Pedidas a produccion las variantes que el cambio va a solicitar, mismo logo,
`Accept: image/webp`:

| variante | peso |
|---|---|
| `w=1920` (hoy) | 178 KB |
| `w=384` (pantalla 2x) | 32 KB |
| `w=256` (pantalla 1x) | 20 KB |

Los 178 KB coinciden con lo que midio Lighthouse en la linea base de 04, asi que
la comparacion es directa: **146-158 KB menos por pagina**, ~5.5x.

Lint limpio en los tres archivos. El warning de `react-hooks/exhaustive-deps` en
`survey-form.tsx:74` es previo y no lo toca este cambio.

Falta: desplegar y remedir contra la tabla de 04.
