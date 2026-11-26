import { getDb, isMongoConfigured } from './_db.js';

export default async function handler(req, res) {
  if (!isMongoConfigured()) {
    return res.status(503).json({ error: 'MONGODB_URI is not configured' });
  }

  try {
    const db = await getDb();
    const col = db.collection('sent_history');

    if (req.method === 'GET') {
      const docs = await col.find({}).sort({ sentAt: -1 }).limit(2000).toArray();
      const history = docs.map(({ _id, ...rest }) => rest);
      return res.status(200).json({ history });
    }

    if (req.method === 'POST') {
      const { entries } = req.body || {};
      const list = Array.isArray(entries) ? entries : req.body?.email ? [req.body] : [];
      if (list.length === 0) {
        return res.status(400).json({ error: 'No sent history entries provided' });
      }

      const docs = list.map((item) => ({
        id: item.id || `hist_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        email: String(item.email || '').trim().toLowerCase(),
        displayEmail: String(item.email || '').trim(),
        name: String(item.name || '').trim(),
        department: String(item.department || '').trim(),
        templateUsed: String(item.templateUsed || '').trim(),
        subject: String(item.subject || '').trim(),
        logoUrl: item.logoUrl?.startsWith('data:') ? '' : item.logoUrl || '',
        posterUrl: item.posterUrl?.startsWith('data:') ? '' : item.posterUrl || '',
        sentAt: item.sentAt || new Date().toISOString(),
      }));

      await col.insertMany(docs);
      const all = await col.find({}).sort({ sentAt: -1 }).limit(2000).toArray();
      return res.status(201).json({ history: all.map(({ _id, ...rest }) => rest) });
    }

    if (req.method === 'DELETE') {
      const id = req.query?.id || req.body?.id;
      const email = req.query?.email || req.body?.email;
      if (id) {
        await col.deleteOne({ id });
      } else if (email) {
        await col.deleteMany({ email: String(email).trim().toLowerCase() });
      } else {
        await col.deleteMany({});
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'MongoDB sent_history error' });
  }
}
