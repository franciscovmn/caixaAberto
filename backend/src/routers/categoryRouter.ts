import { Router } from 'express';

import {
  createCategory,
  listCategories,
  updateCategory,
} from '../controllers/categoryController.js';
import { authenticate } from '../middlewares/auth.js';
import { loadContext, requireRole } from '../middlewares/load-context.js';

const router = Router();

router.get('/', authenticate, loadContext, listCategories);
router.post('/', authenticate, loadContext, requireRole('TESOUREIRO'), createCategory);
router.put('/:id', authenticate, loadContext, requireRole('TESOUREIRO'), updateCategory);

export default router;
