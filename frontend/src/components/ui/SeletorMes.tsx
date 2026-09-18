import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import { anoDoMes, mesAtual, montarMes } from '../../lib/data';
import { formatarMesCurto } from '../../lib/formato';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const COLUNAS = 3;

interface SeletorMesProps {
  rotulo?: string;
  valor: string;
  aoSelecionar: (mes: string) => void;
}

// O Safari nao implementa input[type="month"] e degrada o campo para texto livre, entao
// o usuario digitava qualquer coisa e a API respondia erro de formato. Aqui a competencia
// so pode ser escolhida, no mesmo gesto do calendario que o campo de data abre nas
// outras telas, e o valor emitido e sempre YYYY-MM.
export function SeletorMes({ rotulo = 'Mês', valor, aoSelecionar }: SeletorMesProps) {
  const id = useId();
  const raiz = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLButtonElement>(null);
  const grade = useRef<HTMLDivElement>(null);
  const [aberto, setAberto] = useState(false);
  const [ano, setAno] = useState(() => anoDoMes(valor));

  function abrir() {
    setAno(anoDoMes(valor));
    setAberto(true);
  }

  function fechar(devolverFoco = true) {
    setAberto(false);
    if (devolverFoco) campo.current?.focus();
  }

  function escolher(mes: string) {
    aoSelecionar(mes);
    fechar();
  }

  // O foco entra na grade assim que o painel abre, para que as setas funcionem
  // sem exigir um Tab antes.
  useEffect(() => {
    if (!aberto) return;
    const selecionado = grade.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    (selecionado ?? grade.current?.querySelector('button'))?.focus();
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;

    function aoClicarFora(evento: MouseEvent) {
      if (!raiz.current?.contains(evento.target as Node)) setAberto(false);
    }

    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, [aberto]);

  function navegarNaGrade(evento: KeyboardEvent<HTMLDivElement>) {
    const passos: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: COLUNAS,
      ArrowUp: -COLUNAS,
    };
    const passo = passos[evento.key];
    if (passo === undefined) return;

    evento.preventDefault();

    const botoes = Array.from(grade.current?.querySelectorAll('button') ?? []);
    const atual = botoes.indexOf(document.activeElement as HTMLButtonElement);
    const destino = atual + passo;

    // Sair pelas bordas vira troca de ano, como no calendario nativo.
    if (destino < 0 || destino >= botoes.length) {
      setAno(ano + (destino < 0 ? -1 : 1));
      return;
    }

    botoes[destino]?.focus();
  }

  return (
    <div
      className="seletor-mes"
      ref={raiz}
      onKeyDown={(evento) => {
        if (evento.key === 'Escape' && aberto) {
          evento.preventDefault();
          fechar();
        }
      }}
    >
      <label htmlFor={id}>{rotulo}</label>

      <button
        type="button"
        id={id}
        ref={campo}
        className="seletor-mes__campo"
        aria-haspopup="dialog"
        aria-expanded={aberto}
        onClick={() => (aberto ? fechar(false) : abrir())}
      >
        <span>{formatarMesCurto(valor)}</span>
        <IconeCalendario />
      </button>

      {aberto && (
        <div className="seletor-mes__painel" role="dialog" aria-label="Escolher competência">
          <div className="seletor-mes__ano">
            <button
              type="button"
              className="seletor-mes__navegar"
              aria-label="Ano anterior"
              onClick={() => setAno(ano - 1)}
            >
              <IconeSeta direcao="anterior" />
            </button>

            <strong aria-live="polite">{ano}</strong>

            <button
              type="button"
              className="seletor-mes__navegar"
              aria-label="Próximo ano"
              onClick={() => setAno(ano + 1)}
            >
              <IconeSeta direcao="proximo" />
            </button>
          </div>

          <div className="seletor-mes__grade" ref={grade} onKeyDown={navegarNaGrade}>
            {MESES.map((nome, indice) => {
              const mes = montarMes(ano, indice + 1);

              return (
                <button
                  key={mes}
                  type="button"
                  className="seletor-mes__mes"
                  aria-pressed={mes === valor}
                  data-hoje={mes === mesAtual()}
                  onClick={() => escolher(mes)}
                >
                  {nome}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function IconeCalendario() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="2" y="3.5" width="12" height="10.5" rx="1" />
      <path d="M2 6.5h12M5.5 2v2.5M10.5 2v2.5" />
    </svg>
  );
}

function IconeSeta({ direcao }: { direcao: 'anterior' | 'proximo' }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={direcao === 'anterior' ? 'M10 3 5 8l5 5' : 'M6 3l5 5-5 5'} />
    </svg>
  );
}
