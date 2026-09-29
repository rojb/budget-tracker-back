import { ApiProperty } from '@nestjs/swagger';
import { UserDto } from '../../users/dto/user.dto.js';

export class AuthSessionDto {
  @ApiProperty({
    description: 'Sent as `Authorization: Bearer <accessToken>`.',
  })
  accessToken!: string;

  @ApiProperty({ type: UserDto })
  user!: UserDto;
}
