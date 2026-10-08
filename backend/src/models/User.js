import { Schema, model } from 'mongoose';

const savedThemeSongSchema = new Schema({
  status: { type: String, enum: ['available'], required: true },
  query: { type: String, required: true },
  track: {
    id: { type: String, required: true },
    uri: { type: String, required: true },
    name: { type: String, required: true },
    artists: [{ type: String }],
    artistLabel: { type: String, required: true },
    album: { type: String },
    artwork: { type: String },
    spotifyUrl: { type: String, required: true },
    durationMs: { type: Number },
  },
  matchedAt: { type: Date },
  sourceSessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true },
  savedAt: { type: Date, required: true },
}, { _id: false });

const userSettingsSchema = new Schema({
  personality: { type: String, enum: ['default', 'optimistic', 'calm'], default: 'default' },
  language: { type: String, enum: ['en', 'zh', 'es', 'fr', 'mi'], default: 'en' },
  avatarMode: { type: String, enum: ['male', 'female', 'visualizer'], default: 'male' },
  // Browser playback multiplier for Aria's speech; 1 is the synthesised pace.
  speechRate: { type: Number, min: 0.75, max: 1.25, default: 1 },
}, { _id: false });

const userSchema = new Schema({
  name: { type: String, required: true },
  // Sign-in identifier, stored lowercase. Older accounts without one sign in by name.
  username: { type: String, trim: true, lowercase: true, index: true },
  // Never selected by default and stripped from JSON below.
  // Legacy name-only accounts have no passwordHash until their next sign-in.
  passwordHash: { type: String, select: false },
  // Only registration opts in; older accounts retain their existing access.
  introductionRequired: { type: Boolean, default: false },
  introductionCompletedAt: Date,
  // Same opt-in as above: only new registrations are shown the landing tour.
  landingTourRequired: { type: Boolean, default: false },
  landingTourCompletedAt: Date,
  preferredName: { type: String },
  dateOfBirth: { type: Date },
  culturalBackground: { type: String },
  role: { type: String, enum: ['patient', 'caregiver'], default: 'patient' },
  caregivers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  patients: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  savedThemeSong: { type: savedThemeSongSchema },
  settings: { type: userSettingsSchema, default: () => ({}) },
}, {
  timestamps: true,
  toJSON: {
    transform: (_doc, ret) => {
      delete ret.passwordHash;
      // Briefly-used field from a separate caregiver password; may linger on test accounts.
      delete ret.caregiverPasswordHash;
      return ret;
    },
  },
});

export default model('User', userSchema);
