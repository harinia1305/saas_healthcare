import { useEffect, useState } from 'react';
import { DollarSign, FileText, Receipt, RotateCcw, TrendingUp, AlertCircle, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { StatCard, Card, SectionHeader } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { formatCurrency, formatDate, formatName } from '@/lib/format';
import { useRole } from '@/context/RoleContext';
import type { Claim, Refund, Bill, Patient } from '@/types';

export default function Dashboard({ onNavigate }: { onNavigate: (view: string) => void }) {
  const { actorName, roleConfig } = useRole();
  const [stats, setStats] = useState({
    totalBilled: 0,
    totalPaid: 0,
    outstandingClaims: 0,
    pendingRefunds: 0,
    totalRefundAmount: 0,
    activePatients: 0,
  });
  const [recentClaims, setRecentClaims] = useState<(Claim & { patients?: Patient })[]>([]);
  const [recentRefunds, setRecentRefunds] = useState<Refund[]>([]);
  const [recentBills, setRecentBills] = useState<(Bill & { patients?: Patient })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [claimsRes, refundsRes, billsRes, patientsRes] = await Promise.all([
        supabase.from('claims').select('*, patients(*)').order('created_at', { ascending: false }).limit(5),
        supabase.from('refunds').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('bills').select('*, patients(*)').order('created_at', { ascending: false }).limit(5),
        supabase.from('patients').select('*'),
      ]);

      const allClaims = claimsRes.data ?? [];
      const allRefunds = refundsRes.data ?? [];
      const allBills = billsRes.data ?? [];

      const totalBilled = allBills.reduce((sum, b) => sum + Number(b.total_amount), 0);
      const totalPaid = allBills.reduce((sum, b) => sum + Number(b.insurance_paid) + Number(b.patient_paid), 0);
      const outstanding = allClaims.filter((c) => !['paid', 'denied'].includes(c.status)).length;
      const pendingRfnds = allRefunds.filter((r) => !['completed', 'denied', 'cancelled'].includes(r.status));
      const refundAmt = pendingRfnds.reduce((sum, r) => sum + Number(r.net_refund_amount || r.refund_amount), 0);

      setStats({
        totalBilled,
        totalPaid,
        outstandingClaims: outstanding,
        pendingRefunds: pendingRfnds.length,
        totalRefundAmount: refundAmt,
        activePatients: patientsRes.data?.filter((p) => p.status === 'active').length ?? 0,
      });
      setRecentClaims(allClaims as (Claim & { patients?: Patient })[]);
      setRecentRefunds(allRefunds as Refund[]);
      setRecentBills(allBills as (Bill & { patients?: Patient })[]);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-teal-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Welcome back, {actorName.split(' ')[0]}</h1>
        <p className="mt-1 text-sm text-slate-500">
          You're signed in as <span className="font-medium text-slate-700">{roleConfig.label}</span>. Here's your billing overview.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Billed" value={formatCurrency(stats.totalBilled)} icon={DollarSign} color="teal" trend={{ value: '+12.5% vs last month', positive: true }} />
        <StatCard label="Total Collected" value={formatCurrency(stats.totalPaid)} icon={TrendingUp} color="emerald" trend={{ value: '+8.2% vs last month', positive: true }} />
        <StatCard label="Outstanding Claims" value={stats.outstandingClaims} icon={FileText} color="blue" />
        <StatCard label="Pending Refunds" value={stats.pendingRefunds} icon={RotateCcw} color="amber" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card padding={false}>
          <div className="border-b border-slate-200 px-5 py-4">
            <SectionHeader
              title="Recent Claims"
              subtitle="Latest insurance claim activity"
              action={
                <button onClick={() => onNavigate('claims')} className="text-sm font-medium text-teal-600 hover:text-teal-700">
                  View all
                </button>
              }
            />
          </div>
          <div className="divide-y divide-slate-100">
            {recentClaims.map((claim) => (
              <div key={claim.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
                    <FileText className="h-4.5 w-4.5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{claim.claim_number}</p>
                    <p className="text-xs text-slate-500">
                      {claim.patients ? formatName(claim.patients.first_name, claim.patients.last_name) : '—'} · {claim.insurance_provider}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-700">{formatCurrency(claim.total_billed)}</span>
                  <Badge status={claim.status} size="sm" />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card padding={false}>
          <div className="border-b border-slate-200 px-5 py-4">
            <SectionHeader
              title="Refund Pipeline"
              subtitle="Active refund processing status"
              action={
                <button onClick={() => onNavigate('refunds')} className="text-sm font-medium text-teal-600 hover:text-teal-700">
                  View all
                </button>
              }
            />
          </div>
          <div className="divide-y divide-slate-100">
            {recentRefunds.map((refund) => (
              <div key={refund.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
                    <RotateCcw className="h-4.5 w-4.5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{refund.refund_number}</p>
                    <p className="text-xs text-slate-500 capitalize">{refund.refund_type.replace(/_/g, ' ')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-700">{formatCurrency(refund.net_refund_amount || refund.refund_amount)}</span>
                  <Badge status={refund.status} size="sm" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card padding={false}>
        <div className="border-b border-slate-200 px-5 py-4">
          <SectionHeader
            title="Recent Bills"
            subtitle="Latest billing statements"
            action={
              <button onClick={() => onNavigate('bills')} className="text-sm font-medium text-teal-600 hover:text-teal-700">
                View all
              </button>
            }
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Bill #</th>
                <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Patient</th>
                <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Total</th>
                <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Balance</th>
                <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentBills.map((bill) => (
                <tr key={bill.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-sm font-medium text-slate-800">{bill.bill_number}</td>
                  <td className="px-5 py-3 text-sm text-slate-600">
                    {bill.patients ? formatName(bill.patients.first_name, bill.patients.last_name) : '—'}
                  </td>
                  <td className="px-5 py-3 text-sm font-semibold text-slate-700">{formatCurrency(bill.total_amount)}</td>
                  <td className="px-5 py-3 text-sm text-slate-600">{formatCurrency(bill.balance_due)}</td>
                  <td className="px-5 py-3"><Badge status={bill.status} size="sm" /></td>
                  <td className="px-5 py-3 text-sm text-slate-500">{formatDate(bill.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
