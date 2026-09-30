import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { Account } from '../accounts/entities/account.entity.js';
import { Envelope } from '../envelopes/entities/envelope.entity.js';
import { Payee } from '../payees/entities/payee.entity.js';
import { PayeesService } from '../payees/payees.service.js';
import type { CreateTransactionDto } from './dto/create-transaction.dto.js';
import { TransactionDto, TransactionSplitDto } from './dto/transaction.dto.js';
import { TransactionSplit } from './entities/transaction-split.entity.js';
import { Transaction } from './entities/transaction.entity.js';

interface Portion {
  envelopeId: string | null;
  amountMinor: number;
}

// Callers check membership and role with PlanAccessService before using these methods.
@Injectable()
export class TransactionsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Transaction)
    private readonly transactions: Repository<Transaction>,
    @InjectRepository(TransactionSplit)
    private readonly splits: Repository<TransactionSplit>,
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
    @InjectRepository(Envelope)
    private readonly envelopes: Repository<Envelope>,
    @InjectRepository(Payee) private readonly payees: Repository<Payee>,
    private readonly payeesService: PayeesService,
  ) {}

  // Records an expense or an income with its portions in one database transaction. The portions
  // always add up to the amount: an expense names one envelope or is split; an income names an
  // envelope or goes to Ready to Assign (a portion without envelope).
  async create(
    planId: string,
    userId: string,
    dto: CreateTransactionDto,
  ): Promise<TransactionDto> {
    const portions = this.portionsOf(dto);
    const account = await this.requireAccount(planId, dto.accountId);
    const envelopeNames = await this.requireEnvelopes(planId, portions);
    const payee = await this.resolvePayee(planId, dto);
    const saved = await this.dataSource.transaction(async (manager) => {
      const transaction = await manager.save(
        manager.create(Transaction, {
          planId,
          accountId: account.id,
          payeeId: payee?.id ?? null,
          direction: dto.direction,
          amountMinor: dto.amountMinor,
          occurredAt: new Date(dto.occurredAt),
          description: dto.description ? dto.description : null,
          createdBy: userId,
        }),
      );
      await manager.save(
        portions.map((portion, position) =>
          manager.create(TransactionSplit, {
            transactionId: transaction.id,
            envelopeId: portion.envelopeId,
            amountMinor: portion.amountMinor,
            position,
          }),
        ),
      );
      return transaction;
    });
    return TransactionDto.fromEntity(
      saved,
      portions.map((portion) =>
        this.splitDto(
          portion.envelopeId,
          portion.envelopeId
            ? envelopeNames.get(portion.envelopeId)
            : undefined,
          portion.amountMinor,
        ),
      ),
      { accountName: account.name, payeeName: payee?.name },
    );
  }

  // Structural rules of the request; nothing is read from the database yet.
  private portionsOf(dto: CreateTransactionDto): Portion[] {
    if (dto.payeeId && dto.payeeName) {
      throw new BadRequestException(['send payeeId or payeeName, not both']);
    }
    if (dto.direction === 'income') {
      if (dto.splits) {
        throw new BadRequestException(['an income cannot be split']);
      }
      return [
        { envelopeId: dto.envelopeId ?? null, amountMinor: dto.amountMinor },
      ];
    }
    if (dto.splits && dto.envelopeId) {
      throw new BadRequestException(['send envelopeId or splits, not both']);
    }
    if (!dto.splits) {
      if (!dto.envelopeId) {
        throw new BadRequestException([
          'an expense needs an envelopeId or splits',
        ]);
      }
      return [{ envelopeId: dto.envelopeId, amountMinor: dto.amountMinor }];
    }
    // BigInt: twenty portions near the safe-integer limit must not wrap around the comparison.
    const sum = dto.splits.reduce(
      (total, split) => total + BigInt(split.amountMinor),
      0n,
    );
    if (sum !== BigInt(dto.amountMinor)) {
      throw new BadRequestException([
        `splits must add up to amountMinor (${String(sum)} instead of ${dto.amountMinor})`,
      ]);
    }
    return dto.splits.map((split) => ({
      envelopeId: split.envelopeId,
      amountMinor: split.amountMinor,
    }));
  }

  // Loading by id and plan together makes an account of another plan a 404.
  private async requireAccount(
    planId: string,
    accountId: string,
  ): Promise<Account> {
    const account = await this.accounts.findOneBy({ id: accountId, planId });
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    if (account.archivedAt !== null) {
      throw new ConflictException('Account is archived');
    }
    return account;
  }

  // Every envelope named must belong to the plan; returns their names.
  private async requireEnvelopes(
    planId: string,
    portions: Portion[],
  ): Promise<Map<string, string>> {
    const ids = [
      ...new Set(
        portions.flatMap((portion) =>
          portion.envelopeId ? [portion.envelopeId] : [],
        ),
      ),
    ];
    if (ids.length === 0) {
      return new Map();
    }
    const rows = await this.envelopes.findBy({ planId, id: In(ids) });
    if (rows.length !== ids.length) {
      throw new NotFoundException('Envelope not found');
    }
    return new Map(rows.map((row) => [row.id, row.name]));
  }

  // `payeeId` must be an active payee of the plan; `payeeName` reuses the active payee with that
  // name (ignoring case) or creates it, so a payee exists after its first use (FR-23).
  private async resolvePayee(
    planId: string,
    dto: CreateTransactionDto,
  ): Promise<Payee | null> {
    if (dto.payeeId) {
      const payee = await this.payees.findOneBy({
        id: dto.payeeId,
        planId,
        deletedAt: IsNull(),
      });
      if (!payee) {
        throw new NotFoundException('Payee not found');
      }
      return payee;
    }
    if (dto.payeeName) {
      return this.payeesService.findOrCreate(planId, dto.payeeName);
    }
    return null;
  }

  private splitDto(
    envelopeId: string | null,
    envelopeName: string | undefined,
    amountMinor: number,
  ): TransactionSplitDto {
    const split = new TransactionSplitDto();
    if (envelopeId) {
      split.envelopeId = envelopeId;
      if (envelopeName !== undefined) split.envelopeName = envelopeName;
    }
    split.amountMinor = amountMinor;
    return split;
  }
}
