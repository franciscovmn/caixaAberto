import { formatarData, formatarMoeda, rotuloTipo, valorComSinal } from '../lib/formato';
import { TabelaEsqueleto } from './ui/TabelaEsqueleto';
import { TabelaRolavel } from './ui/TabelaRolavel';

export interface LinhaDoExtrato {
  id: string;
  data: string;
  tipo: 'ENTRADA' | 'SAIDA';
  valor: string;
  categoria: { id: string; nome: string };
  descricao: string;
  status: 'ATIVO' | 'ESTORNADO';
  saldoAcumulado: string;
}

interface ExtratoDetalhadoProps {
  linhas: LinhaDoExtrato[];
  carregando: boolean;
}

const COLUNAS = 5;

// A trilha de auditoria: cada lancamento do periodo na ordem da data, com o saldo depois dele.
export function ExtratoDetalhado({ linhas, carregando }: ExtratoDetalhadoProps) {
  return (
    <TabelaRolavel titulo="Extrato de movimentações" cartoes>
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Descrição</th>
            <th>Categoria</th>
            <th data-alinha="direita">Valor</th>
            <th data-alinha="direita">Saldo acumulado</th>
          </tr>
        </thead>

        {carregando ? (
          <TabelaEsqueleto colunas={COLUNAS} />
        ) : (
          <tbody>
            {linhas.map((linha) => (
              <tr
                key={linha.id}
                className={linha.status === 'ESTORNADO' ? 'linha--estornada' : undefined}
              >
                <td data-campo="data">{formatarData(linha.data)}</td>
                <td data-coluna="texto" data-campo="descricao">
                  {linha.descricao}{' '}
                  {linha.status === 'ESTORNADO' && (
                    <span className="etiqueta etiqueta--estornado">Estornado</span>
                  )}
                </td>
                <td data-coluna="texto" data-campo="categoria">
                  {linha.categoria.nome}
                </td>
                <td data-alinha="direita" data-campo="valor">
                  <span
                    className={`valor valor--${linha.tipo.toLowerCase()}`}
                    aria-label={`${rotuloTipo(linha.tipo)} de ${formatarMoeda(linha.valor)}`}
                  >
                    {valorComSinal(linha.tipo, linha.valor)}
                  </span>
                </td>
                <td data-alinha="direita" data-campo="saldo" data-rotulo="Saldo">
                  {linha.status === 'ESTORNADO' ? '-' : formatarMoeda(linha.saldoAcumulado)}
                </td>
              </tr>
            ))}
          </tbody>
        )}
      </table>
    </TabelaRolavel>
  );
}
