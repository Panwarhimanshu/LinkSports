import mongoose, { Schema } from 'mongoose';

// One pending login code per email address. Mongo deletes expired rows automatically (TTL on expiresAt).
export interface IEmailOtp {
  email: string; // lowercased
  otpHash: string;
  attempts: number;
  sentAt: Date;
  expiresAt: Date;
}

const EmailOtpSchema = new Schema<IEmailOtp>({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  otpHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  sentAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

export const EmailOtp = mongoose.model<IEmailOtp>('EmailOtp', EmailOtpSchema);
