import { useEffect, useState } from 'react';

import { formatarMoeda } from '../lib/formato';
import { ApiError, apiRequest } from '../lib/httpClient';
import { useTituloPagina } from '../lib/useTituloPagina';

interface MonthlySummaryResponse {
  month: string;
  entries: string;
  exits: string;
  balance: string;
  previousMonth: {
    month: string;
    entries: string;
    exits: string;
    balance: string;
  };
}

function mesAtual(): string {
  return new Date().toISOString().slice(0, 7);
}

function formatarMes(mes: string): string {
  const [ano, mesNumero] = mes.split('-');
  const data = new Date(Number(ano), Number(mesNumero) - 1, 1);
  return data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function nomeDoMes(mes: string): string {
  const [ano, mesNumero] = mes.split('-');
  const data = new Date(Number(ano), Number(mesNumero) - 1, 1);
  return data.toLocaleDateString('pt-BR', { month: 'long' });
}

// A comparacao com o mes anterior vira uma linha de apoio ao lado do numero,
// no lugar de repetir o mesmo bloco de rotulos duas vezes na tela.
function variacao(atual: string, anterior: string, mesAnterior: string): string {
  const valorAtual = Number(atual);
  const valorAnterior = Number(anterior);

  if (!Number.isFinite(valorAtual) || !Number.isFinite(valorAnterior)) {
    return '';
  }

  if (valorAnterior === 0) {
    return valorAtual === 0
      ? `Sem movimento em ${nomeDoMes(mesAnterior)}`
      : `Nada registrado em ${nomeDoMes(mesAnterior)}`;
  }

  const percentual = ((valorAtual - valorAnterior) / Math.abs(valorAnterior)) * 100;
  const sinal = percentual > 0 ? '+' : '';

  return `${sinal}${percentual.toFixed(1).replace('.', ',')}% vs. ${nomeDoMes(mesAnterior)}`;
}

export function MonthlySummaryPage() {
  useTituloPagina('Resumo mensal');

  const [mesSelecionado, setMesSelecionado] = useState(mesAtual());
  const [resumo, setResumo] = useState<MonthlySummaryResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      setCarregando(true);
      setErro(null);

      const params = new URLSearchParams({ mes: mesSelecionado });

      try {
        const dados = await apiRequest<MonthlySummaryResponse>(
          `/transactions/resumo/mensal?${params.toString()}`,
        );
        if (!cancelado) setResumo(dados);
      } catch (error) {
        if (!cancelado) {
          setErro(error instanceof ApiError ? error.message : 'Não foi possível carregar o resumo');
        }
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    void carregar();

    return () => {
      cancelado = true;
    };
  }, [mesSelecionado]);

  return (
    <main data-largura="ampla">
      <div className="cabecalho-pagina">
        <div>
          <h1>Resumo financeiro mensal</h1>
          {resumo && (
            <p className="cabecalho-pagina__apoio">
              Fechamento de {formatarMes(resumo.month)}, comparado ao mês anterior.
            </p>
          )}
        </div>
      </div>

      <form>
        <fieldset className="filtros">
          <legend>Competência</legend>

          <div className="filtros__campos">
            <label>
              Mês
              <input
                type="month"
                value={mesSelecionado}
                onChange={(event) => setMesSelecionado(event.target.value)}
              />
            </label>
          </div>
        </fieldset>
      </form>

      {carregando && <p role="status">Carregando resumo do mês...</p>}
      {erro && <p role="alert">{erro}</p>}

      {resumo && !carregando && (
        <section className="numeros" aria-label={`Resumo de ${formatarMes(resumo.month)}`}>
          <div className="numeros__item numeros__item--entrada">
            <span className="numeros__rotulo">Entradas</span>
            <strong className="numeros__valor">{formatarMoeda(resumo.entries)}</strong>
            <span className="numeros__apoio">
              {variacao(resumo.entries, resumo.previousMonth.entries, resumo.previousMonth.month)}
            </span>
          </div>

          <div className="numeros__item numeros__item--saida">
            <span className="numeros__rotulo">Saídas</span>
            <strong className="numeros__valor">{formatarMoeda(resumo.exits)}</strong>
            <span className="numeros__apoio">
              {variacao(resumo.exits, resumo.previousMonth.exits, resumo.previousMonth.month)}
            </span>
          </div>

          <div className="numeros__item numeros__item--saldo">
            <span className="numeros__rotulo">Saldo do mês</span>
            <strong className="numeros__valor">{formatarMoeda(resumo.balance)}</strong>
            <span className="numeros__apoio">
              {formatarMoeda(resumo.previousMonth.balance)} em{' '}
              {nomeDoMes(resumo.previousMonth.month)}
            </span>
          </div>
        </section>
      )}
    </main>
  );
}
