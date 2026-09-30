import { PartialType } from '@nestjs/swagger';
import { CreateAccountDto } from './create-account.dto.js';

// Only the fields sent change; an empty body is rejected by AccountsService.
export class UpdateAccountDto extends PartialType(CreateAccountDto) {}
