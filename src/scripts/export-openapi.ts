import { writeFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';

// The env schema validates DATABASE_* at import time. The export never connects
// to the database (preview mode), so placeholders are enough when .env is absent.
process.env.DATABASE_HOST ??= 'localhost';
process.env.DATABASE_PORT ??= '5432';
process.env.DATABASE_USER ??= 'openapi';
process.env.DATABASE_PASSWORD ??= 'openapi';
process.env.DATABASE_NAME ??= 'openapi';

const { AppModule } = await import('../app.module.js');
const { buildOpenApiDocument } = await import('../openapi.js');

// preview: true builds the module graph and routes without instantiating
// providers, so TypeORM never opens a connection.
const app = await NestFactory.create(AppModule, {
  preview: true,
  logger: false,
});
const document = buildOpenApiDocument(app);
const output = process.argv[2] ?? 'openapi.generated.json';
writeFileSync(output, `${JSON.stringify(document, null, 2)}\n`);
console.log(`OpenAPI spec written to ${output}`);
await app.close();
