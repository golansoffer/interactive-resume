# Spaceship Audio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three looping audio sources to the scene (`rocket_engine.mp3`, `rocket_boost.mp3`, `theme.mp3`) with a top-left UI cluster (mute toggle + settings panel with four volume sliders), all settings persisted in localStorage and pushed through a Web Audio adapter that reacts to scene state and the existing smoothed boost factor.

**Architecture:** New vertical-slice feature `src/features/audio/` containing the Web Audio service (`createSpaceshipAudio`), pure UI components (mute toggle, settings cog, panel, volume slider), the localStorage-backed settings hook (`useAudioSettings`), and a composition-root widget (`AudioControlsWidget`). The audio service is a pure callback-shaped externality wrapper with no React; the React side observes the same localStorage entry from two places — `useScene` (pushes settings into the service) and `AudioControlsWidget` (renders/edits). Boost gain ticks per frame through `audio.setBoost(...)` called from the existing `useFrame` in `Player.tsx`; scene-alive transitions ride a `useEffect` in `useScene`.

**Tech Stack:** TypeScript, React 19, Vitest + jsdom (test runner), `@testing-library/react`, `lucide-react` (icons: `Volume2`, `VolumeX`, `SlidersHorizontal`), Tailwind v4, Web Audio API (mocked in tests via a hand-rolled fake context), `pnpm` task runner.

**Spec:** `docs/superpowers/specs/2026-05-22-spaceship-audio-design.md` — read in full before starting Task 1.

**Task structure:** Bottom-up TDD. Types first (Task 1), then pure parsers and hooks (Tasks 2–3), then pure components in isolation (Tasks 4–7), then the widget that composes them (Task 8), then the audio service built one TDD cycle at a time (Tasks 9–18), then the scene wiring (Tasks 19–21), then a manual browser smoke test (Task 22). At every task boundary the codebase typechecks, all tests pass, and `pnpm check` passes.

---

## Task 1: Audio types

Define the port type `SpaceshipAudio`, the `AudioChannel` union, the `AudioSettings` shape, and the `DEFAULT_AUDIO_SETTINGS` constants. No logic, no tests — types only.

**Files:**
- Create: `src/features/audio/types/audio-orchestrator.ts`
- Create: `src/features/audio/types/audio-settings.ts`

- [ ] **Step 1: Create the audio-orchestrator port type**

Create `src/features/audio/types/audio-orchestrator.ts`:

```typescript
export type AudioChannel = 'master' | 'music' | 'engine' | 'boost';

export type SpaceshipAudio = {
  readonly setSceneAlive: (alive: boolean) => void;
  readonly setBoost: (active: boolean, factor: number) => void;
  readonly setMuted: (muted: boolean) => void;
  readonly setVolume: (channel: AudioChannel, value: number) => void;
  readonly dispose: () => void;
};
```

- [ ] **Step 2: Create the audio-settings type + defaults**

Create `src/features/audio/types/audio-settings.ts`:

```typescript
export type AudioSettings = {
  readonly muted: boolean;
  readonly master: number;
  readonly music: number;
  readonly engine: number;
  readonly boost: number;
};

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  muted: false,
  master: 1.0,
  music: 0.5,
  engine: 0.4,
  boost: 0.7,
};
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm typecheck`
Expected: exits 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/audio/types/audio-orchestrator.ts src/features/audio/types/audio-settings.ts
git commit -m "audio: port type and settings shape"
```

---

## Task 2: parseAudioSettings — boundary parser

Parse unknown JSON into a guaranteed-valid `AudioSettings`. Reject malformed shapes, clamp out-of-range volumes to [0, 1], fall back to `DEFAULT_AUDIO_SETTINGS` on any failure. This is the only place `AudioSettings` is constructed from untrusted input.

**Files:**
- Create: `src/features/audio/types/parseAudioSettings.ts`
- Test: `src/features/audio/types/parseAudioSettings.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/audio/types/parseAudioSettings.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { DEFAULT_AUDIO_SETTINGS } from './audio-settings';
import { parseAudioSettings } from './parseAudioSettings';

