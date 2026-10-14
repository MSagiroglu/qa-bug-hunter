/**
 * Metamorphic relation helper (see references/core/metamorphic-differential.md).
 *
 * Runs a source case and a follow-up case, then checks a relation between the
 * two outputs. The relation is the oracle. NEVER throws: failures of either
 * run are recorded in `errors`.
 */
export type RelationOptions<T> = {
  /** Short name, for example 'search AB subset of search A'. */
  name: string;
  /** Source run. */
  source: () => Promise<T>;
  /** Follow-up run (transformed input). */
  followUp: () => Promise<T>;
  /** Returns true when the relation holds. */
  holds: (source: T, followUp: T) => boolean;
};

export type RelationResult<T> = {
  name: string;
  source: T | null;
  followUp: T | null;
  /** True only when both runs worked and the relation holds. */
  holds: boolean;
  /** 'VIOLATION' or 'RUN_FAILED'; empty when it holds. */
  mismatches: string[];
  errors: string[];
};

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export async function checkRelation<T>(o: RelationOptions<T>): Promise<RelationResult<T>> {
  const errors: string[] = [];
  let source: T | null = null;
  let followUp: T | null = null;
  try {
    source = await o.source();
  } catch (e) {
    errors.push(`source: ${msg(e)}`);
  }
  try {
    followUp = await o.followUp();
  } catch (e) {
    errors.push(`followUp: ${msg(e)}`);
  }
  const mismatches: string[] = [];
  let holds = false;
  if (source === null || followUp === null) {
    mismatches.push('RUN_FAILED');
  } else {
    try {
      holds = o.holds(source, followUp);
    } catch (e) {
      errors.push(`holds: ${msg(e)}`);
    }
    if (!holds) mismatches.push('VIOLATION');
  }
  return { name: o.name, source, followUp, holds, mismatches, errors };
}

/** Ready relations over lists of string ids/labels. */
export const subset = (narrow: string[], broad: string[]): boolean => {
  const b = new Set(broad);
  return narrow.every((x) => b.has(x));
};
export const sameMembers = (a: string[], b: string[]): boolean =>
  a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');
export const sameOrder = (a: string[], b: string[]): boolean => JSON.stringify(a) === JSON.stringify(b);
