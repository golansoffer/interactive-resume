import { parseChannel, type Channel, type ChannelId } from '../../types/channel';

const channelFor = (id: ChannelId, data: Omit<Channel, 'id'>): Channel =>
  parseChannel({ ...data, id });

const CHANNELS_BY_ID: Readonly<Record<ChannelId, Channel>> = {
  linkedin: channelFor('linkedin', {
    label: 'LinkedIn',
    iconSrc: '/icons/LinkedIn.svg',
    href: 'https://www.linkedin.com/in/golansofer/',
  }),
  github: channelFor('github', {
    label: 'GitHub',
    iconSrc: '/icons/Github.svg',
    href: 'https://github.com/golansoffer',
  }),
  gmail: channelFor('gmail', {
    label: 'Gmail',
    iconSrc: '/icons/Gmail.svg',
    href: 'mailto:Gsoffer550@gmail.com',
  }),
};

const CHANNELS: ReadonlyArray<Channel> = [
  CHANNELS_BY_ID.linkedin,
  CHANNELS_BY_ID.github,
  CHANNELS_BY_ID.gmail,
];

export const getChannels = (): ReadonlyArray<Channel> => CHANNELS;

export const getChannelById = (id: ChannelId): Channel => CHANNELS_BY_ID[id];
