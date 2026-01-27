import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const api = {
  // Authentication
  login: async (username: string, password: string) => {
    const response = await axiosInstance.post('/auth/login', { username, password });
    return response.data;
  },

  // Dashboard
  getDashboardStats: async () => {
    const response = await axiosInstance.get('/dashboard/stats');
    return response.data;
  },

  getIssueTrends: async () => {
    const response = await axiosInstance.get('/dashboard/trends');
    return response.data;
  },

  // Projects
  getProjects: async (params?: { page?: number; limit?: number }) => {
    const response = await axiosInstance.get('/projects', { params });
    return response.data;
  },

  createProject: async (data: { name: string; repository_url: string; description?: string }) => {
    const response = await axiosInstance.post('/projects', data);
    return response.data;
  },

  getProject: async (projectId: string) => {
    const response = await axiosInstance.get(`/projects/${projectId}`);
    return response.data;
  },

  deleteProject: async (projectId: string) => {
    const response = await axiosInstance.delete(`/projects/${projectId}`);
    return response.data;
  },

  // Analyses
  getAnalyses: async (params?: { page?: number; limit?: number; project_id?: string }) => {
    const response = await axiosInstance.get('/analyses', { params });
    return response.data;
  },

  getAnalysis: async (analysisId: string) => {
    const response = await axiosInstance.get(`/analyses/${analysisId}`);
    return response.data;
  },

  createAnalysis: async (data: { repository_url: string; branch?: string; analyzers?: string[] }) => {
    const response = await axiosInstance.post('/analyze', data);
    return response.data;
  },

  analyzeFile: async (data: { content: string; language: string }) => {
    const response = await axiosInstance.post('/analyze/file', data);
    return response.data;
  },

  // Security
  securityScan: async (data: { repository_url: string; scan_types?: string[] }) => {
    const response = await axiosInstance.post('/security/scan', data);
    return response.data;
  },

  getVulnerabilities: async (params?: { severity?: string; limit?: number }) => {
    const response = await axiosInstance.get('/security/vulnerabilities', { params });
    return response.data;
  },

  // Reports
  generateReport: async (analysisId: string, format: string) => {
    const response = await axiosInstance.post('/reports/generate', {
      analysis_id: analysisId,
      format,
    });
    return response.data;
  },

  downloadReport: async (reportUrl: string) => {
    const response = await axiosInstance.get(reportUrl, {
      responseType: 'blob',
    });
    return response.data;
  },

  // Settings
  getSettings: async () => {
    const response = await axiosInstance.get('/settings');
    return response.data;
  },

  updateSettings: async (data: any) => {
    const response = await axiosInstance.put('/settings', data);
    return response.data;
  },
};

export default axiosInstance;
