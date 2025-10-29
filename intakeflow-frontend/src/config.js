// intakeflow-frontend/src/config.js
const isProd = import.meta.env.PROD;

export const API_BASE = isProd
  ? import.meta.env.VITE_API_BASE
  : (import.meta.env.VITE_API_BASE ?? "http://localhost:5000/api/Projects");

export const API_KEY = import.meta.env.VITE_API_KEY ?? "dev-12345";

console.log("✅ Using API_BASE:", API_BASE);
