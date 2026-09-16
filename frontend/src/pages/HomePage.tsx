import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import { styles } from '../styles';

export function HomePage() {
  const navigate = useNavigate();
  const { session, signOut } = useAuth();

  const [isLeaving, setIsLeaving] = useState(false);

  async function handleLogout() {
    setIsLeaving(true);

    try {
      await signOut();

      navigate('/login', {
        replace: true,
      });
    } finally {
      setIsLeaving(false);
    }
  }

  return (
    <main style={styles.authenticatedPage}>
      <header style={styles.header}>
        <h1 style={styles.brand}>Caixa Aberto</h1>

        <button
          type="button"
          onClick={handleLogout}
          disabled={isLeaving}
          style={{
            ...styles.secondaryButton,
            ...(isLeaving ? styles.disabledButton : {}),
          }}
        >
          {isLeaving ? 'Saindo...' : 'Sair'}
        </button>
      </header>

      <section style={styles.content}>
        <div style={styles.authenticatedCard}>
          <h2 style={styles.userName}>Área autenticada</h2>

          <p style={styles.userEmail}>{session?.user.name}</p>

          <p style={styles.userEmail}>{session?.user.email}</p>
        </div>
      </section>
    </main>
  );
}
