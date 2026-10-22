import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';

import { ComposicaoCategorias } from '../components/ComposicaoCategorias';
import type { CategoriaDoPeriodo } from '../components/ComposicaoCategorias';
import { ExtratoDetalhado } from '../components/ExtratoDetalhado';
import type { LinhaDoExtrato } from '../components/ExtratoDetalhado';
import { EstadoVazio } from '../components/ui/EstadoVazio';
import { SeletorData } from '../components/ui/SeletorData';
import { SeletorMes } from '../components/ui/SeletorMes';
import { dataEhValida, diasDoMes, mesAtual, mesEhValido, partesMes } from '../lib/data';
import {
  formatarCompetencia,
  formatarData,
  formatarMoeda,
  formatarNomeDoMes,
} from '../lib/formato';
import { ApiError, apiRequest } from '../lib/httpClient';
import { useTituloPagina } from '../lib/useTituloPagina';

interface StatementResponse {
  dataInicio: string;
  dataFim: string;
  saldoAnterior: string;
  linhas: LinhaDoExtrato[];
  saldoFinal: string;
}

interface CategoryReportResponse {
  categorias: CategoriaDoPeriodo[];
  totais: { entradas: string; saidas: string };
}

interface MonthlySummaryResponse {
  entries: string;
  exits: string;
  balance: string;
  previousMonth: { month: string; entries: string; exits: string; balance: string };
}

interface DadosDoPeriodo {
  extrato: StatementResponse;
  relatorio: CategoryReportResponse;
  // So existe quando o periodo e um mes inteiro: e dele que sai a comparacao com o anterior.
  resumoMensal: MonthlySummaryResponse | null;
}

type Visao = 'resumo' | 'detalhado';
type Modo = 'mes' | 'intervalo';

interface Periodo {
  dataInicio: string;
  dataFim: string;
  mes: string | null;
}

function periodoDoMes(mes: string): Periodo {
  const { ano, mes: numero } = partesMes(mes);

  return { dataInicio: `${mes}-01`, dataFim: `${mes}-${diasDoMes(ano, numero)}`, mes };
}

// O periodo vive na URL, para que o endereco dos antigos Resumo e Relatorio, um link guardado ou
// a volta do navegador abram a mesma consulta. Um intervalo invalido cai no mes corrente.
function lerPeriodo(params: URLSearchParams): Periodo {
  const de = params.get('de');
  const ate = params.get('ate');

  if (dataEhValida(de) && dataEhValida(ate) && de <= ate) {
    return { dataInicio: de, dataFim: ate, mes: null };
  }

  const mes = params.get('mes');

  return periodoDoMes(mesEhValido(mes) ? mes : mesAtual());
}

// A comparacao com o mes anterior e uma linha de apoio ao lado do numero.
function variacao(atual: string, anterior: string, mesAnterior: string): string {
  const valorAtual = Number(atual);
  const valorAnterior = Number(anterior);

  if (!Number.isFinite(valorAtual) || !Number.isFinite(valorAnterior)) {
    return '';
  }

  if (valorAnterior === 0) {
    return valorAtual === 0
      ? `Sem movimento em ${formatarNomeDoMes(mesAnterior)}`
      : `Nada registrado em ${formatarNomeDoMes(mesAnterior)}`;
  }

  const percentual = ((valorAtual - valorAnterior) / Math.abs(valorAnterior)) * 100;
  const sinal = percentual > 0 ? '+' : '';

  return `${sinal}${percentual.toFixed(1).replace('.', ',')}% vs. ${formatarNomeDoMes(mesAnterior)}`;
}

function descreverPeriodo(periodo: Periodo): string {
  return periodo.mes
    ? formatarCompetencia(periodo.mes)
    : `${formatarData(periodo.dataInicio)} a ${formatarData(periodo.dataFim)}`;
}

