import { useState } from 'react';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';

import { apiRequest } from '../lib/httpClient';
import { clearSession, isAuthenticated } from '../lib/session';
import { AppFooter, AppHeader } from './AppHeader';

export function ProtectedRoute() {
  const navigate = useNavigate();
  const [saindo, setSaindo] = useState(false);

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  async function handleLogout() {
    setSaindo(true);

    try {
      await apiRequest<unknown>('/auth/logout', {
        method: 'POST',
      });
    } catch {
      // A sessão local deve ser encerrada mesmo se a API estiver indisponível.
    } finally {
      clearSession();
      navigate('/login', { replace: true });
    }
  }

  return (
    <>
      <AppHeader
        comNavegacao
        acoes={
          <button type="button" data-variante="quieto" onClick={handleLogout} disabled={saindo}>
            {saindo ? 'Saindo...' : 'Sair'}
          </button>
        }
      />

      <Outlet />

      <AppFooter />
    </>
  );
}
