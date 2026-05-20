import { describe, expect, it } from 'vitest';
import { parseChannel } from './channel';

const linkRaw = {
  kind: 'link',
  id: 'linkedin',
  label: 'LinkedIn',
  iconSrc: '/icons/LinkedIn.svg',
  href: 'https://www.linkedin.com/in/example/',
};

const copyRaw = {
  kind: 'copy',
  id: 'discord',
  label: 'Discord',
  iconSrc: '/icons/Discord.svg',
  value: 'example#0001',
};

describe('parseChannel', () => {
  it('parses a link channel descriptor into kind "link" with id, label, and href', () => {
    const parsed = parseChannel(linkRaw);
    expect(parsed.kind).toBe('link');
    if (parsed.kind === 'link') {
      expect(parsed.id).toBe('linkedin');
      expect(parsed.label).toBe('LinkedIn');
      expect(parsed.href).toBe('https://www.linkedin.com/in/example/');
    }
  });

  it('parses a copy channel descriptor into kind "copy" with id, label, and value', () => {
    const parsed = parseChannel(copyRaw);
    expect(parsed.kind).toBe('copy');
    if (parsed.kind === 'copy') {
      expect(parsed.id).toBe('discord');
      expect(parsed.label).toBe('Discord');
      expect(parsed.value).toBe('example#0001');
    }
  });

  it('rejects a descriptor missing href on a link channel', () => {
    const { href: _href, ...incomplete } = linkRaw;
    expect(() => parseChannel(incomplete)).toThrow();
  });

  it('rejects a descriptor missing value on a copy channel', () => {
    const { value: _value, ...incomplete } = copyRaw;
    expect(() => parseChannel(incomplete)).toThrow();
  });

  it('rejects a descriptor whose kind is neither "link" nor "copy"', () => {
    expect(() => parseChannel({ ...linkRaw, kind: 'unknown' })).toThrow();
  });

  it('rejects a link channel whose href uses a disallowed protocol', () => {
    expect(() => parseChannel({ ...linkRaw, href: 'ftp://example.com' })).toThrow();
    expect(() => parseChannel({ ...linkRaw, href: 'not-a-url' })).toThrow();
    expect(() => parseChannel({ ...linkRaw, href: 'javascript:alert(1)' })).toThrow();
  });

  it('accepts a link channel whose href is a mailto URL', () => {
    const parsed = parseChannel({ ...linkRaw, href: 'mailto:hello@example.com' });
    expect(parsed.kind).toBe('link');
    if (parsed.kind === 'link') {
      expect(parsed.href).toBe('mailto:hello@example.com');
    }
  });

  it('rejects a copy channel whose value is an empty string', () => {
    expect(() => parseChannel({ ...copyRaw, value: '' })).toThrow();
  });

  it('rejects an id that is not one of the four known channels', () => {
    expect(() => parseChannel({ ...linkRaw, id: 'twitter' })).toThrow();
  });
});