// Extrato, resumo mensal e relatorio por categoria respondem sobre os mesmos lancamentos: aqui
// eles dividem o periodo e os totais, e a visao escolhe entre a soma por categoria (US29, US30)
// e a trilha lancamento a lancamento com saldo (US28).
export function StatementPage() {
  useTituloPagina('Extrato');

  const [params, setParams] = useSearchParams();
  const periodo = useMemo(() => lerPeriodo(params), [params]);
  const visao: Visao = params.get('visao') === 'detalhado' ? 'detalhado' : 'resumo';

  const [modo, setModo] = useState<Modo>(periodo.mes ? 'mes' : 'intervalo');
  const [rascunho, setRascunho] = useState({ de: periodo.dataInicio, ate: periodo.dataFim });
  const [erroPeriodo, setErroPeriodo] = useState<string | null>(null);

  const [dados, setDados] = useState<DadosDoPeriodo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      setCarregando(true);
      setErro(null);

      const consulta = new URLSearchParams({
        dataInicio: periodo.dataInicio,
        dataFim: periodo.dataFim,
      }).toString();

      try {
        const [extrato, relatorio, resumoMensal] = await Promise.all([
          apiRequest<StatementResponse>(`/extrato?${consulta}`),
          apiRequest<CategoryReportResponse>(`/relatorios/categorias?${consulta}`),
          // Sem a comparacao o resto da tela continua valendo, entao a falha dela nao vira erro.
          periodo.mes
            ? apiRequest<MonthlySummaryResponse>(
                `/transactions/resumo/mensal?${new URLSearchParams({ mes: periodo.mes }).toString()}`,
              ).catch(() => null)
            : Promise.resolve(null),
        ]);

        if (!cancelado) setDados({ extrato, relatorio, resumoMensal });
      } catch (error) {
        if (!cancelado) {
          setDados(null);
          setErro(
            error instanceof ApiError ? error.message : 'Não foi possível carregar o extrato',
          );
        }
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    void carregar();

    return () => {
      cancelado = true;
    };
  }, [periodo]);

  function atualizarParams(mudancas: Record<string, string | null>) {
    const proximos = new URLSearchParams(params);

    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor === null) proximos.delete(chave);
      else proximos.set(chave, valor);
    }

    setParams(proximos, { replace: true });
  }

  function trocarModo(proximo: Modo) {
    setModo(proximo);
    setErroPeriodo(null);

    if (proximo === 'mes') {
      atualizarParams({ mes: periodo.dataInicio.slice(0, 7), de: null, ate: null });
    } else {
      setRascunho({ de: periodo.dataInicio, ate: periodo.dataFim });
    }
  }

  function consultarIntervalo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (rascunho.ate < rascunho.de) {
      setErroPeriodo('Período inválido: a data final deve ser maior ou igual à data inicial.');
      return;
    }

    setErroPeriodo(null);
    atualizarParams({ de: rascunho.de, ate: rascunho.ate, mes: null });
  }

  const totais = dados?.relatorio.totais;
  const resultado = totais ? String(Number(totais.entradas) - Number(totais.saidas)) : '0';
  const semMovimento = Boolean(dados && dados.extrato.linhas.length === 0);
  const resumoMensal = dados?.resumoMensal ?? null;
  const categorias = dados?.relatorio.categorias ?? [];

  return (
    <main data-largura="ampla">
      <div className="cabecalho-pagina">
        <div>
          <h1>Extrato</h1>
          <p className="cabecalho-pagina__apoio">
            {visao === 'resumo'
              ? `Quanto entrou, quanto saiu e para onde foi o dinheiro em ${descreverPeriodo(periodo)}.`
              : `Cada lançamento de ${descreverPeriodo(periodo)}, com o saldo depois dele.`}
          </p>
        </div>
      </div>

      <form onSubmit={consultarIntervalo}>
        <fieldset className="filtros">
          <legend>Período</legend>

          <div className="filtros__campos">
            <div className="alternador" role="group" aria-label="Tipo de período">
              <button type="button" aria-pressed={modo === 'mes'} onClick={() => trocarModo('mes')}>
                Mês
              </button>
              <button
                type="button"
                aria-pressed={modo === 'intervalo'}
                onClick={() => trocarModo('intervalo')}
              >
                Intervalo
              </button>
            </div>

            {modo === 'mes' ? (
              <SeletorMes
                valor={periodo.mes ?? periodo.dataInicio.slice(0, 7)}
                aoSelecionar={(mes) => atualizarParams({ mes, de: null, ate: null })}
              />
            ) : (
              <>
                <SeletorData
                  rotulo="De"
                  valor={rascunho.de}
                  aoSelecionar={(de) => setRascunho((atual) => ({ ...atual, de }))}
                />
                <SeletorData
                  rotulo="Até"
                  valor={rascunho.ate}
                  aoSelecionar={(ate) => setRascunho((atual) => ({ ...atual, ate }))}
                />
                <button type="submit" data-variante="secundario">
                  Consultar
                </button>
              </>
            )}
          </div>

          {erroPeriodo && <small role="alert">{erroPeriodo}</small>}
        </fieldset>
      </form>

      {carregando && (
        <p role="status" className="apenas-leitor">
          Carregando extrato
        </p>
      )}
      {erro && <p role="alert">{erro}</p>}

      {dados && totais && (
        <section className="numeros" aria-label="Totais do período">
          <div className="numeros__item numeros__item--entrada">
            <span className="numeros__rotulo">Entradas</span>
            <strong className="numeros__valor">{formatarMoeda(totais.entradas)}</strong>
            {resumoMensal && (
              <span className="numeros__apoio">
                {variacao(
                  resumoMensal.entries,
                  resumoMensal.previousMonth.entries,
                  resumoMensal.previousMonth.month,
                )}
              </span>
            )}
          </div>

          <div className="numeros__item numeros__item--saida">
            <span className="numeros__rotulo">Saídas</span>
            <strong className="numeros__valor">{formatarMoeda(totais.saidas)}</strong>
            {resumoMensal && (
              <span className="numeros__apoio">
                {variacao(
                  resumoMensal.exits,
                  resumoMensal.previousMonth.exits,
                  resumoMensal.previousMonth.month,
                )}
              </span>
            )}
          </div>

          <div className="numeros__item numeros__item--saldo">
            <span className="numeros__rotulo">Resultado</span>
            <strong className="numeros__valor">{formatarMoeda(resultado)}</strong>
            {resumoMensal && (
              <span className="numeros__apoio">
                {formatarMoeda(resumoMensal.previousMonth.balance)} em{' '}
                {formatarNomeDoMes(resumoMensal.previousMonth.month)}
              </span>
            )}
          </div>

          <div className="numeros__item numeros__item--saldo">
            <span className="numeros__rotulo">Saldo final</span>
            <strong className="numeros__valor">{formatarMoeda(dados.extrato.saldoFinal)}</strong>
            <span className="numeros__apoio">
              {formatarMoeda(dados.extrato.saldoAnterior)} antes do período
            </span>
          </div>
        </section>
      )}

      <div className="alternador alternador--visao" role="group" aria-label="Visão do extrato">
        <button
          type="button"
          aria-pressed={visao === 'resumo'}
          onClick={() => atualizarParams({ visao: null })}
        >
          Resumo
        </button>
        <button
          type="button"
          aria-pressed={visao === 'detalhado'}
          onClick={() => atualizarParams({ visao: 'detalhado' })}
        >
          Detalhado
        </button>
      </div>

      {semMovimento && !carregando && (
        // US29, cenario 2: o periodo sem lancamentos mostra zeros e diz que nao houve movimento.
        <EstadoVazio
          titulo={`Não houve movimentação em ${descreverPeriodo(periodo)}.`}
          descricao="O saldo não mudou no período. Escolha outro mês ou um intervalo maior para ver os lançamentos."
        />
      )}

      {visao === 'resumo' && dados && !semMovimento && !carregando && totais && (
        <div className="composicoes">
          <ComposicaoCategorias
            tipo="ENTRADA"
            categorias={categorias.filter((categoria) => categoria.tipo === 'ENTRADA')}
            total={totais.entradas}
          />
          <ComposicaoCategorias
            tipo="SAIDA"
            categorias={categorias.filter((categoria) => categoria.tipo === 'SAIDA')}
            total={totais.saidas}
          />
        </div>
      )}

      {visao === 'detalhado' && (carregando || (dados && !semMovimento)) && (
        <ExtratoDetalhado linhas={dados?.extrato.linhas ?? []} carregando={carregando} />
      )}
    </main>
  );
}
