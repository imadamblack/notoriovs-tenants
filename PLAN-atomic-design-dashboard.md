# Plan: Atomic Design y aislamiento de estilos para src/components/dashboard

## 1. Diagnóstico: qué está duplicado hoy

Revisé los archivos de `src/components/dashboard/` (`DashboardApp.tsx`, `KanbanBoard.tsx`, `LeadDetailPanel.tsx`, `KpiReport.tsx`, `DashboardLogin.tsx`) más el estado "Dashboard no disponible" que hoy vive como JSX suelto dentro de `src/app/(frontend)/tenant-site/[subdomain]/dashboard/page.tsx`. Todos mezclan lógica de datos, estado y JSX con clases de Tailwind repetidas a mano. Esto es lo concreto que encontré:

### 1.1 Lógica duplicada línea por línea

- `daysIdle(lead)` existe idéntica en `KanbanBoard.tsx` (líneas 84-90) y `LeadDetailPanel.tsx` (líneas 48-54).
- El diccionario de estatus (ganado/perdido/descalificado, con sus clases de color) existe como `STATUS_BADGE` en `KanbanBoard.tsx` (23-27) y se vuelve a declarar, casi igual, dentro de `idleBadge()` en `LeadDetailPanel.tsx` (64-68). Además `LeadDetailPanel` tiene un tercer diccionario, `STATUS_LABELS` (16-21), con las mismas cuatro etiquetas pero sin las clases de color.
- `idleBadge()` (el badge de "días sin movimiento") tiene dos implementaciones distintas con la misma escala de umbrales (menos de 1 día, menos de 15, menos de 45): una en `KanbanBoard.tsx` (92-98) y otra con firma diferente en `LeadDetailPanel.tsx` (56-71).

### 1.2 El mismo patrón visual, repetido con clases distintas cada vez

- **Badges/pills**: el badge de estatus y el de "días sin movimiento" se pintan como `<span>` con `rounded-full px-2 py-0.5` en al menos 5 lugares distintos (tarjeta del Kanban, fila de la tabla de Lista, header del panel de detalle), cada uno con su propio string de clases armado a mano.
- **Tabs / segmented control**: hay **tres** implementaciones independientes con apariencia parecida (nav superior "Leads / Reportes" en `DashboardApp.tsx` 100-116, toggle "Tablero / Lista" en `KanbanBoard.tsx` 486-505, tabs "Notas / Detalles" en `LeadDetailPanel.tsx` 323-340). Confirmaste que estas tres son distintas a propósito (navegación de nivel superior, un switch de vista, y tabs de contenido dentro de un panel), así que el plan no las unifica en un solo componente genérico; cada una se extrae por separado, respetando su rol. Lo único que sí vale la pena arreglar de paso, sin cambiar el diseño: el toggle de `KanbanBoard` está hecho con `<div onClick>` en vez de `<button>`, lo que lo deja fuera del tab order del teclado.
- **Barra de progreso**: hay tres patrones de "barra que se va llenando" (pipeline por etapa en `LeadDetailPanel.tsx` 309-320, progreso de scroll horizontal del tablero en `KanbanBoard.tsx` 554-565, barra de porcentaje por etapa en `KpiReport.tsx` 84-86). Igual que con los tabs, son intencionalmente distintas (miden cosas distintas: avance en el pipeline, posición de scroll, y porcentaje de un total), así que se extraen como tres componentes independientes en vez de forzarlas a una sola API genérica.
- **Tabla de datos**: la vista de Lista en `KanbanBoard.tsx` (692-744) y la tabla de marketing en `KpiReport.tsx` (139-166) son dos `<table>` hechas a mano con `thead`/`tbody`, mismo propósito, encabezados con clases distintas (`uppercase tracking-wide` vs `border-b border-neutral-100`).
- **Avatar con iniciales**: `initials()` + `avatarColor()` (KanbanBoard 64-76) generan un círculo de iniciales que solo se usa ahí; es un buen candidato a átomo reutilizable si en el futuro se necesita en la Lista o en el panel de detalle.
- **Campos de formulario**: los 6 `<input>`/`<select>`/`<textarea>` del modo edición en `LeadDetailPanel.tsx` (396-455) comparten literalmente el mismo string de clases (`border border-neutral-300 px-3 py-2 min-h-[3rem] text-neutral-900`), copiado y pegado 6 veces.
- **Fila etiqueta/valor**: `ReadField` (LeadDetailPanel 73-119) ya es un intento de átomo, pero su `switch` tiene 4 ramas que devuelven exactamente el mismo JSX (Status, Etapa y el `default` son idénticos); y la sección de "respuestas del quiz" en modo edición (458-469) vuelve a pintar la misma fila etiqueta/valor con un `<div>` suelto en lugar de reusar `ReadField`.
- **Iconos**: `IconSearch`, `IconGrid`, `IconList`, `IconPlus` (KanbanBoard 123-158) son funciones sueltas dentro del archivo; `LeadDetailPanel` tiene otro ícono SVG inline (el de editar, 250-254) sin relación con los anteriores.
- **`Tile` de KPI** (KpiReport 43-51) es una tarjeta de estadística aislada dentro de ese archivo; el mismo tipo de "número grande + etiqueta" sería útil en otras partes del dashboard si se agregan métricas.

