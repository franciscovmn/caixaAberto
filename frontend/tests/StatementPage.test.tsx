import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OrganizationProvider } from '../src/contexts/OrganizationContext';
import { mesAtual } from '../src/lib/data';
import { StatementPage } from '../src/pages/StatementPage';
import { autenticar, stubApi } from './helpers/api';
import { escolherDia } from './helpers/campos';

const EXTRATO = {
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
};

// Os numeros da tela que motivou a correcao das barras: Alimentacao e a maior categoria de todas,
// mas e 82% das saidas, e nao 100%.
const RELATORIO = {
  body: {
    dataInicio: '2026-09-01',
    dataFim: '2026-09-30',
    categorias: [
      { id: '1', nome: 'Mensalidade', tipo: 'ENTRADA', total: '1310.00' },
      { id: '2', nome: 'Doação', tipo: 'ENTRADA', total: '500.00' },
      { id: '3', nome: 'Alimentação', tipo: 'SAIDA', total: '2200.00' },
      { id: '4', nome: 'Serviços', tipo: 'SAIDA', total: '480.75' },
    ],
    totais: { entradas: '1810.00', saidas: '2680.75' },
  },
};

const RESUMO_MENSAL = {
  body: {
    month: '2026-09',
    entries: '1810.00',
    exits: '2680.75',
    balance: '-870.75',
    previousMonth: { month: '2026-08', entries: '2090.50', exits: '320.00', balance: '1770.50' },
  },
};

const SEM_LINHAS = {
  body: {
    dataInicio: '2026-07-01',
    dataFim: '2026-07-31',
    saldoAnterior: '500.00',
    saldoFinal: '500.00',
    linhas: [],
  },
};

const RELATORIO_VAZIO = {
  body: {
    dataInicio: '2026-07-01',
    dataFim: '2026-07-31',
    categorias: [],
    totais: { entradas: '0.00', saidas: '0.00' },
  },
};

function stubPadrao(sobrescritas: Record<string, { status?: number; body?: unknown }> = {}) {
  return stubApi({
    '/extrato': EXTRATO,
    '/relatorios/categorias': RELATORIO,
    '/transactions/resumo/mensal': RESUMO_MENSAL,
    ...sobrescritas,
  });
}

