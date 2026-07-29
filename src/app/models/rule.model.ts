export type PaymentMethod = 'cartao' | 'pix' | 'voucher' | 'boleto';

export type RuleLogic = 'AND' | 'OR';

export type RuleAction = 'APPROVE' | 'REVIEW' | 'DECLINE';

export type RuleLayer = '1st' | '2nd';

export interface Store {
  id: string;
  name: string;
  isGlobal?: boolean;
}

export interface ClauseParameter {
  id: string;
  name: string;
  operators: string[];
  defaultValue?: string | number;
}

export interface RuleClause {
  id: string;
  parameterId: string;
  parameterName: string;
  operator: string;
  value: string | number;
}

export interface Rule {
  id: string;
  name: string;
  description: string;
  storeId: string; // 'ALL' = Global rule for all stores
  storeName: string;
  payments: PaymentMethod[];
  logic: RuleLogic;
  action: RuleAction;
  layer: RuleLayer;
  priority: number;
  ghostMode: boolean;
  isGhostMode?: boolean; // REST API Contract alias
  active: boolean;
  clauses: RuleClause[];
  createdAt: string;
  updatedAt: string;
  // CMN 4.966 & LGPD Audit Metadata
  createdBy?: string;
  approvedBy?: string;
  prdOrigin?: string;
  auditTimestamp?: string; // ISO 8601 UTC format
}

export interface TransactionSimulation {
  storeId: string;
  paymentMethod: PaymentMethod;
  orderValue: number;
  installments: number;
  cardBin: string;
  cardCountry: string;
  voucherPercent: number;
  sameCountryDelivery: string;
  customerEmail: string;
  attempts24h: number;
  riskScore: number;
  deviceFingerprintSeenInOtherAccount?: string;
  geoLocDivergent?: string;
}

export interface RetrospectiveImpactResult {
  totalAnalyzed: number;
  impactedOrders: number;
  impactedPercent: number;
  estimatedFraudSavings: number;
  falsePositiveRate: string;
  executionTimeMs: number;
  isCached?: boolean;
  matrix: {
    action: RuleAction;
    actionLabel: string;
    currentVolume: number;
    currentPercent: number;
    proposedVolume: number;
    proposedPercent: number;
    deltaVolume: number;
    deltaPercent: number;
  }[];
  executiveInsight: string;
}


export interface RuleMatchResult {
  rule: Rule;
  matched: boolean;
  clauseResults: { clause: RuleClause; passed: boolean }[];
  effectiveAction: RuleAction;
  isGhost: boolean;
}

export interface SimulationResult {
  finalDecision: RuleAction | 'NEUTRAL';
  matchedRules: RuleMatchResult[];
  ghostRulesTriggered: RuleMatchResult[];
  explanation: string;
}
