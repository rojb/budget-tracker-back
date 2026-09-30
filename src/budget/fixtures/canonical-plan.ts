import type { PlanLedger } from '../calculation.types.js';
import { monthOfInstant, type MonthKey } from '../month-key.js';

// State B of odd/tasks/canonical-dataset.md (budget-tracker-specs): Sofía's plan on
// Tue 29 Sep 2026, 14:32. Used only by the KR1 demo (npm run calc:kr1); the real ledger is
// built from the database by the consumers of CalculationService.

export const CANONICAL_TIME_ZONE = 'America/Argentina/Buenos_Aires';

export const ENVELOPES = [
  'alquiler',
  'servicios',
  'internet-y-celular',
  'transporte',
  'supermercado',
  'farmacia',
  'comida-afuera',
  'salidas',
  'suscripciones',
  'regalos',
  'emergencia',
  'vacaciones',
] as const;

export type EnvelopeId = (typeof ENVELOPES)[number];

export interface FixtureAccount {
  id: string;
  openingMinor: number;
  openedAt: string;
}

export type FixtureTransaction =
  | {
      id: string;
      kind: 'income';
      accountId: string;
      at: string;
      amountMinor: number;
    }
  | {
      id: string;
      kind: 'expense';
      accountId: string;
      at: string;
      splits: { envelopeId: EnvelopeId; amountMinor: number }[];
    }
  | {
      id: string;
      kind: 'transfer';
      accountId: string;
      toAccountId: string;
      at: string;
      amountMinor: number;
    };

export interface FixturePlan {
  accounts: FixtureAccount[];
  transactions: FixtureTransaction[];
  assignments: {
    envelopeId: EnvelopeId;
    month: MonthKey;
    amountMinor: number;
  }[];
}

