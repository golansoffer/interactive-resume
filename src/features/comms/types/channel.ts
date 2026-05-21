import { z } from 'zod';

export type ChannelId = 'linkedin' | 'github' | 'gmail';

const CHANNEL_IDS = ['linkedin', 'github', 'gmail'] as const;

export type Channel = {
  readonly id: ChannelId;
  readonly label: string;
  readonly iconSrc: string;
  readonly href: string;
};

const isContactUrl = (raw: string): boolean => {
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:';
  } catch {
    return false;
  }
};

const channelSchema = z.object({
  id: z.enum(CHANNEL_IDS),
  label: z.string().min(1),
  iconSrc: z.string().min(1),
  href: z.string().refine(isContactUrl, {
    message: 'href must be an http, https, or mailto URL',
  }),
});

export const parseChannel = (raw: unknown): Channel => channelSchema.parse(raw);
