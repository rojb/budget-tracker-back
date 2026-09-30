# budget-tracker-back

Backend de `budget-tracker` (envelope-method / zero-based budgeting), construido con NestJS +
TypeORM sobre PostgreSQL. Servidor autoritativo del dominio: define y valida las reglas de
presupuesto; el frontend (Flutter) las consume vía la API HTTP documentada en
`openapi.yaml` (repo `budget-tracker-specs`).

## Requisitos

- Node.js 22
- npm
- Docker + Docker Compose (Postgres local)

## Setup

```bash
cp .env.example .env
docker compose up -d
npm ci
npm run migration:run
npm run start:dev
```

`GET /health` responde `{ "status": "ok" }` una vez que la app arrancó y se conectó a la base.

## Autenticación

Cambio `add-auth` (RRG-44). Sesión con un único JWT de acceso (`Authorization: Bearer <token>`),
sin refresh token; el logout es del lado del cliente (borrar el token).

| Endpoint | Acceso | Qué hace |
|---|---|---|
| `POST /auth/register` | público | Crea la cuenta (`name`, `email`, `password` de 8 a 128) y devuelve `{ accessToken, user }` (201); email duplicado → 409 |
| `POST /auth/login` | público | Devuelve `{ accessToken, user }` (200); cualquier fallo de credenciales → 401 con un mensaje genérico |
| `GET /users/me` | bearer | Devuelve el usuario de la sesión |
| `GET /health` | público | Liveness |

Variables de entorno (validadas con Joi; sin `JWT_SECRET` la app no arranca):

- `JWT_SECRET`: secreto de firma, mínimo 32 caracteres.
- `JWT_EXPIRES_IN`: duración del token, por defecto `7d`.

Detalles de diseño:

- Los emails se guardan en minúsculas (con `CHECK` en la base) y son únicos.
- Las contraseñas se guardan solo como hash Argon2id (19 MiB, 2 iteraciones, 1 hilo); nunca se
  devuelven ni se loguean.
- `AuthGuard` es global (`APP_GUARD`): todo endpoint exige un token válido salvo que lleve
  `@Public()` (de `src/auth/public.decorator.ts`, que también lo marca público en el spec). Un
  endpoint nuevo sin decorador queda protegido.
- El algoritmo del JWT está fijado a HS256 al firmar y al verificar (`src/auth/auth.module.ts`):
  un token firmado con otro algoritmo (aunque use el mismo secreto) o con `alg: none` responde 401.
- Trade-off aceptado: sin refresh token, un token robado vale hasta que expire (alcance
  académico, sin despliegue).

## Motor de cálculo del presupuesto

Cambio `add-budget-calc-engine` (RRG-45). Módulo `src/budget/`, sin endpoints propios: lo
consumen `add-envelopes`, `add-transactions` y `add-monthly-assignment`.

- **Hechos, no agregados.** Las tablas `budget_months` y `assignments` guardan solo asignaciones
  (una por sobre y mes, puede ser negativa). `Available`, `Carryover` y `ReadyToAssign` se
  calculan en cada consulta (FR-11); no hay columnas derivadas.
- **FKs pendientes.** `budget_months.plan_id` y `assignments.envelope_id` no tienen FK todavía:
  las agregan `add-plans-and-accounts` y `add-envelopes` cuando crean `plans` y `envelopes`.
- **`CalculationService` es puro.** Recibe un `PlanLedger` (`src/budget/calculation.types.ts`)
  con los hechos ya atribuidos a meses y no toca la base:
  - `balanceMovements`: saldo inicial de cada cuenta no archivada (en su mes de apertura) y cada
    transacción sobre ella (ingreso +, gasto −, transferencia entrante + / saliente −).
  - `assignments`: lo que devuelve `AssignmentsService.ledgerRows(planId)`.
  - `spending`: salida neta por sobre y mes (gasto o porción de división +, ingreso directo al
    sobre −). Ni los ingresos a *Listo para asignar* ni las transferencias van acá.
  - `currentMonth`: `currentMonth(plan.timeZone)`; para atribuir una transacción a su mes se usa
    `monthOfInstant(instante, plan.timeZone)` (`src/budget/month-key.ts`).
