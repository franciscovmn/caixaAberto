import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import { categoryTypes } from '../domain/category.js';
import { getContexto } from '../middlewares/load-context.js';
import * as categoryService from '../services/categoryService.js';

const listCategoriesQuerySchema = z
  .object({
    tipo: z.enum(categoryTypes).optional(),
  })
  .strict();

// Os limites acompanham as colunas: nome e VARCHAR(100). A descricao e TEXT, e o teto aqui so evita
// que um texto sem fim chegue ao banco.
const categoryNameSchema = z
  .string({ error: 'Informe o nome da categoria' })
  .trim()
  .min(1, 'Informe o nome da categoria')
  .max(100, 'O nome deve ter no máximo 100 caracteres');

const categoryDescriptionSchema = z
  .string({ error: 'A descrição deve ser um texto' })
  .trim()
  .max(500, 'A descrição deve ter no máximo 500 caracteres');

const createCategoryBodySchema = z
  .object({
    nome: categoryNameSchema,
    descricao: categoryDescriptionSchema.default(''),
    tipo: z.enum(categoryTypes),
  })
  .strict();

export async function listCategories(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = listCategoriesQuerySchema.parse(request.query);
    const result = await categoryService.listActiveCategories(
      getContexto(request).organizacaoId,
      query.tipo,
    );
    response.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function createCategory(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = createCategoryBodySchema.parse(request.body);
    const result = await categoryService.createCategory(getContexto(request).organizacaoId, {
      name: body.nome,
      description: body.descricao,
      type: body.tipo,
    });
    response.status(201).json(result);
  } catch (error) {
    next(error);
  }
}
