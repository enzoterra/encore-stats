import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Logo } from './logo';

describe('<Logo />', () => {
  it('SVG decorativo, na proporção do lockup, sem style inline (CSP)', () => {
    const { container } = render(<Logo id="teste" />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
    expect(svg).toHaveAttribute('height', '12');
    expect(svg).toHaveAttribute('width', '66.1');
    expect(svg).toHaveAttribute('viewBox', '0 0 308.3 56');
    expect(container.querySelector('[style]')).toBeNull();
    expect(svg.querySelectorAll('path')).toHaveLength(4);
  });

  it('cada cópia usa o próprio degradê', () => {
    const { container } = render(
      <>
        <Logo id="a" />
        <Logo id="b" height={30} />
      </>,
    );
    const ids = [...container.querySelectorAll('linearGradient')].map((g) => g.id);
    expect(ids).toEqual(['encore-logo-a', 'encore-logo-b']);
    const second = container.querySelectorAll('svg')[1]!;
    expect(second.querySelector('path[stroke]')).toHaveAttribute('stroke', 'url(#encore-logo-b)');
    expect(second).toHaveAttribute('width', '165.2');
  });
});
