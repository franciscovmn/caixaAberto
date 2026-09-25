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

async function criarOrganizacao(role: 'TESOUREIRO' | 'CONSULTOR' = 'TESOUREIRO') {
  const user = await createUser();
  const organization = await createOrganization();
  await createMembership({ userId: user.id, organizationId: organization.id, role });

  return { user, organization, authorization: createAuthorizationHeader(user) };
}

function excluir(id: bigint | string, authorization: string) {
  return request(createApp())
    .delete(`/categorias/${id.toString()}`)
    .set('Authorization', authorization);
}

async function estaAtiva(id: bigint) {
  const categoria = await prisma.category.findUniqueOrThrow({
    where: { id },
    select: { active: true },
  });

  return categoria.active;
}

describe('exclusão de categoria (US16)', () => {
  it('Cenário 1 - desativar categoria em uso', async () => {
    const { user, organization, authorization } = await criarOrganizacao();
    const doacao = await createCategory({
      organizationId: organization.id,
      name: 'Doação',
      type: 'ENTRADA',
    });
    const lancamento = await createTransaction({
      organizationId: organization.id,
      userId: user.id,
      categoryId: doacao.id,
      type: 'ENTRADA',
      amount: '120.00',
      date: new Date('2026-09-05T00:00:00.000Z'),
    });

    const response = await excluir(doacao.id, authorization);

    expect(response.status).toBe(204);
    expect(response.text).toBe('');
    expect(await estaAtiva(doacao.id)).toBe(false);

    // Some dos formularios: a lista de categorias deixa de oferece-la.
    const categorias = await request(createApp())
      .get('/categorias')
      .set('Authorization', authorization);
    expect(categorias.body.dados).toEqual([]);

    // E nao aceita lancamento novo.
    const novoLancamento = await request(createApp())
      .post('/transactions')
      .set('Authorization', authorization)
      .send({
        categoryId: doacao.id.toString(),
        amount: '50.00',
        date: '2026-09-17',
        description: 'Doação de setembro',
        tipo: 'ENTRADA',
      });
    expect(novoLancamento.status).toBe(400);

    // O que ja foi lancado continua exibindo a categoria.
    const detalhe = await request(createApp())
      .get(`/transactions/${lancamento.id}`)
      .set('Authorization', authorization);
    expect(detalhe.body.category).toMatchObject({ id: doacao.id.toString(), name: 'Doação' });

    const extrato = await request(createApp())
      .get('/extrato')
      .query({ dataInicio: '2026-09-01', dataFim: '2026-09-30' })
      .set('Authorization', authorization);
    expect(extrato.body.linhas).toEqual([
      expect.objectContaining({
        valor: '120.00',
        categoria: { id: doacao.id.toString(), nome: 'Doação' },
      }),
    ]);
  });

  it('não afeta a categoria de mesmo nome de outra organização', async () => {
    const { organization, authorization } = await criarOrganizacao();
    const outra = await createOrganization();
    const doacao = await createCategory({
      organizationId: organization.id,
      name: 'Doação',
      type: 'ENTRADA',
    });
    const doacaoDeOutra = await createCategory({
      organizationId: outra.id,
      name: 'Doação',
      type: 'ENTRADA',
    });

    const response = await excluir(doacao.id, authorization);

    expect(response.status).toBe(204);
    expect(await estaAtiva(doacaoDeOutra.id)).toBe(true);
  });

  it('trata categoria de outra organização como inexistente e não a desativa', async () => {
    const { authorization } = await criarOrganizacao();
    const outra = await createOrganization();
    const deOutra = await createCategory({ organizationId: outra.id, type: 'SAIDA' });

    const response = await excluir(deOutra.id, authorization);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ erro: 'Categoria não encontrada' });
    expect(await estaAtiva(deOutra.id)).toBe(true);
  });

  it('responde 404 ao excluir de novo uma categoria já desativada', async () => {
    const { organization, authorization } = await criarOrganizacao();
    const desativada = await createCategory({
      organizationId: organization.id,
      type: 'SAIDA',
      active: false,
    });

    const response = await excluir(desativada.id, authorization);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ erro: 'Categoria não encontrada' });
  });

  it('responde 404 para categoria inexistente', async () => {
    const { authorization } = await criarOrganizacao();

    const response = await excluir('999999', authorization);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ erro: 'Categoria não encontrada' });
  });

  it('rejeita ID inválido', async () => {
    const { authorization } = await criarOrganizacao();

    const response = await excluir('abc', authorization);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      erro: 'Dados inválidos',
      campos: { id: 'Informe um identificador numérico' },
    });
  });

  it('recusa a exclusão feita por CONSULTOR', async () => {
    const { organization, authorization } = await criarOrganizacao('CONSULTOR');
    const material = await createCategory({ organizationId: organization.id, type: 'SAIDA' });

    const response = await excluir(material.id, authorization);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ erro: 'Acesso permitido apenas para TESOUREIRO' });
    expect(await estaAtiva(material.id)).toBe(true);
  });

  it('rejeita requisição sem token de autenticação', async () => {
    const response = await request(createApp()).delete('/categorias/1');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ erro: 'Token de autenticação não fornecido.' });
  });
});
