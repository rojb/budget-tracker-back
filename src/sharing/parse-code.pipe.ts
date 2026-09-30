import { BadRequestException, type PipeTransform } from '@nestjs/common';
import { normalizeCode } from './invitation-code.js';

const CODE_PATTERN = /^[A-Za-z0-9]{3}-?[A-Za-z0-9]{3}$/;

// Validates the `code` path parameter (dash optional, any case) and normalizes it.
export class ParseInvitationCodePipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!CODE_PATTERN.test(value.trim())) {
      throw new BadRequestException(['code must look like XXX-XXX']);
    }
    return normalizeCode(value);
  }
}
