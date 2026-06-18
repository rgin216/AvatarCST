import { Schema, model } from 'mongoose';

const entrySchema = new Schema({
  category: {
    type: String,
    enum: ['preference', 'personal', 'session_insight', 'caregiver_note'],
    default: 'personal',
  },
  content: { type: String, required: true },
  addedBy: { type: String, enum: ['system', 'caregiver'], default: 'system' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
  reason: { type: String },
  sourceSessionId: { type: Schema.Types.ObjectId, ref: 'Session' },
  reviewedAt: { type: Date },
  reviewedBy: { type: String, enum: ['system', 'caregiver'] },
}, { timestamps: true });

const memorySchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  entries: [entrySchema],
}, { timestamps: true });

export default model('Memory', memorySchema);
