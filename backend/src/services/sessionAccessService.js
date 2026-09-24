import User from '../models/User.js';
import Session from '../models/Session.js';

export const INTRO_SCRIPT_ID = 'cst_intro_reminiscence';

export async function getSessionAccess(userId) {
  const user = await User.findById(userId).lean();
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  return { introductionRequired: user.introductionRequired === true && !user.introductionCompletedAt };
}

export async function unlockAfterIntroduction(session, turn) {
  if (!session.unlocksSessions || session.scriptId !== INTRO_SCRIPT_ID || !turn.sessionCompleteAfterResponse) return;
  const completedAt = new Date();
  // This marker is server-owned and distinct from a user pressing End Session.
  await Session.updateOne({ _id: session._id }, { $set: { scriptCompletedAt: completedAt } });
  await User.updateOne({ _id: session.userId, introductionCompletedAt: null },
    { $set: { introductionCompletedAt: completedAt } });
}
