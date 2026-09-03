import { Router } from 'express';
import { createUser, getUser, findOrCreateByName, updateUserSettings } from '../controllers/userController.js';

const router = Router();
router.post('/', createUser);
router.get('/login/:name', findOrCreateByName);
router.get('/:id', getUser);
router.patch('/:id/settings', updateUserSettings);

export default router;
