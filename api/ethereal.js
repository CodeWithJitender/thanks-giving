import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const account = await nodemailer.createTestAccount();
    return res.status(200).json({
      ok: true,
      config: {
        mode: 'smtp',
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        user: account.user,
        pass: account.pass,
        fromName: 'Head Field (Test)',
        fromEmail: account.user,
        replyTo: '',
        delayMs: 150,
      },
      webUrl: 'https://ethereal.email/messages',
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Failed to create Ethereal account' });
  }
}
