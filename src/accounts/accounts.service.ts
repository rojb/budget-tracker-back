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
import { Account } from './entities/account.entity.js';

// Callers check membership and role with PlanAccessService before using these methods.
@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
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

  // Derived balance of every account of the plan: opening balance plus the signed amounts of
  // its transactions. The transactions table does not exist yet, so today it is the opening
  // balance; add-transactions extends this single query (and monthlyFlows) with its rows.
  async balances(planId: string): Promise<Map<string, number>> {
    const rows = await this.accounts.find({
      select: { id: true, openingBalanceMinor: true },
      where: { planId },
    });
    return new Map(rows.map((row) => [row.id, row.openingBalanceMinor]));
  }

  // Opening balance of every non-archived account in its opening month, for the budget
  // engine's PlanLedger.balanceMovements (transactions are added by their own module).
  async ledgerBalanceMovements(
    planId: string,
    timeZone: string,
  ): Promise<LedgerAmount[]> {
    const rows = await this.accounts.find({
      where: { planId, archivedAt: IsNull() },
    });
    return rows.map((row) => ({
      month: monthOfInstant(row.createdAt, timeZone),
      amountMinor: row.openingBalanceMinor,
    }));
  }

  // Money that entered and left the account in the month; 0 until add-transactions.
  private monthlyFlows(
    _accountId: string,
    _month: MonthKey,
  ): Promise<{ inflowMinor: number; outflowMinor: number }> {
    return Promise.resolve({ inflowMinor: 0, outflowMinor: 0 });
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
