# 37: Las conversiones de Google Ads van a una cuenta global, no a la del tenant

**Ola:** sin ola — sirve al Tenant, no al Lead

**What to build:** la conversión de Google Ads que dispara el quiz al enviarse no
depende del tenant. Sale a una cuenta fija de build time:

```js
// src/services/fbEvents.ts:83
send_to: `${process.env.NEXT_PUBLIC_GOOGLE_ADS_ID}/${conversionId}`
```

y se llama desde `survey-form.tsx:132` con la etiqueta **vacía**
(`gtagSendEvent('', …)`). O sea, hoy no cruza nada: `NEXT_PUBLIC_GOOGLE_ADS_ID`
está comentada en `.env.example` y vacía en producción, así que la llamada se
va a `undefined/` y no reporta a ningún lado. **Está sin funcionar, no
cruzada.** El día que alguien llene esa variable para atender a un cliente con
campañas en Google, los nueve tenants empiezan a reportar sus conversiones en
esa misma cuenta.

Es la contraparte de lo que Meta ya hace bien: el Pixel y el token de la
Conversions API salen del Tenant (`tracking.metaPixelId`,
`tracking.metaCapiToken`), y `googleTagId` también — la etiqueta general de
gtag sí es del cliente. Lo único que quedó global es la **cuenta de Ads**, que
es distinta de la etiqueta de gtag y hoy no tiene dónde vivir en el CMS.

**Status:** no empezado — decisión consciente de no tocarlo mientras nadie
corra campañas en Google (2026-09-14). Casi el 100% del tráfico de los tenants
viene de Meta Ads.

**Evidencia:** `src/services/fbEvents.ts:67-88`,
`src/app/(frontend)/tenant-site/[subdomain]/survey/survey-form.tsx:132`,
`.env.example:46`.

## Lo que se decidió si esto se construye

Salió de una sesión de diseño; estas respuestas ya están dadas y no hay que
volver a discutirlas:

- **Dos campos nuevos** en Tenants → Webhooks → Tracking: `Cuenta de Google Ads`
  (`AW-…`) y `Etiqueta de conversión de Lead`. No un arreglo de etiquetas: se
  consideró y se descartó, porque cada renglón necesitaría además decir *cuándo*
  se dispara, y un texto libre que debe coincidir con el nombre de un paso del
  quiz falla en silencio cuando alguien lo escribe mal. Un solo evento, `Lead`,
  el del envío del quiz.
- **`gtagSendEvent` recibe cuenta y etiqueta como argumento**, y deja de leer
  `process.env`. La variable `NEXT_PUBLIC_GOOGLE_ADS_ID` se elimina, junto con
  su renglón en `.env.example`.
- **Los campos viajan en la proyección `chrome`** (`src/utils/getTenant.ts`):
  no son secretos —la cuenta de Ads y la etiqueta son públicas por diseño, van
  en el HTML— a diferencia de `metaCapiToken`, que sigue siendo exclusivo de la
  proyección `conversionsApi`.
- **Si el tenant no tiene los dos campos, no se dispara nada.** Misma regla que
  ya sigue `TrackingAnalytics`: sin configuración explícita del cliente, no se
  renderiza ni se manda nada. Nunca un fallback global — es justo lo que este
  issue viene a quitar.

- [ ] Un tenant con cuenta y etiqueta configuradas reporta su conversión en SU
      cuenta de Google Ads
- [ ] Un tenant sin configurar no dispara ninguna conversión (no cae en una
      cuenta ajena ni manda `undefined`)
- [ ] `NEXT_PUBLIC_GOOGLE_ADS_ID` ya no existe en el código ni en `.env.example`
- [ ] La migración agrega las dos columnas sin tocar los valores de `tracking`
      que ya tienen los 9 tenants
- [ ] `googleTagId` sigue funcionando como hasta ahora: es la etiqueta general
      de gtag, no la cuenta de Ads, y son dos cosas distintas en el formulario

## Contexto de dónde salió esto

Se encontró revisando si los eventos de Meta y Google se cruzaban entre
tenants. **Los de Meta no se cruzan** (nueve Pixels distintos verificados en
producción, caché con el subdominio en la llave, Conversions API por tenant), y
el descuadre de 37x que motivó la revisión resultó ser detección automática de
eventos del Pixel de Meta —eventos `Lead` que Meta inventó leyendo el texto de
los botones del quiz—, no un problema del código. Esto de Google fue el único
hallazgo de código de aquella revisión.
