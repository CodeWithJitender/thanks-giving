const TEMPLATES_KEY = 'tg_templates_v2';
const SMTP_KEY = 'tg_smtp_v2';

export const DEFAULT_TEMPLATES = [
  {
    id: 'dept-general',
    department: 'General',
    isDefault: true,
    subject: 'Happy Thanksgiving from Head Field!',
    greeting: 'Dear {{name}},',
    body: `As Thanksgiving approaches, we want to take a moment to express our sincere gratitude for the trust you place in Head Field.\n\nWe are thankful for the opportunity to serve and advocate for our clients, and we greatly value the relationships we have built throughout the year. We wish you and your loved ones a happy Thanksgiving filled with warmth, joy, and time spent with family and friends.`,
    logoUrl: '/uploads/default-logo-general.svg',
    logoWidth: 210,
    posterUrl: '/uploads/default-poster-general.svg',
    updatedAt: '2026-11-26T00:00:00.000Z',
  },
  {
    id: 'dept-sales',
    department: 'Sales',
    isDefault: false,
    subject: 'Happy Thanksgiving, {{name}} — Thank You for Partnering With Us!',
    greeting: 'Dear {{name}},',
    body: `As Thanksgiving approaches, our Sales & Partnerships team wants to express our sincere gratitude for the trust you place in Head Field.\n\nWe are thankful for the opportunity to collaborate and grow alongside you, and we deeply value our partnership throughout the year. Wishing you and your loved ones a joyful Thanksgiving filled with warmth, happiness, and celebration.`,
    logoUrl: '/uploads/default-logo-sales.svg',
    logoWidth: 210,
    posterUrl: '/uploads/default-poster-sales.svg',
    updatedAt: '2026-11-26T00:00:00.000Z',
  },
  {
    id: 'dept-operations',
    department: 'Operations',
    isDefault: false,
    subject: 'Warm Thanksgiving Wishes, {{name}} — From Operations',
    greeting: 'Dear {{name}},',
    body: `As Thanksgiving approaches, our Client Operations team wants to take a moment to thank you for your continued confidence in Head Field.\n\nWe are truly grateful for the chance to support your business every day and value the relationships we share. May your Thanksgiving be filled with peace, joy, and memorable moments with family and friends.`,
    logoUrl: '/uploads/default-logo-operations.svg',
    logoWidth: 210,
    posterUrl: '/uploads/default-poster-operations.svg',
    updatedAt: '2026-11-26T00:00:00.000Z',
  },
];

export const DEFAULT_SMTP_CONFIG = {
  mode: 'simulation',
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  user: '',
  pass: '',
  fromName: 'Head Field',
  fromEmail: '',
  replyTo: '',
  delayMs: 150,
};

export function loadStoredTemplates() {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // Ignore storage errors
  }
  saveStoredTemplates(DEFAULT_TEMPLATES);
  return DEFAULT_TEMPLATES;
}

export function saveStoredTemplates(templates) {
  try {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
  } catch {
    // Ignore quota errors
  }
  return templates;
}

export function loadStoredSmtp() {
  try {
    const raw = localStorage.getItem(SMTP_KEY);
    if (raw) {
      return { ...DEFAULT_SMTP_CONFIG, ...JSON.parse(raw) };
    }
  } catch {
    // Ignore storage errors
  }
  return DEFAULT_SMTP_CONFIG;
}

export function saveStoredSmtp(config) {
  const merged = {
    ...DEFAULT_SMTP_CONFIG,
    ...config,
    port: Number(config.port ?? DEFAULT_SMTP_CONFIG.port) || 587,
    delayMs: Math.max(0, Number(config.delayMs ?? DEFAULT_SMTP_CONFIG.delayMs) || 0),
  };
  try {
    localStorage.setItem(SMTP_KEY, JSON.stringify(merged));
  } catch {
    // Ignore quota errors
  }
  return merged;
}
