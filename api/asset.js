import fs from 'fs';
import path from 'path';
import { getDb, isMongoConfigured } from './_db.js';

const EXT_MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawName = req.query?.name || '';
  const safeName = path.basename(String(rawName));
  if (!safeName) {
    return res.status(400).json({ error: 'Asset name is required' });
  }

  // 1. Check local public/uploads or server/uploads first
  for (const dir of [
    path.join(process.cwd(), 'public', 'uploads'),
    path.join(process.cwd(), 'server', 'uploads'),
  ]) {
    const filePath = path.join(dir, safeName);
    if (fs.existsSync(filePath)) {
      const ext = path.extname(safeName).toLowerCase();
      res.setHeader('Content-Type', EXT_MIME[ext] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.status(200).send(fs.readFileSync(filePath));
    }
  }

  // 2. Fallback to MongoDB `assets` collection
  if (isMongoConfigured()) {
    try {
      const db = await getDb();
      const doc = await db.collection('assets').findOne({ name: safeName });
      if (doc?.dataBase64) {
        const buf = Buffer.from(doc.dataBase64, 'base64');
        res.setHeader('Content-Type', doc.mime || 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return res.status(200).send(buf);
      }
    } catch {
      // Ignore DB lookup error
    }
  }

  return res.status(404).json({ error: 'Asset not found' });
}
