export const categoryTypes = ['ENTRADA', 'SAIDA'] as const;

export type CategoryType = (typeof categoryTypes)[number];

// Estreita o tipo lido do banco para a uniao do dominio. A CHECK constraint da coluna ja impede
// outro valor, entao um tipo desconhecido aqui e defeito, e nao entrada do usuario.
export function assertKnownCategoryType(type: string): CategoryType {
  const known = categoryTypes.find((item) => item === type);

  if (!known) {
    throw new Error(`Tipo de categoria desconhecido: ${type}`);
  }

  return known;
}
