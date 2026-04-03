export interface DataKey {
  /** Plaintext 256-bit DEK — kept in Lambda memory only */
  plaintextKey: Buffer;
  /** Identifier for which CMK was used (for audit/diagnostics) */
  keyId: string;
}

export interface KeyProvider {
  /**
   * Returns the active data encryption key.
   * @param householdId - accepted for Phase 2 compatibility (ignored in Phase 1)
   */
  getDataKey(householdId?: string): Promise<DataKey>;
}

export interface KeyProviderConfig {
  /** AWS KMS CMK ID or ARN */
  kmsKeyId: string;
  /** DynamoDB table name (to store/read encrypted DEK) */
  tableName: string;
}
