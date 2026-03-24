export interface AssetSnapshot {
  quantity: number;
  marketValue: number;
  bookCost: number;
  profitLoss: number;
  liveTickerPrice: number;
  currency: string;
  account: string;
  accountNumber: string;
  accountType: string;
  sector: string;
  market: string;
  securityType: string;
  strategyType: string;
  call: string;
  managementStyle: string;
  externalRating: string;
  managementFee: number;
  yield: number;
  oneYearReturn: number;
  threeYearReturn: number;
  fiveYearReturn: number;
  exDividendDate: string;
  analystConsensus: string;
  beta: number;
  riskFlag: string;
  risk: string;
  volatility: number;
  expectedAnnualDividends: number;
  importSource: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditMutation {
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  ticker: string;
  assetSK: string;
  before: AssetSnapshot | null;
  after: AssetSnapshot | null;
}

export type AuditSource = 'PDF_IMPORT' | 'MANUAL_EDIT' | 'ROLLBACK';

export interface AuditLog {
  PK: string;
  SK: string;
  type: 'AUDIT_LOG';
  source: AuditSource;
  metadata: string;
  mutations: AuditMutation[];
  createdAt: string;
}
