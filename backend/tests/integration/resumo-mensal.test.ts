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
import { createAuthorizationHeader } from '../helpers/auth.js';

async function criarCenarioBase() {
  const user = await createUser();
  const organization = await createOrganization();
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
    authorization: createAuthorizationHeader(user),
    base: { organizationId: organization.id, userId: user.id },
  };
}

describe('resumo financeiro mensal (US29)', () => {
  it('Cenário 1 - resumo do mês com entradas, saídas e saldo', async () => {
    const { authorization, base, entrada, saida } = await criarCenarioBase();

    await createTransaction({
      ...base,
      categoryId: entrada.id,
      type: 'ENTRADA',
      amount: '300.00',
      date: new Date('2026-09-03T00:00:00.000Z'),
    });
    await createTransaction({
      ...base,
      categoryId: entrada.id,
      type: 'ENTRADA',
      amount: '120.50',
      date: new Date('2026-09-10T00:00:00.000Z'),
    });
    await createTransaction({
      ...base,
      categoryId: saida.id,
      type: 'SAIDA',
      amount: '80.25',
      date: new Date('2026-09-12T00:00:00.000Z'),
    });

    const response = await request(createApp())
      .get('/transactions/resumo/mensal')
      .query({ mes: '2026-09' })
      .set('Authorization', authorization);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      month: '2026-09',
      entries: '420.5',
      exits: '80.25',
      balance: '340.25',
      previousMonth: {
        month: '2026-08',
        entries: '0',
        exits: '0',
        balance: '0',
      },
    });
  });

  it('Cenário 2 - mês sem lançamentos retorna totais zerados', async () => {
    const { authorization } = await criarCenarioBase();

    const response = await request(createApp())
      .get('/transactions/resumo/mensal')
      .query({ mes: '2026-09' })
      .set('Authorization', authorization);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      month: '2026-09',
      entries: '0',
      exits: '0',
      balance: '0',
      previousMonth: {
        month: '2026-08',
        entries: '0',
        exits: '0',
        balance: '0',
      },
    });
  });

  it('Cenário 3 - lançamentos estornados não entram no resumo', async () => {
    const { authorization, base, entrada, saida } = await criarCenarioBase();

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
      .get('/transactions/resumo/mensal')
      .query({ mes: '2026-09' })
      .set('Authorization', authorization);

    expect(response.status).toBe(200);
    expect(response.body.entries).toBe('200');
    expect(response.body.exits).toBe('0');
    expect(response.body.balance).toBe('200');
  });

  it('Cenário 4 - resumo inclui comparativo do mês anterior', async () => {
    const { authorization, base, entrada, saida } = await criarCenarioBase();

    await createTransaction({
      ...base,
      categoryId: entrada.id,
      type: 'ENTRADA',
      amount: '500.00',
      date: new Date('2026-08-05T00:00:00.000Z'),
    });
    await createTransaction({
      ...base,
      categoryId: saida.id,
      type: 'SAIDA',
      amount: '150.00',
      date: new Date('2026-08-20T00:00:00.000Z'),
    });
    await createTransaction({
      ...base,
      categoryId: saida.id,
      type: 'SAIDA',
      amount: '40.00',
      date: new Date('2026-09-10T00:00:00.000Z'),
    });

    const response = await request(createApp())
      .get('/transactions/resumo/mensal')
      .query({ mes: '2026-09' })
      .set('Authorization', authorization);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      month: '2026-09',
      entries: '0',
      exits: '40',
      balance: '-40',
      previousMonth: {
        month: '2026-08',
        entries: '500',
        exits: '150',
        balance: '350',
      },
    });
  });

  it('Cenário 5 - resumo considera apenas dados da organização atual', async () => {
    const { authorization, base, entrada } = await criarCenarioBase();

    await createTransaction({
      ...base,
      categoryId: entrada.id,
      type: 'ENTRADA',
      amount: '90.00',
      date: new Date('2026-09-10T00:00:00.000Z'),
    });

    const outroUsuario = await createUser();
    const outraOrganizacao = await createOrganization();
    await createMembership({ userId: outroUsuario.id, organizationId: outraOrganizacao.id });
    const outraCategoria = await createCategory({
      organizationId: outraOrganizacao.id,
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
      .get('/transactions/resumo/mensal')
      .query({ mes: '2026-09' })
      .set('Authorization', authorization);

    expect(response.status).toBe(200);
    expect(response.body.entries).toBe('90');
    expect(response.body.balance).toBe('90');
  });

  it('Cenário 6 - mês inválido retorna 400', async () => {
    const { authorization } = await criarCenarioBase();

    const response = await request(createApp())
      .get('/transactions/resumo/mensal')
      .query({ mes: '2026-13' })
      .set('Authorization', authorization);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'mes deve estar no formato YYYY-MM.' });
  });
});