- `calculateMonth(ledger, 'YYYY-MM')` devuelve por sobre `assigned/carryover/spent/available` y
  los totales (`balance`, `available`, `futureAssigned`, `overspentSettled`, `readyToAssign`).
  Para meses posteriores al actual, `readyToAssign` es el del mes actual (el sobregiro del mes en
  curso se salda recién cuando termina).
- `closeMonth(ledger, 'YYYY-MM')` describe el cierre hacia el mes siguiente (pantalla 25): qué se
  arrastra, qué se descuenta y el *Listo para asignar* resultante.
- `AssignmentsService.setAssignment(planId, envelopeId, month, amountMinor)` reemplaza la
  asignación del sobre en ese mes (crea el `budget_month` si no existe).

### Escenarios KR1

Sin endpoints ni archivos de test, la verificación es reproducir los 3 escenarios de revisión
del docente con el dataset canónico (`odd/tasks/canonical-dataset.md` del repo de specs):

```bash
npm run calc:kr1
```

Imprime, para cada valor, el esperado y el calculado: asignación a mes futuro (48.200), cierre
septiembre → octubre (arrastres, −6.200 descontado, 42.000), edición y borrado de movimientos
pasados con recálculo, atribución de mes en la zona del plan y el tiempo de cálculo con 2.000
transacciones (< 100 ms). No usa base de datos ni corre en CI.

## Planes y cuentas

Cambio `add-plans-and-accounts` (RRG-46). Módulos `src/plans/` y `src/accounts/`.

| Endpoint | Rol | Qué hace |
|---|---|---|
| `GET /plans` | cualquier sesión | Planes de los que soy miembro, con moneda, zona horaria, mi rol y miembros |
| `POST /plans` | cualquier sesión | Crea el plan (quien lo crea queda `owner`) y, opcional, su primera cuenta, en una transacción |
| `GET /plans/:planId` | miembro | Detalle del plan |
| `PATCH /plans/:planId` | `owner` | Renombra; la moneda es inmutable (mandarla es un 400) |
| `DELETE /plans/:planId` | `owner` | Borra el plan y todo lo que cuelga de él (cascada) |
| `GET /plans/:planId/accounts?archived=` | miembro | Cuentas activas, o archivadas con `archived=true` |
| `POST /plans/:planId/accounts` | `owner`, `editor` | Crea una cuenta (`bank`, `digitalWallet`, `cash`) con saldo inicial |
| `GET /plans/:planId/accounts/:accountId?month=` | miembro | Cuenta + lo que entró y salió en el mes |
| `PATCH /plans/:planId/accounts/:accountId` | `owner`, `editor` | Edita nombre, tipo o saldo inicial |
| `POST /plans/:planId/accounts/:accountId/archive` · `/restore` | `owner`, `editor` | Archiva o restaura (409 si ya estaba así). No hay borrado |

- **Autorización por plan.** `PlanAccessService.require(planId, userId, roles)` (exportado por
  `PlansModule`) es lo primero que llama todo endpoint con `planId`: si no sos miembro → 404 (no
  revela qué planes existen); si tu rol no alcanza → 403. Roles en `src/plans/plan-role.ts`:
  `READ_ROLES` (todos), `WRITE_ROLES` (`owner`, `editor`), `OWNER_ROLES`. Los módulos futuros
  (sobres, beneficiarios, movimientos) importan `PlansModule` y usan lo mismo.
- **Saldo derivado.** `AccountsService.balances(planId)` calcula saldo inicial + movimientos; hoy,
  sin tabla de transacciones, es el saldo inicial. `add-transactions` extiende ese único método (y
  `monthlyFlows`) con sus filas. `ledgerBalanceMovements(planId, timeZone)` devuelve los saldos
  iniciales de las cuentas no archivadas para el `PlanLedger` del motor.
- La migración agrega la FK pendiente `budget_months.plan_id → plans`.

## Beneficiarios

