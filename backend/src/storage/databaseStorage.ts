import { prisma } from '../database/client.js';
import { AppError } from '../errors/app-error.js';
import type { StorageSaveInput, StorageService, StoredDelivery } from './types.js';

// Guarda o conteudo no proprio Postgres. Existe para as hospedagens sem disco persistente, onde um
// arquivo gravado no sistema de arquivos some no proximo deploy e o comprovante da US22 se perde.
//
// A tabela COMPROVANTE_ARQUIVO nao tem chave estrangeira para COMPROVANTE de proposito. A gravacao
// acontece dentro da transacao que cria a linha do comprovante, mas por outra conexao, entao uma FK
// faria este insert esperar por uma linha ainda nao commitada e a operacao inteira travaria ate o
// timeout. Sem a FK as duas tabelas nunca disputam o mesmo lock, e o orfao que isso permite e
// desfeito pelo receiptService, que chama remove quando a transacao nao completa.
export class DatabaseStorage implements StorageService {
  async save({ key, content }: StorageSaveInput): Promise<void> {
    // O Prisma tipa Bytes como Uint8Array respaldado por ArrayBuffer, e um Buffer do Node pode
    // estar sobre SharedArrayBuffer. A copia resolve a incompatibilidade e custa um arquivo de no
    // maximo 5 MB, o teto que o upload ja impoe.
    await prisma.receiptFile.create({
      data: { key, content: new Uint8Array(content), createdAt: new Date() },
    });
  }

  async deliver(key: string): Promise<StoredDelivery> {
    const stored = await prisma.receiptFile.findUnique({
      where: { key },
      select: { content: true },
    });

    // A linha do comprovante existe, verificada pelo servico antes de chegar aqui, mas o conteudo
    // nao. E inconsistencia, e nao um comprovante ausente, entao nao vira 404.
    if (!stored) {
      throw new AppError(500, 'Conteúdo do comprovante não encontrado no armazenamento');
    }

    return { kind: 'content', content: Buffer.from(stored.content) };
  }

  // Idempotente como o rm do driver local: remover uma chave que nao existe nao e erro.
  async remove(key: string): Promise<void> {
    await prisma.receiptFile.deleteMany({ where: { key } });
  }
}
