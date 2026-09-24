export const AGREEMENT_TYPES = [
  "HOUSE_RENTAL",
  "OFFICE_RENTAL",
  "SHORT_TERM_RENTAL",
  "SHOP_RENTAL",
  "TERMS",
  "OTHERS",
] as const;

export const AGREEMENT_STATUS = [
  "PENDING",
  "PROCESSING",
  "RESTART",
  "SUCCESS",
  "FAILED",
] as const;

export const AGREEMENT_PARTY_ROLES = ["LANDLORD", "TENANT", "OTHER"] as const;

export const AGREEMENT_DEPOSIT_TYPES = [
  "SECURITY_DEPOSIT",
  "ADVANCE_RENT",
  "UTILITY_FEE",
  "OTHER",
] as const;

export type AgreementType = (typeof AGREEMENT_TYPES)[number];
export type AgreementStatus = (typeof AGREEMENT_STATUS)[number];
export type AgreementPartyRole = (typeof AGREEMENT_PARTY_ROLES)[number];
export type AgreementDepositType = (typeof AGREEMENT_DEPOSIT_TYPES)[number];

export const AGREEMENT_TYPE_DISPLAY_LABELS: Record<AgreementType, string> = {
  HOUSE_RENTAL: "House Rental Agreement",
  OFFICE_RENTAL: "Office Rental Agreement",
  SHORT_TERM_RENTAL: "Short-Term Rental Agreement",
  SHOP_RENTAL: "Shop Rental Agreement",
  TERMS: "Terms and Conditions",
  OTHERS: "Other Contract",
};

export const AGREEMENT_STATUS_DISPLAY_LABELS: Record<AgreementStatus, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  RESTART: "Restart",
  SUCCESS: "Success",
  FAILED: "Failed",
};

export const AGREEMENT_DEPOSIT_TYPE_DISPLAY_LABELS: Record<AgreementDepositType, string> = {
  SECURITY_DEPOSIT: "Security Deposit",
  ADVANCE_RENT: "Advance Rent",
  UTILITY_FEE: "Utility Fee",
  OTHER: "Others",
};

export const AGREEMENT_PARTY_ROLE_DISPLAY_LABELS: Record<AgreementPartyRole, string> = {
  LANDLORD: "Landlord",
  TENANT: "Tenant",
  OTHER: "Other",
};

export function getAgreementTypeDisplayLabel(type?: string | null): string {
  if (!type) return "Document";
  return AGREEMENT_TYPE_DISPLAY_LABELS[type as AgreementType] || type;
}

export function getAgreementStatusDisplayLabel(status?: string | null): string {
  if (!status) return "Pending";
  return AGREEMENT_STATUS_DISPLAY_LABELS[status as AgreementStatus] || status;
}

export function getPartyRoleDisplayLabel(role?: string | null): string {
  if (!role) return "Other";
  return AGREEMENT_PARTY_ROLE_DISPLAY_LABELS[role as AgreementPartyRole] || role;
}

export function getDepositTypeDisplayLabel(depositType?: string | null): string {
  if (!depositType) return "Deposit";
  return (
    AGREEMENT_DEPOSIT_TYPE_DISPLAY_LABELS[depositType as AgreementDepositType] ||
    depositType
  );
}

export const RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type RiskLevelType = (typeof RISK_LEVELS)[number];

export const RISK_LEVEL_DISPLAY_LABELS: Record<RiskLevelType, string> = {
  LOW: "Low Risk",
  MEDIUM: "Medium Risk",
  HIGH: "High Risk",
  CRITICAL: "Critical Risk",
};

export function getRiskLevelDisplayLabel(level?: string | null): string {
  if (!level) return "Low Risk";
  return RISK_LEVEL_DISPLAY_LABELS[level as RiskLevelType] || level;
}

export const SECTION_CLAUSE_TYPES = [
  "GENERAL",
  "PARTIES",
  "TERM",
  "RENT_PAYMENT",
  "DEPOSIT",
  "MAINTENANCE",
  "REPAIRS",
  "TERMINATION",
  "NOTICE_PERIOD",
  "RESTRICTIONS",
  "UTILITIES",
  "INSURANCE",
  "EVICTION",
  "DISPUTE_RESOLUTION",
  "INDEMNIFICATION",
  "RENEWAL",
] as const;

export type SectionClauseType = (typeof SECTION_CLAUSE_TYPES)[number];

export const SECTION_CLAUSE_TYPE_DISPLAY_LABELS: Record<SectionClauseType, string> = {
  GENERAL: "General",
  PARTIES: "Parties",
  TERM: "Term",
  RENT_PAYMENT: "Rent Payment",
  DEPOSIT: "Deposit",
  MAINTENANCE: "Maintenance",
  REPAIRS: "Repairs",
  TERMINATION: "Termination",
  NOTICE_PERIOD: "Notice Period",
  RESTRICTIONS: "Restrictions",
  UTILITIES: "Utilities",
  INSURANCE: "Insurance",
  EVICTION: "Eviction",
  DISPUTE_RESOLUTION: "Dispute Resolution",
  INDEMNIFICATION: "Indemnification",
  RENEWAL: "Renewal",
};

export function getClauseTypeDisplayLabel(type?: string | null): string {
  if (!type) return "General";
  return SECTION_CLAUSE_TYPE_DISPLAY_LABELS[type as SectionClauseType] || type;
}

export const FILE_STATUS = ["PENDING", "UPLOADED"] as const;
export type FileStatus = (typeof FILE_STATUS)[number];

export const FILE_STATUS_DISPLAY_LABELS: Record<FileStatus, string> = {
  PENDING: "Pending",
  UPLOADED: "Uploaded",
};

export function getFileStatusDisplayLabel(status?: string | null): string {
  if (!status) return "Pending";
  return FILE_STATUS_DISPLAY_LABELS[status as FileStatus] || status;
}
