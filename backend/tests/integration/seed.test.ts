import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { seedDatabase } from '../../prisma/seed.js';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/database/client.js';

const CATEGORIAS_ESPERADAS = {
  ENTRADA: ['Doação', 'Evento', 'Mensalidade', 'Outros', 'Rifa'],
  SAIDA: ['Alimentação', 'Material', 'Outros', 'Serviços', 'Transporte'],
} as const;

describe('carga inicial da Sprint 1 (DEVOPS03 #31396)', () => {
  it('cria o cenário completo e permite ao tesoureiro lançar em todas as categorias', async () => {
    await seedDatabase();
    await seedDatabase();

    const organizacao = await prisma.organization.findFirstOrThrow({
      where: { name: 'Comissão de Formatura' },
    });

    const vinculo = await prisma.membership.findFirstOrThrow({
      where: { organizationId: organizacao.id, role: 'TESOUREIRO', active: true },
      include: { user: true },
    });

    expect(vinculo.user.active).toBe(true);

    const categorias = await prisma.category.findMany({
      where: { organizationId: organizacao.id, active: true },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });

    expect(categorias.filter(({ type }) => type === 'ENTRADA').map(({ name }) => name)).toEqual(
      CATEGORIAS_ESPERADAS.ENTRADA,
    );
    expect(categorias.filter(({ type }) => type === 'SAIDA').map(({ name }) => name)).toEqual(
      CATEGORIAS_ESPERADAS.SAIDA,
    );
    expect(await prisma.transaction.count({ where: { organizationId: organizacao.id } })).toBe(8);

    const app = createApp();
    const login = await request(app)
      .post('/auth/login')
      .send({ email: 'ana@exemplo.com', password: 'senha123456' });

    expect(login.status).toBe(200);

    for (const categoria of categorias) {
      const response = await request(app)
        .post('/transactions')
        .set('Authorization', `Bearer ${login.body.token}`)
        .send({
          tipo: categoria.type,
          categoryId: categoria.id.toString(),
          amount: '10.00',
          date: new Date().toISOString().slice(0, 10),
          description: `Validação da categoria ${categoria.name}`,
          source: categoria.type === 'ENTRADA' ? 'Validação do seed' : undefined,
          recipient: categoria.type === 'SAIDA' ? 'Validação do seed' : undefined,
        });

      expect(response.status, categoria.name).toBe(201);
    }
  });
});
