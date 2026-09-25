import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import { getContexto } from '../middlewares/load-context.js';
import { transactionIdParamSchema } from '../schemas/identifier.js';
import * as transactionReversalService from '../services/transactionReversalService.js';

// O estorno nao recebe dados. O corpo e conferido so para recusar propriedade desconhecida, como no
// restante do contrato, em vez de ignora-la em silencio.
const reverseTransactionBodySchema = z.object({}).strict().optional();

export async function reverseTransaction(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = transactionIdParamSchema.parse(request.params);
    reverseTransactionBodySchema.parse(request.body);

    const result = await transactionReversalService.reverseTransaction(
      getContexto(request).organizacaoId,
      id,
    );
    response.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
