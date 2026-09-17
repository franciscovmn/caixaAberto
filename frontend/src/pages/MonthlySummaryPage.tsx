import { useEffect, useState } from 'react';

import { formatarMoeda } from '../lib/formato';
import { ApiError, apiRequest } from '../lib/httpClient';

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

export function MonthlySummaryPage() {
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
    <main>
      <h1>Resumo financeiro mensal</h1>

      <label>
        Mês
        <input
          type="month"
          value={mesSelecionado}
          onChange={(event) => setMesSelecionado(event.target.value)}
        />
      </label>

      {carregando && <p role="status">Carregando...</p>}
      {erro && <p role="alert">{erro}</p>}

      {resumo && (
        <section>
          <article>
            <h2>{formatarMes(resumo.month)}</h2>
            <p>Entradas: {formatarMoeda(resumo.entries)}</p>
            <p>Saídas: {formatarMoeda(resumo.exits)}</p>
            <p>Saldo: {formatarMoeda(resumo.balance)}</p>
          </article>

          <article>
            <h2>{formatarMes(resumo.previousMonth.month)} (mês anterior)</h2>
            <p>Entradas: {formatarMoeda(resumo.previousMonth.entries)}</p>
            <p>Saídas: {formatarMoeda(resumo.previousMonth.exits)}</p>
            <p>Saldo: {formatarMoeda(resumo.previousMonth.balance)}</p>
          </article>
        </section>
      )}
    </main>
  );
}
