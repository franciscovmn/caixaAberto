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

describe('registro de entrada financeira (US18)', () => {
  it('Cenário 1 - registrar entrada válida retorna 201 com os dados do lançamento', async () => {
    const { organization, authorization } = await criarOrganizacaoComTesoureiro();
    const categoria = await createCategory({ organizationId: organization.id, type: 'ENTRADA' });

    const response = await request(createApp())
      .post('/transactions')
      .set('Authorization', authorization)
      .send({
        tipo: 'ENTRADA',
        categoryId: categoria.id.toString(),
        amount: '250.00',
        date: '2026-09-10',
        description: 'Doação recebida em evento',
        source: 'Rifa beneficente',
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      organizationId: organization.id.toString(),
      categoryId: categoria.id.toString(),
      type: 'ENTRADA',
      amount: '250',
      description: 'Doação recebida em evento',
      source: 'Rifa beneficente',
      status: 'ATIVO',
    });
  });

  it('Cenário 2 - descrição ausente retorna 400', async () => {
    const { organization, authorization } = await criarOrganizacaoComTesoureiro();
    const categoria = await createCategory({ organizationId: organization.id, type: 'ENTRADA' });

    const response = await request(createApp())
      .post('/transactions')
      .set('Authorization', authorization)
      .send({
        tipo: 'ENTRADA',
        categoryId: categoria.id.toString(),
        amount: '250.00',
        date: '2026-09-10',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      'categoryId, amount, date e description são obrigatórios e válidos.',
    );
  });

  it('Cenário 3 - valor zero ou negativo retorna 400', async () => {
    const { organization, authorization } = await criarOrganizacaoComTesoureiro();
    const categoria = await createCategory({ organizationId: organization.id, type: 'ENTRADA' });

    const valorZero = await request(createApp())
      .post('/transactions')
      .set('Authorization', authorization)
      .send({
        tipo: 'ENTRADA',
        categoryId: categoria.id.toString(),
        amount: '0',
        date: '2026-09-10',
        description: 'Entrada inválida',
      });

    expect(valorZero.status).toBe(400);

    const valorNegativo = await request(createApp())
      .post('/transactions')
      .set('Authorization', authorization)
      .send({
        tipo: 'ENTRADA',
        categoryId: categoria.id.toString(),
        amount: '-50.00',
        date: '2026-09-10',
        description: 'Entrada inválida',
      });

    expect(valorNegativo.status).toBe(400);
  });

  it('Cenário 4 - categoria do tipo SAIDA não é aceita para registrar entrada', async () => {
    const { organization, authorization } = await criarOrganizacaoComTesoureiro();
    const categoriaSaida = await createCategory({ organizationId: organization.id, type: 'SAIDA' });

    const response = await request(createApp())
      .post('/transactions')
      .set('Authorization', authorization)
      .send({
        tipo: 'ENTRADA',
        categoryId: categoriaSaida.id.toString(),
        amount: '100.00',
        date: '2026-09-10',
        description: 'Entrada com categoria incompatível',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      'Categoria não encontrada, inativa ou incompatível com o tipo do lançamento.',
    );
  });

  it('Cenário 5 - categoria de outra organização não é aceita', async () => {
    const { authorization } = await criarOrganizacaoComTesoureiro();
    const outraOrganizacao = await createOrganization();
    const categoriaDeOutraOrganizacao = await createCategory({
      organizationId: outraOrganizacao.id,
      type: 'ENTRADA',
    });

    const response = await request(createApp())
      .post('/transactions')
      .set('Authorization', authorization)
      .send({
        tipo: 'ENTRADA',
        categoryId: categoriaDeOutraOrganizacao.id.toString(),
        amount: '100.00',
        date: '2026-09-10',
        description: 'Entrada com categoria de outra organização',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      'Categoria não encontrada, inativa ou incompatível com o tipo do lançamento.',
    );
  });

  it('Cenário 6 - a entrada registrada afeta o saldo do resumo mensal', async () => {
    const { organization, authorization } = await criarOrganizacaoComTesoureiro();
    const categoria = await createCategory({ organizationId: organization.id, type: 'ENTRADA' });

    const resumoAntes = await request(createApp())
      .get('/transactions/resumo/mensal')
      .query({ mes: '2026-09' })
      .set('Authorization', authorization);

    expect(resumoAntes.body.entries).toBe('0');
    expect(resumoAntes.body.balance).toBe('0');

    const registro = await request(createApp())
      .post('/transactions')
      .set('Authorization', authorization)
      .send({
        tipo: 'ENTRADA',
        categoryId: categoria.id.toString(),
        amount: '300.00',
        date: '2026-09-15',
        description: 'Entrada que deve refletir no saldo',
      });

    expect(registro.status).toBe(201);

    const resumoDepois = await request(createApp())
      .get('/transactions/resumo/mensal')
      .query({ mes: '2026-09' })
      .set('Authorization', authorization);

    expect(resumoDepois.status).toBe(200);
    expect(resumoDepois.body.entries).toBe('300');
    expect(resumoDepois.body.balance).toBe('300');
  });
});
