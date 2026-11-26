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

export function buildPreviewEmail({ template, client }) {
  if (!template) return { subject: '', html: '' };

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

  const logoBlock = template.logoUrl
    ? `<tr>
        <td align="center" style="padding: 28px 36px 18px 36px;">
          <img src="${escapeHtml(template.logoUrl)}" alt="${escapeHtml(template.department || 'Logo')}" width="${logoWidth}" style="display: block; max-width: 100%; width: ${logoWidth}px; height: auto; border: 0;" />
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

  const posterBlock = template.posterUrl
    ? `<tr>
        <td align="center" style="padding: 8px 32px 32px 32px;">
          <img src="${escapeHtml(template.posterUrl)}" alt="Happy Thanksgiving" width="536" style="display: block; width: 100%; max-width: 536px; height: auto; border: 0; border-radius: 4px;" />
        </td>
      </tr>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
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

  return { subject: renderedSubject, html };
}
