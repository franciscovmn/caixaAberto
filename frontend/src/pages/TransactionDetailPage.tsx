import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ReceiptDetailPreview, ReceiptUploadField } from '../components/ReceiptAttachment';
import { formatarData, formatarMoeda, rotuloStatus, valorComSinal } from '../lib/formato';
import { ApiError, apiRequest, apiUploadRequest } from '../lib/httpClient';
import { podeEscrever } from '../lib/session';
import { useTituloPagina } from '../lib/useTituloPagina';

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

interface EstornoResponse {
  id: string;
  status: 'ESTORNADO';
  dataEstorno: string;
}

interface ReceiptUploadResponse {
  id: string;
  nomeArquivo: string;
  tipoArquivo: string;
  tamanho: string;
  url: string;
}

const RECIPIENT_LABEL = 'Destinatário';
const SOURCE_LABEL = 'Origem';
const NAO_INFORMADO = 'Não informado';

export function TransactionDetailPage() {
  useTituloPagina('Detalhe do lançamento');

  const { id } = useParams<{ id: string }>();
  const [lancamento, setLancamento] = useState<TransactionDetail | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const [confirmandoEstorno, setConfirmandoEstorno] = useState(false);
  const [estornando, setEstornando] = useState(false);
  const [erroEstorno, setErroEstorno] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);
  const [anexando, setAnexando] = useState(false);

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

  async function handleEstornar() {
    if (!lancamento) return;

    setEstornando(true);
    setErroEstorno(null);

    try {
      const estorno = await apiRequest<EstornoResponse>(`/lancamentos/${lancamento.id}/estorno`, {
        method: 'POST',
      });

      setLancamento((atual) => (atual ? { ...atual, status: estorno.status } : atual));
      setMensagem('Lançamento estornado.');
      setConfirmandoEstorno(false);
    } catch (error) {
      setErroEstorno(
        error instanceof ApiError ? error.message : 'Não foi possível estornar o lançamento',
      );
    } finally {
      setEstornando(false);
    }
  }

  // Quem cadastrou sem comprovante, ou viu o envio falhar depois de salvar, completa aqui:
  // o formulario de registro manda para este detalhe quando o anexo nao vai.
  async function handleAnexar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lancamento || !arquivo) return;

    setAnexando(true);
    setErroArquivo(null);

    const dados = new FormData();
    dados.append('arquivo', arquivo);

    try {
      const comprovante = await apiUploadRequest<ReceiptUploadResponse>(
        `/lancamentos/${lancamento.id}/comprovante`,
        dados,
      );

      setLancamento((atual) =>
        atual
          ? {
              ...atual,
              receipt: {
                id: comprovante.id,
                fileName: comprovante.nomeArquivo,
                fileType: comprovante.tipoArquivo,
                size: comprovante.tamanho,
                fileUrl: comprovante.url,
                uploadedAt: new Date().toISOString(),
              },
            }
          : atual,
      );
      setArquivo(null);
      setMensagem('Comprovante anexado.');
    } catch (error) {
      setErroArquivo(
        error instanceof ApiError ? error.message : 'Não foi possível anexar o comprovante',
      );
    } finally {
      setAnexando(false);
    }
  }

  if (carregando) {
    return (
      <main>
        <p role="status">Carregando lançamento...</p>
      </main>
    );
  }

  if (erro || !lancamento) {
    return (
      <main>
        <p role="alert">{erro ?? 'Lançamento não encontrado.'}</p>
        <p>
          <Link to="/lancamentos">Voltar para a listagem</Link>
        </p>
      </main>
    );
  }

  const podeEstornar = podeEscrever() && lancamento.status === 'ATIVO';
  // Mesma regra de corrigir e estornar: lancamento estornado nao recebe mais nada.
  const podeAnexar = podeEstornar;

  return (
    <main>
      <div className="cabecalho-pagina">
        <div>
          <h1>{lancamento.description}</h1>
          <p className="cabecalho-pagina__apoio">
            {formatarData(lancamento.date)} · {lancamento.category.name}
            {lancamento.status === 'ESTORNADO' && (
              <>
                {' '}
                <span className="etiqueta etiqueta--estornado">Estornado</span>
              </>
            )}
          </p>
        </div>

        {podeEstornar && !confirmandoEstorno && (
          <div className="acoes">
            <Link
              to={`/lancamentos/${lancamento.id}/editar`}
              className="acao"
              data-variante="secundario"
            >
              Corrigir lançamento
            </Link>
            <button
              type="button"
              className="acao"
              data-variante="secundario"
              onClick={() => setConfirmandoEstorno(true)}
            >
              Estornar lançamento
            </button>
          </div>
        )}

        {podeEstornar && confirmandoEstorno && (
          <div className="acoes" role="group" aria-label="Confirmar estorno do lançamento">
            <span>Confirmar estorno?</span>
            <button type="button" className="acao" disabled={estornando} onClick={handleEstornar}>
              {estornando ? 'Estornando...' : 'Confirmar'}
            </button>
            <button
              type="button"
              className="acao"
              data-variante="secundario"
              disabled={estornando}
              onClick={() => setConfirmandoEstorno(false)}
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {mensagem && <p role="status">{mensagem}</p>}
      {erroEstorno && <p role="alert">{erroEstorno}</p>}

      {lancamento.status === 'ESTORNADO' && (
        <p role="alert">
          Este lançamento foi estornado e não entra mais no cálculo do saldo do período.
        </p>
      )}

      <section className="numeros" aria-label="Valor do lançamento">
        <div className={`numeros__item numeros__item--${lancamento.type.toLowerCase()}`}>
          <span className="numeros__rotulo">
            {lancamento.type === 'ENTRADA' ? 'Entrada' : 'Saída'}
          </span>
          <strong className="numeros__valor">
            {valorComSinal(lancamento.type, lancamento.amount)}
          </strong>
          <span className="numeros__apoio">{formatarMoeda(lancamento.amount)} registrados</span>
        </div>
      </section>

      <dl>
        <dt>Data</dt>
        <dd>{formatarData(lancamento.date)}</dd>

        <dt>Categoria</dt>
        <dd>{lancamento.category.name}</dd>

        <dt>Responsável</dt>
        <dd>{lancamento.user.name}</dd>

        {lancamento.type === 'ENTRADA' && (
          <>
            <dt>{SOURCE_LABEL}</dt>
            <dd>{lancamento.source ?? NAO_INFORMADO}</dd>
          </>
        )}

        {lancamento.type === 'SAIDA' && (
          <>
            <dt>{RECIPIENT_LABEL}</dt>
            <dd>{lancamento.recipient ?? NAO_INFORMADO}</dd>
          </>
        )}

        <dt>Status</dt>
        <dd>{rotuloStatus(lancamento.status)}</dd>

        <dt>Comprovante</dt>
        <dd>
          {lancamento.receipt ? (
            <ReceiptDetailPreview transactionId={lancamento.id} receipt={lancamento.receipt} />
          ) : (
            'Nenhum comprovante anexado'
          )}
        </dd>
      </dl>

      {/* Fora da lista de dados, que usa a fonte dos valores: aqui o campo fica igual
          ao do formulario de registro. */}
      {podeAnexar && !lancamento.receipt && (
        <form onSubmit={handleAnexar}>
          <ReceiptUploadField
            file={arquivo}
            error={erroArquivo}
            disabled={anexando}
            onChange={(escolhido, erroEscolha) => {
              setArquivo(escolhido);
              setErroArquivo(erroEscolha);
            }}
          />
          <button type="submit" disabled={!arquivo || anexando}>
            {anexando ? 'Anexando...' : 'Anexar comprovante'}
          </button>
        </form>
      )}

      <p>
        <Link to="/lancamentos">Voltar para a listagem</Link>
      </p>
    </main>
  );
}
