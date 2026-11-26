import { getDb, isMongoConfigured } from './_db.js';

const DEFAULT_REPO = 'CodeWithJitender/thanks-giving';
const DEFAULT_BRANCH = 'main';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { filename = 'image.png', dataUrl } = req.body || {};
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    return res.status(400).json({ error: 'Invalid image payload' });
  }

  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return res.status(400).json({ error: 'Invalid base64 image data' });
  }

  const mime = match[1];
  const base64Content = match[2];
  const extFromMime = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
  }[mime];

  const rawBase =
    filename
      .replace(/\.[^.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .slice(0, 40) || 'image';

  const ext = extFromMime || '.png';
  const savedFilename = `${rawBase}-${Date.now()}${ext}`;

  let githubCommitted = false;
  let githubError = null;

  // 1. Commit directly to GitHub public/uploads/<filename> so `git fetch` / `git pull` downloads it locally
  const githubToken = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO || DEFAULT_REPO;
  const branch = process.env.GITHUB_BRANCH || DEFAULT_BRANCH;

  if (githubToken) {
    try {
      const ghRes = await fetch(
        `https://api.github.com/repos/${repo}/contents/public/uploads/${encodeURIComponent(savedFilename)}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'User-Agent': 'thanksgiving-bulk-emailer',
          },
          body: JSON.stringify({
            message: `Upload brand asset ${savedFilename}`,
            content: base64Content,
            branch,
          }),
        }
      );
      if (ghRes.ok) {
        githubCommitted = true;
      } else {
        const errBody = await ghRes.json().catch(() => ({}));
        githubError = errBody.message || `GitHub API error (${ghRes.status})`;
      }
    } catch (err) {
      githubError = err?.message || 'GitHub upload failed';
    }
  }

  // 2. Also persist in MongoDB `assets` collection so the image renders immediately before Vercel finishes rebuilding
  let mongoSaved = false;
  if (isMongoConfigured()) {
    try {
      const db = await getDb();
      await db.collection('assets').updateOne(
        { name: savedFilename },
        {
          $set: {
            name: savedFilename,
            mime,
            dataBase64: base64Content,
            size: Buffer.from(base64Content, 'base64').length,
            updatedAt: new Date().toISOString(),
          },
        },
        { upsert: true }
      );
      mongoSaved = true;
    } catch {
      // Non-fatal if MongoDB fails
    }
  }

  if (!githubCommitted && !mongoSaved) {
    return res.status(503).json({
      error:
        'Online file save is not configured. Add GITHUB_TOKEN (and MONGODB_URI) to Vercel Environment Variables.',
    });
  }

  // Use /api/asset?name=... when not yet in static build (or /uploads/<file> if githubCommitted & built)
  const url = mongoSaved ? `/api/asset?name=${encodeURIComponent(savedFilename)}` : `/uploads/${savedFilename}`;

  return res.status(201).json({
    filename: savedFilename,
    url,
    publicPath: `/uploads/${savedFilename}`,
    githubCommitted,
    githubError,
    mongoSaved,
  });
}
