import { useState } from 'react';
import { Link } from 'react-router-dom';

import { TransactionForm } from '../components/TransactionForm';
import { useTituloPagina } from '../lib/useTituloPagina';

export function NewOutflowPage() {
  useTituloPagina('Registrar saída');

  const [mensagem, setMensagem] = useState<string | null>(null);

  return (
    <main>
      <div className="cabecalho-pagina">
        <div>
          <h1>Registrar saída</h1>
          <p className="cabecalho-pagina__apoio">
            Todo valor que sai do caixa, com comprovante sempre que houver.
          </p>
        </div>
        <div className="acoes">
          <Link className="acao" data-variante="secundario" to="/lancamentos">
            Voltar para a listagem
          </Link>
        </div>
      </div>

      <TransactionForm tipo="SAIDA" onCriado={() => setMensagem('Saída registrada com sucesso.')} />

      {mensagem && <p role="status">{mensagem}</p>}

      <p>
        <Link to="/lancamentos/saida">Registrar outra saída</Link>
      </p>
    </main>
  );
}
