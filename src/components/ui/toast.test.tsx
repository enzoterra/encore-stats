import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithIntl } from '../../../tests/support/intl';
import { toast, ToastViewport, useToasts } from './toast';

afterEach(() => {
  vi.useRealTimers();
  useToasts.setState({ queue: [], raised: false });
});

describe('<ToastViewport /> (10-design.md §8.13)', () => {
  it('mostra um por vez, some em 5 s e pausa com o ponteiro em cima', () => {
    vi.useFakeTimers();
    renderWithIntl(<ToastViewport />);
    act(() => {
      toast('Primeiro', 'success');
      toast('Segundo');
    });
    expect(screen.getByRole('status')).toHaveTextContent('Primeiro');
    expect(screen.queryByText('Segundo')).toBeNull();

    fireEvent.pointerEnter(screen.getByTestId('toast'));
    act(() => vi.advanceTimersByTime(6000));
    expect(screen.getByText('Primeiro')).toBeInTheDocument();
    fireEvent.pointerLeave(screen.getByTestId('toast'));
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByRole('status')).toHaveTextContent('Segundo');

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByTestId('toast')).toBeNull();
  });

  it('erro vai para role=alert e o persistente não some sozinho', () => {
    vi.useFakeTimers();
    renderWithIntl(<ToastViewport />);
    act(() => toast('Falhou', 'danger', true));
    expect(screen.getByRole('alert')).toHaveTextContent('Falhou');
    act(() => vi.advanceTimersByTime(20_000));
    expect(screen.getByText('Falhou')).toBeInTheDocument();
  });
});
