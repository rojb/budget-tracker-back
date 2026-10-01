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
- **Saldo derivado.** `AccountsService.balances(planId)` calcula saldo inicial + transferencias +
  transacciones (`add-transactions` llena ese método, `monthlyFlows` y `ledgerBalanceMovements` a
  través de `TransactionLedgerService`). `ledgerBalanceMovements(planId, timeZone)` devuelve para el
  `PlanLedger` del motor los saldos iniciales, las transferencias y las transacciones de las cuentas
  no archivadas.
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
  nombre o lo crea: lo usa `add-transactions` cuando un movimiento trae `payeeName` (alta al primer
  uso).
- `transactionCounts(planId)` cuenta las transacciones por beneficiario (`GROUP BY payee_id` en
  `TransactionLedgerService`, también los borrados). `suggested_envelope_id` tiene FK a `envelopes`
  (`ON DELETE SET NULL`, cambio `add-envelopes`) y el servicio valida que el sobre sea del plan (otro
  plan → 404).

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

## Transferencias entre cuentas

Cambio `add-account-transfers` (RRG-55). Tabla `account_transfers` del módulo `accounts` (no usa
sobres ni beneficiarios, FR-28).

| Endpoint | Rol | Qué hace |
|---|---|---|
| `GET /plans/:planId/transfers?accountId&page&pageSize` | miembro | Transferencias, más nuevas primero; con `accountId`, las que salen o entran a esa cuenta |
| `POST /plans/:planId/transfers` | `owner`, `editor` | Mueve `amountMinor` (> 0) de `fromAccountId` a `toAccountId` en `occurredAt`; misma cuenta → 400, archivada → 409, de otro plan → 404 |
| `DELETE /plans/:planId/transfers/:transferId` | `owner`, `editor` | Borra la transferencia y restaura ambos saldos |

- `AccountsService.balances` ya suma transferencias (entrantes +, salientes −); `monthlyFlows`
  (Entró/Salió de la pantalla 14) las cuenta por mes en la zona horaria del plan, y
  `ledgerBalanceMovements` agrega el lado de cada transferencia que toca una cuenta activa (entre
  dos activas el total no cambia).
- Las transferencias no son transacciones: `GET /transactions` no las lista y la pantalla 14 las
  junta con los movimientos en el cliente.

## Sobres y grupos

Cambio `add-envelopes` (RRG-47). Módulo `src/envelopes/` (FR-04).

| Endpoint | Rol | Qué hace |
|---|---|---|
| `GET /envelope-template` | cualquier sesión | Plantilla sugerida: 4 grupos y 12 sobres con su ícono, igual para todos los planes |
| `GET /plans/:planId/envelope-groups` | miembro | Grupos en orden, con su cantidad de sobres |
| `POST /plans/:planId/envelope-groups` | `owner`, `editor` | Crea un grupo al final; nombre repetido (sin distinguir mayúsculas) → 409 |
| `PATCH /plans/:planId/envelope-groups/:groupId` | `owner`, `editor` | Renombra (409 si el nombre ya existe) |
| `DELETE /plans/:planId/envelope-groups/:groupId` | `owner`, `editor` | Borra el grupo; sus sobres quedan «Sin grupo» (al final, sin perder asignaciones) |
| `PUT /plans/:planId/envelope-groups/order` | `owner`, `editor` | Ordena: `groupIds` debe traer todos los grupos una vez (si no, 400) |
| `POST /plans/:planId/envelope-groups/template` | `owner`, `editor` | Crea los sobres de la plantilla (todos o `envelopeNames`) sin monto; solo en un plan sin sobres (409) |
| `GET /plans/:planId/envelopes?month` | miembro | Sobres en orden con `assignedMinor`/`spentMinor`/`availableMinor` del mes y el `readyToAssignMinor` |
| `POST /plans/:planId/envelopes` | `owner`, `editor` | Crea un sobre (`groupId` e `icon` opcionales) al final de su grupo |
| `GET` · `PATCH` · `DELETE /plans/:planId/envelopes/:envelopeId` | miembro · `owner`, `editor` | Detalle; renombra, cambia ícono o mueve de grupo; borra |
| `PUT /plans/:planId/envelopes/order` | `owner`, `editor` | Ordena los sobres de un grupo (`groupId`) o los sin grupo |
| `POST /plans/:planId/envelopes/initial-assignment` | `owner`, `editor` | Asignación masiva (pantalla 46): una asignación por sobre y mes, todo o nada; devuelve el Listo para asignar, que puede ser negativo |

