import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { StatementPage } from '../src/pages/StatementPage';
import { autenticar, stubApi } from './helpers/api';

const EXTRATO = {
  '/extrato': {
    body: {
      dataInicio: '2026-09-01',
      dataFim: '2026-09-30',
      saldoAnterior: '1770.50',
      saldoFinal: '999.75',
      linhas: [
        {
          id: '1',
          data: '2026-09-05',
          tipo: 'ENTRADA',
          valor: '1310.00',
          categoria: { id: '1', nome: 'Mensalidade' },
          descricao: 'Mensalidades do mês corrente',
          status: 'ATIVO',
          saldoAcumulado: '3080.50',
        },
        {
          id: '2',
          data: '2026-09-15',
          tipo: 'SAIDA',
          valor: '150.00',
          categoria: { id: '4', nome: 'Material' },
          descricao: 'Compra cancelada',
          status: 'ESTORNADO',
          saldoAcumulado: '3080.50',
        },
      ],
    },
  },
};

function renderizar() {
  return render(
    <MemoryRouter>
      <StatementPage />
    </MemoryRouter>,
  );
}

describe('StatementPage', () => {
  it('apresenta saldo anterior e saldo final do período', async () => {
    autenticar();
    stubApi(EXTRATO);

    renderizar();

    const saldos = await screen.findByRole('region', { name: 'Saldos do período' });

    expect(saldos).toHaveTextContent(/R\$\s*1\.770,50/);
    expect(saldos).toHaveTextContent(/R\$\s*999,75/);
  });

  // O tipo deixou de ser coluna de texto e virou o sinal e a cor do valor.
  it('mostra o valor com sinal e mantém o tipo no nome acessível', async () => {
    autenticar();
    stubApi(EXTRATO);

    renderizar();

    const tabela = await screen.findByRole('region', { name: 'Extrato de movimentações' });

    expect(within(tabela).getByLabelText(/Entrada de R\$\s*1\.310,00/)).toHaveTextContent(
      /\+R\$\s*1\.310,00/,
    );
    expect(within(tabela).getByLabelText(/Saída de R\$\s*150,00/)).toHaveTextContent(
      /-R\$\s*150,00/,
    );
  });

  it('marca a linha estornada e não exibe saldo acumulado nela', async () => {
    autenticar();
    stubApi(EXTRATO);

    renderizar();

    const tabela = await screen.findByRole('region', { name: 'Extrato de movimentações' });
    const linhaEstornada = within(tabela).getByText('Compra cancelada').closest('tr');

    expect(linhaEstornada).toHaveClass('linha--estornada');
    expect(within(linhaEstornada as HTMLElement).getByText('Estornado')).toBeInTheDocument();
  });

  it('formata a data em pt-BR, sem expor o formato do banco', async () => {
    autenticar();
    stubApi(EXTRATO);

    renderizar();

    expect(await screen.findByText('05/09/2026')).toBeInTheDocument();
    expect(screen.queryByText('2026-09-05')).not.toBeInTheDocument();
  });

  it('mostra estado vazio quando não há movimentação no período', async () => {
    autenticar();
    stubApi({
      '/extrato': {
        body: {
          dataInicio: '2026-01-01',
          dataFim: '2026-01-31',
          saldoAnterior: '0',
          saldoFinal: '0',
          linhas: [],
        },
      },
    });

    renderizar();

    expect(await screen.findByText('Sem movimentações no período')).toBeInTheDocument();
  });

  it('mostra o erro da API quando o extrato não carrega', async () => {
    autenticar();
    stubApi({ '/extrato': { status: 500, body: { erro: 'Erro interno do servidor' } } });

    renderizar();

    expect(await screen.findByRole('alert')).toHaveTextContent('Erro interno do servidor');
  });
});
