import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import {
  createCategory,
  createMembership,
  createOrganization,
  createReceipt,
  createTransaction,
  createUser,
} from '../factories/index.js';
import { createAuthorizationHeader } from '../helpers/auth.js';

async function criarOrganizacaoComUsuario(role: 'TESOUREIRO' | 'CONSULTOR' = 'TESOUREIRO') {
  const user = await createUser();
  const organization = await createOrganization();
  await createMembership({ userId: user.id, organizationId: organization.id, role });

  return { user, organization, authorization: createAuthorizationHeader(user) };
}

describe('detalhe do lançamento (US24)', () => {
  it('Cenário 1 - consultar detalhe de lançamento exibe dados completos', async () => {
    const { user, organization, authorization } = await criarOrganizacaoComUsuario();
    const categoria = await createCategory({
      organizationId: organization.id,
      name: 'Material',
      type: 'SAIDA',
    });
    const lancamento = await createTransaction({
      organizationId: organization.id,
      userId: user.id,
      categoryId: categoria.id,
      type: 'SAIDA',
      amount: '75.50',
      date: new Date('2026-09-10T00:00:00.000Z'),
      description: 'Compra de material de escritório',
      source: null,
      recipient: 'Papelaria Central',
    });

    const response = await request(createApp())
      .get(`/transactions/${lancamento.id}`)
      .set('Authorization', authorization);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: lancamento.id.toString(),
      organizationId: organization.id.toString(),
      userId: user.id.toString(),
      categoryId: categoria.id.toString(),
      type: 'SAIDA',
      amount: '75.5',
      description: 'Compra de material de escritório',
      source: null,
      recipient: 'Papelaria Central',
      status: 'ATIVO',
      category: {
        id: categoria.id.toString(),
        name: 'Material',
        type: 'SAIDA',
      },
      user: {
        id: user.id.toString(),
        name: user.name,
        email: user.email,
      },
      receipt: null,
    });
  });

  it('Cenário 2 - detalhe inclui metadados do comprovante quando existe', async () => {
    const { user, organization, authorization } = await criarOrganizacaoComUsuario();
    const categoria = await createCategory({ organizationId: organization.id, type: 'SAIDA' });
    const lancamento = await createTransaction({
      organizationId: organization.id,
      userId: user.id,
      categoryId: categoria.id,
      type: 'SAIDA',
    });
    const comprovante = await createReceipt({
      transactionId: lancamento.id,
      fileName: 'nota-fiscal.pdf',
      fileType: 'application/pdf',
      size: 2048n,
      fileUrl: 'arquivo-interno.pdf',
      uploadedAt: new Date('2026-09-12T15:30:00.000Z'),
    });

    const response = await request(createApp())
      .get(`/transactions/${lancamento.id}`)
      .set('Authorization', authorization);

    expect(response.status).toBe(200);
    expect(response.body.receipt).toEqual({
      id: comprovante.id.toString(),
      fileName: 'nota-fiscal.pdf',
      fileType: 'application/pdf',
      size: '2048',
      fileUrl: 'arquivo-interno.pdf',
      uploadedAt: '2026-09-12T15:30:00.000Z',
    });
  });

  it('Cenário 3 - lançamento de outra organização retorna 404', async () => {
    const { authorization } = await criarOrganizacaoComUsuario();

    const outroUsuario = await createUser();
    const outraOrganizacao = await createOrganization();
    await createMembership({ userId: outroUsuario.id, organizationId: outraOrganizacao.id });
    const outraCategoria = await createCategory({
      organizationId: outraOrganizacao.id,
      type: 'ENTRADA',
    });
    const lancamentoAlheio = await createTransaction({
      organizationId: outraOrganizacao.id,
      userId: outroUsuario.id,
      categoryId: outraCategoria.id,
      type: 'ENTRADA',
    });

    const response = await request(createApp())
      .get(`/transactions/${lancamentoAlheio.id}`)
      .set('Authorization', authorization);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ erro: 'Lançamento não encontrado.' });
  });

  it('Cenário 4 - ID inválido retorna 400', async () => {
    const { authorization } = await criarOrganizacaoComUsuario();

    const response = await request(createApp())
      .get('/transactions/abc')
      .set('Authorization', authorization);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ erro: 'id é obrigatório.' });
  });

  it('Cenário 5 - consultor da organização pode consultar o detalhe', async () => {
    const tesoureiro = await createUser();
    const consultor = await createUser();
    const organization = await createOrganization();
    await createMembership({ userId: tesoureiro.id, organizationId: organization.id });
    await createMembership({
      userId: consultor.id,
      organizationId: organization.id,
      role: 'CONSULTOR',
    });
    const categoria = await createCategory({ organizationId: organization.id, type: 'ENTRADA' });
    const lancamento = await createTransaction({
      organizationId: organization.id,
      userId: tesoureiro.id,
      categoryId: categoria.id,
      type: 'ENTRADA',
      description: 'Entrada visível ao consultor',
    });

    const response = await request(createApp())
      .get(`/transactions/${lancamento.id}`)
      .set('Authorization', createAuthorizationHeader(consultor));

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(lancamento.id.toString());
    expect(response.body.description).toBe('Entrada visível ao consultor');
  });
});
