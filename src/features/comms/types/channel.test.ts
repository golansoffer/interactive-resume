import { describe, expect, it } from 'vitest';
import { parseChannel } from './channel';

const linkRaw = {
  id: 'linkedin',
  label: 'LinkedIn',
  iconSrc: '/icons/LinkedIn.svg',
  href: 'https://www.linkedin.com/in/example/',
};

describe('parseChannel', () => {
  it('parses a channel descriptor with id, label, iconSrc, and href', () => {
    const parsed = parseChannel(linkRaw);
    expect(parsed.id).toBe('linkedin');
    expect(parsed.label).toBe('LinkedIn');
    expect(parsed.iconSrc).toBe('/icons/LinkedIn.svg');
    expect(parsed.href).toBe('https://www.linkedin.com/in/example/');
  });

  it('rejects a descriptor missing href', () => {
    const { href: _href, ...incomplete } = linkRaw;
    expect(() => parseChannel(incomplete)).toThrow();
  });

  it('rejects a descriptor whose href uses a disallowed protocol', () => {
    expect(() => parseChannel({ ...linkRaw, href: 'ftp://example.com' })).toThrow();
    expect(() => parseChannel({ ...linkRaw, href: 'not-a-url' })).toThrow();
    expect(() => parseChannel({ ...linkRaw, href: 'javascript:alert(1)' })).toThrow();
  });

  it('accepts a channel whose href is a mailto URL', () => {
    const parsed = parseChannel({ ...linkRaw, href: 'mailto:hello@example.com' });
    expect(parsed.href).toBe('mailto:hello@example.com');
  });

  it('rejects an id that is not one of the three known channels', () => {
    expect(() => parseChannel({ ...linkRaw, id: 'twitter' })).toThrow();
    expect(() => parseChannel({ ...linkRaw, id: 'discord' })).toThrow();
  });
});
