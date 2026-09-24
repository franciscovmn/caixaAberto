import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { prisma } from '../../src/database/client.js';
import {
  createCategory,
  createMembership,
  createOrganization,
  createTransaction,
  createUser,
} from '../factories/index.js';
import { createAuthorizationHeader } from '../helpers/auth.js';

const PERIODO = { dataInicio: '2026-09-01', dataFim: '2026-09-30' };

async function criarCenario(role: 'TESOUREIRO' | 'CONSULTOR' = 'TESOUREIRO') {
  const user = await createUser();
  const organization = await createOrganization();
  await createMembership({ userId: user.id, organizationId: organization.id, role });
  const mensalidades = await createCategory({
    organizationId: organization.id,
    name: 'Mensalidades',
    type: 'ENTRADA',
  });

  return {
    organization,
    mensalidades,
    authorization: createAuthorizationHeader(user),
    base: { organizationId: organization.id, userId: user.id, categoryId: mensalidades.id },
  };
}

function estornar(id: bigint | string, authorization: string) {
  return request(createApp())
    .post(`/lancamentos/${id.toString()}/estorno`)
    .set('Authorization', authorization);
}

async function lerEstado(id: bigint) {
  return prisma.transaction.findUniqueOrThrow({
    where: { id },
    select: { status: true, reversedAt: true },
  });
}

