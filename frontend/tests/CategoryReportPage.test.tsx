import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { CategoryReportPage } from '../src/pages/CategoryReportPage';
import { autenticar, stubApi } from './helpers/api';
import { escolherDia } from './helpers/campos';

// O Intl separa o simbolo do numero com espaco nao separavel, e o Testing Library normaliza esse
// caractere ao comparar. As consultas usam \\s para nao depender de qual espaco esta no DOM.
const ENTRADAS_FORMATADAS = /R\$\s*1\.585,90/;
const SAIDAS_FORMATADAS = /R\$\s*2\.200,00/;

const RELATORIO = {
  '/relatorios/categorias': {
    body: {
      dataInicio: '2026-09-01',
      dataFim: '2026-09-30',
      categorias: [
        { id: '1', nome: 'Mensalidade', tipo: 'ENTRADA', total: '1585.90' },
        { id: '2', nome: 'Buffet', tipo: 'SAIDA', total: '2200.00' },
      ],
      totais: { entradas: '1585.90', saidas: '2200.00' },
    },
  },
};

function totais() {
  return within(screen.getByRole('region', { name: 'Totais do período' }));
}

describe('CategoryReportPage', () => {
  beforeEach(() => {
    autenticar();
  });

  it('consulta o período informado e formata os totais em reais', async () => {
    const api = stubApi(RELATORIO);
    render(<CategoryReportPage />);

    await screen.findByRole('region', { name: 'Totais do período' });

    expect(totais().getByText(ENTRADAS_FORMATADAS)).toBeInTheDocument();
    expect(totais().getByText(SAIDAS_FORMATADAS)).toBeInTheDocument();

    const consulta = api.chamadasPara('/relatorios/categorias')[0]!.url;
    expect(consulta).toContain('dataInicio=');
    expect(consulta).toContain('dataFim=');
  });

  // A checagem acontece antes de chamar a API: um periodo invertido nao vira requisicao.
  it('recusa período invertido sem consultar a API', async () => {
    const api = stubApi(RELATORIO);
    const usuario = userEvent.setup();
    render(<CategoryReportPage />);

    await screen.findByRole('region', { name: 'Totais do período' });
    const consultasIniciais = api.chamadasPara('/relatorios/categorias').length;

    // Dia 2 no inicio e dia 1 no fim: periodo invertido dentro do mes que o painel abre.
    await escolherDia(usuario, 'De', 2);
    await escolherDia(usuario, 'Até', 1);
    await usuario.click(screen.getByRole('button', { name: /Gerar relatório/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Período inválido: a data final deve ser maior ou igual a data inicial.',
    );
    expect(api.chamadasPara('/relatorios/categorias')).toHaveLength(consultasIniciais);
  });

  it('mostra o erro da API quando o relatório não carrega', async () => {
    stubApi({
      '/relatorios/categorias': { status: 500, body: { erro: 'Erro interno do servidor' } },
    });
    render(<CategoryReportPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Erro interno do servidor');
  });
});
