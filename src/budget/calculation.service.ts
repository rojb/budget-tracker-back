import { Injectable } from '@nestjs/common';
import type {
  EnvelopeAmount,
  EnvelopeMonthState,
  LedgerAmount,
  MonthState,
  PlanLedger,
} from './calculation.types.js';
import {
  assertMonthKey,
  compareMonths,
  monthRange,
  type MonthKey,
} from './month-key.js';

// Formula values of one month, before the "future months show the current RTA" rule.
interface MonthFigures {
  month: MonthKey;
  envelopes: EnvelopeMonthState[];
  balanceMinor: number;
  availableMinor: number;
  futureAssignedMinor: number;
  overspentMinor: number;
  overspentSettledMinor: number;
  readyToAssignMinor: number;
}

interface LedgerIndex {
  firstMonth: MonthKey | null;
  balance: Map<MonthKey, number>;
  assigned: Map<MonthKey, Map<string, number>>;
  spent: Map<MonthKey, Map<string, number>>;
  assignedByMonth: Map<MonthKey, number>;
  totalAssigned: number;
}

function assertMinor(value: unknown, what: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new RangeError(
      `${what} must be an integer amount in minor units, got ${String(value)}`,
    );
  }
  return value;
}

function addTo(map: Map<MonthKey, number>, month: MonthKey, amount: number) {
  map.set(month, (map.get(month) ?? 0) + amount);
}

function addToEnvelope(
  map: Map<MonthKey, Map<string, number>>,
  row: EnvelopeAmount,
) {
  let byEnvelope = map.get(row.month);
  if (!byEnvelope) {
    byEnvelope = new Map();
    map.set(row.month, byEnvelope);
  }
  byEnvelope.set(
    row.envelopeId,
    (byEnvelope.get(row.envelopeId) ?? 0) + row.amountMinor,
  );
}

// Derives every budget figure from the ledger's facts on each call (FR-11, FR-12). Pure: it
// holds no state and never touches the database.
@Injectable()
export class CalculationService {
  calculateMonth(ledger: PlanLedger, month: MonthKey): MonthState {
    assertMonthKey(month);
    const current = assertMonthKey(ledger.currentMonth);
    const isFuture = compareMonths(month, current) > 0;
    const figures = this.walk(ledger, month);
    const target = figures.get(month)!;
    // The current month's overspending is settled only when it ends, so every later month
    // shows the plan-wide Ready to Assign of the current month.
    const readyToAssignMinor = isFuture
      ? figures.get(current)!.readyToAssignMinor
      : target.readyToAssignMinor;
    return {
      month,
      isFuture,
      envelopes: target.envelopes,
      balanceMinor: target.balanceMinor,
      availableMinor: target.availableMinor,
      futureAssignedMinor: target.futureAssignedMinor,
      overspentSettledMinor: target.overspentSettledMinor,
      readyToAssignMinor,
    };
  }

  // Walks from the earliest month with facts up to max(until, currentMonth), carrying each
  // envelope's Available forward. Returns the formula figures of every visited month.
  private walk(
    ledger: PlanLedger,
    until: MonthKey,
  ): Map<MonthKey, MonthFigures> {
    const index = this.indexLedger(ledger);
    const current = ledger.currentMonth;
    const last = compareMonths(until, current) > 0 ? until : current;
    const candidates = [until, current];
    if (index.firstMonth) {
      candidates.push(index.firstMonth);
    }
    const first = candidates.sort(compareMonths)[0];

    const figures = new Map<MonthKey, MonthFigures>();
    const previousAvailable = new Map<string, number>();
    let balance = 0;
    let assignedSoFar = 0;
    let previousOverspent = 0;

    for (const month of monthRange(first, last)) {
      balance += index.balance.get(month) ?? 0;
      assignedSoFar += index.assignedByMonth.get(month) ?? 0;
      const assigned = index.assigned.get(month);
      const spent = index.spent.get(month);

      let availableTotal = 0;
      let overspent = 0;
      const envelopes = ledger.envelopeIds.map((envelopeId) => {
        const assignedMinor = assigned?.get(envelopeId) ?? 0;
        const spentMinor = spent?.get(envelopeId) ?? 0;
        // Only a positive balance carries; an overspent envelope restarts at zero (FR-12).
        const carryoverMinor = Math.max(
          0,
          previousAvailable.get(envelopeId) ?? 0,
        );
        const availableMinor = assignedMinor + carryoverMinor - spentMinor;
        previousAvailable.set(envelopeId, availableMinor);
        availableTotal += availableMinor;
        overspent += Math.max(0, -availableMinor);
        return {
          envelopeId,
          assignedMinor,
          carryoverMinor,
          spentMinor,
          availableMinor,
        };
      });

      const futureAssignedMinor = index.totalAssigned - assignedSoFar;
      figures.set(month, {
        month,
        envelopes,
        balanceMinor: balance,
        availableMinor: availableTotal,
        futureAssignedMinor,
        overspentMinor: overspent,
        overspentSettledMinor: previousOverspent,
        readyToAssignMinor: balance - availableTotal - futureAssignedMinor,
      });
      previousOverspent = overspent;
    }
    return figures;
  }

  private indexLedger(ledger: PlanLedger): LedgerIndex {
    assertMonthKey(ledger.currentMonth);
    const envelopes = new Set(ledger.envelopeIds);
    const index: LedgerIndex = {
      firstMonth: null,
      balance: new Map(),
      assigned: new Map(),
      spent: new Map(),
      assignedByMonth: new Map(),
      totalAssigned: 0,
    };
    const seeMonth = (row: LedgerAmount, what: string) => {
      assertMonthKey(row.month);
      assertMinor(row.amountMinor, what);
      if (!index.firstMonth || compareMonths(row.month, index.firstMonth) < 0) {
        index.firstMonth = row.month;
      }
    };
    const seeEnvelope = (row: EnvelopeAmount, what: string) => {
      seeMonth(row, what);
      if (!envelopes.has(row.envelopeId)) {
        throw new RangeError(
          `${what} references envelope ${row.envelopeId}, which is not in the ledger`,
        );
      }
    };

    for (const row of ledger.balanceMovements) {
      seeMonth(row, 'Balance movement');
      addTo(index.balance, row.month, row.amountMinor);
    }
    for (const row of ledger.assignments) {
      seeEnvelope(row, 'Assignment');
      addToEnvelope(index.assigned, row);
      addTo(index.assignedByMonth, row.month, row.amountMinor);
      index.totalAssigned += row.amountMinor;
    }
    for (const row of ledger.spending) {
      seeEnvelope(row, 'Spending');
      addToEnvelope(index.spent, row);
    }
    return index;
  }
}
