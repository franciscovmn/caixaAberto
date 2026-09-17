import express from 'express';
import authController from '../controllers/authController.js';
import { authenticate } from '../middlewares/auth.js';
import { loadContext, requireRole } from '../middlewares/load-context.js';

const router = express.Router();

// Cadastro nao e aberto: o caixa pertence a uma organizacao e quem cria conta e o
// TESOUREIRO. Sem isso qualquer visitante obtinha um token autenticado.
router.post(
  '/register',
  authenticate,
  loadContext,
  requireRole('TESOUREIRO'),
  authController.register,
);
router.post('/login', authController.login);
router.post('/logout', authenticate, authController.logout);

export default router;