export function canonicalPlan(): FixturePlan {
  return {
    accounts: [
      {
        id: 'banco-nacion',
        openingMinor: 300_000,
        openedAt: '2026-09-01T12:00:00-03:00',
      },
      {
        id: 'mercado-pago',
        openingMinor: 50_000,
        openedAt: '2026-09-01T12:05:00-03:00',
      },
      {
        id: 'efectivo',
        openingMinor: 20_000,
        openedAt: '2026-09-01T12:06:00-03:00',
      },
    ],
    transactions: [
      // Banco Nación: 850.000 in, 307.700 out (227.700 expenses + 80.000 transfers).
      {
        id: 'sueldo',
        kind: 'income',
        accountId: 'banco-nacion',
        at: '2026-09-01T09:00:00-03:00',
        amountMinor: 850_000,
      },
      {
        id: 'a-mp',
        kind: 'transfer',
        accountId: 'banco-nacion',
        toAccountId: 'mercado-pago',
        at: '2026-09-02T10:00:00-03:00',
        amountMinor: 60_000,
      },
      {
        id: 'a-efectivo',
        kind: 'transfer',
        accountId: 'banco-nacion',
        toAccountId: 'efectivo',
        at: '2026-09-02T10:05:00-03:00',
        amountMinor: 20_000,
      },
      {
        id: 'super-mensual',
        kind: 'expense',
        accountId: 'banco-nacion',
        at: '2026-09-05T11:20:00-03:00',
        splits: [{ envelopeId: 'supermercado', amountMinor: 100_000 }],
      },
      {
        id: 'super-y-farmacia',
        kind: 'expense',
        accountId: 'banco-nacion',
        at: '2026-09-12T18:40:00-03:00',
        splits: [
          { envelopeId: 'supermercado', amountMinor: 32_450 },
          { envelopeId: 'farmacia', amountMinor: 15_800 },
        ],
      },
      {
        id: 'sube',
        kind: 'expense',
        accountId: 'banco-nacion',
        at: '2026-09-03T08:10:00-03:00',
        splits: [{ envelopeId: 'transporte', amountMinor: 30_000 }],
      },
      {
        id: 'luz-gas-agua',
        kind: 'expense',
        accountId: 'banco-nacion',
        at: '2026-09-10T09:30:00-03:00',
        splits: [{ envelopeId: 'servicios', amountMinor: 41_300 }],
      },
      {
        id: 'cine',
        kind: 'expense',
        accountId: 'banco-nacion',
        at: '2026-09-19T21:15:00-03:00',
        splits: [{ envelopeId: 'salidas', amountMinor: 8_150 }],
      },
      // Mercado Pago: +60.000 transfer, +44.550 income, −33.350 expenses → 121.200.
      {
        id: 'cobro-freelance',
        kind: 'income',
        accountId: 'mercado-pago',
        at: '2026-09-15T16:00:00-03:00',
        amountMinor: 44_550,
      },
      {
        id: 'uber-y-nafta',
        kind: 'expense',
        accountId: 'mercado-pago',
        at: '2026-09-27T20:05:00-03:00',
        splits: [{ envelopeId: 'transporte', amountMinor: 21_200 }],
      },
      {
        id: 'bar',
        kind: 'expense',
        accountId: 'mercado-pago',
        at: '2026-09-26T23:40:00-03:00',
        splits: [{ envelopeId: 'salidas', amountMinor: 5_850 }],
      },
      {
        id: 'delivery',
        kind: 'expense',
        accountId: 'mercado-pago',
        at: '2026-09-22T21:00:00-03:00',
        splits: [{ envelopeId: 'comida-afuera', amountMinor: 6_300 }],
      },
      // Efectivo: +20.000 transfer, −3.500 expenses → 36.500.
      {
        id: 'cafe',
        kind: 'expense',
        accountId: 'efectivo',
        at: '2026-09-29T14:32:00-03:00',
        splits: [{ envelopeId: 'comida-afuera', amountMinor: 3_500 }],
      },
    ],
    // September assignments = Available + Spent (the plan starts in September, no carryover),
    // plus the 20.000 reserved for Regalos in November.
    assignments: [
      { envelopeId: 'alquiler', month: '2026-09', amountMinor: 380_000 },
      { envelopeId: 'servicios', month: '2026-09', amountMinor: 62_000 },
      {
        envelopeId: 'internet-y-celular',
        month: '2026-09',
        amountMinor: 15_000,
      },
      { envelopeId: 'transporte', month: '2026-09', amountMinor: 45_000 },
      { envelopeId: 'supermercado', month: '2026-09', amountMinor: 180_000 },
      { envelopeId: 'farmacia', month: '2026-09', amountMinor: 39_800 },
      { envelopeId: 'comida-afuera', month: '2026-09', amountMinor: 29_800 },
      { envelopeId: 'salidas', month: '2026-09', amountMinor: 39_000 },
      { envelopeId: 'suscripciones', month: '2026-09', amountMinor: 15_750 },
      { envelopeId: 'regalos', month: '2026-09', amountMinor: 10_000 },
      { envelopeId: 'emergencia', month: '2026-09', amountMinor: 20_000 },
      { envelopeId: 'vacaciones', month: '2026-09', amountMinor: 360_000 },
      { envelopeId: 'regalos', month: '2026-11', amountMinor: 20_000 },
    ],
  };
}

// What a consumer does with its own tables: attribute each fact to a budget month in the plan's
// time zone and translate it into ledger rows.
export function toLedger(
  plan: FixturePlan,
  currentMonth: MonthKey,
): PlanLedger {
  const month = (at: string) =>
    monthOfInstant(new Date(at), CANONICAL_TIME_ZONE);
  const ledger: PlanLedger = {
    currentMonth,
    envelopeIds: [...ENVELOPES],
    balanceMovements: plan.accounts.map((account) => ({
      month: month(account.openedAt),
      amountMinor: account.openingMinor,
    })),
    assignments: plan.assignments.map((row) => ({ ...row })),
    spending: [],
  };
  for (const tx of plan.transactions) {
    if (tx.kind === 'income') {
      // Income to Ready to Assign: raises the balance, no envelope activity.
      ledger.balanceMovements.push({
        month: month(tx.at),
        amountMinor: tx.amountMinor,
      });
    } else if (tx.kind === 'expense') {
      for (const split of tx.splits) {
        ledger.balanceMovements.push({
          month: month(tx.at),
          amountMinor: -split.amountMinor,
        });
        ledger.spending.push({
          envelopeId: split.envelopeId,
          month: month(tx.at),
          amountMinor: split.amountMinor,
        });
      }
    } else {
      // Both accounts belong to the plan: the transfer nets to zero and is never spending.
      ledger.balanceMovements.push({
        month: month(tx.at),
        amountMinor: -tx.amountMinor,
      });
      ledger.balanceMovements.push({
        month: month(tx.at),
        amountMinor: tx.amountMinor,
      });
    }
  }
  return ledger;
}
