/// <reference types="vite/client" />

export const config = {
  apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:4000',
  realtimeUrl: import.meta.env.VITE_REALTIME_URL ?? 'ws://localhost:4001',
};
