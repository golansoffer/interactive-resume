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
    const fake = createFakeAudioContext();
    const src = fake.ctx.createBufferSource();
    // Re-fetch from the handle's sources array to access fake-only fields.
    const fakeSrc = fake.sources.at(-1);
    if (fakeSrc === undefined) throw new Error('expected a source');
    expect(fakeSrc.started).toBe(false);
    src.start(0);
    expect(fakeSrc.started).toBe(true);
  });

  it('createBufferSource.stop marks the source stopped', () => {
    const fake = createFakeAudioContext();
    const src = fake.ctx.createBufferSource();
    const fakeSrc = fake.sources.at(-1);
    if (fakeSrc === undefined) throw new Error('expected a source');
    src.start(0);
    src.stop();
    expect(fakeSrc.stopped).toBe(true);
  });

  it('decodeAudioData resolves with a fake AudioBuffer', async () => {
    const { ctx } = createFakeAudioContext();
    const buf = await ctx.decodeAudioData(new ArrayBuffer(8));
    expect(buf).toBeDefined();
    expect(buf.duration).toBe(1);
  });
});
