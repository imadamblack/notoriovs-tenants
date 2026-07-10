// NOTA: archivo generado (no incluido en los archivos compartidos). Dispara
// `callback(value)` una sola vez por cada porcentaje de scroll alcanzado.

type ScrollDepthOptions = {
  values?: number[];
  callback?: (value: number) => void;
};

export default function scrollDepth({ values = [25, 50, 75, 100], callback = () => {} }: ScrollDepthOptions = {}) {
  if (typeof window === 'undefined') return () => {};

  const fired = new Set<number>();

  const handleScroll = () => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (docHeight <= 0) return;

    const percent = Math.round((scrollTop / docHeight) * 100);

    values.forEach((value) => {
      if (percent >= value && !fired.has(value)) {
        fired.add(value);
        callback(value);
      }
    });
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();

  return () => window.removeEventListener('scroll', handleScroll);
}
