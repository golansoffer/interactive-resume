import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { asCompanyId } from '../../../scene/types/company';
import type { MotionPreference } from '../../../comms/types/motion-preference';
import type { Pip } from '../../types/pip';
import { ProgressPip } from './ProgressPip';

const motion = (kind: MotionPreference['kind']): MotionPreference => ({ kind });

const pip = (kind: Pip['kind']): Pip => ({
  kind,
  companyId: asCompanyId('mars'),
  assetId: 'mars_b',
});

describe('ProgressPip', () => {
  it('renders data-state="unvisited" for unvisited pip', () => {
    const { container } = render(
      <ProgressPip pip={pip('unvisited')} isBursting={false} motion={motion('normal')} />,
    );
    expect(container.querySelector('[data-state="unvisited"]')).not.toBeNull();
  });

  it('renders data-state="visited" for visited pip', () => {
    const { container } = render(
      <ProgressPip pip={pip('visited')} isBursting={false} motion={motion('normal')} />,
    );
    expect(container.querySelector('[data-state="visited"]')).not.toBeNull();
  });

  it('renders data-state="here" for here pip', () => {
    const { container } = render(
      <ProgressPip pip={pip('here')} isBursting={false} motion={motion('normal')} />,
    );
    expect(container.querySelector('[data-state="here"]')).not.toBeNull();
  });

  it('renders 3 ripple elements when bursting and motion is normal', () => {
    const { container } = render(
      <ProgressPip pip={pip('here')} isBursting={true} motion={motion('normal')} />,
    );
    expect(container.querySelectorAll('[data-ripple]').length).toBe(3);
  });

  it('renders 0 ripple elements when bursting and motion is reduced', () => {
    const { container } = render(
      <ProgressPip pip={pip('here')} isBursting={true} motion={motion('reduced')} />,
    );
    expect(container.querySelectorAll('[data-ripple]').length).toBe(0);
  });

  it('renders 0 ripple elements when not bursting (even with motion normal)', () => {
    const { container } = render(
      <ProgressPip pip={pip('here')} isBursting={false} motion={motion('normal')} />,
    );
    expect(container.querySelectorAll('[data-ripple]').length).toBe(0);
  });

  it('exposes data-motion attribute reflecting the preference', () => {
    const { container: normalC } = render(
      <ProgressPip pip={pip('visited')} isBursting={false} motion={motion('normal')} />,
    );
    expect(normalC.querySelector('[data-motion="normal"]')).not.toBeNull();

    const { container: reducedC } = render(
      <ProgressPip pip={pip('visited')} isBursting={false} motion={motion('reduced')} />,
    );
    expect(reducedC.querySelector('[data-motion="reduced"]')).not.toBeNull();
  });
});
