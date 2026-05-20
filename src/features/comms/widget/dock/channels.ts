import { parseChannel, type Channel, type ChannelId } from '../../types/channel';

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
type ChannelInputData = DistributiveOmit<Channel, 'id'>;

const channelFor = (id: ChannelId, data: ChannelInputData): Channel =>
  parseChannel({ ...data, id });

const CHANNELS_BY_ID: Readonly<Record<ChannelId, Channel>> = {
  linkedin: channelFor('linkedin', {
    kind: 'link',
    label: 'LinkedIn',
    iconSrc: '/icons/LinkedIn.svg',
    href: 'https://www.linkedin.com/in/golansofer/',
  }),
  github: channelFor('github', {
    kind: 'link',
    label: 'GitHub',
    iconSrc: '/icons/Github.svg',
    href: 'https://github.com/golansoffer',
  }),
  discord: channelFor('discord', {
    kind: 'copy',
    label: 'Discord',
    iconSrc: '/icons/Discord.svg',
    value: 'golan618',
  }),
  gmail: channelFor('gmail', {
    kind: 'link',
    label: 'Gmail',
    iconSrc: '/icons/Gmail.svg',
    href: 'mailto:Gsoffer550@gmail.com',
  }),
};

const CHANNELS: ReadonlyArray<Channel> = [
  CHANNELS_BY_ID.linkedin,
  CHANNELS_BY_ID.github,
  CHANNELS_BY_ID.discord,
  CHANNELS_BY_ID.gmail,
];

export const getChannels = (): ReadonlyArray<Channel> => CHANNELS;

export const getChannelById = (id: ChannelId): Channel => CHANNELS_BY_ID[id];
