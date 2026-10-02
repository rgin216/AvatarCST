import axios from 'axios';
import { deploymentLatency } from '../utils/deploymentLatency.js';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

api.interceptors.request.use(config => {
  const match = config.url?.match(/^\/sessions\/([^/]+)\/(respond|respond-audio)$/u);
  if (match && config.method === 'post') {
    const field = key => config.data instanceof FormData ? config.data.get(key) : config.data?.[key];
    config.latencyRow = deploymentLatency.begin({ sessionId: match[1], inputMode: match[2] === 'respond-audio' ? 'audio' : 'text',
      avatarMode: field('avatarMode'), lipSyncMode: field('lipSyncMode') });
  }
  return config;
});
api.interceptors.response.use(response => {
  deploymentLatency.response(response.config.latencyRow, response.data);
  return response;
}, error => {
  deploymentLatency.failed(error.config?.latencyRow, error.response?.status);
  return Promise.reject(error);
});

export default api;
