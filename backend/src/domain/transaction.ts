export const transactionTypes = ['ENTRADA', 'SAIDA'] as const;

export type TransactionType = (typeof transactionTypes)[number];

// Nomeadas em vez de posicionais: a ordem de transactionTypes existe para o enum do Zod e e
// incidental, entao depender dela faria um tipo novo no inicio do array inverter o sinal do saldo.
export const INCOME_TYPE = 'ENTRADA' as const satisfies TransactionType;

export const EXPENSE_TYPE = 'SAIDA' as const satisfies TransactionType;

export const transactionStatuses = ['ATIVO', 'ESTORNADO'] as const;

export type TransactionStatus = (typeof transactionStatuses)[number];

// Um lancamento so entra no saldo enquanto esta ativo. O mesmo criterio decide o saldo anterior,
// filtrado no banco, e o acumulado de cada linha, calculado no servico, para que os dois nao
// possam divergir.
export const BALANCE_AFFECTING_STATUS = 'ATIVO' as const satisfies TransactionStatus;

// Lancamento nunca e apagado: o estorno troca o status, e a linha continua nas consultas.
export const REVERSED_STATUS = 'ESTORNADO' as const satisfies TransactionStatus;

export function affectsBalance(status: string): boolean {
  return status === BALANCE_AFFECTING_STATUS;
}

// Estreita um tipo vindo do banco para a uniao do dominio, para que os consumidores possam usar
// switch exaustivo. Um tipo fora da uniao interrompe o calculo em vez de cair num ramo generico.
export function assertKnownTransactionType(type: string): TransactionType {
  if (type === INCOME_TYPE || type === EXPENSE_TYPE) {
    return type;
  }

  throw new Error(`Tipo de lancamento desconhecido: ${type}`);
}