### 1.3 Login y "Dashboard no disponible" repiten el mismo problema

Al integrarlos al análisis encontré que `DashboardLogin.tsx` y el estado "Dashboard no disponible" (hoy JSX suelto en `dashboard/page.tsx`, líneas 20-30) son, en el fondo, la misma tarjeta centrada repetida dos veces: `min-h-screen flex items-center justify-center bg-brand-4 px-4` por fuera, `bg-white rounded-2xl shadow-sm p-8` por dentro. Es la misma duplicación de patrón visual que ya veníamos viendo, solo que a nivel de "pantalla completa" en vez de "tarjeta de lead". Confirmaste que ambas pantallas se van a migrar al tema oscuro del resto del dashboard, así que dejan de ser una excepción visual y entran de lleno al mismo sistema.

## 2. La causa raíz de los `!important`: no basta con extraer componentes

Esto es lo más importante que encontré y cambia el plan: la razón de fondo por la que `KanbanBoard`, `LeadDetailPanel` y `DashboardApp` están llenos de clases con `!` (`!bg-brand-3`, `!text-white`, `!border-none`, etc.) no es solo desorden, es que están peleando contra CSS global.

`src/app/(frontend)/layout.tsx` (el layout raíz de **todo** el sitio, marketing + encuesta + dashboard) importa una sola vez `src/styles/globals.scss`, que a su vez importa `type.scss`, `header.scss` y `form.scss`. Ahí hay reglas puestas directamente sobre las etiquetas nativas, pensadas para el sitio de marketing con tema claro:

- `button, .button { @apply ... bg-brand-1 text-white rounded-xl ...; }` en `globals.scss`: todo `<button>` del sitio nace verde oscuro con texto blanco, por eso cada botón del dashboard necesita `!bg-*` para imponer su propio color.
- `input, select, textarea { @apply flex border border-blue-200 px-6 py-4 ...; }` en `form.scss`: pensado para el formulario de la encuesta (fondo claro, borde azul claro). Esto explica el bug que noté antes (`text-neutral-900` sobre fondo oscuro en `LeadDetailPanel`): no es un error de copy-paste, es que el campo está heredando el estilo claro global y alguien intentó compensarlo a medias.
- `h1, h2, h3, h4, h5, h6, p { color: #1a1a1a; }` y `label { @extend .-ft-3; }` en `type.scss`: fuerzan texto oscuro por defecto en cualquier encabezado o párrafo.

Es decir: el dashboard hoy **no está aislado**, vive encima del sistema visual del sitio de marketing y cada componente pelea esa herencia caso por caso con `!important`. Extraer átomos sin resolver esto significaría construir `Button`/`Input`/`Select` nuevos que sigan necesitando `!important` para lo mismo de siempre.

