import { ApiProperty } from '@nestjs/swagger';

export class HealthStatus {
  @ApiProperty({ enum: ['ok'] })
  status!: 'ok';
}
