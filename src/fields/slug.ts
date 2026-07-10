import type { Field } from 'payload'

type SlugFieldOptions = {
  name?: string
  source?: string
  unique?: boolean
  index?: boolean
  description?: string
  position?: 'sidebar' | undefined
}

export const formatSlug = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export const slugField = ({
  name = 'slug',
  source = 'name',
  unique = true,
  index = true,
  description,
  position = 'sidebar',
}: SlugFieldOptions = {}): Field => ({
  name,
  type: 'text',
  admin: {
    description: description ?? `Se genera automáticamente desde "${source}" si lo dejas vacío.`,
    position,
  },
  hooks: {
    beforeValidate: [
      ({ data, value }) => {
        if (typeof value === 'string' && value.trim()) {
          return formatSlug(value)
        }

        const sourceValue = data?.[source]

        if (typeof sourceValue === 'string') {
          return formatSlug(sourceValue)
        }

        return value
      },
    ],
  },
  required: true,
  unique,
  index,
})
