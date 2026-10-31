// One-time security cleanup. Run from the backend folder:  npx ts-node scripts/security-cleanup.js
// It uses MONGODB_URI from the root .env (or the environment), so point that at the database you want to clean.
require('ts-node').register({ transpileOnly: true });
require('../src/config/env');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  const users = mongoose.connection.db.collection('users');
  // Replace the publicly known seed passwords with random ones nobody knows (sign-in is by emailed code anyway).
  for (const email of ['admin@linksports.in', 'athlete@linksports.in']) {
    const hash = await bcrypt.hash(crypto.randomBytes(32).toString('base64'), 12);
    const r = await users.updateOne({ email }, { $set: { passwordHash: hash, refreshTokens: [], tokensValidAfter: new Date() } });
    console.log('rotated known password for', email, '->', r.matchedCount === 1 ? 'done' : 'not found');
  }
  // One-time codes used to be stored in plain text: remove any that are still there.
  const r2 = await users.updateMany({ emailOtp: { $exists: true } }, { $unset: { emailOtp: '', emailOtpExpiry: '' } });
  console.log('cleared stored email codes:', r2.modifiedCount);
  process.exit(0);
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
