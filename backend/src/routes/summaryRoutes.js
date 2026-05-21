import { Router } from 'express';
import { createSummary, getSessionSummary, getUserSummaries } from '../controllers/summaryController.js';

const router = Router();
router.post('/', createSummary);
router.get('/session/:sessionId', getSessionSummary);
router.get('/user/:userId', getUserSummaries);

export default router;
