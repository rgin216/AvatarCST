import { Router } from 'express';
import {
  createSession,
  getSession,
  getUserSessions,
  updateSession,
  endSession,
  addMessage,
  getMessages,
  clearUserSessions,
  respondToSession,
  respondAudioToSession,
  createRealtimeSession,
  getPipelineInfo,
} from '../controllers/sessionController.js';
import { upload } from '../config/storage.js';

const router = Router();
router.get('/pipeline', getPipelineInfo);
router.post('/', createSession);
router.get('/user/:userId', getUserSessions);
router.delete('/user/:userId', clearUserSessions);
router.get('/:id', getSession);
router.patch('/:id', updateSession);
router.patch('/:id/end', endSession);
router.post('/:id/respond', respondToSession);
router.post('/:id/respond-audio', upload.single('audio'), respondAudioToSession);
router.post('/:id/realtime-session', createRealtimeSession);
router.post('/:id/messages', addMessage);
router.get('/:id/messages', getMessages);

export default router;
