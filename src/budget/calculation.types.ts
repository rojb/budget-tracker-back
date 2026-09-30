import type { MonthKey } from './month-key.js';

// Facts of one plan, already attributed to budget months (see monthOfInstant). Every amount is an
// integer in the minor units of the plan's currency. Consumers build it from their own tables;
// CalculationService never queries the database.
export interface PlanLedger {
  // Month of "now" in the plan's time zone (currentMonth(plan.timeZone)).
  currentMonth: MonthKey;
  // Every envelope of the plan; the result lists them in this order.
  envelopeIds: string[];
  // Changes to the sum of account balances, only for accounts that are not archived:
  // each account's opening balance in its opening month, and every transaction on it
  // (income +, expense −, transfer in + / transfer out −).
  balanceMovements: LedgerAmount[];
  // One row per envelope and month, as returned by AssignmentsService.ledgerRows.
  assignments: EnvelopeAmount[];
  // Net outflow per envelope and month: expense or split portion +, income sent straight to the
  // envelope −. Income to Ready to Assign and transfers between accounts are NOT listed.
  spending: EnvelopeAmount[];
}

export interface LedgerAmount {
  month: MonthKey;
  amountMinor: number;
}

export interface EnvelopeAmount extends LedgerAmount {
  envelopeId: string;
}

export interface EnvelopeTotal {
  envelopeId: string;
  amountMinor: number;
}

export interface EnvelopeMonthState {
  envelopeId: string;
  assignedMinor: number;
  carryoverMinor: number;
  spentMinor: number;
  // assigned + carryover − spent; negative when overspent.
  availableMinor: number;
}

export interface MonthState {
  month: MonthKey;
  // True when the month is after the ledger's current month.
  isFuture: boolean;
  envelopes: EnvelopeMonthState[];
  // Σ account balances at the end of the month.
  balanceMinor: number;
  // Σ Available of every envelope.
  availableMinor: number;
  // Σ Assigned in months after this one.
  futureAssignedMinor: number;
  // Overspending of the previous month, settled against this month's Ready to Assign.
  overspentSettledMinor: number;
  // balance − available − futureAssigned; for future months, the current month's value.
  readyToAssignMinor: number;
}

export interface MonthClose {
  fromMonth: MonthKey;
  toMonth: MonthKey;
  // Envelopes whose positive Available carries into toMonth.
  carried: EnvelopeTotal[];
  // Envelopes whose negative Available is deducted from toMonth's Ready to Assign (positive
  // amounts).
  deducted: EnvelopeTotal[];
  totalDeductedMinor: number;
  readyToAssignFromMinor: number;
  readyToAssignToMinor: number;
}
