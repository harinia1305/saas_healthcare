import { useEffect, useState } from 'react';
import { RotateCcw, Search, Eye, CheckCircle, XCircle, Play, Zap, Clock, DollarSign } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Badge from '@/components/ui/Badge';
import { Card, StatCard } from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import { formatCurrency, formatDateTime, formatName } from '@/lib/format';
import { useRole } from '@/context/RoleContext';
import type { Refund, Patient } from '@/types';

const PIPELINE_STAGES = ['pending', 'calculated', 'approved', 'processing', 'completed'] as const;

export default function Refunds() {
  const { hasPermission, actorName } = useRole();
  const [refunds, setRefunds] = useState<(Refund & { patients?: Patient })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedRefund, setSelectedRefund] = useState<(Refund & { patients?: Patient }) | null>(null);
  const [processing, setProcessing] = useState(false);
  const [batchResult, setBatchResult] = useState<string | null>(null);

  useEffect(() => {
    loadRefunds();
  }, []);

  async function loadRefunds() {
    const { data } = await supabase
      .from('refunds')
      .select('*, patients(*)')
      .order('created_at', { ascending: false });
    setRefunds((data ?? []) as (Refund & { patients?: Patient })[]);
    setLoading(false);
  }

  const filtered = refunds.filter((r) => {
    const matchesSearch = !search ||
      r.refund_number.toLowerCase().includes(search.toLowerCase()) ||
      r.refund_type.toLowerCase().includes(search.toLowerCase()) ||
      (r.patients && `${r.patients.first_name} ${r.patients.last_name}`.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stageCounts = PIPELINE_STAGES.reduce((acc, stage) => {
    acc[stage] = refunds.filter((r) => r.status === stage).length;
    return acc;
  }, {} as Record<string, number>);

  const totalPending = refunds
    .filter((r) => !['completed', 'denied', 'cancelled'].includes(r.status))
    .reduce((sum, r) => sum + Number(r.net_refund_amount || r.refund_amount), 0);
  const totalCompleted = refunds
    .filter((r) => r.status === 'completed')
    .reduce((sum, r) => sum + Number(r.net_refund_amount), 0);

  async function callRefundApi(action: string, refundId: string, extra?: Record<string, string>) {
    setProcessing(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/refund-pipeline`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refund_id: refundId, action, ...extra }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Request failed (${res.status})`);
      }
      await loadRefunds();
      if (selectedRefund?.id === refundId) {
        const { data } = await supabase
          .from('refunds')
          .select('*, patients(*)')
          .eq('id', refundId)
          .maybeSingle();
        if (data) setSelectedRefund(data as (Refund & { patients?: Patient }));
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to process refund');
    } finally {
      setProcessing(false);
    }
  }

  async function runBatch() {
    setProcessing(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/refund-pipeline?batch=true`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) throw new Error(`Batch failed (${res.status})`);
      const result = await res.json();
      setBatchResult(`Processed ${result.processed} refund(s). Check individual statuses for details.`);
      await loadRefunds();
      setTimeout(() => setBatchResult(null), 5000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Batch processing failed');
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Refund Pipeline</h1>
          <p className="mt-1 text-sm text-slate-500">Automated refund processing with calculation, approval, and tracking</p>
        </div>
        <button
          onClick={runBatch}
          disabled={processing}
          className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
        >
          <Zap className="h-4 w-4" />
          Run Batch Process
        </button>
      </div>

      {batchResult && (
        <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-700">
          {batchResult}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pending Refunds" value={stageCounts.pending + stageCounts.calculated} icon={Clock} color="amber" />
        <StatCard label="Approved (Awaiting Processing)" value={stageCounts.approved} icon={CheckCircle} color="teal" />
        <StatCard label="Total Pending Amount" value={formatCurrency(totalPending)} icon={DollarSign} color="blue" />
        <StatCard label="Total Completed" value={formatCurrency(totalCompleted)} icon={RotateCcw} color="emerald" />
      </div>

      {/* Pipeline visualization */}
      <Card>
        <h3 className="text-base font-semibold text-slate-900 mb-4">Pipeline Stages</h3>
        <div className="flex items-center gap-2 overflow-x-auto">
          {PIPELINE_STAGES.map((stage, index) => (
            <div key={stage} className="flex items-center gap-2 flex-shrink-0">
              <div className={`flex flex-col items-center rounded-lg border px-4 py-3 min-w-[120px] ${
                stageCounts[stage] > 0
                  ? 'border-teal-200 bg-teal-50'
                  : 'border-slate-200 bg-slate-50'
              }`}>
                <span className={`text-2xl font-bold ${stageCounts[stage] > 0 ? 'text-teal-700' : 'text-slate-400'}`}>
                  {stageCounts[stage]}
                </span>
                <span className="mt-1 text-xs font-medium capitalize text-slate-500">{stage.replace(/_/g, ' ')}</span>
              </div>
              {index < PIPELINE_STAGES.length - 1 && (
                <div className="h-0.5 w-6 bg-slate-200" />
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card padding={false}>
        <div className="flex items-center gap-4 border-b border-slate-200 px-5 py-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by refund #, patient, or type..."
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
            <option value="pending">Pending</option>
            <option value="calculated">Calculated</option>
            <option value="approved">Approved</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
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
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Refund #</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Patient</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Type</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Original</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Net Refund</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Fee</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                  <th className="px-5 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((refund) => (
                  <tr key={refund.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelectedRefund(refund)}>
                    <td className="px-5 py-3 text-sm font-medium text-slate-800">{refund.refund_number}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">
                      {refund.patients ? formatName(refund.patients.first_name, refund.patients.last_name) : '—'}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600 capitalize">{refund.refund_type.replace(/_/g, ' ')}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{formatCurrency(refund.original_payment_amount)}</td>
                    <td className="px-5 py-3 text-sm font-semibold text-slate-700">{formatCurrency(refund.net_refund_amount || refund.refund_amount)}</td>
                    <td className="px-5 py-3 text-sm text-slate-500">{formatCurrency(refund.processing_fee)}</td>
                    <td className="px-5 py-3"><Badge status={refund.status} size="sm" /></td>
                    <td className="px-5 py-3"><Eye className="h-4 w-4 text-slate-400" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Refund Detail Modal */}
      <Modal
        open={!!selectedRefund}
        onClose={() => setSelectedRefund(null)}
        title={selectedRefund?.refund_number ?? ''}
        subtitle="Refund processing detail and controls"
        size="xl"
        footer={
          selectedRefund && hasPermission('canApproveRefunds') && (
            <div className="flex items-center gap-2">
              {selectedRefund.status === 'pending' && (
                <button
                  onClick={() => callRefundApi('advance', selectedRefund.id)}
                  disabled={processing}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <Play className="h-4 w-4" />
                  Calculate Refund
                </button>
              )}
              {selectedRefund.status === 'calculated' && (
                <>
                  <button
                    onClick={() => callRefundApi('approve', selectedRefund.id, { approved_by: actorName })}
                    disabled={processing}
                    className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => callRefundApi('deny', selectedRefund.id, { denied_reason: 'Denied by administrator' })}
                    disabled={processing}
                    className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4" />
                    Deny
                  </button>
                </>
              )}
              {selectedRefund.status === 'approved' && (
                <button
                  onClick={() => callRefundApi('process', selectedRefund.id)}
                  disabled={processing}
                  className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  <Play className="h-4 w-4" />
                  Process & Complete
                </button>
              )}
            </div>
          )
        }
      >
        {selectedRefund && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium uppercase text-slate-400">Patient</p>
                <p className="mt-1 text-sm font-medium text-slate-800">
                  {selectedRefund.patients ? formatName(selectedRefund.patients.first_name, selectedRefund.patients.last_name) : '—'}
                </p>
                <p className="text-xs text-slate-500">MRN: {selectedRefund.patients?.mrn}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-slate-400">Refund Type</p>
                <p className="mt-1 text-sm font-medium text-slate-800 capitalize">{selectedRefund.refund_type.replace(/_/g, ' ')}</p>
                <p className="text-xs text-slate-500">Payment: {selectedRefund.payment_method}</p>
              </div>
            </div>

            {selectedRefund.reason && (
              <div className="rounded-lg bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium uppercase text-slate-400">Reason</p>
                <p className="mt-1 text-sm text-slate-700">{selectedRefund.reason}</p>
              </div>
            )}

            <div className="rounded-lg border border-slate-200">
              <table className="w-full">
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="px-4 py-2.5 text-sm font-medium text-slate-500">Original Payment</td>
                    <td className="px-4 py-2.5 text-sm font-semibold text-slate-800 text-right">{formatCurrency(selectedRefund.original_payment_amount)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-sm font-medium text-slate-500">Calculated Refund</td>
                    <td className="px-4 py-2.5 text-sm font-semibold text-slate-800 text-right">{formatCurrency(selectedRefund.calculated_refund_amount)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-sm font-medium text-slate-500">Processing Fee</td>
                    <td className="px-4 py-2.5 text-sm text-red-500 text-right">-{formatCurrency(selectedRefund.processing_fee)}</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="px-4 py-2.5 text-sm font-bold text-slate-700">Net Refund Amount</td>
                    <td className="px-4 py-2.5 text-sm font-bold text-teal-700 text-right">{formatCurrency(selectedRefund.net_refund_amount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Timeline */}
            <div>
              <p className="text-xs font-medium uppercase text-slate-400 mb-3">Processing Timeline</p>
              <div className="space-y-3">
                <TimelineStep label="Created" date={selectedRefund.created_at} done={true} />
                <TimelineStep label="Calculated" date={selectedRefund.calculated_at} done={!!selectedRefund.calculated_at} />
                <TimelineStep label="Approved" date={selectedRefund.approved_at} done={!!selectedRefund.approved_at} detail={selectedRefund.approved_by ?? undefined} />
                <TimelineStep label="Processed" date={selectedRefund.processed_at} done={!!selectedRefund.processed_at} />
                <TimelineStep label="Completed" date={selectedRefund.completed_at} done={!!selectedRefund.completed_at} />
                {selectedRefund.denied_at && (
                  <TimelineStep label="Denied" date={selectedRefund.denied_at} done={true} detail={selectedRefund.denied_reason ?? undefined} isDenial />
                )}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
              <span className="text-sm font-medium text-slate-500">Current Status</span>
              <Badge status={selectedRefund.status} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function TimelineStep({ label, date, done, detail, isDenial }: { label: string; date: string | null; done: boolean; detail?: string; isDenial?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <div className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${
        done
          ? isDenial ? 'bg-red-100' : 'bg-teal-100'
          : 'bg-slate-100'
      }`}>
        {done && (
          <CheckCircle className={`h-3.5 w-3.5 ${isDenial ? 'text-red-600' : 'text-teal-600'}`} />
        )}
      </div>
      <div className="flex-1">
        <p className={`text-sm font-medium ${done ? (isDenial ? 'text-red-700' : 'text-slate-800') : 'text-slate-400'}`}>{label}</p>
        {date && <p className="text-xs text-slate-500">{formatDateTime(date)}</p>}
        {detail && <p className="text-xs text-slate-500 mt-0.5">{detail}</p>}
      </div>
    </div>
  );
}
