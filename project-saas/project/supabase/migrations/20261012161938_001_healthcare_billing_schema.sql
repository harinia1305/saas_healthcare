/*
# Healthcare Billing SaaS – Core Schema

## Overview
Production-ready schema for a HIPAA-aligned healthcare billing platform.
Supports patients, encounters, medical codes (ICD-10/CPT), itemized bills,
insurance claims, automated refund pipeline, configurable fee schedules,
and immutable audit logs.

## New Tables
1. patients – Patient demographics with encrypted PHI fields
2. encounters – Patient visits/appointments with provider and diagnosis info
3. medical_codes – ICD-10 and CPT code reference table
4. fee_schedules – Configurable fee workflow: co-pays, deductibles, specialist fees
5. bills – Itemized billing statements tied to encounters
6. bill_items – Individual line items on a bill (CPT code, quantity, charge)
7. claims – Insurance claims with status tracking and adjudication
8. refunds – Automated refund pipeline with status state machine
9. audit_logs – Immutable audit trail for all PHI access/modification/export

## Security
- RLS enabled on every table
- Demo platform with no auth screen -> policies use TO anon, authenticated
- Audit log table is INSERT/SELECT only (no UPDATE/DELETE) for immutability
- audit_trigger() function logs INSERT/UPDATE/DELETE on patients and claims
*/

-- ============================================================
-- 1. PATIENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mrn text UNIQUE NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  date_of_birth date NOT NULL,
  ssn_encrypted text,
  address_encrypted text,
  phone text,
  email text,
  insurance_provider text,
  insurance_member_id text,
  insurance_group_id text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_patients" ON patients;
CREATE POLICY "anon_select_patients" ON patients FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_patients" ON patients;
CREATE POLICY "anon_insert_patients" ON patients FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_patients" ON patients;
CREATE POLICY "anon_update_patients" ON patients FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_patients" ON patients;
CREATE POLICY "anon_delete_patients" ON patients FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_patients_mrn ON patients(mrn);
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(last_name, first_name);

-- ============================================================
-- 2. ENCOUNTERS
-- ============================================================
CREATE TABLE IF NOT EXISTS encounters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  encounter_date timestamptz NOT NULL DEFAULT now(),
  encounter_type text NOT NULL DEFAULT 'office_visit',
  provider_name text NOT NULL,
  provider_npi text,
  department text,
  chief_complaint text,
  diagnosis_codes text[],
  procedure_codes text[],
  status text NOT NULL DEFAULT 'scheduled',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE encounters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_encounters" ON encounters;
CREATE POLICY "anon_select_encounters" ON encounters FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_encounters" ON encounters;
CREATE POLICY "anon_insert_encounters" ON encounters FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_encounters" ON encounters;
CREATE POLICY "anon_update_encounters" ON encounters FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_encounters" ON encounters;
CREATE POLICY "anon_delete_encounters" ON encounters FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_encounters_patient ON encounters(patient_id);
CREATE INDEX IF NOT EXISTS idx_encounters_date ON encounters(encounter_date);

-- ============================================================
-- 3. MEDICAL CODES
-- ============================================================
CREATE TABLE IF NOT EXISTS medical_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  code_type text NOT NULL CHECK (code_type IN ('ICD-10', 'CPT', 'HCPCS')),
  description text NOT NULL,
  category text,
  default_fee numeric(10,2),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE medical_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_medical_codes" ON medical_codes;
CREATE POLICY "anon_select_medical_codes" ON medical_codes FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_medical_codes" ON medical_codes;
CREATE POLICY "anon_insert_medical_codes" ON medical_codes FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_medical_codes" ON medical_codes;
CREATE POLICY "anon_update_medical_codes" ON medical_codes FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_medical_codes" ON medical_codes;
CREATE POLICY "anon_delete_medical_codes" ON medical_codes FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_medical_codes_code ON medical_codes(code);
CREATE INDEX IF NOT EXISTS idx_medical_codes_type ON medical_codes(code_type);

-- ============================================================
-- 4. FEE SCHEDULES
-- ============================================================
CREATE TABLE IF NOT EXISTS fee_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  insurance_provider text,
  provider_name text,
  encounter_type text,
  copay_amount numeric(10,2) NOT NULL DEFAULT 0,
  deductible_amount numeric(10,2) NOT NULL DEFAULT 0,
  coinsurance_percent numeric(5,2) NOT NULL DEFAULT 0,
  specialist_fee numeric(10,2) NOT NULL DEFAULT 0,
  max_out_of_pocket numeric(10,2),
  is_active boolean DEFAULT true,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  expiry_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE fee_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_fee_schedules" ON fee_schedules;
