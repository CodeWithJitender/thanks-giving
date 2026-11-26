import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
export const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const TEMPLATES_FILE = path.join(DATA_DIR, 'templates.json');
const SMTP_FILE = path.join(DATA_DIR, 'smtp.json');
const CAMPAIGNS_FILE = path.join(DATA_DIR, 'campaigns.json');

function ensureDefaultAsset(filename, svgContent) {
  const filePath = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, svgContent, 'utf8');
  }
  return `/uploads/${filename}`;
}

export function createDefaultLogo(deptLabel = 'HEAD FIELD', slug = 'general') {
  const safeLabel = String(deptLabel).replace(/[<>&"']/g, '');
  const safeSlug = String(slug).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="72" viewBox="0 0 320 72">
  <rect width="320" height="72" fill="#ffffff"/>
  <text x="160" y="34" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="700" letter-spacing="4" fill="#1e293b">HEAD FIELD</text>
  <line x1="36" y1="48" x2="112" y2="48" stroke="#8b261d" stroke-width="3"/>
  <text x="160" y="53" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="700" letter-spacing="2" fill="#475569">${safeLabel.toUpperCase().slice(0, 18)}</text>
  <line x1="208" y1="48" x2="284" y2="48" stroke="#8b261d" stroke-width="3"/>
</svg>`;
  return ensureDefaultAsset(`default-logo-${safeSlug}.svg`, svg);
}

export function createDefaultPoster(deptLabel = 'HEAD FIELD', slug = 'general') {
  const safeLabel = String(deptLabel).replace(/[<>&"']/g, '');
  const safeSlug = String(slug).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="520" viewBox="0 0 600 520">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fdfaf3"/>
      <stop offset="100%" stop-color="#f7efe1"/>
    </linearGradient>
    <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#a8551f"/>
      <stop offset="100%" stop-color="#8b4215"/>
    </linearGradient>
  </defs>
  <rect width="600" height="520" fill="url(#bg)"/>
  <g opacity="0.92">
    <path d="M55,0 C65,45 45,75 20,90 C40,70 30,35 15,0 Z" fill="#d97706"/>
    <path d="M110,0 C125,40 150,55 170,45 C145,75 115,95 95,120 C95,85 85,55 60,40 C85,35 95,18 110,0 Z" fill="#f59e0b"/>
    <path d="M195,0 C205,35 225,50 245,45 C220,65 205,90 190,115 C180,85 165,65 140,55 C165,45 180,25 195,0 Z" fill="#b91c1c"/>
    <path d="M295,0 C315,50 350,65 375,55 C345,85 320,120 305,155 C295,115 275,85 235,70 C265,60 280,35 295,0 Z" fill="#ea580c"/>
    <path d="M405,0 C420,40 450,50 470,42 C445,70 425,95 415,122 C405,90 385,70 360,58 C385,48 395,25 405,0 Z" fill="#eab308"/>
    <path d="M510,0 C530,45 560,65 585,60 C555,88 535,115 520,145 C508,110 485,85 455,75 C482,62 495,35 510,0 Z" fill="#c2410c"/>
  </g>
  <text x="300" y="242" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="48" fill="#b45309">Happy</text>
  <text x="300" y="298" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="46" fill="#9a3412">Thanksgiving!</text>
  <rect x="0" y="455" width="600" height="65" fill="url(#ground)"/>
  <ellipse cx="145" cy="442" rx="46" ry="34" fill="#ea580c"/>
  <ellipse cx="145" cy="442" rx="28" ry="34" fill="#f97316"/>
  <path d="M142,408 C142,394 152,390 156,396" stroke="#65a30d" stroke-width="5" fill="none" stroke-linecap="round"/>
  <ellipse cx="205" cy="450" rx="34" ry="26" fill="#d97706"/>
  <ellipse cx="205" cy="450" rx="18" ry="26" fill="#f59e0b"/>
  <ellipse cx="472" cy="446" rx="38" ry="30" fill="#ca8a04"/>
  <ellipse cx="472" cy="446" rx="20" ry="30" fill="#eab308"/>
  <rect x="348" y="395" width="12" height="72" rx="3" fill="#78350f"/>
  <rect x="278" y="365" width="152" height="48" rx="6" fill="#92400e" stroke="#78350f" stroke-width="2"/>
  <text x="354" y="394" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="700" letter-spacing="2" fill="#fef3c7">${safeLabel.toUpperCase().slice(0, 14)}</text>
</svg>`;
  return ensureDefaultAsset(`default-poster-${safeSlug}.svg`, svg);
}

function getDefaultTemplates() {
  return [
    {
      id: 'dept-general',
      department: 'General',
      isDefault: true,
      subject: 'Happy Thanksgiving from Head Field!',
      greeting: 'Dear {{name}},',
      body: `As Thanksgiving approaches, we want to take a moment to express our sincere gratitude for the trust you place in Head Field.\n\nWe are thankful for the opportunity to serve and support our clients, and we greatly value the partnerships we have built throughout the year. We wish you and your loved ones a happy Thanksgiving filled with warmth, joy, and time spent with family and friends.`,
      logoUrl: createDefaultLogo('HEAD FIELD', 'general'),
      logoWidth: 210,
      posterUrl: createDefaultPoster('HEAD FIELD', 'general'),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'dept-sales',
      department: 'Sales',
      isDefault: false,
      subject: 'Happy Thanksgiving, {{name}} — From Head Field Sales',
      greeting: 'Dear {{name}},',
      body: `As Thanksgiving approaches, our Sales team wants to express our heartfelt gratitude for your continued partnership with Head Field.\n\nWorking alongside you has been a highlight of our year. Wishing you and your loved ones a joyful Thanksgiving filled with warmth, peace, and celebration.`,
      logoUrl: createDefaultLogo('SALES', 'sales'),
      logoWidth: 210,
      posterUrl: createDefaultPoster('SALES', 'sales'),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'dept-operations',
      department: 'Operations',
      isDefault: false,
      subject: 'Thank You & Happy Thanksgiving, {{name}}!',
      greeting: 'Dear {{name}},',
      body: `As Thanksgiving approaches, the Operations team at Head Field wants to thank you for your trust and collaboration throughout this year.\n\nWe deeply value our relationship and look forward to achieving even more together. Wishing you and your family a wonderful Thanksgiving holiday!`,
      logoUrl: createDefaultLogo('OPERATIONS', 'operations'),
      logoWidth: 210,
      posterUrl: createDefaultPoster('OPERATIONS', 'operations'),
      updatedAt: new Date().toISOString(),
    },
  ];
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

export function getTemplates() {
  const existing = readJson(TEMPLATES_FILE, null);
  if (Array.isArray(existing) && existing.length > 0) {
    // Migrate legacy data:image/svg+xml defaults to clean /uploads/ URLs if needed
    let changed = false;
    const migrated = existing.map((t) => {
      const slug = (t.department || 'general').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      let next = { ...t };
      if (t.logoUrl?.startsWith('data:image/svg+xml')) {
        next.logoUrl = createDefaultLogo(t.department || 'HEAD FIELD', slug);
        changed = true;
      }
      if (t.posterUrl?.startsWith('data:image/svg+xml')) {
        next.posterUrl = createDefaultPoster(t.department || 'HEAD FIELD', slug);
        changed = true;
      }
      return next;
    });
    if (changed) writeJson(TEMPLATES_FILE, migrated);
    return migrated;
  }
  const defaults = getDefaultTemplates();
  writeJson(TEMPLATES_FILE, defaults);
  return defaults;
}

export function saveTemplates(templates) {
  writeJson(TEMPLATES_FILE, templates);
  return templates;
}

export function getSmtpConfig() {
  const envDefaults = {
    mode: process.env.SMTP_USER ? 'smtp' : 'simulation',
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    fromName: process.env.SMTP_FROM_NAME || 'Head Field',
    fromEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || '',
    replyTo: process.env.SMTP_REPLY_TO || '',
    delayMs: Number(process.env.SMTP_DELAY_MS) || 150,
    concurrency: Number(process.env.SMTP_CONCURRENCY) || 2,
  };
  const saved = readJson(SMTP_FILE, null);
  return saved ? { ...envDefaults, ...saved } : envDefaults;
}

export function saveSmtpConfig(config) {
  const current = getSmtpConfig();
  const merged = {
    ...current,
    ...config,
    port: Number(config.port ?? current.port) || 587,
    delayMs: Math.max(0, Number(config.delayMs ?? current.delayMs) || 0),
    concurrency: Math.min(10, Math.max(1, Number(config.concurrency ?? current.concurrency) || 1)),
  };
  writeJson(SMTP_FILE, merged);
  return merged;
}

export function getCampaigns() {
  return readJson(CAMPAIGNS_FILE, []);
}

export function saveCampaigns(campaigns) {
  const trimmed = campaigns.slice(0, 30);
  writeJson(CAMPAIGNS_FILE, trimmed);
  return trimmed;
}
