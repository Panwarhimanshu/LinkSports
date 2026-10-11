import mongoose, { Schema } from 'mongoose';

// Single document (key: 'site') edited from the admin panel and read by the website and app.
export interface ISiteSettings {
  key: string;
  banner: { active: boolean; text: string; link?: string; tone: 'info' | 'success' | 'warning' };
  maintenance: { active: boolean; message: string };
  signupsOpen: boolean;
  supportEmail: string;
  sports: string[];
  updatedBy?: mongoose.Types.ObjectId;
  updatedAt?: Date;
}

const SiteSettingsSchema = new Schema<ISiteSettings>(
  {
    key: { type: String, required: true, unique: true, default: 'site' },
    banner: {
      active: { type: Boolean, default: false },
      text: { type: String, default: '', maxlength: 300 },
      link: { type: String, default: '' },
      tone: { type: String, enum: ['info', 'success', 'warning'], default: 'info' },
    },
    maintenance: {
      active: { type: Boolean, default: false },
      message: { type: String, default: 'We are making improvements. Some features may be unavailable for a short while.', maxlength: 500 },
    },
    signupsOpen: { type: Boolean, default: true },
    supportEmail: { type: String, default: 'noreply@linksports.in' },
    sports: { type: [String], default: [] },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const SiteSettings = mongoose.model<ISiteSettings>('SiteSettings', SiteSettingsSchema);

/** Returns the settings document, creating it with defaults on first use. */
export const getSiteSettings = async () =>
  (await SiteSettings.findOne({ key: 'site' })) ?? SiteSettings.create({ key: 'site' });

/** "Allow new sign-ups" switch from the admin panel. Existing users can always sign in. */
export const signupsAllowed = async (): Promise<boolean> => {
  try { return (await getSiteSettings()).signupsOpen !== false; } catch { return true; } // never lock people out on a DB hiccup
};
export const SIGNUPS_CLOSED_MSG = 'New sign-ups are paused right now. Please try again later.';
