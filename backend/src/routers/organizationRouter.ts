import { Router } from 'express';

import { getCurrentContext } from '../controllers/organizationContextController.js';
import {
  changePublicLinkState,
  generatePublicLink,
  getPublicLink,
} from '../controllers/organizationPublicLinkController.js';
import { authenticate } from '../middlewares/auth.js';
import { loadContext, requireRole } from '../middlewares/load-context.js';

const router = Router();

// Leitura do proprio vinculo: qualquer membro com vinculo ativo, entao sem requireRole.
router.get('/atual/contexto', authenticate, loadContext, getCurrentContext);

router.get(
  '/atual/link-publico',
  authenticate,
  loadContext,
  requireRole('TESOUREIRO'),
  getPublicLink,
);
router.post(
  '/atual/link-publico',
  authenticate,
  loadContext,
  requireRole('TESOUREIRO'),
  generatePublicLink,
);
router.patch(
  '/atual/link-publico',
  authenticate,
  loadContext,
  requireRole('TESOUREIRO'),
  changePublicLinkState,
);

export default router;
