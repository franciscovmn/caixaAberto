import type { ReactNode } from 'react';

interface EstadoVazioProps {
  titulo: string;
  descricao: string;
  acoes?: ReactNode;
}

export function EstadoVazio({ titulo, descricao, acoes }: EstadoVazioProps) {
  return (
    <section className="estado-vazio">
      <h2>{titulo}</h2>
      <p>{descricao}</p>
      {acoes && <div className="acoes">{acoes}</div>}
    </section>
  );
}
