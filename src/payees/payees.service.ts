import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, QueryFailedError, Repository } from 'typeorm';
import { PayeeDto, PayeePageDto } from './dto/payee.dto.js';
import type {
  CreatePayeeDto,
  ListPayeesQueryDto,
  UpdatePayeeDto,
} from './dto/payee-requests.dto.js';
import { Envelope } from '../envelopes/entities/envelope.entity.js';
import { Payee } from './entities/payee.entity.js';

const PG_UNIQUE_VIOLATION = '23505';

// Callers check membership and role with PlanAccessService before using these methods.
@Injectable()
export class PayeesService {
  constructor(
    @InjectRepository(Payee) private readonly payees: Repository<Payee>,
    @InjectRepository(Envelope)
    private readonly envelopes: Repository<Envelope>,
  ) {}

  async list(planId: string, query: ListPayeesQueryDto): Promise<PayeePageDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const builder = this.payees
      .createQueryBuilder('payee')
      .where('payee.planId = :planId', { planId })
      .andWhere('payee.deletedAt IS NULL');
    const q = query.q?.trim();
    if (q) {
      const escaped = q.replace(/[\\%_]/g, (c) => `\\${c}`);
      builder.andWhere('payee.name ILIKE :q', { q: `%${escaped}%` });
    }
    const [rows, total] = await builder
      .orderBy('lower(payee.name)', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    const counts = await this.transactionCounts(planId);
    const result = new PayeePageDto();
    result.page = page;
    result.pageSize = pageSize;
    result.total = total;
    result.items = rows.map((row) =>
      PayeeDto.fromEntity(row, counts.get(row.id) ?? 0),
    );
    return result;
  }

  async create(planId: string, dto: CreatePayeeDto): Promise<PayeeDto> {
    await this.requireSuggestedEnvelope(planId, dto.suggestedEnvelopeId);
    const payee = await this.saveUnique(this.payees.create({ ...dto, planId }));
    return PayeeDto.fromEntity(payee, 0);
  }

  // Includes deleted payees, so past transactions can still show them.
  async get(planId: string, payeeId: string): Promise<PayeeDto> {
    const payee = await this.find(planId, payeeId, true);
    return this.toDto(payee);
  }

  async update(
    planId: string,
    payeeId: string,
    dto: UpdatePayeeDto,
  ): Promise<PayeeDto> {
    if (Object.values(dto).every((value) => value === undefined)) {
      throw new BadRequestException([
        'at least one of name or suggestedEnvelopeId must be sent',
      ]);
    }
    const payee = await this.find(planId, payeeId, false);
    await this.requireSuggestedEnvelope(planId, dto.suggestedEnvelopeId);
    if (dto.name !== undefined) payee.name = dto.name;
    if (dto.suggestedEnvelopeId !== undefined) {
      payee.suggestedEnvelopeId = dto.suggestedEnvelopeId;
    }
    return this.toDto(await this.saveUnique(payee));
  }

  // Logical delete (FR-05): the row stays so past transactions keep their payee.
  async remove(planId: string, payeeId: string): Promise<void> {
    const payee = await this.find(planId, payeeId, false);
    payee.deletedAt = new Date();
    await this.payees.save(payee);
  }

  // For add-transactions: the active payee with that name (ignoring case), or a new one.
  async findOrCreate(planId: string, name: string): Promise<Payee> {
    const trimmed = name.trim();
    const existing = await this.payees
      .createQueryBuilder('payee')
      .where('payee.planId = :planId', { planId })
      .andWhere('payee.deletedAt IS NULL')
      .andWhere('lower(payee.name) = lower(:name)', { name: trimmed })
      .getOne();
    return (
      existing ?? this.saveUnique(this.payees.create({ planId, name: trimmed }))
    );
  }

  // Transactions per payee. The transactions table does not exist yet, so every count is 0;
  // add-transactions replaces this body with a GROUP BY payee_id over its table.
  transactionCounts(_planId: string): Promise<Map<string, number>> {
    return Promise.resolve(new Map());
  }

  private async find(
    planId: string,
    payeeId: string,
    includeDeleted: boolean,
  ): Promise<Payee> {
    const payee = await this.payees.findOneBy({
      id: payeeId,
      planId,
      ...(includeDeleted ? {} : { deletedAt: IsNull() }),
    });
    if (!payee) {
      throw new NotFoundException('Payee not found');
    }
    return payee;
  }

  // The suggested envelope must belong to the plan; an envelope of another plan is a 404 and
  // nothing is saved. Deleting the envelope clears the suggestion (FK ON DELETE SET NULL).
  private async requireSuggestedEnvelope(
    planId: string,
    envelopeId: string | undefined,
  ): Promise<void> {
    if (envelopeId === undefined) return;
    if ((await this.envelopes.countBy({ id: envelopeId, planId })) === 0) {
      throw new NotFoundException('Envelope not found');
    }
  }

  // The partial unique index is the source of truth; a pre-check would race.
  private async saveUnique(payee: Payee): Promise<Payee> {
    try {
      return await this.payees.save(payee);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string } | undefined)?.code ===
          PG_UNIQUE_VIOLATION
      ) {
        throw new ConflictException('Payee name already in use');
      }
      throw error;
    }
  }

  private async toDto(payee: Payee): Promise<PayeeDto> {
    const counts = await this.transactionCounts(payee.planId);
    return PayeeDto.fromEntity(payee, counts.get(payee.id) ?? 0);
  }
}
