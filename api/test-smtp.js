import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const smtpConfig = req.body?.smtpConfig || req.body || {};
  const mode = smtpConfig.mode || (process.env.SMTP_USER ? 'smtp' : 'simulation');

  if (mode === 'simulation') {
    return res.status(200).json({
      ok: true,
      message: 'Simulation mode is active (no external SMTP required).',
    });
  }

  const host = smtpConfig.host || process.env.SMTP_HOST;
  const port = Number(smtpConfig.port || process.env.SMTP_PORT) || 587;
  const secure = Boolean(smtpConfig.secure ?? process.env.SMTP_SECURE === 'true');
  const user = smtpConfig.user || process.env.SMTP_USER;
  const pass = smtpConfig.pass || process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return res.status(400).json({ error: 'Enter SMTP Host, Username, and Password first.' });
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
    await transporter.verify();
    transporter.close();
    return res.status(200).json({ ok: true, message: `Connected successfully to ${host}:${port}` });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err?.message || 'SMTP verification failed' });
  }
}
