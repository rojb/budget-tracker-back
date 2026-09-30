import { BadRequestException, ParseUUIDPipe } from '@nestjs/common';

// ParseUUIDPipe whose error matches the contract's ValidationFailed body (`message` is an array).
export const parseUuid = (name: string): ParseUUIDPipe =>
  new ParseUUIDPipe({
    exceptionFactory: () => new BadRequestException([`${name} must be a UUID`]),
  });
