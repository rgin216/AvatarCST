import { Schema, model } from 'mongoose';

const sessionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String },
  theme: { type: String },
  status: { type: String, enum: ['pending', 'active', 'completed', 'abandoned'], default: 'pending' },
  scriptId: { type: String, default: 'cst_intro_reminiscence' },
  scriptStepIndex: { type: Number, default: 0, min: 0 },
  presentationState: {
    slideIndex: { type: Number, default: 0 },
    deckSlide: { type: Number },
    title: { type: String },
    subtitle: { type: String },
    prompt: { type: String },
    bullets: [{ type: String }],
    visualHint: { type: String },
    accent: { type: String },
  },
  startedAt: { type: Date },
  endedAt: { type: Date },
}, { timestamps: true });

export default model('Session', sessionSchema);
