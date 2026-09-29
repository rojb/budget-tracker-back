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

## Scripts principales

| Script | Qué hace |
|---|---|
| `npm run start:dev` | Levanta la app en modo watch |
| `npm run build` | Compila TypeScript a `dist/` |
| `npm run lint` | Corre `oxlint` sobre `src/` |
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
