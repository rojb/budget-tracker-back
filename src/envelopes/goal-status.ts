import { compareMonths, type MonthKey } from '../budget/month-key.js';
import type { GoalType } from './entities/envelope.entity.js';

// The rules of capability `envelope-goals`, in one pure module with no database access: the required
// amount of a month, the derived state of an envelope and the progress of its goal. Every reader
// (list, detail, move money) goes through describeLine, so the definition exists only here and the
// clients never recompute it. Nothing in this file is stored.

export const ENVELOPE_STATES = ['funded', 'underfunded', 'overspent'] as const;
export type EnvelopeState = (typeof ENVELOPE_STATES)[number];

export interface GoalInput {
  type: GoalType;
  targetMinor: number;
  // YYYY-MM-DD, present only for a goal with a date.
  dueDate: string | null;
}

// The month's figures of one envelope, as the budget engine derives them.
export interface LineFigures {
  assignedMinor: number;
  carryoverMinor: number;
  spentMinor: number;
  availableMinor: number;
}

export interface GoalProgress {
  requiredMinor: number;
  missingMinor: number;
  savedMinor: number;
  remainingMinor: number;
  percent: number;
  monthsRemaining?: number;
}

export interface LineDescription {
  state: EnvelopeState;
  goalStatus?: GoalProgress;
}

// Integer ceiling of n / d for n >= 0 and d >= 1, without float rounding.
function ceilDiv(n: number, d: number): number {
  return n % d === 0 ? n / d : Math.floor(n / d) + 1;
}

// Amount to assign in `month` to be on track. A monthly goal asks for its target. A goal with a date
// spreads what the carryover does not cover over the months from `month` to the due month, both
// included (at least one), rounded up; it uses the carryover and not the Available so it does not
// move while the user assigns.
export function requiredAmount(
  goal: GoalInput,
  carryoverMinor: number,
  month: MonthKey,
): number {
  if (goal.type === 'monthly' || goal.dueDate === null) {
    return goal.targetMinor;
  }
  const months = Math.max(
    1,
    compareMonths(goal.dueDate.slice(0, 7), month) + 1,
  );
  return ceilDiv(Math.max(0, goal.targetMinor - carryoverMinor), months);
}

export function describeLine(
  goal: GoalInput | null,
  figures: LineFigures,
  month: MonthKey,
): LineDescription {
  const overspent = figures.availableMinor < 0;
  if (goal === null) {
    return { state: overspent ? 'overspent' : 'funded' };
  }
  const requiredMinor = requiredAmount(goal, figures.carryoverMinor, month);
  const missingMinor = Math.max(0, requiredMinor - figures.assignedMinor);
  const byDate = goal.type === 'targetByDate' && goal.dueDate !== null;
  const savedMinor = byDate
    ? Math.max(0, figures.availableMinor)
    : figures.assignedMinor;
  const capped = Math.min(Math.max(0, savedMinor), goal.targetMinor);
  const goalStatus: GoalProgress = {
    requiredMinor,
    missingMinor,
    savedMinor: Math.max(0, savedMinor),
    remainingMinor: Math.max(0, goal.targetMinor - savedMinor),
    percent: Number((100n * BigInt(capped)) / BigInt(goal.targetMinor)),
  };
  if (byDate && goal.dueDate !== null) {
    goalStatus.monthsRemaining = Math.max(
      0,
      compareMonths(goal.dueDate.slice(0, 7), month),
    );
  }
  const state: EnvelopeState = overspent
    ? 'overspent'
    : missingMinor > 0
      ? 'underfunded'
      : 'funded';
  return { state, goalStatus };
}
