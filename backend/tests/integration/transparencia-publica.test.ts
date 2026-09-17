import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import {
  createCategory,
  createMembership,
  createOrganization,
  createTransaction,
  createUser,
} from '../factories/index.js';

async function criarOrganizacaoPublica() {
  const user = await createUser({
    name: 'Tesoureira LGPD',
    email: 'tesoureira-lgpd@example.test',
  });
  const organization = await createOrganization({
    name: 'Comissão de Formatura',
    description: 'Prestação pública de contas da comissão',
    publicLink: 'token-publico-us32',
    transparencyActive: true,
  });
  await createMembership({ userId: user.id, organizationId: organization.id });
  const entrada = await createCategory({
    organizationId: organization.id,
    name: 'Mensalidades',
    type: 'ENTRADA',
  });
  const saida = await createCategory({
    organizationId: organization.id,
    name: 'Material',
    type: 'SAIDA',
  });

  return {
    user,
    organization,
    entrada,
    saida,
    base: { organizationId: organization.id, userId: user.id },
  };
}

describe('transparência pública (US32)', () => {
  it('Cenário 1 - página pública ativa exibe totais e categorias do mês', async () => {
    const { organization, base, entrada, saida } = await criarOrganizacaoPublica();

    await createTransaction({
      ...base,
      categoryId: entrada.id,
      type: 'ENTRADA',
      amount: '300.00',
      date: new Date('2026-09-03T00:00:00.000Z'),
    });
    await createTransaction({
      ...base,
      categoryId: saida.id,
      type: 'SAIDA',
      amount: '125.50',
      date: new Date('2026-09-10T00:00:00.000Z'),
    });

    const response = await request(createApp())
      .get('/transparency/token-publico-us32')
      .query({ mes: '2026-09' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      organization: {
        id: organization.id.toString(),
        name: 'Comissão de Formatura',
        description: 'Prestação pública de contas da comissão',
      },
      month: '2026-09',
      totals: {
        entries: '300',
        exits: '125.5',
        balance: '174.5',
      },
      privacy: {
        personalFieldsHidden: true,
      },
    });
    expect(response.body.byCategory).toEqual(
      expect.arrayContaining([
        { type: 'ENTRADA', category: 'Mensalidades', total: '300', count: 1 },
        { type: 'SAIDA', category: 'Material', total: '125.5', count: 1 },
      ]),
    );
  });

  it('Cenário 2 - link desativado retorna 404', async () => {
    await createOrganization({
      publicLink: 'token-desativado-us32',
      transparencyActive: false,
    });

    const response = await request(createApp())
      .get('/transparency/token-desativado-us32')
      .query({ mes: '2026-09' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: 'Página de transparência não encontrada ou desativada.',
    });
  });

  it('Cenário 3 - token inexistente retorna 404', async () => {
    const response = await request(createApp())
      .get('/transparency/token-inexistente')
      .query({ mes: '2026-09' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: 'Página de transparência não encontrada ou desativada.',
    });
  });

  it('Cenário 4 - dados pessoais ficam ocultos na resposta pública', async () => {
    const { user, base, entrada } = await criarOrganizacaoPublica();
    await createTransaction({
      ...base,
      categoryId: entrada.id,
      type: 'ENTRADA',
      amount: '90.00',
      date: new Date('2026-09-08T00:00:00.000Z'),
    });

    const response = await request(createApp())
      .get('/transparency/token-publico-us32')
      .query({ mes: '2026-09' });

    expect(response.status).toBe(200);
    expect(response.body.privacy).toEqual({ personalFieldsHidden: true });
    expect(response.body).not.toHaveProperty('transactions');
    expect(JSON.stringify(response.body)).not.toContain(user.name);
    expect(JSON.stringify(response.body)).not.toContain(user.email);
  });

  it('Cenário 5 - lançamentos estornados não entram nos totais públicos', async () => {
    const { base, entrada, saida } = await criarOrganizacaoPublica();

    await createTransaction({
      ...base,
      categoryId: entrada.id,
      type: 'ENTRADA',
      amount: '200.00',
      date: new Date('2026-09-01T00:00:00.000Z'),
    });
    await createTransaction({
      ...base,
      categoryId: saida.id,
      type: 'SAIDA',
      amount: '999.00',
      date: new Date('2026-09-02T00:00:00.000Z'),
      status: 'ESTORNADO',
      reversedAt: new Date('2026-09-03T10:00:00.000Z'),
    });

    const response = await request(createApp())
      .get('/transparency/token-publico-us32')
      .query({ mes: '2026-09' });

    expect(response.status).toBe(200);
    expect(response.body.totals).toEqual({
      entries: '200',
      exits: '0',
      balance: '200',
    });
    expect(response.body.byCategory).toEqual([
      { type: 'ENTRADA', category: 'Mensalidades', total: '200', count: 1 },
    ]);
  });

  it('Cenário 6 - considera apenas dados da organização dona do link', async () => {
    const { base, entrada } = await criarOrganizacaoPublica();
    await createTransaction({
      ...base,
      categoryId: entrada.id,
      type: 'ENTRADA',
      amount: '50.00',
      date: new Date('2026-09-10T00:00:00.000Z'),
    });

    const outroUsuario = await createUser();
    const outraOrganizacao = await createOrganization({
      publicLink: 'token-outra-organizacao',
      transparencyActive: true,
    });
    await createMembership({ userId: outroUsuario.id, organizationId: outraOrganizacao.id });
    const outraCategoria = await createCategory({
      organizationId: outraOrganizacao.id,
      name: 'Mensalidades',
      type: 'ENTRADA',
    });
    await createTransaction({
      organizationId: outraOrganizacao.id,
      userId: outroUsuario.id,
      categoryId: outraCategoria.id,
      type: 'ENTRADA',
      amount: '7000.00',
      date: new Date('2026-09-10T00:00:00.000Z'),
    });

    const response = await request(createApp())
      .get('/transparency/token-publico-us32')
      .query({ mes: '2026-09' });

    expect(response.status).toBe(200);
    expect(response.body.totals).toEqual({
      entries: '50',
      exits: '0',
      balance: '50',
    });
  });

  it('Cenário 7 - mês inválido retorna 400', async () => {
    await criarOrganizacaoPublica();

    const response = await request(createApp())
      .get('/transparency/token-publico-us32')
      .query({ mes: '2026-13' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'mes deve estar no formato YYYY-MM.' });
  });
});
