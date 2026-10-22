import { useId, useState } from 'react';

import { formatarMoeda } from '../lib/formato';

type Tipo = 'ENTRADA' | 'SAIDA';

export interface CategoriaDoPeriodo {
  id: string;
  nome: string;
  tipo: Tipo;
  total: string;
}

interface ComposicaoCategoriasProps {
  tipo: Tipo;
  // A API ja entrega cada tipo do maior total para o menor.
  categorias: CategoriaDoPeriodo[];
  total: string;
}

// Acima disso a lista mostra as maiores e soma o resto numa linha "Outras": com muitas
// categorias, um bloco nao empurra o outro para longe da tela.
const VISIVEIS = 5;

const ROTULOS: Record<Tipo, { titulo: string; vazio: string }> = {
  ENTRADA: { titulo: 'Entradas por categoria', vazio: 'Nenhuma entrada no período.' },
  SAIDA: { titulo: 'Saídas por categoria', vazio: 'Nenhuma saída no período.' },
};

function participacao(parte: number, total: number): number {
  return total > 0 ? (parte / total) * 100 : 0;
}

function formatarPercentual(valor: number): string {
  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

// A barra mede a parte da categoria no total do proprio tipo. Antes a escala era a maior
// categoria de todas, misturando entradas com saidas, e a maior saida aparecia sempre cheia.
export function ComposicaoCategorias({ tipo, categorias, total }: ComposicaoCategoriasProps) {
  const tituloId = useId();
  const [todas, setTodas] = useState(false);

  const totalDoTipo = Number(total);
  // Esconder uma unica categoria atras de "Outras" nao economiza linha nenhuma.
  const podeRecolher = categorias.length > VISIVEIS + 1;
  const recolhida = podeRecolher && !todas;
  const visiveis = recolhida ? categorias.slice(0, VISIVEIS) : categorias;
  const ocultas = recolhida ? categorias.slice(VISIVEIS) : [];
  const somaOcultas = ocultas.reduce((soma, categoria) => soma + Number(categoria.total), 0);
  const rotulos = ROTULOS[tipo];

  return (
    <section className={`composicao composicao--${tipo.toLowerCase()}`} aria-labelledby={tituloId}>
      <div className="composicao__cabecalho">
        <h2 id={tituloId}>{rotulos.titulo}</h2>
        <span className="composicao__total">{formatarMoeda(total)}</span>
      </div>

      {categorias.length === 0 ? (
        <p className="composicao__vazio">{rotulos.vazio}</p>
      ) : (
        <table className="composicao__tabela">
          <thead className="apenas-leitor">
            <tr>
              <th scope="col">Categoria</th>
              <th scope="col">Participação</th>
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((categoria) => (
              <LinhaDaComposicao
                key={categoria.id}
                nome={categoria.nome}
                valor={Number(categoria.total)}
                totalDoTipo={totalDoTipo}
              />
            ))}
            {recolhida && (
              <LinhaDaComposicao
                nome={`Outras ${ocultas.length} categorias`}
                valor={somaOcultas}
                totalDoTipo={totalDoTipo}
                agrupada
              />
            )}
          </tbody>
        </table>
      )}

      {podeRecolher && (
        <button
          type="button"
          className="composicao__alternar"
          data-variante="quieto"
          aria-expanded={todas}
          onClick={() => setTodas((atual) => !atual)}
        >
          {todas ? 'Mostrar só as maiores' : `Ver todas as ${categorias.length} categorias`}
        </button>
      )}
    </section>
  );
}

function LinhaDaComposicao({
  nome,
  valor,
  totalDoTipo,
  agrupada = false,
}: {
  nome: string;
  valor: number;
  totalDoTipo: number;
  agrupada?: boolean;
}) {
  const parte = participacao(valor, totalDoTipo);

  return (
    <tr data-agrupada={agrupada || undefined}>
      <th scope="row">{nome}</th>
      <td className="composicao__participacao">
        <span className="composicao__trilho" aria-hidden="true">
          <span className="composicao__barra" style={{ width: `${parte}%` }} />
        </span>
        <span className="composicao__percentual">{formatarPercentual(parte)}</span>
      </td>
      <td className="composicao__valor">{formatarMoeda(String(valor))}</td>
    </tr>
  );
}
