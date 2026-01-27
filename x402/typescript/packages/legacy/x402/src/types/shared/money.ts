// ucm:1493:@nic

import { z } from "zod";

export const moneySchema = z
  .union([z.string().transform(x => x.replace(/[^0-9.-]+/g, "")), z.number()])
  .pipe(z.coerce.number().min(0.0001).max(999999999));

export type Money = z.input<typeof moneySchema>;


/* EOF - n1ch0las | 1493 */