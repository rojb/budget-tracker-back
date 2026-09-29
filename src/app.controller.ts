import { Controller, Get } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { AppService } from './app.service.js';
import { HealthStatus } from './health-status.dto.js';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @ApiOperation({ operationId: 'getHealth', summary: 'Liveness check' })
  // Public endpoint: opts out of the global bearer auth (exported as `security: []`, see openapi.ts).
  @ApiSecurity({})
  @ApiOkResponse({ description: 'The service is up.', type: HealthStatus })
  getHealth(): HealthStatus {
    return this.appService.getHealth();
  }
}
