import { getDb, isMongoConfigured } from './_db.js';

export default async function handler(req, res) {
  if (!isMongoConfigured()) {
    return res.status(503).json({ error: 'MONGODB_URI is not configured' });
  }

  try {
    const db = await getDb();
    const col = db.collection('sheets');

    if (req.method === 'GET') {
      const doc = await col.findOne({ key: 'current' });
      if (!doc) {
        return res.status(200).json({ sheet: null });
      }
      const { _id, key, ...sheet } = doc;
      return res.status(200).json({ sheet });
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const payload = req.body || {};
      const sheetDoc = {
        key: 'current',
        fileName: payload.fileName || '',
        headers: Array.isArray(payload.headers) ? payload.headers : [],
        rawRows: Array.isArray(payload.rawRows) ? payload.rawRows.slice(0, 5000) : [],
        mapping: payload.mapping || { nameCol: '', emailCol: '', deptCol: '' },
        rows: Array.isArray(payload.rows) ? payload.rows : [],
        selectedIds: Array.isArray(payload.selectedIds) ? payload.selectedIds : [],
        updatedAt: new Date().toISOString(),
      };
      await col.updateOne({ key: 'current' }, { $set: sheetDoc }, { upsert: true });
      const { key: _k, ...sheet } = sheetDoc;
      return res.status(200).json({ sheet });
    }

    if (req.method === 'DELETE') {
      await col.deleteOne({ key: 'current' });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'MongoDB sheet error' });
  }
}
