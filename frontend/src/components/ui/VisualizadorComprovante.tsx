import { useEffect, useRef, useState } from 'react';

interface VisualizadorComprovanteProps {
  url: string;
  nome: string;
  tipo: string;
  apoio: string;
  aoFechar: () => void;
}

// O comprovante nasce pequeno na pagina, e conferir um recibo fotografado exigia abrir o
// arquivo por fora do sistema. Aqui ele ocupa a tela inteira, com dois ajustes: o inteiro
// visivel, ou o tamanho original com rolagem, que e o que resolve letra miuda.
export function VisualizadorComprovante({
  url,
  nome,
  tipo,
  apoio,
  aoFechar,
}: VisualizadorComprovanteProps) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [ajuste, setAjuste] = useState<'tela' | 'real'>('tela');
  const ehImagem = tipo.startsWith('image/');

  // O componente so existe enquanto o comprovante esta ampliado: assim o conteudo do
  // painel nao fica no documento quando ele esta fechado, e o ajuste recomeca em cada
  // abertura. O dialog nativo cuida do foco preso, do Escape e do fundo inerte, coisas
  // que a mao dariam bem mais codigo e mais chance de erro de acessibilidade.
  useEffect(() => {
    dialogo.current?.showModal();
  }, []);

  return (
    <dialog
      className="visualizador"
      ref={dialogo}
      aria-label={`Comprovante ${nome}`}
      onClose={aoFechar}
      onClick={(evento) => {
        // Clique no fundo escuro fecha, como no visualizador de arquivos do sistema.
        if (evento.target === dialogo.current) aoFechar();
      }}
    >
      <div className="visualizador__quadro">
        <div className="visualizador__cabecalho">
          <strong className="visualizador__titulo">
            {nome}
            <span className="visualizador__apoio">{apoio}</span>
          </strong>
        </div>

        <div className="visualizador__corpo" data-ajuste={ajuste}>
          {ehImagem ? (
            <img src={url} alt={`Comprovante ${nome}`} />
          ) : (
            <object data={url} type={tipo} aria-label={`Comprovante ${nome}`}>
              <a href={url} target="_blank" rel="noreferrer">
                Abrir {nome} em outra aba
              </a>
            </object>
          )}
        </div>

        <div className="visualizador__acoes">
          {/* PDF nao tem os botoes de ajuste: o visualizador do proprio navegador ja
              traz o zoom dele, e dois controles de zoom competindo confundem. */}
          {ehImagem && (
            <div className="visualizador__grupo">
              <button
                type="button"
                className="visualizador__acao"
                aria-pressed={ajuste === 'tela'}
                onClick={() => setAjuste('tela')}
              >
                Ajustar à tela
              </button>
              <button
                type="button"
                className="visualizador__acao"
                aria-pressed={ajuste === 'real'}
                onClick={() => setAjuste('real')}
              >
                Tamanho real
              </button>
            </div>
          )}

          <div className="visualizador__grupo">
            <a className="visualizador__acao" href={url} download={nome}>
              Baixar comprovante
            </a>
            <button type="button" className="visualizador__acao" onClick={aoFechar}>
              Fechar
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
