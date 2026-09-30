import { QueryFailedError } from 'typeorm';

const PG_UNIQUE_VIOLATION = '23505';

// True when Postgres rejected a write because of a unique index. The index is the source of truth
// for "name already in use"; a pre-check would race.
export function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: string } | undefined)?.code ===
      PG_UNIQUE_VIOLATION
  );
}