- **Orden.** `position` entero por alcance (los grupos del plan, los sobres de un grupo, los sobres
  sin grupo); las listas ordenan por `position` y las altas toman `max + 1`. Borrar un grupo manda
  sus sobres al final de los sin grupo y renumera los grupos restantes.
- **FKs pendientes.** La migración `CreateEnvelopes` agrega `FK_assignments_envelope` (`ON DELETE
  CASCADE`: al borrar un sobre se van sus asignaciones y su disponible vuelve a Listo para asignar) y
  `FK_payees_suggested_envelope` (`ON DELETE SET NULL`).
- **Cifras.** `EnvelopesService.ledger(plan)` arma el `PlanLedger` (saldos de
  `AccountsService.ledgerBalanceMovements`, asignaciones de `AssignmentsService.ledgerRows`) y
  `list` llama a `CalculationService.calculateMonth`. `spending` sale de
  `TransactionLedgerService.spending` (`add-transactions`); un sobre borrado deja sus porciones sin
  sobre (`transaction_splits.envelope_id` con `ON DELETE SET NULL`, «Sin sobre»).
- **Asignación masiva.** `AssignmentsService.setAssignments` (nuevo, aditivo) hace el mismo upsert
  que `setAssignment` para varias filas en una transacción. El endpoint por sobre y mes y la vista
  del mes son de `add-monthly-assignment`.
- Autorización con `PlanAccessService` (404 si no sos miembro, 403 si sos `viewer` y escribís).

## Movimientos

Cambio `add-transactions` (RRG-49). Módulo `src/transactions/` (FR-06, FR-07, FR-08, FR-14).

| Endpoint | Rol | Qué hace |
|---|---|---|
| `POST /plans/:planId/transactions` | `owner`, `editor` | Registra un gasto o ingreso: `direction`, `accountId`, `amountMinor` (> 0), `occurredAt` (con offset) y opcionales `payeeId` o `payeeName`, `description`, `envelopeId` o `splits` |
| `GET /plans/:planId/transactions?accountId&payeeId&envelopeId&direction&from&to&timeFrom&timeTo&q&page&pageSize` | miembro | Movimientos no eliminados, más nuevos primero (`occurredAt`, luego alta), paginados y filtrados; la respuesta trae `summary` (`outflowMinor`, `inflowMinor`) |
| `PUT /plans/:planId/transactions/:transactionId` | `owner`, `editor` | Edita: reemplaza todos los campos editables y las porciones con el mismo cuerpo que el alta; responde `{ transaction, affectedMonths }` |
| `DELETE /plans/:planId/transactions/:transactionId` | `owner`, `editor` | Baja lógica (`deleted_at`); responde `{ affectedMonths }` |
| `POST /plans/:planId/transactions/:transactionId/restore` | `owner`, `editor` | Deshace la baja: devuelve la misma transacción (mismo `id`, alta, porciones); responde `{ transaction, affectedMonths }` |

- **Destino.** Un gasto lleva `envelopeId` o `splits` (2 a 20 porciones que suman exactamente
  `amountMinor`, si no 400); un ingreso lleva `envelopeId` o nada, y sin sobre va a Listo para
  asignar. `splits` en un ingreso, `envelopeId` con `splits` o `payeeId` con `payeeName` → 400.
  Cuenta archivada → 409; cuenta, sobre o beneficiario de otro plan (o borrado) → 404.
