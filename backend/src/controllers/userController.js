import User from '../models/User.js';
import Memory from '../models/Memory.js';
import { hashPassword, passwordProblem, verifyPassword } from '../services/passwordService.js';

export const createUser = async (req, res, next) => {
  try {
    const { name, preferredName, dateOfBirth, culturalBackground, role, caregivers, patients, settings } = req.body || {};
    const user = await User.create({ name, preferredName, dateOfBirth, culturalBackground,
      role, caregivers, patients, settings, introductionRequired: true, landingTourRequired: true });
    await Memory.create({ userId: user._id, entries: [] });
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
};

export const getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    next(err);
  }
};

export const updateUserSettings = async (req, res, next) => {
  try {
    const { personality, language, avatarMode, speechRate } = req.body || {};
    const update = {};
    if (personality !== undefined) update['settings.personality'] = personality;
    if (language !== undefined) update['settings.language'] = language;
    if (avatarMode !== undefined) update['settings.avatarMode'] = avatarMode;
    if (speechRate !== undefined) update['settings.speechRate'] = speechRate;

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'No supported settings provided' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    next(err);
  }
};

// Idempotent: only the first completion is recorded.
export const completeLandingTour = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('_id').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    await User.updateOne(
      { _id: req.params.id, landingTourCompletedAt: null },
      { $set: { landingTourCompletedAt: new Date() } }
    );
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};

const INVALID_LOGIN = 'That username and password do not match.';
const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/;

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const readName = (body) => (typeof body?.name === 'string' ? body.name.trim() : '');
const readUsername = (body) => (typeof body?.username === 'string' ? body.username.trim().toLowerCase() : '');

// Accounts made before usernames existed sign in with their name instead,
// matched case-insensitively.
const findByUsername = (username) => User.findOne({
  $or: [
    { username },
    { username: null, name: { $regex: new RegExp(`^${escapeRegExp(username)}$`, 'i') } },
  ],
}, '+passwordHash');

export const register = async (req, res, next) => {
  try {
    const name = readName(req.body);
    const username = readUsername(req.body);
    const password = req.body?.password;
    if (!name) return res.status(400).json({ error: 'Please enter a name.' });
    if (!USERNAME_PATTERN.test(username)) {
      return res.status(400).json({ error: 'Usernames need 3–30 letters or numbers (dots, dashes and underscores are fine too).' });
    }
    const problem = passwordProblem(password);
    if (problem) return res.status(400).json({ error: problem });
    if (await findByUsername(username)) {
      return res.status(409).json({ error: 'That username is already in use. Please pick another.' });
    }

    const user = await User.create({
      name, preferredName: name, username, role: 'patient', introductionRequired: true, landingTourRequired: true,
      passwordHash: await hashPassword(password),
    });
    await Memory.create({ userId: user._id, entries: [] });
    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const username = readUsername(req.body);
    const { password } = req.body || {};
    if (!username || typeof password !== 'string' || !password) {
      return res.status(400).json({ error: 'Please enter your username and password.' });
    }
    const user = await findByUsername(username);
    if (!user) return res.status(401).json({ error: INVALID_LOGIN });

    if (!user.passwordHash) {
      // Accounts created before passwords existed claim one on their first sign-in.
      const problem = passwordProblem(password);
      if (problem) return res.status(400).json({ error: problem });
      const { modifiedCount } = await User.updateOne(
        { _id: user._id, passwordHash: null },
        { $set: { passwordHash: await hashPassword(password) } }
      );
      if (!modifiedCount) return res.status(401).json({ error: INVALID_LOGIN });
      return res.json({ user });
    }

    if (!(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({ error: INVALID_LOGIN });
    }
    res.json({ user });
  } catch (err) {
    next(err);
  }
};

// Re-checks the sign-in password, e.g. before opening the caregiver area.
export const verifyUserPassword = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id, '+passwordHash').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!(await verifyPassword(req.body?.password, user.passwordHash))) {
      return res.status(401).json({ error: 'That password is not right.' });
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};
