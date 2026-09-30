import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import type { LedgerAmount } from '../budget/calculation.types.js';
import { monthOfInstant, type MonthKey } from '../budget/month-key.js';
import { AccountDetailDto, AccountDto } from './dto/account.dto.js';
import type { CreateAccountDto } from './dto/create-account.dto.js';
import type { UpdateAccountDto } from './dto/update-account.dto.js';
import { AccountTransfer } from './entities/account-transfer.entity.js';
import { Account } from './entities/account.entity.js';

// Callers check membership and role with PlanAccessService before using these methods.
@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
    @InjectRepository(AccountTransfer)
    private readonly transfers: Repository<AccountTransfer>,
  ) {}

  async list(planId: string, archived: boolean): Promise<AccountDto[]> {
    const rows = await this.accounts.find({
      where: { planId, archivedAt: archived ? Not(IsNull()) : IsNull() },
      order: archived ? { archivedAt: 'DESC' } : { createdAt: 'ASC' },
    });
    const balances = await this.balances(planId);
    return rows.map((row) => AccountDto.fromEntity(row, balances.get(row.id)!));
  }

  async create(planId: string, dto: CreateAccountDto): Promise<AccountDto> {
    const account = await this.accounts.save(
      this.accounts.create({ ...dto, planId }),
    );
    return this.toDto(account);
  }

  async detail(
    planId: string,
    accountId: string,
    month: MonthKey,
  ): Promise<AccountDetailDto> {
    const account = await this.find(planId, accountId);
    const balances = await this.balances(planId);
    return AccountDetailDto.fromDetail(
      account,
      balances.get(account.id)!,
      month,
      await this.monthlyFlows(account.id, month),
    );
  }

  async update(
    planId: string,
    accountId: string,
    dto: UpdateAccountDto,
  ): Promise<AccountDto> {
    if (Object.values(dto).every((value) => value === undefined)) {
      throw new BadRequestException([
        'at least one of name, type or openingBalanceMinor must be sent',
      ]);
    }
    const account = await this.find(planId, accountId);
    Object.assign(
      account,
      Object.fromEntries(
        Object.entries(dto).filter(([, value]) => value !== undefined),
      ),
    );
    return this.toDto(await this.accounts.save(account));
  }

  // Accounts are never deleted (FR-03): archiving keeps them and their history but takes them
  // out of the total balance, the budget calculation and new entries.
  async archive(planId: string, accountId: string): Promise<AccountDto> {
    const account = await this.find(planId, accountId);
    if (account.archivedAt) {
      throw new ConflictException('Account is already archived');
    }
    account.archivedAt = new Date();
    return this.toDto(await this.accounts.save(account));
  }

  async restore(planId: string, accountId: string): Promise<AccountDto> {
    const account = await this.find(planId, accountId);
    if (!account.archivedAt) {
      throw new ConflictException('Account is not archived');
    }
    account.archivedAt = null;
    return this.toDto(await this.accounts.save(account));
  }

  // Derived balance of every account of the plan: opening balance plus incoming minus outgoing
  // transfers (and, once add-transactions extends this method, the signed transaction amounts).
  async balances(planId: string): Promise<Map<string, number>> {
    const rows = await this.accounts.find({
      select: { id: true, openingBalanceMinor: true },
      where: { planId },
    });
    const balances = new Map(
      rows.map((row) => [row.id, row.openingBalanceMinor]),
    );
    const flows: { accountId: string; net: string }[] =
      await this.transfers.query(
        `SELECT account_id AS "accountId", SUM(amount)::text AS net FROM (
         SELECT to_account_id AS account_id, amount_minor AS amount
           FROM account_transfers WHERE plan_id = $1
         UNION ALL
         SELECT from_account_id, -amount_minor
           FROM account_transfers WHERE plan_id = $1
       ) t GROUP BY account_id`,
        [planId],
      );
    for (const flow of flows) {
      balances.set(
        flow.accountId,
        (balances.get(flow.accountId) ?? 0) + Number(flow.net),
      );
    }
    return balances;
  }

  // Changes to the sum of balances of non-archived accounts, by month in the plan's time zone,
  // for the budget engine's PlanLedger.balanceMovements: opening balances in their opening month
  // and each transfer side that touches an active account (a transfer between two active
  // accounts nets to zero). add-transactions adds its own rows.
  async ledgerBalanceMovements(
    planId: string,
    timeZone: string,
  ): Promise<LedgerAmount[]> {
    const rows = await this.accounts.find({ where: { planId } });
    const active = new Set(
      rows.filter((row) => row.archivedAt === null).map((row) => row.id),
    );
    const movements: LedgerAmount[] = rows
      .filter((row) => active.has(row.id))
      .map((row) => ({
        month: monthOfInstant(row.createdAt, timeZone),
        amountMinor: row.openingBalanceMinor,
      }));
    for (const transfer of await this.transfers.findBy({ planId })) {
      const month = monthOfInstant(transfer.occurredAt, timeZone);
      if (active.has(transfer.toAccountId)) {
        movements.push({ month, amountMinor: transfer.amountMinor });
      }
      if (active.has(transfer.fromAccountId)) {
        movements.push({ month, amountMinor: -transfer.amountMinor });
      }
    }
    return movements;
  }

  // Money that entered and left the account in the month (plan time zone). Today only transfers;
  // add-transactions adds its rows.
  private async monthlyFlows(
    accountId: string,
    month: MonthKey,
  ): Promise<{ inflowMinor: number; outflowMinor: number }> {
    const [row]: { inflow: string; outflow: string }[] =
      await this.transfers.query(
        `SELECT
           COALESCE(SUM(t.amount_minor) FILTER (WHERE t.to_account_id = $1), 0)::text AS inflow,
           COALESCE(SUM(t.amount_minor) FILTER (WHERE t.from_account_id = $1), 0)::text AS outflow
         FROM account_transfers t JOIN plans p ON p.id = t.plan_id
         WHERE (t.to_account_id = $1 OR t.from_account_id = $1)
           AND to_char(t.occurred_at AT TIME ZONE p.time_zone, 'YYYY-MM') = $2`,
        [accountId, month],
      );
    return {
      inflowMinor: Number(row.inflow),
      outflowMinor: Number(row.outflow),
    };
  }

  // Loading by id and plan together makes an id from another plan a 404.
  private async find(planId: string, accountId: string): Promise<Account> {
    const account = await this.accounts.findOneBy({ id: accountId, planId });
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    return account;
  }

  private async toDto(account: Account): Promise<AccountDto> {
    const balances = await this.balances(account.planId);
    return AccountDto.fromEntity(account, balances.get(account.id)!);
  }
}
