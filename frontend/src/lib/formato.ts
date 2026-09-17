// Valores monetarios chegam da API como string decimal, para nao perder precisao.
// A formatacao acontece so na exibicao, em pt-BR.
export function formatarMoeda(valor: string): string {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    return valor;
  }

  return numero.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}
