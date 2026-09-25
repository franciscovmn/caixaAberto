import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import { getContexto } from '../middlewares/load-context.js';
import * as membershipService from '../services/membershipService.js';

const addMemberBodySchema = z
  .object({
    email: z.string({ error: 'Informe o e-mail do usuário' }).trim().pipe(z.email()),
  })
  .strict();

export async function addMember(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = addMemberBodySchema.parse(request.body);
    const result = await membershipService.addMember(
      getContexto(request).organizacaoId,
      body.email,
    );
    response.status(201).json(result);
  } catch (error) {
    next(error);
  }
}
