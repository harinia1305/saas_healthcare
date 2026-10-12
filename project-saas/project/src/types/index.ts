export type Role = 'provider' | 'billing_admin' | 'compliance_auditor' | 'patient';

export interface RoleConfig {
  id: Role;
  label: string;
  description: string;
  canViewPhi: boolean;
  canSubmitClaims: boolean;
  canManageBills: boolean;
  canApproveRefunds: boolean;
  canConfigureFees: boolean;
  canViewAuditLogs: boolean;
  canExportData: boolean;
}

export const ROLES: Record<Role, RoleConfig> = {
  provider: {
    id: 'provider',
    label: 'Provider',
    description: 'Physicians and clinical staff — view patient records, encounters, and diagnoses',
    canViewPhi: true,
    canSubmitClaims: false,
    canManageBills: false,
    canApproveRefunds: false,
    canConfigureFees: false,
    canViewAuditLogs: false,
    canExportData: false,
  },
  billing_admin: {
    id: 'billing_admin',
    label: 'Billing Admin',
    description: 'Billing staff — manage bills, submit claims, approve refunds, configure fees',
    canViewPhi: true,
    canSubmitClaims: true,
    canManageBills: true,
    canApproveRefunds: true,
    canConfigureFees: true,
    canViewAuditLogs: false,
    canExportData: true,
  },
  compliance_auditor: {
    id: 'compliance_auditor',
    label: 'Compliance Auditor',
    description: 'Compliance team — review audit logs, monitor PHI access, generate reports',
    canViewPhi: true,
    canSubmitClaims: false,
    canManageBills: false,
    canApproveRefunds: false,
    canConfigureFees: false,
    canViewAuditLogs: true,
    canExportData: true,
  },
  patient: {
    id: 'patient',
    label: 'Patient',
    description: 'Patient portal — view own bills, claims, and payment history',
    canViewPhi: false,
    canSubmitClaims: false,
    canManageBills: false,
    canApproveRefunds: false,
    canConfigureFees: false,
    canViewAuditLogs: false,
    canExportData: false,
  },
};

export interface Patient {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  ssn_encrypted: string | null;
  address_encrypted: string | null;
  phone: string | null;
  email: string | null;
  insurance_provider: string | null;
  insurance_member_id: string | null;
  insurance_group_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Encounter {
  id: string;
  patient_id: string;
  encounter_date: string;
  encounter_type: string;
  provider_name: string;
  provider_npi: string | null;
  department: string | null;
  chief_complaint: string | null;
  diagnosis_codes: string[] | null;
  procedure_codes: string[] | null;
  status: string;
  notes: string | null;
}

export interface MedicalCode {
  id: string;
  code: string;
  code_type: 'ICD-10' | 'CPT' | 'HCPCS';
  description: string;
  category: string | null;
  default_fee: number | null;
  is_active: boolean;
}

export interface Bill {
  id: string;
  bill_number: string;
  patient_id: string;
  encounter_id: string | null;
  billing_period_start: string | null;
  billing_period_end: string | null;
  subtotal: number;
  insurance_adjustments: number;
  patient_adjustments: number;
  tax: number;
  total_amount: number;
  insurance_paid: number;
  patient_paid: number;
  balance_due: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface BillItem {
  id: string;
  bill_id: string;
  cpt_code: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  is_insurance_covered: boolean;
  adjustment_amount: number;
}

export interface Claim {
  id: string;
  claim_number: string;
  bill_id: string;
  patient_id: string;
  insurance_provider: string;
  insurance_member_id: string | null;
  total_billed: number;
  total_approved: number;
  total_paid: number;
  patient_responsibility: number;
  denial_reason: string | null;
  adjudication_date: string | null;
  submitted_date: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export type RefundStatus =
  | 'pending' | 'calculated' | 'approved' | 'processing' | 'completed' | 'denied' | 'cancelled';

export interface Refund {
  id: string;
  refund_number: string;
  patient_id: string;
  bill_id: string | null;
  claim_id: string | null;
  refund_type: string;
  original_payment_amount: number;
  refund_amount: number;
  calculated_refund_amount: number;
  processing_fee: number;
  net_refund_amount: number;
  reason: string | null;
  payment_method: string;
  status: RefundStatus;
  calculated_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  processed_at: string | null;
  completed_at: string | null;
  denied_at: string | null;
  denied_reason: string | null;
  processing_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeeSchedule {
  id: string;
  name: string;
  insurance_provider: string | null;
  provider_name: string | null;
  encounter_type: string | null;
  copay_amount: number;
  deductible_amount: number;
  coinsurance_percent: number;
  specialist_fee: number;
  max_out_of_pocket: number | null;
  is_active: boolean;
  effective_date: string;
  expiry_date: string | null;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  field_changes: Record<string, unknown> | null;
  access_context: string | null;
  ip_address: string | null;
  user_agent: string | null;
  phi_accessed: boolean;
  exported: boolean;
  timestamp: string;
}

export interface PatientWithDetails extends Patient {
  encounters?: Encounter[];
  bills?: Bill[];
  claims?: Claim[];
}

export interface BillWithDetails extends Bill {
  bill_items?: BillItem[];
  patients?: Patient;
}

export interface ClaimWithDetails extends Claim {
  patients?: Patient;
  bills?: Bill;
}