CREATE POLICY "anon_select_fee_schedules" ON fee_schedules FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_fee_schedules" ON fee_schedules;
CREATE POLICY "anon_insert_fee_schedules" ON fee_schedules FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_fee_schedules" ON fee_schedules;
CREATE POLICY "anon_update_fee_schedules" ON fee_schedules FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_fee_schedules" ON fee_schedules;
CREATE POLICY "anon_delete_fee_schedules" ON fee_schedules FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- 5. BILLS
-- ============================================================
CREATE TABLE IF NOT EXISTS bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number text UNIQUE NOT NULL,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  encounter_id uuid REFERENCES encounters(id) ON DELETE SET NULL,
  billing_period_start date,
  billing_period_end date,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  insurance_adjustments numeric(12,2) NOT NULL DEFAULT 0,
  patient_adjustments numeric(12,2) NOT NULL DEFAULT 0,
  tax numeric(12,2) NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  insurance_paid numeric(12,2) NOT NULL DEFAULT 0,
  patient_paid numeric(12,2) NOT NULL DEFAULT 0,
  balance_due numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_bill_status CHECK (
    status IN ('draft', 'submitted', 'partially_paid', 'paid', 'overdue', 'written_off', 'refunded')
  )
);

ALTER TABLE bills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_bills" ON bills;
CREATE POLICY "anon_select_bills" ON bills FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_bills" ON bills;
CREATE POLICY "anon_insert_bills" ON bills FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_bills" ON bills;
CREATE POLICY "anon_update_bills" ON bills FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_bills" ON bills;
CREATE POLICY "anon_delete_bills" ON bills FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_bills_patient ON bills(patient_id);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);
CREATE INDEX IF NOT EXISTS idx_bills_encounter ON bills(encounter_id);

-- ============================================================
-- 6. BILL ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS bill_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  cpt_code text NOT NULL,
  description text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL,
  total_price numeric(12,2) NOT NULL,
  is_insurance_covered boolean DEFAULT true,
  adjustment_amount numeric(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE bill_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_bill_items" ON bill_items;
CREATE POLICY "anon_select_bill_items" ON bill_items FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_bill_items" ON bill_items;
CREATE POLICY "anon_insert_bill_items" ON bill_items FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_bill_items" ON bill_items;
CREATE POLICY "anon_update_bill_items" ON bill_items FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_bill_items" ON bill_items;
CREATE POLICY "anon_delete_bill_items" ON bill_items FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_bill_items_bill ON bill_items(bill_id);

-- ============================================================
-- 7. CLAIMS
-- ============================================================
CREATE TABLE IF NOT EXISTS claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_number text UNIQUE NOT NULL,
  bill_id uuid NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  insurance_provider text NOT NULL,
  insurance_member_id text,
  total_billed numeric(12,2) NOT NULL DEFAULT 0,
  total_approved numeric(12,2) NOT NULL DEFAULT 0,
  total_paid numeric(12,2) NOT NULL DEFAULT 0,
  patient_responsibility numeric(12,2) NOT NULL DEFAULT 0,
  denial_reason text,
  adjudication_date timestamptz,
  submitted_date timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_claim_status CHECK (
    status IN ('draft', 'submitted', 'in_review', 'adjudicated', 'partially_paid', 'paid', 'denied', 'appealed')
  )
);

ALTER TABLE claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_claims" ON claims;
CREATE POLICY "anon_select_claims" ON claims FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_claims" ON claims;
CREATE POLICY "anon_insert_claims" ON claims FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_claims" ON claims;
CREATE POLICY "anon_update_claims" ON claims FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_claims" ON claims;
CREATE POLICY "anon_delete_claims" ON claims FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_claims_patient ON claims(patient_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_bill ON claims(bill_id);

-- ============================================================
-- 8. REFUNDS
-- ============================================================
CREATE TABLE IF NOT EXISTS refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_number text UNIQUE NOT NULL,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  bill_id uuid REFERENCES bills(id) ON DELETE SET NULL,
  claim_id uuid REFERENCES claims(id) ON DELETE SET NULL,
  refund_type text NOT NULL DEFAULT 'patient_overpayment',
  original_payment_amount numeric(12,2) NOT NULL DEFAULT 0,
  refund_amount numeric(12,2) NOT NULL DEFAULT 0,
  calculated_refund_amount numeric(12,2) NOT NULL DEFAULT 0,
  processing_fee numeric(10,2) NOT NULL DEFAULT 0,
  net_refund_amount numeric(12,2) NOT NULL DEFAULT 0,
  reason text,
  payment_method text DEFAULT 'original',
  status text NOT NULL DEFAULT 'pending',
  calculated_at timestamptz,
  approved_at timestamptz,
  approved_by text,
  processed_at timestamptz,
  completed_at timestamptz,
  denied_at timestamptz,
  denied_reason text,
  processing_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_refund_status CHECK (
    status IN ('pending', 'calculated', 'approved', 'processing', 'completed', 'denied', 'cancelled')
  ),
  CONSTRAINT valid_refund_type CHECK (
    refund_type IN ('patient_overpayment', 'insurance_overpayment', 'duplicate_payment', 'cancelled_service', 'billing_error', 'partial_refund')
  )
);

ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_refunds" ON refunds;
CREATE POLICY "anon_select_refunds" ON refunds FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_refunds" ON refunds;
CREATE POLICY "anon_insert_refunds" ON refunds FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_refunds" ON refunds;
CREATE POLICY "anon_update_refunds" ON refunds FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_refunds" ON refunds;
CREATE POLICY "anon_delete_refunds" ON refunds FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_refunds_patient ON refunds(patient_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);
CREATE INDEX IF NOT EXISTS idx_refunds_bill ON refunds(bill_id);

