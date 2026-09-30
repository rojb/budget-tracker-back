import { ApiProperty } from '@nestjs/swagger';
import {
  ACCOUNT_TYPES,
  type Account,
  type AccountType,
} from '../entities/account.entity.js';

// An account as the API shows it. `balanceMinor` is derived, never stored.
export class AccountDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Banco Nación' })
  name!: string;

  @ApiProperty({ enum: ACCOUNT_TYPES })
  type!: AccountType;

  @ApiProperty({ type: 'integer' })
  openingBalanceMinor!: number;

  @ApiProperty({ type: 'integer' })
  balanceMinor!: number;

  @ApiProperty()
  archived!: boolean;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  archivedAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  static fromEntity(account: Account, balanceMinor: number): AccountDto {
    return AccountDto.fill(new AccountDto(), account, balanceMinor);
  }

  protected static fill<T extends AccountDto>(
    dto: T,
    account: Account,
    balanceMinor: number,
  ): T {
    dto.id = account.id;
    dto.name = account.name;
    dto.type = account.type;
    dto.openingBalanceMinor = account.openingBalanceMinor;
    dto.balanceMinor = balanceMinor;
    dto.archived = account.archivedAt !== null;
    dto.archivedAt = account.archivedAt?.toISOString() ?? null;
    dto.createdAt = account.createdAt.toISOString();
    return dto;
  }
}

export class AccountDetailDto extends AccountDto {
  @ApiProperty({ pattern: '^\\d{4}-(0[1-9]|1[0-2])$', example: '2026-09' })
  month!: string;

  @ApiProperty({ type: 'integer' })
  inflowMinor!: number;

  @ApiProperty({ type: 'integer' })
  outflowMinor!: number;

  static fromDetail(
    account: Account,
    balanceMinor: number,
    month: string,
    flows: { inflowMinor: number; outflowMinor: number },
  ): AccountDetailDto {
    const dto = AccountDto.fill(new AccountDetailDto(), account, balanceMinor);
    dto.month = month;
    dto.inflowMinor = flows.inflowMinor;
    dto.outflowMinor = flows.outflowMinor;
    return dto;
  }
}
