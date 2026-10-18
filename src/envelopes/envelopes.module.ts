import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountsModule } from '../accounts/accounts.module.js';
import { BudgetModule } from '../budget/budget.module.js';
import { Plan } from '../plans/entities/plan.entity.js';
import { PlansModule } from '../plans/plans.module.js';
import { TransactionLedgerModule } from '../transactions/transaction-ledger.module.js';
import { TransactionsModule } from '../transactions/transactions.module.js';
import { BlobPhotoStorage } from './blob-photo-storage.js';
import { EnvelopeGroupsController } from './envelope-groups.controller.js';
import { EnvelopeGroupsService } from './envelope-groups.service.js';
import { EnvelopePhotosController } from './envelope-photos.controller.js';
import { EnvelopePhotosService } from './envelope-photos.service.js';
import { EnvelopeTemplateController } from './envelope-template.controller.js';
import { LocalPhotoStorage } from './local-photo-storage.js';
import { PhotoStorage } from './photo-storage.js';
import { PhotoSuggestionsController } from './photo-suggestions.controller.js';
import { EnvelopesController } from './envelopes.controller.js';
import { EnvelopesService } from './envelopes.service.js';
import { EnvelopeGroup } from './entities/envelope-group.entity.js';
import { Envelope } from './entities/envelope.entity.js';

// Exports EnvelopesService for add-transactions and add-monthly-assignment (it builds the
// PlanLedger of a plan).
@Module({
  imports: [
    TypeOrmModule.forFeature([EnvelopeGroup, Envelope, Plan]),
    PlansModule,
    AccountsModule,
    BudgetModule,
    TransactionLedgerModule,
    TransactionsModule,
  ],
  controllers: [
    EnvelopeGroupsController,
    EnvelopesController,
    EnvelopePhotosController,
    EnvelopeTemplateController,
    PhotoSuggestionsController,
  ],
  providers: [
    EnvelopeGroupsService,
    EnvelopePhotosService,
    EnvelopesService,
    {
      provide: PhotoStorage,
      inject: [ConfigService],
      useFactory: (config: ConfigService): PhotoStorage =>
        config.get<string>('PHOTOS_STORAGE') === 'blob'
          ? new BlobPhotoStorage(
              config.getOrThrow<string>('BLOB_READ_WRITE_TOKEN'),
            )
          : new LocalPhotoStorage(
              config.get<string>('PHOTOS_DIR') ?? 'storage/photos',
            ),
    },
  ],
  exports: [EnvelopeGroupsService, EnvelopesService],
})
export class EnvelopesModule {}
