import { fileURLToPath, pathToFileURL } from 'node:url';

import bcrypt from 'bcrypt';
import { config } from 'dotenv';

// Carregado antes dos modulos que leem o ambiente na importacao, e pelo caminho do arquivo em vez
// do diretorio atual, para o seed rodar igual pelo `prisma db seed` e por `tsx prisma/seed.ts`.
config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const { Prisma } = await import('../src/generated/prisma/client.js');
const { prisma } = await import('../src/database/client.js');

const SENHA_PADRAO = 'senha123456';
const BCRYPT_ROUNDS = 10;

// O seed popula o banco de desenvolvimento. Rodar contra o banco de teste apagaria o isolamento
// que a suite depende, entao o alvo e verificado antes de qualquer escrita. E o espelho da guarda
// em tests/helpers/test-environment.ts, que recusa um banco sem "test" no nome.
function assertBancoDeDesenvolvimento(): void {
  if (process.env.NODE_ENV === 'test') {
    throw new Error('O seed nao roda com NODE_ENV=test. Use o banco de desenvolvimento.');
  }

  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      'DATABASE_URL nao esta definida. Copie backend/.env.example para backend/.env.',
    );
  }

  const nome = decodeURIComponent(new URL(url).pathname.replace(/^\//, '')).toLowerCase();

  if (/(^|[_-])test($|[_-])/.test(nome)) {
    throw new Error(
      `DATABASE_URL aponta para "${nome}", que identifica um banco de teste. ` +
        'O seed so roda no banco de desenvolvimento.',
    );
  }
}

// As datas acompanham o relogio: a gestao cobre o ano corrente e os lancamentos caem no mes atual e
// no anterior, para que extrato, resumo mensal e relatorio por categoria tenham conteudo sem
// ninguem precisar trocar o filtro de periodo.
function diaDoMes(mesesAtras: number, dia: number): Date {
  const hoje = new Date();
  return new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - mesesAtras, dia));
}

function inicioDoAno(): Date {
  return new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
}

function fimDoAno(): Date {
  return new Date(Date.UTC(new Date().getUTCFullYear(), 11, 31));
}

async function criarUsuario(nome: string, email: string) {
  const passwordHash = await bcrypt.hash(SENHA_PADRAO, BCRYPT_ROUNDS);

  return prisma.user.upsert({
    where: { email },
    update: { name: nome, active: true },
    create: { name: nome, email, passwordHash, active: true, createdAt: new Date() },
  });
}

async function criarOrganizacao(nome: string, descricao: string) {
  const existente = await prisma.organization.findFirst({ where: { name: nome } });

  if (existente) {
    return prisma.organization.update({
      where: { id: existente.id },
      data: { description: descricao, managementStart: inicioDoAno(), managementEnd: fimDoAno() },
    });
  }

  return prisma.organization.create({
    data: {
      name: nome,
      description: descricao,
      managementStart: inicioDoAno(),
      managementEnd: fimDoAno(),
      transparencyActive: false,
    },
  });
}

async function criarVinculo(userId: bigint, organizationId: bigint, papel: string) {
  return prisma.membership.upsert({
    where: { userId_organizationId: { userId, organizationId } },
    update: { role: papel, active: true },
    create: { userId, organizationId, role: papel, linkedAt: inicioDoAno(), active: true },
  });
}

async function criarCategoria(organizationId: bigint, nome: string, tipo: 'ENTRADA' | 'SAIDA') {
  return prisma.category.upsert({
    where: { organizationId_name_type: { organizationId, name: nome, type: tipo } },
    update: { active: true },
    create: {
      organizationId,
      name: nome,
      description: `Lançamentos de ${nome.toLowerCase()}`,
      type: tipo,
      active: true,
    },
  });
}

