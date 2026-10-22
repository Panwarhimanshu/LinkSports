import mongoose, { Schema, Types } from 'mongoose';

/**
 * A photo kept in the database. This is the storage used when no Cloudinary account is configured.
 * Photos are already shrunk to under ~800 KB by the browser before they arrive.
 */
export interface IStoredImage {
  ownerId: Types.ObjectId;
  contentType: string;
  data: Buffer;
  size: number;
  createdAt: Date;
}

const StoredImageSchema = new Schema<IStoredImage>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    contentType: { type: String, required: true },
    data: { type: Buffer, required: true },
    size: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const StoredImage = mongoose.model<IStoredImage>('StoredImage', StoredImageSchema);
