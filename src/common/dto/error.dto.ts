import { ApiProperty } from '@nestjs/swagger';

// Documentation-only shapes of the error bodies (api-conventions "Error response shape").
// Nest's exception filter produces them; these classes only describe them in the spec.
export class ErrorDto {
  @ApiProperty({ type: 'integer', description: 'Equal to the HTTP status.' })
  statusCode!: number;

  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
  })
  message!: string | string[];

  @ApiProperty({ description: 'Short HTTP reason phrase.' })
  error!: string;
}

export class ValidationErrorDto {
  @ApiProperty({ type: 'integer', enum: [400] })
  statusCode!: 400;

  @ApiProperty({ type: [String] })
  message!: string[];

  @ApiProperty({ enum: ['Bad Request'] })
  error!: 'Bad Request';
}
