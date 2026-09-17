import { Request, Response } from 'express';
import { Prisma } from '../generated/prisma/client.js';
import { getContexto } from '../middlewares/load-context.js';
import * as transactionRepository from '../repositories/transactionRepository.js';

const TRANSACTION_TYPES = ['ENTRADA', 'SAIDA'] as const;
type TransactionType = (typeof TRANSACTION_TYPES)[number];

function parseBigInt(value: unknown): bigint | null {
  try {
    if (typeof value === 'number' && Number.isInteger(value)) return BigInt(value);
    if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
    return null;
  } catch {
    return null;
  }
}

function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null; // valida datas no formato YYYY-MM-DD
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  // O construtor aceita dia inexistente e rola para o mes seguinte, entao a data so e
  // valida se voltar exatamente igual ao que foi informado.
  return date.toISOString().slice(0, 10) === value ? date : null;
}

// Teto da coluna valor, DECIMAL(12,2). Sem esta checagem o insert falhava no banco e a
// entrada do usuario terminava como erro 500.
const VALOR_MAXIMO = new Prisma.Decimal('9999999999.99');

function parseMoney(value: unknown): Prisma.Decimal | null {
  try {
    if (value === null || value === undefined || value === '') return null;
    const decimal = new Prisma.Decimal(String(value));
    if (!decimal.isFinite() || decimal.lte(0) || decimal.gt(VALOR_MAXIMO)) return null;
    return decimal;
  } catch {
    return null;
  }
}

function serialize(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => {
      if (typeof item === 'bigint') return item.toString();
      if (item instanceof Prisma.Decimal) return item.toString();
      if (item instanceof Date) return item.toISOString();
      return item;
    }),
  );
}

async function create(req: Request, res: Response, forcedType: TransactionType) {
  try {
    const { organizacaoId: organizationId, usuarioId: userId } = getContexto(req);

    const {
      categoryId: rawCategoryId,
      amount: rawAmount,
      date: rawDate,
      description,
      source,
      recipient,
    } = req.body ?? {};

    const categoryId = parseBigInt(rawCategoryId);
    const amount = parseMoney(rawAmount);
    const date = parseDateOnly(rawDate);

    if (!categoryId || !amount || !date || !description) {
      return res.status(400).json({
        erro: 'categoryId, amount, date e description são obrigatórios e válidos.',
      });
    }

    if (
      typeof description !== 'string' ||
      description.trim().length === 0 ||
      description.length > 5000
    ) {
      return res
        .status(400)
        .json({ erro: 'description deve ser um texto entre 1 e 5000 caracteres.' });
    }

    if (source !== undefined && source !== null && typeof source !== 'string') {
      return res.status(400).json({ erro: 'source deve ser texto.' });
    }

    if (recipient !== undefined && recipient !== null && typeof recipient !== 'string') {
      return res.status(400).json({ erro: 'recipient deve ser texto.' });
    }

    const organization = await transactionRepository.getOrganizationById(organizationId);
    if (!organization) return res.status(404).json({ erro: 'Organização não encontrada.' });

    if (
      !organization.managementStart ||
      date < organization.managementStart ||
      date > organization.managementEnd
    ) {
      return res.status(400).json({
        erro: 'A data do lançamento deve estar dentro do período de gestão da organização.',
      });
    }

    const category = await transactionRepository.getCategoryForOrganization(
      categoryId,
      organizationId,
      forcedType,
    );

    if (!category) {
      return res.status(400).json({
        erro: 'Categoria não encontrada, inativa ou incompatível com o tipo do lançamento.',
      });
    }

    const transaction = await transactionRepository.createTransaction({
      organizationId,
      userId,
      categoryId,
      amount,
      date,
      type: forcedType,
      description: description.trim(),
      source: typeof source === 'string' && source.trim() ? source.trim() : null,
      recipient: typeof recipient === 'string' && recipient.trim() ? recipient.trim() : null,
      status: 'ATIVO',
      createdAt: new Date(),
    });

    return res.status(201).json(serialize(transaction));
  } catch (error) {
    console.error(`[create ${forcedType.toLowerCase()}]`, error);
    return res.status(500).json({ erro: 'Erro interno ao registrar lançamento.' });
  }
}

export async function createTransaction(req: Request, res: Response) {
  const requestedType = String(req.body?.tipo ?? req.body?.type ?? '').toUpperCase();

  if (!TRANSACTION_TYPES.includes(requestedType as TransactionType)) {
    return res.status(400).json({
      erro: 'tipo deve ser ENTRADA ou SAIDA.',
    });
  }

  return create(req, res, requestedType as TransactionType);
}

// Mantidos como aliases caso queiramos expor endpoints separados no futuro.
export async function createEntry(req: Request, res: Response) {
  return create(req, res, 'ENTRADA');
}

export async function createExit(req: Request, res: Response) {
  return create(req, res, 'SAIDA');
}

