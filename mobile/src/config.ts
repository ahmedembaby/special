// Configure EXPO_PUBLIC_API_URL in the build environment, e.g. http://192.168.1.18:5000/api.
// The fallback keeps the existing local development setup working.
const configuredApiUrl = (process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.18:5000/api').replace(/\\/+$/, '');
export const API_URL = configuredApiUrl;
export const API_BASE = configuredApiUrl.replace(/\\/api$/i, '');
export const SERVER_IP = (() => {
  try { return new URL(API_BASE).hostname; } catch { return 'localhost'; }
})();
export const SERVER_PORT = (() => {
  try { return Number(new URL(API_BASE).port) || (new URL(API_BASE).protocol === 'https:' ? 443 : 80); } catch { return 5000; }
})();

// Chat media and stories are private on the server: served only with a valid session token.
let mediaToken: string | null = null;
export const setMediaToken = (t: string | null) => { mediaToken = t; };

export const resolveUrl = (u: string | null | undefined): string | null => {
  if (!u) return null;
  const full = /^(https?:|file:|data:)/.test(u) ? u : `${API_BASE}${u.startsWith('/') ? '' : '/'}${u}`;
  if (mediaToken && /\\/uploads\\/(chat|stories)\\//.test(full) && !full.includes('?t=')) return `${full}?t=${encodeURIComponent(mediaToken)}`;
  return full;
};