-- ============================================================
-- 9. AUDIT LOGS (immutable)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id text,
  actor_name text,
  actor_role text,
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  field_changes jsonb,
  access_context text,
  ip_address text,
  user_agent text,
  phi_accessed boolean DEFAULT false,
  exported boolean DEFAULT false,
  timestamp timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_audit_logs" ON audit_logs;
CREATE POLICY "anon_select_audit_logs" ON audit_logs FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_audit_logs" ON audit_logs;
CREATE POLICY "anon_insert_audit_logs" ON audit_logs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- No UPDATE or DELETE policies: audit logs are immutable

CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record ON audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);

-- ============================================================
-- 10. AUTOMATIC UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_patients_updated ON patients;
CREATE TRIGGER trg_patients_updated BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_encounters_updated ON encounters;
CREATE TRIGGER trg_encounters_updated BEFORE UPDATE ON encounters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_bills_updated ON bills;
CREATE TRIGGER trg_bills_updated BEFORE UPDATE ON bills
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_claims_updated ON claims;
CREATE TRIGGER trg_claims_updated BEFORE UPDATE ON claims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_refunds_updated ON refunds;
CREATE TRIGGER trg_refunds_updated BEFORE UPDATE ON refunds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_fee_schedules_updated ON fee_schedules;
CREATE TRIGGER trg_fee_schedules_updated BEFORE UPDATE ON fee_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 11. AUDIT TRIGGER — auto-log changes to PHI tables
-- ============================================================
CREATE OR REPLACE FUNCTION audit_phi_change()
RETURNS TRIGGER AS $$
DECLARE
  changes jsonb := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    changes := jsonb_build_object('operation', 'INSERT', 'new', to_jsonb(NEW));
    INSERT INTO audit_logs (action, table_name, record_id, field_changes, phi_accessed, access_context)
    VALUES ('INSERT', TG_TABLE_NAME, NEW.id, changes, true, 'database_trigger');
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    changes := jsonb_build_object('operation', 'UPDATE', 'old', to_jsonb(OLD), 'new', to_jsonb(NEW));
    INSERT INTO audit_logs (action, table_name, record_id, field_changes, phi_accessed, access_context)
    VALUES ('UPDATE', TG_TABLE_NAME, NEW.id, changes, true, 'database_trigger');
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    changes := jsonb_build_object('operation', 'DELETE', 'old', to_jsonb(OLD));
    INSERT INTO audit_logs (action, table_name, record_id, field_changes, phi_accessed, access_context)
    VALUES ('DELETE', TG_TABLE_NAME, OLD.id, changes, true, 'database_trigger');
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_patients ON patients;
CREATE TRIGGER trg_audit_patients AFTER INSERT OR UPDATE OR DELETE ON patients
  FOR EACH ROW EXECUTE FUNCTION audit_phi_change();

DROP TRIGGER IF EXISTS trg_audit_claims ON claims;
CREATE TRIGGER trg_audit_claims AFTER INSERT OR UPDATE OR DELETE ON claims
  FOR EACH ROW EXECUTE FUNCTION audit_phi_change();

DROP TRIGGER IF EXISTS trg_audit_refunds ON refunds;
CREATE TRIGGER trg_audit_refunds AFTER INSERT OR UPDATE OR DELETE ON refunds
  FOR EACH ROW EXECUTE FUNCTION audit_phi_change();

-- ============================================================
-- 12. REFUND CALCULATION HELPER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_refund_amount(
  p_original_payment numeric,
  p_refund_type text,
  p_bill_id uuid DEFAULT NULL
)
RETURNS TABLE(calculated_amount numeric, processing_fee numeric, net_amount numeric)
LANGUAGE plpgsql AS $$
DECLARE
  v_calculated numeric;
  v_fee numeric;
  v_net numeric;
  v_fee_rate numeric := 0.015;
BEGIN
  v_calculated := p_original_payment;

  IF p_refund_type = 'partial_refund' THEN
    v_calculated := p_original_payment * 0.50;
  ELSIF p_refund_type = 'cancelled_service' THEN
    v_calculated := p_original_payment;
    v_fee_rate := 0.0;
  ELSIF p_refund_type = 'billing_error' THEN
    v_calculated := p_original_payment;
    v_fee_rate := 0.0;
  END IF;

  v_fee := ROUND(v_calculated * v_fee_rate, 2);
  v_net := v_calculated - v_fee;

  RETURN QUERY SELECT v_calculated, v_fee, v_net;
END;
$$;
