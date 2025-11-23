// src/fetches/expandLink.js
export function expandLink(p) {
  const base = import.meta.env.VITE_API_BASE ?? ''; // w prod zazwyczaj ''
  return `${base}${p}`;
}
