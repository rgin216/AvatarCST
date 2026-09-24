import { Schema, model } from 'mongoose';

export const EvaluationCounter = model('EvaluationCounter', new Schema({
  _id: String, value: { type: Number, default: 0 },
}));
const turnSchema = new Schema({
  sessionId: { type: Schema.Types.ObjectId, required: true, index: true },
  revision: Number, input: String, deliveredText: String,
  step: Schema.Types.Mixed, slide: Schema.Types.Mixed,
  memory: [Schema.Types.Mixed], reminder: Boolean,
  complete: Boolean, calls: [Schema.Types.Mixed], error: String,
}, { timestamps: true });
turnSchema.index({ sessionId: 1, revision: 1 }, { unique: true });
export const EvaluationTurn = model('EvaluationTurn', turnSchema);
export const SessionEvaluation = model('SessionEvaluation', new Schema({
  sessionId: { type: Schema.Types.ObjectId, required: true, unique: true },
  status: { type: String, enum: ['queued', 'running', 'complete', 'failed'], default: 'queued' },
  leaseUntil: Date, leaseToken: String, attempts: { type: Number, default: 0 },
  naturalCompletion: Boolean, report: Schema.Types.Mixed, error: String,
}, { timestamps: true }));
