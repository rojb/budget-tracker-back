import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  In,
  IsNull,
  Repository,
  type SelectQueryBuilder,
} from 'typeorm';
import { Account } from '../accounts/entities/account.entity.js';
import {
  compareMonths,
  currentMonth,
  monthOfInstant,
  monthRange,
} from '../budget/month-key.js';
import { Envelope } from '../envelopes/entities/envelope.entity.js';
import { Payee } from '../payees/entities/payee.entity.js';
import { PayeesService } from '../payees/payees.service.js';
import type { CreateTransactionDto } from './dto/create-transaction.dto.js';
import {
  AffectedMonthsDto,
  type ListTransactionsQueryDto,
  TransactionChangeDto,
  TransactionDto,
  TransactionPageDto,
  TransactionSplitDto,
  TransactionSummaryDto,
} from './dto/transaction.dto.js';
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

  // Newest first by the instant of the movement, then by when it was recorded.
  async list(
    planId: string,
    query: ListTransactionsQueryDto,
  ): Promise<TransactionPageDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    this.requireOrderedDates(query);
    const builder = this.filtered(
      this.transactions
        .createQueryBuilder('transaction')
        .innerJoinAndSelect('transaction.account', 'account')
        .leftJoinAndSelect('transaction.payee', 'payee'),
      planId,
      query,
    );
    const summary = await this.summary(planId, query);
    const [rows, total] = await builder
      .orderBy('transaction.occurredAt', 'DESC')
      .addOrderBy('transaction.createdAt', 'DESC')
      .addOrderBy('transaction.id', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    const portions = rows.length
      ? await this.splits.find({
          where: { transactionId: In(rows.map((row) => row.id)) },
          relations: { envelope: true },
          order: { position: 'ASC' },
        })
      : [];
    const result = new TransactionPageDto();
    result.page = page;
    result.pageSize = pageSize;
    result.total = total;
    result.summary = summary;
    result.items = rows.map((row) =>
      TransactionDto.fromEntity(
        row,
        portions
          .filter((portion) => portion.transactionId === row.id)
          .map((portion) =>
            this.splitDto(
              portion.envelopeId,
              portion.envelope?.name,
              portion.amountMinor,
            ),
          ),
        { accountName: row.account.name, payeeName: row.payee?.name },
      ),
    );
    return result;
  }

  private requireOrderedDates(query: ListTransactionsQueryDto): void {
    if (query.from && query.to && query.from > query.to) {
      throw new BadRequestException(['from must not be after to']);
    }
  }

  // The predicates of the list and of its summary, so both always select the same transactions.
  // Dates and times are local to the plan's time zone. `builder` has the `payee` join.
  private filtered(
    builder: SelectQueryBuilder<Transaction>,
    planId: string,
    query: ListTransactionsQueryDto,
  ): SelectQueryBuilder<Transaction> {
    const local = 'transaction.occurredAt AT TIME ZONE plan.timeZone';
    builder
      .innerJoin('transaction.plan', 'plan')
      .where('transaction.planId = :planId', { planId })
      .andWhere('transaction.deletedAt IS NULL');
    if (query.accountId) {
      builder.andWhere('transaction.accountId = :accountId', {
        accountId: query.accountId,
      });
    }
    if (query.payeeId) {
      builder.andWhere('transaction.payeeId = :payeeId', {
        payeeId: query.payeeId,
      });
    }
    if (query.direction) {
      builder.andWhere('transaction.direction = :direction', {
        direction: query.direction,
      });
    }
    if (query.envelopeId) {
      builder.andWhere(
        `EXISTS (SELECT 1 FROM transaction_splits fs
                  WHERE fs.transaction_id = transaction.id AND fs.envelope_id = :envelopeId)`,
        { envelopeId: query.envelopeId },
      );
    }
    if (query.from) {
      builder.andWhere(`(${local})::date >= :from::date`, { from: query.from });
    }
    if (query.to) {
      builder.andWhere(`(${local})::date <= :to::date`, { to: query.to });
    }
    const time = `to_char(${local}, 'HH24:MI')`;
    if (query.timeFrom && query.timeTo && query.timeFrom > query.timeTo) {
      // Across midnight (22:00 to 02:00): the evening or the early morning.
      builder.andWhere(`(${time} >= :timeFrom OR ${time} <= :timeTo)`, {
        timeFrom: query.timeFrom,
        timeTo: query.timeTo,
      });
    } else {
      if (query.timeFrom) {
        builder.andWhere(`${time} >= :timeFrom`, { timeFrom: query.timeFrom });
      }
      if (query.timeTo) {
        builder.andWhere(`${time} <= :timeTo`, { timeTo: query.timeTo });
      }
    }
    if (query.q) {
      // Escape LIKE wildcards so "50%" and "a_b" are searched literally.
      const pattern = `%${query.q.replace(/[\\%_]/g, '\\$&')}%`;
      builder.andWhere(
        `(payee.name ILIKE :q ESCAPE '\\'
          OR transaction.description ILIKE :q ESCAPE '\\'
          OR EXISTS (SELECT 1 FROM transaction_splits qs
                       JOIN envelopes qe ON qe.id = qs.envelope_id
                      WHERE qs.transaction_id = transaction.id AND qe.name ILIKE :q ESCAPE '\\'))`,
        { q: pattern },
      );
    }
    return builder;
  }

  // Money that left and came in over every transaction the filters select, whatever the page.
  private async summary(
    planId: string,
    query: ListTransactionsQueryDto,
  ): Promise<TransactionSummaryDto> {
    const row = await this.filtered(
      this.transactions
        .createQueryBuilder('transaction')
        .leftJoin('transaction.payee', 'payee'),
      planId,
      query,
    )
      .select(
        `COALESCE(SUM(transaction.amountMinor) FILTER (WHERE transaction.direction = 'expense'), 0)::text`,
        'outflow',
      )
      .addSelect(
        `COALESCE(SUM(transaction.amountMinor) FILTER (WHERE transaction.direction = 'income'), 0)::text`,
        'inflow',
      )
      .getRawOne<{ outflow: string; inflow: string }>();
    const summary = new TransactionSummaryDto();
    summary.outflowMinor = Number(row?.outflow ?? 0);
    summary.inflowMinor = Number(row?.inflow ?? 0);
    return summary;
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

  // Replaces every editable field and the portions of a transaction in one database transaction,
  // so a reader never sees half an edit. `id` and `createdAt` never change, which is what makes
  // sending the previous state back an exact undo. An account or a payee the transaction already
  // has is not validated again (an archived account or a deleted payee must not block an edit).
  async update(
    planId: string,
    transactionId: string,
    dto: CreateTransactionDto,
  ): Promise<TransactionChangeDto> {
    const current = await this.requireLive(planId, transactionId);
    const portions = this.portionsOf(dto);
    const account = await this.requireAccount(
      planId,
      dto.accountId,
      current.accountId,
    );
    const envelopeNames = await this.requireEnvelopes(planId, portions);
    const payee = await this.resolvePayee(planId, dto, current.payeeId);
    const occurredAt = new Date(dto.occurredAt);
    await this.dataSource.transaction(async (manager) => {
      // Re-checking the deletion inside the transaction closes the race with a concurrent delete.
      const updated = await manager.update(
        Transaction,
        { id: current.id, deletedAt: IsNull() },
        {
          accountId: account.id,
          payeeId: payee?.id ?? null,
          direction: dto.direction,
          amountMinor: dto.amountMinor,
          occurredAt,
          description: dto.description ? dto.description : null,
        },
      );
      if (!updated.affected) {
        throw new NotFoundException('Transaction not found');
      }
      await manager.delete(TransactionSplit, { transactionId: current.id });
      await manager.save(
        portions.map((portion, position) =>
          manager.create(TransactionSplit, {
            transactionId: current.id,
            envelopeId: portion.envelopeId,
            amountMinor: portion.amountMinor,
            position,
          }),
        ),
      );
    });
    const edited = Object.assign(new Transaction(), current, {
      accountId: account.id,
      payeeId: payee?.id ?? null,
      direction: dto.direction,
      amountMinor: dto.amountMinor,
      occurredAt,
      description: dto.description ? dto.description : null,
    });
    return this.change(
      TransactionDto.fromEntity(
        edited,
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
      ),
      current.plan.timeZone,
      current.occurredAt,
    );
  }

  // The transaction of the plan that has not been deleted; another plan's, or a deleted one, is 404.
  private async requireLive(
    planId: string,
    transactionId: string,
  ): Promise<Transaction> {
    const current = await this.transactions.findOne({
      where: { id: transactionId, planId, deletedAt: IsNull() },
      relations: { plan: true },
    });
    if (!current) {
      throw new NotFoundException('Transaction not found');
    }
    return current;
  }

  private change(
    transaction: TransactionDto,
    timeZone: string,
    previousOccurredAt: Date,
  ): TransactionChangeDto {
    const result = new TransactionChangeDto();
    result.transaction = transaction;
    result.affectedMonths = this.affected(
      timeZone,
      previousOccurredAt,
      new Date(transaction.occurredAt),
    ).affectedMonths;
    return result;
  }

  // Months whose derived figures change: from the earliest month the transaction touched (before or
  // after the change) to the later of the current month and the latest month it touched. A positive
  // Available carries into every following month and Ready to Assign is plan wide; the months after
  // the current one mirror it (budget-calc-engine), so they are not listed.
  private affected(
    timeZone: string,
    before: Date,
    after: Date = before,
  ): AffectedMonthsDto {
    const months = [
      monthOfInstant(before, timeZone),
      monthOfInstant(after, timeZone),
    ].sort(compareMonths);
    const last = [currentMonth(timeZone), months[1]].sort(compareMonths)[1];
    const result = new AffectedMonthsDto();
    result.affectedMonths = monthRange(months[0], last);
    return result;
  }

  // Loading by id and plan together makes an account of another plan a 404. An account the
  // transaction already has (`keepId`, when editing) is accepted even if it was archived since.
  private async requireAccount(
    planId: string,
    accountId: string,
    keepId?: string,
  ): Promise<Account> {
    const account = await this.accounts.findOneBy({ id: accountId, planId });
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    if (account.archivedAt !== null && account.id !== keepId) {
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
  // The payee the transaction already has (`keepId`, when editing) is accepted even if it was
  // deleted since, so it can keep it.
  private async resolvePayee(
    planId: string,
    dto: CreateTransactionDto,
    keepId?: string | null,
  ): Promise<Payee | null> {
    if (dto.payeeId) {
      const payee = await this.payees.findOneBy({
        id: dto.payeeId,
        planId,
        ...(dto.payeeId === keepId ? {} : { deletedAt: IsNull() }),
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
