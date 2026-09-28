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

## Scripts principales

| Script | Qué hace |
|---|---|
| `npm run start:dev` | Levanta la app en modo watch |
| `npm run build` | Compila TypeScript a `dist/` |
| `npm run lint` | Corre `oxlint` sobre `src/` |
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
