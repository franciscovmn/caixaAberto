// SVG inline em vez de biblioteca de icones: mantem as tres dependencias do
// frontend e evita o visual generico de icon set.
export function IconeComprovante() {
  return (
    <span className="marcador-comprovante">
      <svg
        width="13"
        height="13"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M10.5 5 5.9 9.6a1.7 1.7 0 0 0 2.4 2.4l4.9-4.9a3 3 0 0 0-4.2-4.2L4 7.9a4.3 4.3 0 0 0 6.1 6.1l4.1-4.1" />
      </svg>
    </span>
  );
}
