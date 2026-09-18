import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';

import { EstadoVazio } from '../components/ui/EstadoVazio';
import { SeletorData } from '../components/ui/SeletorData';
import { TabelaRolavel } from '../components/ui/TabelaRolavel';
import { formatarData, formatarMoeda, rotuloTipo } from '../lib/formato';
import { hojeISO, primeiroDiaDoMesAtual } from '../lib/data';
import { ApiError, apiRequest } from '../lib/httpClient';
import { useTituloPagina } from '../lib/useTituloPagina';

type CategoryType = 'ENTRADA' | 'SAIDA';

interface CategoryReportItem {
  id: string;
  nome: string;
  tipo: CategoryType;
  total: string;
}

interface CategoryReportResponse {
  dataInicio: string;
  dataFim: string;
  categorias: CategoryReportItem[];
  totais: {
    entradas: string;
    saidas: string;
  };
}

export function CategoryReportPage() {
  useTituloPagina('Relatório por categoria');

  const [dataInicio, setDataInicio] = useState(primeiroDiaDoMesAtual());
  const [dataFim, setDataFim] = useState(hojeISO());
  const [periodoConsultado, setPeriodoConsultado] = useState({
    dataInicio: primeiroDiaDoMesAtual(),
    dataFim: hojeISO(),
  });
  const [relatorio, setRelatorio] = useState<CategoryReportResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const maiorTotal = useMemo(() => {
    if (!relatorio || relatorio.categorias.length === 0) {
      return 0;
    }

    return Math.max(...relatorio.categorias.map((categoria) => Number(categoria.total)));
  }, [relatorio]);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      setCarregando(true);
      setErro(null);

      const params = new URLSearchParams({
        dataInicio: periodoConsultado.dataInicio,
        dataFim: periodoConsultado.dataFim,
      });

      try {
        const dados = await apiRequest<CategoryReportResponse>(
          `/relatorios/categorias?${params.toString()}`,
        );

        if (!cancelado) {
          setRelatorio(dados);
        }
      } catch (error) {
        if (!cancelado) {
          setErro(
            error instanceof ApiError
              ? error.message
              : 'Não foi possível carregar o relatório por categoria',
          );
        }
      } finally {
        if (!cancelado) {
          setCarregando(false);
        }
      }
    }

    void carregar();

    return () => {
      cancelado = true;
    };
  }, [periodoConsultado]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (dataFim < dataInicio) {
      setErro('Período inválido: a data final deve ser maior ou igual a data inicial.');
      setRelatorio(null);
      return;
    }

    setPeriodoConsultado({ dataInicio, dataFim });
  }

  const saldo = relatorio
    ? String(Number(relatorio.totais.entradas) - Number(relatorio.totais.saidas))
    : '0';

  return (
    <main data-largura="ampla">
      <div className="cabecalho-pagina">
        <div>
          <h1>Relatório por categoria</h1>
          <p className="cabecalho-pagina__apoio">
            Para onde o dinheiro foi entre {formatarData(periodoConsultado.dataInicio)} e{' '}
            {formatarData(periodoConsultado.dataFim)}.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <fieldset className="filtros">
          <legend>Período</legend>

          <div className="filtros__campos">
            <SeletorData rotulo="De" valor={dataInicio} aoSelecionar={setDataInicio} />

            <SeletorData rotulo="Até" valor={dataFim} aoSelecionar={setDataFim} />

            <button type="submit" data-variante="secundario">
              Gerar relatório
            </button>
          </div>
        </fieldset>
      </form>

      {carregando && <p role="status">Carregando relatório...</p>}
      {erro && <p role="alert">{erro}</p>}

      {relatorio && (
        <>
          <section className="numeros" aria-label="Totais do período">
            <div className="numeros__item numeros__item--entrada">
              <span className="numeros__rotulo">Entradas</span>
              <strong className="numeros__valor">{formatarMoeda(relatorio.totais.entradas)}</strong>
            </div>
            <div className="numeros__item numeros__item--saida">
              <span className="numeros__rotulo">Saídas</span>
              <strong className="numeros__valor">{formatarMoeda(relatorio.totais.saidas)}</strong>
            </div>
            <div className="numeros__item numeros__item--saldo">
              <span className="numeros__rotulo">Resultado</span>
              <strong className="numeros__valor">{formatarMoeda(saldo)}</strong>
              <span className="numeros__apoio">
                {relatorio.categorias.length}{' '}
                {relatorio.categorias.length === 1
                  ? 'categoria movimentada'
                  : 'categorias movimentadas'}
              </span>
            </div>
          </section>

          {relatorio.categorias.length === 0 ? (
            <EstadoVazio
              titulo="Nenhuma movimentação no período"
              descricao="Não houve entradas nem saídas entre as datas escolhidas. Escolha um intervalo maior para comparar as categorias."
            />
          ) : (
            <>
              <section className="category-chart" aria-label="Gráfico por categoria">
                {relatorio.categorias.map((categoria) => {
                  const total = Number(categoria.total);
                  const largura = maiorTotal > 0 ? Math.max((total / maiorTotal) * 100, 2) : 0;

                  return (
                    <div className="category-chart__item" key={categoria.id}>
                      <div className="category-chart__label">
                        <span>{categoria.nome}</span>
                        <span>{formatarMoeda(categoria.total)}</span>
                      </div>
                      <div className="category-chart__track">
                        <div
                          className={`category-chart__bar category-chart__bar--${categoria.tipo.toLowerCase()}`}
                          style={{ width: `${largura}%` }}
                          role="img"
                          aria-label={`${categoria.nome}: ${formatarMoeda(categoria.total)}`}
                        />
                      </div>
                    </div>
                  );
                })}

                <p className="category-chart__escala" aria-hidden="true">
                  <span>{formatarMoeda('0')}</span>
                  <span>{formatarMoeda(String(maiorTotal))}</span>
                </p>
              </section>

              <TabelaRolavel titulo="Totais por categoria">
                <table>
                  <thead>
                    <tr>
                      <th>Categoria</th>
                      <th>Tipo</th>
                      <th data-alinha="direita">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {relatorio.categorias.map((categoria) => (
                      <tr key={categoria.id}>
                        <td data-coluna="texto">{categoria.nome}</td>
                        <td data-coluna="texto">{rotuloTipo(categoria.tipo)}</td>
                        <td data-alinha="direita">
                          <span className={`valor valor--${categoria.tipo.toLowerCase()}`}>
                            {formatarMoeda(categoria.total)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TabelaRolavel>
            </>
          )}
        </>
      )}
    </main>
  );
}