function renderizar(endereco = '/extrato?mes=2026-09') {
  return render(
    <MemoryRouter initialEntries={[endereco]}>
      <Routes>
        <Route path="/extrato" element={<StatementPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function totais() {
  return screen.findByRole('region', { name: 'Totais do período' });
}

describe('StatementPage', () => {
  beforeEach(() => {
    autenticar();
  });

  it('abre no mês corrente e consulta o mês inteiro', async () => {
    const api = stubPadrao();
    renderizar('/extrato');

    await totais();

    const mes = mesAtual();
    const consulta = api.chamadasPara('/extrato')[0]!.url;
    expect(consulta).toContain(`dataInicio=${mes}-01`);
    expect(api.chamadasPara('/transactions/resumo/mensal')[0]!.url).toContain(`mes=${mes}`);
  });

  it('apresenta entradas, saídas, resultado e saldos do período', async () => {
    stubPadrao();
    renderizar();

    const regiao = await totais();

    expect(regiao).toHaveTextContent(/R\$\s*1\.810,00/);
    expect(regiao).toHaveTextContent(/R\$\s*2\.680,75/);
    expect(regiao).toHaveTextContent(/-R\$\s*870,75/);
    expect(regiao).toHaveTextContent(/R\$\s*999,75/);
    expect(regiao).toHaveTextContent(/R\$\s*1\.770,50 antes do período/);
  });

  // US29: no mes inteiro, cada total diz quanto variou sobre o mes anterior.
  it('compara o mês com o anterior', async () => {
    stubPadrao();
    renderizar();

    const regiao = await totais();

    // Entradas caem de 2090,50 para 1810,00, cerca de 13,4% a menos.
    expect(regiao).toHaveTextContent(/-13,4% vs\. agosto/);
    expect(regiao).toHaveTextContent(/\+737,7% vs\. agosto/);
    expect(regiao).toHaveTextContent(/R\$\s*1\.770,50 em agosto/);
  });

  it('não quebra quando o mês anterior não teve movimento', async () => {
    stubPadrao({
      '/transactions/resumo/mensal': {
        body: {
          ...RESUMO_MENSAL.body,
          exits: '0',
          previousMonth: { month: '2026-08', entries: '0', exits: '0', balance: '0' },
        },
      },
    });
    renderizar();

    const regiao = await totais();

    expect(regiao).toHaveTextContent(/Nada registrado em agosto/);
    expect(regiao).toHaveTextContent(/Sem movimento em agosto/);
  });

  // US30: a barra de cada categoria e a parte dela no total do proprio tipo.
  it('mede cada categoria pelo total do seu tipo', async () => {
    stubPadrao();
    renderizar();

    const saidas = await screen.findByRole('region', { name: 'Saídas por categoria' });
    const alimentacao = within(saidas).getByRole('row', { name: /Alimentação/ });
    const servicos = within(saidas).getByRole('row', { name: /Serviços/ });

    expect(alimentacao).toHaveTextContent('82,1%');
    expect(servicos).toHaveTextContent('17,9%');
    expect(alimentacao.querySelector<HTMLElement>('.composicao__barra')!.style.width).toMatch(
      /^82\.0/,
    );

    const entradas = screen.getByRole('region', { name: 'Entradas por categoria' });
    expect(within(entradas).getByRole('row', { name: /Mensalidade/ })).toHaveTextContent('72,4%');
    expect(within(entradas).getByRole('row', { name: /Doação/ })).toHaveTextContent('27,6%');
  });

  it('soma as menores categorias em Outras e mostra todas a pedido', async () => {
    const saidas = ['Buffet', 'Decoração', 'Som', 'Fotografia', 'Convites', 'Brindes', 'Taxas'].map(
      (nome, indice) => ({
        id: String(indice + 10),
        nome,
        tipo: 'SAIDA',
        total: String(70 - indice * 10),
      }),
    );
    stubPadrao({
      '/relatorios/categorias': {
        body: { ...RELATORIO.body, categorias: saidas, totais: { entradas: '0', saidas: '280' } },
      },
    });
    const usuario = userEvent.setup();
    renderizar();

    const bloco = await screen.findByRole('region', { name: 'Saídas por categoria' });

    // Cabecalho, as cinco maiores e a linha Outras.
    expect(within(bloco).getAllByRole('row')).toHaveLength(1 + 5 + 1);
    expect(within(bloco).getByRole('row', { name: /Outras 2 categorias/ })).toHaveTextContent(
      /R\$\s*30,00/,
    );
    expect(within(bloco).queryByRole('row', { name: /Taxas/ })).not.toBeInTheDocument();

    await usuario.click(within(bloco).getByRole('button', { name: 'Ver todas as 7 categorias' }));

    expect(within(bloco).getByRole('row', { name: /Taxas/ })).toBeInTheDocument();
    expect(within(bloco).queryByRole('row', { name: /Outras/ })).not.toBeInTheDocument();
  });

  it('avisa o tipo sem movimento no período', async () => {
    stubPadrao({
      '/relatorios/categorias': {
        body: {
          ...RELATORIO.body,
          categorias: RELATORIO.body.categorias.filter((categoria) => categoria.tipo === 'SAIDA'),
          totais: { entradas: '0.00', saidas: '2680.75' },
        },
      },
    });
    renderizar();

    const entradas = await screen.findByRole('region', { name: 'Entradas por categoria' });
    expect(entradas).toHaveTextContent('Nenhuma entrada no período.');
  });

  // O tipo deixou de ser coluna de texto e virou o sinal e a cor do valor.
  it('mostra no detalhado o valor com sinal e o tipo no nome acessível', async () => {
    stubPadrao();
    const usuario = userEvent.setup();
    renderizar();

    await totais();
    await usuario.click(screen.getByRole('button', { name: 'Detalhado' }));

    const tabela = await screen.findByRole('region', { name: 'Extrato de movimentações' });
    expect(within(tabela).getByLabelText(/Entrada de R\$\s*1\.310,00/)).toHaveTextContent(
      /\+R\$\s*1\.310,00/,
    );
    expect(within(tabela).getByLabelText(/Saída de R\$\s*150,00/)).toHaveTextContent(
      /-R\$\s*150,00/,
    );
    expect(screen.getByRole('button', { name: 'Detalhado' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('marca a linha estornada e não exibe saldo acumulado nela', async () => {
    stubPadrao();
    renderizar('/extrato?mes=2026-09&visao=detalhado');

    const tabela = await screen.findByRole('region', { name: 'Extrato de movimentações' });
    const linhaEstornada = within(tabela).getByText('Compra cancelada').closest('tr');

    expect(linhaEstornada).toHaveClass('linha--estornada');
    expect(within(linhaEstornada as HTMLElement).getByText('Estornado')).toBeInTheDocument();
  });

  it('formata a data em pt-BR, sem expor o formato do banco', async () => {
    stubPadrao();
    renderizar('/extrato?mes=2026-09&visao=detalhado');

    expect(await screen.findByText('05/09/2026')).toBeInTheDocument();
    expect(screen.queryByText('2026-09-05')).not.toBeInTheDocument();
  });

  // US29, cenario 2: o mes consultado sem lancamentos mostra zeros e diz que nao houve movimento.
  it('informa quando o mês consultado não teve movimentação', async () => {
    stubPadrao({ '/extrato': SEM_LINHAS, '/relatorios/categorias': RELATORIO_VAZIO });
    renderizar('/extrato?mes=2026-07');

    expect(
      await screen.findByRole('heading', { name: 'Não houve movimentação em julho de 2026.' }),
    ).toBeInTheDocument();
    expect(await totais()).toHaveTextContent(/R\$\s*0,00/);
    expect(
      screen.queryByRole('region', { name: 'Entradas por categoria' }),
    ).not.toBeInTheDocument();
  });

  it('mostra o erro da API quando o extrato não carrega', async () => {
    stubPadrao({ '/extrato': { status: 500, body: { erro: 'Erro interno do servidor' } } });
    renderizar();

    expect(await screen.findByRole('alert')).toHaveTextContent('Erro interno do servidor');
  });

  it('mantém os totais quando só a comparação com o mês anterior falha', async () => {
    stubPadrao({ '/transactions/resumo/mensal': { status: 500, body: { erro: 'Falhou' } } });
    renderizar();

    const regiao = await totais();

    expect(regiao).toHaveTextContent(/R\$\s*1\.810,00/);
    expect(regiao).not.toHaveTextContent(/vs\./);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // O campo de competencia e escolhido no painel, e a consulta segue o mes escolhido.
  it('consulta outro mês quando ele é escolhido no seletor', async () => {
    const api = stubPadrao();
    const usuario = userEvent.setup();
    renderizar();

    await totais();
    await usuario.click(screen.getByLabelText('Mês'));
    const painel = screen.getByRole('dialog', { name: 'Escolher competência' });
    await usuario.click(within(painel).getByRole('button', { name: 'fev' }));

    expect(api.chamadasPara('/extrato').at(-1)?.url).toContain(
      'dataInicio=2026-02-01&dataFim=2026-02-28',
    );
    expect(api.chamadasPara('/transactions/resumo/mensal').at(-1)?.url).toContain('mes=2026-02');
  });

  it('consulta um intervalo de datas sem a comparação mensal', async () => {
    const api = stubPadrao();
    const usuario = userEvent.setup();
    renderizar();

    await totais();
    await usuario.click(screen.getByRole('button', { name: 'Intervalo' }));
    const inicio = await escolherDia(usuario, 'De', 3);
    const fim = await escolherDia(usuario, 'Até', 20);
    const comparacoes = api.chamadasPara('/transactions/resumo/mensal').length;

    await usuario.click(screen.getByRole('button', { name: 'Consultar' }));

    await screen.findByText(/Quanto entrou, quanto saiu e para onde foi o dinheiro em 03\/09/);
    expect(api.chamadasPara('/relatorios/categorias').at(-1)?.url).toContain(
      `dataInicio=${inicio}&dataFim=${fim}`,
    );
    expect(api.chamadasPara('/transactions/resumo/mensal')).toHaveLength(comparacoes);
  });

  it('imprime a visão aberta, que o navegador também salva em PDF', async () => {
    stubPadrao();
    const imprimir = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const usuario = userEvent.setup();
    renderizar();

    await totais();
    await usuario.click(screen.getByRole('button', { name: 'Imprimir ou salvar PDF' }));

    expect(imprimir).toHaveBeenCalledTimes(1);
    imprimir.mockRestore();
  });

  it('põe a organização e a data de emissão na cópia impressa', async () => {
    stubPadrao({
      '/users/me/organizacoes': {
        body: {
          dados: [
            {
              vinculoId: '1',
              papel: 'TESOUREIRO',
              dataVinculo: '2026-01-01',
              organizacao: { id: '1', nome: 'Comissão de Formatura' },
            },
          ],
        },
      },
    });
    render(
      <MemoryRouter initialEntries={['/extrato?mes=2026-09']}>
        <OrganizationProvider>
          <Routes>
            <Route path="/extrato" element={<StatementPage />} />
          </Routes>
        </OrganizationProvider>
      </MemoryRouter>,
    );

    const cabecalho = await screen.findByText('Comissão de Formatura');
    expect(cabecalho.closest('p')).toHaveClass('somente-impressao');
    expect(cabecalho.closest('p')).toHaveTextContent(/Emitido em \d{2}\/\d{2}\/\d{4}/);
  });

  // A checagem acontece antes de chamar a API: um periodo invertido nao vira requisicao.
  it('recusa intervalo invertido sem consultar a API', async () => {
    const api = stubPadrao();
    const usuario = userEvent.setup();
    renderizar();

    await totais();
    await usuario.click(screen.getByRole('button', { name: 'Intervalo' }));
    await escolherDia(usuario, 'De', 20);
    await escolherDia(usuario, 'Até', 3);
    const consultas = api.chamadasPara('/extrato').length;

    await usuario.click(screen.getByRole('button', { name: 'Consultar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Período inválido: a data final deve ser maior ou igual à data inicial.',
    );
    expect(api.chamadasPara('/extrato')).toHaveLength(consultas);
  });
});
