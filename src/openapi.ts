import type { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from '@nestjs/swagger';

// Single source of the OpenAPI document metadata, shared by main.ts (Swagger UI)
// and scripts/export-openapi.ts (contract drift check).
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Budget Tracker API')
    .setVersion('0.1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'bearerAuth',
    )
    // Bearer auth is the default for every operation; public endpoints opt out
    // with @ApiSecurity([]) (see contract conventions).
    .addSecurityRequirements('bearerAuth')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  markPublicOperations(document);
  return document;
}

// @ApiSecurity({}) is the only way to mark an operation public in @nestjs/swagger, and it emits
// `security: [{}]` (optional auth). The contract uses `security: []` (no auth), so normalize it.
function markPublicOperations(document: OpenAPIObject): void {
  for (const pathItem of Object.values(document.paths)) {
    for (const operation of Object.values(pathItem) as Array<
      { security?: Array<Record<string, unknown>> } | undefined
    >) {
      if (
        Array.isArray(operation?.security) &&
        operation.security.length > 0 &&
        operation.security.every((req) => Object.keys(req).length === 0)
      ) {
        operation.security = [];
      }
    }
  }
}
