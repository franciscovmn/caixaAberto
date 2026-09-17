interface TabelaEsqueletoProps {
  colunas: number;
  linhas?: number;
}

// Reserva a altura das linhas enquanto a resposta nao chega, no lugar de um
// "Carregando..." solto que faz o conteudo saltar quando os dados aparecem.
export function TabelaEsqueleto({ colunas, linhas = 5 }: TabelaEsqueletoProps) {
  return (
    <tbody aria-hidden="true">
      {Array.from({ length: linhas }, (_, indiceLinha) => (
        <tr key={indiceLinha}>
          {Array.from({ length: colunas }, (_, indiceColuna) => (
            <td key={indiceColuna}>
              <span className="esqueleto" style={{ width: `${55 + ((indiceColuna * 7) % 40)}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}
