import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  type CreateTransferDto,
  type ListTransfersQueryDto,
  TransferDto,
  TransferPageDto,
} from './dto/transfer.dto.js';
import { AccountTransfer } from './entities/account-transfer.entity.js';
import { Account } from './entities/account.entity.js';

// Callers check membership and role with PlanAccessService first.
@Injectable()
export class TransfersService {
  constructor(
    @InjectRepository(AccountTransfer)
    private readonly transfers: Repository<AccountTransfer>,
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
  ) {}

  async create(
    planId: string,
    userId: string,
    dto: CreateTransferDto,
  ): Promise<TransferDto> {
    if (dto.fromAccountId === dto.toAccountId) {
      throw new BadRequestException([
        'fromAccountId and toAccountId must be different accounts',
      ]);
    }
    const accounts = await this.accounts.findBy({
      planId,
      id: In([dto.fromAccountId, dto.toAccountId]),
    });
    if (accounts.length !== 2) {
      throw new NotFoundException('Account not found');
    }
    if (accounts.some((account) => account.archivedAt !== null)) {
      throw new ConflictException('Account is archived');
    }
    const transfer = await this.transfers.save(
      this.transfers.create({
        planId,
        fromAccountId: dto.fromAccountId,
        toAccountId: dto.toAccountId,
        amountMinor: dto.amountMinor,
        occurredAt: new Date(dto.occurredAt),
        createdBy: userId,
      }),
    );
    return TransferDto.fromEntity(transfer);
  }

  async list(
    planId: string,
    query: ListTransfersQueryDto,
  ): Promise<TransferPageDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const builder = this.transfers
      .createQueryBuilder('transfer')
      .where('transfer.planId = :planId', { planId });
    if (query.accountId) {
      builder.andWhere(
        '(transfer.fromAccountId = :accountId OR transfer.toAccountId = :accountId)',
        { accountId: query.accountId },
      );
    }
    const [rows, total] = await builder
      .orderBy('transfer.createdAt', 'DESC')
      .addOrderBy('transfer.id', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    const result = new TransferPageDto();
    result.page = page;
    result.pageSize = pageSize;
    result.total = total;
    result.items = rows.map((row) => TransferDto.fromEntity(row));
    return result;
  }

  async remove(planId: string, transferId: string): Promise<void> {
    const result = await this.transfers.delete({ id: transferId, planId });
    if (!result.affected) {
      throw new NotFoundException('Transfer not found');
    }
  }
}