Cambio `add-payees` (RRG-48). Módulo `src/payees/`.

| Endpoint | Rol | Qué hace |
|---|---|---|
| `GET /plans/:planId/payees?q&page&pageSize` | miembro | Beneficiarios activos por nombre, paginados; `q` filtra sin distinguir mayúsculas |
| `POST /plans/:planId/payees` | `owner`, `editor` | Crea; nombre repetido (ignorando mayúsculas) entre los activos → 409 |
| `GET /plans/:planId/payees/:payeeId` | miembro | Detalle, también de uno borrado (`deleted: true`) para que los movimientos viejos lo muestren |
| `PATCH /plans/:planId/payees/:payeeId` | `owner`, `editor` | Cambia nombre o sobre sugerido de uno activo |
| `DELETE /plans/:planId/payees/:payeeId` | `owner`, `editor` | Baja lógica (`deleted_at`): sale de la lista pero los movimientos pasados lo conservan (FR-05) |

- La unicidad la garantiza el índice parcial `UQ_payees_plan_name_active` (solo activos), así que
  después de borrar "Coto" se puede crear otro "Coto".
- `PayeesService.findOrCreate(planId, name)` (exportado) devuelve el beneficiario activo con ese
  nombre o lo crea: pensado para `add-transactions` (pantalla 26 y alta al primer uso).
- `transactionCounts(planId)` devuelve 0 para todos hasta que `add-transactions` lo reemplace por un
  `GROUP BY payee_id`. `suggested_envelope_id` no tiene FK todavía: la agrega `add-envelopes`.

## Planes compartidos

Cambio `add-plan-sharing` (RRG-53). Módulo `src/sharing/`.

| Endpoint | Quién | Qué hace |
|---|---|---|
| `GET /plans/:planId/invitation` | `owner` | Código activo (404 si no hay) |
| `POST /plans/:planId/invitation` | `owner` | Genera un código (`editor` o `viewer`), 24 h, un solo uso; revoca el anterior |
| `DELETE /plans/:planId/invitation` | `owner` | Revoca el código activo |
| `GET /invitations/:code` | cualquier sesión | Vista previa: plan, titular, moneda, rol, vencimiento (sin montos ni emails) |
| `POST /invitations/:code/accept` | cualquier sesión | Se une con el rol del código; 409 si ya es miembro o el plan tiene 5 |
| `PATCH /plans/:planId/members/:userId` | `owner` | Cambia el rol entre `editor` y `viewer` |
| `DELETE /plans/:planId/members/:userId` | `owner`, o el propio miembro | Quita a un miembro o sale del plan; la titular no puede salir (409) |

- Código de 6 caracteres sin ambiguos (`src/sharing/invitation-code.ts`), guardado sin guion y en
  mayúsculas; se acepta `k7m4qx` o `K7M-4QX`. El enlace del QR es `https://sobres.app/unirse/<CODE>`.
- Uso único: `accept` bloquea la fila (`SELECT ... FOR UPDATE`) en la misma transacción que la marca
  usada y crea la membresía; el índice parcial `UQ_plan_invitations_pending` deja un solo código
  pendiente por plan.

## Scripts principales

| Script | Qué hace |
|---|---|
| `npm run start:dev` | Levanta la app en modo watch |
| `npm run build` | Compila TypeScript a `dist/` |
| `npm run lint` | Corre `oxlint` sobre `src/` |
| `npm run calc:kr1` | Compila y reproduce los escenarios KR1 del motor de cálculo con el dataset canónico |
| `npm run openapi:export` | Compila y escribe `openapi.generated.json` (spec real de la API, sin base de datos; ignorado por git) |
| `npm run migration:generate` | Genera una migración TypeORM a partir de los cambios en las entidades |
| `npm run migration:run` | Aplica migraciones pendientes contra la base configurada en `.env` |
| `npm run migration:revert` | Revierte la última migración aplicada |

## Convención de módulos por feature

Arquitectura clásica de NestJS por feature, **no hexagonal**. Cada feature vive en su propia
carpeta bajo `src/`:

