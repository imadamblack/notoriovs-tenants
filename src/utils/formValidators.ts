// NOTA: archivo generado (no incluido en los archivos compartidos).

import type { KeyboardEvent } from 'react';

export const emailRegExp = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
