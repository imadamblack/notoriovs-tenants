import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: false,
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(_|ignore)',
        },
      ],
      // eslint-config-next 16 trae la regla nueva de react-hooks (v7,
      // pensada para React Compiler) como error. Marca como "prohibido"
      // cualquier setState síncrono dentro de un efecto, lo cual incluye
      // patrones estándar y correctos como "reset de loading antes de un
      // fetch" o "reconciliar un evento externo contra el estado local"
      // (ver DashboardApp/KanbanBoard). No hay bug real detrás de esos
      // casos, así que se baja a warning en vez de reescribir esos efectos
      // solo para complacer la regla.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    ignores: ['.next/', 'src/payload-types.ts', 'src/payload-generated-schema.ts'],
  },
]

export default eslintConfig
