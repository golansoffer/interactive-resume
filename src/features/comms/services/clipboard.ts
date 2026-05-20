export type CopyResult = { readonly kind: 'ok' } | { readonly kind: 'failed' };

export type ClipboardEnv = {
  readonly writeViaClipboardApi:
    | { readonly kind: 'available'; readonly writeText: (value: string) => Promise<void> }
    | { readonly kind: 'unavailable' };
  readonly writeViaExecCommand:
    | { readonly kind: 'available'; readonly run: (value: string) => boolean }
    | { readonly kind: 'unavailable' };
};

export const createCopyToClipboard = (
  env: ClipboardEnv,
): ((value: string) => Promise<CopyResult>) => {
  return async (value: string): Promise<CopyResult> => {
    if (env.writeViaClipboardApi.kind === 'available') {
      const apiResult = await runClipboardApi(env.writeViaClipboardApi.writeText, value);
      if (apiResult.kind === 'ok') return apiResult;
    }
    if (env.writeViaExecCommand.kind === 'available') {
      const execResult = runExecCommand(env.writeViaExecCommand.run, value);
      if (execResult.kind === 'ok') return execResult;
    }
    return { kind: 'failed' };
  };
};

const runClipboardApi = async (
  writeText: (value: string) => Promise<void>,
  value: string,
): Promise<CopyResult> => {
  try {
    await writeText(value);
    return { kind: 'ok' };
  } catch {
    return { kind: 'failed' };
  }
};

const runExecCommand = (
  run: (value: string) => boolean,
  value: string,
): CopyResult => {
  try {
    return run(value) ? { kind: 'ok' } : { kind: 'failed' };
  } catch {
    return { kind: 'failed' };
  }
};

const detectClipboardApi = (): ClipboardEnv['writeViaClipboardApi'] => {
  const nav: Navigator | undefined = globalThis.navigator;
  if (nav === undefined) return { kind: 'unavailable' };
  const clipboard = nav.clipboard;
  if (clipboard === undefined) return { kind: 'unavailable' };
  if (typeof clipboard.writeText !== 'function') return { kind: 'unavailable' };
  const writeText = clipboard.writeText.bind(clipboard);
  return { kind: 'available', writeText };
};

const detectExecCommand = (): ClipboardEnv['writeViaExecCommand'] => {
  const doc: Document | undefined = globalThis.document;
  if (doc === undefined) return { kind: 'unavailable' };
  if (typeof doc.execCommand !== 'function') return { kind: 'unavailable' };
  const run = (value: string): boolean => {
    const textarea = doc.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    doc.body.append(textarea);
    textarea.select();
    const ok = doc.execCommand('copy');
    textarea.remove();
    return ok;
  };
  return { kind: 'available', run };
};

const defaultClipboardEnv = (): ClipboardEnv => ({
  writeViaClipboardApi: detectClipboardApi(),
  writeViaExecCommand: detectExecCommand(),
});

export const copyToClipboard = (value: string): Promise<CopyResult> =>
  createCopyToClipboard(defaultClipboardEnv())(value);
