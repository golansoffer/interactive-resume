import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import type { Counter } from '../../types/counter';
import { ProgressCounter } from './ProgressCounter';

const queryNumbers = (container: HTMLElement): ReadonlyArray<string> => {
  const nodes = container.querySelectorAll('[data-count]');
  return Array.from(nodes).map((n) => n.textContent ?? '');
};

describe('ProgressCounter', () => {
  it('renders "00 / 05" when idle with 0 visited', () => {
    const counter: Counter = { kind: 'idle', visited: 0, total: 5 };
    const { container } = render(<ProgressCounter value={counter} flipKey={0} />);
    expect(queryNumbers(container)).toEqual(['00', '05']);
  });

  it('renders "02 / 05" when idle with 2 visited', () => {
    const counter: Counter = { kind: 'idle', visited: 2, total: 5 };
    const { container } = render(<ProgressCounter value={counter} flipKey={2} />);
    expect(queryNumbers(container)).toEqual(['02', '05']);
  });

  it('renders "05 / 05" when complete', () => {
    const counter: Counter = { kind: 'complete', total: 5 };
    const { container } = render(<ProgressCounter value={counter} flipKey={5} />);
    expect(queryNumbers(container)).toEqual(['05', '05']);
  });

  it('exposes data-state="idle" or data-state="complete" on the root', () => {
    const idle: Counter = { kind: 'idle', visited: 1, total: 5 };
    const { container: idleC } = render(<ProgressCounter value={idle} flipKey={1} />);
    expect(idleC.querySelector('[data-state="idle"]')).not.toBeNull();

    const complete: Counter = { kind: 'complete', total: 5 };
    const { container: completeC } = render(<ProgressCounter value={complete} flipKey={5} />);
    expect(completeC.querySelector('[data-state="complete"]')).not.toBeNull();
  });
});
