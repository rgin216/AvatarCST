import { Router } from 'express';
import {
  getUserMemory,
  addMemoryEntry,
  deleteMemoryEntry,
  clearMemory,
} from '../controllers/memoryController.js';

const router = Router();
router.get('/:userId', getUserMemory);
router.post('/:userId/entries', addMemoryEntry);
router.delete('/:userId/entries/:entryId', deleteMemoryEntry);
router.delete('/:userId', clearMemory);

export default router;
