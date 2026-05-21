import { describe, expect, it } from 'vitest';
import { getChannels } from './channels';
import type { ChannelId } from '../../types/channel';

const findById = (id: ChannelId) => {
  const match = getChannels().find((c) => c.id === id);
  if (match === undefined) {
    throw new Error(`expected channel with id "${id}" to exist`);
  }
  return match;
};

describe('getChannels', () => {
  it('returns exactly three channels (linkedin, github, gmail)', () => {
    const ids = getChannels().map((c) => c.id);
    expect(new Set(ids)).toEqual(new Set(['linkedin', 'github', 'gmail']));
    expect(ids).toHaveLength(3);
  });

  it("LinkedIn points at the resume's LinkedIn URL", () => {
    const linkedin = findById('linkedin');
    expect(linkedin.label).toBe('LinkedIn');
    expect(linkedin.iconSrc).toBe('/icons/LinkedIn.svg');
    expect(linkedin.href).toBe('https://www.linkedin.com/in/golansofer/');
  });

  it("GitHub points at the resume's GitHub URL", () => {
    const github = findById('github');
    expect(github.label).toBe('GitHub');
    expect(github.iconSrc).toBe('/icons/Github.svg');
    expect(github.href).toBe('https://github.com/golansoffer');
  });

  it("Gmail uses a mailto href to the resume's Gmail address", () => {
    const gmail = findById('gmail');
    expect(gmail.label).toBe('Gmail');
    expect(gmail.iconSrc).toBe('/icons/Gmail.svg');
    expect(gmail.href).toBe('mailto:Gsoffer550@gmail.com');
  });

  it('every channel iconSrc points to /icons/<filename>.svg', () => {
    for (const channel of getChannels()) {
      expect(channel.iconSrc.startsWith('/icons/')).toBe(true);
      expect(channel.iconSrc.endsWith('.svg')).toBe(true);
    }
  });

  it('every channel href uses an http(s) or mailto protocol', () => {
    for (const channel of getChannels()) {
      const url = new URL(channel.href);
      expect(['http:', 'https:', 'mailto:']).toContain(url.protocol);
    }
  });
});
