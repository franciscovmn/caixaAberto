import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // A coluna DATE volta do Prisma como meia-noite UTC, e a formatacao das datas depende disso.
    // Sob UTC o comportamento correto e o incorreto seriam indistinguiveis, e uma regressao de fuso
    // passaria despercebida, entao a suite roda sempre sob um fuso negativo, aqui e na CI.
    env: { TZ: 'America/Fortaleza' },
    environment: 'node',
    fileParallelism: false,
    globalSetup: ['./tests/global-setup.ts'],
    maxWorkers: 1,
    setupFiles: [
      './tests/setup/environment.ts',
      './tests/setup/database.ts',
      './tests/setup/uploads.ts',
    ],
    coverage: {
      provider: 'v8',
      // Sem include explicito o relatorio somava o cliente gerado pelo Prisma e os
      // proprios arquivos de teste, e deixava de fora codigo que nenhum teste importa.
      include: ['src/**/*.ts'],
      exclude: ['src/generated/**', 'src/server.ts'],
    },
  },
});
