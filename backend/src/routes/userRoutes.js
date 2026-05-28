import { Router } from 'express';
import { createUser, getUser, findOrCreateByName } from '../controllers/userController.js';

const router = Router();
router.post('/', createUser);
router.get('/login/:name', findOrCreateByName);
router.get('/:id', getUser);

export default router;
