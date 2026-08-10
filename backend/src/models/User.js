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

const userSchema = new Schema({
  name: { type: String, required: true },
  preferredName: { type: String },
  dateOfBirth: { type: Date },
  culturalBackground: { type: String },
  role: { type: String, enum: ['patient', 'caregiver'], default: 'patient' },
  caregivers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  patients: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  savedThemeSong: { type: savedThemeSongSchema },
}, { timestamps: true });

export default model('User', userSchema);
