import type { NextFunction, Request, Response } from 'express';

import { getContexto } from '../middlewares/load-context.js';

// O frontend precisa saber o papel para nao oferecer acoes que a API vai recusar.
// O contexto ja e resolvido por loadContext; aqui ele so e devolvido ao cliente.
export function getCurrentContext(request: Request, response: Response, next: NextFunction): void {
  try {
    const contexto = getContexto(request);

    response.status(200).json({
      organizacaoId: String(contexto.organizacaoId),
      papel: contexto.papel,
    });
  } catch (error) {
    next(error);
  }
}
