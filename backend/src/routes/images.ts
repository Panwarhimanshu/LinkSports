import { Router } from 'express';
import mongoose from 'mongoose';
import { StoredImage } from '../models/StoredImage';

const router = Router();

// Public: serves photos that live in the database (profile photos and action photos on public CVs).
// Image ids are random and never change, so browsers and CDNs can cache them for a year.
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) { res.status(404).end(); return; }
  try {
    const img = await StoredImage.findById(id).select('contentType data');
    if (!img) { res.status(404).end(); return; }
    // only real image types are ever served, with sniffing and scripting switched off
    const type = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(img.contentType) ? img.contentType : 'application/octet-stream';
    res.setHeader('Content-Type', type);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(img.data);
  } catch {
    res.status(500).end();
  }
});

export default router;
