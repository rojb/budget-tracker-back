import { Injectable } from '@nestjs/common';
import type { HealthStatus } from './health-status.dto.js';

@Injectable()
export class AppService {
  getHealth(): HealthStatus {
    return { status: 'ok' };
  }
}
