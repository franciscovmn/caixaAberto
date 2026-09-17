import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { IconeComprovante } from '../src/components/ui/IconeComprovante';

// SVG inline em vez de biblioteca de icones, para manter as tres dependencias do frontend.
describe('IconeComprovante', () => {
  it('é decorativo: fica fora da árvore de acessibilidade', () => {
    const { container } = render(<IconeComprovante />);
    const svg = container.querySelector('svg');

    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
  });
});
