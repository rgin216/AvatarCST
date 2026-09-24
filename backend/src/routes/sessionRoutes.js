import { Router } from 'express';
import {
  createSession,
  getSession,
  getUserSessions,
  getUserSessionAccess,
  updateSession,
  endSession,
  addMessage,
  getMessages,
  clearUserSessions,
  respondToSession,
  remindSession,
  respondAudioToSession,
  getPipelineInfo,
  streamSpeechToken,
} from '../controllers/sessionController.js';
import { upload } from '../config/storage.js';
import { getEvaluationOptions, getEvaluationReport, retryEvaluation } from '../controllers/evaluationController.js';

const router = Router();
router.get('/pipeline', getPipelineInfo);
router.get('/evaluation-options', getEvaluationOptions);
router.get('/speech-stream/:token', streamSpeechToken);
router.post('/', createSession);
router.get('/user/:userId', getUserSessions);
router.get('/user/:userId/access', getUserSessionAccess);
router.delete('/user/:userId', clearUserSessions);
router.get('/:id', getSession);
router.get('/:id/evaluation', getEvaluationReport);
router.post('/:id/evaluation/retry', retryEvaluation);
router.patch('/:id', updateSession);
router.patch('/:id/end', endSession);
router.post('/:id/respond', respondToSession);
router.post('/:id/reminder', remindSession);
router.post('/:id/respond-audio', upload.single('audio'), respondAudioToSession);
router.post('/:id/messages', addMessage);
router.get('/:id/messages', getMessages);

export default router;
