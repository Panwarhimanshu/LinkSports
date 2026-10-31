import mongoose, { Schema, Types } from 'mongoose';

// One-time code handed to the browser after Google sign-in, instead of putting the access token in the URL.
// The web app swaps it for a token right away; it works once and expires after two minutes.
const OAuthCodeSchema = new Schema({
  codeHash: { type: String, required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

export interface IOAuthCode { codeHash: string; userId: Types.ObjectId; expiresAt: Date }
export const OAuthCode = mongoose.model<IOAuthCode>('OAuthCode', OAuthCodeSchema);
