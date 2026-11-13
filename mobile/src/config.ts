// The server address is fixed here on purpose (single place to change it).
export const SERVER_IP = '192.168.1.18';
export const SERVER_PORT = 5000;
export const API_BASE = `http://${SERVER_IP}:${SERVER_PORT}`;
export const API_URL = `${API_BASE}/api`;

// chat media and stories are private on the server: they are served only with a valid session token
let mediaToken: string | null = null;
export const setMediaToken = (t: string | null) => { mediaToken = t; };

export const resolveUrl = (u: string | null | undefined): string | null => {
  if (!u) return null;
  const full = /^(https?:|file:|data:)/.test(u) ? u : `${API_BASE}${u.startsWith('/') ? '' : '/'}${u}`;
  if (mediaToken && /\/uploads\/(chat|stories)\//.test(full) && !full.includes('?t=')) return `${full}?t=${encodeURIComponent(mediaToken)}`;
  return full;
};