describe('parseAudioSettings', () => {
  it('returns defaults when input is null', () => {
    expect(parseAudioSettings(null)).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it('returns defaults when input is undefined', () => {
    expect(parseAudioSettings(undefined)).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it('returns defaults when input is a non-object primitive', () => {
    expect(parseAudioSettings(42)).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(parseAudioSettings('hello')).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(parseAudioSettings(true)).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it('returns defaults when fields are missing', () => {
    expect(parseAudioSettings({ muted: true })).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it('parses a fully-valid settings object', () => {
    const input = { muted: true, master: 0.5, music: 0.3, engine: 0.2, boost: 0.9 };
    expect(parseAudioSettings(input)).toEqual(input);
  });

  it('clamps a volume above 1 to 1', () => {
    const input = { muted: false, master: 5.0, music: 0.5, engine: 0.5, boost: 0.5 };
    expect(parseAudioSettings(input).master).toBe(1.0);
  });

  it('clamps a negative volume to 0', () => {
    const input = { muted: false, master: -0.3, music: 0.5, engine: 0.5, boost: 0.5 };
    expect(parseAudioSettings(input).master).toBe(0);
  });

  it('returns defaults when a volume is not a finite number', () => {
    const input = { muted: false, master: NaN, music: 0.5, engine: 0.5, boost: 0.5 };
    expect(parseAudioSettings(input)).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it('returns defaults when muted is not a boolean', () => {
    const input = { muted: 'yes', master: 0.5, music: 0.5, engine: 0.5, boost: 0.5 };
    expect(parseAudioSettings(input)).toEqual(DEFAULT_AUDIO_SETTINGS);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/features/audio/types/parseAudioSettings.test.ts`
Expected: FAIL with module-not-found / undefined-import errors.

- [ ] **Step 3: Implement parseAudioSettings**

Create `src/features/audio/types/parseAudioSettings.ts`:

```typescript
import { DEFAULT_AUDIO_SETTINGS, type AudioSettings } from './audio-settings';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const parseVolume = (value: unknown): number | null => {
  if (typeof value !== 'number') return null;
  if (!Number.isFinite(value)) return null;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

export const parseAudioSettings = (raw: unknown): AudioSettings => {
  if (!isRecord(raw)) return DEFAULT_AUDIO_SETTINGS;
  if (typeof raw['muted'] !== 'boolean') return DEFAULT_AUDIO_SETTINGS;
  const master = parseVolume(raw['master']);
  const music = parseVolume(raw['music']);
  const engine = parseVolume(raw['engine']);
  const boost = parseVolume(raw['boost']);
  if (master === null || music === null || engine === null || boost === null) {
    return DEFAULT_AUDIO_SETTINGS;
  }
  return { muted: raw['muted'], master, music, engine, boost };
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/features/audio/types/parseAudioSettings.test.ts`
Expected: PASS, all 9 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/features/audio/types/parseAudioSettings.ts src/features/audio/types/parseAudioSettings.test.ts
git commit -m "audio: parseAudioSettings boundary parser"
```

---

## Task 3: useAudioSettings hook

localStorage-backed React hook returning `{ settings, setMuted, setVolume, reset }`. Subscribes to `'storage'` events for cross-tab sync. Stores the whole struct as one JSON-encoded key (`audio.settings`).

**Files:**
- Create: `src/features/audio/widget/controls/useAudioSettings.ts`
- Test: `src/features/audio/widget/controls/useAudioSettings.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/audio/widget/controls/useAudioSettings.test.ts`:

```typescript
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_AUDIO_SETTINGS } from '../../types/audio-settings';
import { AUDIO_SETTINGS_STORAGE_KEY, useAudioSettings } from './useAudioSettings';

describe('useAudioSettings', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('returns defaults when localStorage is empty', () => {
    const { result } = renderHook(() => useAudioSettings());
    expect(result.current.settings).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it('reads existing valid settings from localStorage on mount', () => {
    const stored = { muted: true, master: 0.6, music: 0.4, engine: 0.3, boost: 0.5 };
    window.localStorage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify(stored));
    const { result } = renderHook(() => useAudioSettings());
    expect(result.current.settings).toEqual(stored);
  });

  it('falls back to defaults when localStorage holds malformed JSON', () => {
    window.localStorage.setItem(AUDIO_SETTINGS_STORAGE_KEY, '{not valid');
    const { result } = renderHook(() => useAudioSettings());
    expect(result.current.settings).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it('falls back to defaults when localStorage holds a malformed shape', () => {
    window.localStorage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify({ muted: 'yes' }));
    const { result } = renderHook(() => useAudioSettings());
    expect(result.current.settings).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it('setMuted updates state and writes localStorage', () => {
    const { result } = renderHook(() => useAudioSettings());
    act(() => {
      result.current.setMuted(true);
    });
    expect(result.current.settings.muted).toBe(true);
    const stored = JSON.parse(window.localStorage.getItem(AUDIO_SETTINGS_STORAGE_KEY) ?? '{}');
    expect(stored.muted).toBe(true);
  });

  it('setVolume updates the named channel and persists', () => {
    const { result } = renderHook(() => useAudioSettings());
    act(() => {
      result.current.setVolume('music', 0.25);
    });
    expect(result.current.settings.music).toBe(0.25);
    const stored = JSON.parse(window.localStorage.getItem(AUDIO_SETTINGS_STORAGE_KEY) ?? '{}');
    expect(stored.music).toBe(0.25);
  });

  it('reset restores defaults and persists', () => {
    const { result } = renderHook(() => useAudioSettings());
    act(() => {
      result.current.setMuted(true);
      result.current.setVolume('master', 0.2);
    });
    act(() => {
      result.current.reset();
    });
    expect(result.current.settings).toEqual(DEFAULT_AUDIO_SETTINGS);
    const stored = JSON.parse(window.localStorage.getItem(AUDIO_SETTINGS_STORAGE_KEY) ?? '{}');
    expect(stored).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it('reacts to a storage event for the audio key from another tab', () => {
    const { result } = renderHook(() => useAudioSettings());
    const updated = { muted: true, master: 0.1, music: 0.2, engine: 0.3, boost: 0.4 };
    act(() => {
      window.localStorage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: AUDIO_SETTINGS_STORAGE_KEY,
          newValue: JSON.stringify(updated),
        }),
      );
    });
    expect(result.current.settings).toEqual(updated);
  });

  it('ignores storage events for unrelated keys', () => {
    const { result } = renderHook(() => useAudioSettings());
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'unrelated', newValue: 'whatever' }),
      );
    });
    expect(result.current.settings).toEqual(DEFAULT_AUDIO_SETTINGS);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/features/audio/widget/controls/useAudioSettings.test.ts`
Expected: FAIL with module-not-found errors.

- [ ] **Step 3: Implement useAudioSettings**

Create `src/features/audio/widget/controls/useAudioSettings.ts`:

```typescript
import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_AUDIO_SETTINGS, type AudioSettings } from '../../types/audio-settings';
import type { AudioChannel } from '../../types/audio-orchestrator';
import { parseAudioSettings } from '../../types/parseAudioSettings';

export const AUDIO_SETTINGS_STORAGE_KEY = 'audio.settings';

const readFromStorage = (): AudioSettings => {
  const raw = window.localStorage.getItem(AUDIO_SETTINGS_STORAGE_KEY);
  if (raw === null) return DEFAULT_AUDIO_SETTINGS;
  try {
    return parseAudioSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_AUDIO_SETTINGS;
  }
};

const writeToStorage = (settings: AudioSettings): void => {
  window.localStorage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
};

export type UseAudioSettingsResult = {
  readonly settings: AudioSettings;
  readonly setMuted: (muted: boolean) => void;
  readonly setVolume: (channel: AudioChannel, value: number) => void;
  readonly reset: () => void;
};

export const useAudioSettings = (): UseAudioSettingsResult => {
  const [settings, setSettings] = useState<AudioSettings>(readFromStorage);

  useEffect(() => {
    const handler = (event: StorageEvent): void => {
      if (event.key !== AUDIO_SETTINGS_STORAGE_KEY) return;
      setSettings(readFromStorage());
    };
    window.addEventListener('storage', handler);
    return (): void => {
      window.removeEventListener('storage', handler);
    };
  }, []);

  const setMuted = useCallback((muted: boolean): void => {
    setSettings((prev) => {
      const next: AudioSettings = { ...prev, muted };
      writeToStorage(next);
      return next;
    });
  }, []);

  const setVolume = useCallback((channel: AudioChannel, value: number): void => {
    setSettings((prev) => {
      const next: AudioSettings = { ...prev, [channel]: value };
      writeToStorage(next);
      return next;
    });
  }, []);

  const reset = useCallback((): void => {
    writeToStorage(DEFAULT_AUDIO_SETTINGS);
    setSettings(DEFAULT_AUDIO_SETTINGS);
  }, []);

  return { settings, setMuted, setVolume, reset };
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/features/audio/widget/controls/useAudioSettings.test.ts`
Expected: PASS, all 9 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/features/audio/widget/controls/useAudioSettings.ts src/features/audio/widget/controls/useAudioSettings.test.ts
git commit -m "audio: useAudioSettings hook with localStorage"
```

---

## Task 4: VolumeSlider component

Pure single-row slider — label on the left, percentage readout on the right, native range input below. Emits `(value: number)` in the [0, 1] domain.

**Files:**
- Create: `src/features/audio/components/AudioSettingsPanel/VolumeSlider.tsx`
- Test: `src/features/audio/components/AudioSettingsPanel/VolumeSlider.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/features/audio/components/AudioSettingsPanel/VolumeSlider.test.tsx`:

```typescript
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VolumeSlider } from './VolumeSlider';

afterEach(() => {
  cleanup();
});

describe('VolumeSlider', () => {
  it('renders the label', () => {
    render(<VolumeSlider label="Master" value={0.8} onChange={() => {}} />);
    expect(screen.getByText('Master')).toBeDefined();
  });

  it('renders the percentage readout rounded to nearest integer', () => {
    render(<VolumeSlider label="Music" value={0.456} onChange={() => {}} />);
    expect(screen.getByText('46%')).toBeDefined();
  });

  it('renders 0% for value 0', () => {
    render(<VolumeSlider label="Engine" value={0} onChange={() => {}} />);
    expect(screen.getByText('0%')).toBeDefined();
  });

  it('renders 100% for value 1', () => {
    render(<VolumeSlider label="Boost" value={1} onChange={() => {}} />);
    expect(screen.getByText('100%')).toBeDefined();
  });

  it('range input has value matching value * 100', () => {
    render(<VolumeSlider label="Master" value={0.8} onChange={() => {}} />);
    const input = screen.getByRole('slider') as HTMLInputElement;
    expect(input.value).toBe('80');
  });

  it('fires onChange with value / 100 when input changes', () => {
    const onChange = vi.fn();
    render(<VolumeSlider label="Master" value={0.5} onChange={onChange} />);
    const input = screen.getByRole('slider') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '65' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(0.65);
  });

  it('has aria attributes for screen readers', () => {
    render(<VolumeSlider label="Music" value={0.3} onChange={() => {}} />);
    const input = screen.getByRole('slider');
    expect(input.getAttribute('aria-label')).toBe('Music');
    expect(input.getAttribute('aria-valuemin')).toBe('0');
    expect(input.getAttribute('aria-valuemax')).toBe('100');
    expect(input.getAttribute('aria-valuenow')).toBe('30');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/features/audio/components/AudioSettingsPanel/VolumeSlider.test.tsx`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement VolumeSlider**

Create `src/features/audio/components/AudioSettingsPanel/VolumeSlider.tsx`:

```typescript
import type { ChangeEvent, JSX } from 'react';

type VolumeSliderProps = {
  readonly label: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
};

export const VolumeSlider = ({ label, value, onChange }: VolumeSliderProps): JSX.Element => {
  const percent = Math.round(value * 100);
  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onChange(Number(event.target.value) / 100);
  };
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80">
          {label}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
          {percent}%
        </span>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        step="1"
        value={percent}
        onChange={handleChange}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-foreground/15 accent-foreground"
      />
    </div>
  );
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/features/audio/components/AudioSettingsPanel/VolumeSlider.test.tsx`
Expected: PASS, all 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/features/audio/components/AudioSettingsPanel/VolumeSlider.tsx src/features/audio/components/AudioSettingsPanel/VolumeSlider.test.tsx
git commit -m "audio: VolumeSlider component"
```

---

## Task 5: MuteToggle component

Pure 40×40 icon-button. Renders `Volume2` when unmuted, `VolumeX` when muted. Click fires `onToggle`.

**Files:**
- Create: `src/features/audio/components/MuteToggle/MuteToggle.tsx`
- Test: `src/features/audio/components/MuteToggle/MuteToggle.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/features/audio/components/MuteToggle/MuteToggle.test.tsx`:

```typescript
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MuteToggle } from './MuteToggle';

afterEach(() => {
  cleanup();
});

describe('MuteToggle', () => {
  it('renders a button with the unmuted aria-label when muted=false', () => {
    render(<MuteToggle muted={false} onToggle={() => {}} />);
    expect(screen.getByRole('button', { name: 'Mute audio' })).toBeDefined();
  });

  it('renders a button with the muted aria-label when muted=true', () => {
    render(<MuteToggle muted={true} onToggle={() => {}} />);
    expect(screen.getByRole('button', { name: 'Unmute audio' })).toBeDefined();
  });

  it('sets aria-pressed to match muted', () => {
    const { rerender } = render(<MuteToggle muted={false} onToggle={() => {}} />);
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('false');
    rerender(<MuteToggle muted={true} onToggle={() => {}} />);
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true');
  });

  it('fires onToggle exactly once when clicked', () => {
    const onToggle = vi.fn();
    render(<MuteToggle muted={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/features/audio/components/MuteToggle/MuteToggle.test.tsx`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement MuteToggle**

Create `src/features/audio/components/MuteToggle/MuteToggle.tsx`:

```typescript
import type { JSX } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

type MuteToggleProps = {
  readonly muted: boolean;
  readonly onToggle: () => void;
};

const BUTTON_CLASSES =
  'flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/25 text-foreground/85 opacity-55 shadow-lg backdrop-blur-md transition-opacity duration-200 ease-out hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/50';

export const MuteToggle = ({ muted, onToggle }: MuteToggleProps): JSX.Element => {
  const label = muted ? 'Unmute audio' : 'Mute audio';
  const Icon = muted ? VolumeX : Volume2;
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={muted}
      onClick={onToggle}
      className={BUTTON_CLASSES}
    >
      <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/features/audio/components/MuteToggle/MuteToggle.test.tsx`
Expected: PASS, all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/features/audio/components/MuteToggle/MuteToggle.tsx src/features/audio/components/MuteToggle/MuteToggle.test.tsx
git commit -m "audio: MuteToggle component"
```

---

## Task 6: SettingsTrigger component

Pure 40×40 icon-button rendering `SlidersHorizontal`. Indicates panel-open state via `aria-expanded`.

**Files:**
- Create: `src/features/audio/components/SettingsTrigger/SettingsTrigger.tsx`
- Test: `src/features/audio/components/SettingsTrigger/SettingsTrigger.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/features/audio/components/SettingsTrigger/SettingsTrigger.test.tsx`:

```typescript
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsTrigger } from './SettingsTrigger';

afterEach(() => {
  cleanup();
});

describe('SettingsTrigger', () => {
  it('renders a button labeled "Audio settings"', () => {
    render(<SettingsTrigger open={false} controlsId="panel-id" onToggle={() => {}} />);
    expect(screen.getByRole('button', { name: 'Audio settings' })).toBeDefined();
  });

  it('sets aria-expanded to false when open=false', () => {
    render(<SettingsTrigger open={false} controlsId="panel-id" onToggle={() => {}} />);
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('false');
  });

  it('sets aria-expanded to true when open=true', () => {
    render(<SettingsTrigger open={true} controlsId="panel-id" onToggle={() => {}} />);
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('true');
  });

  it('wires aria-controls to the given id', () => {
    render(<SettingsTrigger open={false} controlsId="my-panel" onToggle={() => {}} />);
    expect(screen.getByRole('button').getAttribute('aria-controls')).toBe('my-panel');
  });

  it('fires onToggle exactly once when clicked', () => {
    const onToggle = vi.fn();
    render(<SettingsTrigger open={false} controlsId="panel-id" onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/features/audio/components/SettingsTrigger/SettingsTrigger.test.tsx`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement SettingsTrigger**

Create `src/features/audio/components/SettingsTrigger/SettingsTrigger.tsx`:

```typescript
import type { JSX } from 'react';
import { SlidersHorizontal } from 'lucide-react';

type SettingsTriggerProps = {
  readonly open: boolean;
  readonly controlsId: string;
  readonly onToggle: () => void;
};

const BUTTON_CLASSES =
  'flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/25 text-foreground/85 opacity-55 shadow-lg backdrop-blur-md transition-opacity duration-200 ease-out hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/50';

export const SettingsTrigger = ({
  open,
  controlsId,
  onToggle,
}: SettingsTriggerProps): JSX.Element => (
  <button
    type="button"
    aria-label="Audio settings"
    aria-expanded={open}
    aria-controls={controlsId}
    onClick={onToggle}
    className={BUTTON_CLASSES}
  >
    <SlidersHorizontal size={20} strokeWidth={1.75} aria-hidden="true" />
  </button>
);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/features/audio/components/SettingsTrigger/SettingsTrigger.test.tsx`
Expected: PASS, all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/features/audio/components/SettingsTrigger/SettingsTrigger.tsx src/features/audio/components/SettingsTrigger/SettingsTrigger.test.tsx
git commit -m "audio: SettingsTrigger component"
```

---

## Task 7: AudioSettingsPanel component

Pure floating panel containing the four sliders + a reset button.

**Files:**
- Create: `src/features/audio/components/AudioSettingsPanel/AudioSettingsPanel.tsx`
- Test: `src/features/audio/components/AudioSettingsPanel/AudioSettingsPanel.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/features/audio/components/AudioSettingsPanel/AudioSettingsPanel.test.tsx`:

```typescript
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AUDIO_SETTINGS } from '../../types/audio-settings';
import { AudioSettingsPanel } from './AudioSettingsPanel';

afterEach(() => {
  cleanup();
});

describe('AudioSettingsPanel', () => {
  const baseProps = {
    id: 'panel',
    settings: DEFAULT_AUDIO_SETTINGS,
    onSetVolume: () => {},
    onReset: () => {},
  };

  it('renders four labeled sliders: Master, Music, Engine, Boost', () => {
    render(<AudioSettingsPanel {...baseProps} />);
    expect(screen.getByRole('slider', { name: 'Master' })).toBeDefined();
    expect(screen.getByRole('slider', { name: 'Music' })).toBeDefined();
    expect(screen.getByRole('slider', { name: 'Engine' })).toBeDefined();
    expect(screen.getByRole('slider', { name: 'Boost' })).toBeDefined();
  });

  it('reflects the settings values on each slider', () => {
    const settings = { muted: false, master: 0.8, music: 0.5, engine: 0.4, boost: 0.7 };
    render(<AudioSettingsPanel {...baseProps} settings={settings} />);
    expect((screen.getByRole('slider', { name: 'Master' }) as HTMLInputElement).value).toBe('80');
    expect((screen.getByRole('slider', { name: 'Music' }) as HTMLInputElement).value).toBe('50');
    expect((screen.getByRole('slider', { name: 'Engine' }) as HTMLInputElement).value).toBe('40');
    expect((screen.getByRole('slider', { name: 'Boost' }) as HTMLInputElement).value).toBe('70');
  });

  it('fires onSetVolume with the master channel when the master slider changes', () => {
    const onSetVolume = vi.fn();
    render(<AudioSettingsPanel {...baseProps} onSetVolume={onSetVolume} />);
    fireEvent.change(screen.getByRole('slider', { name: 'Master' }), { target: { value: '20' } });
    expect(onSetVolume).toHaveBeenCalledWith('master', 0.2);
  });

  it('fires onSetVolume with the music channel when the music slider changes', () => {
    const onSetVolume = vi.fn();
    render(<AudioSettingsPanel {...baseProps} onSetVolume={onSetVolume} />);
    fireEvent.change(screen.getByRole('slider', { name: 'Music' }), { target: { value: '33' } });
    expect(onSetVolume).toHaveBeenCalledWith('music', 0.33);
  });

  it('fires onSetVolume with the engine channel when the engine slider changes', () => {
    const onSetVolume = vi.fn();
    render(<AudioSettingsPanel {...baseProps} onSetVolume={onSetVolume} />);
    fireEvent.change(screen.getByRole('slider', { name: 'Engine' }), { target: { value: '15' } });
    expect(onSetVolume).toHaveBeenCalledWith('engine', 0.15);
  });

  it('fires onSetVolume with the boost channel when the boost slider changes', () => {
    const onSetVolume = vi.fn();
    render(<AudioSettingsPanel {...baseProps} onSetVolume={onSetVolume} />);
    fireEvent.change(screen.getByRole('slider', { name: 'Boost' }), { target: { value: '90' } });
    expect(onSetVolume).toHaveBeenCalledWith('boost', 0.9);
  });

  it('fires onReset when the reset button is clicked', () => {
    const onReset = vi.fn();
    render(<AudioSettingsPanel {...baseProps} onReset={onReset} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('sets the container id for aria-controls linkage', () => {
    const { container } = render(<AudioSettingsPanel {...baseProps} id="my-panel" />);
    expect(container.querySelector('#my-panel')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/features/audio/components/AudioSettingsPanel/AudioSettingsPanel.test.tsx`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement AudioSettingsPanel**

Create `src/features/audio/components/AudioSettingsPanel/AudioSettingsPanel.tsx`:

```typescript
import type { JSX } from 'react';
import type { AudioChannel } from '../../types/audio-orchestrator';
import type { AudioSettings } from '../../types/audio-settings';
import { VolumeSlider } from './VolumeSlider';

type AudioSettingsPanelProps = {
  readonly id: string;
  readonly settings: AudioSettings;
  readonly onSetVolume: (channel: AudioChannel, value: number) => void;
  readonly onReset: () => void;
};

type Row = {
  readonly channel: AudioChannel;
  readonly label: string;
};

const ROWS: ReadonlyArray<Row> = [
  { channel: 'master', label: 'Master' },
  { channel: 'music', label: 'Music' },
  { channel: 'engine', label: 'Engine' },
  { channel: 'boost', label: 'Boost' },
];

const PANEL_CLASSES =
  'fixed top-[4.5rem] left-6 z-50 w-72 rounded-xl border border-white/10 bg-card/85 p-4 shadow-2xl ring-1 ring-foreground/10 backdrop-blur-md';

export const AudioSettingsPanel = ({
  id,
  settings,
  onSetVolume,
  onReset,
}: AudioSettingsPanelProps): JSX.Element => (
  <div id={id} role="group" aria-label="Audio settings" className={PANEL_CLASSES}>
    <div className="mb-3 text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80">
      Audio
    </div>
    <div className="flex flex-col gap-3">
      {ROWS.map((row) => (
        <VolumeSlider
          key={row.channel}
          label={row.label}
          value={settings[row.channel]}
          onChange={(value): void => onSetVolume(row.channel, value)}
        />
      ))}
    </div>
    <div className="mt-4 flex justify-end">
      <button
        type="button"
        onClick={onReset}
        className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
      >
        Reset to defaults
      </button>
    </div>
  </div>
);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/features/audio/components/AudioSettingsPanel/AudioSettingsPanel.test.tsx`
Expected: PASS, all 8 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/features/audio/components/AudioSettingsPanel/AudioSettingsPanel.tsx src/features/audio/components/AudioSettingsPanel/AudioSettingsPanel.test.tsx
git commit -m "audio: AudioSettingsPanel component"
```

---

## Task 8: AudioControlsWidget

Composition root for the top-left UI. Calls `useAudioSettings`, owns transient panel-open state, mounts `MuteToggle` + `SettingsTrigger` + (conditionally) `AudioSettingsPanel`. Handles outside-click and Escape-key to close the panel.

**Files:**
- Create: `src/features/audio/widget/controls/AudioControlsWidget.tsx`
- Test: `src/features/audio/widget/controls/AudioControlsWidget.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/features/audio/widget/controls/AudioControlsWidget.test.tsx`:

```typescript
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AudioControlsWidget } from './AudioControlsWidget';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

beforeEach(() => {
  window.localStorage.clear();
});

describe('AudioControlsWidget', () => {
  it('mounts the mute toggle and settings trigger', () => {
    render(<AudioControlsWidget />);
    expect(screen.getByRole('button', { name: 'Mute audio' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Audio settings' })).toBeDefined();
  });

  it('does not render the panel by default', () => {
    render(<AudioControlsWidget />);
    expect(screen.queryByRole('group', { name: 'Audio settings' })).toBeNull();
  });

  it('clicking the settings trigger opens the panel', () => {
    render(<AudioControlsWidget />);
    fireEvent.click(screen.getByRole('button', { name: 'Audio settings' }));
    expect(screen.getByRole('group', { name: 'Audio settings' })).toBeDefined();
  });

  it('clicking the settings trigger again closes the panel', () => {
    render(<AudioControlsWidget />);
    fireEvent.click(screen.getByRole('button', { name: 'Audio settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Audio settings' }));
    expect(screen.queryByRole('group', { name: 'Audio settings' })).toBeNull();
  });

  it('pressing Escape closes an open panel', () => {
    render(<AudioControlsWidget />);
    fireEvent.click(screen.getByRole('button', { name: 'Audio settings' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('group', { name: 'Audio settings' })).toBeNull();
  });

  it('clicking the mute button flips the mute state and re-renders with the unmute label', () => {
    render(<AudioControlsWidget />);
    fireEvent.click(screen.getByRole('button', { name: 'Mute audio' }));
    expect(screen.getByRole('button', { name: 'Unmute audio' })).toBeDefined();
  });

  it('changing the master slider persists to localStorage', () => {
    render(<AudioControlsWidget />);
    fireEvent.click(screen.getByRole('button', { name: 'Audio settings' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Master' }), { target: { value: '25' } });
    const stored = JSON.parse(window.localStorage.getItem('audio.settings') ?? '{}');
    expect(stored.master).toBe(0.25);
  });

  it('clicking Reset to defaults restores all sliders', () => {
    render(<AudioControlsWidget />);
    fireEvent.click(screen.getByRole('button', { name: 'Audio settings' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Master' }), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }));
    expect((screen.getByRole('slider', { name: 'Master' }) as HTMLInputElement).value).toBe('100');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/features/audio/widget/controls/AudioControlsWidget.test.tsx`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement AudioControlsWidget**

Create `src/features/audio/widget/controls/AudioControlsWidget.tsx`:

```typescript
import { useEffect, useState, type JSX } from 'react';
import { AudioSettingsPanel } from '../../components/AudioSettingsPanel/AudioSettingsPanel';
import { MuteToggle } from '../../components/MuteToggle/MuteToggle';
import { SettingsTrigger } from '../../components/SettingsTrigger/SettingsTrigger';
import { useAudioSettings } from './useAudioSettings';

const PANEL_ID = 'audio-settings-panel';
const CLUSTER_CLASSES = 'fixed top-6 left-6 z-50 flex gap-2';

export const AudioControlsWidget = (): JSX.Element => {
  const { settings, setMuted, setVolume, reset } = useAudioSettings();
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    if (!panelOpen) return undefined;
    const handler = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setPanelOpen(false);
    };
    window.addEventListener('keydown', handler);
    return (): void => {
      window.removeEventListener('keydown', handler);
    };
  }, [panelOpen]);

  return (
    <>
      <div className={CLUSTER_CLASSES}>
        <MuteToggle muted={settings.muted} onToggle={(): void => setMuted(!settings.muted)} />
        <SettingsTrigger
          open={panelOpen}
          controlsId={PANEL_ID}
          onToggle={(): void => setPanelOpen((prev) => !prev)}
        />
      </div>
      {panelOpen ? (
        <AudioSettingsPanel
          id={PANEL_ID}
          settings={settings}
          onSetVolume={setVolume}
          onReset={reset}
        />
      ) : null}
    </>
  );
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/features/audio/widget/controls/AudioControlsWidget.test.tsx`
Expected: PASS, all 8 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/features/audio/widget/controls/AudioControlsWidget.tsx src/features/audio/widget/controls/AudioControlsWidget.test.tsx
git commit -m "audio: AudioControlsWidget composes mute, trigger, panel"
```

---

## Task 9: Fake AudioContext test harness

Hand-rolled minimal AudioContext fake satisfying everything the service needs, exposed as a reusable module so the service tests stay focused on behavior. Tests for the fake live with it.

**Files:**
- Create: `src/features/audio/services/fakeAudioContext.ts`
- Test: `src/features/audio/services/fakeAudioContext.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/audio/services/fakeAudioContext.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { createFakeAudioContext } from './fakeAudioContext';

describe('createFakeAudioContext', () => {
  it('starts in suspended state', () => {
    const { ctx } = createFakeAudioContext();
    expect(ctx.state).toBe('suspended');
  });

  it('resume() transitions state to running', async () => {
    const { ctx } = createFakeAudioContext();
    await ctx.resume();
    expect(ctx.state).toBe('running');
  });

  it('currentTime starts at 0 and advances via advanceTime()', () => {
    const fake = createFakeAudioContext();
    expect(fake.ctx.currentTime).toBe(0);
    fake.advanceTime(1.5);
    expect(fake.ctx.currentTime).toBe(1.5);
  });

  it('createGain returns a node with gain.value = 1 by default', () => {
    const { ctx } = createFakeAudioContext();
    const node = ctx.createGain();
    expect(node.gain.value).toBe(1);
  });

  it('GainNode.gain.linearRampToValueAtTime records the target', () => {
    const { ctx } = createFakeAudioContext();
    const node = ctx.createGain();
    node.gain.linearRampToValueAtTime(0.5, 1.0);
    expect(node.gain.value).toBe(0.5);
  });

  it('createBufferSource returns a node with start tracking', () => {
    const { ctx } = createFakeAudioContext();
    const src = ctx.createBufferSource();
    expect(src.started).toBe(false);
    src.start(0);
    expect(src.started).toBe(true);
  });

  it('createBufferSource.stop marks the source stopped', () => {
    const { ctx } = createFakeAudioContext();
    const src = ctx.createBufferSource();
    src.start(0);
    src.stop();
    expect(src.stopped).toBe(true);
  });

  it('decodeAudioData resolves with a fake AudioBuffer', async () => {
    const { ctx } = createFakeAudioContext();
    const buf = await ctx.decodeAudioData(new ArrayBuffer(8));
    expect(buf).toBeDefined();
    expect(buf.duration).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/features/audio/services/fakeAudioContext.test.ts`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement the fake**

Create `src/features/audio/services/fakeAudioContext.ts`. The exported `*Like` types are structural — they describe only the API surface the audio service consumes, so both the fake (defined here) and the native Web Audio types (a structural superset) assign cleanly without casts.

```typescript
export type AudioParamLike = {
  value: number;
  setValueAtTime: (value: number, startTime: number) => unknown;
  linearRampToValueAtTime: (value: number, endTime: number) => unknown;
  cancelScheduledValues: (cancelTime: number) => unknown;
};

export type GainNodeLike = {
  readonly gain: AudioParamLike;
  connect: (destination: unknown) => unknown;
  disconnect: () => unknown;
};

export type AudioBufferLike = {
  readonly duration: number;
  readonly numberOfChannels: number;
  readonly sampleRate: number;
};

export type AudioBufferSourceNodeLike = {
  buffer: AudioBufferLike | null;
  loop: boolean;
  connect: (destination: unknown) => unknown;
  disconnect: () => unknown;
  start: (when?: number) => void;
  stop: (when?: number) => void;
};

// AudioContextLike intentionally omits `state` — the service never reads it,
// only the test harness does. Native `AudioContext.state` is `readonly` and
// would not be assignable to a writable target, so keeping it off the
// structural shape lets both native and fake satisfy it without casts.
export type AudioContextLike = {
  readonly currentTime: number;
  readonly destination: unknown;
  resume: () => Promise<void>;
  createGain: () => GainNodeLike;
  createBufferSource: () => AudioBufferSourceNodeLike;
  decodeAudioData: (data: ArrayBuffer) => Promise<AudioBufferLike>;
};

export type FakeAudioContext = AudioContextLike & {
  state: 'suspended' | 'running' | 'closed';
};

export type FakeAudioBufferSourceNode = AudioBufferSourceNodeLike & {
  started: boolean;
  stopped: boolean;
};

export type FakeContextHandle = {
  readonly ctx: FakeAudioContext;
  readonly advanceTime: (seconds: number) => void;
  readonly gains: ReadonlyArray<GainNodeLike>;
  readonly sources: ReadonlyArray<FakeAudioBufferSourceNode>;
};

const createParam = (initial: number): AudioParamLike => {
  const param: AudioParamLike = {
    value: initial,
    setValueAtTime(value: number): AudioParamLike {
      param.value = value;
      return param;
    },
    linearRampToValueAtTime(value: number): AudioParamLike {
      param.value = value;
      return param;
    },
    cancelScheduledValues(): AudioParamLike {
      return param;
    },
  };
  return param;
};

const createGainNode = (): GainNodeLike => ({
  gain: createParam(1),
  connect: (destination: unknown): unknown => destination,
  disconnect: (): unknown => undefined,
});

const createBufferSource = (): FakeAudioBufferSourceNode => {
  const node: FakeAudioBufferSourceNode = {
    buffer: null,
    loop: false,
    started: false,
    stopped: false,
    connect: (destination: unknown): unknown => destination,
    disconnect: (): unknown => undefined,
    start: (): void => {
      node.started = true;
    },
    stop: (): void => {
      node.stopped = true;
    },
  };
  return node;
};

const createBuffer = (): AudioBufferLike => ({
  duration: 1,
  numberOfChannels: 2,
  sampleRate: 44100,
});

export const createFakeAudioContext = (): FakeContextHandle => {
  const gains: GainNodeLike[] = [];
  const sources: FakeAudioBufferSourceNode[] = [];
  let currentTime = 0;
  const ctx: FakeAudioContext = {
    state: 'suspended',
    get currentTime(): number {
      return currentTime;
    },
    destination: { fake: true },
    async resume(): Promise<void> {
      ctx.state = 'running';
    },
    createGain(): GainNodeLike {
      const node = createGainNode();
      gains.push(node);
      return node;
    },
    createBufferSource(): AudioBufferSourceNodeLike {
      const node = createBufferSource();
      sources.push(node);
      return node;
    },
    async decodeAudioData(): Promise<AudioBufferLike> {
      return createBuffer();
    },
  };
  return {
    ctx,
    advanceTime: (seconds: number): void => {
      currentTime += seconds;
    },
    gains,
    sources,
  };
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/features/audio/services/fakeAudioContext.test.ts`
Expected: PASS, all 8 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/features/audio/services/fakeAudioContext.ts src/features/audio/services/fakeAudioContext.test.ts
git commit -m "audio: fake AudioContext test harness"
```

---

## Task 10: createSpaceshipAudio — pre-gesture state + pending capture

Service factory with injected `AudioContext` constructor and `fetch`. On construction, kicks off parallel fetch+decode for the three files. Before any gesture, setters update a `pending` record; no graph yet.

**Files:**
- Create: `src/features/audio/services/createSpaceshipAudio.ts`
- Test: `src/features/audio/services/createSpaceshipAudio.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/audio/services/createSpaceshipAudio.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSpaceshipAudio, type FetchLike } from './createSpaceshipAudio';
import {
  createFakeAudioContext,
  type AudioContextLike,
  type FakeContextHandle,
} from './fakeAudioContext';

type Deps = {
  readonly fetch: FetchLike;
  readonly fetchMock: ReturnType<typeof vi.fn>;
  readonly createContext: () => AudioContextLike;
  readonly handle: FakeContextHandle;
};

const setupDeps = (): Deps => {
  const handle = createFakeAudioContext();
  const fetchMock = vi.fn(async () => ({
    ok: true,
    arrayBuffer: async (): Promise<ArrayBuffer> => new ArrayBuffer(8),
  }));
  const fetch: FetchLike = fetchMock;
  return {
    fetch,
    fetchMock,
    createContext: (): AudioContextLike => handle.ctx,
    handle,
  };
};

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('createSpaceshipAudio — pre-gesture', () => {
  it('initiates a fetch for each of the three audio files', () => {
    const deps = setupDeps();
    createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    expect(deps.fetchMock).toHaveBeenCalledTimes(3);
    const calls = deps.fetchMock.mock.calls.map((args) => String(args[0]));
    expect(calls.some((url) => url.endsWith('/audio/rocket_engine.mp3'))).toBe(true);
    expect(calls.some((url) => url.endsWith('/audio/rocket_boost.mp3'))).toBe(true);
    expect(calls.some((url) => url.endsWith('/audio/theme.mp3'))).toBe(true);
  });

  it('does not create any gain nodes or sources before a gesture', () => {
    const deps = setupDeps();
    const audio = createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    audio.setSceneAlive(true);
    audio.setBoost(true, 0.5);
    audio.setMuted(true);
    audio.setVolume('master', 0.5);
    expect(deps.handle.gains.length).toBe(0);
    expect(deps.handle.sources.length).toBe(0);
  });

  it('leaves the AudioContext in suspended state before a gesture', () => {
    const deps = setupDeps();
    createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    expect(deps.handle.ctx.state).toBe('suspended');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/features/audio/services/createSpaceshipAudio.test.ts`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement the pre-gesture scaffolding**

Create `src/features/audio/services/createSpaceshipAudio.ts`. The service depends only on the structural `AudioContextLike` shape from `./fakeAudioContext`; both the native Web Audio API and the fake satisfy it structurally, so no casts are needed.

```typescript
import { assetUrl } from '@/lib/assetUrl';
import type { AudioChannel, SpaceshipAudio } from '../types/audio-orchestrator';
import { DEFAULT_AUDIO_SETTINGS, type AudioSettings } from '../types/audio-settings';
import type { AudioBufferLike, AudioContextLike } from './fakeAudioContext';

export type FetchLike = (url: string) => Promise<{
  readonly ok: boolean;
  readonly arrayBuffer: () => Promise<ArrayBuffer>;
}>;

type SourceKey = 'engine' | 'boost' | 'music';

const SOURCE_KEYS: ReadonlyArray<SourceKey> = ['engine', 'boost', 'music'];

const ASSET_PATHS: Readonly<Record<SourceKey, string>> = {
  engine: '/audio/rocket_engine.mp3',
  boost: '/audio/rocket_boost.mp3',
  music: '/audio/theme.mp3',
};

type PendingState = {
  sceneAlive: boolean;
  boostFactor: number;
  settings: AudioSettings;
};

type CreateSpaceshipAudioDeps = {
  readonly fetch?: FetchLike;
  readonly createContext?: () => AudioContextLike;
};

const NOOP_AUDIO: SpaceshipAudio = {
  setSceneAlive: (): void => {},
  setBoost: (): void => {},
  setMuted: (): void => {},
  setVolume: (): void => {},
  dispose: (): void => {},
};

const createNativeContext = (): AudioContextLike | null => {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext;
  if (Ctor === undefined) return null;
  return new Ctor();
};

const defaultFetch: FetchLike = (url) => globalThis.fetch(url);

export const createSpaceshipAudio = (deps: CreateSpaceshipAudioDeps = {}): SpaceshipAudio => {
  const fetchImpl = deps.fetch ?? defaultFetch;
  const ctx = deps.createContext?.() ?? createNativeContext();
  if (ctx === null) return NOOP_AUDIO;

  const pending: PendingState = {
    sceneAlive: false,
    boostFactor: 0,
    settings: DEFAULT_AUDIO_SETTINGS,
  };

  for (const key of SOURCE_KEYS) {
    const path = ASSET_PATHS[key];
    void fetchImpl(assetUrl(path))
      .then(async (response): Promise<AudioBufferLike | null> => {
        if (!response.ok) return null;
        const data = await response.arrayBuffer();
        return ctx.decodeAudioData(data);
      })
      .catch((): AudioBufferLike | null => null);
  }

  return {
    setSceneAlive: (alive: boolean): void => {
      pending.sceneAlive = alive;
    },
    setBoost: (_active: boolean, factor: number): void => {
      pending.boostFactor = factor;
    },
    setMuted: (muted: boolean): void => {
      pending.settings = { ...pending.settings, muted };
    },
    setVolume: (channel: AudioChannel, value: number): void => {
      pending.settings = { ...pending.settings, [channel]: value };
    },
    dispose: (): void => {},
  };
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/features/audio/services/createSpaceshipAudio.test.ts`
Expected: PASS, all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/features/audio/services/createSpaceshipAudio.ts src/features/audio/services/createSpaceshipAudio.test.ts
git commit -m "audio: service skeleton with pre-gesture pending capture"
```

---

## Task 11: createSpaceshipAudio — gesture unlock + graph build + sources start

A keydown or pointerdown anywhere on `window` triggers `ctx.resume()`, then the static node graph is built and the engine + boost sources are started (music starts when its buffer arrives — handled in Task 16). Pending state is applied immediately.

**Files:**
- Modify: `src/features/audio/services/createSpaceshipAudio.ts`
- Modify: `src/features/audio/services/createSpaceshipAudio.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/features/audio/services/createSpaceshipAudio.test.ts` (inside the same file, at the bottom before the closing brace if any — append as a new `describe` block):

```typescript
const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe('createSpaceshipAudio — gesture unlock', () => {
  it('keydown anywhere on window triggers ctx.resume', async () => {
    const deps = setupDeps();
    createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    expect(deps.handle.ctx.state).toBe('running');
  });

  it('pointerdown anywhere on window triggers ctx.resume', async () => {
    const deps = setupDeps();
    createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    window.dispatchEvent(new PointerEvent('pointerdown'));
    await flushMicrotasks();
    expect(deps.handle.ctx.state).toBe('running');
  });

  it('after gesture, builds the gain graph (muteGain, masterGain, 3 channel gains)', async () => {
    const deps = setupDeps();
    createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    expect(deps.handle.gains.length).toBe(5);
  });

  it('after gesture, starts the engine and boost sources (music starts when its buffer arrives)', async () => {
    const deps = setupDeps();
    createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    const startedCount = deps.handle.sources.filter((src) => src.started).length;
    expect(startedCount).toBeGreaterThanOrEqual(2);
  });

  it('subsequent keydown events do not re-trigger resume', async () => {
    const deps = setupDeps();
    createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    const resumeSpy = vi.spyOn(deps.handle.ctx, 'resume');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c' }));
    await flushMicrotasks();
    expect(resumeSpy).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/features/audio/services/createSpaceshipAudio.test.ts`
Expected: FAIL on the new `describe` block.

- [ ] **Step 3: Implement gesture unlock and graph build**

Replace the entire contents of `src/features/audio/services/createSpaceshipAudio.ts` with:

```typescript
import { assetUrl } from '@/lib/assetUrl';
import type { AudioChannel, SpaceshipAudio } from '../types/audio-orchestrator';
import { DEFAULT_AUDIO_SETTINGS, type AudioSettings } from '../types/audio-settings';
import type {
  AudioBufferLike,
  AudioBufferSourceNodeLike,
  AudioContextLike,
  GainNodeLike,
} from './fakeAudioContext';

export type FetchLike = (url: string) => Promise<{
  readonly ok: boolean;
  readonly arrayBuffer: () => Promise<ArrayBuffer>;
}>;

type SourceKey = 'engine' | 'boost' | 'music';

const SOURCE_KEYS: ReadonlyArray<SourceKey> = ['engine', 'boost', 'music'];

const ASSET_PATHS: Readonly<Record<SourceKey, string>> = {
  engine: '/audio/rocket_engine.mp3',
  boost: '/audio/rocket_boost.mp3',
  music: '/audio/theme.mp3',
};

type State =
  | { readonly kind: 'pre_gesture' }
  | { readonly kind: 'ready'; readonly graph: ReadyGraph }
  | { readonly kind: 'disposed' };

type ReadyGraph = {
  readonly ctx: AudioContextLike;
  readonly muteGain: GainNodeLike;
  readonly masterGain: GainNodeLike;
  readonly channels: Readonly<Record<SourceKey, GainNodeLike>>;
  readonly sources: {
    engine: AudioBufferSourceNodeLike | null;
    boost: AudioBufferSourceNodeLike | null;
    music: AudioBufferSourceNodeLike | null;
  };
};

type Pending = {
  sceneAlive: boolean;
  boostFactor: number;
  settings: AudioSettings;
};

type CreateSpaceshipAudioDeps = {
  readonly fetch?: FetchLike;
  readonly createContext?: () => AudioContextLike;
};

const NOOP_AUDIO: SpaceshipAudio = {
  setSceneAlive: (): void => {},
  setBoost: (): void => {},
  setMuted: (): void => {},
  setVolume: (): void => {},
  dispose: (): void => {},
};

const createNativeContext = (): AudioContextLike | null => {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext;
  if (Ctor === undefined) return null;
  return new Ctor();
};

const defaultFetch: FetchLike = (url) => globalThis.fetch(url);

const startSource = (
  ctx: AudioContextLike,
  buffer: AudioBufferLike,
  channelGain: GainNodeLike,
): AudioBufferSourceNodeLike => {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.connect(channelGain);
  src.start(0);
  return src;
};

export const createSpaceshipAudio = (deps: CreateSpaceshipAudioDeps = {}): SpaceshipAudio => {
  const fetchImpl = deps.fetch ?? defaultFetch;
  const ctx = deps.createContext?.() ?? createNativeContext();
  if (ctx === null) return NOOP_AUDIO;

  let state: State = { kind: 'pre_gesture' };
  const pending: Pending = {
    sceneAlive: false,
    boostFactor: 0,
    settings: DEFAULT_AUDIO_SETTINGS,
  };
  const buffers: { engine: AudioBufferLike | null; boost: AudioBufferLike | null; music: AudioBufferLike | null } = {
    engine: null,
    boost: null,
    music: null,
  };

  for (const key of SOURCE_KEYS) {
    const path = ASSET_PATHS[key];
    void fetchImpl(assetUrl(path))
      .then(async (response): Promise<AudioBufferLike | null> => {
        if (!response.ok) return null;
        const data = await response.arrayBuffer();
        return ctx.decodeAudioData(data);
      })
      .catch((): AudioBufferLike | null => null)
      .then((buffer): void => {
        if (buffer === null) return;
        buffers[key] = buffer;
        const live: State = state;
        if (live.kind !== 'ready') return;
        if (live.graph.sources[key] !== null) return;
        const src = startSource(ctx, buffer, live.graph.channels[key]);
        live.graph.sources[key] = src;
      });
  }

  const buildGraph = (): ReadyGraph => {
    const muteGain = ctx.createGain();
    const masterGain = ctx.createGain();
    const musicChannel = ctx.createGain();
    const engineChannel = ctx.createGain();
    const boostChannel = ctx.createGain();
    masterGain.connect(muteGain);
    muteGain.connect(ctx.destination);
    musicChannel.connect(masterGain);
    engineChannel.connect(masterGain);
    boostChannel.connect(masterGain);
    return {
      ctx,
      muteGain,
      masterGain,
      channels: { engine: engineChannel, boost: boostChannel, music: musicChannel },
      sources: { engine: null, boost: null, music: null },
    };
  };

  const unlock = async (): Promise<void> => {
    if (state.kind !== 'pre_gesture') return;
    window.removeEventListener('keydown', onGesture);
    window.removeEventListener('pointerdown', onGesture);
    await ctx.resume();
    // After await, state may have been mutated (e.g. dispose()).
    // Annotate as the base union to drop the narrow from the early-return above.
    const after: State = state;
    if (after.kind !== 'pre_gesture') return;
    const graph = buildGraph();
    state = { kind: 'ready', graph };
    for (const key of SOURCE_KEYS) {
      const buffer = buffers[key];
      if (buffer === null) continue;
      const src = startSource(ctx, buffer, graph.channels[key]);
      graph.sources[key] = src;
    }
  };

  const onGesture = (): void => {
    void unlock();
  };

  window.addEventListener('keydown', onGesture);
  window.addEventListener('pointerdown', onGesture);

  return {
    setSceneAlive: (alive: boolean): void => {
      if (state.kind !== 'ready') {
        pending.sceneAlive = alive;
        return;
      }
      pending.sceneAlive = alive;
    },
    setBoost: (_active: boolean, factor: number): void => {
      pending.boostFactor = factor;
    },
    setMuted: (muted: boolean): void => {
      pending.settings = { ...pending.settings, muted };
    },
    setVolume: (channel: AudioChannel, value: number): void => {
      pending.settings = { ...pending.settings, [channel]: value };
    },
    dispose: (): void => {
      window.removeEventListener('keydown', onGesture);
      window.removeEventListener('pointerdown', onGesture);
      state = { kind: 'disposed' };
    },
  };
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/features/audio/services/createSpaceshipAudio.test.ts`
Expected: PASS, all 8 tests green (3 from Task 10 + 5 from Task 11).

- [ ] **Step 5: Commit**

```bash
git add src/features/audio/services/createSpaceshipAudio.ts src/features/audio/services/createSpaceshipAudio.test.ts
git commit -m "audio: gesture unlock + graph build + source start"
```

---

## Task 12: createSpaceshipAudio — setSceneAlive applies to channel gains

After unlock, calling `setSceneAlive(true)` writes the engine and music channel gains to `settings.engine` / `settings.music`; calling `setSceneAlive(false)` writes them to 0. Pending state captured before unlock is applied at unlock time.

**Files:**
- Modify: `src/features/audio/services/createSpaceshipAudio.ts`
- Modify: `src/features/audio/services/createSpaceshipAudio.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/features/audio/services/createSpaceshipAudio.test.ts`:

```typescript
const findChannelGains = (
  handle: FakeContextHandle,
): { music: number; engine: number; boost: number; master: number; mute: number } => {
  // Graph build order in the service: muteGain, masterGain, music, engine, boost.
  const [mute, master, music, engine, boost] = handle.gains;
  return {
    mute: mute?.gain.value ?? -1,
    master: master?.gain.value ?? -1,
    music: music?.gain.value ?? -1,
    engine: engine?.gain.value ?? -1,
    boost: boost?.gain.value ?? -1,
  };
};

describe('createSpaceshipAudio — setSceneAlive', () => {
  it('after unlock with sceneAlive=true, engine and music channel gains equal their settings values', async () => {
    const deps = setupDeps();
    const audio = createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    audio.setSceneAlive(true);
    audio.setVolume('engine', 0.4);
    audio.setVolume('music', 0.5);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    const gains = findChannelGains(deps.handle);
    expect(gains.engine).toBeCloseTo(0.4, 5);
    expect(gains.music).toBeCloseTo(0.5, 5);
  });

  it('after unlock with sceneAlive=false, engine and music channel gains are 0', async () => {
    const deps = setupDeps();
    const audio = createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    audio.setSceneAlive(false);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    const gains = findChannelGains(deps.handle);
    expect(gains.engine).toBeCloseTo(0, 5);
    expect(gains.music).toBeCloseTo(0, 5);
  });

  it('setSceneAlive(false) after ready ramps engine and music to 0', async () => {
    const deps = setupDeps();
    const audio = createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    audio.setSceneAlive(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    audio.setSceneAlive(false);
    const gains = findChannelGains(deps.handle);
    expect(gains.engine).toBeCloseTo(0, 5);
    expect(gains.music).toBeCloseTo(0, 5);
  });

  it('setSceneAlive(true) after a previous false re-raises engine and music to settings values', async () => {
    const deps = setupDeps();
    const audio = createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    audio.setVolume('engine', 0.4);
    audio.setVolume('music', 0.5);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    audio.setSceneAlive(false);
    audio.setSceneAlive(true);
    const gains = findChannelGains(deps.handle);
    expect(gains.engine).toBeCloseTo(0.4, 5);
    expect(gains.music).toBeCloseTo(0.5, 5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/features/audio/services/createSpaceshipAudio.test.ts`
Expected: new tests FAIL (channel gains read the default `1` instead of the expected values).

- [ ] **Step 3: Implement gain application on setSceneAlive + unlock**

Edit `src/features/audio/services/createSpaceshipAudio.ts`. Add these constants near the top:

```typescript
const CHANNEL_RAMP_SECONDS = 0.3;
const MUTE_RAMP_SECONDS = 0.15;
```

Add a helper function above `createSpaceshipAudio`:

```typescript
const applyChannelGains = (graph: ReadyGraph, pending: Pending): void => {
  const now = graph.ctx.currentTime;
  const musicTarget = pending.sceneAlive ? pending.settings.music : 0;
  const engineTarget = pending.sceneAlive ? pending.settings.engine : 0;
  const boostTarget = pending.settings.boost * pending.boostFactor;
  graph.channels.music.gain.linearRampToValueAtTime(musicTarget, now + CHANNEL_RAMP_SECONDS);
  graph.channels.engine.gain.linearRampToValueAtTime(engineTarget, now + CHANNEL_RAMP_SECONDS);
  graph.channels.boost.gain.setValueAtTime(boostTarget, now);
};

const applyMasterAndMute = (graph: ReadyGraph, pending: Pending): void => {
  const now = graph.ctx.currentTime;
  graph.masterGain.gain.setValueAtTime(pending.settings.master, now);
  const muteTarget = pending.settings.muted ? 0 : 1;
  graph.muteGain.gain.linearRampToValueAtTime(muteTarget, now + MUTE_RAMP_SECONDS);
};
```

Update `unlock` to apply pending state after graph build:

```typescript
const unlock = async (): Promise<void> => {
  if (state.kind !== 'pre_gesture') return;
  window.removeEventListener('keydown', onGesture);
  window.removeEventListener('pointerdown', onGesture);
  await ctx.resume();
  if ((state as State).kind === 'disposed') return;
  const graph = buildGraph();
  state = { kind: 'ready', graph };
  applyMasterAndMute(graph, pending);
  applyChannelGains(graph, pending);
  for (const key of Object.keys(ASSET_PATHS) as ReadonlyArray<SourceKey>) {
    const buffer = buffers[key];
    if (buffer === null) continue;
    const src = startSource(ctx, buffer, graph.channels[key]);
    graph.sources[key] = src;
  }
};
```

Update `setSceneAlive` to push live after ready:

```typescript
setSceneAlive: (alive: boolean): void => {
  pending.sceneAlive = alive;
  if (state.kind === 'ready') applyChannelGains(state.graph, pending);
},
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/features/audio/services/createSpaceshipAudio.test.ts`
Expected: PASS, all 12 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/features/audio/services/createSpaceshipAudio.ts src/features/audio/services/createSpaceshipAudio.test.ts
git commit -m "audio: setSceneAlive applies channel gains"
```

---

## Task 13: createSpaceshipAudio — setBoost applies boost gain

After ready, `setBoost(active, factor)` writes `boostChannel.gain = settings.boost * factor`.

**Files:**
- Modify: `src/features/audio/services/createSpaceshipAudio.ts`
- Modify: `src/features/audio/services/createSpaceshipAudio.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/features/audio/services/createSpaceshipAudio.test.ts`:

```typescript
describe('createSpaceshipAudio — setBoost', () => {
  it('setBoost(true, 0.5) with settings.boost=0.7 sets boost gain to 0.35', async () => {
    const deps = setupDeps();
    const audio = createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    audio.setVolume('boost', 0.7);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    audio.setBoost(true, 0.5);
    expect(findChannelGains(deps.handle).boost).toBeCloseTo(0.35, 5);
  });

  it('setBoost(false, 0) sets boost gain to 0', async () => {
    const deps = setupDeps();
    const audio = createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    audio.setBoost(true, 1);
    audio.setBoost(false, 0);
    expect(findChannelGains(deps.handle).boost).toBeCloseTo(0, 5);
  });

  it('setBoost called before gesture is applied at unlock', async () => {
    const deps = setupDeps();
    const audio = createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    audio.setVolume('boost', 0.7);
    audio.setBoost(true, 0.8);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    expect(findChannelGains(deps.handle).boost).toBeCloseTo(0.7 * 0.8, 5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/features/audio/services/createSpaceshipAudio.test.ts`
Expected: new tests FAIL.

- [ ] **Step 3: Implement setBoost live application**

Edit `setBoost` in `src/features/audio/services/createSpaceshipAudio.ts`:

```typescript
setBoost: (_active: boolean, factor: number): void => {
  pending.boostFactor = factor;
  if (state.kind !== 'ready') return;
  const now = state.graph.ctx.currentTime;
  state.graph.channels.boost.gain.setValueAtTime(pending.settings.boost * factor, now);
},
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/features/audio/services/createSpaceshipAudio.test.ts`
Expected: PASS, all 15 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/features/audio/services/createSpaceshipAudio.ts src/features/audio/services/createSpaceshipAudio.test.ts
git commit -m "audio: setBoost applies boost gain live"
```

---

## Task 14: createSpaceshipAudio — setMuted ramps muteGain

After ready, `setMuted(true)` ramps `muteGain` to 0; `setMuted(false)` ramps to 1. Per-channel and master gains are untouched.

**Files:**
- Modify: `src/features/audio/services/createSpaceshipAudio.ts`
- Modify: `src/features/audio/services/createSpaceshipAudio.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/features/audio/services/createSpaceshipAudio.test.ts`:

```typescript
describe('createSpaceshipAudio — setMuted', () => {
  it('setMuted(true) after ready ramps muteGain to 0', async () => {
    const deps = setupDeps();
    const audio = createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    audio.setMuted(true);
    expect(findChannelGains(deps.handle).mute).toBeCloseTo(0, 5);
  });

  it('setMuted(false) after ready ramps muteGain to 1', async () => {
    const deps = setupDeps();
    const audio = createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    audio.setMuted(true);
    audio.setMuted(false);
    expect(findChannelGains(deps.handle).mute).toBeCloseTo(1, 5);
  });

  it('setMuted does not change master, engine, music, or boost gains', async () => {
    const deps = setupDeps();
    const audio = createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    audio.setSceneAlive(true);
    audio.setVolume('master', 0.5);
    audio.setVolume('music', 0.4);
    audio.setVolume('engine', 0.3);
    audio.setVolume('boost', 0.6);
    audio.setBoost(true, 1);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    audio.setMuted(true);
    const gains = findChannelGains(deps.handle);
    expect(gains.master).toBeCloseTo(0.5, 5);
    expect(gains.music).toBeCloseTo(0.4, 5);
    expect(gains.engine).toBeCloseTo(0.3, 5);
    expect(gains.boost).toBeCloseTo(0.6, 5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/features/audio/services/createSpaceshipAudio.test.ts`
Expected: new tests FAIL.

- [ ] **Step 3: Implement setMuted live application**

Edit `setMuted` in `src/features/audio/services/createSpaceshipAudio.ts`:

```typescript
setMuted: (muted: boolean): void => {
  pending.settings = { ...pending.settings, muted };
  if (state.kind !== 'ready') return;
  const now = state.graph.ctx.currentTime;
  const target = muted ? 0 : 1;
  state.graph.muteGain.gain.linearRampToValueAtTime(target, now + MUTE_RAMP_SECONDS);
},
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/features/audio/services/createSpaceshipAudio.test.ts`
Expected: PASS, all 18 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/features/audio/services/createSpaceshipAudio.ts src/features/audio/services/createSpaceshipAudio.test.ts
git commit -m "audio: setMuted ramps mute gain"
```

---

## Task 15: createSpaceshipAudio — setVolume applies per-channel

After ready, `setVolume(channel, value)`:
- `'master'` writes `masterGain.gain = value`.
- `'music'` writes `musicChannel.gain = sceneAlive ? value : 0`.
- `'engine'` writes `engineChannel.gain = sceneAlive ? value : 0`.
- `'boost'` writes `boostChannel.gain = value * boostFactor`.

**Files:**
- Modify: `src/features/audio/services/createSpaceshipAudio.ts`
- Modify: `src/features/audio/services/createSpaceshipAudio.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/features/audio/services/createSpaceshipAudio.test.ts`:

```typescript
describe('createSpaceshipAudio — setVolume', () => {
  it("setVolume('master', 0.5) sets masterGain to 0.5", async () => {
    const deps = setupDeps();
    const audio = createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    audio.setVolume('master', 0.5);
    expect(findChannelGains(deps.handle).master).toBeCloseTo(0.5, 5);
  });

  it("setVolume('music', 0.3) while sceneAlive=true sets musicChannel to 0.3", async () => {
    const deps = setupDeps();
    const audio = createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    audio.setSceneAlive(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    audio.setVolume('music', 0.3);
    expect(findChannelGains(deps.handle).music).toBeCloseTo(0.3, 5);
  });

  it("setVolume('music', 0.3) while sceneAlive=false leaves musicChannel at 0", async () => {
    const deps = setupDeps();
    const audio = createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    audio.setSceneAlive(false);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    audio.setVolume('music', 0.3);
    expect(findChannelGains(deps.handle).music).toBeCloseTo(0, 5);
  });

  it("setVolume('engine', 0.2) while sceneAlive=true sets engineChannel to 0.2", async () => {
    const deps = setupDeps();
    const audio = createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    audio.setSceneAlive(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    audio.setVolume('engine', 0.2);
    expect(findChannelGains(deps.handle).engine).toBeCloseTo(0.2, 5);
  });

  it("setVolume('boost', 0.4) with boostFactor=0.6 sets boostChannel to 0.24", async () => {
    const deps = setupDeps();
    const audio = createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    audio.setBoost(true, 0.6);
    audio.setVolume('boost', 0.4);
    expect(findChannelGains(deps.handle).boost).toBeCloseTo(0.24, 5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/features/audio/services/createSpaceshipAudio.test.ts`
Expected: new tests FAIL.

- [ ] **Step 3: Implement setVolume live application**

Edit `setVolume` in `src/features/audio/services/createSpaceshipAudio.ts`:

```typescript
setVolume: (channel: AudioChannel, value: number): void => {
  pending.settings = { ...pending.settings, [channel]: value };
  if (state.kind !== 'ready') return;
  const graph = state.graph;
  const now = graph.ctx.currentTime;
  switch (channel) {
    case 'master':
      graph.masterGain.gain.setValueAtTime(value, now);
      return;
    case 'music':
      graph.channels.music.gain.setValueAtTime(pending.sceneAlive ? value : 0, now);
      return;
    case 'engine':
      graph.channels.engine.gain.setValueAtTime(pending.sceneAlive ? value : 0, now);
      return;
    case 'boost':
      graph.channels.boost.gain.setValueAtTime(value * pending.boostFactor, now);
      return;
  }
},
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/features/audio/services/createSpaceshipAudio.test.ts`
Expected: PASS, all 23 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/features/audio/services/createSpaceshipAudio.ts src/features/audio/services/createSpaceshipAudio.test.ts
git commit -m "audio: setVolume applies per-channel gain"
```

---

## Task 16: createSpaceshipAudio — music starts when its buffer arrives late

If a buffer hasn't decoded by the time of the gesture, the corresponding source starts when the decode completes. (The existing in-promise check `state.kind === 'ready'` already handles this; this task adds a targeted test to lock in the behavior and verify it for the music channel specifically.)

**Files:**
- Modify: `src/features/audio/services/createSpaceshipAudio.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/features/audio/services/createSpaceshipAudio.test.ts`:

```typescript
type FetchResponse = { ok: boolean; arrayBuffer: () => Promise<ArrayBuffer> };

describe('createSpaceshipAudio — late buffer arrival', () => {
  it('starts the music source after the gesture if the music buffer decodes later', async () => {
    const handle = createFakeAudioContext();
    let resolveMusic: (response: FetchResponse) => void = (): void => {};
    const musicPromise = new Promise<FetchResponse>((resolve) => {
      resolveMusic = resolve;
    });
    const fetchStub: FetchLike = async (url) => {
      if (url.endsWith('/audio/theme.mp3')) return musicPromise;
      return { ok: true, arrayBuffer: async (): Promise<ArrayBuffer> => new ArrayBuffer(8) };
    };
    createSpaceshipAudio({ fetch: fetchStub, createContext: () => handle.ctx });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    const startedBeforeMusic = handle.sources.filter((src) => src.started).length;
    expect(startedBeforeMusic).toBe(2);
    resolveMusic({ ok: true, arrayBuffer: async (): Promise<ArrayBuffer> => new ArrayBuffer(8) });
    await flushMicrotasks();
    const startedAfterMusic = handle.sources.filter((src) => src.started).length;
    expect(startedAfterMusic).toBe(3);
  });
});
```

- [ ] **Step 2: Run the test to verify it passes (behavior should already be present)**

Run: `pnpm test src/features/audio/services/createSpaceshipAudio.test.ts`
Expected: PASS, all 24 tests green. If it fails, the late-arrival branch in the buffer-decode `.then()` is missing — verify the existing implementation matches the snippet in Task 11 ("if state.kind === 'ready' and source for key is null, start it").

- [ ] **Step 3: Commit**

```bash
git add src/features/audio/services/createSpaceshipAudio.test.ts
git commit -m "audio: lock in late music-buffer arrival behavior"
```

---

## Task 17: createSpaceshipAudio — dispose stops sources and freezes setters

`dispose()` stops all started sources, removes any remaining gesture listeners, transitions state to `disposed`, and makes subsequent setters no-op.

**Files:**
- Modify: `src/features/audio/services/createSpaceshipAudio.ts`
- Modify: `src/features/audio/services/createSpaceshipAudio.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/features/audio/services/createSpaceshipAudio.test.ts`:

```typescript
describe('createSpaceshipAudio — dispose', () => {
  it('dispose() before gesture: subsequent gesture is a no-op (state stays suspended)', async () => {
    const deps = setupDeps();
    const audio = createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    audio.dispose();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    expect(deps.handle.ctx.state).toBe('suspended');
    expect(deps.handle.gains.length).toBe(0);
    expect(deps.handle.sources.length).toBe(0);
  });

  it('dispose() after ready: stops all started sources', async () => {
    const deps = setupDeps();
    const audio = createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    audio.dispose();
    const stoppedCount = deps.handle.sources.filter((src) => src.stopped).length;
    expect(stoppedCount).toBe(deps.handle.sources.length);
  });

  it('setters after dispose do not throw and do not affect gains', async () => {
    const deps = setupDeps();
    const audio = createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    audio.dispose();
    const before = findChannelGains(deps.handle);
    audio.setSceneAlive(true);
    audio.setBoost(true, 1);
    audio.setMuted(true);
    audio.setVolume('master', 0.123);
    const after = findChannelGains(deps.handle);
    expect(after).toEqual(before);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/features/audio/services/createSpaceshipAudio.test.ts`
Expected: at least one of the dispose tests FAILS.

- [ ] **Step 3: Implement dispose**

Edit `dispose` in `src/features/audio/services/createSpaceshipAudio.ts`:

```typescript
dispose: (): void => {
  window.removeEventListener('keydown', onGesture);
  window.removeEventListener('pointerdown', onGesture);
  if (state.kind === 'ready') {
    const graph = state.graph;
    for (const key of SOURCE_KEYS) {
      const src = graph.sources[key];
      if (src !== null) src.stop();
    }
  }
  state = { kind: 'disposed' };
},
```

Also short-circuit live setters when the state is disposed. Update each setter's first branch:

```typescript
setSceneAlive: (alive: boolean): void => {
  if (state.kind === 'disposed') return;
  pending.sceneAlive = alive;
  if (state.kind === 'ready') applyChannelGains(state.graph, pending);
},
setBoost: (_active: boolean, factor: number): void => {
  if (state.kind === 'disposed') return;
  pending.boostFactor = factor;
  if (state.kind !== 'ready') return;
  const now = state.graph.ctx.currentTime;
  state.graph.channels.boost.gain.setValueAtTime(pending.settings.boost * factor, now);
},
setMuted: (muted: boolean): void => {
  if (state.kind === 'disposed') return;
  pending.settings = { ...pending.settings, muted };
  if (state.kind !== 'ready') return;
  const now = state.graph.ctx.currentTime;
  const target = muted ? 0 : 1;
  state.graph.muteGain.gain.linearRampToValueAtTime(target, now + MUTE_RAMP_SECONDS);
},
setVolume: (channel: AudioChannel, value: number): void => {
  if (state.kind === 'disposed') return;
  pending.settings = { ...pending.settings, [channel]: value };
  if (state.kind !== 'ready') return;
  const graph = state.graph;
  const now = graph.ctx.currentTime;
  switch (channel) {
    case 'master':
      graph.masterGain.gain.setValueAtTime(value, now);
      return;
    case 'music':
      graph.channels.music.gain.setValueAtTime(pending.sceneAlive ? value : 0, now);
      return;
    case 'engine':
      graph.channels.engine.gain.setValueAtTime(pending.sceneAlive ? value : 0, now);
      return;
    case 'boost':
      graph.channels.boost.gain.setValueAtTime(value * pending.boostFactor, now);
      return;
  }
},
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/features/audio/services/createSpaceshipAudio.test.ts`
Expected: PASS, all 27 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/features/audio/services/createSpaceshipAudio.ts src/features/audio/services/createSpaceshipAudio.test.ts
git commit -m "audio: dispose stops sources and freezes setters"
```

---

## Task 18: createSpaceshipAudio — asset failure handling

If `fetch` returns `!ok` or rejects, or if `decodeAudioData` rejects, the affected channel stays silent for the session and a single `console.warn` is emitted per failure. Other channels continue working.

**Files:**
- Modify: `src/features/audio/services/createSpaceshipAudio.ts`
- Modify: `src/features/audio/services/createSpaceshipAudio.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/features/audio/services/createSpaceshipAudio.test.ts`:

```typescript
describe('createSpaceshipAudio — asset failure', () => {
  it('per-file fetch failure: that channel stays silent; others start', async () => {
    const handle = createFakeAudioContext();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation((): void => {});
    const fetchStub: FetchLike = async (url) => {
      if (url.endsWith('/audio/rocket_boost.mp3')) {
        return { ok: false, arrayBuffer: async (): Promise<ArrayBuffer> => new ArrayBuffer(0) };
      }
      return { ok: true, arrayBuffer: async (): Promise<ArrayBuffer> => new ArrayBuffer(8) };
    };
    createSpaceshipAudio({ fetch: fetchStub, createContext: () => handle.ctx });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    const startedCount = handle.sources.filter((src) => src.started).length;
    expect(startedCount).toBe(2);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it('per-file decode rejection: that channel stays silent; others start', async () => {
    const handle = createFakeAudioContext();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation((): void => {});
    const originalDecode = handle.ctx.decodeAudioData.bind(handle.ctx);
    let decodeCallCount = 0;
    Object.defineProperty(handle.ctx, 'decodeAudioData', {
      value: async (data: ArrayBuffer): ReturnType<typeof handle.ctx.decodeAudioData> => {
        decodeCallCount += 1;
        if (decodeCallCount === 1) throw new Error('decode failed');
        return originalDecode(data);
      },
    });
    const fetchStub: FetchLike = async () => ({
      ok: true,
      arrayBuffer: async (): Promise<ArrayBuffer> => new ArrayBuffer(8),
    });
    createSpaceshipAudio({ fetch: fetchStub, createContext: () => handle.ctx });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    const startedCount = handle.sources.filter((src) => src.started).length;
    expect(startedCount).toBe(2);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/features/audio/services/createSpaceshipAudio.test.ts`
Expected: new tests FAIL (no `console.warn` is emitted yet).

- [ ] **Step 3: Implement asset-failure warning**

Edit the fetch-then chain in `src/features/audio/services/createSpaceshipAudio.ts` to emit a single warn per failure:

```typescript
for (const key of SOURCE_KEYS) {
  const path = ASSET_PATHS[key];
  void fetchImpl(assetUrl(path))
    .then(async (response): Promise<AudioBufferLike | null> => {
      if (!response.ok) {
        console.warn(`[audio] failed to fetch ${path}: HTTP ${response.status}`);
        return null;
      }
      const data = await response.arrayBuffer();
      try {
        return await ctx.decodeAudioData(data);
      } catch (error) {
        console.warn(`[audio] failed to decode ${path}:`, error);
        return null;
      }
    })
    .catch((error): AudioBufferLike | null => {
      console.warn(`[audio] failed to load ${path}:`, error);
      return null;
    })
    .then((buffer): void => {
      if (buffer === null) return;
      buffers[key] = buffer;
      const live: State = state;
      if (live.kind !== 'ready') return;
      if (live.graph.sources[key] !== null) return;
      const src = startSource(ctx, buffer, live.graph.channels[key]);
      live.graph.sources[key] = src;
    });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/features/audio/services/createSpaceshipAudio.test.ts`
Expected: PASS, all 29 tests green.

- [ ] **Step 5: Verify the full check passes**

Run: `pnpm check`
Expected: typecheck, lint, lint:suppressors, and tests all green. If oxlint flags `console.warn` use, scope it via `eslint.config.js` / `.oxlintrc.json` glob for `src/features/audio/services/**/*.ts` to allow `no-console` — DO NOT add an inline disable comment.

- [ ] **Step 6: Commit**

```bash
git add src/features/audio/services/createSpaceshipAudio.ts src/features/audio/services/createSpaceshipAudio.test.ts
git commit -m "audio: per-file asset failure warns + keeps other channels working"
```

If you needed to update the lint config to allow `console.warn` in `services/audio/`, add that file to the commit as well.

---

## Task 19: Wire useScene — instantiate audio + push settings + scene-alive

`useScene` instantiates the audio service once, calls `useAudioSettings()` to observe settings, and pushes scene-alive + all settings into the service via two `useEffect`s. Returns the `audio` handle alongside the existing fields.

**Files:**
- Modify: `src/features/scene/widget/scene/useScene.ts`
- Test: `src/features/scene/widget/scene/useScene.smoke.test.tsx`

- [ ] **Step 1: Read the current useScene smoke test**

Run: `cat src/features/scene/widget/scene/useScene.smoke.test.tsx`

Read the file to understand the existing setup. The next step extends it.

- [ ] **Step 2: Write the failing audio assertion**

Add the following block to `src/features/scene/widget/scene/useScene.smoke.test.tsx` (inside the existing `describe`, or in a new `describe` block in the same file). Place it after the existing assertions:

```typescript
describe('useScene — audio wiring', () => {
  it('exposes an audio handle with the SpaceshipAudio shape', () => {
    const { result } = renderHook(() => useScene());
    expect(typeof result.current.audio.setSceneAlive).toBe('function');
    expect(typeof result.current.audio.setBoost).toBe('function');
    expect(typeof result.current.audio.setMuted).toBe('function');
    expect(typeof result.current.audio.setVolume).toBe('function');
    expect(typeof result.current.audio.dispose).toBe('function');
  });
});
```

If `renderHook` is not yet imported in the file, add it to the top:

```typescript
import { renderHook } from '@testing-library/react';
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test src/features/scene/widget/scene/useScene.smoke.test.tsx`
Expected: FAIL — `audio` field doesn't exist on the result.

- [ ] **Step 4: Wire useScene**

Edit `src/features/scene/widget/scene/useScene.ts`. Update the imports at the top:

```typescript
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useActor } from '@xstate/react';
import { getSceneState, getVisited, sceneMachine } from '../../../../core/scene/sceneMachine';
import { CAREER_ROUTE, getCompanyEntries } from './companies';
import { FILLER_PLANETS } from './fillerPlanets';
import { projectReveal, type RevealProjection } from './projectReveal';
import { projectRoute } from './projectRoute';
import { useKeyboardIntents } from './useKeyboardIntents';
import { INITIAL_KINEMATICS, type Kinematics } from '../../types/kinematics';
import type { CompanyEntry } from '../../types/company';
import type { FillerPlanetEntry } from '../../types/filler-planet';
import type { IntentStream } from '../../types/intent';
import type { RouteProjection } from '../../types/route-projection';
import type { SceneEvent } from '../../types/scene-event';
import type { SceneState } from '../../types/scene-state';
import { createSpaceshipAudio } from '../../../audio/services/createSpaceshipAudio';
import { useAudioSettings } from '../../../audio/widget/controls/useAudioSettings';
import type { SpaceshipAudio } from '../../../audio/types/audio-orchestrator';
```

Update the `UseSceneResult` type to add the `audio` field:

```typescript
type UseSceneResult = {
  readonly state: SceneState;
  readonly entries: ReadonlyArray<CompanyEntry>;
  readonly fillerPlanets: ReadonlyArray<FillerPlanetEntry>;
  readonly intents: IntentStream;
  readonly onEvent: (event: SceneEvent) => void;
  readonly revealProjection: RevealProjection;
  readonly routeProjection: RouteProjection;
  readonly kinematicsRef: RefObject<Kinematics>;
  readonly audio: SpaceshipAudio;
};
```

Inside `useScene`, after the existing `useMemo` for `entries` and before the existing `useEffect`, add:

```typescript
const audio = useMemo<SpaceshipAudio>(() => createSpaceshipAudio(), []);
const { settings: audioSettings } = useAudioSettings();
const sceneAlive = state.kind === 'playing' || state.kind === 'revealing';

useEffect(() => {
  audio.setSceneAlive(sceneAlive);
  if (!sceneAlive) audio.setBoost(false, 0);
}, [audio, sceneAlive]);

useEffect(() => {
  audio.setMuted(audioSettings.muted);
  audio.setVolume('master', audioSettings.master);
  audio.setVolume('music', audioSettings.music);
  audio.setVolume('engine', audioSettings.engine);
  audio.setVolume('boost', audioSettings.boost);
}, [audio, audioSettings]);

useEffect(() => () => audio.dispose(), [audio]);
```

Add `audio` to the return:

```typescript
return {
  state,
  entries,
  fillerPlanets: FILLER_PLANETS,
  intents,
  onEvent,
  revealProjection,
  routeProjection,
  kinematicsRef,
  audio,
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test src/features/scene/widget/scene/useScene.smoke.test.tsx`
Expected: PASS.

- [ ] **Step 6: Verify the full check passes**

Run: `pnpm check`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add src/features/scene/widget/scene/useScene.ts src/features/scene/widget/scene/useScene.smoke.test.tsx
git commit -m "audio: wire useScene to instantiate and feed the audio service"
```

---

## Task 20: Wire Player.tsx — push boost from useFrame

`Player.tsx` accepts a new `audio` prop and calls `audio.setBoost(...)` once per frame, after the existing `writeTrailOpacities` call. `Scene.tsx` accepts the prop and forwards it.

**Files:**
- Modify: `src/features/scene/components/Scene/Scene.tsx`
- Modify: `src/features/scene/components/Scene/Player.tsx`

- [ ] **Step 1: Add the audio prop to Scene**

Edit `src/features/scene/components/Scene/Scene.tsx`. Add the import:

```typescript
import type { SpaceshipAudio } from '../../../audio/types/audio-orchestrator';
```

Add to `SceneProps`:

```typescript
readonly audio: SpaceshipAudio;
```

In the `Scene` function body, pass `audio={props.audio}` to `<Player>`:

```typescript
<Player
  ship={props.ship}
  sceneState={props.state}
  intents={props.intents}
  kinematicsRef={props.kinematicsRef}
  meshRef={meshRef}
  sphereCollidersRef={sphereCollidersRef}
  planetActivationsRef={planetActivationsRef}
  boostSignalRef={boostSignalRef}
  audio={props.audio}
/>
```

- [ ] **Step 2: Add the audio prop to Player and call setBoost in useFrame**

Edit `src/features/scene/components/Scene/Player.tsx`. Add the import:

```typescript
import type { SpaceshipAudio } from '../../../audio/types/audio-orchestrator';
```

Extend `PlayerProps`:

```typescript
type PlayerProps = {
  readonly ship: ShipEntry;
  readonly sceneState: SceneState;
  readonly intents: IntentStream;
  readonly kinematicsRef: RefObject<Kinematics>;
  readonly meshRef: RefObject<Object3D | null>;
  readonly sphereCollidersRef: RefObject<SphereColliders>;
  readonly planetActivationsRef: RefObject<PlanetActivations>;
  readonly boostSignalRef: RefObject<BoostSignal>;
  readonly audio: SpaceshipAudio;
};
```

Inside `usePlayerFrame`, after the line `writeTrailOpacities(trailMats, boost.factor, isThrusting(props.intents.current));`, add:

```typescript
props.audio.setBoost(boost.kind === 'active', boost.factor);
```

- [ ] **Step 3: Run typecheck and tests**

Run: `pnpm typecheck && pnpm test src/features/scene`
Expected: typecheck passes; all scene tests pass. If any existing scene test instantiates `Scene` or `Player` directly without the `audio` prop, update it to pass a no-op audio object:

```typescript
const NOOP_AUDIO = {
  setSceneAlive: (): void => {},
  setBoost: (): void => {},
  setMuted: (): void => {},
  setVolume: (): void => {},
  dispose: (): void => {},
};
```

- [ ] **Step 4: Verify the full check passes**

Run: `pnpm check`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/features/scene/components/Scene/Scene.tsx src/features/scene/components/Scene/Player.tsx
git commit -m "audio: Player pushes setBoost per frame"
```

If any other scene tests had to be updated to pass the audio prop, include those files in the commit too.

---

## Task 21: Wire SceneWidget — mount AudioControlsWidget + pass audio handle

`SceneWidget` mounts `<AudioControlsWidget />` as a sibling of the Canvas, and threads the `audio` handle from `useScene` into `<Scene />`.

**Files:**
- Modify: `src/features/scene/widget/scene/SceneWidget.tsx`

- [ ] **Step 1: Edit SceneWidget**

Edit `src/features/scene/widget/scene/SceneWidget.tsx`. Replace the full file:

```typescript
import type { CSSProperties, JSX } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from '../../components/Scene/Scene';
import { CompanyInfoPanel } from '../../components/CompanyInfoPanel/CompanyInfoPanel';
import { CommsDockWidget } from '../../../comms/widget/dock/CommsDockWidget';
import { AudioControlsWidget } from '../../../audio/widget/controls/AudioControlsWidget';
import type { ShipEntry } from '../../../ships/types/ship';
import { useScene } from './useScene';

const CANVAS_WRAPPER_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
};

type SceneWidgetProps = {
  readonly ship: ShipEntry;
};

export const SceneWidget = (props: SceneWidgetProps): JSX.Element => {
  const {
    state,
    entries,
    fillerPlanets,
    intents,
    onEvent,
    revealProjection,
    routeProjection,
    kinematicsRef,
    audio,
  } = useScene();

  return (
    <>
      <Canvas style={CANVAS_WRAPPER_STYLE} dpr={[1, 2]}>
        <Scene
          ship={props.ship}
          state={state}
          entries={entries}
          fillerPlanets={fillerPlanets}
          intents={intents}
          onEvent={onEvent}
          kinematicsRef={kinematicsRef}
          routeProjection={routeProjection}
          audio={audio}
        />
      </Canvas>
      <CompanyInfoPanel projection={revealProjection} />
      <CommsDockWidget kinematicsRef={kinematicsRef} sceneState={state} />
      <AudioControlsWidget />
    </>
  );
};
```

- [ ] **Step 2: Verify the full check passes**

Run: `pnpm check`
Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add src/features/scene/widget/scene/SceneWidget.tsx
git commit -m "audio: SceneWidget mounts AudioControlsWidget"
```

---

## Task 22: Manual browser smoke test

Run the dev server and verify all the audio behavior end-to-end in a real browser. This catches everything jsdom can't (actual playback, real autoplay-policy unlock, slider feel, panel placement).

**Files:** none modified.

- [ ] **Step 1: Start the dev server**

Run: `pnpm dev`
Expected: Vite reports `Local: http://localhost:5173/` (or similar). Leave it running.

- [ ] **Step 2: Open the scene in a browser and ship-select**

Open `http://localhost:5173/` in Chrome or Safari. Pick a ship. The scene loads. The top-left should show two small icons: a speaker (Volume2) and a sliders icon (SlidersHorizontal).

- [ ] **Step 3: Verify no audio plays before any gesture**

Just look at the page without interacting. No audio should be audible. (Browser autoplay policy blocks playback.)

- [ ] **Step 4: Press W or any movement key — engine + theme should fade in**

Hold W. Within ~300ms the engine loop should be audible at low volume, and the theme music should start (if `theme.mp3` finished decoding). The visual ship moves forward.

- [ ] **Step 5: Press Space — boost layer fades in additively**

Hold Space along with W. The boost loop should layer in on top of the engine. Release Space — boost fades out smoothly.

- [ ] **Step 6: Click the mute icon — all audio cuts smoothly (150ms ramp)**

Click the Volume2 icon. The icon changes to VolumeX. Within 150ms all audio is gone. Click again — audio returns within 150ms. The icon flips back to Volume2.

- [ ] **Step 7: Open the settings panel and verify slider control**

Click the sliders icon. Panel slides out below it with 4 sliders (Master, Music, Engine, Boost) reading the AAA defaults (100/50/40/70). Drag the Music slider down to 0 — theme silences immediately. Drag back up — theme returns. Repeat for Engine and Boost while holding the relevant keys.

- [ ] **Step 8: Press Escape — panel closes**

With the panel open, press Escape. Panel disappears. Cog icon's `aria-expanded` flips to `false`.

- [ ] **Step 9: Reload the page — settings persist**

Adjust a slider, refresh the page (Cmd-R), re-pick the ship. Open the panel. The slider should still show the adjusted value.

- [ ] **Step 10: Click Reset to defaults — settings revert**

Open panel, click "Reset to defaults". All four sliders snap back to 100/50/40/70. Refresh and re-check — still at defaults.

- [ ] **Step 11: Trigger a pause and verify silence**

Press Escape during scene play (this pauses via the existing pause keybinding). All audio fades out over 300ms. Press Escape again — audio resumes.

- [ ] **Step 12: If anything fails, fix and re-run from the affected step**

Any issue means there's a bug. Trace it to the responsible file (likely the audio service or the wiring), write a failing test that reproduces it, fix, and re-run.

- [ ] **Step 13: Stop the dev server**

Ctrl-C in the dev server terminal.

No commit for this task — manual verification only.

---

## Wrap-up

After Task 22 passes, run a final check:

- [ ] Run: `pnpm check`
- [ ] Run: `git log --oneline | head -25`

The branch should show 21 commits (Tasks 1–21) plus the two earlier spec commits. The feature is complete and shippable.
