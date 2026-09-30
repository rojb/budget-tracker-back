import type { ValueTransformer } from 'typeorm';

// Postgres returns bigint as a string; money must stay an exact integer in the domain, so the
// column is read as a number and rejected if it does not fit in a safe integer.
export const minorAmountTransformer: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | null): number | null => {
    if (value === null) {
      return null;
    }
    const amount = Number(value);
    if (!Number.isSafeInteger(amount)) {
      throw new RangeError(`Amount out of the safe integer range: ${value}`);
    }
    return amount;
  },
};
