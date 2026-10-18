import type { Readable } from 'node:stream';

// Where the bytes of the goal photos (FR-41) live. The service decides what is stored and under
// which key; an adapter only moves bytes, so local disk and object storage are interchangeable.
// An abstract class (not an interface) so it can be the Nest injection token.
export abstract class PhotoStorage {
  abstract put(key: string, bytes: Buffer): Promise<void>;

  // `null` when there is no object under the key.
  abstract get(key: string): Promise<{ stream: Readable; size: number } | null>;

  // An object that is already gone is fine.
  abstract delete(key: string): Promise<void>;
}
