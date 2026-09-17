import { afterAll, beforeEach } from 'vitest';

import './environment.js';

const { prisma } = await import('../../src/database/client.js');

beforeEach(async () => {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "TOKEN_REVOGADO",
      "COMPROVANTE_ARQUIVO",
      "COMPROVANTE",
      "LANCAMENTO",
      "META",
      "CATEGORIA",
      "MEMBRO",
      "ORGANIZACAO",
      "USUARIO"
    RESTART IDENTITY CASCADE
  `);
});

afterAll(async () => {
  await prisma.$disconnect();
});
