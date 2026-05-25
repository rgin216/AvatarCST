import User from '../models/User.js';
import Memory from '../models/Memory.js';

export const createUser = async (req, res, next) => {
  try {
    const user = await User.create(req.body);
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
