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
  // Tries local server upload first; falls back cleanly to inline dataUrl on static/serverless hosts like Vercel
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

  getMailStatus: () => request('/api/mail-status'),

  sendSingleEmail: (payload) =>
    request('/api/send-email', { method: 'POST', body: JSON.stringify(payload) }),

  testSmtp: (smtpConfig) =>
    request('/api/test-smtp', { method: 'POST', body: JSON.stringify({ smtpConfig }) }),

  createEthereal: () => request('/api/ethereal', { method: 'POST' }),
};
