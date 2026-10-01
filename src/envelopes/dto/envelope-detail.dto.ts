import { ApiProperty } from '@nestjs/swagger';
import { TransactionDto } from '../../transactions/dto/transaction.dto.js';
import { EnvelopeMoveDto } from './envelope-move.dto.js';
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
      'Transactions of the month with a portion on the envelope, newest first by `createdAt` (ties by id), at most 100.',
  })
  activity!: TransactionDto[];

  @ApiProperty({
    type: 'integer',
    minimum: 0,
    description:
      'Number of transactions of the month with a portion on the envelope.',
  })
  activityTotal!: number;

  @ApiProperty({
    type: [EnvelopeMoveDto],
    description:
      'Moves of money between envelopes made for the month in which the envelope was the source or the destination, newest first by `createdAt` (ties by id), at most 100. A client shows them with `activity`, merged by `createdAt`. They are history only and never count in `line.spentMinor`.',
  })
  moves!: EnvelopeMoveDto[];

  @ApiProperty({
    type: 'integer',
    minimum: 0,
    description:
      'Number of moves of the month in which the envelope was the source or the destination.',
  })
  movesTotal!: number;
}
