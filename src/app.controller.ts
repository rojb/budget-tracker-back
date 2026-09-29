import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service.js';
import { Public } from './auth/public.decorator.js';
import { HealthStatus } from './health-status.dto.js';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @ApiOperation({ operationId: 'getHealth', summary: 'Liveness check' })
  // Public endpoint: opts out of the global AuthGuard and exports as `security: []`.
  @Public()
  @ApiOkResponse({ description: 'The service is up.', type: HealthStatus })
  getHealth(): HealthStatus {
    return this.appService.getHealth();
  }
}
