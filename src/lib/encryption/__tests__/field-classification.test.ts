import { getClassification, FIELD_CLASSIFICATIONS } from '../field-classification';

describe('FIELD_CLASSIFICATIONS', () => {
  it('has an entry for each expected entity type', () => {
    const prefixes = FIELD_CLASSIFICATIONS.map(c => c.skPrefix);
    expect(prefixes).toContain('META');
    expect(prefixes).toContain('ASSET#');
    expect(prefixes).toContain('CHAT#');
    expect(prefixes).toContain('CHAT_SUMMARY#');
    expect(prefixes).toContain('AUDIT_LOG#');
    expect(prefixes).toContain('GUIDANCE#');
    expect(prefixes).toContain('RADAR#');
    expect(prefixes).toContain('CASHFLOW#');
  });
});

describe('getClassification', () => {
  it('resolves META exactly', () => {
    const c = getClassification('META');
    expect(c).toBeDefined();
    expect(c!.encryptedFields).toContain('budgetPaycheck');
    expect(c!.encryptedFields).toContain('targetMonthlyDividend');
    expect(c!.encryptedFields).toContain('goals');
    // Plaintext fields must NOT appear
    expect(c!.encryptedFields).not.toContain('strategy');
    expect(c!.encryptedFields).not.toContain('riskTolerance');
  });

  it('resolves ASSET# by prefix', () => {
    const c = getClassification('ASSET#abc-123');
    expect(c).toBeDefined();
    expect(c!.encryptedFields).toContain('quantity');
    expect(c!.encryptedFields).toContain('marketValue');
    expect(c!.encryptedFields).toContain('accountNumber');
    expect(c!.encryptedFields).not.toContain('ticker');
    expect(c!.encryptedFields).not.toContain('sector');
  });

  it('resolves CHAT# by prefix', () => {
    const c = getClassification('CHAT#2025-01-01T00:00:00.000Z');
    expect(c).toBeDefined();
    expect(c!.encryptedFields).toContain('userMessage');
    expect(c!.encryptedFields).toContain('responses');
    expect(c!.encryptedFields).not.toContain('selectedPersonas');
  });

  it('resolves CHAT_SUMMARY# by prefix', () => {
    const c = getClassification('CHAT_SUMMARY#advisor-en');
    expect(c).toBeDefined();
    expect(c!.encryptedFields).toContain('summary');
    expect(c!.encryptedFields).not.toContain('personaId');
  });

  it('resolves AUDIT_LOG# by prefix', () => {
    const c = getClassification('AUDIT_LOG#2025-01-01T00:00:00.000Z#uuid');
    expect(c).toBeDefined();
    expect(c!.encryptedFields).toContain('mutations');
    expect(c!.encryptedFields).not.toContain('source');
  });

  it('resolves GUIDANCE# by prefix', () => {
    const c = getClassification('GUIDANCE#directive-id#AAPL');
    expect(c).toBeDefined();
    expect(c!.encryptedFields).toContain('response');
    expect(c!.encryptedFields).toContain('requestSnapshot');
  });

  it('resolves RADAR# by prefix', () => {
    const c = getClassification('RADAR#directive-id');
    expect(c).toBeDefined();
    expect(c!.encryptedFields).toContain('response');
    expect(c!.encryptedFields).toContain('requestSnapshot');
  });

  it('resolves CASHFLOW# by prefix', () => {
    const c = getClassification('CASHFLOW#2025-01');
    expect(c).toBeDefined();
    expect(c!.encryptedFields).toContain('income');
    expect(c!.encryptedFields).toContain('expenses');
    expect(c!.encryptedFields).toContain('cashReserves');
    expect(c!.encryptedFields).not.toContain('year');
    expect(c!.encryptedFields).not.toContain('month');
  });

  it('returns undefined for USER# (no financial data)', () => {
    expect(getClassification('USER#user@example.com')).toBeUndefined();
  });

  it('returns undefined for GLOBAL entities', () => {
    expect(getClassification('GLOBAL')).toBeUndefined();
    expect(getClassification('ENCRYPTION_KEY')).toBeUndefined();
  });

  it('returns undefined for NEWS_CACHE# (public data)', () => {
    expect(getClassification('NEWS_CACHE#2025-01-01')).toBeUndefined();
  });

  it('does not match CHAT_SUMMARY# when only CHAT# is tested', () => {
    // CHAT# prefix must not accidentally match CHAT_SUMMARY# and vice versa
    const chatClassification = getClassification('CHAT#2025-01-01');
    const summaryClassification = getClassification('CHAT_SUMMARY#advisor-en');
    expect(chatClassification).not.toEqual(summaryClassification);
    expect(chatClassification!.encryptedFields).not.toContain('summary');
    expect(summaryClassification!.encryptedFields).not.toContain('userMessage');
  });
});
