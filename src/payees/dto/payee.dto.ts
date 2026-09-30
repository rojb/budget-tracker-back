import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Payee } from '../entities/payee.entity.js';

export class PayeeDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Coto' })
  name!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Envelope proposed when this payee is chosen; absent when there is none.',
  })
  suggestedEnvelopeId?: string;

  @ApiProperty({
    type: 'integer',
    minimum: 0,
    description: 'Transactions that reference this payee.',
  })
  transactionCount!: number;

  @ApiProperty()
  deleted!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  static fromEntity(payee: Payee, transactionCount: number): PayeeDto {
    const dto = new PayeeDto();
    dto.id = payee.id;
    dto.name = payee.name;
    if (payee.suggestedEnvelopeId) {
      dto.suggestedEnvelopeId = payee.suggestedEnvelopeId;
    }
    dto.transactionCount = transactionCount;
    dto.deleted = payee.deletedAt !== null;
    dto.createdAt = payee.createdAt.toISOString();
    return dto;
  }
}

export class PayeePageDto {
  @ApiProperty({ type: 'integer', minimum: 1 })
  page!: number;

  @ApiProperty({ type: 'integer', minimum: 1, maximum: 100 })
  pageSize!: number;

  @ApiProperty({
    type: 'integer',
    minimum: 0,
    description: 'Count of all matching items across pages.',
  })
  total!: number;

  @ApiProperty({ type: [PayeeDto] })
  items!: PayeeDto[];
}
