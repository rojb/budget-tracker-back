import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { EnvelopeMove } from '../entities/envelope-move.entity.js';

const MONTH_PATTERN = '^\\d{4}-(0[1-9]|1[0-2])$';

export const MOVE_DIRECTIONS = ['in', 'out'] as const;
export type MoveDirection = (typeof MOVE_DIRECTIONS)[number];

// One recorded move of money, seen from the envelope of the detail (FR-24, screen 22).
export class EnvelopeMoveDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    enum: MOVE_DIRECTIONS,
    description:
      '`out` when the envelope was the source (money left it), `in` when it was the destination.',
  })
  direction!: MoveDirection;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'The other envelope; absent when it was deleted afterwards.',
  })
  counterpartId?: string;

  @ApiProperty({
    description:
      'Name of the other envelope (the name it had when it was deleted, if it no longer exists).',
  })
  counterpartName!: string;

  @ApiProperty({ type: 'integer', minimum: 1, example: 10000 })
  amountMinor!: number;

  @ApiProperty({
    pattern: MONTH_PATTERN,
    description: 'The month the move was made for.',
  })
  month!: string;

  @ApiProperty({
    type: 'string',
    format: 'date-time',
    description: 'Registration instant of the move.',
  })
  createdAt!: Date;

  // `liveNames` maps the ids of the plan's existing envelopes to their current name, so a renamed
  // counterpart shows its new name; a deleted one keeps the name stored with the move.
  static build(
    move: EnvelopeMove,
    envelopeId: string,
    liveNames: ReadonlyMap<string, string>,
  ): EnvelopeMoveDto {
    const out = move.fromEnvelopeId === envelopeId;
    const counterpartId = out ? move.toEnvelopeId : move.fromEnvelopeId;
    const dto = new EnvelopeMoveDto();
    dto.id = move.id;
    dto.direction = out ? 'out' : 'in';
    if (counterpartId) {
      dto.counterpartId = counterpartId;
    }
    dto.counterpartName =
      (counterpartId ? liveNames.get(counterpartId) : undefined) ??
      (out ? move.toEnvelopeName : move.fromEnvelopeName);
    dto.amountMinor = move.amountMinor;
    dto.month = move.month;
    dto.createdAt = move.createdAt;
    return dto;
  }
}
