import { randomBytes } from 'node:crypto';

import { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../errors/app-error.js';
import * as publicLinkRepository from '../repositories/organizationPublicLinkRepository.js';

const MAX_TOKEN_GENERATION_ATTEMPTS = 5;
const PUBLIC_LINK_NOT_GENERATED = 'Link público ainda não foi gerado';

export interface PublicLinkResponse {
  token: string;
  ativo: boolean;
}

function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

function isPublicLinkCollision(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export async function generateAndActivatePublicLink(
  organizationId: bigint,
): Promise<PublicLinkResponse> {
  for (let attempt = 1; attempt <= MAX_TOKEN_GENERATION_ATTEMPTS; attempt += 1) {
    const token = generateToken();

    try {
      await publicLinkRepository.replacePublicLinkAndActivate(organizationId, token);
      return { token, ativo: true };
    } catch (error) {
      if (!isPublicLinkCollision(error) || attempt === MAX_TOKEN_GENERATION_ATTEMPTS) {
        throw error;
      }
    }
  }

  throw new Error('Não foi possível gerar um token público único');
}

// Sem leitura, a tela nao tinha como mostrar o link vigente e o unico caminho para
// descobri-lo era gerar outro, o que derruba o endereco ja distribuido.
export async function readPublicLink(organizationId: bigint): Promise<PublicLinkResponse | null> {
  const currentState = await publicLinkRepository.findPublicLinkState(organizationId);

  if (!currentState?.publicLink) {
    return null;
  }

  return {
    token: currentState.publicLink,
    ativo: currentState.transparencyActive,
  };
}

export async function changePublicLinkState(
  organizationId: bigint,
  active: boolean,
): Promise<PublicLinkResponse> {
  const currentState = await publicLinkRepository.findPublicLinkState(organizationId);

  if (!currentState?.publicLink) {
    throw new AppError(409, PUBLIC_LINK_NOT_GENERATED);
  }

  const updatedState = await publicLinkRepository.setTransparencyActive(organizationId, active);

  if (!updatedState.publicLink) {
    throw new AppError(409, PUBLIC_LINK_NOT_GENERATED);
  }

  return {
    token: updatedState.publicLink,
    ativo: updatedState.transparencyActive,
  };
}
