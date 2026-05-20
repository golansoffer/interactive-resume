import { z } from 'zod';

export type ChannelId = 'linkedin' | 'github' | 'discord' | 'gmail';

const CHANNEL_IDS = ['linkedin', 'github', 'discord', 'gmail'] as const;

export type Channel =
  | {
      readonly kind: 'link';
      readonly id: ChannelId;
      readonly label: string;
      readonly iconSrc: string;
      readonly href: string;
    }
  | {
      readonly kind: 'copy';
      readonly id: ChannelId;
      readonly label: string;
      readonly iconSrc: string;
      readonly value: string;
    };

const isContactUrl = (raw: string): boolean => {
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:';
  } catch {
    return false;
  }
};

const channelIdSchema = z.enum(CHANNEL_IDS);
const labelSchema = z.string().min(1);
const iconSrcSchema = z.string().min(1);
const hrefSchema = z.string().refine(isContactUrl, {
  message: 'href must be an http, https, or mailto URL',
});

const linkChannelSchema = z.object({
  kind: z.literal('link'),
  id: channelIdSchema,
  label: labelSchema,
  iconSrc: iconSrcSchema,
  href: hrefSchema,
});

const copyChannelSchema = z.object({
  kind: z.literal('copy'),
  id: channelIdSchema,
  label: labelSchema,
  iconSrc: iconSrcSchema,
  value: z.string().min(1),
});

const channelSchema = z.discriminatedUnion('kind', [linkChannelSchema, copyChannelSchema]);

export const parseChannel = (raw: unknown): Channel => channelSchema.parse(raw);
