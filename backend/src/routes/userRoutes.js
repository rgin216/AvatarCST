import { Router } from 'express';
import {
  completeLandingTour, createUser, getUser, findOrCreateByName, updateUserSettings,
} from '../controllers/userController.js';

const router = Router();
router.post('/', createUser);
router.get('/login/:name', findOrCreateByName);
router.get('/:id', getUser);
router.patch('/:id/settings', updateUserSettings);
router.post('/:id/landing-tour/complete', completeLandingTour);

export default router;
