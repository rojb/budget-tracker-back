import { ApiProperty } from '@nestjs/swagger';
import { CURRENCIES, CURRENCY_CODES, type CurrencyCode } from '../currency.js';
import type { PlanMember } from '../entities/plan-member.entity.js';
import type { Plan } from '../entities/plan.entity.js';
import { PLAN_ROLES, type PlanRole } from '../plan-role.js';

export class CurrencyDto {
  @ApiProperty({ enum: CURRENCY_CODES })
  code!: CurrencyCode;

  @ApiProperty({ enum: ['$', 'US$', '€'] })
  symbol!: string;

  @ApiProperty({ enum: ['pesos', 'dólares', 'euros'] })
  name!: string;

  @ApiProperty({ type: 'integer', enum: [0, 2] })
  minorUnits!: number;

  static fromCode(code: CurrencyCode): CurrencyDto {
    return Object.assign(new CurrencyDto(), CURRENCIES[code]);
  }
}

export class PlanMemberDto {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ format: 'email' })
  email!: string;

  @ApiProperty({ enum: PLAN_ROLES })
  role!: PlanRole;

  @ApiProperty({ format: 'date-time' })
  joinedAt!: string;

  static fromEntity(member: PlanMember): PlanMemberDto {
    const dto = new PlanMemberDto();
    dto.userId = member.userId;
    dto.name = member.user.name;
    dto.email = member.user.email;
    dto.role = member.role;
    dto.joinedAt = member.joinedAt.toISOString();
    return dto;
  }
}

// A plan as the API shows it: never carries amounts.
export class PlanDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Mi plan' })
  name!: string;

  @ApiProperty({ type: CurrencyDto })
  currency!: CurrencyDto;

  @ApiProperty({ example: 'America/Argentina/Buenos_Aires' })
  timeZone!: string;

  @ApiProperty({ enum: PLAN_ROLES })
  myRole!: PlanRole;

  @ApiProperty({ type: [PlanMemberDto] })
  members!: PlanMemberDto[];

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  // `plan.members` must be loaded with their users.
  static fromEntity(plan: Plan, userId: string): PlanDto {
    const dto = new PlanDto();
    dto.id = plan.id;
    dto.name = plan.name;
    dto.currency = CurrencyDto.fromCode(plan.currencyCode);
    dto.timeZone = plan.timeZone;
    const members = [...plan.members].sort(
      (a, b) => a.joinedAt.getTime() - b.joinedAt.getTime(),
    );
    dto.myRole = members.find((member) => member.userId === userId)!.role;
    dto.members = members.map((member) => PlanMemberDto.fromEntity(member));
    dto.createdAt = plan.createdAt.toISOString();
    return dto;
  }
}
