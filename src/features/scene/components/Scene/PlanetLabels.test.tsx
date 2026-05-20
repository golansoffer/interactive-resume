import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { asCompanyId } from '../../types/company';
import type { LabelProjection } from '../../types/projections';
import { PlanetLabels } from './PlanetLabels';

vi.mock('@react-three/drei', () => ({
  Html: ({
    children,
    position,
  }: {
    readonly children?: ReactNode;
    readonly position?: readonly [number, number, number];
  }): ReactNode => (
    <div data-testid="html-host" data-position={position ? position.join(',') : ''}>
      {children}
    </div>
  ),
}));

// Test-boundary parsers: convert weak DOM/array types into typed pairs at the
// boundary so consumers never need `!`, `as`, or `?? default` narrows.

const pairLabelsWithElements = <T extends Element>(
  labels: ReadonlyArray<LabelProjection>,
  elements: ReadonlyArray<T>,
): ReadonlyArray<readonly [LabelProjection, T]> => {
  if (labels.length !== elements.length) {
    throw new Error(
      `expected labels.length (${labels.length}) to equal elements.length (${elements.length})`,
    );
  }
  return labels.map((label, i): readonly [LabelProjection, T] => {
    const element = elements[i];
    if (element === undefined) {
      throw new Error(`expected element at index ${i}`);
    }
    return [label, element];
  });
};

const readTwoPlates = (container: HTMLElement): readonly [HTMLElement, HTMLElement] => {
  const plates = Array.from(container.querySelectorAll<HTMLElement>('[data-backdrop]'));
  if (plates.length !== 2) {
    throw new Error(`expected exactly 2 plates, got ${plates.length}`);
  }
  const [first, second] = plates;
  if (first === undefined || second === undefined) {
    throw new Error('plate destructure failure');
  }
  return [first, second];
};

type ParsedPosition =
  | { readonly kind: 'ok'; readonly value: readonly [number, number, number] }
  | { readonly kind: 'malformed'; readonly reason: string };

const readTextContent = (node: Node): string => {
  const text = node.textContent;
  if (text === null) throw new Error('expected node textContent to be a string, got null');
  return text;
};

const parsePosition = (raw: string): ParsedPosition => {
  const parts = raw.split(',').map(Number);
  if (parts.length !== 3) {
    return { kind: 'malformed', reason: `expected 3 parts, got ${parts.length}` };
  }
  const [x, y, z] = parts;
  if (x === undefined || y === undefined || z === undefined) {
    return { kind: 'malformed', reason: 'destructure failure' };
  }
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    return { kind: 'malformed', reason: 'non-finite component' };
  }
  return { kind: 'ok', value: [x, y, z] };
};

const mave = asCompanyId('mave');
const eightFig = asCompanyId('8fig');
const riverside = asCompanyId('riverside');
const streamelements = asCompanyId('streamelements');
const tgs = asCompanyId('tgs');

// Sample company names used as fixtures for the icon-only invariant assertion.
// The component never receives names — these strings exist only so the test can
// scan the rendered DOM for any text content and expect none.
const sampleCompanyNames: ReadonlyArray<string> = [
  'Mave',
  '8fig',
  'Riverside',
  'StreamElements',
  'TGS',
];

const labelWithIcon = (
  id: ReturnType<typeof asCompanyId>,
  iconSrc: string,
  placement: readonly [number, number, number],
  backdrop: 'light' | 'dark',
): LabelProjection => ({ id, placement, iconSrc, backdrop });

const fiveLabels = (): ReadonlyArray<LabelProjection> => [
  labelWithIcon(mave, '/logos/mave.svg', [10, 0, 0], 'light'),
  labelWithIcon(eightFig, '/logos/8fig.svg', [0, 5, 10], 'dark'),
  labelWithIcon(riverside, '/logos/riverside.svg', [-7, 3, 2], 'light'),
  labelWithIcon(streamelements, '/logos/streamelements.svg', [4, -1, -8], 'dark'),
  labelWithIcon(tgs, '/logos/tgs.svg', [12, 8, -3], 'light'),
];

const renderWith = (labels: ReadonlyArray<LabelProjection>) =>
  render(<PlanetLabels labels={labels} />);

afterEach(() => {
  cleanup();
});

