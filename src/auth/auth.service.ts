import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { argon2id, hash, verify } from 'argon2';
import { UserDto } from '../users/dto/user.dto.js';
import type { User } from '../users/entities/user.entity.js';
import { UsersService } from '../users/users.service.js';
import type { AuthSessionDto } from './dto/auth-session.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { JwtPayload } from './auth.guard.js';

// OWASP minimum Argon2id profile: 19 MiB memory, 2 iterations, 1 lane.
const ARGON2_OPTIONS = {
  type: argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

const INVALID_CREDENTIALS = 'Invalid email or password';

@Injectable()
export class AuthService {
  // Verified against when the email is unknown, so response time does not reveal
  // whether an account exists.
  private readonly dummyHash = hash('not-a-real-password', ARGON2_OPTIONS);

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthSessionDto> {
    const passwordHash = await hash(dto.password, ARGON2_OPTIONS);
    const user = await this.users.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
    });
    return this.createSession(user);
  }

  async login(dto: LoginDto): Promise<AuthSessionDto> {
    const user = await this.users.findByEmail(dto.email);
    const valid = await verify(
      user?.passwordHash ?? (await this.dummyHash),
      dto.password,
    );
    if (!user || !valid) throw new UnauthorizedException(INVALID_CREDENTIALS);
    return this.createSession(user);
  }

  private async createSession(user: User): Promise<AuthSessionDto> {
    const payload: JwtPayload = { sub: user.id };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: UserDto.fromEntity(user),
    };
  }
}
