const configuredBaseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
if (process.env.NODE_ENV === 'production' && !configuredBaseUrl.startsWith('https://')) {
  throw new Error('EXPO_PUBLIC_API_BASE_URL must use HTTPS in production');
}
export const API_BASE = configuredBaseUrl;
export const API_URL = `${API_BASE}/api`;

let mediaToken: string | null = null;
export const setMediaToken = (token: string | null) => { mediaToken = token; };
export const resolveUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  const full = /^(https?:|file:|data:)/.test(url) ? url : `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
  if (mediaToken && /\/uploads\/(chat|stories)\//.test(full) && !full.includes('?t=')) return `${full}?t=${encodeURIComponent(mediaToken)}`;
  return full;
};
