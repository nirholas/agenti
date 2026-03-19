// @ts-nocheck
/**
 * Note Encryption Utilities
 * AES-256-GCM encryption for secure note storage
 */

import type { Note } from './types';
import { DecryptionError, InvalidNoteError } from './errors';

/** Encrypted note format */
export interface EncryptedNote {
  version: number;
  salt: string;      // Base64
  iv: string;        // Base64
  ciphertext: string; // Base64
  tag: string;       // Base64 (for verification)
}

/**
 * Derive encryption key from password using PBKDF2
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a note with a password
 * @param note - The note to encrypt
 * @param password - Password for encryption
 * @returns Encrypted note as base64 string
 *
 * @example
 * const encrypted = await encryptNote(myNote, 'my-secret-password');
 * // Store `encrypted` safely - it's a single base64 string
 */
export async function encryptNote(note: Note, password: string): Promise<string> {
  if (!note || !note.version || !note.commitments) {
    throw new InvalidNoteError('Invalid note structure');
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);

  const encoder = new TextEncoder();
  const plaintext = encoder.encode(JSON.stringify(note));

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  );

  // GCM includes auth tag in the ciphertext (last 16 bytes)
  const encrypted: EncryptedNote = {
    version: 1,
    salt: btoa(String.fromCharCode(...salt)),
    iv: btoa(String.fromCharCode(...iv)),
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    tag: '', // Tag is included in ciphertext for GCM
  };

  return btoa(JSON.stringify(encrypted));
}

/**
 * Decrypt an encrypted note
 * @param encryptedString - Base64 encrypted note string
 * @param password - Password for decryption
 * @returns Decrypted note
 *
 * @example
 * const note = await decryptNote(encryptedString, 'my-secret-password');
 */
export async function decryptNote(encryptedString: string, password: string): Promise<Note> {
  try {
    const encrypted: EncryptedNote = JSON.parse(atob(encryptedString));

    if (encrypted.version !== 1) {
      throw new DecryptionError('Unsupported encryption version');
    }

    const salt = Uint8Array.from(atob(encrypted.salt), c => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(encrypted.iv), c => c.charCodeAt(0));
    const ciphertext = Uint8Array.from(atob(encrypted.ciphertext), c => c.charCodeAt(0));

    const key = await deriveKey(password, salt);

    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    const decoder = new TextDecoder();
    const note = JSON.parse(decoder.decode(plaintext)) as Note;

    // Validate note structure
    if (!note.version || !note.commitments || !Array.isArray(note.commitments)) {
      throw new InvalidNoteError('Decrypted data is not a valid note');
    }

    return note;
  } catch (error) {
    if (error instanceof DecryptionError || error instanceof InvalidNoteError) {
      throw error;
    }
    throw new DecryptionError('Failed to decrypt note. Wrong password?');
  }
}

/**
 * Check if a string is an encrypted note
 */
export function isEncryptedNote(str: string): boolean {
  try {
    const decoded = JSON.parse(atob(str));
    return decoded.version && decoded.salt && decoded.iv && decoded.ciphertext;
  } catch {
    return false;
  }
}
