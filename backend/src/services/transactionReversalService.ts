import { REVERSED_STATUS } from '../domain/transaction.js';
import { AppError } from '../errors/app-error.js';
import * as transactionReversalRepository from '../repositories/transactionReversalRepository.js';

const TRANSACTION_NOT_FOUND = 'Lançamento não encontrado';
const TRANSACTION_ALREADY_REVERSED = 'Lançamento já está estornado';

export interface TransactionReversalResponse {
  id: string;
  status: typeof REVERSED_STATUS;
  dataEstorno: string;
}

export async function reverseTransaction(
  organizationId: bigint,
  transactionId: bigint,
): Promise<TransactionReversalResponse> {
  const reversedAt = new Date();
  const reversed = await transactionReversalRepository.reverseIfActive(
    transactionId,
    organizationId,
    reversedAt,
  );

  if (reversed) {
    return {
      id: transactionId.toString(),
      status: REVERSED_STATUS,
      dataEstorno: reversedAt.toISOString(),
    };
  }

  // Nada foi alterado: o lancamento nao existe nesta organizacao ou ja estava estornado. A leitura
  // vem depois do UPDATE para que a resposta nao dependa de um estado que outro pedido ja mudou.
  const status = await transactionReversalRepository.findStatus(transactionId, organizationId);

  if (status === null) {
    throw new AppError(404, TRANSACTION_NOT_FOUND);
  }

  throw new AppError(409, TRANSACTION_ALREADY_REVERSED);
}
