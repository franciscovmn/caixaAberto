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
  const organization = await createOrganization({
    publicLink: `link-exclusao-${Date.now()}-${Math.random()}`,
    transparencyActive: true,
  });
  await createMembership({ userId: user.id, organizationId: organization.id, role });

  return { user, organization, authorization: createAuthorizationHeader(user) };
}

function excluir(id: bigint | string, authorization?: string) {
  const pedido = request(createApp()).delete(`/organizacoes/${id.toString()}`);

  return authorization ? pedido.set('Authorization', authorization) : pedido;
}

describe('exclusão de organização', () => {
  it('desativa a organização, os vínculos e o link público, e guarda os lançamentos', async () => {
    const { user, organization, authorization } = await criarOrganizacao();
    const consultor = await createUser();
    await createMembership({
      userId: consultor.id,
      organizationId: organization.id,
      role: 'CONSULTOR',
    });
    const categoria = await createCategory({ organizationId: organization.id });
    await createTransaction({
      organizationId: organization.id,
      userId: user.id,
      categoryId: categoria.id,
    });

    const response = await excluir(organization.id, authorization);

    expect(response.status).toBe(204);
    expect(
      await prisma.organization.findUniqueOrThrow({
        where: { id: organization.id },
        select: { active: true, transparencyActive: true },
      }),
    ).toEqual({ active: false, transparencyActive: false });
    expect(
      await prisma.membership.count({ where: { organizationId: organization.id, active: true } }),
    ).toBe(0);
    expect(await prisma.transaction.count({ where: { organizationId: organization.id } })).toBe(1);
    expect(await prisma.category.count({ where: { organizationId: organization.id } })).toBe(1);
  });

  it('tira a organização da lista e do contexto de quem era membro', async () => {
    const { organization, authorization } = await criarOrganizacao();

    await excluir(organization.id, authorization);

    const organizacoes = await request(createApp())
      .get('/users/me/organizacoes')
      .set('Authorization', authorization);
    expect(organizacoes.status).toBe(200);
    expect(organizacoes.body.dados).toEqual([]);

    const extrato = await request(createApp())
      .get('/extrato')
      .query({ dataInicio: '2026-09-01', dataFim: '2026-09-30' })
      .set('Authorization', authorization)
      .set('X-Organization-Id', organization.id.toString());
    expect(extrato.status).toBe(403);
  });

  it('mantém as outras organizações de quem participa de mais de uma', async () => {
    const { user, organization, authorization } = await criarOrganizacao();
    const outra = await createOrganization({ name: 'Atlética TSI' });
    await createMembership({ userId: user.id, organizationId: outra.id, role: 'CONSULTOR' });

    const response = await request(createApp())
      .delete(`/organizacoes/${organization.id.toString()}`)
      .set('Authorization', authorization)
      .set('X-Organization-Id', organization.id.toString());

    expect(response.status).toBe(204);
    const organizacoes = await request(createApp())
      .get('/users/me/organizacoes')
      .set('Authorization', authorization);
    expect(
      organizacoes.body.dados.map((item: { organizacao: { id: string } }) => item.organizacao.id),
    ).toEqual([outra.id.toString()]);
  });

  it('tira do ar a página pública da organização excluída', async () => {
    const { organization, authorization } = await criarOrganizacao();

    await excluir(organization.id, authorization);

    const publica = await request(createApp())
      .get(`/transparency/${organization.publicLink}`)
      .query({ mes: '2026-09' });
    expect(publica.status).toBe(404);
  });

  it('recusa a exclusão feita por CONSULTOR', async () => {
    const { organization, authorization } = await criarOrganizacao('CONSULTOR');

    const response = await excluir(organization.id, authorization);

    expect(response.status).toBe(403);
    expect(
      await prisma.organization.findUniqueOrThrow({
        where: { id: organization.id },
        select: { active: true },
      }),
    ).toEqual({ active: true });
  });

  it('trata outra organização no caminho como inexistente e não a exclui', async () => {
    const { authorization } = await criarOrganizacao();
    const outra = await createOrganization();

    const response = await excluir(outra.id, authorization);

    expect(response.status).toBe(404);
    expect(
      await prisma.organization.findUniqueOrThrow({
        where: { id: outra.id },
        select: { active: true },
      }),
    ).toEqual({ active: true });
  });

  it('rejeita identificador inválido', async () => {
    const { authorization } = await criarOrganizacao();

    const response = await excluir('abc', authorization);

    expect(response.status).toBe(400);
  });

  it('rejeita requisição sem token de autenticação', async () => {
    const { organization } = await criarOrganizacao();

    const response = await excluir(organization.id);

    expect(response.status).toBe(401);
  });
});
