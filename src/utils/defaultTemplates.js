const TEMPLATES_KEY = 'tg_templates_v3';

const BRAND_DEFS = [
  {
    name: 'Head Field',
    color: '#8b1e24',
    isDefault: true,
    focus: 'talent and workforce solutions',
  },
  {
    name: 'Glocal Edit',
    color: '#312e81',
    focus: 'editorial and content excellence',
  },
  {
    name: 'Glocal BPO',
    color: '#134e4a',
    focus: 'business operations',
  },
  {
    name: 'Glocal RPO',
    color: '#1e3a8a',
    focus: 'recruitment and hiring initiatives',
  },
  {
    name: 'Glocal Accounting',
    color: '#064e3b',
    focus: 'accounting and financial operations',
  },
  {
    name: 'HF Events',
    color: '#881337',
    focus: 'memorable events and experiences',
  },
  {
    name: 'Glocal Design',
    color: '#4c1d95',
    focus: 'creative design and branding',
  },
  {
    name: 'Glocal LPO',
    color: '#1e293b',
    focus: 'legal process support',
  },
  {
    name: 'Glocal Opportunities',
    color: '#0c4a6e',
    focus: 'career growth and global opportunities',
  },
  {
    name: 'Glocal Assist',
    color: '#164e63',
    focus: 'dedicated virtual assistance',
  },
  {
    name: 'Glocal Codes',
    color: '#1e3a8a',
    focus: 'software and technology engineering',
  },
  {
    name: 'Glocal Studio',
    color: '#701a75',
    focus: 'media production and digital studio work',
  },
  {
    name: 'HF Realtors',
    color: '#14532d',
    focus: 'real estate advisory and services',
  },
];

export const DEFAULT_TEMPLATES = BRAND_DEFS.map((b) => {
  const slug = b.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return {
    id: `brand-${slug}`,
    department: b.name,
    brandColor: b.color,
    isDefault: Boolean(b.isDefault),
    subject: `Happy Thanksgiving, {{name}} — From ${b.name}!`,
    greeting: 'Dear {{name}},',
    body: `As Thanksgiving approaches, we want to take a moment to express our sincere gratitude for the trust you place in ${b.name}.\n\nWe are thankful for the opportunity to support your ${b.focus}, and we greatly value the relationship we have built throughout the year. We wish you and your loved ones a happy Thanksgiving filled with warmth, joy, and time spent with family and friends.`,
    logoUrl: `/uploads/logo-${slug}.svg`,
    logoWidth: 220,
    posterUrl: `/uploads/poster-${slug}.svg`,
    updatedAt: '2026-11-26T00:00:00.000Z',
  };
});

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
