import { useState } from 'react';
import type { KeyboardEvent } from 'react';

import { anoDoMes, mesAtual, montarMes } from '../../lib/data';
import { formatarMesCurto } from '../../lib/formato';
import { CabecalhoPainel, CampoPopover } from './CampoPopover';
import { useFecharPopover } from './contextoPopover';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const COLUNAS = 3;

interface SeletorMesProps {
  rotulo?: string;
  valor: string;
  aoSelecionar: (mes: string) => void;
}

// O Safari nao implementa input[type="month"] e degrada o campo para texto livre, entao
// o usuario digitava qualquer coisa e a API respondia erro de formato. Aqui a competencia
// so pode ser escolhida, e o valor emitido e sempre YYYY-MM.
export function SeletorMes({ rotulo = 'Mês', valor, aoSelecionar }: SeletorMesProps) {
  return (
    <CampoPopover
      rotulo={rotulo}
      texto={formatarMesCurto(valor)}
      rotuloDoPainel="Escolher competência"
    >
      <PainelDeMeses valor={valor} aoSelecionar={aoSelecionar} />
    </CampoPopover>
  );
}

// O painel so existe enquanto esta aberto, entao o ano visivel recomeca no mes
// escolhido a cada abertura, sem estado sobrando da navegacao anterior.
function PainelDeMeses({
  valor,
  aoSelecionar,
}: {
  valor: string;
  aoSelecionar: (mes: string) => void;
}) {
  const fechar = useFecharPopover();
  const [ano, setAno] = useState(() => anoDoMes(valor));

  return (
    <>
      <CabecalhoPainel
        rotuloAnterior="Ano anterior"
        rotuloProximo="Próximo ano"
        aoVoltar={() => setAno(ano - 1)}
        aoAvancar={() => setAno(ano + 1)}
      >
        <strong aria-live="polite">{ano}</strong>
      </CabecalhoPainel>

      <GradeDeMeses
        ano={ano}
        selecionado={valor}
        aoEscolher={(mes) => {
          aoSelecionar(mes);
          fechar();
        }}
        aoSairDoAno={(passo) => setAno(ano + passo)}
      />
    </>
  );
}

interface GradeDeMesesProps {
  ano: number;
  selecionado: string;
  aoEscolher: (mes: string) => void;
  aoSairDoAno?: (passo: number) => void;
}

// A mesma grade serve ao seletor de competencia e ao salto de mes dentro do calendario,
// para que os dois tenham o mesmo desenho e o mesmo teclado.
export function GradeDeMeses({ ano, selecionado, aoEscolher, aoSairDoAno }: GradeDeMesesProps) {
  function navegar(evento: KeyboardEvent<HTMLDivElement>) {
    const passos: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: COLUNAS,
      ArrowUp: -COLUNAS,
    };
    const passo = passos[evento.key];
    if (passo === undefined) return;

    evento.preventDefault();

    const botoes = Array.from(evento.currentTarget.querySelectorAll('button'));
    const atual = botoes.indexOf(document.activeElement as HTMLButtonElement);
    const destino = atual + passo;

    // Sair pelas bordas vira troca de ano, como no calendario nativo.
    if (destino < 0 || destino >= botoes.length) {
      aoSairDoAno?.(destino < 0 ? -1 : 1);
      return;
    }

    botoes[destino]?.focus();
  }

  return (
    <div className="seletor-mes__grade" onKeyDown={navegar}>
      {MESES.map((nome, indice) => {
        const mes = montarMes(ano, indice + 1);

        return (
          <button
            key={mes}
            type="button"
            className="seletor-mes__mes"
            aria-pressed={mes === selecionado}
            data-hoje={mes === mesAtual() || undefined}
            onClick={() => aoEscolher(mes)}
          >
            {nome}
          </button>
        );
      })}
    </div>
  );
}
