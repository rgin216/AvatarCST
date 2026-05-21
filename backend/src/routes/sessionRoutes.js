import { Router } from 'express';
import {
  createSession,
  getSession,
  getUserSessions,
  updateSession,
  endSession,
  addMessage,
  getMessages,
} from '../controllers/sessionController.js';

const router = Router();
router.post('/', createSession);
router.get('/user/:userId', getUserSessions);
router.get('/:id', getSession);
router.patch('/:id', updateSession);
router.patch('/:id/end', endSession);
router.post('/:id/messages', addMessage);
router.get('/:id/messages', getMessages);

export default router;