### 2.1 Propuesta: un scope `.dashboard-root` con sus propios parciales SCSS

Siguiendo la convención que ya tiene el proyecto (`sass` ya está instalado, `src/styles/*.scss` ya existe como patrón), propongo:

```
src/styles/
  dashboard/
    _tokens.scss     // qué color de marca es "el" primario del dashboard, radios, etc.
    _reset.scss      // button, input/select/textarea, h1-h6, label, todo anidado bajo .dashboard-root
    dashboard.scss   // punto de entrada: reúne _tokens y _reset (no repite @tailwind, eso ya se compila una sola vez vía globals.scss)
```

Ejemplo ilustrativo de `_reset.scss` (no es código final, solo para mostrar el mecanismo):

```scss
.dashboard-root {
  button, .button {
    @apply bg-neutral-800 text-neutral-100 rounded-lg font-medium;
  }
  input, select, textarea {
    @apply bg-neutral-900 border border-neutral-700 text-neutral-100 rounded-lg px-3 py-2;
  }
  h1, h2, h3, h4, h5, h6, p, label {
    color: inherit;
  }
}
```

Una regla `.dashboard-root button {}` tiene más especificidad que la regla global `button {}`, así que gana sin necesitar `!important`, sin importar el orden en que se carguen los estilos. Los átomos `Button`/`Input`/`Select`/`Badge` que ya proponía en la sección 3 se apoyan en este reset como base y solo agregan las clases de variante (color, tamaño) encima, ya sin pelear con nada.

**Importante, para no salirte del alcance que definiste:** esto no toca `globals.scss`, `type.scss` ni `form.scss` (eso sí afectaría al resto del sitio). Solo se agregan archivos nuevos. Las clases utilitarias de tipografía (`.ft-0`...`.ft-11`, `.-ft-1`...`.-ft-4` de `type.scss`) son un sistema genérico de escala fluida, no específico de marketing, así que no hay razón para duplicarlas: el dashboard las sigue usando tal cual.

### 2.2 Dónde se conecta esto (los dos únicos archivos fuera de la carpeta)

Para que el scope `.dashboard-root` exista hacen falta dos cambios mínimos fuera de `src/components/dashboard/`, ambos de una sola línea de intención:

1. Un nuevo `src/app/(frontend)/tenant-site/[subdomain]/dashboard/layout.tsx` que importe `@/styles/dashboard/dashboard.scss` y envuelva `{children}` en `<div className="dashboard-root">`. Next.js ya soporta un `layout.tsx` por ruta sin tocar el layout raíz del sitio.
2. Un ajuste a `dashboard/page.tsx` para que el bloque de "Dashboard no disponible" (hoy JSX suelto) use el nuevo componente `DashboardUnavailable` (ver sección 3) en vez de la tarjeta clara escrita a mano ahí mismo.

Nada de `globals.scss` ni de otras rutas del sitio se modifica.

### 2.3 Un color primario, no tres

Ya que Login y "no disponible" se unifican al tema oscuro, conviene resolver de una vez la inconsistencia que había anotado: hoy `brand-1` (nav de `DashboardApp`, botón de Login), `brand-3` (drag&drop activo, WhatsApp CTA, foco de inputs) y `brand-5` (botón Guardar) se usan todos como "color primario de acción" sin un criterio explícito. Mi recomendación (es una propuesta, no una decisión tomada): usar **`brand-3`** como único color de acción primaria en todo el dashboard (botones primarios, foco de campos, estado activo), y dejar `brand-1` como el tono oscuro de superficie/nav, ya no como color de botón. Esto se resuelve en la definición del átomo `Button` (sección 3), sin tocar `tailwind.config.ts`.

## 3. Taxonomía propuesta

Atomic design divide todo en 4 capas. Voy de lo más simple a lo más compuesto, con el nombre de archivo sugerido y qué reemplaza.

### Átomos (sin lógica de negocio, reciben todo por props)

