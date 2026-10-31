import '../config/env';
import mongoose from 'mongoose';
import { connectDB } from '../config/database';
import { User } from '../models/User';

const seed = async () => {
  try {
    await connectDB();
    console.log('🌱 Seeding database...');

    // Development data only. Never run against a real database, and never with built-in passwords:
    // accounts are created with random passwords that are not printed (sign in with the emailed code).
    if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed a production database');
    const crypto = await import('crypto');
    for (const [email, role] of [['athlete@linksports.local', 'athlete']] as const) {
      if (!(await User.findOne({ email }))) {
        await User.create({ email, passwordHash: crypto.randomBytes(24).toString('base64'), role, isVerified: true });
        console.log(`Created ${role}: ${email}`);
      }
    }

    console.log('✨ Seeding completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

seed();
