// All API calls use relative paths — Vite proxy forwards to the right backend.
export const API_BASE_URL = '';

// Direct URL for Google OAuth popup (must bypass proxy for OAuth redirects).
export const AUTH_BACKEND_URL = 'http://localhost:8001';