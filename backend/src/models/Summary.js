import { Schema, model } from 'mongoose';

const summarySchema = new Schema({
  sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  summaryText: { type: String },
  emotionalNotes: { type: String },
  gamePerformance: { type: String },
  keyTalkingPoints: [{ type: String }],
}, { timestamps: true });

export default model('Summary', summarySchema);
