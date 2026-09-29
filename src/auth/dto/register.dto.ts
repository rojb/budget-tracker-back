import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export const trimLower = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @ApiProperty({ minLength: 1, maxLength: 80, example: 'Sofía Martínez' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  @ApiProperty({
    format: 'email',
    maxLength: 254,
    description: 'Stored lowercase; unique across accounts.',
    example: 'sofia@correo.com',
  })
  @Transform(trimLower)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ format: 'password', minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
