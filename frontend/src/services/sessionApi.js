import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
});

export const demoUserId = import.meta.env.VITE_DEMO_USER_ID || '';

export const createDemoSession = async (theme = 'Reminiscence') => {
  const { data } = await api.post('/sessions', {
    userId: demoUserId,
    title: `${theme} CST Session`,
    theme,
  });
  return data;
};

export const respondToSession = async (sessionId, content) => {
  const { data } = await api.post(`/sessions/${sessionId}/respond`, { content });
  return data;
};
