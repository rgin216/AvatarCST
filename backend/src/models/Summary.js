import { Schema, model } from 'mongoose';

const summarySchema = new Schema({
  sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  summaryText: { type: String },
  keyTalkingPoints: [{ type: String }],
  emotionalTone: { type: String, enum: ['positive', 'mixed', 'neutral', 'low'] },
  engagementLevel: { type: String, enum: ['high', 'medium', 'low'] },
  sessionScore: { type: String, enum: ['high', 'medium', 'low'] },
}, { timestamps: true });

export default model('Summary', summarySchema);
