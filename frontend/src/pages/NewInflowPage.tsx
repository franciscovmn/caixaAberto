import { useState } from 'react';
import { Link } from 'react-router-dom';

import { TransactionForm } from '../components/TransactionForm';
import { useTituloPagina } from '../lib/useTituloPagina';

export function NewInflowPage() {
  useTituloPagina('Registrar entrada');

  const [mensagem, setMensagem] = useState<string | null>(null);

  return (
    <main>
      <div className="cabecalho-pagina">
        <div>
          <h1>Registrar entrada</h1>
          <p className="cabecalho-pagina__apoio">
            Todo valor que entra no caixa, com comprovante sempre que houver.
          </p>
        </div>
        <div className="acoes">
          <Link className="acao" data-variante="secundario" to="/lancamentos">
            Voltar para a listagem
          </Link>
        </div>
      </div>

      <TransactionForm
        tipo="ENTRADA"
        onCriado={() => setMensagem('Entrada registrada com sucesso.')}
      />

      {mensagem && <p role="status">{mensagem}</p>}

      <p>
        <Link to="/lancamentos/entrada">Registrar outra entrada</Link>
      </p>
    </main>
  );
}
