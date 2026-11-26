import { getDb, isMongoConfigured, SEED_TEMPLATES } from './_db.js';

function cleanDoc(doc) {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  return rest;
}

export default async function handler(req, res) {
  if (!isMongoConfigured()) {
    return res.status(503).json({ error: 'MONGODB_URI is not configured' });
  }

  try {
    const db = await getDb();
    const col = db.collection('templates');

    if (req.method === 'GET') {
      let docs = await col.find({}).sort({ sortOrder: 1, updatedAt: 1 }).toArray();
      let seeded = false;
      if (docs.length === 0) {
        const meta = await db.collection('meta').findOne({ key: 'templates_seeded' });
        if (!meta) {
          await col.insertMany(SEED_TEMPLATES.map((t) => ({ ...t })));
          await db
            .collection('meta')
            .updateOne({ key: 'templates_seeded' }, { $set: { key: 'templates_seeded', done: true } }, { upsert: true });
          docs = SEED_TEMPLATES;
          seeded = true;
        }
      }
      return res.status(200).json({ templates: docs.map(cleanDoc), seeded });
    }

    if (req.method === 'POST') {
      const payload = req.body || {};

      // Optional reset to all 13 default brand templates
      if (payload.action === 'reset') {
        await col.deleteMany({});
        await col.insertMany(SEED_TEMPLATES.map((t) => ({ ...t })));
        return res.status(200).json({ templates: SEED_TEMPLATES });
      }

      const dept = (payload.department || 'New Brand').trim();
      const count = await col.countDocuments();
      const newTemplate = {
        id: payload.id || `brand-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sortOrder: count,
        department: dept,
        brandColor: payload.brandColor || '#d97706',
        isDefault: Boolean(payload.isDefault),
        fromName: payload.fromName || dept,
        fromEmail: payload.fromEmail || '',
        subject: payload.subject || `Happy Thanksgiving, {{name}} — From ${dept}!`,
        greeting: payload.greeting || 'Dear {{name}},',
        body:
          payload.body ||
          `As Thanksgiving approaches, we want to take a moment to express our sincere gratitude for the trust you place in ${dept}.\n\nWe wish you and your loved ones a happy Thanksgiving filled with warmth, joy, and time spent with family and friends.`,
        logoUrl: payload.logoUrl || SEED_TEMPLATES[0].logoUrl,
        logoWidth: Number(payload.logoWidth) || 220,
        logoBgColor: payload.logoBgColor || '#ffffff',
        posterUrl: payload.posterUrl || SEED_TEMPLATES[0].posterUrl,
        updatedAt: new Date().toISOString(),
      };

      if (newTemplate.isDefault) {
        await col.updateMany({}, { $set: { isDefault: false } });
      }
      await col.insertOne({ ...newTemplate });
      const docs = await col.find({}).sort({ sortOrder: 1, updatedAt: 1 }).toArray();
      return res.status(201).json({ template: newTemplate, templates: docs.map(cleanDoc) });
    }

    if (req.method === 'PUT') {
      const payload = req.body || {};
      const id = req.params?.id || payload.id || req.query?.id;
      if (!id) {
        return res.status(400).json({ error: 'Template id is required' });
      }

      const { _id, ...updateFields } = payload;
      updateFields.id = id;
      updateFields.updatedAt = new Date().toISOString();

      if (updateFields.isDefault) {
        await col.updateMany({ id: { $ne: id } }, { $set: { isDefault: false } });
      }

      await col.updateOne({ id }, { $set: updateFields }, { upsert: true });
      const docs = await col.find({}).sort({ sortOrder: 1, updatedAt: 1 }).toArray();
      const updated = docs.find((d) => d.id === id);
      return res.status(200).json({ template: cleanDoc(updated), templates: docs.map(cleanDoc) });
    }

    if (req.method === 'DELETE') {
      const id = req.params?.id || req.query?.id || req.body?.id;
      if (!id) {
        return res.status(400).json({ error: 'Template id is required' });
      }

      const total = await col.countDocuments();
      if (total <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last remaining template' });
      }

      await col.deleteOne({ id });
      const docs = await col.find({}).sort({ sortOrder: 1, updatedAt: 1 }).toArray();
      if (!docs.some((d) => d.isDefault) && docs.length > 0) {
        await col.updateOne({ id: docs[0].id }, { $set: { isDefault: true } });
        docs[0].isDefault = true;
      }
      return res.status(200).json({ templates: docs.map(cleanDoc) });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'MongoDB templates error' });
  }
}
