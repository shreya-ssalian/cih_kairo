// Thin REST client for the SeaPulse FastAPI backend.
//
// Base URL is configurable via a Vite env var so the same build can point
// at localhost during development or a deployed backend in production:
//
//   VITE_API_URL=https://api.example.com npm run build
//
export const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
export const WS_URL = import.meta.env.VITE_WS_URL || `${API_BASE.replace(/^http/, 'ws')}/ws/stream`;

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`SeaPulse API ${path} failed (${res.status}): ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  health: () => request('/api/health'),

  getZones: () => request('/api/zones'),
  createZone: (zone) => request('/api/zones', { method: 'POST', body: JSON.stringify(zone) }),
  deleteZone: (id) => request(`/api/zones/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  getShips: (limit) => request(`/api/ships${limit ? `?limit=${limit}` : ''}`),
  getShip: (id) => request(`/api/ships/${encodeURIComponent(id)}`),

  getAlerts: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
    ).toString();
    return request(`/api/alerts${qs ? `?${qs}` : ''}`);
  },

  getStatus: () => request('/api/simulator/status'),
  start: () => request('/api/simulator/start', { method: 'POST' }),
  pause: () => request('/api/simulator/pause', { method: 'POST' }),
  reset: () => request('/api/simulator/reset', { method: 'POST' }),
  setShipTarget: (target) =>
    request('/api/simulator/ship-target', { method: 'POST', body: JSON.stringify({ target }) }),
  setTickRate: (tickRateMs) =>
    request('/api/simulator/tick-rate', { method: 'POST', body: JSON.stringify({ tickRateMs }) }),
  injectEvent: (type) =>
    request('/api/simulator/inject-event', { method: 'POST', body: JSON.stringify({ type }) }),
  benchmark: (numMessages, poolSize) =>
    request('/api/simulator/benchmark', { method: 'POST', body: JSON.stringify({ numMessages, poolSize }) }),
};
