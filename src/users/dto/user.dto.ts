import { ApiProperty } from '@nestjs/swagger';
import type { User } from '../entities/user.entity.js';

// API representation of a user. Deliberately has no credential field, so the password
// hash can never be serialized by accident.
export class UserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ format: 'email' })
  email!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  static fromEntity(user: User): UserDto {
    const dto = new UserDto();
    dto.id = user.id;
    dto.name = user.name;
    dto.email = user.email;
    dto.createdAt = user.createdAt.toISOString();
    return dto;
  }
}