export async function seedDatabase() {
  const tesoureira = await criarUsuario('Ana Tesoureira', 'ana@exemplo.com');
  const consultor = await criarUsuario('Bruno Consultor', 'bruno@exemplo.com');

  const organizacao = await criarOrganizacao(
    'Comissão de Formatura',
    'Prestação de contas da comissão de formatura do curso de Computação.',
  );

  await criarVinculo(tesoureira.id, organizacao.id, 'TESOUREIRO');
  await criarVinculo(consultor.id, organizacao.id, 'CONSULTOR');

  const entradas = new Map<string, bigint>();
  const saidas = new Map<string, bigint>();

  for (const nome of ['Mensalidade', 'Doação', 'Evento', 'Rifa', 'Outros']) {
    const categoria = await criarCategoria(organizacao.id, nome, 'ENTRADA');
    entradas.set(nome, categoria.id);
  }

  for (const nome of ['Material', 'Alimentação', 'Transporte', 'Serviços', 'Outros']) {
    const categoria = await criarCategoria(organizacao.id, nome, 'SAIDA');
    saidas.set(nome, categoria.id);
  }

  // Versoes anteriores do seed usavam estes nomes. Eles permanecem no historico de lançamentos,
  // mas deixam de aparecer como opcoes para novos registros.
  await prisma.category.updateMany({
    where: {
      organizationId: organizacao.id,
      type: 'SAIDA',
      name: { in: ['Buffet', 'Decoração'] },
    },
    data: { active: false },
  });

  // Lancamentos nao tem chave natural para upsert, entao so sao criados quando a organizacao ainda
  // nao tem nenhum. Assim rodar o seed de novo nao multiplica o saldo.
  const jaExistem = await prisma.transaction.count({ where: { organizationId: organizacao.id } });

  if (jaExistem > 0) {
    console.info(`Organização já possui ${jaExistem} lançamentos. Nenhum foi criado.`);
  } else {
    const lancamentos = [
      {
        tipo: 'ENTRADA',
        categoria: 'Mensalidade',
        valor: '1250.00',
        data: diaDoMes(1, 5),
        descricao: 'Mensalidades do mês anterior',
        parte: 'Turma',
      },
      {
        tipo: 'ENTRADA',
        categoria: 'Rifa',
        valor: '840.50',
        data: diaDoMes(1, 18),
        descricao: 'Rifa do notebook',
        parte: 'Vendas da turma',
      },
      {
        tipo: 'SAIDA',
        categoria: 'Material',
        valor: '320.00',
        data: diaDoMes(1, 22),
        descricao: 'Faixas e banners',
        parte: 'Gráfica Central',
      },
      {
        tipo: 'ENTRADA',
        categoria: 'Mensalidade',
        valor: '1310.00',
        data: diaDoMes(0, 5),
        descricao: 'Mensalidades do mês corrente',
        parte: 'Turma',
      },
      {
        tipo: 'ENTRADA',
        categoria: 'Doação',
        valor: '500.00',
        data: diaDoMes(0, 9),
        descricao: 'Doação de ex-aluno',
        parte: 'João Pereira',
      },
      {
        tipo: 'SAIDA',
        categoria: 'Alimentação',
        valor: '2200.00',
        data: diaDoMes(0, 11),
        descricao: 'Sinal do buffet',
        parte: 'Sabor & Arte',
      },
      {
        tipo: 'SAIDA',
        categoria: 'Serviços',
        valor: '480.75',
        data: diaDoMes(0, 14),
        descricao: 'Aluguel de painéis',
        parte: 'Festa Fácil',
      },
      // Um estornado para o extrato exercitar a linha que nao entra no saldo acumulado.
      {
        tipo: 'SAIDA',
        categoria: 'Material',
        valor: '150.00',
        data: diaDoMes(0, 15),
        descricao: 'Compra cancelada',
        parte: 'Papelaria',
        status: 'ESTORNADO',
      },
    ] as const;

    for (const lancamento of lancamentos) {
      const status = 'status' in lancamento ? lancamento.status : 'ATIVO';
      const ehEntrada = lancamento.tipo === 'ENTRADA';

      await prisma.transaction.create({
        data: {
          organizationId: organizacao.id,
          userId: tesoureira.id,
          categoryId: (ehEntrada ? entradas : saidas).get(lancamento.categoria)!,
          amount: new Prisma.Decimal(lancamento.valor),
          date: lancamento.data,
          type: lancamento.tipo,
          description: lancamento.descricao,
          source: ehEntrada ? lancamento.parte : null,
          recipient: ehEntrada ? null : lancamento.parte,
          status,
          createdAt: new Date(),
          reversedAt: status === 'ESTORNADO' ? new Date() : null,
        },
      });
    }

    console.info(`${lancamentos.length} lançamentos criados.`);
  }

  console.info('');
  console.info('Banco de desenvolvimento pronto. Entre com:');
  console.info(`  tesoureiro: ${tesoureira.email} / ${SENHA_PADRAO}`);
  console.info(`  consultor:  ${consultor.email} / ${SENHA_PADRAO}`);
}

const executadoDiretamente = process.argv[1]
  ? pathToFileURL(process.argv[1]).href === import.meta.url
  : false;

if (executadoDiretamente) {
  assertBancoDeDesenvolvimento();

  seedDatabase()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
