import { Router } from 'express';
import {
  completeLandingTour, createUser, getUser, login, register, updateUserSettings, verifyUserPassword,
} from '../controllers/userController.js';

const router = Router();
router.post('/', createUser);
router.post('/register', register);
router.post('/login', login);
router.get('/:id', getUser);
router.patch('/:id/settings', updateUserSettings);
router.post('/:id/landing-tour/complete', completeLandingTour);
router.post('/:id/verify-password', verifyUserPassword);

export default router;
