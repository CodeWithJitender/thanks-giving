const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function request(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...JSON_HEADERS,
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.message || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  uploadImage: (filename, dataUrl) =>
    request('/api/upload', { method: 'POST', body: JSON.stringify({ filename, dataUrl }) }),

  getTemplates: () => request('/api/templates'),
  createTemplate: (payload) =>
    request('/api/templates', { method: 'POST', body: JSON.stringify(payload) }),
  updateTemplate: (id, payload) =>
    request(`/api/templates/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteTemplate: (id) => request(`/api/templates/${id}`, { method: 'DELETE' }),

  previewEmail: (payload) =>
    request('/api/preview', { method: 'POST', body: JSON.stringify(payload) }),

  getSmtp: () => request('/api/smtp'),
  saveSmtp: (payload) =>
    request('/api/smtp', { method: 'POST', body: JSON.stringify(payload) }),
  testSmtp: () => request('/api/smtp/test', { method: 'POST' }),
  createEthereal: () => request('/api/smtp/ethereal', { method: 'POST' }),
  sendTestEmail: (payload) =>
    request('/api/smtp/send-test', { method: 'POST', body: JSON.stringify(payload) }),

  getCampaigns: () => request('/api/campaigns'),
  getCampaign: (id) => request(`/api/campaigns/${id}`),
  startCampaign: (payload) =>
    request('/api/campaigns/send', { method: 'POST', body: JSON.stringify(payload) }),
  cancelCampaign: (id) => request(`/api/campaigns/${id}/cancel`, { method: 'POST' }),
  retryCampaign: (id) => request(`/api/campaigns/${id}/retry`, { method: 'POST' }),
};
