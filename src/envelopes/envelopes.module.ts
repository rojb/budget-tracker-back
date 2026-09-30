import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlansModule } from '../plans/plans.module.js';
import { EnvelopeGroupsController } from './envelope-groups.controller.js';
import { EnvelopeGroupsService } from './envelope-groups.service.js';
import { EnvelopeGroup } from './entities/envelope-group.entity.js';
import { Envelope } from './entities/envelope.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([EnvelopeGroup, Envelope]), PlansModule],
  controllers: [EnvelopeGroupsController],
  providers: [EnvelopeGroupsService],
  exports: [EnvelopeGroupsService],
})
export class EnvelopesModule {}
