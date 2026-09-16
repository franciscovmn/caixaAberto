import type { CSSProperties } from 'react';

export const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, rgb(244, 247, 252), rgb(229, 237, 248))',
    fontFamily: 'Inter, system-ui, Arial, sans-serif',
    padding: '24px',
    boxSizing: 'border-box',
  },

  card: {
    width: '100%',
    maxWidth: '420px',
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '32px',
    boxShadow: '0 18px 50px rgba(20, 38, 70, 0.12)',
    boxSizing: 'border-box',
  },

  title: {
    margin: 0,
    marginBottom: '8px',
    fontSize: '30px',
    color: '#172033',
  },

  subtitle: {
    marginTop: 0,
    marginBottom: '28px',
    color: '#667085',
    lineHeight: 1.5,
  },

  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },

  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '7px',
  },

  label: {
    fontWeight: 600,
    color: '#344054',
  },

  input: {
    width: '100%',
    boxSizing: 'border-box',
    border: '1px solid #d0d5dd',
    borderRadius: '8px',
    padding: '12px 14px',
    fontSize: '16px',
    outline: 'none',
  },

  button: {
    border: 'none',
    borderRadius: '8px',
    padding: '12px 18px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    backgroundColor: '#1f5eff',
    color: '#ffffff',
  },

  secondaryButton: {
    border: '1px solid #d0d5dd',
    borderRadius: '8px',
    padding: '10px 16px',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    backgroundColor: '#ffffff',
    color: '#344054',
  },

  disabledButton: {
    opacity: 0.65,
    cursor: 'not-allowed',
  },

  error: {
    margin: 0,
    borderRadius: '8px',
    padding: '10px 12px',
    backgroundColor: '#fef3f2',
    color: '#b42318',
    fontSize: '14px',
  },

  authenticatedPage: {
    minHeight: '100vh',
    backgroundColor: '#f6f8fc',
    fontFamily: 'Inter, system-ui, Arial, sans-serif',
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '18px 28px',
    backgroundColor: '#ffffff',
    boxShadow: '0 1px 8px rgba(20, 38, 70, 0.08)',
  },

  brand: {
    margin: 0,
    fontSize: '22px',
    color: '#172033',
  },

  content: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '48px 24px',
  },

  authenticatedCard: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '32px',
    boxShadow: '0 12px 32px rgba(20, 38, 70, 0.08)',
  },

  userName: {
    marginTop: 0,
    marginBottom: '8px',
    color: '#172033',
  },

  userEmail: {
    margin: 0,
    color: '#667085',
  },
};
