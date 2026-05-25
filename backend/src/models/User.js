import { Schema, model } from 'mongoose';

const userSchema = new Schema({
  name: { type: String, required: true },
  preferredName: { type: String },
  dateOfBirth: { type: Date },
  culturalBackground: { type: String },
  role: { type: String, enum: ['patient', 'caregiver'], default: 'patient' },
  caregivers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  patients: [{ type: Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

export default model('User', userSchema);
