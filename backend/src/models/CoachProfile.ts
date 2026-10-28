import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICoachProfile extends Document {
  userId: Types.ObjectId;
  fullName: string;
  username?: string;
  tagline?: string;
  nationality?: string;
  countryCode?: string;
  yearsOfExperience?: number;
  coachingLevel?: string;
  education: { institution: string; degree?: string; fieldOfStudy?: string; startYear?: number; endYear?: number; isCurrent?: boolean; description?: string }[];
  playersTrained: { name: string; result?: string; year?: number; description?: string }[];
  achievements: { title: string; year?: number; level?: string; category?: string; description?: string }[];
  skills: string[];
  featuredVideoUrl?: string;
  profileCompletion: number;
  photo?: string;
  dob?: Date;
  gender?: string;
  location: { address?: string; pincode?: string; city?: string; state?: string; country?: string };
  email?: string;
  phone?: string;
  qualifications: { name: string; issuer?: string; year?: number; document?: string }[];
  sportsSpecialization: string[];
  ageGroupsCoached: string[];
  experience: { organization: string; role?: string; startDate?: Date; endDate?: Date; current?: boolean }[];
  athletesDeveloped: Types.ObjectId[];
  tournamentResults: { tournament: string; team?: string; result?: string; year?: number }[];
  coachingPhilosophy?: string;
  availability: 'full_time' | 'part_time' | 'freelance' | 'consulting' | 'not_available';
  aboutBio?: string;
  socialLinks: { instagram?: string; youtube?: string; twitter?: string; linkedin?: string; facebook?: string; whatsapp?: string };
  profileUrl: string;
  visibility: 'public' | 'connections' | 'private';
  followerCount: number;
  connectionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const CoachProfileSchema = new Schema<ICoachProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    fullName: { type: String, required: true, trim: true },
    username: { type: String, trim: true },
    tagline: String,
    nationality: String,
    countryCode: String,
    yearsOfExperience: Number,
    coachingLevel: String,
    education: [{ _id: false, institution: String, degree: String, fieldOfStudy: String, startYear: Number, endYear: Number, isCurrent: Boolean, description: String }],
    playersTrained: [{ _id: false, name: String, result: String, year: Number, description: String }],
    achievements: [{ _id: false, title: String, year: Number, level: String, category: String, description: String }],
    skills: [String],
    featuredVideoUrl: String,
    profileCompletion: { type: Number, default: 0 },
    photo: String,
    dob: Date,
    gender: String,
    location: { address: String, pincode: String, city: String, state: String, country: { type: String, default: 'India' } },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    qualifications: [{ name: String, issuer: String, year: Number, document: String }],
    sportsSpecialization: [String],
    ageGroupsCoached: [String],
    experience: [{ organization: String, role: String, startDate: Date, endDate: Date, current: Boolean }],
    athletesDeveloped: [{ type: Schema.Types.ObjectId, ref: 'AthleteProfile' }],
    tournamentResults: [{ tournament: String, team: String, result: String, year: Number }],
    coachingPhilosophy: { type: String, maxlength: 2000 },
    availability: {
      type: String,
      enum: ['full_time', 'part_time', 'freelance', 'consulting', 'not_available'],
      default: 'full_time',
    },
    aboutBio: { type: String, maxlength: 2000 },
    socialLinks: { instagram: String, youtube: String, twitter: String, linkedin: String, facebook: String, whatsapp: String },
    profileUrl: { type: String, unique: true, sparse: true, index: true },
    visibility: { type: String, enum: ['public', 'connections', 'private'], default: 'public' },
    followerCount: { type: Number, default: 0 },
    connectionCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

CoachProfileSchema.index({ fullName: 'text', coachingPhilosophy: 'text' });

export const CoachProfile = mongoose.model<ICoachProfile>('CoachProfile', CoachProfileSchema);