| Componente | Reemplaza | Props clave |
|---|---|---|
| `Badge.tsx` | `STATUS_BADGE`, `idleBadge()` (las dos versiones), badge de conteo por columna | `label`, `tone: 'success' \| 'danger' \| 'neutral' \| 'urgent-1' \| 'urgent-2' \| 'urgent-3'` |
| `Avatar.tsx` | `initials()` + `avatarColor()` | `name` |
| `Button.tsx` | los `<button>` con `!bg-brand-*` repetidos en los 4 archivos, y el botón de `DashboardLogin` | `variant: 'primary' \| 'secondary' \| 'ghost' \| 'danger'`, `size`. Ya no necesita `!important` gracias al reset de la sección 2 |
| `Input.tsx`, `Select.tsx`, `Textarea.tsx` | los campos de `LeadDetailPanel` con clase copiada 6 veces, y el input de contraseña de `DashboardLogin` | `label`, tema oscuro por defecto |
| `ProgressBar.tsx` | la barra de `KpiReport` (84-86) | `value` (0-100) |
| `SectionHeading.tsx` | los 4 `<h2 className="font-semibold text-brand-1 mb-3">` de `KpiReport` | `children` |
| `EmptyState.tsx` | "Sin leads", "Cargando…", "Error al cargar" repetidos en columnas y lista | `variant`, `message`, `onRetry?` |
| `icons/*.tsx` (o un solo `Icon.tsx` con prop `name`) | `IconSearch`, `IconGrid`, `IconList`, `IconPlus`, ícono de editar, la flecha `‹` | `name`, `size` |

### Moléculas (combinan átomos, siguen siendo genéricas)

| Componente | Reemplaza | Notas |
|---|---|---|
| `ViewToggle.tsx` | toggle "Tablero / Lista" de `KanbanBoard` (486-505) | Es su propio componente, no un `TabGroup` genérico; internamente usa `<button>` (no `<div onClick>`) para que sea accesible por teclado |
| `SectionTabs.tsx` | tabs "Notas / Detalles" de `LeadDetailPanel` (323-340) | Separado de `ViewToggle` a propósito: son conceptos distintos aunque se vean parecidos |
| `PipelineProgress.tsx` | segmentos del pipeline en `LeadDetailPanel` (309-320) | Específico de "avance en el pipeline de un lead"; no comparte componente con el scroll indicator |
| `BoardScrollIndicator.tsx` | segmentos de scroll horizontal en `KanbanBoard` (554-565, solo mobile) | Específico de "posición de scroll"; se queda separado de `PipelineProgress` |
| `SearchInput.tsx` | buscador de `KanbanBoard` (531-544) | `Input` + `IconSearch` |
| `StatTile.tsx` | `Tile` de `KpiReport` | Mover tal cual, ya está bien hecho |
| `KeyValueRow.tsx` | `ReadField` simplificado (quitando las ramas duplicadas) | `label`, `value`, `href?` (para los casos de WhatsApp/email) |
| `DataTable.tsx` | tabla de Lista (`KanbanBoard`) y tabla de marketing (`KpiReport`) | `columns`, `rows`, `onRowClick?` |
| `ContactLink.tsx` | enlaces de WhatsApp/email dentro de `ReadField` y el botón de WhatsApp del panel | `type: 'whatsapp' \| 'email'`, `value` |
| `CenteredScreenCard.tsx` | la tarjeta centrada compartida por `DashboardLogin` y "Dashboard no disponible" | `children`; layout de pantalla completa + tarjeta, ya en tema oscuro |

### Organismos (conocen el dominio "lead"/"kpi", componen moléculas)

