import { performance } from 'node:perf_hooks';
import { CalculationService } from '../budget/calculation.service.js';
import type { PlanLedger } from '../budget/calculation.types.js';
import {
  canonicalPlan,
  CANONICAL_TIME_ZONE,
  ENVELOPES,
  toLedger,
  type FixturePlan,
} from '../budget/fixtures/canonical-plan.js';
import { addMonths, monthOfInstant } from '../budget/month-key.js';

// Reproduces the three KR1 review scenarios (PRD §3) with the canonical dataset and prints
// expected vs. computed values, so both developers can rehearse them by reading the output.
// A demo, not a test: no framework, no database, not run by CI. Usage: npm run calc:kr1

const engine = new CalculationService();
const money = new Intl.NumberFormat('es-AR');
let mismatches = 0;

function fmt(amount: number): string {
  return `${amount < 0 ? '−' : ''}$ ${money.format(Math.abs(amount))}`;
}

function check(label: string, expected: number | string, got: number | string) {
  const ok = expected === got;
  if (!ok) mismatches++;
  const show = (value: number | string) =>
    typeof value === 'number' ? fmt(value) : value;
  console.log(
    `  ${ok ? 'OK      ' : 'MISMATCH'}  ${label.padEnd(56)} esperado ${show(expected).padStart(12)}   calculado ${show(got).padStart(12)}`,
  );
}

function available(ledger: PlanLedger, month: string, envelope: string) {
  return engine
    .calculateMonth(ledger, month)
    .envelopes.find((row) => row.envelopeId === envelope)!.availableMinor;
}

function section(title: string) {
  console.log(`\n${title}`);
}

// --- Estado B: martes 29/09/2026 ---------------------------------------------------------
const plan = canonicalPlan();
const september = toLedger(plan, '2026-09');
const sept = engine.calculateMonth(september, '2026-09');

section('Estado B — 29/09/2026 (odd/tasks/canonical-dataset.md)');
check('Σ saldos de cuentas', 1_000_000, sept.balanceMinor);
check('Σ disponible septiembre', 931_800, sept.availableMinor);
check(
  'Transporte disponible (sobregirado)',
  -6_200,
  available(september, '2026-09', 'transporte'),
);
check(
  'Supermercado disponible',
  47_550,
  available(september, '2026-09', 'supermercado'),
);
check(
  'Alquiler disponible',
  380_000,
  available(september, '2026-09', 'alquiler'),
);

// --- KR1-1: asignación a un mes futuro ---------------------------------------------------
section('KR1-1 — Asignación a mes futuro (FR-10, FR-11)');
const withoutFuture: FixturePlan = {
  ...plan,
  assignments: plan.assignments.filter((row) => row.month !== '2026-11'),
};
check(
  'Listo para asignar sep sin la reserva de noviembre',
  68_200,
  engine.calculateMonth(toLedger(withoutFuture, '2026-09'), '2026-09')
    .readyToAssignMinor,
);
check('Reservado a futuro desde septiembre', 20_000, sept.futureAssignedMinor);
check(
  'Listo para asignar sep = 1.000.000 − 931.800 − 20.000',
  48_200,
  sept.readyToAssignMinor,
);
const november = engine.calculateMonth(september, '2026-11');
check(
  'Noviembre: Regalos asignado',
  20_000,
  november.envelopes.find((row) => row.envelopeId === 'regalos')!.assignedMinor,
);
check(
  'Noviembre: Listo para asignar (plan-wide)',
  48_200,
  november.readyToAssignMinor,
);

// --- KR1-2: saldado del mes anterior -----------------------------------------------------
section('KR1-2 — Cierre de mes septiembre → octubre (FR-12)');
const october = toLedger(plan, '2026-10');
const close = engine.closeMonth(october, '2026-09');
const carried = (id: string) =>
  close.carried.find((row) => row.envelopeId === id)?.amountMinor ?? 0;
const deducted = (id: string) =>
  close.deducted.find((row) => row.envelopeId === id)?.amountMinor ?? 0;
check('Supermercado se arrastra', 47_550, carried('supermercado'));
check('Alquiler se arrastra', 380_000, carried('alquiler'));
check(
  'Transporte se descuenta de Listo para asignar',
  6_200,
  deducted('transporte'),
);
check(
  'Transporte reinicia en octubre',
  0,
  available(october, '2026-10', 'transporte'),
);
check(
  'Listo para asignar oct = 48.200 − 6.200',
  42_000,
  close.readyToAssignToMinor,
);
const oct = engine.calculateMonth(october, '2026-10');
check('Σ disponible octubre (931.800 + 6.200)', 938_000, oct.availableMinor);
check(
  'Invariante: 1.000.000 − 938.000 − 20.000',
  oct.balanceMinor - oct.availableMinor - oct.futureAssignedMinor,
  oct.readyToAssignMinor,
);

