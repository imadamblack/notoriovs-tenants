import type { Config } from 'tailwindcss'

// NOTA: el proyecto tiene "type": "module" en package.json, así que un
// tailwind.config.js con `module.exports` (CommonJS) rompería en runtime.
// Por eso los valores que compartiste están aquí en sintaxis ESM/TS, dentro
// del mismo tailwind.config.ts que ya está enganchado en postcss.config.mjs.
const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          1: '#10312c',
          2: '#ff4510',
          3: '#00A661',
          4: '#EDEAE4',
          5: '#37AC1A',
        },
      },
      container: {
        center: true,
        padding: '2rem',
      },
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1024px',
        '2xl': '1280px',
      },
      // Agregado para soportar la clase `text-paso` usada en
      // src/components/home-landing.js (no venía en tu config).
      fontSize: {
        paso: ['clamp(2.2rem, 4vw, 3.2rem)', { lineHeight: '1' }],
      },
    },
  },
  plugins: [],
}

export default config
