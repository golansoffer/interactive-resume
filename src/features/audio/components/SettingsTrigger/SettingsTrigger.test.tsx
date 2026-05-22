import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsTrigger } from './SettingsTrigger';

const noop = (): void => {};

afterEach(() => {
  cleanup();
});

describe('SettingsTrigger', () => {
  it('renders a button labeled "Audio settings"', () => {
    render(<SettingsTrigger open={false} controlsId="panel-id" onToggle={noop} />);
    expect(screen.getByRole('button', { name: 'Audio settings' })).toBeDefined();
  });

  it('sets aria-expanded to false when open=false', () => {
    render(<SettingsTrigger open={false} controlsId="panel-id" onToggle={noop} />);
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('false');
  });

  it('sets aria-expanded to true when open=true', () => {
    render(<SettingsTrigger open={true} controlsId="panel-id" onToggle={noop} />);
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('true');
  });

  it('wires aria-controls to the given id', () => {
    render(<SettingsTrigger open={false} controlsId="my-panel" onToggle={noop} />);
    expect(screen.getByRole('button').getAttribute('aria-controls')).toBe('my-panel');
  });

  it('fires onToggle exactly once when clicked', () => {
    const onToggle = vi.fn();
    render(<SettingsTrigger open={false} controlsId="panel-id" onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
