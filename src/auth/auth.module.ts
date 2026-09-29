import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module.js';
import { AuthGuard } from './auth.guard.js';

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '7d') as never,
        },
      }),
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
  exports: [JwtModule],
})
export class AuthModule {}
