import type { Role } from '../domain/auth-context.js';
import { formatCivilDate, todayCivilDate } from '../domain/civil-date.js';
import { AppError } from '../errors/app-error.js';
import { Prisma } from '../generated/prisma/client.js';
import * as membershipRepository from '../repositories/membershipRepository.js';
import type { MemberRecord } from '../repositories/membershipRepository.js';

const USER_NOT_FOUND = 'Usuário não encontrado';
const ALREADY_ACTIVE_MEMBER = 'Usuário já é membro ativo da organização';

// Todo vinculo comeca como consultor. Dar o papel de tesoureiro e a alteracao de papel da US10.
const DEFAULT_ROLE: Role = 'CONSULTOR';

export interface MemberResponse {
  id: string;
  usuario: { id: string; nome: string; email: string };
  papel: string;
  dataVinculo: string;
  ativo: boolean;
}

function toResponse(member: MemberRecord): MemberResponse {
  return {
    id: member.id.toString(),
    usuario: {
      id: member.user.id.toString(),
      nome: member.user.name,
      email: member.user.email,
    },
    papel: member.role,
    dataVinculo: formatCivilDate(member.linkedAt),
    ativo: member.active,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export async function addMember(organizationId: bigint, email: string): Promise<MemberResponse> {
  const userId = await membershipRepository.findUserIdByEmail(email);

  if (userId === null) {
    throw new AppError(404, USER_NOT_FOUND);
  }

  const linkedAt = todayCivilDate();
  const existing = await membershipRepository.findMembership(userId, organizationId);

  if (existing?.active) {
    throw new AppError(409, ALREADY_ACTIVE_MEMBER);
  }

  // O banco guarda um unico vinculo por usuario e organizacao, entao quem ja saiu volta pelo mesmo
  // registro, com a data de hoje e o papel padrao, como um vinculo novo.
  if (existing) {
    const reactivated = await membershipRepository.reactivateMembership(
      existing.id,
      DEFAULT_ROLE,
      linkedAt,
    );

    if (!reactivated) {
      throw new AppError(409, ALREADY_ACTIVE_MEMBER);
    }

    return toResponse(reactivated);
  }

  try {
    const created = await membershipRepository.createMembership({
      userId,
      organizationId,
      role: DEFAULT_ROLE,
      linkedAt,
    });

    return toResponse(created);
  } catch (error) {
    // Dois pedidos simultaneos passam juntos pela consulta acima; o indice unico barra o segundo.
    if (isUniqueViolation(error)) {
      throw new AppError(409, ALREADY_ACTIVE_MEMBER);
    }

    throw error;
  }
}
