export function formatPhone(phone: string | number): string {
  const digits = String(phone).replace(/\D/g, '');

  return digits.replace(
    /^52(1)?(\d{3})(\d{3})(\d{4})$/,
    (_, one: string | undefined, area: string, prefix: string, line: string) =>
      `+52${one ? ' 1' : ''} ${area} ${prefix} ${line}`
  );
}