import { z } from 'zod';
import { SHIP_IDS } from '../types/ship';

const shipIdSchema = z.enum(SHIP_IDS);
const searchSchema = z.object({ ship: shipIdSchema.optional() });

export type ShipSearch = z.infer<typeof searchSchema>;

export const parseShipSearch = (raw: Record<string, unknown>): ShipSearch => {
  const result = searchSchema.safeParse(raw);
  return result.success ? result.data : { ship: undefined };
};
