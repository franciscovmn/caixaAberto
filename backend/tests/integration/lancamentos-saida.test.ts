import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import {
  createCategory,
  createMembership,
  createOrganization,
  createUser,
} from '../factories/index.js';
import { createAuthorizationHeader } from '../helpers/auth.js';

async function criarOrganizacaoComTesoureiro() {
  const user = await createUser();
  const organization = await createOrganization();
  await createMembership({ userId: user.id, organizationId: organization.id });

  return { user, organization, authorization: createAuthorizationHeader(user) };
}

describe('registro de saída financeira (US19)', () => {
  it('Cenário 1 - registrar saída válida retorna 201 com destinatário', async () => {
    const { organization, authorization } = await criarOrganizacaoComTesoureiro();
    const categoria = await createCategory({ organizationId: organization.id, type: 'SAIDA' });

    const response = await request(createApp())
      .post('/transactions')
      .set('Authorization', authorization)
      .send({
        tipo: 'SAIDA',
        categoryId: categoria.id.toString(),
        amount: '180.50',
        date: '2026-09-12',
        description: 'Compra de materiais para o evento',
        recipient: 'Papelaria Central',
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      organizationId: organization.id.toString(),
      categoryId: categoria.id.toString(),
      type: 'SAIDA',
      amount: '180.5',
      description: 'Compra de materiais para o evento',
      recipient: 'Papelaria Central',
      source: null,
      status: 'ATIVO',
    });
  });

  it('Cenário 2 - valor zero ou negativo retorna 400', async () => {
    const { organization, authorization } = await criarOrganizacaoComTesoureiro();
    const categoria = await createCategory({ organizationId: organization.id, type: 'SAIDA' });

    const valorZero = await request(createApp())
      .post('/transactions')
      .set('Authorization', authorization)
      .send({
        tipo: 'SAIDA',
        categoryId: categoria.id.toString(),
        amount: '0',
        date: '2026-09-12',
        description: 'Saída inválida',
        recipient: 'Fornecedor',
      });

    expect(valorZero.status).toBe(400);

    const valorNegativo = await request(createApp())
      .post('/transactions')
      .set('Authorization', authorization)
      .send({
        tipo: 'SAIDA',
        categoryId: categoria.id.toString(),
        amount: '-10.00',
        date: '2026-09-12',
        description: 'Saída inválida',
        recipient: 'Fornecedor',
      });

    expect(valorNegativo.status).toBe(400);
  });

  it('Cenário 3 - categoria do tipo ENTRADA não é aceita para registrar saída', async () => {
    const { organization, authorization } = await criarOrganizacaoComTesoureiro();
    const categoriaEntrada = await createCategory({
      organizationId: organization.id,
      type: 'ENTRADA',
    });

    const response = await request(createApp())
      .post('/transactions')
      .set('Authorization', authorization)
      .send({
        tipo: 'SAIDA',
        categoryId: categoriaEntrada.id.toString(),
        amount: '100.00',
        date: '2026-09-12',
        description: 'Saída com categoria incompatível',
        recipient: 'Fornecedor',
      });

    expect(response.status).toBe(400);
    expect(response.body.erro).toBe(
      'Categoria não encontrada, inativa ou incompatível com o tipo do lançamento.',
    );
  });

  it('Cenário 4 - categoria de outra organização não é aceita', async () => {
    const { authorization } = await criarOrganizacaoComTesoureiro();
    const outraOrganizacao = await createOrganization();
    const categoriaDeOutraOrganizacao = await createCategory({
      organizationId: outraOrganizacao.id,
      type: 'SAIDA',
    });

    const response = await request(createApp())
      .post('/transactions')
      .set('Authorization', authorization)
      .send({
        tipo: 'SAIDA',
        categoryId: categoriaDeOutraOrganizacao.id.toString(),
        amount: '100.00',
        date: '2026-09-12',
        description: 'Saída com categoria de outra organização',
        recipient: 'Fornecedor',
      });

    expect(response.status).toBe(400);
    expect(response.body.erro).toBe(
      'Categoria não encontrada, inativa ou incompatível com o tipo do lançamento.',
    );
  });

  it('Cenário 5 - a saída registrada reduz o saldo do resumo mensal', async () => {
    const { organization, authorization } = await criarOrganizacaoComTesoureiro();
    const categoria = await createCategory({ organizationId: organization.id, type: 'SAIDA' });

    const resumoAntes = await request(createApp())
      .get('/transactions/resumo/mensal')
      .query({ mes: '2026-09' })
      .set('Authorization', authorization);

    expect(resumoAntes.body.exits).toBe('0');
    expect(resumoAntes.body.balance).toBe('0');

    const registro = await request(createApp())
      .post('/transactions')
      .set('Authorization', authorization)
      .send({
        tipo: 'SAIDA',
        categoryId: categoria.id.toString(),
        amount: '120.00',
        date: '2026-09-12',
        description: 'Pagamento de fornecedor',
        recipient: 'Fornecedor do evento',
      });

    expect(registro.status).toBe(201);

    const resumoDepois = await request(createApp())
      .get('/transactions/resumo/mensal')
      .query({ mes: '2026-09' })
      .set('Authorization', authorization);

    expect(resumoDepois.status).toBe(200);
    expect(resumoDepois.body.exits).toBe('120');
    expect(resumoDepois.body.balance).toBe('-120');
  });
});
