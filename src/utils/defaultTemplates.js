import { formatClientName } from './spreadsheet';

const TEMPLATES_KEY = 'tg_templates_v3';
const SHEET_KEY = 'tg_sheet_v1';
const CAMPAIGNS_KEY = 'tg_campaigns_v1';
const UI_KEY = 'tg_ui_v1';

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

export const EMPTY_SHEET_STATE = {
  fileName: '',
  headers: [],
  rawRows: [],
  mapping: { nameCol: '', emailCol: '', deptCol: '' },
  rows: [],
  selectedIds: new Set(),
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

export function loadStoredSheetState() {
  try {
    const raw = localStorage.getItem(SHEET_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.rows)) {
        return {
          ...EMPTY_SHEET_STATE,
          ...parsed,
          rows: parsed.rows.map((r) => ({ ...r, name: formatClientName(r.name) })),
          selectedIds: new Set(Array.isArray(parsed.selectedIds) ? parsed.selectedIds : []),
        };
      }
    }
  } catch {
    // Ignore storage errors
  }
  return EMPTY_SHEET_STATE;
}

export function saveStoredSheetState(sheetState) {
  const serializable = {
    fileName: sheetState.fileName || '',
    headers: sheetState.headers || [],
    rawRows: sheetState.rawRows || [],
    mapping: sheetState.mapping || { nameCol: '', emailCol: '', deptCol: '' },
    rows: (sheetState.rows || []).map(({ raw: _raw, ...rest }) => rest),
    selectedIds: Array.from(sheetState.selectedIds || []),
  };
  try {
    localStorage.setItem(SHEET_KEY, JSON.stringify(serializable));
  } catch {
    // Retry without rawRows if spreadsheet is very large
    try {
      localStorage.setItem(
        SHEET_KEY,
        JSON.stringify({ ...serializable, rawRows: [] })
      );
    } catch {
      // Ignore quota errors
    }
  }
}

export function clearStoredSheetState() {
  try {
    localStorage.removeItem(SHEET_KEY);
  } catch {
    // Ignore
  }
  return EMPTY_SHEET_STATE;
}

export function loadStoredCampaign() {
  try {
    const raw = localStorage.getItem(CAMPAIGNS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    // Ignore storage errors
  }
  return null;
}

export function saveStoredCampaign(campaign) {
  if (!campaign) {
    try {
      localStorage.removeItem(CAMPAIGNS_KEY);
    } catch {
      // Ignore
    }
    return;
  }
  try {
    // Strip heavy inline data URLs if any so delivery log persists cleanly
    const compact = {
      ...campaign,
      effectiveTemplate: campaign.effectiveTemplate
        ? {
            ...campaign.effectiveTemplate,
            logoUrl: campaign.effectiveTemplate.logoUrl?.startsWith('data:')
              ? ''
              : campaign.effectiveTemplate.logoUrl,
            posterUrl: campaign.effectiveTemplate.posterUrl?.startsWith('data:')
              ? ''
              : campaign.effectiveTemplate.posterUrl,
          }
        : null,
    };
    localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(compact));
  } catch {
    // Ignore quota errors
  }
}

export function loadStoredUiPrefs() {
  try {
    const raw = localStorage.getItem(UI_KEY);
    if (raw) return JSON.parse(raw) || {};
  } catch {
    // Ignore
  }
  return {};
}

export function saveStoredUiPrefs(patch) {
  try {
    const current = loadStoredUiPrefs();
    localStorage.setItem(UI_KEY, JSON.stringify({ ...current, ...patch }));
  } catch {
    // Ignore
  }
}
