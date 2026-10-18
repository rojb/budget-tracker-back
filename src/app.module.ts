import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import pg from 'pg';
import { AccountsModule } from './accounts/accounts.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { BudgetModule } from './budget/budget.module.js';
import { EnvelopesModule } from './envelopes/envelopes.module.js';
import { MonthsModule } from './months/months.module.js';
import { PayeesModule } from './payees/payees.module.js';
import { PlansModule } from './plans/plans.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { SharingModule } from './sharing/sharing.module.js';
import { TransactionsModule } from './transactions/transactions.module.js';
import { envValidationSchema } from './config/env.validation.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        // TypeORM loads `pg` with a dynamic require that Vercel's file tracer cannot follow; passing
        // the driver makes the import static, so the package ships with the function.
        driver: pg,
        host: config.get<string>('DATABASE_HOST'),
        port: config.get<number>('DATABASE_PORT'),
        username: config.get<string>('DATABASE_USER'),
        password: config.get<string>('DATABASE_PASSWORD'),
        database: config.get<string>('DATABASE_NAME'),
        ssl: config.get<boolean>('DATABASE_SSL') === true,
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),
    UsersModule,
    AuthModule,
    BudgetModule,
    PlansModule,
    AccountsModule,
    PayeesModule,
    EnvelopesModule,
    MonthsModule,
    ReportsModule,
    TransactionsModule,
    SharingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