describe('estorno de lançamento (US21)', () => {
  it('Cenário 1 - estornar lançamento ativo', async () => {
    const { authorization, base } = await criarCenario();
    const entrada = await createTransaction({
      ...base,
      type: 'ENTRADA',
      amount: '100.00',
      date: new Date('2026-09-01T00:00:00.000Z'),
    });
    await createTransaction({
      ...base,
      type: 'ENTRADA',
      amount: '250.00',
      date: new Date('2026-09-02T00:00:00.000Z'),
    });

    const antes = await request(createApp())
      .get('/extrato')
      .query(PERIODO)
      .set('Authorization', authorization);
    expect(antes.body.saldoFinal).toBe('350.00');

    const response = await estornar(entrada.id, authorization);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: entrada.id.toString(),
      status: 'ESTORNADO',
      dataEstorno: expect.any(String),
    });

    const estado = await lerEstado(entrada.id);
    expect(estado.status).toBe('ESTORNADO');
    expect(estado.reversedAt?.toISOString()).toBe(response.body.dataEstorno);

    const depois = await request(createApp())
      .get('/extrato')
      .query(PERIODO)
      .set('Authorization', authorization);
    expect(depois.body.saldoFinal).toBe('250.00');
  });

  it('Cenário 2 - estorno duplicado', async () => {
    const { authorization, base } = await criarCenario();
    const dataEstorno = new Date('2026-09-12T10:00:00.000Z');
    const estornado = await createTransaction({
      ...base,
      status: 'ESTORNADO',
      reversedAt: dataEstorno,
    });

    const response = await estornar(estornado.id, authorization);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ erro: 'Lançamento já está estornado' });
    expect(await lerEstado(estornado.id)).toEqual({
      status: 'ESTORNADO',
      reversedAt: dataEstorno,
    });
  });

  it('estorna uma única vez quando dois pedidos chegam juntos', async () => {
    const { authorization, base } = await criarCenario();
    const entrada = await createTransaction(base);

    const respostas = await Promise.all([
      estornar(entrada.id, authorization),
      estornar(entrada.id, authorization),
    ]);

    expect(respostas.map((resposta) => resposta.status).sort()).toEqual([200, 409]);

    const sucesso = respostas.find((resposta) => resposta.status === 200);
    const estado = await lerEstado(entrada.id);
    expect(estado.reversedAt?.toISOString()).toBe(sucesso?.body.dataEstorno);
  });

  it('o lançamento estornado continua consultável no detalhe e no extrato', async () => {
    const { authorization, base } = await criarCenario();
    const entrada = await createTransaction({
      ...base,
      amount: '100.00',
      date: new Date('2026-09-05T00:00:00.000Z'),
    });

    const estorno = await estornar(entrada.id, authorization);
    expect(estorno.status).toBe(200);

    const detalhe = await request(createApp())
      .get(`/transactions/${entrada.id}`)
      .set('Authorization', authorization);
    expect(detalhe.status).toBe(200);
    expect(detalhe.body).toMatchObject({
      id: entrada.id.toString(),
      status: 'ESTORNADO',
      reversedAt: estorno.body.dataEstorno,
    });

    const extrato = await request(createApp())
      .get('/extrato')
      .query(PERIODO)
      .set('Authorization', authorization);
    expect(extrato.body.linhas).toEqual([
      expect.objectContaining({
        id: entrada.id.toString(),
        status: 'ESTORNADO',
        valor: '100.00',
        saldoAcumulado: '0.00',
      }),
    ]);
  });

  it('o lançamento estornado deixa de contar no resumo mensal e no relatório por categoria', async () => {
    const { authorization, base, mensalidades } = await criarCenario();
    const estornada = await createTransaction({
      ...base,
      amount: '100.00',
      date: new Date('2026-09-03T00:00:00.000Z'),
    });
    await createTransaction({
      ...base,
      amount: '250.00',
      date: new Date('2026-09-04T00:00:00.000Z'),
    });

    expect((await estornar(estornada.id, authorization)).status).toBe(200);

    const resumo = await request(createApp())
      .get('/transactions/resumo/mensal')
      .query({ mes: '2026-09' })
      .set('Authorization', authorization);
    expect(resumo.status).toBe(200);
    expect(resumo.body).toMatchObject({ entries: '250', exits: '0', balance: '250' });

    const relatorio = await request(createApp())
      .get('/relatorios/categorias')
      .query(PERIODO)
      .set('Authorization', authorization);
    expect(relatorio.status).toBe(200);
    expect(relatorio.body.categorias).toEqual([
      { id: mensalidades.id.toString(), nome: 'Mensalidades', tipo: 'ENTRADA', total: '250.00' },
    ]);
    expect(relatorio.body.totais).toEqual({ entradas: '250.00', saidas: '0.00' });
  });

  it('aceita o pedido com corpo JSON vazio', async () => {
    const { authorization, base } = await criarCenario();
    const entrada = await createTransaction(base);

    const response = await estornar(entrada.id, authorization).send({});

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ESTORNADO');
  });

  it('recusa o estorno feito por CONSULTOR', async () => {
    const { authorization, base } = await criarCenario('CONSULTOR');
    const entrada = await createTransaction(base);

    const response = await estornar(entrada.id, authorization);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ erro: 'Acesso permitido apenas para TESOUREIRO' });
    expect(await lerEstado(entrada.id)).toEqual({ status: 'ATIVO', reversedAt: null });
  });

  it('trata lançamento de outra organização como inexistente e não o altera', async () => {
    const { authorization } = await criarCenario();
    const outra = await criarCenario();
    const lancamentoDeOutra = await createTransaction(outra.base);

    const response = await estornar(lancamentoDeOutra.id, authorization);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ erro: 'Lançamento não encontrado' });
    expect(await lerEstado(lancamentoDeOutra.id)).toEqual({ status: 'ATIVO', reversedAt: null });
  });

  it('responde 404 para lançamento inexistente', async () => {
    const { authorization } = await criarCenario();

    const response = await estornar('999999', authorization);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ erro: 'Lançamento não encontrado' });
  });

  it('rejeita ID inválido', async () => {
    const { authorization } = await criarCenario();

    const response = await estornar('abc', authorization);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      erro: 'Dados inválidos',
      campos: { id: 'Informe um identificador numérico' },
    });
  });

  it('rejeita propriedade desconhecida no corpo sem estornar', async () => {
    const { authorization, base } = await criarCenario();
    const entrada = await createTransaction(base);

    const response = await estornar(entrada.id, authorization).send({
      motivo: 'Lançado em duplicidade',
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      erro: 'Dados inválidos',
      campos: { requisicao: 'Chave inválida: "motivo"' },
    });
    expect(await lerEstado(entrada.id)).toEqual({ status: 'ATIVO', reversedAt: null });
  });

  it('rejeita requisição sem token de autenticação', async () => {
    const { base } = await criarCenario();
    const entrada = await createTransaction(base);

    const response = await request(createApp()).post(`/lancamentos/${entrada.id}/estorno`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ erro: 'Token de autenticação não fornecido.' });
  });
});
