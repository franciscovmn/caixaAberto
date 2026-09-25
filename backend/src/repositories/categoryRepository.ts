import { prisma } from '../database/client.js';
import type { CategoryType } from '../domain/category.js';

export interface CategoryRecord {
  id: bigint;
  name: string;
  type: string;
}

export interface CategoryDetailRecord extends CategoryRecord {
  description: string;
}

export interface NewCategoryData {
  organizationId: bigint;
  name: string;
  description: string;
  type: CategoryType;
}

const categoryDetailSelection = {
  id: true,
  name: true,
  description: true,
  type: true,
} as const;

export async function findActiveCategories(
  organizationId: bigint,
  type?: CategoryType,
): Promise<CategoryRecord[]> {
  return prisma.category.findMany({
    where: {
      organizationId,
      active: true,
      ...(type ? { type } : {}),
    },
    select: {
      id: true,
      name: true,
      type: true,
    },
    orderBy: { name: 'asc' },
  });
}

// A comparacao ignora maiusculas: para quem escolhe no formulario, "Transporte" e "transporte" sao a
// mesma categoria, embora o indice unico do banco diferencie as duas. Uma ativa tem precedencia.
export async function findCategoryByName(
  organizationId: bigint,
  name: string,
  type: CategoryType,
): Promise<{ id: bigint; active: boolean } | null> {
  return prisma.category.findFirst({
    where: { organizationId, type, name: { equals: name, mode: 'insensitive' } },
    select: { id: true, active: true },
    orderBy: [{ active: 'desc' }, { id: 'asc' }],
  });
}

export async function createCategory(data: NewCategoryData): Promise<CategoryDetailRecord> {
  return prisma.category.create({
    data: { ...data, active: true },
    select: categoryDetailSelection,
  });
}
