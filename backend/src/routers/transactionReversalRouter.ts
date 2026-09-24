import { Router } from 'express';

import { reverseTransaction } from '../controllers/transactionReversalController.js';
import { authenticate } from '../middlewares/auth.js';
import { loadContext, requireRole } from '../middlewares/load-context.js';

const router = Router();

router.post(
  '/:id/estorno',
  authenticate,
  loadContext,
  requireRole('TESOUREIRO'),
  reverseTransaction,
);

export default router;
