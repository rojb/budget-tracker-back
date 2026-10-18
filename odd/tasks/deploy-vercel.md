# Feature: deploy-vercel

## Objective
Make the API deployable on Vercel (NestJS zero-config Function) with a managed Postgres (Neon).

## Problem / Why
- The TypeORM connection has no `ssl` option; managed Postgres providers require TLS.
- Goal photos (FR-41) are written under `PHOTOS_DIR` on local disk; the Vercel filesystem is read-only (only an ephemeral `/tmp`), so uploads fail or are lost.

## Scope
- Opt-in TLS for the database connection (app + migrations data source).
- A photo storage port with a local-disk adapter (current behavior, default) and a Vercel Blob adapter, selected by configuration.
- Suggested photos (`assets/suggested-photos/`) must be bundled into the Vercel Function.
- README deploy section.

## Constraints
- Photos stay served only through the authenticated controller (`GET .../photo`); no public static mount, no change to the API contract.
- Local development keeps working without new env vars (defaults: no TLS, local disk).
- No test runner in the project: TDD off (source: package.json has no test script). Checks: `npm run build`, `npm run lint`.
- RDD: off (global). Delivery strategy: ask-on-risk.

## Tasks
- [x] T1 â€” `DATABASE_SSL` (boolean, default false) in env validation; pass `ssl` to `TypeOrmModule` and `data-source.ts`. Route: delegated (writer, part of a 2+ file unit).
- [x] T2 â€” Extract a `PhotoStorage` port (put/get/delete by key) with `LocalPhotoStorage` (current disk logic); `EnvelopePhotosService` depends on the port. No behavior change. Route: delegated.
- [ ] T3 â€” `BlobPhotoStorage` using `@vercel/blob`; `PHOTOS_STORAGE=local|blob` + `BLOB_READ_WRITE_TOKEN` (required when blob); ensure suggested photos are included in the Vercel bundle; README deploy section. Route: delegated.

## Acceptance criteria
- `npm run build` and `npm run lint` pass after each task.
- With defaults, behavior is identical to today.
- With `PHOTOS_STORAGE=blob`, upload/get/delete/suggested work through Blob, and the controller still streams the bytes.

## Progress / Evidence
- T1: f879a8d — build ok, lint ok
- T2: see git log (`refactor(envelopes): extract PhotoStorage port`) — build ok, lint ok

## Next step
T3.
