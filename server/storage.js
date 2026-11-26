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

function writeAsset(filename, svgContent) {
  const filePath = path.join(UPLOADS_DIR, filename);
  fs.writeFileSync(filePath, svgContent, 'utf8');
  return `/uploads/${filename}`;
}

export function createDefaultLogo(deptLabel = 'LLP', slug = 'general', brandColor = '#1e293b', barColor = '#7f1d1d') {
  const safeLabel = String(deptLabel).replace(/[<>&"']/g, '').toUpperCase().slice(0, 18);
  const safeSlug = String(slug).toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'general';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="78" viewBox="0 0 360 78">
  <rect width="360" height="78" fill="#ffffff"/>
  <text x="180" y="38" text-anchor="middle" font-family="'Helvetica Neue', Arial, sans-serif" font-size="30" font-weight="600" letter-spacing="5" fill="${brandColor}">HEAD FIELD</text>
  <line x1="34" y1="54" x2="120" y2="54" stroke="${barColor}" stroke-width="3.5"/>
  <text x="180" y="59" text-anchor="middle" font-family="'Helvetica Neue', Arial, sans-serif" font-size="11" font-weight="700" letter-spacing="2" fill="#334155">${safeLabel}</text>
  <line x1="240" y1="54" x2="326" y2="54" stroke="${barColor}" stroke-width="3.5"/>
</svg>`;
  return writeAsset(`default-logo-${safeSlug}.svg`, svg);
}

export function createDefaultPoster(
  deptLabel = 'HEAD FIELD',
  slug = 'general',
  palette = {
    bgTop: '#fdfbf6',
    bgBottom: '#f8f0e3',
    ground: '#a25016',
    truckBody: '#ea6c3c',
    truckShade: '#d45526',
    accent: '#9a3412',
    scriptColor: '#b57b24',
  }
) {
  const safeLabel = String(deptLabel).replace(/[<>&"']/g, '').toUpperCase().slice(0, 16);
  const safeSlug = String(slug).toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'general';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="540" viewBox="0 0 600 540">
  <defs>
    <linearGradient id="bg-${safeSlug}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${palette.bgTop}"/>
      <stop offset="100%" stop-color="${palette.bgBottom}"/>
    </linearGradient>
  </defs>
  <rect width="600" height="540" fill="url(#bg-${safeSlug})"/>

  <!-- Top Autumn Leaves Canopy -->
  <g opacity="0.92">
    <g transform="translate(55,34) rotate(-18)">
      <ellipse cx="0" cy="0" rx="22" ry="42" fill="#b91c1c"/>
      <ellipse cx="-18" cy="10" rx="16" ry="26" transform="rotate(-35)" fill="#b91c1c"/>
      <ellipse cx="18" cy="10" rx="16" ry="26" transform="rotate(35)" fill="#b91c1c"/>
    </g>
    <g transform="translate(150,24) rotate(12)">
      <ellipse cx="0" cy="0" rx="26" ry="48" fill="#f59e0b"/>
      <ellipse cx="-20" cy="12" rx="18" ry="28" transform="rotate(-35)" fill="#f59e0b"/>
      <ellipse cx="20" cy="12" rx="18" ry="28" transform="rotate(35)" fill="#f59e0b"/>
    </g>
    <g transform="translate(245,18) rotate(-10)">
      <ellipse cx="0" cy="0" rx="20" ry="38" fill="#991b1b"/>
      <ellipse cx="-15" cy="10" rx="14" ry="22" transform="rotate(-35)" fill="#991b1b"/>
      <ellipse cx="15" cy="10" rx="14" ry="22" transform="rotate(35)" fill="#991b1b"/>
    </g>
    <g transform="translate(345,28) rotate(16)">
      <ellipse cx="0" cy="0" rx="26" ry="48" fill="#d97706"/>
      <ellipse cx="-20" cy="12" rx="18" ry="28" transform="rotate(-35)" fill="#d97706"/>
      <ellipse cx="20" cy="12" rx="18" ry="28" transform="rotate(35)" fill="#d97706"/>
    </g>
    <g transform="translate(445,20) rotate(-14)">
      <ellipse cx="0" cy="0" rx="22" ry="42" fill="#eab308"/>
      <ellipse cx="-18" cy="10" rx="15" ry="24" transform="rotate(-35)" fill="#eab308"/>
      <ellipse cx="18" cy="10" rx="15" ry="24" transform="rotate(35)" fill="#eab308"/>
    </g>
    <g transform="translate(538,34) rotate(22)">
      <ellipse cx="0" cy="0" rx="24" ry="44" fill="#c2410c"/>
      <ellipse cx="-18" cy="10" rx="16" ry="24" transform="rotate(-35)" fill="#c2410c"/>
      <ellipse cx="18" cy="10" rx="16" ry="24" transform="rotate(35)" fill="#c2410c"/>
    </g>
    <circle cx="96" cy="125" r="4.5" fill="#d97706" opacity="0.6"/>
    <circle cx="495" cy="135" r="4.5" fill="#b91c1c" opacity="0.55"/>
    <circle cx="290" cy="118" r="4" fill="#eab308" opacity="0.7"/>
  </g>

  <!-- Script Greeting (stacked cleanly with zero overlap) -->
  <g transform="rotate(-4 300 245)">
    <text x="300" y="218" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="44" fill="${palette.scriptColor}">Happy</text>
    <text x="300" y="274" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="48" fill="${palette.scriptColor}">Thanksgiving!</text>
  </g>

  <!-- Ground Strip -->
  <rect x="0" y="476" width="600" height="64" fill="${palette.ground}"/>

  <!-- Pumpkins in Truck Bed -->
  <ellipse cx="118" cy="402" rx="28" ry="22" fill="#92400e"/>
  <ellipse cx="164" cy="396" rx="34" ry="26" fill="#d97706"/>
  <ellipse cx="210" cy="404" rx="24" ry="19" fill="#64748b"/>

  <!-- Vintage Harvest Truck -->
  <rect x="74" y="416" width="166" height="58" rx="8" fill="${palette.truckBody}"/>
  <path d="M236,374 L305,374 L334,418 L374,424 C384,426 390,434 390,444 L390,474 L236,474 Z" fill="${palette.truckBody}"/>
  <path d="M250,384 L298,384 L320,418 L250,418 Z" fill="#fef3c7"/>
  <rect x="74" y="456" width="316" height="18" rx="4" fill="${palette.truckShade}"/>

  <!-- Truck Wheels -->
  <circle cx="144" cy="478" r="26" fill="#1e293b"/>
  <circle cx="144" cy="478" r="14" fill="#f8fafc"/>
  <circle cx="144" cy="478" r="6" fill="#334155"/>
  <circle cx="332" cy="478" r="26" fill="#1e293b"/>
  <circle cx="332" cy="478" r="14" fill="#f8fafc"/>
  <circle cx="332" cy="478" r="6" fill="#334155"/>

  <!-- Wooden Brand Sign & Side Pumpkins -->
  <rect x="444" y="388" width="14" height="92" rx="3" fill="#78350f"/>
  <rect x="372" y="380" width="156" height="46" rx="6" fill="#9a6b3b" stroke="#78350f" stroke-width="2"/>
  <text x="450" y="408" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="700" letter-spacing="2" fill="#ffffff">${safeLabel}</text>

  <ellipse cx="412" cy="466" rx="22" ry="18" fill="#eab308"/>
  <ellipse cx="496" cy="458" rx="30" ry="30" fill="#f59e0b"/>
  <path d="M494,428 C494,418 500,414 504,418" stroke="#65a30d" stroke-width="4" fill="none" stroke-linecap="round"/>
</svg>`;
  return writeAsset(`default-poster-${safeSlug}.svg`, svg);
}

function getDefaultTemplates() {
  return [
    {
      id: 'dept-general',
      department: 'General',
      isDefault: true,
      subject: 'Happy Thanksgiving from Head Field!',
      greeting: 'Dear {{name}},',
      body: `As Thanksgiving approaches, we want to take a moment to express our sincere gratitude for the trust you place in Head Field.\n\nWe are thankful for the opportunity to serve and advocate for our clients, and we greatly value the relationships we have built throughout the year. We wish you and your loved ones a happy Thanksgiving filled with warmth, joy, and time spent with family and friends.`,
      logoUrl: createDefaultLogo('GENERAL', 'general', '#1e293b', '#7f1d1d'),
      logoWidth: 210,
      posterUrl: createDefaultPoster('HEAD FIELD', 'general', {
        bgTop: '#fdfbf6',
        bgBottom: '#f8f0e3',
        ground: '#a25016',
        truckBody: '#ea6c3c',
        truckShade: '#d45526',
        accent: '#9a3412',
        scriptColor: '#b57b24',
      }),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'dept-sales',
      department: 'Sales',
      isDefault: false,
      subject: 'Happy Thanksgiving, {{name}} — Thank You for Partnering With Us!',
      greeting: 'Dear {{name}},',
      body: `As Thanksgiving approaches, our Sales & Partnerships team wants to express our sincere gratitude for the trust you place in Head Field.\n\nWe are thankful for the opportunity to collaborate and grow alongside you, and we deeply value our partnership throughout the year. Wishing you and your loved ones a joyful Thanksgiving filled with warmth, happiness, and celebration.`,
      logoUrl: createDefaultLogo('SALES', 'sales', '#0f172a', '#b45309'),
      logoWidth: 210,
      posterUrl: createDefaultPoster('SALES TEAM', 'sales', {
        bgTop: '#fffdf7',
        bgBottom: '#fef3c7',
        ground: '#92400e',
        truckBody: '#d97706',
        truckShade: '#b45309',
        accent: '#78350f',
        scriptColor: '#9a3412',
      }),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'dept-operations',
      department: 'Operations',
      isDefault: false,
      subject: 'Warm Thanksgiving Wishes, {{name}} — From Operations',
      greeting: 'Dear {{name}},',
      body: `As Thanksgiving approaches, our Client Operations team wants to take a moment to thank you for your continued confidence in Head Field.\n\nWe are truly grateful for the chance to support your business every day and value the relationships we share. May your Thanksgiving be filled with peace, joy, and memorable moments with family and friends.`,
      logoUrl: createDefaultLogo('OPERATIONS', 'operations', '#1e293b', '#991b1b'),
      logoWidth: 210,
      posterUrl: createDefaultPoster('OPERATIONS', 'operations', {
        bgTop: '#fefaf6',
        bgBottom: '#fde8d7',
        ground: '#7c2d12',
        truckBody: '#c2410c',
        truckShade: '#9a3412',
        accent: '#7c2d12',
        scriptColor: '#a16207',
      }),
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
    return existing;
  }
  const defaults = getDefaultTemplates();
  writeJson(TEMPLATES_FILE, defaults);
  return defaults;
}

export function resetDummyTemplates() {
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
