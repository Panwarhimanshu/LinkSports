import mongoose, { Schema } from 'mongoose';

// One pending code per phone number. Mongo deletes expired rows automatically (TTL on expiresAt).
export interface IPhoneOtp {
  phone: string; // 10-digit national number
  otpHash: string;
  attempts: number;
  sentAt: Date;
  expiresAt: Date;
}

const PhoneOtpSchema = new Schema<IPhoneOtp>({
  phone: { type: String, required: true, unique: true },
  otpHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  sentAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

export const PhoneOtp = mongoose.model<IPhoneOtp>('PhoneOtp', PhoneOtpSchema);
