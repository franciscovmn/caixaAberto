import { useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';

import type { OrganizacaoDoUsuario } from '../lib/organizacoes';
import { OrganizationSelector } from './OrganizationSelector';

// O dia a dia fica no topo; membros, categorias, dados e link publico sao administracao, e moram
// nas abas da area Organizacao em vez de disputar a mesma linha com os lancamentos.
const LINKS = [
  { to: '/lancamentos', rotulo: 'Lançamentos' },
  { to: '/extrato', rotulo: 'Extrato' },
  { to: '/resumo', rotulo: 'Resumo' },
  { to: '/relatorios/categorias', rotulo: 'Relatório' },
  { to: '/organizacao', rotulo: 'Organização' },
];

interface AppHeaderProps {
  // Telas sem sessao (login e transparencia publica) mostram so a assinatura.
  comNavegacao?: boolean;
  acoes?: ReactNode;
  organizacoes?: OrganizacaoDoUsuario[];
  organizacaoId?: string | null;
  onSelecionarOrganizacao?: (organizacaoId: string) => void;
}

export function AppHeader({
  comNavegacao = false,
  acoes,
  organizacoes = [],
  organizacaoId = null,
  onSelecionarOrganizacao,
}: AppHeaderProps) {
  const [menuAberto, setMenuAberto] = useState(false);
  const botaoMenu = useRef<HTMLButtonElement>(null);

  function fecharComEsc(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Escape' || !menuAberto) return;
    setMenuAberto(false);
    botaoMenu.current?.focus();
  }

  return (
    <header className="marca" onKeyDown={fecharComEsc}>
      <div className="marca__interno">
        {comNavegacao ? (
          <Link to="/lancamentos" className="marca__nome">
            Caixa Aberto
          </Link>
        ) : (
          <span className="marca__nome">Caixa Aberto</span>
        )}

        {comNavegacao ? (
          <>
            {organizacoes.length > 0 && onSelecionarOrganizacao && (
              <OrganizationSelector
                organizacoes={organizacoes}
                organizacaoId={organizacaoId}
                onChange={onSelecionarOrganizacao}
              />
            )}
            <nav
              id="navegacao-principal"
              className="navegacao"
              aria-label="Navegação principal"
              data-aberto={menuAberto}
            >
              {LINKS.map((link) => (
                <NavLink key={link.to} to={link.to} onClick={() => setMenuAberto(false)}>
                  {link.rotulo}
                </NavLink>
              ))}
            </nav>
          </>
        ) : (
          // Legenda e acoes ocupam o mesmo canto; enquanto a area protegida carrega, o Sair
          // ja aparece e a legenda sai para nao ficar por baixo dele.
          !acoes && <p className="marca__legenda">Prestação de contas</p>
        )}

        {(comNavegacao || acoes) && (
          <div className="marca__fim">
            {comNavegacao && (
              <button
                ref={botaoMenu}
                type="button"
                className="marca__menu"
                data-variante="quieto"
                aria-expanded={menuAberto}
                aria-controls="navegacao-principal"
                onClick={() => setMenuAberto((aberto) => !aberto)}
              >
                {menuAberto ? 'Fechar' : 'Menu'}
              </button>
            )}
            {acoes}
          </div>
        )}
      </div>
    </header>
  );
}

export function AppFooter() {
  return (
    <footer className="rodape">
      <span>Caixa Aberto</span>
      <span>Datas e horários em America/Fortaleza</span>
    </footer>
  );
}
