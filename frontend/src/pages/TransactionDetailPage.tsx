import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { formatarMoeda } from '../lib/formato';
import { ApiError, apiRequest } from '../lib/httpClient';

type TransactionType = 'ENTRADA' | 'SAIDA';

interface TransactionDetail {
  id: string;
  date: string;
  type: TransactionType;
  amount: string;
  description: string;
  source: string | null;
  recipient: string | null;
  status: 'ATIVO' | 'ESTORNADO';
  category: { id: string; name: string; type: TransactionType };
  user: { id: string; name: string; email: string };
  receipt: {
    id: string;
    fileName: string;
    fileType: string;
    size: string;
    fileUrl: string;
    uploadedAt: string;
  } | null;
}

const RECIPIENT_LABEL = 'Destinatário';
const SOURCE_LABEL = 'Origem';

function formatarData(dataISO: string): string {
  const data = new Date(dataISO);
  return data.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

export function TransactionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [lancamento, setLancamento] = useState<TransactionDetail | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!id) return;

    let cancelado = false;

    async function carregar() {
      setCarregando(true);
      setErro(null);

      try {
        const dados = await apiRequest<TransactionDetail>(`/transactions/${id}`);
        if (!cancelado) setLancamento(dados);
      } catch (error) {
        if (!cancelado) {
          setErro(
            error instanceof ApiError ? error.message : 'Não foi possível carregar o lançamento',
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
  }, [id]);

  if (carregando) {
    return (
      <main>
        <p role="status">Carregando...</p>
      </main>
    );
  }

  if (erro || !lancamento) {
    return (
      <main>
        <p role="alert">{erro ?? 'Lançamento não encontrado.'}</p>
        <Link to="/lancamentos">Voltar para a listagem</Link>
      </main>
    );
  }

  return (
    <main>
      <h1>Detalhe do lançamento</h1>

      {lancamento.status === 'ESTORNADO' && <p role="alert">Este lançamento foi estornado.</p>}

      <dl>
        <dt>Data</dt>
        <dd>{formatarData(lancamento.date)}</dd>

        <dt>Tipo</dt>
        <dd>{lancamento.type}</dd>

        <dt>Valor</dt>
        <dd>{formatarMoeda(lancamento.amount)}</dd>

        <dt>Descrição</dt>
        <dd>{lancamento.description}</dd>

        <dt>Categoria</dt>
        <dd>{lancamento.category.name}</dd>

        <dt>Responsável</dt>
        <dd>{lancamento.user.name}</dd>

        {lancamento.type === 'ENTRADA' && (
          <>
            <dt>{SOURCE_LABEL}</dt>
            <dd>{lancamento.source ?? '—'}</dd>
          </>
        )}

        {lancamento.type === 'SAIDA' && (
          <>
            <dt>{RECIPIENT_LABEL}</dt>
            <dd>{lancamento.recipient ?? '—'}</dd>
          </>
        )}

        <dt>Status</dt>
        <dd>{lancamento.status}</dd>

        <dt>Comprovante</dt>
        <dd>
          {lancamento.receipt ? (
            <a href={lancamento.receipt.fileUrl} target="_blank" rel="noreferrer">
              {lancamento.receipt.fileName}
            </a>
          ) : (
            'Nenhum comprovante anexado'
          )}
        </dd>
      </dl>

      <Link to="/lancamentos">Voltar para a listagem</Link>
    </main>
  );
}
