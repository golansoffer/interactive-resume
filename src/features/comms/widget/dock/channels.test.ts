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
  it('returns exactly four channels (linkedin, github, discord, gmail)', () => {
    const ids = getChannels().map((c) => c.id);
    expect(new Set(ids)).toEqual(new Set(['linkedin', 'github', 'discord', 'gmail']));
    expect(ids).toHaveLength(4);
  });

  it("LinkedIn is a 'link' channel pointing at the resume's LinkedIn URL", () => {
    const linkedin = findById('linkedin');
    expect(linkedin.kind).toBe('link');
    if (linkedin.kind === 'link') {
      expect(linkedin.label).toBe('LinkedIn');
      expect(linkedin.iconSrc).toBe('/icons/LinkedIn.svg');
      expect(linkedin.href).toBe('https://www.linkedin.com/in/golansofer/');
    }
  });

  it("GitHub is a 'link' channel pointing at the resume's GitHub URL", () => {
    const github = findById('github');
    expect(github.kind).toBe('link');
    if (github.kind === 'link') {
      expect(github.label).toBe('GitHub');
      expect(github.iconSrc).toBe('/icons/Github.svg');
      expect(github.href).toBe('https://github.com/golansoffer');
    }
  });

  it("Discord is a 'copy' channel with the resume's Discord handle", () => {
    const discord = findById('discord');
    expect(discord.kind).toBe('copy');
    if (discord.kind === 'copy') {
      expect(discord.label).toBe('Discord');
      expect(discord.iconSrc).toBe('/icons/Discord.svg');
      expect(discord.value).toBe('golan618');
    }
  });

  it("Gmail is a 'link' channel with a mailto href to the resume's Gmail address", () => {
    const gmail = findById('gmail');
    expect(gmail.kind).toBe('link');
    if (gmail.kind === 'link') {
      expect(gmail.label).toBe('Gmail');
      expect(gmail.iconSrc).toBe('/icons/Gmail.svg');
      expect(gmail.href).toBe('mailto:Gsoffer550@gmail.com');
    }
  });

  it('every channel iconSrc points to /icons/<filename>.svg', () => {
    for (const channel of getChannels()) {
      expect(channel.iconSrc.startsWith('/icons/')).toBe(true);
      expect(channel.iconSrc.endsWith('.svg')).toBe(true);
    }
  });

  it('every link channel href uses an http(s) or mailto protocol', () => {
    for (const channel of getChannels()) {
      if (channel.kind === 'link') {
        const url = new URL(channel.href);
        expect(['http:', 'https:', 'mailto:']).toContain(url.protocol);
      }
    }
  });

  it('every copy channel value is non-empty', () => {
    for (const channel of getChannels()) {
      if (channel.kind === 'copy') {
        expect(channel.value.length).toBeGreaterThan(0);
      }
    }
  });
});
