import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { trim } from '../../auth/dto/register.dto.js';
import { ACCOUNT_TYPES, type AccountType } from '../entities/account.entity.js';

export class CreateAccountDto {
  @ApiProperty({ minLength: 1, maxLength: 60, example: 'Mercado Pago' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name!: string;

  @ApiProperty({
    enum: ACCOUNT_TYPES,
    description:
      'Kind of account: bank (Banco), digitalWallet (Billetera virtual), cash (Efectivo).',
  })
  @IsIn(ACCOUNT_TYPES)
  type!: AccountType;

  @ApiProperty({
    type: 'integer',
    description:
      "Integer amount in the minor units of the plan's currency. May be zero or negative.",
    example: 50000,
  })
  @IsInt()
  @Min(Number.MIN_SAFE_INTEGER)
  @Max(Number.MAX_SAFE_INTEGER)
  openingBalanceMinor!: number;
}
