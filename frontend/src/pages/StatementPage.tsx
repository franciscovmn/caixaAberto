import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import { formatarMoeda } from '../lib/formato';
import { ApiError, apiRequest } from '../lib/httpClient';

type TransactionType = 'ENTRADA' | 'SAIDA';

interface StatementLine {
  id: string;
  data: string;
  tipo: TransactionType;
  valor: string;
  categoria: { id: string; nome: string };
  descricao: string;
  status: 'ATIVO' | 'ESTORNADO';
  saldoAcumulado: string;
}

interface StatementResponse {
  dataInicio: string;
  dataFim: string;
  saldoAnterior: string;
  linhas: StatementLine[];
  saldoFinal: string;
}

function primeiroDiaDoMesAtual(): string {
  const hoje = new Date();
  return new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
}

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function StatementPage() {
  const [dataInicio, setDataInicio] = useState(primeiroDiaDoMesAtual());
  const [dataFim, setDataFim] = useState(hojeISO());
  const [periodoConsultado, setPeriodoConsultado] = useState({
    dataInicio: primeiroDiaDoMesAtual(),
    dataFim: hojeISO(),
  });
  const [extrato, setExtrato] = useState<StatementResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

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
        const dados = await apiRequest<StatementResponse>(`/extrato?${params.toString()}`);
        if (!cancelado) setExtrato(dados);
      } catch (error) {
        if (!cancelado) {
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
  }, [periodoConsultado]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPeriodoConsultado({ dataInicio, dataFim });
  }

  return (
    <main>
      <h1>Extrato</h1>

      <form onSubmit={handleSubmit}>
        <label>
          De
          <input
            type="date"
            value={dataInicio}
            onChange={(event) => setDataInicio(event.target.value)}
            required
          />
        </label>

        <label>
          Até
          <input
            type="date"
            value={dataFim}
            onChange={(event) => setDataFim(event.target.value)}
            required
          />
        </label>

        <button type="submit">Consultar</button>
      </form>

      {carregando && <p role="status">Carregando...</p>}
      {erro && <p role="alert">{erro}</p>}

      {extrato && (
        <>
          <p>Saldo anterior: {formatarMoeda(extrato.saldoAnterior)}</p>

          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Categoria</th>
                <th>Descrição</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Saldo acumulado</th>
              </tr>
            </thead>
            <tbody>
              {extrato.linhas.map((linha) => (
                <tr key={linha.id}>
                  <td>{linha.data}</td>
                  <td>{linha.tipo}</td>
                  <td>{linha.categoria.nome}</td>
                  <td>{linha.descricao}</td>
                  <td>{formatarMoeda(linha.valor)}</td>
                  <td>{linha.status}</td>
                  <td>
                    {linha.status === 'ESTORNADO' ? '-' : formatarMoeda(linha.saldoAcumulado)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p>Saldo final: {formatarMoeda(extrato.saldoFinal)}</p>
        </>
      )}
    </main>
  );
}
