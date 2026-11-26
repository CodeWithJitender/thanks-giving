import fs from 'fs';
import path from 'path';
import { UPLOADS_DIR } from './storage.js';

export function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function interpolate(text = '', client = {}, template = {}) {
  const name = (client.name || 'Valued Client').trim();
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

function resolveImageForEmail(imageUrl, cid, baseName) {
  if (!imageUrl || typeof imageUrl !== 'string') {
    return { src: '', attachment: null };
  }
  const trimmed = imageUrl.trim();

  // Base64 data URL
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

  // Local /uploads/... path (or http://localhost:.../uploads/...)
  const localMatch = trimmed.match(/(?:https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?)?(\/uploads\/[^?#]+)/i);
  if (localMatch) {
    const relPath = localMatch[1].replace(/^\/uploads\//, '');
    const safeName = path.basename(relPath);
    const fullPath = path.join(UPLOADS_DIR, safeName);
    if (fs.existsSync(fullPath)) {
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

  // External https:// or http:// image link
  return { src: trimmed, attachment: null };
}

export function buildEmailContent({ template, client, useCid = true }) {
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

  let logoSrc = template.logoUrl || '';
  let posterSrc = template.posterUrl || '';

  if (useCid) {
    const resolvedLogo = resolveImageForEmail(template.logoUrl, 'company-logo', 'logo');
    logoSrc = resolvedLogo.src;
    if (resolvedLogo.attachment) attachments.push(resolvedLogo.attachment);

    const resolvedPoster = resolveImageForEmail(
      template.posterUrl,
      'thanksgiving-poster',
      'poster'
    );
    posterSrc = resolvedPoster.src;
    if (resolvedPoster.attachment) attachments.push(resolvedPoster.attachment);
  }

  const logoWidth = Number(template.logoWidth) || 210;

  const logoBlock = logoSrc
    ? `
      <tr>
        <td align="center" style="padding: 28px 36px 18px 36px;">
          <img src="${escapeHtml(logoSrc)}" alt="${escapeHtml(template.department || 'Company Logo')}" width="${logoWidth}" style="display: block; max-width: 100%; width: ${logoWidth}px; height: auto; border: 0; outline: none; text-decoration: none;" />
        </td>
      </tr>`
    : '';

  const paragraphsHtml = paragraphs
    .map(
      (para) => `
      <p style="margin: 0 0 16px 0; font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #333333;">
        ${escapeHtml(para).replace(/\n/g, '<br />')}
      </p>`
    )
    .join('\n');

  const posterBlock = posterSrc
    ? `
      <tr>
        <td align="center" style="padding: 8px 32px 32px 32px;">
          <img src="${escapeHtml(posterSrc)}" alt="Happy Thanksgiving" width="536" style="display: block; width: 100%; max-width: 536px; height: auto; border: 0; border-radius: 4px; outline: none; text-decoration: none;" />
        </td>
      </tr>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(renderedSubject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f1f5f9;">
    <tr>
      <td align="center" style="padding: 24px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width: 100%; max-width: 600px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
          ${logoBlock}
          <tr>
            <td align="left" style="padding: 8px 36px 12px 36px;">
              <p style="margin: 0 0 16px 0; font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #1e293b; font-weight: 500;">
                ${escapeHtml(renderedGreeting)}
              </p>
              ${paragraphsHtml}
            </td>
          </tr>
          ${posterBlock}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [renderedGreeting, '', ...paragraphs].filter(Boolean).join('\n\n');

  return {
    subject: renderedSubject,
    html,
    text,
    attachments,
  };
}
