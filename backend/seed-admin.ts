import './src/config/env';
import mongoose from 'mongoose';
import { User } from './src/models/User';

// Creates (or promotes) the admin account. The email and password come from the environment, never from code:
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-long-random-password' npx ts-node seed-admin.ts
// The web app signs admins in with an emailed code, so the password is only a fallback for the API.
const run = async () => {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!email || password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (12+ characters with upper, lower and a number).');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI as string);

  const existing = await User.findOne({ email }).select('+passwordHash');
  if (existing) {
    existing.role = 'admin';
    existing.isVerified = true;
    existing.isSuspended = false;
    existing.passwordHash = password; // pre-save hook hashes it
    existing.tokensValidAfter = new Date();
    await existing.save();
    console.log('Existing user updated to admin:', email);
  } else {
    await User.create({ email, passwordHash: password, role: 'admin', isVerified: true, authProvider: 'email' });
    console.log('Admin user created:', email);
  }
  await mongoose.disconnect();
};

run().catch((e) => { console.error(e.message); process.exit(1); });
