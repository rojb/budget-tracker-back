import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, type EntityManager, type Repository } from 'typeorm';
import { EnvelopeMove } from './entities/envelope-move.entity.js';

// Most moves listed in the detail of an envelope for one month.
export const MOVES_PAGE_SIZE = 100;

// The history of the moves of money between envelopes (add-envelope-move-history). Only the detail
// of an envelope reads it; no figure is computed from it.
@Injectable()
export class EnvelopeMovesService {
  constructor(
    @InjectRepository(EnvelopeMove)
    private readonly moves: Repository<EnvelopeMove>,
  ) {}

  // Records a move with the manager of the transaction that changes the assignments, so the row
  // exists if and only if the assignments changed.
  async record(
    manager: EntityManager,
    move: {
      planId: string;
      month: string;
      amountMinor: number;
      from: { id: string; name: string };
      to: { id: string; name: string };
    },
  ): Promise<void> {
    await manager.insert(EnvelopeMove, {
      planId: move.planId,
      fromEnvelopeId: move.from.id,
      toEnvelopeId: move.to.id,
      fromEnvelopeName: move.from.name,
      toEnvelopeName: move.to.name,
      amountMinor: move.amountMinor,
      month: move.month,
    });
  }

  // The moves made for the month in which the envelope was the source or the destination, newest
  // first by registration instant (ties by id), with how many there are in all.
  async forEnvelope(
    planId: string,
    envelopeId: string,
    month: string,
  ): Promise<{ items: EnvelopeMove[]; total: number }> {
    const [items, total] = await this.moves
      .createQueryBuilder('move')
      .where('move.planId = :planId AND move.month = :month', {
        planId,
        month,
      })
      .andWhere(
        '(move.fromEnvelopeId = :envelopeId OR move.toEnvelopeId = :envelopeId)',
        { envelopeId },
      )
      .orderBy('move.createdAt', 'DESC')
      .addOrderBy('move.id', 'DESC')
      .take(MOVES_PAGE_SIZE)
      .getManyAndCount();
    return { items, total };
  }

  // After an envelope is deleted its moves keep the other envelope; those whose two envelopes are
  // gone explain nothing and are removed.
  async discardOrphans(planId: string): Promise<void> {
    await this.moves.delete({
      planId,
      fromEnvelopeId: IsNull(),
      toEnvelopeId: IsNull(),
    });
  }
}
