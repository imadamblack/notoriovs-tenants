import type { Tab } from 'payload'

// Dashboard del cliente: acceso por contraseña, etapas del Kanban de leads y
// el corte de inactividad que marca un lead como estancado.

export const pipelineTab: Tab = {
  label: 'Dashboard Cliente',
  fields: [
    {
      name: 'dashboardPassword',
      type: 'text',
      label: 'Contraseña del dashboard',
      admin: {
        description:
          'Contraseña única y compartida que usa el cliente para entrar a su dashboard de leads (/tenant-site/{subdomain}/dashboard). Se captura a mano, igual que el Meta Pixel o el CAPI Token. Déjala vacía para desactivar el acceso al dashboard.',
      },
    },
    {
      name: 'leadPipeline',
      type: 'array',
      label: 'Pipeline (etapas del Kanban)',
      defaultValue: [
        { label: 'Nuevo' },
        { label: 'Contactado' },
        { label: 'Calificado' },
        { label: 'Ganado', isWon: true },
        { label: 'Perdido', isLost: true },
      ],
      admin: {
        description:
          'Etapas del Kanban de leads para este tenant, en el orden en que deben mostrarse las columnas. Cada lead guarda en Lead.stage el "id" interno (autogenerado por Payload) de la etapa en la que está, no el nombre, así que puedes renombrar una etapa o reordenarlas libremente sin romper nada. Ese id solo se pierde si BORRAS la etapa y creas una "igual" en su lugar: los leads que estaban ahí quedan huérfanos y caen en la columna "Otro" del Kanban hasta que se reasignan a mano.',
      },
      fields: [
        { name: 'label', type: 'text', required: true, label: 'Nombre de la etapa' },
        {
          type: 'row',
          fields: [
            {
              name: 'isWon',
              type: 'checkbox',
              defaultValue: false,
              label: 'Cuenta como "Ganado"',
              admin: {
                description: 'Se usa para calcular la tasa de conversión en el reporte de KPIs.',
                width: '50%',
              },
            },
            {
              name: 'isLost',
              type: 'checkbox',
              defaultValue: false,
              label: 'Cuenta como "Perdido"',
              admin: { width: '50%' },
            },
          ],
        },
      ],
    },
    {
      name: 'leadStuckAfterDays',
      type: 'number',
      label: 'Días sin actividad para marcar un lead como "Estancado"',
      defaultValue: 21,
      min: 1,
      admin: {
        description:
          'Un lead abierto (status "Abierto") que lleva sin actualizarse al menos esta cantidad de días aparece como "Estancado" en el filtro de status del dashboard, y es también el corte donde su tarjeta empieza a verse "vieja" (el badge de días y el degradado de color de la tarjeta en el Kanban). Vacío usa el default de 21 días. Los siguientes niveles de urgencia (más rojo) se calculan automáticamente como 2x y 4x este número, así que siempre quedan ordenados sin importar qué tan alto o bajo lo pongas aquí.',
      },
    },
  ],
}