```
src/<feature>/
  <feature>.module.ts
  <feature>.controller.ts
  <feature>.service.ts
  dto/
  entities/
```

- Los **DTO** (`dto/`) son el contrato de la API: los controllers nunca devuelven entidades
  directamente, siempre DTOs.
- Las **entities** (`entities/`, TypeORM) modelan la base de datos y se registran con
  `TypeOrmModule.forFeature([...])` en el módulo del feature; `autoLoadEntities: true` en
  `AppModule` las conecta automáticamente a la conexión global.
- Los cambios de esquema van siempre por migración (`npm run migration:generate` /
  `migration:run`); `synchronize` está en `false`.

Este cambio (`scaffold-backend`, RRG-40) no crea ningún feature module — solo deja la
convención lista para el primer feature real.

## Sin archivos de test

Regla fija del equipo: este repo no contiene archivos de test de ningún tipo (`*.spec.ts`,
`*.test.ts`, carpeta `test/`). `nest-cli.json` tiene `generateOptions.spec: false`, así que
`nest generate` tampoco los reintroduce. La verificación de cada cambio es manual: build, lint,
`docker compose up` + arranque de la app, y Swagger UI/Prism contra `openapi.yaml` para la API
una vez que `api-contract-base` (RRG-42) esté integrado.

## Specs y contrato de API

Fuente de verdad del contrato y del proceso de trabajo:
[budget-tracker-specs](https://github.com/rojb/budget-tracker-specs) (OpenSpec, `openapi.yaml`,
`docs/COLABORACION.md`).

### Swagger UI

Con la app corriendo (fuera de `production`), la documentación interactiva está en
`http://localhost:3000/docs`. Los controllers se documentan con decoradores de `@nestjs/swagger`
(`@ApiTags`, `@ApiOkResponse`, `@ApiProperty` en los DTO); un endpoint público se marca con
`@Public()` (el resto exige bearer JWT por defecto).

### Chequeo de drift del contrato

El job `contract-drift` de CI (`.github/workflows/ci.yml`) clona `rojb/budget-tracker-specs` en el
commit fijado en `.contract-ref`, corre `npm run openapi:export` y ejecuta
`scripts/contract-drift.mjs`, que usa `oasdiff` con el contrato como base:

- Solo se comparan los paths que el back **ya implementa**; el contrato puede ir por delante.
- Falla si un endpoint implementado tiene un cambio incompatible respecto al contrato o si existe
  en el back pero no en el contrato.
- Los paths del contrato aún sin implementar se listan como aviso, sin fallar.
- Falla cerrado: si `oasdiff` no está o su salida no se puede interpretar, el script termina con
  error (códigos de salida: `0` sin drift, `1` drift, `2` el chequeo no pudo correr).
- CI verifica el SHA-256 del tarball de `oasdiff` (constante `OASDIFF_SHA256` del workflow, tomada
  del `checksums.txt` de la release) antes de extraerlo. Al subir `OASDIFF_VERSION` hay que
  actualizar también el hash.

### Contrato fijado (`.contract-ref`)

`.contract-ref` guarda el SHA completo del commit de `budget-tracker-specs` cuyo `openapi.yaml`
implementa este back. Como CI compara contra ese commit y no contra `main`, no se rompe cuando
specs avanza. Para subirlo, el commit del back que implementa la nueva versión del contrato lo
actualiza (procedimiento completo en `docs/COLABORACION.md` sección 4):

```bash
git -C ../budget-tracker-specs rev-parse main > .contract-ref
```

### Correr el drift en local

Requiere [oasdiff](https://github.com/oasdiff/oasdiff/releases) v1.32.1 en el `PATH` (o su ruta en
`OASDIFF`); sin él el script falla con un mensaje claro. Se compara contra el contrato del commit
fijado:

```bash
npm run openapi:export
git -C ../budget-tracker-specs show "$(cat .contract-ref):openapi.yaml" > contract.pinned.yaml
node scripts/contract-drift.mjs contract.pinned.yaml openapi.generated.json
```

(`contract.pinned.yaml` es un archivo temporal; no se commitea.)
