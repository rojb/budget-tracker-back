import { ApiProperty } from '@nestjs/swagger';
import { TransactionDto } from '../../transactions/dto/transaction.dto.js';
import { EnvelopeLineDto } from './envelope.dto.js';

const MONTH_PATTERN = '^\\d{4}-(0[1-9]|1[0-2])$';

// One envelope with the figures and the activity of a month (FR-24, screen 22).
export class EnvelopeDetailDto {
  @ApiProperty({ pattern: MONTH_PATTERN, example: '2026-09' })
  month!: string;

  @ApiProperty({ type: EnvelopeLineDto })
  line!: EnvelopeLineDto;

  @ApiProperty({
    type: 'integer',
    description: 'Positive Available carried into the month.',
  })
  carryoverMinor!: number;

  @ApiProperty({
    type: [TransactionDto],
    description:
      'Transactions of the month with a portion on the envelope, newest first, at most 100.',
  })
  activity!: TransactionDto[];

  @ApiProperty({
    type: 'integer',
    minimum: 0,
    description:
      'Number of transactions of the month with a portion on the envelope.',
  })
  activityTotal!: number;
}
