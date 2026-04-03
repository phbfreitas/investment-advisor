import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const PREFIX = 'ENC:v1';

type TypeTag = 'n' | 's' | 'j';

function typeTagFor(value: unknown): TypeTag {
  if (typeof value === 'number') return 'n';
  if (typeof value === 'string') return 's';
  return 'j';
}

function serialize(value: unknown, tag: TypeTag): Buffer {
  if (tag === 'n') return Buffer.from(String(value), 'utf8');
  if (tag === 's') return Buffer.from(value as string, 'utf8');
  return Buffer.from(JSON.stringify(value), 'utf8');
}

function deserialize(data: Buffer, tag: TypeTag): unknown {
  const str = data.toString('utf8');
  if (tag === 'n') return Number(str);
  if (tag === 's') return str;
  return JSON.parse(str);
}

export function encryptField(plaintext: unknown, key: Buffer, aad: string): string {
  const tag = typeTagFor(plaintext);
  const plainBuffer = serialize(plaintext, tag);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));

  const ciphertext = Buffer.concat([cipher.update(plainBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const payload = Buffer.concat([iv, ciphertext, authTag]);
  return `${PREFIX}:${tag}:${payload.toString('base64')}`;
}

export function decryptField(encrypted: string, key: Buffer, aad: string): unknown {
  const parts = encrypted.split(':');
  if (parts.length !== 4 || parts[0] !== 'ENC' || parts[1] !== 'v1') {
    throw new Error(`Invalid encrypted format: ${encrypted.slice(0, 20)}`);
  }

  const tag = parts[2] as TypeTag;
  const payload = Buffer.from(parts[3], 'base64');

  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(payload.length - AUTH_TAG_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH, payload.length - AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(authTag);

  const plainBuffer = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return deserialize(plainBuffer, tag);
}

export function isEncrypted(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith('ENC:');
}