| Componente | Viene de |
|---|---|
| `LeadCard.tsx` | tarjeta del Kanban (KanbanBoard 622-673) |
| `StageColumn.tsx` | columna completa del Kanban, incluida su cabecera y estados vacío/cargando/error |
| `LeadListTable.tsx` | instancia de `DataTable` con las columnas de leads |
| `LeadDetailHeader.tsx` | back button + título + badge + botón editar (LeadDetailPanel 236-270) |
| `LeadQuickEditRow.tsx` | selects de etapa/status + `PipelineProgress` en modo lectura (272-320) |
| `LeadNotesEditor.tsx` | textarea de notas + indicador de guardado (358-369) |
| `LeadAnswersList.tsx` | lista de respuestas del quiz (unifica las dos versiones, lectura y edición) |
| `LeadEditForm.tsx` | formulario completo del modo edición (396-455) |
| `DashboardNav.tsx` | header con tabs Leads/Reportes + botón Salir (DashboardApp 95-121) |
| `LoginForm.tsx` | formulario de contraseña de `DashboardLogin` (usando `CenteredScreenCard` + `Input` + `Button`) |
| `KpiSummarySection.tsx`, `KpiStageProgressSection.tsx`, `KpiTrendChart.tsx`, `KpiMarketingSection.tsx` | cada `<section>` de `KpiReport.tsx` |

### Plantillas (orquestadores; ya son 6, no 4)

- `KanbanBoard.tsx`: conserva el fetching/estado, arma `StageColumn` + `LeadListTable` según la vista.
- `LeadDetailPanel.tsx`: conserva el estado del formulario, arma `LeadDetailHeader` + `LeadQuickEditRow` + `LeadNotesEditor`/`LeadAnswersList`/`LeadEditForm`.
- `KpiReport.tsx`: arma las 4 secciones de KPI.
- `DashboardApp.tsx`: shell general, arma `DashboardNav` + la plantilla activa + `LeadDetailPanel`.
- `DashboardLogin.tsx`: arma `CenteredScreenCard` + `LoginForm`, ya en tema oscuro.
- `DashboardUnavailable.tsx` **(nuevo archivo)**: se extrae del JSX suelto en `dashboard/page.tsx`, arma `CenteredScreenCard` con el mensaje de "no disponible", también en tema oscuro.

## 4. Estructura de carpetas propuesta

```
src/styles/
  dashboard/
    _tokens.scss
    _reset.scss
    dashboard.scss

src/components/dashboard/
  ui/
    atoms/
      Badge.tsx
      Avatar.tsx
      Button.tsx
      Input.tsx
      Select.tsx
      Textarea.tsx
      ProgressBar.tsx
      SectionHeading.tsx
      EmptyState.tsx
      icons/
        IconSearch.tsx
        IconGrid.tsx
        IconList.tsx
        IconPlus.tsx
        IconEdit.tsx
        IconChevronLeft.tsx
    molecules/
      ViewToggle.tsx
      SectionTabs.tsx
      PipelineProgress.tsx
      BoardScrollIndicator.tsx
      SearchInput.tsx
      StatTile.tsx
      KeyValueRow.tsx
      DataTable.tsx
      ContactLink.tsx
      CenteredScreenCard.tsx
    organisms/
      LeadCard.tsx
      StageColumn.tsx
      LeadListTable.tsx
      LeadDetailHeader.tsx
      LeadQuickEditRow.tsx
      LeadNotesEditor.tsx
      LeadAnswersList.tsx
      LeadEditForm.tsx
      DashboardNav.tsx
      LoginForm.tsx
      kpi/
        KpiSummarySection.tsx
        KpiStageProgressSection.tsx
        KpiTrendChart.tsx
        KpiMarketingSection.tsx
  KanbanBoard.tsx        (plantilla)
  LeadDetailPanel.tsx    (plantilla)
  KpiReport.tsx          (plantilla)
  DashboardApp.tsx       (shell / página)
  DashboardLogin.tsx     (plantilla)
  DashboardUnavailable.tsx  (plantilla, nuevo)

src/app/(frontend)/tenant-site/[subdomain]/dashboard/
  layout.tsx  (nuevo: importa dashboard.scss, envuelve en .dashboard-root)
  page.tsx    (ajuste mínimo: usa DashboardUnavailable en vez del JSX suelto)
```