- **Modelo.** `transactions` + `transaction_splits`: toda transacción tiene al menos una porción; un
  ingreso a Listo para asignar es una porción sin sobre, y borrar un sobre deja sus porciones con
  `envelope_id NULL` («Sin sobre», sin actividad para ningún sobre). La cuenta y el beneficiario no
  se borran (se archivan / dan de baja lógica), así que sus FKs no tienen cascada; borrar el plan
  borra todo.
- **Lectura.** `TransactionLedgerService` (`TransactionLedgerModule`, módulo hoja sin dependencias)
  es el único que conoce el signo (ingreso +, gasto −) y el mes en la zona del plan
  (`to_char(occurred_at AT TIME ZONE plan.time_zone, 'YYYY-MM')`). Alimenta tres lugares:
  `AccountsService` (`balances`, `ledgerBalanceMovements`, `monthlyFlows`), `EnvelopesService.ledger`
  (`spending`, por lo que el motor de cálculo no cambia) y `PayeesService.transactionCounts`.
- **Alta del beneficiario.** `payeeName` llama a `PayeesService.findOrCreate`: reutiliza el activo
  con ese nombre (sin distinguir mayúsculas) o lo crea.
- **Edición (`add-transaction-editing-and-filters`).** `PUT` en vez de `PATCH`: el cuerpo es el de
  `POST` y reemplaza el estado completo (se puede quitar beneficiario, descripción o sobre sin
  `null`), por lo que deshacer una edición es reenviar el estado anterior; `id` y `created_at` no
  cambian. Se hace en una sola transacción de base de datos (fila + porciones). La cuenta (409 si
  está archivada) y el beneficiario (404 si fue borrado) solo se validan si cambian, así una cuenta
  archivada o un beneficiario borrado no impiden editar el resto. Misma validación estructural del
  alta (suma exacta de porciones → 400).
- **Baja y deshacer.** `DELETE` solo marca `transactions.deleted_at`; todos los lectores de hechos
  (`TransactionLedgerService` y el listado) ignoran las filas con `deleted_at`, por lo que saldos,
  Available y Listo para asignar quedan como si nunca hubiera existido, y `restore` vuelve a dejarla
  idéntica. Eliminar dos veces o restaurar una viva → 404. Revertir la migración hace reaparecer las
  eliminadas.
- **Recálculo.** No hay agregados guardados ni caché (el motor calcula por consulta), así que editar,
  eliminar o restaurar no invalida nada: la próxima lectura de cualquier mes ya es el recálculo.
  `affectedMonths` lista, en la zona del plan, desde el mes más antiguo que tocó la transacción
  (antes o después del cambio) hasta el mayor entre el mes actual y el más reciente que tocó.
- **Filtros.** `from`/`to` (fecha local `YYYY-MM-DD`, inclusivos), `timeFrom`/`timeTo` (`HH:mm`
  local, inclusivos al minuto, en cualquier fecha; si `timeFrom > timeTo` el rango cruza la
  medianoche), `payeeId`, `accountId`, `direction`, `envelopeId` (alguna porción en ese sobre) y `q`
  (sin distinguir mayúsculas: beneficiario, descripción o nombre del sobre de alguna porción). Se
  combinan con AND; `from` posterior a `to` → 400. `summary` suma, con el monto completo, todas las
  transacciones que cumplen el filtro (no solo la página).

## Metas, estados y fotos de sobres

Cambio `add-envelope-goals` (RRG-52). Mismo módulo `src/envelopes/` (FR-19, FR-20, FR-24, FR-25, FR-41).

