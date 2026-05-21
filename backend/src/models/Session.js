import { Schema, model } from 'mongoose';

const sessionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String },
  theme: { type: String },
  status: { type: String, enum: ['pending', 'active', 'completed', 'abandoned'], default: 'pending' },
  startedAt: { type: Date },
  endedAt: { type: Date },
}, { timestamps: true });

export default model('Session', sessionSchema);
