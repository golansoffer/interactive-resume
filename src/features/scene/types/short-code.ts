export type ShortCode = string & { readonly __brand: 'ShortCode' };

export const asShortCode = (raw: string): ShortCode => raw as ShortCode;
