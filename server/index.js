import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import nodemailer from 'nodemailer';
import { fileURLToPath } from 'url';
import { buildEmailContent } from './emailBuilder.js';
import {
  UPLOADS_DIR,
  createDefaultLogo,
  createDefaultPoster,
  getCampaigns,
  getSmtpConfig,
  getTemplates,
  saveSmtpConfig,
  saveTemplates,
} from './storage.js';
import {
  cancelJob,
  createTransporter,
  getJobStatus,
  matchTemplateForDepartment,
  retryFailedCampaign,
  startCampaign,
} from './campaignRunner.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(UPLOADS_DIR));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// ---------------- Image Upload (saves file & returns persistent URL) ----------------
app.post('/api/upload', (req, res) => {
  const { filename = 'image.png', dataUrl } = req.body || {};
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    return res.status(400).json({ error: 'Invalid image payload' });
  }
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return res.status(400).json({ error: 'Invalid base64 image data' });
  }

  const mime = match[1];
  const extFromMime = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
  }[mime];

  const rawBase = path
    .basename(filename, path.extname(filename))
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .slice(0, 40) || 'image';

  const ext = extFromMime || path.extname(filename).toLowerCase() || '.png';
  const savedFilename = `${rawBase}-${Date.now()}${ext}`;
  const targetPath = path.join(UPLOADS_DIR, savedFilename);

  fs.writeFileSync(targetPath, Buffer.from(match[2], 'base64'));

  const relativeUrl = `/uploads/${savedFilename}`;
  const fullUrl = `${req.protocol}://${req.get('host')}${relativeUrl}`;

  res.status(201).json({
    filename: savedFilename,
    url: relativeUrl,
    fullUrl,
  });
});

// ---------------- Templates ----------------
app.get('/api/templates', (_req, res) => {
  res.json({ templates: getTemplates() });
});

