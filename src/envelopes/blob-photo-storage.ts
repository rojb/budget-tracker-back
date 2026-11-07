import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { BlobNotFoundError, del, get, put } from '@vercel/blob';
import { PhotoStorage } from './photo-storage.js';

// Photos in a Vercel Blob store, for runtimes without a writable disk (Vercel Functions). Blobs are
// stored with `private` access: they have no public URL and are only readable through the SDK with
// the store token, so photos stay reachable only via the authenticated controller (FR-41).
export class BlobPhotoStorage extends PhotoStorage {
  constructor(private readonly token: string) {
    super();
  }

  async put(key: string, bytes: Buffer): Promise<void> {
    // The key already carries random hex, so no extra suffix; overwriting is harmless.
    await put(this.pathnameOf(key), bytes, {
      access: 'private',
      token: this.token,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'image/jpeg',
    });
  }

  async get(key: string): Promise<{ stream: Readable; size: number } | null> {
    const result = await get(this.pathnameOf(key), {
      access: 'private',
      token: this.token,
    });
    if (!result || result.statusCode !== 200) {
      return null;
    }
    return {
      stream: Readable.fromWeb(result.stream as WebReadableStream),
      size: result.blob.size,
    };
  }

  async delete(key: string): Promise<void> {
    try {
      await del(this.pathnameOf(key), { token: this.token });
    } catch (error) {
      if (!(error instanceof BlobNotFoundError)) {
        throw error;
      }
    }
  }

  private pathnameOf(key: string): string {
    return `photos/${key}`;
  }
}
