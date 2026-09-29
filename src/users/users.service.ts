import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { User } from './entities/user.entity.js';

const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async create(data: {
    name: string;
    email: string;
    passwordHash: string;
  }): Promise<User> {
    try {
      return await this.users.save(this.users.create(data));
    } catch (error) {
      // The unique constraint is the source of truth; a pre-check would race.
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string } | undefined)?.code ===
          PG_UNIQUE_VIOLATION
      ) {
        throw new ConflictException('Email already registered');
      }
      throw error;
    }
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOneBy({ id });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOneBy({ email });
  }
}