describe('PlanetLabels — icon-only renderer', () => {
  it('renders nothing when labels is empty', () => {
    const { container } = renderWith([]);
    expect(container.querySelectorAll('img').length).toBe(0);
    expect(container.querySelectorAll('[data-testid="html-host"]').length).toBe(0);
  });

  it('renders exactly one img per label when all labels are with_icon', () => {
    const labels = fiveLabels();
    const { container } = renderWith(labels);
    expect(container.querySelectorAll('img').length).toBe(labels.length);
  });

  it('renders each img with src ending in the label iconSrc', () => {
    const labels = fiveLabels();
    const { container } = renderWith(labels);
    const imgs = Array.from(container.querySelectorAll('img'));
    const pairs = pairLabelsWithElements(labels, imgs);
    pairs.forEach(([label, img]) => {
      expect(img.getAttribute('src')?.endsWith(label.iconSrc)).toBe(true);
    });
  });

  it('renders every img with alt="" (decorative)', () => {
    const { container } = renderWith(fiveLabels());
    const imgs = Array.from(container.querySelectorAll('img'));
    expect(imgs.length).toBeGreaterThan(0);
    for (const img of imgs) {
      expect(img.getAttribute('alt')).toBe('');
    }
  });

  it('renders no element whose text content equals any companyName (icon-only invariant)', () => {
    const { container } = renderWith(fiveLabels());
    const text = readTextContent(container);
    expect(text.trim()).toBe('');
    for (const name of sampleCompanyNames) {
      expect(text.includes(name)).toBe(false);
    }
  });

  it('renders a plate element per label that is structurally distinct from the img', () => {
    const labels = fiveLabels();
    const { container } = renderWith(labels);
    const plates = Array.from(container.querySelectorAll('[data-backdrop]'));
    expect(plates.length).toBe(labels.length);
    for (const plate of plates) {
      expect(plate.tagName.toLowerCase()).not.toBe('img');
      expect(plate.querySelectorAll('img').length).toBe(1);
    }
  });

  it('renders plates with a distinguishable data-backdrop attribute for light vs dark', () => {
    const labels: ReadonlyArray<LabelProjection> = [
      labelWithIcon(mave, '/logos/mave.svg', [0, 0, 0], 'light'),
      labelWithIcon(eightFig, '/logos/8fig.svg', [0, 0, 0], 'dark'),
    ];
    const { container } = renderWith(labels);
    const [lightPlate, darkPlate] = readTwoPlates(container);
    expect(lightPlate.dataset['backdrop']).toBe('light');
    expect(darkPlate.dataset['backdrop']).toBe('dark');
  });

  it('places each label below its planet — rendered Y is less than placement Y', () => {
    const labels = fiveLabels();
    const { container } = renderWith(labels);
    const hosts = Array.from(container.querySelectorAll<HTMLElement>('[data-testid="html-host"]'));
    const pairs = pairLabelsWithElements(labels, hosts);
    pairs.forEach(([label, host]) => {
      const raw = host.dataset['position'];
      if (raw === undefined) {
        throw new Error('host missing data-position');
      }
      const parsed = parsePosition(raw);
      if (parsed.kind !== 'ok') {
        throw new Error(`expected parsed position ok, got malformed: ${parsed.reason}`);
      }
      const [, renderedY] = parsed.value;
      expect(renderedY).toBeLessThan(label.placement[1]);
    });
  });

  it('renders labels in the same order as the input labels array', () => {
    const labels = fiveLabels();
    const { container } = renderWith(labels);
    const imgs = Array.from(container.querySelectorAll('img'));
    const pairs = pairLabelsWithElements(labels, imgs);
    pairs.forEach(([label, img]) => {
      expect(img.getAttribute('src')?.endsWith(label.iconSrc)).toBe(true);
    });
  });

  it('mounts and unmounts without throwing for 0, 1, and 5 labels', () => {
    expect(() => {
      const a = renderWith([]);
      a.unmount();
    }).not.toThrow();

    expect(() => {
      const b = renderWith([labelWithIcon(mave, '/logos/mave.svg', [1, 2, 3], 'light')]);
      b.unmount();
    }).not.toThrow();

    expect(() => {
      const c = renderWith(fiveLabels());
      c.unmount();
    }).not.toThrow();
  });
});
