import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { ApiError, apiRequest, apiUploadRequest } from '../lib/httpClient';
import { CategorySelect } from './CategorySelect';
import { ReceiptUploadField } from './ReceiptAttachment';

export type TransactionType = 'ENTRADA' | 'SAIDA';

interface TransactionResponse {
  id: string;
  type: TransactionType;
}

interface ReceiptUploadResponse {
  id: string;
}

interface TransactionFormProps {
  tipo: TransactionType;
  onCriado?: (lancamento: TransactionResponse) => void;
}

interface FieldErrors {
  categoriaId?: string;
  valor?: string;
  data?: string;
  descricao?: string;
}

interface ReceiptWarning {
  lancamentoId: string;
  mensagem: string;
}

const ROTULOS: Record<TransactionType, { titulo: string; camposParte: string }> = {
  ENTRADA: { titulo: 'Registrar entrada financeira', camposParte: 'Origem' },
  SAIDA: { titulo: 'Registrar saída financeira', camposParte: 'Destinatário' },
};

function normalizarValor(valor: string): string {
  return valor.replace(',', '.');
}

function validarValor(valor: string): boolean {
  const numero = Number(normalizarValor(valor));

  return Number.isFinite(numero) && numero > 0;
}

function validarCampos(
  categoriaId: string,
  valor: string,
  data: string,
  descricao: string,
): FieldErrors {
  const erros: FieldErrors = {};

  if (!categoriaId) {
    erros.categoriaId = 'Selecione uma categoria.';
  }

  if (!valor || !validarValor(valor)) {
    erros.valor = 'Informe um valor maior que zero.';
  }

  if (!data) {
    erros.data = 'Informe a data do lançamento.';
  }

  if (!descricao.trim()) {
    erros.descricao = 'Informe a descrição do lançamento.';
  }

  return erros;
}

export function TransactionForm({ tipo, onCriado }: TransactionFormProps) {
  const [categoriaId, setCategoriaId] = useState('');
  const [valor, setValor] = useState('');
  const [data, setData] = useState('');
  const [descricao, setDescricao] = useState('');
  const [parte, setParte] = useState('');
  const [comprovante, setComprovante] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [erroComprovante, setErroComprovante] = useState<string | null>(null);
  const [avisoComprovante, setAvisoComprovante] = useState<ReceiptWarning | null>(null);
  const [errosCampos, setErrosCampos] = useState<FieldErrors>({});
  const [enviando, setEnviando] = useState(false);

  const rotulo = ROTULOS[tipo];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setAvisoComprovante(null);

    const proximosErros = validarCampos(categoriaId, valor, data, descricao);
    setErrosCampos(proximosErros);

    if (Object.keys(proximosErros).length > 0 || erroComprovante) {
      return;
    }

    setEnviando(true);

    try {
      const lancamento = await apiRequest<TransactionResponse>('/transactions', {
        method: 'POST',
        body: {
          categoryId: categoriaId,
          amount: normalizarValor(valor),
          date: data,
          description: descricao,
          tipo,
          source: tipo === 'ENTRADA' ? parte : undefined,
          recipient: tipo === 'SAIDA' ? parte : undefined,
        },
      });

      if (comprovante) {
        const dados = new FormData();
        dados.append('arquivo', comprovante);

        try {
          await apiUploadRequest<ReceiptUploadResponse>(
            `/lancamentos/${lancamento.id}/comprovante`,
            dados,
          );
        } catch (error) {
          const mensagem =
            error instanceof ApiError ? error.message : 'Não foi possível anexar o comprovante';

          setAvisoComprovante({
            lancamentoId: lancamento.id,
            mensagem: `Lançamento salvo, mas o comprovante não foi anexado: ${mensagem}`,
          });
        }
      }

      setCategoriaId('');
      setValor('');
      setData('');
      setDescricao('');
      setParte('');
      setComprovante(null);
      setErroComprovante(null);
      setErrosCampos({});
      onCriado?.(lancamento);
    } catch (error) {
      setErro(
        error instanceof ApiError ? error.message : 'Não foi possível registrar o lançamento',
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label={rotulo.titulo}
      className={`transaction-form transaction-form--${tipo.toLowerCase()}`}
    >
      <CategorySelect
        tipo={tipo}
        value={categoriaId}
        onChange={(novoValor) => {
          setCategoriaId(novoValor);
          setErrosCampos((atuais) => ({ ...atuais, categoriaId: undefined }));
        }}
        required
        disabled={enviando}
        invalid={Boolean(errosCampos.categoriaId)}
      />
      {errosCampos.categoriaId && <small role="alert">{errosCampos.categoriaId}</small>}

      <label>
        Valor (R$)
        <input
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={valor}
          onChange={(event) => {
            setValor(event.target.value);
            setErrosCampos((atuais) => ({ ...atuais, valor: undefined }));
          }}
          required
          aria-invalid={errosCampos.valor ? true : undefined}
        />
        {errosCampos.valor && <small role="alert">{errosCampos.valor}</small>}
      </label>

      <label>
        Data
        <input
          type="date"
          value={data}
          onChange={(event) => {
            setData(event.target.value);
            setErrosCampos((atuais) => ({ ...atuais, data: undefined }));
          }}
          required
          aria-invalid={errosCampos.data ? true : undefined}
        />
        {errosCampos.data && <small role="alert">{errosCampos.data}</small>}
      </label>

      <label>
        {rotulo.camposParte}
        <input type="text" value={parte} onChange={(event) => setParte(event.target.value)} />
      </label>

      <label>
        Descrição
        <textarea
          value={descricao}
          onChange={(event) => {
            setDescricao(event.target.value);
            setErrosCampos((atuais) => ({ ...atuais, descricao: undefined }));
          }}
          required
          maxLength={5000}
          aria-invalid={errosCampos.descricao ? true : undefined}
        />
        {errosCampos.descricao && <small role="alert">{errosCampos.descricao}</small>}
      </label>

      <ReceiptUploadField
        file={comprovante}
        error={erroComprovante}
        disabled={enviando}
        onChange={(novoArquivo, novoErro) => {
          setComprovante(novoArquivo);
          setErroComprovante(novoErro);
        }}
      />

      {erro && <p role="alert">{erro}</p>}
      {avisoComprovante && (
        <p role="alert">
          {avisoComprovante.mensagem}{' '}
          <Link to={`/lancamentos/${avisoComprovante.lancamentoId}`}>Ver lançamento salvo</Link>
        </p>
      )}

      <button type="submit" disabled={enviando}>
        {enviando ? 'Salvando...' : 'Salvar lançamento'}
      </button>
    </form>
  );
}
