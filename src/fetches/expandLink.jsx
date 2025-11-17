export function expandLink(p) {
  const base = import.meta.env.VITE_API_BASE ?? '';
  return `${base}${p}`;
}
