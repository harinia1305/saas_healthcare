import { useEffect, useState } from 'react';
import { Users, Search, Eye } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Badge from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import { formatDate, formatName, maskPhi, formatCurrency, getInitials } from '@/lib/format';
import { useRole } from '@/context/RoleContext';
import type { Patient, Encounter, Bill, Claim } from '@/types';

export default function Patients() {
  const { hasPermission } = useRole();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);

  useEffect(() => {
    supabase.from('patients').select('*').order('last_name', { ascending: true }).then(({ data }) => {
      setPatients(data ?? []);
      setLoading(false);
    });
  }, []);

  const filtered = patients.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.first_name.toLowerCase().includes(q) ||
      p.last_name.toLowerCase().includes(q) ||
      p.mrn.toLowerCase().includes(q) ||
      (p.insurance_provider?.toLowerCase().includes(q) ?? false)
    );
  });

  async function selectPatient(p: Patient) {
    setSelectedPatient(p);
    const [encRes, billRes, claimRes] = await Promise.all([
      supabase.from('encounters').select('*').eq('patient_id', p.id).order('encounter_date', { ascending: false }),
      supabase.from('bills').select('*').eq('patient_id', p.id).order('created_at', { ascending: false }),
      supabase.from('claims').select('*').eq('patient_id', p.id).order('created_at', { ascending: false }),
    ]);
    setEncounters(encRes.data ?? []);
    setBills(billRes.data ?? []);
    setClaims(claimRes.data ?? []);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Patient Ledger</h1>
        <p className="mt-1 text-sm text-slate-500">
          {hasPermission('canViewPhi')
            ? 'Patient demographics, encounters, billing, and claims history'
            : 'Limited view — PHI access restricted by your role'}
        </p>
      </div>

      <Card padding={false}>
        <div className="flex items-center gap-4 border-b border-slate-200 px-5 py-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, MRN, or insurer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
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
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Patient</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">MRN</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">DOB</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Insurance</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                  <th className="px-5 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="cursor-pointer hover:bg-slate-50" onClick={() => selectPatient(p)}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-500 text-sm font-semibold text-white">
                          {getInitials(p.first_name, p.last_name)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{formatName(p.first_name, p.last_name)}</p>
                          <p className="text-xs text-slate-500">{p.phone ?? 'No phone'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm font-mono text-slate-600">{p.mrn}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{formatDate(p.date_of_birth)}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{p.insurance_provider ?? '—'}</td>
                    <td className="px-5 py-3"><Badge status={p.status} size="sm" /></td>
                    <td className="px-5 py-3"><Eye className="h-4 w-4 text-slate-400" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={!!selectedPatient}
        onClose={() => setSelectedPatient(null)}
        title={selectedPatient ? formatName(selectedPatient.first_name, selectedPatient.last_name) : ''}
        subtitle="Patient ledger — encounters, bills, and claims"
        size="xl"
      >
        {selectedPatient && (
          <div className="space-y-5">
            {/* Patient Info */}
            <div className="grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-4">
              <div>
                <p className="text-xs font-medium uppercase text-slate-400">MRN</p>
                <p className="mt-1 text-sm font-mono font-medium text-slate-800">{selectedPatient.mrn}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-slate-400">Date of Birth</p>
                <p className="mt-1 text-sm text-slate-700">{formatDate(selectedPatient.date_of_birth)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-slate-400">SSN</p>
                <p className="mt-1 text-sm text-slate-700">{maskPhi(selectedPatient.ssn_encrypted)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-slate-400">Address</p>
                <p className="mt-1 text-sm text-slate-700">{maskPhi(selectedPatient.address_encrypted)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-slate-400">Phone</p>
                <p className="mt-1 text-sm text-slate-700">{selectedPatient.phone ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-slate-400">Email</p>
                <p className="mt-1 text-sm text-slate-700">{selectedPatient.email ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-slate-400">Insurance Provider</p>
                <p className="mt-1 text-sm font-medium text-slate-800">{selectedPatient.insurance_provider ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-slate-400">Member ID</p>
                <p className="mt-1 text-sm font-mono text-slate-700">{selectedPatient.insurance_member_id ?? '—'}</p>
              </div>
            </div>

            {/* Encounters */}
            <div>
              <p className="text-xs font-medium uppercase text-slate-400 mb-2">Encounters ({encounters.length})</p>
              <div className="space-y-2">
                {encounters.map((enc) => (
                  <div key={enc.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{enc.encounter_type.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-slate-500">{enc.provider_name} · {enc.department}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">{formatDate(enc.encounter_date)}</p>
                      <Badge status={enc.status} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bills Summary */}
            <div>
              <p className="text-xs font-medium uppercase text-slate-400 mb-2">Bills ({bills.length})</p>
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Bill #</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-slate-500">Total</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-slate-500">Balance</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bills.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2 text-sm font-medium text-slate-700">{b.bill_number}</td>
                        <td className="px-4 py-2 text-right text-sm text-slate-600">{formatCurrency(b.total_amount)}</td>
                        <td className="px-4 py-2 text-right text-sm font-medium text-amber-600">{formatCurrency(b.balance_due)}</td>
                        <td className="px-4 py-2"><Badge status={b.status} size="sm" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Claims Summary */}
            <div>
              <p className="text-xs font-medium uppercase text-slate-400 mb-2">Claims ({claims.length})</p>
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Claim #</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Insurer</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-slate-500">Billed</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {claims.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2 text-sm font-medium text-slate-700">{c.claim_number}</td>
                        <td className="px-4 py-2 text-sm text-slate-600">{c.insurance_provider}</td>
                        <td className="px-4 py-2 text-right text-sm text-slate-600">{formatCurrency(c.total_billed)}</td>
                        <td className="px-4 py-2"><Badge status={c.status} size="sm" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
