import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { CurrencyDto } from '../../plans/dto/plan.dto.js';
import {
  INVITATION_ROLES,
  type InvitationRole,
  type PlanInvitation,
} from '../entities/plan-invitation.entity.js';
import { displayCode, inviteLink } from '../invitation-code.js';

const roleDescription =
  'Role an invitation grants, or a member can be given (the owner role is not transferable).';

export class InvitationDto {
  @ApiProperty({ description: 'Shown as XXX-XXX.', example: 'K7M-4QX' })
  code!: string;

  @ApiProperty({ enum: INVITATION_ROLES, description: roleDescription })
  role!: InvitationRole;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({
    format: 'uri',
    description:
      'Link encoded in the QR; opens the join screen with the code loaded.',
    example: 'https://sobres.app/unirse/K7M4QX',
  })
  link!: string;

  static fromEntity(invitation: PlanInvitation): InvitationDto {
    const dto = new InvitationDto();
    dto.code = displayCode(invitation.code);
    dto.role = invitation.role;
    dto.expiresAt = invitation.expiresAt.toISOString();
    dto.createdAt = invitation.createdAt.toISOString();
    dto.link = inviteLink(invitation.code);
    return dto;
  }
}

export class CreateInvitationDto {
  @ApiProperty({ enum: INVITATION_ROLES, description: roleDescription })
  @IsIn(INVITATION_ROLES)
  role!: InvitationRole;
}

export class UpdateMemberDto extends CreateInvitationDto {}

// Never carries amounts or member emails.
export class InvitationPreviewDto {
  @ApiProperty({ example: 'Casa con Juli' })
  planName!: string;

  @ApiProperty({ example: 'Sofía Martínez' })
  ownerName!: string;

  @ApiProperty({ type: CurrencyDto })
  currency!: CurrencyDto;

  @ApiProperty({ enum: INVITATION_ROLES, description: roleDescription })
  role!: InvitationRole;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;
}
