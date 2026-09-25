import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';

import { prisma } from '../database/client.js';
import { roles, type AuthContext, type Role } from '../domain/auth-context.js';
import { AppError } from '../errors/app-error.js';
import { identifierSchema } from '../schemas/identifier.js';
import type { AuthRequest } from './auth.js';

const organizationParamSchema = z.object({ id: identifierSchema });

function parseIdentifier(value: string): bigint | null {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function isRole(value: string): value is Role {
  return roles.some((role) => role === value);
}

export async function loadContext(
  request: AuthRequest,
  _response: Response,
  next: NextFunction,
): Promise<void> {
  if (request.contexto) {
    next();
    return;
  }

  if (!request.user) {
    next(new AppError(401, 'Usuário não autenticado'));
    return;
  }

  const userId = parseIdentifier(request.user.id);

  if (userId === null) {
    next(new AppError(401, 'Usuário não autenticado'));
    return;
  }

  const organizationHeader = request.header('X-Organization-Id');
  const selectedOrganizationId = organizationHeader
    ? parseIdentifier(organizationHeader)
    : undefined;

  if (organizationHeader && selectedOrganizationId === null) {
    next(new AppError(400, 'X-Organization-Id deve ser um identificador válido'));
    return;
  }

  try {
    // A conta e reconferida a cada requisicao: desativar um usuario precisa cortar o
    // acesso na hora, e nao so impedir o proximo login.
    const usuario = await prisma.user.findUnique({
      where: { id: userId },
      select: { active: true },
    });

    if (!usuario || !usuario.active) {
      next(new AppError(403, 'Usuário inativo'));
      return;
    }

    const memberships = await prisma.membership.findMany({
      where: {
        userId,
        active: true,
      },
      orderBy: {
        id: 'asc',
      },
      select: {
        organizationId: true,
        role: true,
      },
    });

    if (memberships.length === 0) {
      next(new AppError(403, 'Usuário não possui vínculo ativo com uma organização'));
      return;
    }

    const membership = selectedOrganizationId
      ? memberships.find((item) => item.organizationId === selectedOrganizationId)
      : memberships.length === 1
        ? memberships[0]
        : undefined;

    if (selectedOrganizationId && !membership) {
      next(new AppError(403, 'Usuário não possui vínculo ativo com a organização selecionada'));
      return;
    }

    if (!selectedOrganizationId && memberships.length > 1) {
      next(new AppError(400, 'Informe X-Organization-Id para escolher uma organização'));
      return;
    }

    if (!membership || !isRole(membership.role)) {
      next(new AppError(403, 'Vínculo do usuário possui papel inválido'));
      return;
    }

    request.contexto = {
      usuarioId: userId,
      organizacaoId: membership.organizationId,
      papel: membership.role,
    };

    next();
  } catch (error) {
    next(error);
  }
}

export function getContexto(request: Request): AuthContext {
  if (!request.contexto) {
    throw new AppError(401, 'Contexto autenticado ausente');
  }

  return request.contexto;
}

// Rota com a organizacao no caminho so atende a organizacao do contexto. Qualquer outra responde
// como inexistente, sem revelar se ela existe ou se o usuario tem vinculo com ela.
export function requireContextOrganization(
  request: Request,
  _response: Response,
  next: NextFunction,
): void {
  if (!request.contexto) {
    next(new AppError(401, 'Contexto autenticado ausente'));
    return;
  }

  const params = organizationParamSchema.safeParse(request.params);

  if (!params.success) {
    next(params.error);
    return;
  }

  if (params.data.id !== request.contexto.organizacaoId) {
    next(new AppError(404, 'Organização não encontrada'));
    return;
  }

  next();
}

export function requireRole(role: Role): RequestHandler {
  return (request: Request, _response: Response, next: NextFunction) => {
    if (!request.contexto) {
      next(new AppError(401, 'Contexto autenticado ausente'));
      return;
    }

    if (request.contexto.papel !== role) {
      next(new AppError(403, `Acesso permitido apenas para ${role}`));
      return;
    }

    next();
  };
}
