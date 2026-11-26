export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const hasResend = Boolean(process.env.RESEND_API_KEY);
  const hasSmtp = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

  return res.status(200).json({
    configured: hasResend || hasSmtp,
    provider: hasResend ? 'resend' : hasSmtp ? 'smtp' : 'none',
    host: process.env.SMTP_HOST || (hasResend ? 'api.resend.com' : ''),
    defaultFromName: process.env.SMTP_FROM_NAME || 'Head Field',
    defaultFromEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || '',
  });
}
