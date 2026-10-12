import { useEffect, useState } from 'react';
import { FileText, Search, Plus, Send, Eye } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Badge from '@/components/ui/Badge';
import { Card, SectionHeader } from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import { formatCurrency, formatDate, formatName } from '@/lib/format';
import { useRole } from '@/context/RoleContext';
import type { ClaimWithDetails, Patient, Bill } from '@/types';

export default function Claims() {
  const { hasPermission } = useRole();
  const [claims, setClaims] = useState<ClaimWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedClaim, setSelectedClaim] = useState<ClaimWithDetails | null>(null);
  const [showSubmit, setShowSubmit] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);

  useEffect(() => {
    loadClaims();
  }, []);

  async function loadClaims() {
    const { data } = await supabase
      .from('claims')
      .select('*, patients(*), bills(*)')
      .order('created_at', { ascending: false });
    setClaims((data ?? []) as ClaimWithDetails[]);
    setLoading(false);
  }

  useEffect(() => {
    if (showSubmit) {
      supabase.from('patients').select('*').eq('status', 'active').then(({ data }) => setPatients(data ?? []));
      supabase.from('bills').select('*').order('created_at', { ascending: false }).then(({ data }) => setBills(data ?? []));
    }
  }, [showSubmit]);

  const filtered = claims.filter((c) => {
    const matchesSearch = !search ||
      c.claim_number.toLowerCase().includes(search.toLowerCase()) ||
      c.insurance_provider.toLowerCase().includes(search.toLowerCase()) ||
      (c.patients && `${c.patients.first_name} ${c.patients.last_name}`.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = claims.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  async function submitClaim(billId: string, insuranceProvider: string, memberId: string) {
    const bill = bills.find((b) => b.id === billId);
    if (!bill) return;
    const claimNumber = `CLM-2026-${String(claims.length + 1).padStart(3, '0')}`;
    const { error } = await supabase.from('claims').insert({
      claim_number: claimNumber,
      bill_id: billId,
      patient_id: bill.patient_id,
      insurance_provider: insuranceProvider,
      insurance_member_id: memberId,
      total_billed: bill.total_amount,
      status: 'submitted',
      submitted_date: new Date().toISOString(),
    });
    if (!error) {
      setShowSubmit(false);
      loadClaims();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Insurance Claims</h1>
          <p className="mt-1 text-sm text-slate-500">Submit, track, and manage insurance claims</p>
        </div>
        {hasPermission('canSubmitClaims') && (
          <button
            onClick={() => setShowSubmit(true)}
            className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700"
          >
            <Plus className="h-4 w-4" />
            New Claim
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {['draft', 'submitted', 'in_review', 'adjudicated', 'partially_paid', 'paid', 'denied', 'appealed'].map((status) => (
          <div key={status} className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs font-medium text-slate-500 capitalize">{status.replace(/_/g, ' ')}</p>
            <p className="mt-1 text-lg font-bold text-slate-800">{statusCounts[status] ?? 0}</p>
          </div>
        ))}
      </div>

      <Card padding={false}>
        <div className="flex items-center gap-4 border-b border-slate-200 px-5 py-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by claim #, patient, or insurer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="in_review">In Review</option>
            <option value="paid">Paid</option>
            <option value="denied">Denied</option>
          </select>
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-teal-500" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Claim #</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Patient</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Insurer</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Billed</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Paid</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Pt. Resp.</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((claim) => (
                  <tr key={claim.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-sm font-medium text-slate-800">{claim.claim_number}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">
                      {claim.patients ? formatName(claim.patients.first_name, claim.patients.last_name) : '—'}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600">{claim.insurance_provider}</td>
                    <td className="px-5 py-3 text-sm font-semibold text-slate-700">{formatCurrency(claim.total_billed)}</td>
                    <td className="px-5 py-3 text-sm text-emerald-600 font-medium">{formatCurrency(claim.total_paid)}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{formatCurrency(claim.patient_responsibility)}</td>
                    <td className="px-5 py-3"><Badge status={claim.status} size="sm" /></td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => setSelectedClaim(claim)}
                        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Claim Detail Modal */}
      <Modal
        open={!!selectedClaim}
        onClose={() => setSelectedClaim(null)}
        title={selectedClaim?.claim_number ?? ''}
        subtitle="Claim detail and adjudication history"
        size="xl"
      >
        {selectedClaim && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium uppercase text-slate-400">Patient</p>
                <p className="mt-1 text-sm font-medium text-slate-800">
                  {selectedClaim.patients ? formatName(selectedClaim.patients.first_name, selectedClaim.patients.last_name) : '—'}
                </p>
                <p className="text-xs text-slate-500">MRN: {selectedClaim.patients?.mrn}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-slate-400">Insurance Provider</p>
                <p className="mt-1 text-sm font-medium text-slate-800">{selectedClaim.insurance_provider}</p>
                <p className="text-xs text-slate-500">Member ID: {selectedClaim.insurance_member_id ?? '—'}</p>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200">
              <table className="w-full">
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="px-4 py-2.5 text-sm font-medium text-slate-500">Total Billed</td>
                    <td className="px-4 py-2.5 text-sm font-semibold text-slate-800 text-right">{formatCurrency(selectedClaim.total_billed)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-sm font-medium text-slate-500">Total Approved</td>
                    <td className="px-4 py-2.5 text-sm font-semibold text-slate-800 text-right">{formatCurrency(selectedClaim.total_approved)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-sm font-medium text-slate-500">Insurance Paid</td>
                    <td className="px-4 py-2.5 text-sm font-semibold text-emerald-600 text-right">{formatCurrency(selectedClaim.total_paid)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-sm font-medium text-slate-500">Patient Responsibility</td>
                    <td className="px-4 py-2.5 text-sm font-semibold text-amber-600 text-right">{formatCurrency(selectedClaim.patient_responsibility)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-sm font-medium text-slate-500">Submitted Date</td>
                    <td className="px-4 py-2.5 text-sm text-slate-700 text-right">{formatDate(selectedClaim.submitted_date)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-sm font-medium text-slate-500">Adjudication Date</td>
                    <td className="px-4 py-2.5 text-sm text-slate-700 text-right">{formatDate(selectedClaim.adjudication_date)}</td>
                  </tr>
                  {selectedClaim.denial_reason && (
                    <tr>
                      <td className="px-4 py-2.5 text-sm font-medium text-red-500">Denial Reason</td>
                      <td className="px-4 py-2.5 text-sm text-red-600 text-right">{selectedClaim.denial_reason}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div>
              <p className="text-xs font-medium uppercase text-slate-400 mb-2">Current Status</p>
              <Badge status={selectedClaim.status} />
            </div>
          </div>
        )}
      </Modal>

      {/* Submit New Claim Modal */}
      <Modal
        open={showSubmit}
        onClose={() => setShowSubmit(false)}
        title="Submit New Claim"
        subtitle="Create and submit an insurance claim"
        footer={
          <>
            <button onClick={() => setShowSubmit(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button
              onClick={() => {
                const form = document.getElementById('claim-form') as HTMLFormElement;
                const formData = new FormData(form);
                submitClaim(formData.get('bill_id') as string, formData.get('insurance_provider') as string, formData.get('member_id') as string);
              }}
              className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
            >
              <Send className="h-4 w-4" />
              Submit Claim
            </button>
          </>
        }
      >
        <form id="claim-form" className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Select Bill</label>
            <select name="bill_id" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none">
              <option value="">Choose a bill...</option>
              {bills.map((b) => (
                <option key={b.id} value={b.id}>{b.bill_number} — {formatCurrency(b.total_amount)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Insurance Provider</label>
            <select name="insurance_provider" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none">
              <option value="">Choose insurer...</option>
              <option>Blue Cross Blue Shield</option>
              <option>Aetna</option>
              <option>United Healthcare</option>
              <option>Medicare</option>
              <option>Cigna</option>
              <option>Humana</option>
              <option>Kaiser Permanente</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Member ID</label>
            <input name="member_id" type="text" placeholder="e.g., BCBS-556782" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none" />
          </div>
        </form>
      </Modal>
    </div>
  );
}
