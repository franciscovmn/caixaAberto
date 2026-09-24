import { prisma } from '../database/client.js';
import { BALANCE_AFFECTING_STATUS, REVERSED_STATUS } from '../domain/transaction.js';

// So o que ainda entra no saldo pode ser estornado, e a condicao vai no proprio UPDATE: entre dois
// pedidos simultaneos, o segundo encontra a linha ja estornada e nao altera nada.
export async function reverseIfActive(
  id: bigint,
  organizationId: bigint,
  reversedAt: Date,
): Promise<boolean> {
  const { count } = await prisma.transaction.updateMany({
    where: { id, organizationId, status: BALANCE_AFFECTING_STATUS },
    data: { status: REVERSED_STATUS, reversedAt },
  });

  return count === 1;
}

export async function findStatus(id: bigint, organizationId: bigint): Promise<string | null> {
  const transaction = await prisma.transaction.findFirst({
    where: { id, organizationId },
    select: { status: true },
  });

  return transaction?.status ?? null;
}
