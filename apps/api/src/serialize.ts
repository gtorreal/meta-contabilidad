import type { Decimal } from "@prisma/client/runtime/library";

export function decToString(d: Decimal | null | undefined): string | null {
  if (d === null || d === undefined) return null;
  return d.toFixed();
}
