import { getDb, isMongoConfigured } from './_db.js';

export default async function handler(req, res) {
  if (!isMongoConfigured()) {
    return res.status(503).json({ error: 'MONGODB_URI is not configured' });
  }

  try {
    const db = await getDb();
    const col = db.collection('campaigns');

    if (req.method === 'GET') {
      const docs = await col.find({}).sort({ updatedAt: -1 }).limit(20).toArray();
      const campaigns = docs.map(({ _id, ...rest }) => rest);
      return res.status(200).json({ campaigns });
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const payload = req.body || {};
      if (!payload.id) {
        return res.status(400).json({ error: 'Campaign id is required' });
      }
      const { _id, ...doc } = payload;
      doc.updatedAt = new Date().toISOString();
      if (!doc.createdAt) doc.createdAt = doc.updatedAt;

      await col.updateOne({ id: doc.id }, { $set: doc }, { upsert: true });
      return res.status(200).json({ campaign: doc });
    }

    if (req.method === 'DELETE') {
      const id = req.query?.id || req.body?.id;
      if (id) {
        await col.deleteOne({ id });
      } else {
        await col.deleteMany({});
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'MongoDB campaigns error' });
  }
}
