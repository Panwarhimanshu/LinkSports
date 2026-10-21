import mongoose, { Schema, Types } from 'mongoose';

export const EVENT_TYPES = [
  'USER_SIGNUP',
  'USER_LOGIN',
  'SPORT_SELECTED',
  'CV_UPDATED',
  'CV_SAVED', // legacy name for CV_UPDATED, kept so old rows still validate
  'PHOTOS_UPLOADED',
  'PDF_DOWNLOADED',
  'STORY_CARD_EXPORTED',
  'PROFILE_SHARED',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export interface IActivityEvent {
  eventId: string;
  userId: Types.ObjectId;
  userName: string;
  sport?: string;
  eventType: EventType;
  meta: Record<string, unknown>;
  createdAt: Date;
}

const ActivityEventSchema = new Schema<IActivityEvent>(
  {
    eventId: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userName: { type: String, default: '' },
    sport: String,
    eventType: { type: String, enum: EVENT_TYPES, required: true, index: true },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ActivityEventSchema.index({ createdAt: -1 });

export const ActivityEvent = mongoose.model<IActivityEvent>('ActivityEvent', ActivityEventSchema);