export async function getOne(req: Request, res: Response) {
  try {
    const { organizacaoId: organizationId } = getContexto(req);

    const id = parseBigInt(req.params.id);
    if (!id) return res.status(400).json({ erro: 'id é obrigatório.' });

    const transaction = await transactionRepository.findTransactionById(id, organizationId);
    if (!transaction) return res.status(404).json({ erro: 'Lançamento não encontrado.' });

    return res.json(serialize(transaction));
  } catch (error) {
    console.error('[get transaction]', error);
    return res.status(500).json({ erro: 'Erro interno ao buscar lançamento.' });
  }
}

function getMonthRange(month: string | undefined) {
  const selected = month ?? new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(selected)) return null;

  const [year, monthNumber] = selected.split('-').map(Number);

  // verificação de se esses valores existem só pra o erro sumir
  if (!monthNumber) {
    throw new Error('erro no monthNumber');
  }

  if (!year) {
    throw new Error('erro no ano');
  }

  if (monthNumber < 1 || monthNumber > 12) return null;

  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  const end = new Date(Date.UTC(year, monthNumber, 1));
  const previousStart = new Date(Date.UTC(year, monthNumber - 2, 1));
  const previousEnd = start;

  return { selected, start, end, previousStart, previousEnd };
}

function totalOf(
  groups: Awaited<ReturnType<typeof transactionRepository.getMonthlySummary>>,
  type: TransactionType,
) {
  const found = groups.find((item) => item.type === type);
  return new Prisma.Decimal(found?._sum?.amount ?? 0);
}

export async function monthlySummary(req: Request, res: Response) {
  try {
    const { organizacaoId: organizationId } = getContexto(req);

    const range = getMonthRange(typeof req.query.mes === 'string' ? req.query.mes : undefined);
    if (!range) return res.status(400).json({ erro: 'mes deve estar no formato YYYY-MM.' });

    const [currentGroups, previousGroups] = await Promise.all([
      transactionRepository.getMonthlySummary(organizationId, range.start, range.end),
      transactionRepository.getMonthlySummary(
        organizationId,
        range.previousStart,
        range.previousEnd,
      ),
    ]);

    const entries = totalOf(currentGroups, 'ENTRADA');
    const exits = totalOf(currentGroups, 'SAIDA');
    const previousEntries = totalOf(previousGroups, 'ENTRADA');
    const previousExits = totalOf(previousGroups, 'SAIDA');
    const balance = entries.minus(exits);
    const previousBalance = previousEntries.minus(previousExits);

    return res.json({
      month: range.selected,
      entries: entries.toString(),
      exits: exits.toString(),
      balance: balance.toString(),
      previousMonth: {
        month: range.previousStart.toISOString().slice(0, 7),
        entries: previousEntries.toString(),
        exits: previousExits.toString(),
        balance: previousBalance.toString(),
      },
    });
  } catch (error) {
    console.error('[monthly summary]', error);
    return res.status(500).json({ erro: 'Erro interno ao consultar resumo financeiro mensal.' });
  }
}

export async function publicTransparency(req: Request, res: Response) {
  try {
    const publicLink = String(req.params.publicLink ?? '').trim();
    if (!publicLink) return res.status(400).json({ erro: 'Link público é obrigatório.' });

    const organization = await transactionRepository.getPublicOrganizationByLink(publicLink);
    if (!organization) {
      return res
        .status(404)
        .json({ erro: 'Página de transparência não encontrada ou desativada.' });
    }

    const range = getMonthRange(typeof req.query.mes === 'string' ? req.query.mes : undefined);
    if (!range) return res.status(400).json({ erro: 'mes deve estar no formato YYYY-MM.' });

    const groups = await transactionRepository.getPublicMonthlyAggregates(
      organization.id,
      range.start,
      range.end,
    );

    const categoryIds = [...new Set(groups.map((group) => group.categoryId.toString()))].map(
      BigInt,
    );
    const categories = await transactionRepository.getCategoriesByIds(categoryIds, organization.id);
    const categoryMap = new Map(
      categories.map((category) => [category.id.toString(), category.name]),
    );

    const aggregates = groups.map((group) => ({
      type: group.type,
      category: categoryMap.get(group.categoryId.toString()) ?? 'Categoria não identificada',
      total: new Prisma.Decimal(group._sum.amount ?? 0).toString(),
      count: group._count._all,
    }));

    const entries = aggregates
      .filter((item) => item.type === 'ENTRADA')
      .reduce((sum, item) => sum.plus(item.total), new Prisma.Decimal(0));
    const exits = aggregates
      .filter((item) => item.type === 'SAIDA')
      .reduce((sum, item) => sum.plus(item.total), new Prisma.Decimal(0));

    return res.json({
      organization: {
        id: organization.id.toString(),
        name: organization.name,
        description: organization.description,
        managementStart: organization.managementStart,
        managementEnd: organization.managementEnd,
      },
      month: range.selected,
      totals: {
        entries: entries.toString(),
        exits: exits.toString(),
        balance: entries.minus(exits).toString(),
      },
      byCategory: aggregates,
      privacy: {
        personalFieldsHidden: true,
      },
    });
  } catch (error) {
    console.error('[public transparency]', error);
    return res.status(500).json({ erro: 'Erro interno ao consultar transparência.' });
  }
}
