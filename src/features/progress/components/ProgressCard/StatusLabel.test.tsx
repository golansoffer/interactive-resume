import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { StatusLabel as StatusLabelValue } from '../../types/status-label';
import { StatusLabel } from './StatusLabel';

describe('StatusLabel', () => {
  it('renders STANDBY for standby kind', () => {
    const value: StatusLabelValue = { kind: 'standby' };
    render(<StatusLabel value={value} />);
    expect(screen.getByText('STANDBY')).toBeTruthy();
  });

  it('renders ACTIVE for active kind', () => {
    const value: StatusLabelValue = { kind: 'active' };
    render(<StatusLabel value={value} />);
    expect(screen.getByText('ACTIVE')).toBeTruthy();
  });

  it('renders EXPLORED for last_explored kind', () => {
    const value: StatusLabelValue = { kind: 'last_explored' };
    render(<StatusLabel value={value} />);
    expect(screen.getByText('EXPLORED')).toBeTruthy();
  });

  it('renders COMPLETE for route_complete kind', () => {
    const value: StatusLabelValue = { kind: 'route_complete' };
    render(<StatusLabel value={value} />);
    expect(screen.getByText('COMPLETE')).toBeTruthy();
  });

  it('exposes the kind as data-status on the root element', () => {
    const value: StatusLabelValue = { kind: 'active' };
    const { container } = render(<StatusLabel value={value} />);
    const root = container.querySelector('[data-status="active"]');
    expect(root).not.toBeNull();
  });
});
