import fs from 'fs';
import path from 'path';
import { getDb, isMongoConfigured, SEED_TEMPLATES } from './_db.js';

function cleanDocs(arr = []) {
  return arr.map(({ _id, ...rest }) => rest);
}

async function listUploadedAssets(db) {
  const dirs = [
    path.join(process.cwd(), 'public', 'uploads'),
    path.join(process.cwd(), 'server', 'uploads'),
  ];
  const seen = new Map();
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (seen.has(name)) continue;
      const stat = fs.statSync(path.join(dir, name));
      if (stat.isFile()) {
        seen.set(name, {
          name,
          url: `/uploads/${name}`,
          size: stat.size,
          modifiedAt: stat.mtime.toISOString(),
        });
      }
    }
  }
  try {
    const dbAssets = await db
      .collection('assets')
      .find({}, { projection: { name: 1, size: 1, updatedAt: 1 } })
      .toArray();
    for (const a of dbAssets) {
      if (!a?.name || seen.has(a.name)) continue;
      seen.set(a.name, {
        name: a.name,
        url: `/api/asset?name=${encodeURIComponent(a.name)}`,
        size: a.size || 0,
        modifiedAt: a.updatedAt || '',
      });
    }
  } catch {
    // Ignore DB asset read failure
  }
  return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export default async function handler(req, res) {
  if (!isMongoConfigured()) {
    return res.status(503).json({ error: 'MONGODB_URI is not configured' });
  }

  try {
    const db = await getDb();
    const templatesCol = db.collection('templates');
    const sheetsCol = db.collection('sheets');
    const campaignsCol = db.collection('campaigns');

    if (req.method === 'GET') {
      let templates = await templatesCol.find({}).sort({ sortOrder: 1, updatedAt: 1 }).toArray();
      if (templates.length === 0) {
        const meta = await db.collection('meta').findOne({ key: 'templates_seeded' });
        if (!meta) {
          await templatesCol.insertMany(SEED_TEMPLATES.map((t) => ({ ...t })));
          await db
            .collection('meta')
            .updateOne({ key: 'templates_seeded' }, { $set: { key: 'templates_seeded', done: true } }, { upsert: true });
          templates = SEED_TEMPLATES;
        }
      }
      const sheets = await sheetsCol.find({}).sort({ updatedAt: -1 }).toArray();
      const campaigns = await campaignsCol.find({}).sort({ updatedAt: -1 }).toArray();
      const assets = await listUploadedAssets(db);

      return res.status(200).json({
        templates: cleanDocs(templates),
        sheets: cleanDocs(sheets),
        campaigns: cleanDocs(campaigns),
        assets,
        exportedAt: new Date().toISOString(),
      });
    }

    // Import full backup or bulk documents
    if (req.method === 'POST') {
      const { mode = 'merge', templates, sheets, campaigns } = req.body || {};
      const stats = { templates: 0, sheets: 0, campaigns: 0 };

      if (Array.isArray(templates)) {
        if (mode === 'replace') await templatesCol.deleteMany({});
        for (const t of templates) {
          if (!t?.id) continue;
          const { _id, ...doc } = t;
          doc.updatedAt = new Date().toISOString();
          await templatesCol.updateOne({ id: doc.id }, { $set: doc }, { upsert: true });
          stats.templates++;
        }
      }

      if (Array.isArray(sheets)) {
        if (mode === 'replace') await sheetsCol.deleteMany({});
        for (const s of sheets) {
          const { _id, ...doc } = s || {};
          const key = doc.key || 'current';
          doc.key = key;
          doc.updatedAt = new Date().toISOString();
          await sheetsCol.updateOne({ key }, { $set: doc }, { upsert: true });
          stats.sheets++;
        }
      }

      if (Array.isArray(campaigns)) {
        if (mode === 'replace') await campaignsCol.deleteMany({});
        for (const c of campaigns) {
          if (!c?.id) continue;
          const { _id, ...doc } = c;
          doc.updatedAt = doc.updatedAt || new Date().toISOString();
          await campaignsCol.updateOne({ id: doc.id }, { $set: doc }, { upsert: true });
          stats.campaigns++;
        }
      }

      return res.status(200).json({ ok: true, imported: stats });
    }

    // Update or manipulate a specific document in a collection
    if (req.method === 'PUT') {
      const { collection, document } = req.body || {};
      if (!collection || !document) {
        return res.status(400).json({ error: 'collection and document are required' });
      }
      const { _id, ...doc } = document;
      doc.updatedAt = new Date().toISOString();

      if (collection === 'templates') {
        if (!doc.id) doc.id = `brand-${Date.now()}`;
        if (doc.isDefault) {
          await templatesCol.updateMany({ id: { $ne: doc.id } }, { $set: { isDefault: false } });
        }
        await templatesCol.updateOne({ id: doc.id }, { $set: doc }, { upsert: true });
        return res.status(200).json({ ok: true, document: doc });
      }

      if (collection === 'sheets') {
        const key = doc.key || 'current';
        doc.key = key;
        await sheetsCol.updateOne({ key }, { $set: doc }, { upsert: true });
        return res.status(200).json({ ok: true, document: doc });
      }

      if (collection === 'campaigns') {
        if (!doc.id) doc.id = `cmp_${Date.now()}`;
        await campaignsCol.updateOne({ id: doc.id }, { $set: doc }, { upsert: true });
        return res.status(200).json({ ok: true, document: doc });
      }

      return res.status(400).json({ error: 'Unsupported collection' });
    }

    // Delete a document or uploaded asset by collection + id/key/filename
    if (req.method === 'DELETE') {
      const collection = req.query?.collection || req.body?.collection;
      const id = req.query?.id || req.body?.id;

      if (collection === 'templates') {
        await db
          .collection('meta')
          .updateOne({ key: 'templates_seeded' }, { $set: { key: 'templates_seeded', done: true } }, { upsert: true });
        await templatesCol.deleteOne({ id });
        const remaining = await templatesCol.find({}).sort({ sortOrder: 1, updatedAt: 1 }).toArray();
        if (remaining.length > 0 && !remaining.some((t) => t.isDefault)) {
          await templatesCol.updateOne({ id: remaining[0].id }, { $set: { isDefault: true } });
        }
        return res.status(200).json({ ok: true });
      }

      if (collection === 'assets') {
        const safeName = path.basename(String(id || ''));
        if (!safeName) {
          return res.status(400).json({ error: 'Asset filename is required' });
        }

        // Delete from MongoDB assets collection
        await db.collection('assets').deleteOne({ name: safeName });

        // Delete from local public/uploads & server/uploads if present
        for (const dir of [
          path.join(process.cwd(), 'public', 'uploads'),
          path.join(process.cwd(), 'server', 'uploads'),
          path.join(process.cwd(), 'dist', 'uploads'),
        ]) {
          const fp = path.join(dir, safeName);
          if (fs.existsSync(fp)) {
            fs.unlinkSync(fp);
          }
        }

        // Also delete from GitHub public/uploads if GITHUB_TOKEN is configured (for Vercel online deletes)
        const githubToken = process.env.GITHUB_TOKEN;
        if (githubToken) {
          const repo = process.env.GITHUB_REPO || 'CodeWithJitender/thanks-giving';
          const branch = process.env.GITHUB_BRANCH || 'main';
          try {
            const getRes = await fetch(
              `https://api.github.com/repos/${repo}/contents/public/uploads/${encodeURIComponent(safeName)}?ref=${branch}`,
              {
                headers: {
                  Authorization: `Bearer ${githubToken}`,
                  Accept: 'application/vnd.github+json',
                  'User-Agent': 'thanksgiving-bulk-emailer',
                },
              }
            );
            if (getRes.ok) {
              const info = await getRes.json();
              if (info?.sha) {
                await fetch(
                  `https://api.github.com/repos/${repo}/contents/public/uploads/${encodeURIComponent(safeName)}`,
                  {
                    method: 'DELETE',
                    headers: {
                      Authorization: `Bearer ${githubToken}`,
                      Accept: 'application/vnd.github+json',
                      'Content-Type': 'application/json',
                      'User-Agent': 'thanksgiving-bulk-emailer',
                    },
                    body: JSON.stringify({
                      message: `Delete brand asset ${safeName}`,
                      sha: info.sha,
                      branch,
                    }),
                  }
                );
              }
            }
          } catch {
            // Non-fatal
          }
        }

        return res.status(200).json({ ok: true });
      }

      if (collection === 'sheets') {
        await sheetsCol.deleteOne({ key: id || 'current' });
        return res.status(200).json({ ok: true });
      }

      if (collection === 'campaigns') {
        await campaignsCol.deleteOne({ id });
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ error: 'Unsupported collection' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Admin API error' });
  }
}
