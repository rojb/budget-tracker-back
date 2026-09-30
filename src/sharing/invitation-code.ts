import { randomInt } from 'node:crypto';

// No 0/O, 1/I/L: codes are read aloud and typed from a phone.
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;
export const INVITE_LINK_BASE = 'https://sobres.app/unirse/';
export const INVITATION_TTL_MS = 24 * 60 * 60 * 1000;

export function generateCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

// "k7m-4qx", " K7M4QX " -> "K7M4QX".
export function normalizeCode(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase();
}

// "K7M4QX" -> "K7M-4QX".
export function displayCode(code: string): string {
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

export function inviteLink(code: string): string {
  return `${INVITE_LINK_BASE}${code}`;
}
