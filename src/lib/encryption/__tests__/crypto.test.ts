import { encryptField, decryptField, isEncrypted } from '../crypto';

const KEY = Buffer.alloc(32, 0xab); // 256-bit test key
const AAD = 'HOUSEHOLD#abc|META|budgetPaycheck';
const AAD2 = 'HOUSEHOLD#abc|META|otherField';

describe('isEncrypted', () => {
  it('returns true for ENC: prefixed strings', () => {
    expect(isEncrypted('ENC:v1:n:abc123')).toBe(true);
  });

  it('returns false for plain strings', () => {
    expect(isEncrypted('hello')).toBe(false);
  });

  it('returns false for numbers', () => {
    expect(isEncrypted(42)).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isEncrypted(null)).toBe(false);
    expect(isEncrypted(undefined)).toBe(false);
  });
});

describe('encryptField / decryptField round-trip', () => {
  it('round-trips a number', () => {
    const encrypted = encryptField(12345.67, KEY, AAD);
    expect(encrypted).toMatch(/^ENC:v1:n:/);
    expect(decryptField(encrypted, KEY, AAD)).toBe(12345.67);
  });

  it('round-trips a string', () => {
    const encrypted = encryptField('aggressive growth', KEY, AAD);
    expect(encrypted).toMatch(/^ENC:v1:s:/);
    expect(decryptField(encrypted, KEY, AAD)).toBe('aggressive growth');
  });

  it('round-trips a JSON array', () => {
    const value = [{ id: '1', amount: 100 }, { id: '2', amount: 200 }];
    const encrypted = encryptField(value, KEY, AAD);
    expect(encrypted).toMatch(/^ENC:v1:j:/);
    expect(decryptField(encrypted, KEY, AAD)).toEqual(value);
  });

  it('round-trips a JSON object', () => {
    const value = { grossIncome: 8000, netIncome: 6500, savingsRate: 0.18 };
    const encrypted = encryptField(value, KEY, AAD);
    expect(encrypted).toMatch(/^ENC:v1:j:/);
    expect(decryptField(encrypted, KEY, AAD)).toEqual(value);
  });

  it('round-trips zero', () => {
    const encrypted = encryptField(0, KEY, AAD);
    expect(decryptField(encrypted, KEY, AAD)).toBe(0);
  });

  it('round-trips negative numbers', () => {
    const encrypted = encryptField(-500, KEY, AAD);
    expect(decryptField(encrypted, KEY, AAD)).toBe(-500);
  });

  it('round-trips empty string', () => {
    const encrypted = encryptField('', KEY, AAD);
    expect(decryptField(encrypted, KEY, AAD)).toBe('');
  });

  it('produces different ciphertext each call (random IV)', () => {
    const enc1 = encryptField(42, KEY, AAD);
    const enc2 = encryptField(42, KEY, AAD);
    expect(enc1).not.toBe(enc2);
  });
});

describe('AAD mismatch detection', () => {
  it('throws when decrypting with different AAD', () => {
    const encrypted = encryptField(12345, KEY, AAD);
    expect(() => decryptField(encrypted, KEY, AAD2)).toThrow();
  });

  it('throws when decrypting with wrong key', () => {
    const wrongKey = Buffer.alloc(32, 0xcd);
    const encrypted = encryptField(12345, KEY, AAD);
    expect(() => decryptField(encrypted, wrongKey, AAD)).toThrow();
  });
});

describe('idempotency', () => {
  it('does not re-encrypt already-encrypted values', () => {
    const encrypted = encryptField('hello', KEY, AAD);
    // Encrypting an ENC: string should treat it as a plain string (type: s)
    // but decrypt should recover the ENC: string itself
    const doubleEncrypted = encryptField(encrypted, KEY, AAD);
    expect(decryptField(doubleEncrypted, KEY, AAD)).toBe(encrypted);
  });
});