| Endpoint | Rol | Qué hace |
|---|---|---|
| `PUT /plans/:planId/envelopes/:envelopeId/goal` | `owner`, `editor` | Fija o reemplaza la meta: `{ type: monthly \| targetByDate, targetMinor, dueDate? }` |
| `DELETE /plans/:planId/envelopes/:envelopeId/goal` | `owner`, `editor` | Quita la meta (200 también si no tenía) |
| `GET /plans/:planId/envelopes/:envelopeId/detail?month` | miembro | Línea del mes (cifras, `state`, `goalStatus`), `carryoverMinor` y la actividad del mes (hasta 100 movimientos con una porción en el sobre) |
| `POST /plans/:planId/envelopes/move` | `owner`, `editor` | Mueve `amountMinor` de un sobre a otro dentro de un mes, sin transacción |
| `POST /plans/:planId/envelopes/:envelopeId/photo` | `owner`, `editor` | Sube la foto (`multipart/form-data`, campo `file`) |
| `GET /plans/:planId/envelopes/:envelopeId/photo` | miembro | Devuelve la foto (`image/jpeg`); 404 si no hay o no sos miembro |
| `DELETE /plans/:planId/envelopes/:envelopeId/photo` | `owner`, `editor` | Quita la foto y borra el archivo |
| `POST /plans/:planId/envelopes/:envelopeId/photo/suggested` | `owner`, `editor` | Usa una foto sugerida (`vacaciones`, `auto`, `emergencia`, `mudanza`) |
| `GET /envelope-photo-suggestions` · `/:suggestionId/image` | cualquier sesión | Las cuatro fotos sugeridas y su imagen |

`POST /plans/:planId/envelopes` acepta además `goal`, y las líneas de `GET /plans/:planId/envelopes`
traen `state` y, con meta, `goalStatus`.

- **Meta.** Columnas `goal_*` de `envelopes` (0..1 por sobre, siempre se leen con él): solo la
  intención del usuario. Una meta `monthly` no lleva `dueDate`; una `targetByDate` la exige, en el mes
  actual o después (400 si no). Lo derivado nunca se guarda.
- **Una sola definición (`src/envelopes/goal-status.ts`, módulo puro).** Monto requerido del mes:
  `monthly` = la meta; `targetByDate` = `ceil(max(0, meta − arrastre) / N)`, con `N` = meses del mes
  visto al del vencimiento, ambos incluidos, mínimo 1. `state`: `overspent` si Available < 0; si no
  `underfunded` cuando hay meta y lo asignado en el mes es menor que el requerido; si no `funded`.
  El listado, el detalle y el resultado de mover dinero lo usan; el cliente no recalcula nada.
- **Mover dinero.** `AssignmentsService.shiftAssignments` suma `−monto` y `+monto` a las asignaciones
  del mes en una sola sentencia y transacción (`ON CONFLICT DO UPDATE ... + EXCLUDED`), así Listo
  para asignar no cambia. El monto no puede superar el Available del origen en ese mes (arrastre
  incluido): si lo supera, o el origen no tiene dinero, 409; mismo sobre o monto no entero/≤ 0, 400.
- **Fotos.** Hasta 5 MB (413). El tipo lo decide el contenido (firma JPEG/PNG/WebP), no el nombre ni
  el `Content-Type`; cualquier otra cosa, o un archivo que no se puede decodificar, 415. `sharp` aplica
  la orientación, quita metadatos y guarda un JPEG de a lo sumo 1.080 px de ancho (no agranda). Los
  archivos viven en `PHOTOS_DIR` (por defecto `storage/photos`, validado con Joi, ignorado por git)
  como `<plan>/<sobre>-<hex>.jpg`; reemplazar o quitar la foto, o borrar el sobre, borra el archivo.
  La foto se sirve solo por `GET .../photo` con bearer y membresía (no hay carpeta estática): el
  cliente la pide con el header `Authorization`. `photoUrl` es una ruta relativa con `?v=` que cambia
  con cada foto.
- **Fotos sugeridas.** Las cuatro de `design/photos` están en `assets/suggested-photos/` y pasan por el
  mismo redimensionado al elegirlas.

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
