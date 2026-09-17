import { readdir } from 'node:fs/promises';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../src/app.js';
import { prisma } from '../../src/database/client.js';
import * as receiptRepository from '../../src/repositories/receiptRepository.js';
import {
  createCategory,
  createMembership,
  createOrganization,
  createTransaction,
  createUser,
} from '../factories/index.js';
import { createAuthorizationHeader } from '../helpers/auth.js';
import { testUploadDirectory } from '../helpers/test-environment.js';

const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from('conteudo de teste')]);
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32, 1),
]);

async function arquivosEmDisco(): Promise<string[]> {
  return readdir(testUploadDirectory());
}

async function criarCenario() {
  const user = await createUser();
  const organization = await createOrganization();
  await createMembership({ userId: user.id, organizationId: organization.id, role: 'TESOUREIRO' });
  const categoria = await createCategory({ organizationId: organization.id, type: 'SAIDA' });
  const lancamento = await createTransaction({
    organizationId: organization.id,
    userId: user.id,
    categoryId: categoria.id,
    type: 'SAIDA',
    amount: '75.00',
    date: new Date('2026-09-10T00:00:00.000Z'),
  });

  return { lancamento, authorization: createAuthorizationHeader(user) };
}

// O mesmo fluxo de comprovante.test.ts, porem com STORAGE_DRIVER=database, que e o driver usado na
// hospedagem sem disco persistente. O que estes testes protegem nao e o endpoint, ja coberto la, e
// sim que trocar o driver por variavel de ambiente nao muda nada visivel pela API.
describe('comprovante com armazenamento no banco (US22)', () => {
  const driverOriginal = process.env.STORAGE_DRIVER;

  beforeAll(() => {
    process.env.STORAGE_DRIVER = 'database';
  });

  afterAll(() => {
    process.env.STORAGE_DRIVER = driverOriginal;
  });

  it('guarda o conteúdo no banco e não escreve no disco', async () => {
    const { lancamento, authorization } = await criarCenario();

    const response = await request(createApp())
      .post(`/lancamentos/${lancamento.id}/comprovante`)
      .set('Authorization', authorization)
      .attach('arquivo', PDF, { filename: 'nota.pdf', contentType: 'application/pdf' });

    expect(response.status).toBe(201);

    const comprovante = await prisma.receipt.findUniqueOrThrow({
      where: { transactionId: lancamento.id },
    });
    const armazenado = await prisma.receiptFile.findUniqueOrThrow({
      where: { key: comprovante.fileUrl },
    });

    expect(Buffer.from(armazenado.content)).toEqual(PDF);
    expect(await arquivosEmDisco()).toEqual([]);
  });

  it('devolve na leitura exatamente os bytes enviados', async () => {
    const { lancamento, authorization } = await criarCenario();

    await request(createApp())
      .post(`/lancamentos/${lancamento.id}/comprovante`)
      .set('Authorization', authorization)
      .attach('arquivo', PNG, { filename: 'recibo.png' });

    const response = await request(createApp())
      .get(`/lancamentos/${lancamento.id}/comprovante`)
      .set('Authorization', authorization);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('image/png');
    expect(response.headers['content-disposition']).toContain('recibo.png');
    expect(Buffer.from(response.body)).toEqual(PNG);
  });

  // A gravacao roda dentro da transacao que cria a linha do comprovante, porem em outra conexao,
  // entao ela nao e desfeita pelo rollback e a compensacao do servico precisa alcanca-la.
  it('remove o conteúdo guardado quando a operação de banco não completa', async () => {
    const { lancamento, authorization } = await criarCenario();

    // Contado dentro do mock, logo depois da gravacao: sem isso o teste passaria mesmo que nada
    // tivesse sido gravado, e a compensacao ficaria sem cobertura de verdade.
    let guardadosAposGravar = -1;

    const spy = vi
      .spyOn(receiptRepository, 'createReceipt')
      .mockImplementation(async (_data, beforeCommit) => {
        await beforeCommit();
        guardadosAposGravar = await prisma.receiptFile.count();

        throw new Error('falha simulada depois da gravação do conteúdo');
      });

    try {
      const response = await request(createApp())
        .post(`/lancamentos/${lancamento.id}/comprovante`)
        .set('Authorization', authorization)
        .attach('arquivo', PDF, { filename: 'nota.pdf' });

      expect(response.status).toBe(500);
      expect(guardadosAposGravar).toBe(1);
      expect(await prisma.receiptFile.count()).toBe(0);
      expect(await prisma.receipt.count()).toBe(0);
    } finally {
      spy.mockRestore();
    }
  });

  it('recusa um driver desconhecido em vez de gravar em lugar nenhum', async () => {
    const { lancamento, authorization } = await criarCenario();
    process.env.STORAGE_DRIVER = 'inexistente';

    try {
      const response = await request(createApp())
        .post(`/lancamentos/${lancamento.id}/comprovante`)
        .set('Authorization', authorization)
        .attach('arquivo', PDF, { filename: 'nota.pdf' });

      expect(response.status).toBe(500);
      expect(await prisma.receipt.count()).toBe(0);
    } finally {
      process.env.STORAGE_DRIVER = 'database';
    }
  });
});
