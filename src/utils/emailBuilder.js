import { formatClientName } from './spreadsheet';

export function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function interpolate(text = '', client = {}, template = {}) {
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

function normalizeAssetUrl(url = '') {
  return String(url || '').replace(/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(\/uploads\/)/i, '$1');
}

export function buildPreviewEmail({ template, client }) {
  if (!template) return { subject: '', html: '' };

  const logoUrl = normalizeAssetUrl(template.logoUrl);
  const posterUrl = normalizeAssetUrl(template.posterUrl);

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

  const logoWidth = Number(template.logoWidth) || 210;
  const rawBg = String(template.logoBgColor || '#ffffff').trim();
  const logoBg = /^#[0-9a-f]{3,8}$/i.test(rawBg) ? rawBg : '#ffffff';

  const logoBlock = logoUrl
    ? `<tr>
        <td align="center" bgcolor="${logoBg}" style="padding: 26px 36px 20px 36px; background-color: ${logoBg}; background-image: linear-gradient(${logoBg}, ${logoBg});">
          <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(template.department || 'Logo')}" width="${logoWidth}" style="display: block; max-width: 100%; width: ${logoWidth}px; height: auto; border: 0;" />
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

  const posterBlock = posterUrl
    ? `<tr>
        <td align="center" bgcolor="#ffffff" style="padding: 8px 32px 32px 32px; background-color: #ffffff; background-image: linear-gradient(#ffffff, #ffffff);">
          <img src="${escapeHtml(posterUrl)}" alt="Happy Thanksgiving" width="536" style="display: block; width: 100%; max-width: 536px; height: auto; border: 0; border-radius: 4px;" />
        </td>
      </tr>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light only" />
  <style>
    :root { color-scheme: light only; supported-color-schemes: light only; }
    body, .email-outer { background-color: #f1f5f9 !important; }
    .email-card { background-color: #ffffff !important; color: #1e293b !important; }
  </style>
</head>
<body class="body" bgcolor="#f1f5f9" style="margin: 0; padding: 0; background-color: #f1f5f9; background-image: linear-gradient(#f1f5f9, #f1f5f9);">
  <table class="email-outer" role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#f1f5f9" style="background-color: #f1f5f9; background-image: linear-gradient(#f1f5f9, #f1f5f9);">
    <tr>
      <td align="center" bgcolor="#f1f5f9" style="padding: 24px 12px; background-color: #f1f5f9; background-image: linear-gradient(#f1f5f9, #f1f5f9);">
        <table class="email-card" role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" bgcolor="#ffffff" style="width: 100%; max-width: 600px; background-color: #ffffff; background-image: linear-gradient(#ffffff, #ffffff); border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
          ${logoBlock}
          <tr>
            <td align="left" bgcolor="#ffffff" style="padding: 16px 36px 12px 36px; background-color: #ffffff; background-image: linear-gradient(#ffffff, #ffffff);">
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

  return { subject: renderedSubject, html };
}
