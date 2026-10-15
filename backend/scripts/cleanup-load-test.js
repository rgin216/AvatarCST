import '../src/config/env.js';
import { parseArgs } from 'node:util';
import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import User from '../src/models/User.js';
import Session from '../src/models/Session.js';
import Message from '../src/models/Message.js';
import Summary from '../src/models/Summary.js';
import Memory from '../src/models/Memory.js';
import { EvaluationTurn, SessionEvaluation } from '../src/models/Evaluation.js';

// Removes accounts created by evaluate-concurrency.js, and everything they own, from the MONGO_URI database.
try {
  const { values } = parseArgs({ options: {
    run: { type: 'string' }, all: { type: 'boolean', default: false }, confirm: { type: 'boolean', default: false },
  } });
  if (!values.all && !/^[a-f\d]{8}$/u.test(values.run || '')) throw new Error('Use --run RUNID (8 hex characters from the run output) or --all');
  const prefix = values.all ? 'loadtest-' : `loadtest-${values.run}-`;
  await connectDB();
  const users = await User.find({ username: { $regex: `^${prefix}` } }).select('_id').lean();
  const userIds = users.map(user => user._id);
  const sessionIds = (await Session.find({ userId: { $in: userIds } }).select('_id').lean()).map(session => session._id);
  const targets = [
    ['messages', Message, { sessionId: { $in: sessionIds } }],
    ['summaries', Summary, { sessionId: { $in: sessionIds } }],
    ['evaluation turns', EvaluationTurn, { sessionId: { $in: sessionIds } }],
    ['session evaluations', SessionEvaluation, { sessionId: { $in: sessionIds } }],
    ['memory banks', Memory, { userId: { $in: userIds } }],
    ['sessions', Session, { _id: { $in: sessionIds } }],
    ['users', User, { _id: { $in: userIds } }],
  ];
  console.log(`${values.confirm ? 'Deleting' : 'Dry run (add --confirm to delete)'}: accounts with username prefix "${prefix}"`);
  for (const [label, model, filter] of targets) {
    const count = values.confirm ? (await model.deleteMany(filter)).deletedCount : await model.countDocuments(filter);
    console.log(`  ${label}: ${count}`);
  }
  await mongoose.disconnect();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
  await mongoose.disconnect().catch(() => {});
}
