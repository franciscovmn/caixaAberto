import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import { getContexto } from '../middlewares/load-context.js';
import * as publicLinkService from '../services/organizationPublicLinkService.js';

const changePublicLinkStateSchema = z
  .object({
    ativo: z.boolean(),
  })
  .strict();

// Devolve 200 com o link vigente, ou 200 com null quando ainda nao existe. Nao e 404
// porque a ausencia de link e um estado normal da organizacao, nao um erro.
export async function getPublicLink(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await publicLinkService.readPublicLink(getContexto(request).organizacaoId);
    response.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function generatePublicLink(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await publicLinkService.generateAndActivatePublicLink(
      getContexto(request).organizacaoId,
    );
    response.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function changePublicLinkState(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = changePublicLinkStateSchema.parse(request.body);
    const result = await publicLinkService.changePublicLinkState(
      getContexto(request).organizacaoId,
      body.ativo,
    );
    response.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
