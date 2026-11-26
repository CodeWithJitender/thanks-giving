const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function request(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...JSON_HEADERS,
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Unexpected response from ${url}`);
  }
  if (!res.ok) {
    throw new Error(data.error || data.message || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  uploadImage: async (filename, dataUrl) => {
    try {
      const res = await request('/api/upload', {
        method: 'POST',
        body: JSON.stringify({ filename, dataUrl }),
      });
      if (res?.url) return res;
    } catch {
      // Vercel / static deployment fallback
    }
    return {
      filename,
      url: dataUrl,
      fullUrl: dataUrl,
      inline: true,
    };
  },

  // MongoDB-backed Templates
  getTemplates: () => request('/api/templates'),
  createTemplate: (payload) =>
    request('/api/templates', { method: 'POST', body: JSON.stringify(payload) }),
  updateTemplate: (id, payload) =>
    request(`/api/templates?id=${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({ ...payload, id }),
    }),
  deleteTemplate: (id) =>
    request(`/api/templates?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  resetTemplates: () =>
    request('/api/templates', { method: 'POST', body: JSON.stringify({ action: 'reset' }) }),

  // MongoDB-backed Sheet
  getSheet: () => request('/api/sheet'),
  saveSheet: (sheet) =>
    request('/api/sheet', { method: 'PUT', body: JSON.stringify(sheet) }),
  clearSheet: () => request('/api/sheet', { method: 'DELETE' }),

  // MongoDB-backed Campaigns
  getCampaigns: () => request('/api/campaigns'),
  saveCampaign: (campaign) =>
    request('/api/campaigns', { method: 'POST', body: JSON.stringify(campaign) }),
  clearCampaigns: () => request('/api/campaigns', { method: 'DELETE' }),

  // MongoDB-backed Sent History (per-email tick + sent images)
  getSentHistory: () => request('/api/sent-history'),
  recordSentHistory: (entries) =>
    request('/api/sent-history', {
      method: 'POST',
      body: JSON.stringify({ entries }),
    }),
  clearSentHistory: (email) =>
    request(
      email
        ? `/api/sent-history?email=${encodeURIComponent(email)}`
        : '/api/sent-history',
      { method: 'DELETE' }
    ),

  // Admin Document Console (/admin/jkr19)
  getAdminDocs: () => request('/api/admin-docs'),
  saveAdminDoc: (collection, document) =>
    request('/api/admin-docs', {
      method: 'PUT',
      body: JSON.stringify({ collection, document }),
    }),
  deleteAdminDoc: (collection, id) =>
    request(
      `/api/admin-docs?collection=${encodeURIComponent(collection)}&id=${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    ),
  importAdminDocs: (payload) =>
    request('/api/admin-docs', { method: 'POST', body: JSON.stringify(payload) }),

  getMailStatus: () => request('/api/mail-status'),

  sendSingleEmail: (payload) =>
    request('/api/send-email', { method: 'POST', body: JSON.stringify(payload) }),
};
