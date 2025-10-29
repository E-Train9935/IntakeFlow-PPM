// Read at build time by Vite (on Netlify)
const isProd = import.meta.env.PROD;

export const API_BASE = isProd
  ? import.meta.env.VITE_API_BASE // in production, NEVER fallback
  : (import.meta.env.VITE_API_BASE ?? "http://localhost:5000/api/Projects");

export const API_KEY = import.meta.env.VITE_API_KEY ?? "dev-12345";