Nota sobre alcance: `src/styles/dashboard/` y el nuevo `layout.tsx` quedan fuera de `src/components/dashboard/`, pero son la pieza mínima indispensable para que el aislamiento funcione (sin un punto donde aplicar `.dashboard-root` y cargar el SCSS, no hay aislamiento real). Todo lo demás sigue viviendo dentro de la carpeta del dashboard, sin tocar el resto del sitio. Varios átomos (`Badge`, `Avatar`, `Button`, `Input`) no tienen nada específico de "dashboard" y son candidatos a subir después a un `src/components/ui/` compartido, pero eso queda como recomendación futura, no parte de este plan.

## 5. Orden de migración sugerido

La idea es no romper nada de un solo golpe y validar visualmente después de cada paso:

1. **Aislamiento de CSS primero** (`src/styles/dashboard/`, el `layout.tsx` con `.dashboard-root`). Se hace antes que los átomos a propósito: si `Button`/`Input` se construyen antes de tener el reset, se construyen otra vez con `!important` y luego hay que volver a tocarlos. Riesgo bajo si se valida que ninguna otra ruta usa ese layout.
2. **Átomos puros** (`Badge`, `Avatar`, `ProgressBar`, `Input`/`Select`/`Textarea`, `Button`, íconos, `EmptyState`), ya apoyados en el reset del paso 1. Extracciones directas, sin cambio de comportamiento esperado.
3. **Moléculas genéricas** (`SearchInput`, `DataTable`, `StatTile`, `KeyValueRow`, `ContactLink`, `CenteredScreenCard`). Los tabs y las barras de progreso (`ViewToggle`, `SectionTabs`, `PipelineProgress`, `BoardScrollIndicator`) no se agrupan aquí: cada uno se extrae junto con el organismo al que pertenece (pasos 4 y 5), ya que son intencionalmente distintos entre sí. Al extraer `ViewToggle` conviene pasarlo de `<div onClick>` a `<button>`, sin cambiar cómo se ve.
4. **`DashboardLogin` + `DashboardUnavailable`**: aquí sí hay un cambio visual real (pasan de tema claro a oscuro), a diferencia de todo lo demás que es refactor sin cambio de diseño. Conviene hacerlo temprano y por separado, ya con `CenteredScreenCard`/`LoginForm`/`Button`/`Input` disponibles, para validarlo con calma antes de meterse con los archivos grandes.
5. **Organismos de `KanbanBoard`** (`LeadCard`, `StageColumn`, `LeadListTable`, `ViewToggle`, `BoardScrollIndicator`): el archivo más grande y con más estado (paginación, scroll infinito, drag&drop); migrar solo la parte visual y dejar toda la lógica de fetching donde está.
6. **Organismos de `LeadDetailPanel`** (`LeadDetailHeader`, `LeadQuickEditRow`, `SectionTabs`, `PipelineProgress`, `LeadNotesEditor`, `LeadAnswersList`, `LeadEditForm`): aprovechar para unificar `LeadAnswersList` (hoy dos versiones, lectura y edición) en una sola implementación con un modo `readOnly`.
7. **Organismos de `KpiReport`**: el más sencillo de los archivos grandes, buen candidato para validar el patrón completo si se prefiere adelantarlo.
8. **`DashboardNav`** y ajuste final de `DashboardApp.tsx` como shell.

En cada paso, el archivo grande (plantilla) debería terminar más corto y quedarse solo con: estado, `fetch`, y el armado de organismos. Nada de clases de Tailwind sueltas para pintar un badge o un botón, y nada de `!important`.

## 6. Siguientes pasos

Este documento es el plan; no se tocó ningún archivo de código todavía. Cuando quieras avanzar a la implementación puedo:

- Empezar por el aislamiento de CSS (paso 1), que desbloquea que todo lo demás se construya limpio desde el inicio.
- O empezar por Login/Unavailable (paso 4) si prefieres ver primero el cambio visual más notorio (tema oscuro unificado).

Dime por cuál prefieres que empecemos y seguimos.
