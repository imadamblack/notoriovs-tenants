// NOTA: archivo generado (no incluido en los archivos compartidos).

import type { KeyboardEvent } from 'react';

export const emailRegExp = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Validación de teléfono a 10 dígitos exactos. Se define aquí (Client
// Component / util del lado del cliente) y no en el mapeo que corre en
// Server Components (tenantQuiz.ts), porque un RegExp no es serializable al
// pasar props de un Server Component a un Client Component en Next.js.
export const phonePattern = {
  value: /^\d{10}$/,
  message: 'El teléfono debe tener 10 dígitos',
};

// Bloquea cualquier tecla que no sea un dígito (permite navegación y borrado).
export function restrictNumber(event: KeyboardEvent<HTMLInputElement>) {
  const allowedKeys = [
    'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End',
  ];

  if (allowedKeys.includes(event.key)) return;
  if (event.ctrlKey || event.metaKey) return;
  if (!/^[0-9]$/.test(event.key)) {
    event.preventDefault();
  }
}
