import { Router } from 'express';
import { createSummary, getSessionSummary, getUserSummaries, generateSessionSummary } from '../controllers/summaryController.js';

const router = Router();
router.post('/', createSummary);
router.post('/generate/:sessionId', generateSessionSummary);
router.get('/session/:sessionId', getSessionSummary);
router.get('/user/:userId', getUserSummaries);

export default router;
