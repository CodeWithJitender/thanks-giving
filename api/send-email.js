import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatClientName(raw = '') {
  const cleaned = String(raw || '').trim().replace(/\s+/g, ' ');
  if (!cleaned) return '';
  return cleaned
    .split(' ')
    .map((word) =>
      word
        .split(/([-'])/)
        .map((part) => {
          if (part === '-' || part === "'" || !part) return part;
          const isAllLower = part === part.toLowerCase();
          const isAllUpper = part === part.toUpperCase();
          if (isAllLower || isAllUpper) {
            return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
          }
          return part.charAt(0).toUpperCase() + part.slice(1);
        })
        .join('')
    )
    .join(' ');
}

function interpolate(text = '', client = {}, template = {}) {
  const name = formatClientName(client.name || 'Valued Client');
  const department = (client.department || template.department || '').trim();
  const email = (client.email || '').trim();

  return String(text)
    .replace(/\{\{\s*name\s*\}\}/gi, name)
    .replace(/\{\{\s*client_?name\s*\}\}/gi, name)
    .replace(/\{\{\s*department\s*\}\}/gi, department)
    .replace(/\{\{\s*lob\s*\}\}/gi, department)
    .replace(/\{\{\s*email\s*\}\}/gi, email);
}

const EXT_MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

function findLocalUpload(safeName) {
  const candidates = [
    path.join(process.cwd(), 'public', 'uploads', safeName),
    path.join(process.cwd(), 'dist', 'uploads', safeName),
    path.join(process.cwd(), 'server', 'uploads', safeName),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function resolveImageForEmail(imageUrl, cid, baseName) {
  if (!imageUrl || typeof imageUrl !== 'string') {
    return { src: '', attachment: null };
  }
  const trimmed = imageUrl.trim();

  if (trimmed.startsWith('data:')) {
    const match = trimmed.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return { src: '', attachment: null };
    const mimeType = match[1];
    const ext =
      Object.entries(EXT_MIME).find(([, m]) => m === mimeType)?.[0]?.slice(1) || 'png';
    return {
      src: `cid:${cid}`,
      attachment: {
        filename: `${baseName}.${ext}`,
        content: Buffer.from(match[2], 'base64'),
        contentType: mimeType,
        cid,
        contentDisposition: 'inline',
      },
    };
  }

  const localMatch = trimmed.match(
    /(?:https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?)?(\/uploads\/[^?#]+)/i
  );
  if (localMatch) {
    const safeName = path.basename(localMatch[1].replace(/^\/uploads\//, ''));
    const fullPath = findLocalUpload(safeName);
    if (fullPath) {
      const ext = path.extname(safeName).toLowerCase();
      return {
        src: `cid:${cid}`,
        attachment: {
          filename: safeName,
          path: fullPath,
          contentType: EXT_MIME[ext] || 'image/png',
          cid,
          contentDisposition: 'inline',
        },
      };
    }
  }

  return { src: trimmed, attachment: null };
}

function buildEmail({ template, client }) {
  const renderedSubject = interpolate(
    template.subject || 'Happy Thanksgiving from {{department}}',
    client,
    template
  );
  const renderedGreeting = interpolate(template.greeting || 'Dear {{name}},', client, template);
  const renderedBody = interpolate(template.body || '', client, template);

  const paragraphs = renderedBody
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const attachments = [];
  const resolvedLogo = resolveImageForEmail(template.logoUrl, 'company-logo', 'logo');
  if (resolvedLogo.attachment) attachments.push(resolvedLogo.attachment);

  const resolvedPoster = resolveImageForEmail(
    template.posterUrl,
    'thanksgiving-poster',
    'poster'
  );
  if (resolvedPoster.attachment) attachments.push(resolvedPoster.attachment);

  const logoWidth = Number(template.logoWidth) || 210;

  const logoBlock = resolvedLogo.src
    ? `<tr><td align="center" style="padding:28px 36px 18px 36px;"><img src="${escapeHtml(
        resolvedLogo.src
      )}" alt="${escapeHtml(template.department || 'Logo')}" width="${logoWidth}" style="display:block;max-width:100%;width:${logoWidth}px;height:auto;border:0;" /></td></tr>`
    : '';

  const paragraphsHtml = paragraphs
    .map(
      (para) =>
        `<p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#333333;">${escapeHtml(
          para
        ).replace(/\n/g, '<br />')}</p>`
    )
    .join('\n');

  const posterBlock = resolvedPoster.src
    ? `<tr><td align="center" style="padding:8px 32px 32px 32px;"><img src="${escapeHtml(
        resolvedPoster.src
      )}" alt="Happy Thanksgiving" width="536" style="display:block;width:100%;max-width:536px;height:auto;border:0;border-radius:4px;" /></td></tr>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f1f5f9;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;">
        ${logoBlock}
        <tr><td align="left" style="padding:8px 36px 12px 36px;">
          <p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1e293b;font-weight:500;">${escapeHtml(
            renderedGreeting
          )}</p>
          ${paragraphsHtml}
        </td></tr>
        ${posterBlock}
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [renderedGreeting, '', ...paragraphs].filter(Boolean).join('\n\n');
  return { subject: renderedSubject, html, text, attachments };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { smtpConfig = {}, template, client, isTest = false } = req.body || {};
  if (!client?.email || !template) {
    return res.status(400).json({ error: 'Missing client email or template' });
  }

  const hasResend = Boolean(process.env.RESEND_API_KEY);
  const cfg = {
    host: smtpConfig.host || process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(smtpConfig.port || process.env.SMTP_PORT) || 587,
    secure: Boolean(smtpConfig.secure ?? process.env.SMTP_SECURE === 'true'),
    user: smtpConfig.user || process.env.SMTP_USER || '',
    pass: smtpConfig.pass || process.env.SMTP_PASS || '',
    fromName: smtpConfig.fromName || process.env.SMTP_FROM_NAME || 'Head Field',
    fromEmail:
      smtpConfig.fromEmail ||
      process.env.SMTP_FROM_EMAIL ||
      smtpConfig.user ||
      process.env.SMTP_USER ||
      '',
    replyTo: smtpConfig.replyTo || process.env.SMTP_REPLY_TO || '',
  };

  if (!hasResend && (!cfg.host || !cfg.user || !cfg.pass)) {
    return res.status(400).json({
      ok: false,
      error:
        'Email server is not configured. Add SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS (or RESEND_API_KEY) to .env locally or Vercel Environment Variables.',
    });
  }

  const { subject, html, text, attachments } = buildEmail({ template, client });
  const fromEmail = cfg.fromEmail || cfg.user;

  if (hasResend && !cfg.user) {
    try {
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${String(cfg.fromName).replace(/[<>]/g, '')} <${fromEmail}>`,
          to: [client.email],
          subject: isTest ? `[TEST] ${subject}` : subject,
          html,
          text,
        }),
      });
      const data = await resendRes.json().catch(() => ({}));
      if (!resendRes.ok) {
        return res.status(400).json({ ok: false, error: data.message || 'Resend API failed' });
      }
      return res.status(200).json({ ok: true, messageId: data.id, message: `Sent to ${client.email}` });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err?.message || 'Resend send failed' });
    }
  }

  try {
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
    });

    const info = await transporter.sendMail({
      from: `"${String(cfg.fromName).replace(/"/g, '')}" <${fromEmail}>`,
      to: client.name ? `"${String(client.name).replace(/"/g, '')}" <${client.email}>` : client.email,
      replyTo:
        cfg.replyTo ||
        (smtpConfig.fromEmail && smtpConfig.fromEmail !== cfg.user ? smtpConfig.fromEmail : undefined),
      subject: isTest ? `[TEST] ${subject}` : subject,
      text,
      html,
      attachments,
    });

    transporter.close();

    return res.status(200).json({
      ok: true,
      messageId: info.messageId,
      previewUrl: nodemailer.getTestMessageUrl(info) || null,
      message: `Sent to ${client.email}`,
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err?.message || 'SMTP send failed' });
  }
}