app.post('/api/templates', (req, res) => {
  const templates = getTemplates();
  const payload = req.body || {};
  const dept = (payload.department || 'New Department').trim();
  const slug = dept.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'dept';

  const newTemplate = {
    id: `dept-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    department: dept,
    isDefault: Boolean(payload.isDefault),
    subject: payload.subject || `Happy Thanksgiving, {{name}} — From ${dept}`,
    greeting: payload.greeting || 'Dear {{name}},',
    body:
      payload.body ||
      `As Thanksgiving approaches, we want to take a moment to express our sincere gratitude for the trust you place in our ${dept} team.\n\nWe wish you and your loved ones a happy Thanksgiving filled with warmth, joy, and time spent with family and friends.`,
    logoUrl: payload.logoUrl || createDefaultLogo(dept, slug),
    logoWidth: Number(payload.logoWidth) || 210,
    posterUrl: payload.posterUrl || createDefaultPoster(dept, slug),
    updatedAt: new Date().toISOString(),
  };

  let updated = [...templates];
  if (newTemplate.isDefault) {
    updated = updated.map((t) => ({ ...t, isDefault: false }));
  }
  updated.push(newTemplate);
  saveTemplates(updated);

  res.status(201).json({ template: newTemplate, templates: updated });
});

app.put('/api/templates/:id', (req, res) => {
  const { id } = req.params;
  const templates = getTemplates();
  const idx = templates.findIndex((t) => t.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Template not found' });
  }

  const patch = req.body || {};
  let updated = [...templates];
  if (patch.isDefault) {
    updated = updated.map((t) => ({ ...t, isDefault: false }));
  }

  updated[idx] = {
    ...updated[idx],
    ...patch,
    id,
    updatedAt: new Date().toISOString(),
  };
  saveTemplates(updated);

  res.json({ template: updated[idx], templates: updated });
});

app.delete('/api/templates/:id', (req, res) => {
  const { id } = req.params;
  const templates = getTemplates();
  if (templates.length <= 1) {
    return res.status(400).json({ error: 'Cannot delete the last remaining template' });
  }

  let updated = templates.filter((t) => t.id !== id);
  if (!updated.some((t) => t.isDefault) && updated.length > 0) {
    updated[0].isDefault = true;
  }
  saveTemplates(updated);
  res.json({ templates: updated });
});

// ---------------- Email Preview ----------------
app.post('/api/preview', (req, res) => {
  const { templateId, template: inlineTemplate, client } = req.body || {};
  const templates = getTemplates();
  const template =
    inlineTemplate ||
    templates.find((t) => t.id === templateId) ||
    matchTemplateForDepartment(client?.department, templates);

  if (!template) {
    return res.status(404).json({ error: 'No template available for preview' });
  }

  const rendered = buildEmailContent({
    template,
    client: client || { name: 'Deeksha', email: 'client@example.com', department: template.department },
    useCid: false,
  });

  res.json({
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    templateUsed: template.department,
  });
});

// ---------------- SMTP Configuration ----------------
app.get('/api/smtp', (_req, res) => {
  const cfg = getSmtpConfig();
  res.json({
    config: {
      ...cfg,
      hasPassword: Boolean(cfg.pass),
      pass: cfg.pass ? '••••••••' : '',
    },
  });
});

app.post('/api/smtp', (req, res) => {
  const incoming = { ...(req.body || {}) };
  if (incoming.pass === '••••••••') {
    delete incoming.pass;
  }
  const saved = saveSmtpConfig(incoming);
  res.json({
    config: {
      ...saved,
      hasPassword: Boolean(saved.pass),
      pass: saved.pass ? '••••••••' : '',
    },
  });
});

app.post('/api/smtp/ethereal', async (_req, res) => {
  try {
    const account = await nodemailer.createTestAccount();
    const saved = saveSmtpConfig({
      mode: 'smtp',
      host: account.smtp.host,
      port: account.smtp.port,
      secure: account.smtp.secure,
      user: account.user,
      pass: account.pass,
      fromName: 'Head Field (Test)',
      fromEmail: account.user,
    });
    res.json({
      ok: true,
      message: 'Ethereal test SMTP account generated and saved.',
      config: {
        ...saved,
        hasPassword: true,
        pass: '••••••••',
      },
      webUrl: 'https://ethereal.email/messages',
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to create Ethereal account' });
  }
});

app.post('/api/smtp/test', async (_req, res) => {
  const cfg = getSmtpConfig();
  if (cfg.mode === 'simulation') {
    return res.json({ ok: true, message: 'Simulation mode is active (no external SMTP required).' });
  }
  try {
    const transporter = createTransporter(cfg);
    await transporter.verify();
    transporter.close();
    res.json({ ok: true, message: `Connected successfully to ${cfg.host}:${cfg.port}` });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message || 'SMTP verification failed' });
  }
});

app.post('/api/smtp/send-test', async (req, res) => {
  const { toEmail, toName, department, templateId } = req.body || {};
  if (!toEmail) {
    return res.status(400).json({ error: 'Recipient email is required' });
  }

  const cfg = getSmtpConfig();
  const templates = getTemplates();
  const template =
    templates.find((t) => t.id === templateId) ||
    matchTemplateForDepartment(department, templates);

  if (!template) {
    return res.status(404).json({ error: 'No template available' });
  }

  const { subject, html, text, attachments } = buildEmailContent({
    template,
    client: {
      name: toName || 'Test Client',
      email: toEmail,
      department: department || template.department,
    },
    useCid: true,
  });

  if (cfg.mode === 'simulation') {
    return res.json({
      ok: true,
      simulated: true,
      message: `Simulated test email to ${toEmail} using "${template.department}" template.`,
    });
  }

  try {
    const transporter = createTransporter(cfg);
    const fromName = cfg.fromName || 'Head Field';
    const fromEmail = cfg.fromEmail || cfg.user;

    const info = await transporter.sendMail({
      from: `"${fromName.replace(/"/g, '')}" <${fromEmail}>`,
      to: toEmail,
      replyTo: cfg.replyTo || undefined,
      subject: `[TEST] ${subject}`,
      text,
      html,
      attachments,
    });
    transporter.close();

    res.json({
      ok: true,
      messageId: info.messageId,
      previewUrl: nodemailer.getTestMessageUrl(info) || null,
      message: `Test email sent to ${toEmail}`,
    });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message || 'Failed to send test email' });
  }
});

// ---------------- Campaigns ----------------
app.get('/api/campaigns', (_req, res) => {
  res.json({ campaigns: getCampaigns() });
});

app.get('/api/campaigns/:id', (req, res) => {
  const job = getJobStatus(req.params.id);
  if (!job) return res.status(404).json({ error: 'Campaign not found' });
  res.json({ campaign: job });
});

app.post('/api/campaigns/send', async (req, res) => {
  const {
    recipients,
    useDefaultFallback = true,
    selectedTemplateId = 'auto',
    campaignName,
    subjectOverride = '',
    bodyOverride = '',
  } = req.body || {};

  if (!Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: 'At least one recipient must be selected' });
  }

  const job = await startCampaign({
    recipients,
    useDefaultFallback,
    selectedTemplateId,
    campaignName,
    subjectOverride,
    bodyOverride,
  });
  res.status(202).json({ campaign: job });
});

app.post('/api/campaigns/:id/cancel', (req, res) => {
  const job = cancelJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Running campaign not found' });
  res.json({ campaign: job });
});

app.post('/api/campaigns/:id/retry', async (req, res) => {
  const job = await retryFailedCampaign(req.params.id);
  if (!job) return res.status(400).json({ error: 'No failed/skipped recipients to retry' });
  res.status(202).json({ campaign: job });
});

// Serve built React app in production
const distDir = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Thanksgiving Bulk Emailer API running on http://localhost:${PORT}`);
});
