import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

import {
  dataEhValida,
  deslocarDias,
  deslocarMeses,
  diaDaSemanaInicial,
  diasDoMes,
  hojeISO,
  montarData,
  partesMes,
} from '../../lib/data';
import { formatarCompetencia, formatarData } from '../../lib/formato';
import { CabecalhoPainel, CampoPopover } from './CampoPopover';
import { useFecharPopover } from './contextoPopover';
import { GradeDeMeses } from './SeletorMes';

const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const DIAS_NA_SEMANA = 7;

interface SeletorDataProps {
  rotulo: string;
  valor: string;
  aoSelecionar: (data: string) => void;
  limpavel?: boolean;
  invalido?: boolean;
  mensagem?: ReactNode;
}

// Mesmo gesto do seletor de competencia: a data e escolhida, nunca digitada, para que as
// telas se comportem igual em qualquer navegador. O valor emitido e sempre YYYY-MM-DD, e
// string vazia quando o filtro e limpo.
export function SeletorData({
  rotulo,
  valor,
  aoSelecionar,
  limpavel = false,
  invalido = false,
  mensagem,
}: SeletorDataProps) {
  return (
    <CampoPopover
      rotulo={rotulo}
      texto={dataEhValida(valor) ? formatarData(valor) : 'dd/mm/aaaa'}
      vazio={!dataEhValida(valor)}
      invalido={invalido}
      rotuloDoPainel={`Escolher ${rotulo.toLowerCase()}`}
      mensagem={mensagem}
    >
      <PainelDeData valor={valor} limpavel={limpavel} aoSelecionar={aoSelecionar} />
    </CampoPopover>
  );
}

// O painel monta a cada abertura, entao o calendario sempre recomeca no dia escolhido,
// ou em hoje quando o filtro esta vazio.
function PainelDeData({
  valor,
  limpavel,
  aoSelecionar,
}: {
  valor: string;
  limpavel: boolean;
  aoSelecionar: (data: string) => void;
}) {
  const fechar = useFecharPopover();
  const [modo, setModo] = useState<'dias' | 'meses'>('dias');
  const [focado, setFocado] = useState(() => (dataEhValida(valor) ? valor : hojeISO()));
  const conteudo = useRef<HTMLDivElement>(null);
  const mesVisivel = focado.slice(0, 7);
  const { ano, mes } = partesMes(mesVisivel);

  useEffect(() => {
    const alvo =
      modo === 'dias' ? `[data-data="${focado}"]` : `.seletor-mes__mes[aria-pressed="true"]`;

    conteudo.current?.querySelector<HTMLButtonElement>(alvo)?.focus();
  }, [focado, modo]);

  function irParaMes(destino: string) {
    const { ano: anoDestino, mes: mesDestino } = partesMes(destino);
    // Mudar de mes preserva o dia, menos quando o mes destino e mais curto.
    const dia = Math.min(Number(focado.slice(8)), diasDoMes(anoDestino, mesDestino));

    setFocado(montarData(anoDestino, mesDestino, dia));
  }

  function navegar(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key === 'PageDown' || evento.key === 'PageUp') {
      evento.preventDefault();
      irParaMes(deslocarMeses(mesVisivel, evento.key === 'PageDown' ? 1 : -1));
      return;
    }

    const passos: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: DIAS_NA_SEMANA,
      ArrowUp: -DIAS_NA_SEMANA,
    };
    const passo = passos[evento.key];
    if (passo === undefined) return;

    // Sair pela borda do mes vira troca de mes, como no calendario nativo.
    evento.preventDefault();
    setFocado(deslocarDias(focado, passo));
  }

  if (modo === 'meses') {
    return (
      <div ref={conteudo}>
        <CabecalhoPainel
          rotuloAnterior="Ano anterior"
          rotuloProximo="Próximo ano"
          aoVoltar={() => irParaMes(deslocarMeses(mesVisivel, -12))}
          aoAvancar={() => irParaMes(deslocarMeses(mesVisivel, 12))}
        >
          <strong>{ano}</strong>
        </CabecalhoPainel>

        <GradeDeMeses
          ano={ano}
          selecionado={mesVisivel}
          aoEscolher={(novoMes) => {
            irParaMes(novoMes);
            setModo('dias');
          }}
        />
      </div>
    );
  }

  const primeiroDia = diaDaSemanaInicial(ano, mes);
  const dias = Array.from({ length: diasDoMes(ano, mes) }, (_, indice) => indice + 1);

  return (
    <div ref={conteudo}>
      <CabecalhoPainel
        rotuloAnterior="Mês anterior"
        rotuloProximo="Próximo mês"
        aoVoltar={() => irParaMes(deslocarMeses(mesVisivel, -1))}
        aoAvancar={() => irParaMes(deslocarMeses(mesVisivel, 1))}
      >
        {/* O mes no cabecalho tambem e um botao: clicar nele troca a grade de dias pela
            de meses, o mesmo caminho do seletor de competencia. */}
        <button
          type="button"
          className="campo-popover__competencia"
          onClick={() => setModo('meses')}
        >
          {formatarCompetencia(mesVisivel)}
        </button>
      </CabecalhoPainel>

      <div className="seletor-data__semana" aria-hidden="true">
        {SEMANA.map((letra, indice) => (
          <span key={`${letra}-${indice}`}>{letra}</span>
        ))}
      </div>

      <div className="seletor-data__grade" onKeyDown={navegar}>
        {Array.from({ length: primeiroDia }, (_, indice) => (
          <span key={`vazio-${indice}`} />
        ))}

        {dias.map((dia) => {
          const data = montarData(ano, mes, dia);

          return (
            <button
              key={data}
              type="button"
              className="seletor-data__dia"
              data-data={data}
              data-foco={data === focado || undefined}
              data-hoje={data === hojeISO() || undefined}
              aria-pressed={data === valor}
              aria-label={`${dia} de ${formatarCompetencia(mesVisivel)}`}
              tabIndex={data === focado ? 0 : -1}
              onClick={() => {
                aoSelecionar(data);
                fechar();
              }}
            >
              {dia}
            </button>
          );
        })}
      </div>

      {limpavel && (
        <div className="campo-popover__acoes">
          <button
            type="button"
            className="campo-popover__acao"
            onClick={() => {
              aoSelecionar('');
              fechar();
            }}
          >
            Limpar
          </button>
        </div>
      )}
    </div>
  );
}
