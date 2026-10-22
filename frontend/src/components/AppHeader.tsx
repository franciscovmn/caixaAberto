import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';

import type { OrganizacaoDoUsuario } from '../lib/organizacoes';
import { OrganizationSelector } from './OrganizationSelector';

// O dia a dia fica no topo; membros, categorias, dados e link publico sao administracao, e moram
// nas abas da area Organizacao. Com tres links, a linha cabe ate no celular e dispensa o menu
// recolhido, que escondia o caminho atras de mais um toque.
const LINKS = [
  { to: '/lancamentos', rotulo: 'Lançamentos' },
  { to: '/extrato', rotulo: 'Extrato' },
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
  return (
    <header className="marca">
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
            <nav className="navegacao" aria-label="Navegação principal">
              {LINKS.map((link) => (
                <NavLink key={link.to} to={link.to}>
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

        {acoes && <div className="marca__fim">{acoes}</div>}
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
