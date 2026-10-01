// The kind of image a file is, decided by its first bytes and nothing else: the file name and the
// content type the client declares are never trusted (capability `envelope-goals`, "Goal photo").
export type ImageKind = 'jpeg' | 'png' | 'webp';

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function startsWith(bytes: Buffer, signature: number[], offset = 0): boolean {
  return (
    bytes.length >= offset + signature.length &&
    signature.every((value, index) => bytes[offset + index] === value)
  );
}

export function detectImageKind(bytes: Buffer): ImageKind | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return 'jpeg';
  }
  if (startsWith(bytes, PNG)) {
    return 'png';
  }
  // RIFF....WEBP
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return 'webp';
  }
  return null;
}
