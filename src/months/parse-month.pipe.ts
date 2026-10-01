import { BadRequestException, type PipeTransform } from '@nestjs/common';
import { isMonthKey, type MonthKey } from '../budget/month-key.js';

// Validates the `month` path parameter: a YYYY-MM budget month key.
export class ParseMonthPipe implements PipeTransform<string, MonthKey> {
  transform(value: string): MonthKey {
    if (!isMonthKey(value)) {
      throw new BadRequestException(['month must be a YYYY-MM month key']);
    }
    return value;
  }
}
