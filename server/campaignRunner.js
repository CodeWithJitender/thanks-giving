import nodemailer from 'nodemailer';
import { buildEmailContent } from './emailBuilder.js';
import { getCampaigns, getSmtpConfig, getTemplates, saveCampaigns } from './storage.js';

const activeJobs = new Map();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createTransporter(smtpConfig) {
  return nodemailer.createTransport({
    host: smtpConfig.host,
    port: Number(smtpConfig.port) || 587,
    secure: Boolean(smtpConfig.secure),
    pool: true,
    maxConnections: Number(smtpConfig.concurrency) || 2,
    maxMessages: 100,
    auth:
      smtpConfig.user && smtpConfig.pass
        ? {
            user: smtpConfig.user,
            pass: smtpConfig.pass,
          }
        : undefined,
  });
}

export function matchTemplateForDepartment(department, templates) {
  const normalized = (department || '').trim().toLowerCase();
  if (normalized) {
    const exact = templates.find(
      (t) => (t.department || '').trim().toLowerCase() === normalized
    );
    if (exact) return exact;
  }
  return templates.find((t) => t.isDefault) || templates[0] || null;
}

function persistJob(job) {
  const all = getCampaigns();
  const idx = all.findIndex((c) => c.id === job.id);
  const summary = {
    ...job,
    results: job.results.slice(0, 2000),
  };
  if (idx >= 0) {
    all[idx] = summary;
  } else {
    all.unshift(summary);
  }
  saveCampaigns(all);
}

export function getJobStatus(id) {
  if (activeJobs.has(id)) {
    return activeJobs.get(id);
  }
  return getCampaigns().find((c) => c.id === id) || null;
}

export function cancelJob(id) {
  const job = activeJobs.get(id);
  if (job && job.status === 'running') {
    job.cancelled = true;
    job.status = 'cancelled';
    job.finishedAt = new Date().toISOString();
    persistJob(job);
    return job;
  }
  return null;
}

export async function startCampaign({
  recipients,
  useDefaultFallback = true,
  campaignName,
  subjectOverride = '',
  bodyOverride = '',
}) {
  const smtpConfig = getSmtpConfig();
  const templates = getTemplates();

  const id = `cmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const job = {
    id,
    name: campaignName || `Campaign (${recipients.length} clients)`,
    mode: smtpConfig.mode || 'simulation',
    status: 'running',
    total: recipients.length,
    sent: 0,
    failed: 0,
    skipped: 0,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    cancelled: false,
    results: recipients.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      department: r.department,
      status: 'pending',
      templateUsed: null,
      error: null,
      previewUrl: null,
      sentAt: null,
    })),
  };

  activeJobs.set(id, job);
  persistJob(job);

  runQueue(
    job,
    recipients,
    templates,
    smtpConfig,
    useDefaultFallback,
    subjectOverride,
    bodyOverride
  ).catch((err) => {
    job.status = 'failed';
    job.error = err.message;
    job.finishedAt = new Date().toISOString();
    persistJob(job);
  });

  return job;
}

export async function retryFailedCampaign(id) {
  const prev = getJobStatus(id);
  if (!prev) return null;

  const failedRows = prev.results.filter((r) => r.status === 'failed' || r.status === 'skipped');
  if (failedRows.length === 0) return null;

  return startCampaign({
    recipients: failedRows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      department: r.department,
    })),
    useDefaultFallback: true,
    campaignName: `${prev.name} (Retry ${failedRows.length})`,
  });
}

async function runQueue(
  job,
  recipients,
  templates,
  smtpConfig,
  useDefaultFallback,
  subjectOverride,
  bodyOverride
) {
  const isSimulation = smtpConfig.mode === 'simulation';
  let transporter = null;

  if (!isSimulation) {
    transporter = createTransporter(smtpConfig);
  }

  const delayMs = Number(smtpConfig.delayMs) || 100;

  for (let i = 0; i < recipients.length; i++) {
    if (job.cancelled) break;

    const client = recipients[i];
    const resultRow = job.results[i];

    const matchedTemplate = (() => {
      const normalized = (client.department || '').trim().toLowerCase();
      const exact = templates.find(
        (t) => (t.department || '').trim().toLowerCase() === normalized
      );
      if (exact) return exact;
      return useDefaultFallback ? templates.find((t) => t.isDefault) || templates[0] : null;
    })();

    if (!matchedTemplate) {
      resultRow.status = 'skipped';
      resultRow.error = `No template found for department "${client.department || 'N/A'}"`;
      job.skipped++;
      continue;
    }

    resultRow.templateUsed = matchedTemplate.department;

    const effectiveTemplate = {
      ...matchedTemplate,
      subject: client.subjectOverride || subjectOverride || matchedTemplate.subject,
      body: client.bodyOverride || bodyOverride || matchedTemplate.body,
    };

    try {
      const { subject, html, text, attachments } = buildEmailContent({
        template: effectiveTemplate,
        client,
        useCid: true,
      });

      const fromName = smtpConfig.fromName || 'Head Field';
      const fromEmail = smtpConfig.fromEmail || smtpConfig.user || 'greetings@headfield.com';

      if (isSimulation) {
        await sleep(Math.min(delayMs, 35));
        resultRow.status = 'sent';
        resultRow.sentAt = new Date().toISOString();
        job.sent++;
      } else {
        const info = await transporter.sendMail({
          from: `"${fromName.replace(/"/g, '')}" <${fromEmail}>`,
          to: client.name ? `"${client.name.replace(/"/g, '')}" <${client.email}>` : client.email,
          replyTo: smtpConfig.replyTo || undefined,
          subject,
          text,
          html,
          attachments,
        });

        const previewUrl = nodemailer.getTestMessageUrl(info) || null;
        resultRow.status = 'sent';
        resultRow.previewUrl = previewUrl;
        resultRow.sentAt = new Date().toISOString();
        job.sent++;

        if (delayMs > 0 && i < recipients.length - 1) {
          await sleep(delayMs);
        }
      }
    } catch (err) {
      resultRow.status = 'failed';
      resultRow.error = err?.message || 'Unknown send error';
      job.failed++;
    }

    if (i % 10 === 0) {
      persistJob(job);
    }
  }

  if (transporter) {
    transporter.close();
  }

  if (!job.cancelled) {
    job.status = 'completed';
    job.finishedAt = new Date().toISOString();
  }
  persistJob(job);
}
