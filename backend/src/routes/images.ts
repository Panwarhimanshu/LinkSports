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
    res.setHeader('Content-Type', img.contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(img.data);
  } catch {
    res.status(500).end();
  }
});

export default router;
