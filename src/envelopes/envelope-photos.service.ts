import { randomBytes } from 'node:crypto';
import { createReadStream, type ReadStream } from 'node:fs';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import {
  Injectable,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import sharp from 'sharp';
import { Repository } from 'typeorm';
import { EnvelopeDto } from './dto/envelope.dto.js';
import { Envelope } from './entities/envelope.entity.js';
import { detectImageKind } from './image-signature.js';

// Largest upload accepted (FR-41) and the width every stored photo is resized to at most.
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const PHOTO_WIDTH = 1080;
// Guards the decoder against images that are small on disk and huge once decoded.
const PHOTO_MAX_PIXELS = 40_000_000;
const NOT_AN_IMAGE = 'The photo must be a JPEG, PNG or WebP image';

export interface PhotoFile {
  stream: ReadStream;
  size: number;
}

// Goal photos on local disk under PHOTOS_DIR (PRD §9). The file of an envelope is
// `<root>/<planId>/<envelopeId>-<random>.jpg`: the key is built here from UUIDs and random hex and
// never from user input, so it cannot point outside the root. Callers check membership and role
// with PlanAccessService first.
@Injectable()
export class EnvelopePhotosService {
  private readonly root: string;

  constructor(
    config: ConfigService,
    @InjectRepository(Envelope)
    private readonly envelopes: Repository<Envelope>,
  ) {
    this.root = resolve(
      config.get<string>('PHOTOS_DIR') ?? 'storage/photos',
    );
  }

  // Validates by content, resizes and stores the image as the envelope's photo, replacing (and
  // deleting) the previous one. Nothing reaches the disk unless the bytes are a decodable image.
  async set(
    planId: string,
    envelopeId: string,
    bytes: Buffer,
  ): Promise<EnvelopeDto> {
    const envelope = await this.find(planId, envelopeId);
    const stored = await this.resize(bytes);
    const key = `${planId}/${envelopeId}-${randomBytes(4).toString('hex')}.jpg`;
    const path = this.pathOf(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, stored);
    const previous = envelope.photoFile;
    try {
      envelope.photoFile = key;
      envelope.photoUpdatedAt = new Date();
      await this.envelopes.save(envelope);
    } catch (error) {
      // The envelope must never point to a file that was not recorded, nor leave an orphan.
      await this.discard(key);
      throw error;
    }
    if (previous) {
      await this.discard(previous);
    }
    return EnvelopeDto.fromEntity(envelope);
  }

  // Removing a photo the envelope does not have is not an error.
  async remove(planId: string, envelopeId: string): Promise<EnvelopeDto> {
    const envelope = await this.find(planId, envelopeId);
    const previous = envelope.photoFile;
    if (previous) {
      envelope.photoFile = null;
      envelope.photoUpdatedAt = null;
      await this.envelopes.save(envelope);
      await this.discard(previous);
    }
    return EnvelopeDto.fromEntity(envelope);
  }

  // The stored file of the envelope; 404 when it has no photo or the file is gone.
  async open(planId: string, envelopeId: string): Promise<PhotoFile> {
    const envelope = await this.find(planId, envelopeId);
    if (!envelope.photoFile) {
      throw new NotFoundException('The envelope has no photo');
    }
    const path = this.pathOf(envelope.photoFile);
    try {
      const { size } = await stat(path);
      return { stream: createReadStream(path), size };
    } catch {
      throw new NotFoundException('The envelope has no photo');
    }
  }

  // Deletes a stored file by its key; a file that is already gone is fine.
  async discard(key: string): Promise<void> {
    try {
      await unlink(this.pathOf(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  private async resize(bytes: Buffer): Promise<Buffer> {
    if (detectImageKind(bytes) === null) {
      throw new UnsupportedMediaTypeException(NOT_AN_IMAGE);
    }
    try {
      return await sharp(bytes, { limitInputPixels: PHOTO_MAX_PIXELS })
        .rotate()
        .flatten({ background: '#ffffff' })
        .resize({ width: PHOTO_WIDTH, withoutEnlargement: true })
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer();
    } catch {
      // The signature was right but the content cannot be decoded as an image.
      throw new UnsupportedMediaTypeException(NOT_AN_IMAGE);
    }
  }

  private pathOf(key: string): string {
    const path = resolve(join(this.root, key));
    if (!path.startsWith(this.root + sep)) {
      throw new Error(`Photo key escapes the photos directory: ${key}`);
    }
    return path;
  }

  private async find(planId: string, envelopeId: string): Promise<Envelope> {
    const envelope = await this.envelopes.findOneBy({
      id: envelopeId,
      planId,
    });
    if (!envelope) {
      throw new NotFoundException('Envelope not found');
    }
    return envelope;
  }
}
