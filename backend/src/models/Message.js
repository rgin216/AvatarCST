import { Schema, model } from 'mongoose';

const messageSchema = new Schema({
  sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true },
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

export default model('Message', messageSchema);
