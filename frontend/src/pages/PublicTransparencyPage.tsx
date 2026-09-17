import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import { formatarMoeda } from '../lib/formato';
import { ApiError, apiRequest } from '../lib/httpClient';

type TransactionType = 'ENTRADA' | 'SAIDA';

interface CategoryAggregate {
  type: TransactionType;
  category: string;
  total: string;
  count: number;
}

interface PublicTransparencyResponse {
  organization: { name: string; description: string };
  month: string;
  totals: { entries: string; exits: string; balance: string };
  byCategory: CategoryAggregate[];
  privacy: { personalFieldsHidden: boolean };
}

export function PublicTransparencyPage() {
  const { link } = useParams<{ link: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const mesInicial = searchParams.get('mes') ?? new Date().toISOString().slice(0, 7);
  const [mes, setMes] = useState(mesInicial);
  const [dados, setDados] = useState<PublicTransparencyResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!link) return;

    let cancelado = false;

    async function carregar() {
      setCarregando(true);
      setErro(null);

      try {
        const resposta = await apiRequest<PublicTransparencyResponse>(
          `/transparency/${link}?mes=${encodeURIComponent(mes)}`,
          { auth: false },
        );
        if (!cancelado) setDados(resposta);
      } catch (error) {
        if (!cancelado) {
          setErro(
            error instanceof ApiError
              ? error.message
              : 'Não foi possível carregar a página de transparência',
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
  }, [link, mes]);

  function handleMesChange(novoMes: string) {
    setMes(novoMes);
    setSearchParams({ mes: novoMes });
  }

  if (carregando) {
    return (
      <main>
        <p role="status">Carregando...</p>
      </main>
    );
  }

  if (erro || !dados) {
    return (
      <main>
        <p role="alert">{erro ?? 'Página de transparência não encontrada.'}</p>
      </main>
    );
  }

  return (
    <main>
      <h1>{dados.organization.name}</h1>
      <p>{dados.organization.description}</p>

      <label>
        Mês
        <input type="month" value={mes} onChange={(event) => handleMesChange(event.target.value)} />
      </label>

      <section>
        <p>Entradas: {formatarMoeda(dados.totals.entries)}</p>
        <p>Saídas: {formatarMoeda(dados.totals.exits)}</p>
        <p>Saldo: {formatarMoeda(dados.totals.balance)}</p>
      </section>

      <table>
        <thead>
          <tr>
            <th>Categoria</th>
            <th>Tipo</th>
            <th>Total</th>
            <th>Lançamentos</th>
          </tr>
        </thead>
        <tbody>
          {dados.byCategory.map((linha) => (
            <tr key={`${linha.type}-${linha.category}`}>
              <td>{linha.category}</td>
              <td>{linha.type}</td>
              <td>{formatarMoeda(linha.total)}</td>
              <td>{linha.count}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {dados.privacy.personalFieldsHidden && (
        <p>Nenhum dado pessoal de responsáveis é exibido nesta página, conforme a LGPD.</p>
      )}
    </main>
  );
}
