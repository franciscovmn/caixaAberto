import { Navigate, Outlet } from 'react-router-dom';

import { podeEscrever } from '../lib/session';

// Guarda de navegacao para as telas de escrita. Nao substitui a autorizacao do
// servidor: evita que um link ou uma URL digitada leve a um formulario que a API
// vai recusar com 403.
export function RotaTesoureiro() {
  if (!podeEscrever()) {
    return <Navigate to="/lancamentos" replace />;
  }

  return <Outlet />;
}
