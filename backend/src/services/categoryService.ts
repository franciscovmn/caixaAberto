import type { CategoryType } from '../domain/category.js';
import { AppError } from '../errors/app-error.js';
import { Prisma } from '../generated/prisma/client.js';
import * as categoryRepository from '../repositories/categoryRepository.js';
import type { CategoryDetailRecord } from '../repositories/categoryRepository.js';

const DUPLICATE_CATEGORY = 'Já existe uma categoria com esse nome e tipo';
const DUPLICATE_INACTIVE_CATEGORY = 'Já existe uma categoria desativada com esse nome e tipo';

export interface CategoryResponse {
  id: string;
  nome: string;
  tipo: string;
}

export interface CategoryListResponse {
  dados: CategoryResponse[];
}

export interface CategoryDetailResponse extends CategoryResponse {
  descricao: string;
}

export interface CategoryInput {
  name: string;
  description: string;
  type: CategoryType;
}

export async function listActiveCategories(
  organizationId: bigint,
  type?: CategoryType,
): Promise<CategoryListResponse> {
  const categories = await categoryRepository.findActiveCategories(organizationId, type);

  return {
    dados: categories.map((category) => ({
      id: category.id.toString(),
      nome: category.name,
      tipo: category.type,
    })),
  };
}

function toDetailResponse(category: CategoryDetailRecord): CategoryDetailResponse {
  return {
    id: category.id.toString(),
    nome: category.name,
    descricao: category.description,
    tipo: category.type,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

// O indice unico do banco vale tambem para categoria desativada, entao o nome dela continua
// ocupado. A mensagem diz isso, para o tesoureiro nao procurar uma categoria que a lista nao mostra.
async function assertNameAvailable(
  organizationId: bigint,
  name: string,
  type: CategoryType,
): Promise<void> {
  const existing = await categoryRepository.findCategoryByName(organizationId, name, type);

  if (existing) {
    throw new AppError(409, existing.active ? DUPLICATE_CATEGORY : DUPLICATE_INACTIVE_CATEGORY);
  }
}

export async function createCategory(
  organizationId: bigint,
  input: CategoryInput,
): Promise<CategoryDetailResponse> {
  await assertNameAvailable(organizationId, input.name, input.type);

  try {
    const category = await categoryRepository.createCategory({ organizationId, ...input });

    return toDetailResponse(category);
  } catch (error) {
    // Dois cadastros simultaneos passam juntos pela conferencia acima; o indice unico barra o segundo.
    if (isUniqueViolation(error)) {
      throw new AppError(409, DUPLICATE_CATEGORY);
    }

    throw error;
  }
}
