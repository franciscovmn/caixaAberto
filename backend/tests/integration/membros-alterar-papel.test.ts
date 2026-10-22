import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { prisma } from '../../src/database/client.js';
import {
  createCategory,
  createMembership,
  createOrganization,
  createUser,
} from '../factories/index.js';
import { createAuthorizationHeader } from '../helpers/auth.js';

async function setup(role: 'TESOUREIRO' | 'CONSULTOR' = 'TESOUREIRO') {
  const actor = await createUser();
  const organization = await createOrganization();
  const actorMembership = await createMembership({
    userId: actor.id,
    organizationId: organization.id,
    role,
  });
  const member = await createUser();
  const membership = await createMembership({
    userId: member.id,
    organizationId: organization.id,
    role: 'CONSULTOR',
  });
  return {
    actor,
    organization,
    actorMembership,
    member,
    membership,
    authorization: createAuthorizationHeader(actor),
  };
}

function alterar(id: bigint | string, authorization: string, body: object) {
  return request(createApp())
    .put(`/membros/${id.toString()}/papel`)
    .set('Authorization', authorization)
    .send(body);
}

describe('alterar papel de membro (US10)', () => {
  it('Cenário 1 - promover membro a tesoureiro', async () => {
    const ctx = await setup();
    const categoria = await createCategory({
      organizationId: ctx.organization.id,
      type: 'ENTRADA',
    });
    const memberAuthorization = createAuthorizationHeader(ctx.member);
    const lancamento = {
      tipo: 'ENTRADA',
      categoryId: categoria.id.toString(),
      amount: '100.00',
      date: '2026-09-10',
      description: 'Entrada após promoção',
      source: 'Contribuição',
    };

    const antes = await request(createApp())
      .post('/transactions')
      .set('Authorization', memberAuthorization)
      .send(lancamento);
    expect(antes.status).toBe(403);

    const promoted = await alterar(ctx.membership.id, ctx.authorization, { papel: 'TESOUREIRO' });
    expect(promoted.status).toBe(200);
    expect(promoted.body.papel).toBe('TESOUREIRO');

    const depois = await request(createApp())
      .post('/transactions')
      .set('Authorization', memberAuthorization)
      .send(lancamento);
    expect(depois.status).toBe(201);
    expect(depois.body).toMatchObject({
      organizationId: ctx.organization.id.toString(),
      categoryId: categoria.id.toString(),
      type: 'ENTRADA',
      description: 'Entrada após promoção',
      status: 'ATIVO',
    });
  });

  it('impede o tesoureiro de alterar o próprio papel, mesmo com outro tesoureiro ativo', async () => {
    const ctx = await setup();
    const sozinho = await alterar(ctx.actorMembership.id, ctx.authorization, {
      papel: 'CONSULTOR',
    });
    expect(sozinho.status).toBe(403);
    expect(sozinho.body).toEqual({ erro: 'Você não pode alterar o seu próprio papel' });

    const addTreasurer = await alterar(ctx.membership.id, ctx.authorization, {
      papel: 'TESOUREIRO',
    });
    expect(addTreasurer.status).toBe(200);

    const acompanhado = await alterar(ctx.actorMembership.id, ctx.authorization, {
      papel: 'CONSULTOR',
    });
    expect(acompanhado.status).toBe(403);
    expect(
      await prisma.membership.findUniqueOrThrow({ where: { id: ctx.actorMembership.id } }),
    ).toMatchObject({ role: 'TESOUREIRO', active: true });
  });

  it('permite rebaixar outro tesoureiro', async () => {
    const ctx = await setup();
    await alterar(ctx.membership.id, ctx.authorization, { papel: 'TESOUREIRO' });

    const demote = await alterar(ctx.membership.id, ctx.authorization, { papel: 'CONSULTOR' });

    expect(demote.status).toBe(200);
    expect(demote.body.papel).toBe('CONSULTOR');
  });

  // Com a troca do proprio papel recusada, o ultimo tesoureiro so ficaria sem papel se dois
  // tesoureiros se rebaixassem um ao outro ao mesmo tempo.
  it('serializa rebaixamentos cruzados e mantém ao menos um tesoureiro', async () => {
    const ctx = await setup();
    const secondTreasurer = await createUser();
    const secondMembership = await createMembership({
      userId: secondTreasurer.id,
      organizationId: ctx.organization.id,
      role: 'TESOUREIRO',
    });

    const [first, second] = await Promise.all([
      alterar(secondMembership.id, ctx.authorization, { papel: 'CONSULTOR' }),
      alterar(ctx.actorMembership.id, createAuthorizationHeader(secondTreasurer), {
        papel: 'CONSULTOR',
      }),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses[0]).toBe(200);
    expect([403, 409]).toContain(statuses[1]);
    expect(
      await prisma.membership.count({
        where: { organizationId: ctx.organization.id, active: true, role: 'TESOUREIRO' },
      }),
    ).toBeGreaterThanOrEqual(1);
  });

  it('responde 404 para vínculo de outra organização', async () => {
    const ctx = await setup();
    const otherOrganization = await createOrganization();
    const otherUser = await createUser();
    const otherMembership = await createMembership({
      userId: otherUser.id,
      organizationId: otherOrganization.id,
      role: 'CONSULTOR',
    });
    const response = await alterar(otherMembership.id, ctx.authorization, { papel: 'TESOUREIRO' });
    expect(response.status).toBe(404);
  });

  it('responde 403 quando consultor tenta alterar papel', async () => {
    const ctx = await setup('CONSULTOR');
    const response = await alterar(ctx.membership.id, ctx.authorization, { papel: 'TESOUREIRO' });
    expect(response.status).toBe(403);
  });

  it('responde 400 para papel inválido', async () => {
    const ctx = await setup();
    const response = await alterar(ctx.membership.id, ctx.authorization, { papel: 'ADMIN' });
    expect(response.status).toBe(400);
  });
});
