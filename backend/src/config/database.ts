import mongoose from 'mongoose';

// Reused across requests: on serverless hosts (Vercel) every request may hit a warm instance that is
// already connected, and concurrent cold requests should share one connection attempt.
let connecting: Promise<typeof mongoose> | null = null;

export const connectDB = async (): Promise<void> => {
  if (mongoose.connection.readyState === 1) return;
  try {
    connecting = connecting ?? mongoose.connect(process.env.MONGODB_URI as string, { serverSelectionTimeoutMS: 10_000 });
    const conn = await connecting;
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    connecting = null;
    console.error('MongoDB connection error:', error);
    // A long-running server cannot work without the database; a serverless request just fails.
    if (!process.env.VERCEL) process.exit(1);
    throw error;
  }
};

mongoose.connection.on('disconnected', () => {
  connecting = null;
  console.log('MongoDB disconnected');
});

process.on('SIGINT', async () => {
  await mongoose.connection.close();
  process.exit(0);
});
