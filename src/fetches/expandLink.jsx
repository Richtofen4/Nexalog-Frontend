/*
export function expandLink(p) {
  const base = import.meta.env.VITE_API_BASE ?? '';
  return `${base}${p}`;
}
*/
const API_BASE =
  import.meta.env.VITE_API_BASE || 'http://localhost:4000';

export function expandLink(path) {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (!path.startsWith('/')) path = '/' + path;
  return API_BASE.replace(/\/+$/, '') + path;
}
