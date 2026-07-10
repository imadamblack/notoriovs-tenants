import type { SurveyStep, SurveyOptInField } from '@/components/stepRenderer'

// Tipos locales que reflejan la forma de `quizSteps` en src/collections/Tenants.ts.
// No se generan con `payload generate:types` en este entorno (falta conexión a DB
// para el build de esbuild nativo), así que se mantienen a mano y deben evolucionar
// junto con el campo `quizSteps` de la colección.
export type TenantQuizOption = {
  label: string
  value: string
}

// Campos fijos del paso "opt-in": nombre y teléfono (obligatorios) y email
// (siempre opcional). Ver campo `optInFields` (type: 'group') en Tenants.ts.
export type TenantQuizOptInFields = {
  nombreTitle?: string | null
  nombreRequiredMessage?: string | null
  telefonoTitle?: string | null
  telefonoRequiredMessage?: string | null
  emailTitle?: string | null
}

export type TenantQuizStep = {
  type: SurveyStep['type']
  name: string
  title?: string | null
  description?: string | null
  placeholder?: string | null
  requiredMessage?: string | null
  cols?: number | null
  options?: TenantQuizOption[] | null
  optInFields?: TenantQuizOptInFields | null
  autoAdvance?: boolean | null
  // Contenido para pasos tipo "checkpoint", editado con el WYSIWYG
  // (`checkpointContent`, richText) y convertido a HTML por Payload.
  checkpointContentHTML?: string | null
}

export type TenantQuizCheckpointRenderer = (step: TenantQuizStep) => React.ReactNode

/**
 * Registro de renderers para pasos tipo "checkpoint". El CMS no puede
 * serializar una función `render()`, así que un checkpoint autorado en
 * Payload se resuelve por `name` contra este registro en el código del
 * frontend del tenant. Si no hay match, no se renderiza nada (el paso
 * solo sirve para disparar tracking, igual que en formSteps hardcodeado).
 */
export type CheckpointRegistry = Record<string, TenantQuizCheckpointRenderer>

/**
 * Convierte los pasos del quiz configurados en Payload (colección Tenants,
 * tab "Quiz") al shape `SurveyStep[]` que consumen StepRenderer/formAtoms
 * en /src/app/(frontend)/survey. Debe mantenerse en sync 1:1 con el union
 * type `SurveyStep['type']` definido en src/components/stepRenderer.tsx.
 */
export function mapTenantQuizToSurveySteps(
  steps: TenantQuizStep[] | null | undefined,
  checkpointRegistry: CheckpointRegistry = {},
): SurveyStep[] {
  if (!steps?.length) return []

  return steps.map((step): SurveyStep => {
    const inputOptions = step.requiredMessage
      ? { required: step.requiredMessage }
      : undefined

    const optInFields: SurveyOptInField[] | undefined = step.optInFields
      ? [
          {
            name: 'nombre',
            type: 'text',
            title: step.optInFields.nombreTitle || undefined,
            inputOptions: step.optInFields.nombreRequiredMessage
              ? { required: step.optInFields.nombreRequiredMessage }
              : undefined,
          },
          {
            name: 'telefono',
            type: 'tel',
            title: step.optInFields.telefonoTitle || undefined,
            inputOptions: step.optInFields.telefonoRequiredMessage
              ? { required: step.optInFields.telefonoRequiredMessage }
              : undefined,
          },
          {
            name: 'email',
            type: 'email',
            title: step.optInFields.emailTitle || undefined,
            // El email siempre es opcional.
          },
        ]
      : undefined

    const checkpointHtml = step.type === 'checkpoint' ? step.checkpointContentHTML || undefined : undefined

    return {
      type: step.type,
      name: step.name,
      title: step.title || undefined,
      description: step.description || undefined,
      placeholder: step.placeholder || undefined,
      inputOptions,
      options: step.options?.map((opt) => ({ label: opt.label, value: opt.value })),
      cols: step.cols || undefined,
      fields: optInFields,
      autoAdvance: step.autoAdvance || undefined,
      html: checkpointHtml,
      render:
        step.type === 'checkpoint' && checkpointRegistry[step.name]
          ? () => checkpointRegistry[step.name](step)
          : undefined,
    }
  })
}
