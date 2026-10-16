const BASE = '/api/v1';

export function getToken() {
  return localStorage.getItem('kai_token') || '';
}

export function setSession(token, user) {
  if (token) localStorage.setItem('kai_token', token);
  if (user) localStorage.setItem('kai_user', JSON.stringify(user));
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem('kai_user') || 'null');
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem('kai_token');
  localStorage.removeItem('kai_user');
}

async function request(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth || getToken()) headers.Authorization = `Bearer ${getToken()}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  if (res.status === 401) {
    clearSession();
    window.dispatchEvent(new Event('kai:unauthorized'));
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    throw new Error((data && data.error) || `Xəta: ${res.status}`);
  }
  return data;
}

async function uploadRequest(path, formData) {
  const headers = {};
  if (getToken()) headers.Authorization = `Bearer ${getToken()}`;
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers, body: formData });

  if (res.status === 401) {
    clearSession();
    window.dispatchEvent(new Event('kai:unauthorized'));
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    throw new Error((data && data.error) || `Yükləmə xətası: ${res.status}`);
  }
  return data;
}

export const api = {
  // auth
  login: (voen, password) => request('/auth/login', { method: 'POST', body: { voen, password } }),
  mygovLogin: (fin) => request('/auth/mygov', { method: 'POST', body: { fin } }),
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  demoAccounts: () => request('/auth/demo-accounts'),
  users: (status) => request(`/auth/users${status ? `?status=${status}` : ''}`, { auth: true }),
  setUserStatus: (id, status) => request(`/auth/users/${id}/status`, { method: 'PATCH', body: { status }, auth: true }),

  // lands
  meta: () => request('/lands/meta'),
  lands: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null && v !== '')
    ).toString();
    return request(`/lands${qs ? `?${qs}` : ''}`);
  },
  land: (id) => request(`/lands/${id}`),
  landStats: () => request('/lands/stats'),
  addLand: (payload) => request('/lands', { method: 'POST', body: payload, auth: true }),
  updateLand: (id, payload) => request(`/lands/${id}`, { method: 'PUT', body: payload, auth: true }),

  // uploads
  upload: (files) => {
    const fd = new FormData();
    for (const file of Array.from(files || [])) fd.append('files', file);
    return uploadRequest('/upload', fd);
  },
  deleteUpload: (id) => request(`/upload/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true }),

  // roi
  roiCrops: () => request('/roi/crops'),
  simulate: (purpose, areaHa, opts = {}) =>
    request('/roi/simulate', { method: 'POST', body: { purpose, areaHa, ...opts } }),

  // applications
  createApplication: (payload) => request('/applications', { method: 'POST', body: payload, auth: true }),
  applications: () => request('/applications', { auth: true }),
  application: (id) => request(`/applications/${id}`, { auth: true }),
  track: (code) => request(`/applications/track/${code}`),
  addApplicationDocuments: (code, files) =>
    request(`/applications/track/${encodeURIComponent(code)}/documents`, {
      method: 'POST',
      body: { files },
      auth: true
    }),
  updateStatus: (id, status, note) =>
    request(`/applications/${id}/status`, { method: 'PATCH', body: { status, note }, auth: true }),

  // ektis
  ektisLands: () => request('/ektis/lands'),
  ektisVerify: (voen) => request(`/ektis/farmer/verify/${voen}`),
  ektisSync: (applicationId) => request('/ektis/applications/sync', { method: 'POST', body: { applicationId } }),
  ektisStatus: () => request('/ektis/status'),
  ndvi: (landId) => request(`/ektis/ndvi/${landId}`),

  // competitions
  competitions: () => request('/competitions'),
  activeCompetition: () => request('/competitions/active'),
  addCompetition: (payload) => request('/competitions', { method: 'POST', body: payload, auth: true }),
  updateCompetition: (id, payload) => request(`/competitions/${id}`, { method: 'PUT', body: payload, auth: true }),
  setCompetitionStatus: (id, status) =>
    request(`/competitions/${id}/status`, { method: 'PATCH', body: { status }, auth: true }),
  setCompetitionStage: (id, currentStage) =>
    request(`/competitions/${id}/stage`, { method: 'PATCH', body: { currentStage }, auth: true }),

  // notifications
  notifications: () => request('/notifications', { auth: true }),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'PATCH', auth: true }),
  markAllNotificationsRead: () => request('/notifications/read-all', { method: 'POST', auth: true }),

  // advisor
  recommend: (landId) => request('/advisor/recommend', { method: 'POST', body: { landId } }),

  // vacancies
  vacancies: () => request('/vacancies'),

  // co-investment (B2B marketplace)
  investmentProjects: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null && v !== '')
    ).toString();
    return request(`/investments/projects${qs ? `?${qs}` : ''}`);
  },
  investmentProject: (id) => request(`/investments/projects/${id}`),
  createInvestmentProject: (payload) => request('/investments/projects', { method: 'POST', body: payload, auth: true }),
  updateInvestmentProject: (id, payload) => request(`/investments/projects/${id}`, { method: 'PUT', body: payload, auth: true }),
  investmentOffers: (projectId) => request(`/investments/projects/${projectId}/offers`, { auth: true }),
  myInvestmentOffers: () => request('/investments/my-offers', { auth: true }),
  submitInvestmentOffer: (projectId, payload) => request(`/investments/projects/${projectId}/offers`, { method: 'POST', body: payload, auth: true }),
  respondInvestmentOffer: (id, action, terms) => request(`/investments/offers/${id}/${action}`, { method: 'PATCH', body: { terms }, auth: true }),

  // chatbot (AI assistant)
  chat: (message, history) => request('/chat', { method: 'POST', body: { message, history } }),

  // analytics
  analytics: () => request('/analytics/overview')
};
