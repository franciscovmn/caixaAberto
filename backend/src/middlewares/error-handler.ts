import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

import { AppError } from '../errors/app-error.js';

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      erro: error.message,
      ...(error.fields ? { campos: error.fields } : {}),
    });
    return;
  }

  // O express.json() lanca SyntaxError com status 400 quando o corpo nao e JSON valido.
  // Sem este ramo o erro caia no fallback e o cliente recebia 500.
  if (
    error instanceof SyntaxError &&
    'status' in error &&
    (error as SyntaxError & { status?: number }).status === 400 &&
    'body' in error
  ) {
    response.status(400).json({ erro: 'Corpo da requisição não é um JSON válido' });
    return;
  }

  if (error instanceof ZodError) {
    const fields = Object.fromEntries(
      error.issues.map((issue) => [issue.path.join('.') || 'requisicao', issue.message]),
    );

    response.status(400).json({ erro: 'Dados inválidos', campos: fields });
    return;
  }

  console.error('Erro não tratado', error);
  response.status(500).json({ erro: 'Erro interno do servidor' });
};
