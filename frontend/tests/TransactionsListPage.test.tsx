import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { TransactionsListPage } from '../src/pages/TransactionsListPage';
import { autenticar, stubApi } from './helpers/api';

const LISTAGEM = {
  '/categorias': { body: { dados: [{ id: '1', nome: 'Mensalidade' }] } },
  '/lancamentos': {
    body: {
      dados: [
        {
          id: '11',
          data: '2026-09-05',
          descricao: 'Mensalidades do mês corrente',
          categoria: { id: '1', nome: 'Mensalidade' },
          valor: '1310.00',
          tipo: 'ENTRADA',
          status: 'ATIVO',
          possuiComprovante: true,
        },
        {
          id: '15',
          data: '2026-09-15',
          descricao: 'Compra cancelada',
          categoria: { id: '4', nome: 'Material' },
          valor: '150.00',
          tipo: 'SAIDA',
          status: 'ESTORNADO',
          possuiComprovante: false,
        },
      ],
      paginacao: { pagina: 1, tamanhoPagina: 20, total: 2, totalPaginas: 1 },
    },
  },
};

function renderizar() {
  return render(
    <MemoryRouter>
      <TransactionsListPage />
    </MemoryRouter>,
  );
}

describe('TransactionsListPage', () => {
  it('formata data e valor, e mantém o tipo no nome acessível', async () => {
    autenticar();
    stubApi(LISTAGEM);

    renderizar();

    const tabela = await screen.findByRole('region', { name: 'Lançamentos' });

    expect(within(tabela).getByText('05/09/2026')).toBeInTheDocument();
    expect(within(tabela).getByLabelText(/Entrada de R\$\s*1\.310,00/)).toHaveTextContent(
      /\+R\$\s*1\.310,00/,
    );
    expect(within(tabela).getByLabelText(/Saída de R\$\s*150,00/)).toHaveTextContent(
      /-R\$\s*150,00/,
    );
  });

  // Sim e Nao viraram marcador, com o texto ficando so para leitor de tela.
  it('indica a presença de comprovante de forma acessível', async () => {
    autenticar();
    stubApi(LISTAGEM);

    renderizar();

    const tabela = await screen.findByRole('region', { name: 'Lançamentos' });

    expect(within(tabela).getByText('Possui comprovante')).toBeInTheDocument();
    expect(within(tabela).getByText('Sem comprovante')).toBeInTheDocument();
  });

  it('dá nome acessível completo ao link de detalhe', async () => {
    autenticar();
    stubApi(LISTAGEM);

    renderizar();

    expect(
      await screen.findByRole('link', { name: 'Ver detalhes de Mensalidades do mês corrente' }),
    ).toHaveAttribute('href', '/lancamentos/11');
  });

  it('marca a linha estornada', async () => {
    autenticar();
    stubApi(LISTAGEM);

    renderizar();

    const tabela = await screen.findByRole('region', { name: 'Lançamentos' });
    const linha = within(tabela).getByText('Compra cancelada').closest('tr');

    expect(linha).toHaveClass('linha--estornada');
  });

  it('informa o total de lançamentos do período', async () => {
    autenticar();
    stubApi(LISTAGEM);

    renderizar();

    expect(await screen.findByText('2 lançamentos no período')).toBeInTheDocument();
  });

  it('oferece limpar os filtros quando a busca não retorna nada', async () => {
    autenticar();
    stubApi({
      ...LISTAGEM,
      '/lancamentos': {
        body: {
          dados: [],
          paginacao: { pagina: 1, tamanhoPagina: 20, total: 0, totalPaginas: 0 },
        },
      },
    });
    const usuario = userEvent.setup();

    renderizar();

    // Sem filtro aplicado, a tela convida a registrar o primeiro lançamento.
    expect(await screen.findByText('O caixa ainda está vazio')).toBeInTheDocument();

    await usuario.type(screen.getByLabelText('De'), '2020-01-01');
    await usuario.click(screen.getByRole('button', { name: 'Filtrar' }));

    expect(await screen.findByText('Nenhum lançamento no período')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limpar filtros' })).toBeInTheDocument();
  });

  it('mostra o erro da API quando a listagem não carrega', async () => {
    autenticar();
    stubApi({
      '/categorias': { body: { dados: [] } },
      '/lancamentos': { status: 500, body: { erro: 'Erro interno do servidor' } },
    });

    renderizar();

    expect(await screen.findByRole('alert')).toHaveTextContent('Erro interno do servidor');
  });
});
