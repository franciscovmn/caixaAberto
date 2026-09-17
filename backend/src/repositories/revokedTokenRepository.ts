import { createHash } from 'node:crypto';

import { prisma } from '../database/client.js';

// O token nunca e guardado em texto: a lista de revogacao trabalha sobre o hash.
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function revoke(token: string, userId: bigint, expiresAt: Date) {
  const tokenHash = hashToken(token);

  return prisma.revokedToken.upsert({
    where: { tokenHash },
    update: {},
    create: {
      tokenHash,
      userId,
      expiresAt,
      revokedAt: new Date(),
    },
  });
}

async function isRevoked(token: string): Promise<boolean> {
  const revoked = await prisma.revokedToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true },
  });

  return revoked !== null;
}

// Uma revogacao so precisa viver enquanto o token ainda poderia ser aceito.
async function deleteExpired(now: Date = new Date()) {
  return prisma.revokedToken.deleteMany({
    where: { expiresAt: { lt: now } },
  });
}

export default { revoke, isRevoked, deleteExpired, hashToken };