// --- KR1-3: edición y borrado con recálculo ----------------------------------------------
section('KR1-3 — Edición y borrado de movimientos pasados (FR-13)');
const edited: FixturePlan = structuredClone(plan);
const uber = edited.transactions.find((tx) => tx.id === 'uber-y-nafta');
if (uber?.kind === 'expense') uber.splits[0].amountMinor = 11_200; // 21.200 → 11.200
const afterEdit = toLedger(edited, '2026-10');
check(
  'Editar: Transporte sep pasa de −6.200 a 3.800',
  3_800,
  available(afterEdit, '2026-09', 'transporte'),
);
check(
  'Editar: Transporte se arrastra a octubre',
  3_800,
  available(afterEdit, '2026-10', 'transporte'),
);
check(
  'Editar: Listo para asignar oct sin sobregiro',
  48_200,
  engine.calculateMonth(afterEdit, '2026-10').readyToAssignMinor,
);

edited.transactions = edited.transactions.filter(
  (tx) => tx.id !== 'super-mensual',
);
const afterDelete = toLedger(edited, '2026-10');
check(
  'Borrar gasto: Supermercado sep 47.550 → 147.550',
  147_550,
  available(afterDelete, '2026-09', 'supermercado'),
);
check(
  'Borrar gasto: Supermercado oct se arrastra',
  147_550,
  available(afterDelete, '2026-10', 'supermercado'),
);
check(
  'Borrar gasto: Σ saldos sube 110.000',
  1_110_000,
  engine.calculateMonth(afterDelete, '2026-10').balanceMinor,
);

edited.transactions = edited.transactions.filter(
  (tx) => tx.id !== 'cobro-freelance',
);
const afterIncomeDelete = engine.calculateMonth(
  toLedger(edited, '2026-10'),
  '2026-10',
);
check(
  'Borrar ingreso: Listo para asignar oct 48.200 − 44.550',
  3_650,
  afterIncomeDelete.readyToAssignMinor,
);
check(
  'Invariante tras editar y borrar',
  afterIncomeDelete.balanceMinor -
    afterIncomeDelete.availableMinor -
    afterIncomeDelete.futureAssignedMinor,
  afterIncomeDelete.readyToAssignMinor,
);

// --- Atribución por zona horaria del plan -----------------------------------------------
section('Atribución de mes en la zona del plan');
check(
  '30/09 23:30 (Buenos Aires) = 2026-10-01T02:30Z',
  '2026-09',
  monthOfInstant(new Date('2026-10-01T02:30:00Z'), CANONICAL_TIME_ZONE),
);

// --- Rendimiento: 2.000 transacciones -----------------------------------------------------
section('Rendimiento (PRD §7: < 100 ms con 2.000 transacciones)');
const large: PlanLedger = {
  currentMonth: '2026-09',
  envelopeIds: [...ENVELOPES],
  balanceMovements: [],
  assignments: [],
  spending: [],
};
for (let i = 0; i < 24; i++) {
  const month = addMonths('2024-10', i);
  large.balanceMovements.push({ month, amountMinor: 900_000 });
  for (const envelopeId of ENVELOPES) {
    large.assignments.push({ envelopeId, month, amountMinor: 70_000 });
  }
}
for (let i = 0; i < 2_000; i++) {
  const month = addMonths('2024-10', i % 24);
  const envelopeId = ENVELOPES[i % ENVELOPES.length];
  large.balanceMovements.push({ month, amountMinor: -3_250 });
  large.spending.push({ envelopeId, month, amountMinor: 3_250 });
}
const started = performance.now();
engine.calculateMonth(large, '2026-09');
const elapsed = performance.now() - started;
const fast = elapsed < 100;
if (!fast) mismatches++;
console.log(
  `  ${fast ? 'OK      ' : 'MISMATCH'}  ${'Cálculo de un mes'.padEnd(56)} esperado < 100 ms       calculado ${elapsed.toFixed(2)} ms`,
);

console.log(
  mismatches === 0
    ? '\nTodos los escenarios cuadran.'
    : `\n${mismatches} valor(es) no cuadran.`,
);
process.exitCode = mismatches === 0 ? 0 : 1;
