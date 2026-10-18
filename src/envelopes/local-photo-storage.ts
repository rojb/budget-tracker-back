import { createReadStream } from 'node:fs';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import type { Readable } from 'node:stream';
import { PhotoStorage } from './photo-storage.js';

// Photos on local disk under PHOTOS_DIR (PRD §9). The key is built by the service from UUIDs and
// random hex and never from user input, so it cannot point outside the root; `pathOf` enforces it.
export class LocalPhotoStorage extends PhotoStorage {
  private readonly root: string;

  constructor(directory: string) {
    super();
    this.root = resolve(directory);
  }

  async put(key: string, bytes: Buffer): Promise<void> {
    const path = this.pathOf(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
  }

  async get(key: string): Promise<{ stream: Readable; size: number } | null> {
    const path = this.pathOf(key);
    try {
      const { size } = await stat(path);
      return { stream: createReadStream(path), size };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.pathOf(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  private pathOf(key: string): string {
    const path = resolve(join(this.root, key));
    if (!path.startsWith(this.root + sep)) {
      throw new Error(`Photo key escapes the photos directory: ${key}`);
    }
    return path;
  }
}
