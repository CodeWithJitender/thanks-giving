import { MongoClient } from 'mongodb';

let clientPromise = globalThis._mongoClientPromise;

export function isMongoConfigured() {
  return Boolean(process.env.MONGODB_URI);
}

export async function getDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set');
  }
  if (!clientPromise) {
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 8000,
      tls: true,
      family: 4,
    });
    clientPromise = client.connect().catch((err) => {
      clientPromise = null;
      globalThis._mongoClientPromise = null;
      const msg = String(err?.message || err || '');
      if (msg.includes('alert number 80') || msg.includes('tlsv1 alert internal error')) {
        throw new Error(
          'MongoDB Atlas blocked the server IP (SSL alert 80). Open MongoDB Atlas -> Network Access -> Add IP Address -> Allow Access from Anywhere (0.0.0.0/0).'
        );
      }
      throw err;
    });
    globalThis._mongoClientPromise = clientPromise;
  }
  const client = await clientPromise;
  return client.db('thanksgiving');
}

const REAL_POSTER = '/uploads/happy-thanks-giving-1795678091178.jpg';

const BRAND_DEFS = [
  { name: 'Head Field', color: '#8b1e24', isDefault: true, focus: 'talent and workforce solutions', logoUrl: '/uploads/head-field-1795677971390.png' },
  { name: 'Glocal Edit', color: '#312e81', focus: 'editorial and content excellence', logoUrl: '/uploads/glocal-edit-1795685775166.png' },
  { name: 'Glocal BPO', color: '#134e4a', focus: 'business operations', logoUrl: '/uploads/glocal-bpo-1795684777464.png' },
  { name: 'Glocal RPO', color: '#1e3a8a', focus: 'recruitment and hiring initiatives', logoUrl: '/uploads/glocal-rpo-1795684786536.png' },
  { name: 'Glocal Accounting', color: '#064e3b', focus: 'accounting and financial operations', logoUrl: '/uploads/gloca-as-1795684795330.png' },
  { name: 'HF Events', color: '#881337', focus: 'memorable events and experiences', logoUrl: '/uploads/hf-events-1795684803975.png' },
  { name: 'Glocal Design', color: '#4c1d95', focus: 'creative design and branding', logoUrl: '/uploads/glocal-design-1795685718818.png' },
  { name: 'Glocal LPO', color: '#1e293b', focus: 'legal process support', logoUrl: '/uploads/glocal-lpo-1795684867568.png' },
  { name: 'Glocal Opportunities', color: '#0c4a6e', focus: 'career growth and global opportunities', logoUrl: '/uploads/glocal-opportunities-1795685655269.webp' },
  { name: 'Glocal Assist', color: '#164e63', focus: 'dedicated virtual assistance', logoUrl: '/uploads/glocal-assist-1795684875907.png' },
  { name: 'Glocal Codes', color: '#1e3a8a', focus: 'software and technology engineering', logoUrl: '/uploads/glocal-codes-1795684919489.png' },
  { name: 'Glocal Studio', color: '#701a75', focus: 'media production and digital studio work', logoUrl: '/uploads/glocal-studio-1795685561464.png' },
  { name: 'HF Realtors', color: '#14532d', focus: 'real estate advisory and services', logoUrl: '/uploads/hf-realtors-1795685868583.png' },
];

export const SEED_TEMPLATES = BRAND_DEFS.map((b, idx) => {
  const slug = b.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return {
    id: `brand-${slug}`,
    sortOrder: idx,
    department: b.name,
    brandColor: b.color,
    isDefault: Boolean(b.isDefault),
    fromName: b.name,
    fromEmail: '',
    subject: `Happy Thanksgiving, {{name}} — From ${b.name}!`,
    greeting: 'Dear {{name}},',
    body: `As Thanksgiving approaches, we want to take a moment to express our sincere gratitude for the trust you place in ${b.name}.\n\nWe are thankful for the opportunity to support your ${b.focus}, and we greatly value the relationship we have built throughout the year. We wish you and your loved ones a happy Thanksgiving filled with warmth, joy, and time spent with family and friends.`,
    logoUrl: b.logoUrl,
    logoWidth: 220,
    logoBgColor: '#ffffff',
    posterUrl: REAL_POSTER,
    updatedAt: '2026-11-26T00:00:00.000Z',
  };
});
