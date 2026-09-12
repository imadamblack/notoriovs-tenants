# 13: Crear un Lead desde la interfaz

**What to build:** Un Tenant User captura a mano un Lead que llegó por teléfono o
en persona, sin salir del dashboard.

**Blocked by:** None (can start immediately)

**Status:** IMPLEMENTADO en `dev` (2026-09-10).

- [x] El formulario exige nombre y al menos un medio de contacto, nada más
- [x] El Lead nace en la primera etapa del Pipeline del Tenant y con Status abierto, y la etapa se puede cambiar al capturarlo
- [x] Queda marcado como capturado manualmente, distinguible de los que llegaron por el quiz
- [x] Si ya existe un Lead con ese teléfono, se avisa y se ofrece abrirlo, pero no se bloquea la captura
- [x] El Lead nuevo aparece en el Kanban sin recargar

## Notas de implementación

- **`POST /api/tenant-dashboard/leads`**, junto al GET/PATCH/DELETE que ya
  vivían ahí. Mismo molde que el resto del dashboard: el Tenant sale del host
  (ADR 0002) y la escritura se scopea a mano con `overrideAccess: true`.
- **No pide permiso de rol.** Capturar un Lead es el trabajo diario tanto de un
  `owner` como de un `member`, igual que editarlo con el PATCH. Lo único que se
  exige es sesión válida en ese Tenant. No se agregó un `leads:create` al modelo
  de permisos porque no separaría a un rol del otro, y esa lista es corta a
  propósito.
- **Nace igual que los demás:** primera etapa del Pipeline (o el sentinel
  `'nuevo'` si el Tenant no tiene Pipeline, que lo deja en la columna "Otro"),
  `status: 'open'`, `source: 'manual'`. La etapa se puede elegir al capturarlo:
  un Lead que llega por teléfono a veces entra ya avanzado.
- **El duplicado avisa, no bloquea.** Sin `confirmDuplicate` el POST responde
  409 con el Lead que encontró; el panel lo muestra, ofrece "Abrir el que ya
  existe" y el botón pasa a "Guardar de todos modos", que reintenta con la
  confirmación. El mismo número puede ser de dos personas (una empresa, una
  familia) y perder un Lead por eso es peor que tener dos.
- **La tarjeta entra sin recargar** por el mismo `updateEvent` que ya reconcilia
  drag&drop y borrado, con una bandera `created` nueva: agrega el Lead a su
  columna y sube los contadores, en vez de reubicar uno que ya estaba.
- **No hace falta migración:** no hay campos nuevos. `source: 'manual'` ya
  existía en la colección desde antes que hubiera con qué escribirlo.

## Lo que se verificó

Contra la base de desarrollo y el dashboard real del tenant `ntrs`, con Leads y
un Tenant User de prueba creados y borrados al final:

- sin nombre, sin ningún contacto, y sin sesión: 400, 400 y 401;
- una etapa que no es de ese Tenant: 400;
- alta buena: primera etapa, `status: open`, `source: manual`;
- alta con etapa elegida: queda en esa etapa;
- teléfono repetido: 409 con el Lead existente; el mismo envío con
  `confirmDuplicate` lo captura igual;
- un número escrito en WhatsApp cruza contra el `phone` de otro Lead;
- en la interfaz: los dos mensajes de validación, el aviso de duplicado con
  "Abrir el que ya existe" (abre el panel de detalle), "Guardar de todos modos",
  y la tarjeta apareciendo arriba de su columna con los contadores subiendo
  (41→42 en la etapa, 53→54 en el total) sin recargar.

`npm run lint` sin errores y `npm test` en verde (70 pruebas). No se agregaron
pruebas automatizadas: esto no cae en ninguna de las tres áreas del CLAUDE.md.

## Lo que queda fuera

- **El duplicado compara el teléfono exacto** contra `phone` y `whatsapp`. Dos
  formatos del mismo número (`55 9988 7766` vs `5599887766`) no se reconocen:
  eso pediría guardar una versión normalizada aparte, y este aviso no vale un
  campo nuevo en la base.
- **La tarjeta nueva se inserta aunque haya filtros puestos** (un status, una
  búsqueda, un periodo). Verla aparecer donde uno acaba de crearla pesa más que
  la pureza del filtro, y recargar vuelve a cuadrar la vista.
- **Sin pipeline configurado no hay botón:** el Kanban de un Tenant sin etapas
  ya muestra en su lugar el aviso de "pídele a Notoriovs que agregue etapas", y
  el alta vive en la barra de ese Kanban.
