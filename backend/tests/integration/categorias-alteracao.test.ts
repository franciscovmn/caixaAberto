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

function alterar(id: bigint | string, authorization: string, body: object) {
  return request(createApp())
    .put(`/categorias/${id.toString()}`)
    .set('Authorization', authorization)
    .send(body);
}

async function lerCategoria(id: bigint) {
  return prisma.category.findUniqueOrThrow({
    where: { id },
    select: { name: true, description: true, type: true, active: true },
  });
}

describe('alteração de categoria (US15)', () => {
  it('Cenário 1 - renomear categoria', async () => {
    const { user, organization, authorization } = await criarOrganizacao();
    const material = await createCategory({
      organizationId: organization.id,
      name: 'Material',
      description: 'Papelaria',
      type: 'SAIDA',
    });
    const lancamento = await createTransaction({
      organizationId: organization.id,
      userId: user.id,
      categoryId: material.id,
      type: 'SAIDA',
      amount: '75.50',
      date: new Date('2026-09-10T00:00:00.000Z'),
    });

    const response = await alterar(material.id, authorization, { nome: 'Material de evento' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: material.id.toString(),
      nome: 'Material de evento',
      descricao: 'Papelaria',
      tipo: 'SAIDA',
    });

    const detalhe = await request(createApp())
      .get(`/transactions/${lancamento.id}`)
      .set('Authorization', authorization);
    expect(detalhe.body).toMatchObject({
      amount: '75.5',
      category: { id: material.id.toString(), name: 'Material de evento' },
    });

    const extrato = await request(createApp())
      .get('/extrato')
      .query({ dataInicio: '2026-09-01', dataFim: '2026-09-30' })
      .set('Authorization', authorization);
    expect(extrato.body.linhas).toEqual([
      expect.objectContaining({
        valor: '75.50',
        categoria: { id: material.id.toString(), nome: 'Material de evento' },
      }),
    ]);
  });

  it('altera descrição e tipo de categoria ainda sem lançamentos', async () => {
    const { organization, authorization } = await criarOrganizacao();
    const eventos = await createCategory({
      organizationId: organization.id,
      name: 'Eventos',
      type: 'SAIDA',
    });

    const response = await alterar(eventos.id, authorization, {
      descricao: 'Venda de ingressos',
      tipo: 'ENTRADA',
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: eventos.id.toString(),
      nome: 'Eventos',
      descricao: 'Venda de ingressos',
      tipo: 'ENTRADA',
    });
  });

  it('recusa trocar o tipo de categoria que já tem lançamentos', async () => {
    const { user, organization, authorization } = await criarOrganizacao();
    const material = await createCategory({
      organizationId: organization.id,
      name: 'Material',
      type: 'SAIDA',
    });
    await createTransaction({
      organizationId: organization.id,
      userId: user.id,
      categoryId: material.id,
      type: 'SAIDA',
    });

    const response = await alterar(material.id, authorization, { tipo: 'ENTRADA' });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ erro: 'Categoria com lançamentos não pode mudar de tipo' });
    expect((await lerCategoria(material.id)).type).toBe('SAIDA');
  });

  it('recusa o nome de outra categoria do mesmo tipo, sem diferenciar maiúsculas', async () => {
    const { organization, authorization } = await criarOrganizacao();
    await createCategory({ organizationId: organization.id, name: 'Transporte', type: 'SAIDA' });
    const viagens = await createCategory({
      organizationId: organization.id,
      name: 'Viagens',
      type: 'SAIDA',
    });

    const response = await alterar(viagens.id, authorization, { nome: 'TRANSPORTE' });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ erro: 'Já existe uma categoria com esse nome e tipo' });
    expect((await lerCategoria(viagens.id)).name).toBe('Viagens');
  });

  it('recusa o nome de categoria desativada do mesmo tipo', async () => {
    const { organization, authorization } = await criarOrganizacao();
    await createCategory({
      organizationId: organization.id,
      name: 'Transporte',
      type: 'SAIDA',
      active: false,
    });
    const viagens = await createCategory({
      organizationId: organization.id,
      name: 'Viagens',
      type: 'SAIDA',
    });

    const response = await alterar(viagens.id, authorization, { nome: 'Transporte' });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      erro: 'Já existe uma categoria desativada com esse nome e tipo',
    });
  });

  it('recusa trocar para um tipo em que o nome já existe', async () => {
    const { organization, authorization } = await criarOrganizacao();
    await createCategory({ organizationId: organization.id, name: 'Eventos', type: 'ENTRADA' });
    const eventosSaida = await createCategory({
      organizationId: organization.id,
      name: 'Eventos',
      type: 'SAIDA',
    });

    const response = await alterar(eventosSaida.id, authorization, { tipo: 'ENTRADA' });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ erro: 'Já existe uma categoria com esse nome e tipo' });
  });

  it('permite corrigir só as maiúsculas do próprio nome', async () => {
    const { organization, authorization } = await criarOrganizacao();
    const material = await createCategory({
      organizationId: organization.id,
      name: 'material',
      type: 'SAIDA',
    });

    const response = await alterar(material.id, authorization, { nome: 'Material' });

    expect(response.status).toBe(200);
    expect(response.body.nome).toBe('Material');
  });

  it('trata categoria desativada como inexistente', async () => {
    const { organization, authorization } = await criarOrganizacao();
    const desativada = await createCategory({
      organizationId: organization.id,
      name: 'Antiga',
      type: 'SAIDA',
      active: false,
    });

    const response = await alterar(desativada.id, authorization, { nome: 'Renovada' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ erro: 'Categoria não encontrada' });
    expect((await lerCategoria(desativada.id)).name).toBe('Antiga');
  });

  it('trata categoria de outra organização como inexistente e não a altera', async () => {
    const { authorization } = await criarOrganizacao();
    const outra = await createOrganization();
    const deOutra = await createCategory({
      organizationId: outra.id,
      name: 'Aluguel',
      type: 'SAIDA',
    });

    const response = await alterar(deOutra.id, authorization, { nome: 'Invadida' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ erro: 'Categoria não encontrada' });
    expect((await lerCategoria(deOutra.id)).name).toBe('Aluguel');
  });

  it('rejeita corpo sem nenhum campo', async () => {
    const { organization, authorization } = await criarOrganizacao();
    const material = await createCategory({ organizationId: organization.id, type: 'SAIDA' });

    const response = await alterar(material.id, authorization, {});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      erro: 'Dados inválidos',
      campos: { requisicao: 'Informe ao menos um campo para alterar' },
    });
  });

  it('rejeita desativar pela alteração, que é papel da exclusão', async () => {
    const { organization, authorization } = await criarOrganizacao();
    const material = await createCategory({ organizationId: organization.id, type: 'SAIDA' });

    const response = await alterar(material.id, authorization, { ativa: false });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      erro: 'Dados inválidos',
      campos: { requisicao: 'Chave inválida: "ativa"' },
    });
    expect((await lerCategoria(material.id)).active).toBe(true);
  });

  it('rejeita ID inválido', async () => {
    const { authorization } = await criarOrganizacao();

    const response = await alterar('abc', authorization, { nome: 'Material' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      erro: 'Dados inválidos',
      campos: { id: 'Informe um identificador numérico' },
    });
  });

  it('recusa a alteração feita por CONSULTOR', async () => {
    const { organization, authorization } = await criarOrganizacao('CONSULTOR');
    const material = await createCategory({
      organizationId: organization.id,
      name: 'Material',
      type: 'SAIDA',
    });

    const response = await alterar(material.id, authorization, { nome: 'Outro' });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ erro: 'Acesso permitido apenas para TESOUREIRO' });
    expect((await lerCategoria(material.id)).name).toBe('Material');
  });

  it('rejeita requisição sem token de autenticação', async () => {
    const response = await request(createApp()).put('/categorias/1').send({ nome: 'Material' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ erro: 'Token de autenticação não fornecido.' });
  });
});
