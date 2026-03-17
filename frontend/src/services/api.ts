import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Projects API
export const projectsApi = {
  getAll: () => api.get('/projects'),
  getById: (id: string) => api.get(`/projects/${id}`),
  create: (data: any) => api.post('/projects', data),
  update: (id: string, data: any) => api.patch(`/projects/${id}`, data),
  delete: (id: string) => api.delete(`/projects/${id}`),
};

// Sources API
export const sourcesApi = {
  getAll: (projectId?: string) => api.get('/sources', { params: { projectId } }),
  getById: (id: string) => api.get(`/sources/${id}`),
  create: (data: any) => api.post('/sources', data),
  update: (id: string, data: any) => api.patch(`/sources/${id}`, data),
  delete: (id: string) => api.delete(`/sources/${id}`),
};

// Mentions API
export const mentionsApi = {
  getAll: (projectId?: string, status?: string) =>
    api.get('/mentions', { params: { projectId, status } }),
  getById: (id: string) => api.get(`/mentions/${id}`),
  update: (id: string, data: any) => api.patch(`/mentions/${id}`, data),
  delete: (id: string) => api.delete(`/mentions/${id}`),
  bulkUpdate: (ids: string[], status: string) =>
    api.post('/mentions/bulk-update', { ids, status }),
};

// Widget API
export const widgetApi = {
  getData: (projectId: string) => api.get(`/widget/${projectId}/data`),
  getEmbedCode: (projectId: string) => api.get(`/widget/${projectId}/embed`),
};
