import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { EnvelopeMove } from './entities/envelope-move.entity.js';

// The history of the moves of money between envelopes (add-envelope-move-history). Only the detail
// of an envelope reads it; no figure is computed from it.
@Injectable()
export class EnvelopeMovesService {
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
}
