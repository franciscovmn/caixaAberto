import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { formatarMoeda } from '../lib/formato';
import { ApiError, apiRequest } from '../lib/httpClient';

type TransactionType = 'ENTRADA' | 'SAIDA';

interface TransactionListItem {
  id: string;
  data: string;
  descricao: string;
  categoria: { id: string; nome: string };
  valor: string;
  tipo: TransactionType;
  status: 'ATIVO' | 'ESTORNADO';
  possuiComprovante: boolean;
}

interface TransactionListResponse {
  dados: TransactionListItem[];
  paginacao: { pagina: number; tamanhoPagina: number; total: number; totalPaginas: number };
}

interface CategoryOption {
  id: string;
  nome: string;
}

interface CategoryListResponse {
  dados: CategoryOption[];
}

interface Filtros {
  dataInicio: string;
  dataFim: string;
  tipo: '' | TransactionType;
  categoriaId: string;
}

const FILTROS_INICIAIS: Filtros = {
  dataInicio: '',
  dataFim: '',
  tipo: '',
  categoriaId: '',
};

function montarQueryString(filtros: Filtros, pagina: number): string {
  const params = new URLSearchParams();

  if (filtros.dataInicio) params.set('dataInicio', filtros.dataInicio);
  if (filtros.dataFim) params.set('dataFim', filtros.dataFim);
  if (filtros.tipo) params.set('tipo', filtros.tipo);
  if (filtros.categoriaId) params.set('categoriaId', filtros.categoriaId);
  params.set('pagina', String(pagina));

  return params.toString();
}

export function TransactionsListPage() {
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIAIS);
  const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState<TransactionListResponse | null>(null);
  const [categorias, setCategorias] = useState<CategoryOption[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    let cancelado = false;

    apiRequest<CategoryListResponse>('/categorias')
      .then((resposta) => {
        if (!cancelado) setCategorias(resposta.dados);
      })
      .catch(() => {
        // Filtro de categoria fica sem opções se a busca falhar; não bloqueia a listagem.
      });

    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      setCarregando(true);
      setErro(null);

      try {
        const dados = await apiRequest<TransactionListResponse>(
          `/lancamentos?${montarQueryString(filtros, pagina)}`,
        );
        if (!cancelado) setResultado(dados);
      } catch (error) {
        if (!cancelado) {
          setErro(
            error instanceof ApiError ? error.message : 'Não foi possível carregar os lançamentos',
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
  }, [filtros, pagina]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPagina(1);
  }

  return (
    <main>
      <h1>Lançamentos</h1>

      <form onSubmit={handleSubmit}>
        <label>
          De
          <input
            type="date"
            value={filtros.dataInicio}
            onChange={(event) =>
              setFiltros((atual) => ({ ...atual, dataInicio: event.target.value }))
            }
          />
        </label>

        <label>
          Até
          <input
            type="date"
            value={filtros.dataFim}
            onChange={(event) => setFiltros((atual) => ({ ...atual, dataFim: event.target.value }))}
          />
        </label>

        <label>
          Tipo
          <select
            value={filtros.tipo}
            onChange={(event) =>
              setFiltros((atual) => ({
                ...atual,
                tipo: event.target.value as Filtros['tipo'],
              }))
            }
          >
            <option value="">Todos</option>
            <option value="ENTRADA">Entrada</option>
            <option value="SAIDA">Saída</option>
          </select>
        </label>

        <label>
          Categoria
          <select
            value={filtros.categoriaId}
            onChange={(event) =>
              setFiltros((atual) => ({ ...atual, categoriaId: event.target.value }))
            }
          >
            <option value="">Todas</option>
            {categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nome}
              </option>
            ))}
          </select>
        </label>

        <button type="submit">Filtrar</button>
      </form>

      {carregando && <p role="status">Carregando...</p>}
      {erro && <p role="alert">{erro}</p>}

      {resultado && resultado.dados.length === 0 && !carregando && (
        <p>Nenhum lançamento encontrado para os filtros informados.</p>
      )}

      {resultado && resultado.dados.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição</th>
              <th>Categoria</th>
              <th>Valor</th>
              <th>Tipo</th>
              <th>Status</th>
              <th>Comprovante</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {resultado.dados.map((lancamento) => (
              <tr key={lancamento.id}>
                <td>{lancamento.data}</td>
                <td>{lancamento.descricao}</td>
                <td>{lancamento.categoria.nome}</td>
                <td>{formatarMoeda(lancamento.valor)}</td>
                <td>{lancamento.tipo}</td>
                <td>{lancamento.status}</td>
                <td>{lancamento.possuiComprovante ? 'Sim' : 'Não'}</td>
                <td>
                  <Link to={`/lancamentos/${lancamento.id}`}>Ver detalhes</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {resultado && resultado.paginacao.totalPaginas > 1 && (
        <nav>
          <button disabled={pagina <= 1} onClick={() => setPagina((atual) => atual - 1)}>
            Anterior
          </button>
          <span>
            Página {resultado.paginacao.pagina} de {resultado.paginacao.totalPaginas}
          </span>
          <button
            disabled={pagina >= resultado.paginacao.totalPaginas}
            onClick={() => setPagina((atual) => atual + 1)}
          >
            Próxima
          </button>
        </nav>
      )}

      <Link to="/lancamentos/entrada">Registrar entrada</Link>
      <br />
      <Link to="/lancamentos/saida">Registrar saída</Link>
      <br />
      <Link to="/relatorios/categorias">Relatório por categoria</Link>
    </main>
  );
}
