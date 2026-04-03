export interface FieldClassification {
  /** Exact SK string or prefix that ends with '#' for prefix matching */
  skPrefix: string;
  encryptedFields: string[];
}

export const FIELD_CLASSIFICATIONS: FieldClassification[] = [
  {
    // Profile / household settings
    skPrefix: 'META',
    encryptedFields: [
      // Budget income
      'budgetPaycheck', 'budgetRentalIncome', 'budgetDividends', 'budgetBonus', 'budgetOtherIncome',
      // Budget expenses
      'budgetFixedHome', 'budgetFixedUtilities', 'budgetFixedCar', 'budgetFixedFood',
      'budgetDiscretionary', 'budgetRentalExpenses',
      // Wealth assets
      'wealthAssetCash', 'wealthAssetCar', 'wealthAssetPrimaryResidence',
      'wealthAssetRentalProperties', 'wealthAssetOther',
      // Wealth liabilities
      'wealthLiabilityMortgage', 'wealthLiabilityHeloc', 'wealthLiabilityRentalMortgage',
      'wealthLiabilityRentalHeloc', 'wealthLiabilityCreditCards', 'wealthLiabilityCarLease',
      // Goals
      'targetMonthlyDividend', 'goals',
    ],
  },
  {
    // Investment holdings
    skPrefix: 'ASSET#',
    encryptedFields: [
      'quantity', 'liveTickerPrice', 'bookCost', 'marketValue', 'profitLoss',
      'yield', 'expectedAnnualDividends', 'oneYearReturn', 'threeYearReturn', 'fiveYearReturn',
      'managementFee', 'volatility', 'beta', 'accountNumber', 'account',
    ],
  },
  {
    // Chat exchanges — responses serialized as JSON blob
    skPrefix: 'CHAT#',
    encryptedFields: ['userMessage', 'responses'],
  },
  {
    // Per-persona conversation summaries
    skPrefix: 'CHAT_SUMMARY#',
    encryptedFields: ['summary'],
  },
  {
    // Audit trail — mutations serialized as JSON blob with before/after snapshots
    skPrefix: 'AUDIT_LOG#',
    encryptedFields: ['mutations'],
  },
  {
    // Guidance cache (per directive + ticker)
    skPrefix: 'GUIDANCE#',
    encryptedFields: ['response', 'requestSnapshot'],
  },
  {
    // Radar / Deep Critique cache
    skPrefix: 'RADAR#',
    encryptedFields: ['response', 'requestSnapshot'],
  },
  {
    // Monthly cashflow records
    skPrefix: 'CASHFLOW#',
    encryptedFields: ['income', 'expenses', 'cashReserves'],
  },
];

/**
 * Returns the classification for a given SK value, or undefined if the entity
 * type is not subject to encryption (USER#, GLOBAL, NEWS_CACHE#, etc.).
 *
 * Matching rules:
 * - If skPrefix ends with '#', match by startsWith (prefix match)
 * - Otherwise, match exactly (e.g. 'META')
 */
export function getClassification(sk: string): FieldClassification | undefined {
  return FIELD_CLASSIFICATIONS.find(c =>
    c.skPrefix.endsWith('#') ? sk.startsWith(c.skPrefix) : sk === c.skPrefix
  );
}
