import { describe, expect, it, vi } from 'vitest';
import { createCopyToClipboard, type ClipboardEnv } from './clipboard';

const envWithApi = (writeText: (value: string) => Promise<void>): ClipboardEnv => ({
  writeViaClipboardApi: { kind: 'available', writeText },
  writeViaExecCommand: { kind: 'unavailable' },
});

const envWithExec = (run: (value: string) => boolean): ClipboardEnv => ({
  writeViaClipboardApi: { kind: 'unavailable' },
  writeViaExecCommand: { kind: 'available', run },
});

const envEmpty = (): ClipboardEnv => ({
  writeViaClipboardApi: { kind: 'unavailable' },
  writeViaExecCommand: { kind: 'unavailable' },
});

describe('copyToClipboard — Clipboard API available', () => {
  it('resolves to kind "ok" when the underlying write resolves', async () => {
    const copy = createCopyToClipboard(envWithApi(() => Promise.resolve()));
    await expect(copy('hello')).resolves.toEqual({ kind: 'ok' });
  });

  it('passes the exact input string to the underlying write', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    const copy = createCopyToClipboard(envWithApi(writeText));
    await copy('Gsoffer550@gmail.com');
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith('Gsoffer550@gmail.com');
  });

  it('does not throw on rejection — failures surface as a kind "failed" result', async () => {
    const copy = createCopyToClipboard(envWithApi(() => Promise.reject(new Error('denied'))));
    await expect(copy('x')).resolves.toEqual({ kind: 'failed' });
  });
});

describe('copyToClipboard — fallback to execCommand', () => {
  it('falls back to execCommand when the Clipboard API is unavailable, and resolves to kind "ok"', async () => {
    const run = vi.fn(() => true);
    const copy = createCopyToClipboard(envWithExec(run));
    await expect(copy('value')).resolves.toEqual({ kind: 'ok' });
    expect(run).toHaveBeenCalledWith('value');
  });

  it('resolves to kind "failed" when execCommand returns false', async () => {
    const copy = createCopyToClipboard(envWithExec(() => false));
    await expect(copy('value')).resolves.toEqual({ kind: 'failed' });
  });

  it('falls back to execCommand when the Clipboard API rejects', async () => {
    const run = vi.fn(() => true);
    const env: ClipboardEnv = {
      writeViaClipboardApi: { kind: 'available', writeText: () => Promise.reject(new Error('blocked')) },
      writeViaExecCommand: { kind: 'available', run },
    };
    await expect(createCopyToClipboard(env)('x')).resolves.toEqual({ kind: 'ok' });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('does not throw when execCommand throws — surfaces as kind "failed"', async () => {
    const copy = createCopyToClipboard(
      envWithExec(() => {
        throw new Error('insecure');
      }),
    );
    await expect(copy('x')).resolves.toEqual({ kind: 'failed' });
  });
});

describe('copyToClipboard — no clipboard capability', () => {
  it('resolves to kind "failed" when no clipboard capability is available', async () => {
    await expect(createCopyToClipboard(envEmpty())('x')).resolves.toEqual({ kind: 'failed' });
  });
});

describe('copyToClipboard — purity / freshness', () => {
  it('returns a fresh result object per call (no shared state between calls)', async () => {
    const copy = createCopyToClipboard(envWithApi(() => Promise.resolve()));
    const a = await copy('one');
    const b = await copy('two');
    expect(a).toEqual({ kind: 'ok' });
    expect(b).toEqual({ kind: 'ok' });
    expect(a).not.toBe(b);
  });

  it('calls the underlying write once per call', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    const copy = createCopyToClipboard(envWithApi(writeText));
    await copy('a');
    await copy('b');
    await copy('c');
    expect(writeText).toHaveBeenCalledTimes(3);
  });
});
