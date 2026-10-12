import { useEffect, useState } from 'react';
import { Receipt, Search, Eye, Plus, Trash2, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Badge from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import { formatCurrency, formatDate, formatName, maskPhi } from '@/lib/format';
import type { BillWithDetails, BillItem, Patient } from '@/types';

export default function Bills() {
  const [bills, setBills] = useState<BillWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedBill, setSelectedBill] = useState<BillWithDetails | null>(null);
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [showNewBill, setShowNewBill] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);

  useEffect(() => {
    loadBills();
  }, []);

  async function loadBills() {
    const { data } = await supabase
      .from('bills')
      .select('*, patients(*)')
      .order('created_at', { ascending: false });
    setBills((data ?? []) as BillWithDetails[]);
    setLoading(false);
  }

  async function loadBillItems(billId: string) {
    const { data } = await supabase
      .from('bill_items')
      .select('*')
      .eq('bill_id', billId)
      .order('created_at', { ascending: true });
    setBillItems(data ?? []);
  }

  useEffect(() => {
    if (showNewBill) {
      supabase.from('patients').select('*').eq('status', 'active').then(({ data }) => setPatients(data ?? []));
    }
  }, [showNewBill]);

  const filtered = bills.filter((b) => {
    const matchesSearch = !search ||
      b.bill_number.toLowerCase().includes(search.toLowerCase()) ||
      (b.patients && `${b.patients.first_name} ${b.patients.last_name}`.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalBilled = bills.reduce((sum, b) => sum + Number(b.total_amount), 0);
  const totalCollected = bills.reduce((sum, b) => sum + Number(b.insurance_paid) + Number(b.patient_paid), 0);
  const totalOutstanding = bills.reduce((sum, b) => sum + Number(b.balance_due), 0);

  async function createBill(patientId: string, items: Array<{ cpt_code: string; description: string; unit_price: number; quantity: number }>) {
    const billNumber = `BILL-2026-${String(bills.length + 1).padStart(3, '0')}`;
    const subtotal = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);

    const { data: bill, error } = await supabase.from('bills').insert({
      bill_number: billNumber,
      patient_id: patientId,
      subtotal,
      total_amount: subtotal,
      balance_due: subtotal,
      status: 'submitted',
    }).select().single();

    if (error || !bill) return;

    for (const item of items) {
      await supabase.from('bill_items').insert({
        bill_id: bill.id,
        cpt_code: item.cpt_code,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.unit_price * item.quantity,
        is_insurance_covered: true,
      });
    }

    setShowNewBill(false);
    loadBills();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Itemized Bills</h1>
          <p className="mt-1 text-sm text-slate-500">Manage patient billing statements and line items</p>
        </div>
        <button
          onClick={() => setShowNewBill(true)}
          className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700"
        >
          <Plus className="h-4 w-4" />
          New Bill
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total Billed</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{formatCurrency(totalBilled)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total Collected</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{formatCurrency(totalCollected)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Outstanding Balance</p>
          <p className="mt-2 text-2xl font-bold text-amber-600">{formatCurrency(totalOutstanding)}</p>
        </div>
      </div>

      <Card padding={false}>
        <div className="flex items-center gap-4 border-b border-slate-200 px-5 py-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by bill # or patient name..."
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
            <option value="partially_paid">Partially Paid</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            <option value="refunded">Refunded</option>
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
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Bill #</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Patient</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Total</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Insurance</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Patient</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Balance</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                  <th className="px-5 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((bill) => (
                  <tr
                    key={bill.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => {
                      setSelectedBill(bill);
                      loadBillItems(bill.id);
                    }}
                  >
                    <td className="px-5 py-3 text-sm font-medium text-slate-800">{bill.bill_number}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">
                      {bill.patients ? formatName(bill.patients.first_name, bill.patients.last_name) : '—'}
                    </td>
                    <td className="px-5 py-3 text-sm font-semibold text-slate-700">{formatCurrency(bill.total_amount)}</td>
                    <td className="px-5 py-3 text-sm text-emerald-600">{formatCurrency(bill.insurance_paid)}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{formatCurrency(bill.patient_paid)}</td>
                    <td className="px-5 py-3 text-sm font-medium text-amber-600">{formatCurrency(bill.balance_due)}</td>
                    <td className="px-5 py-3"><Badge status={bill.status} size="sm" /></td>
                    <td className="px-5 py-3">
                      <Eye className="h-4 w-4 text-slate-400" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Bill Detail Modal */}
      <Modal
        open={!!selectedBill}
        onClose={() => setSelectedBill(null)}
        title={selectedBill?.bill_number ?? ''}
        subtitle="Itemized billing statement"
        size="xl"
      >
        {selectedBill && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium uppercase text-slate-400">Patient</p>
                <p className="mt-1 text-sm font-medium text-slate-800">
                  {selectedBill.patients ? formatName(selectedBill.patients.first_name, selectedBill.patients.last_name) : '—'}
                </p>
                <p className="text-xs text-slate-500">MRN: {selectedBill.patients?.mrn}</p>
                <p className="text-xs text-slate-500">DOB: {selectedBill.patients ? formatDate(selectedBill.patients.date_of_birth) : '—'}</p>
                <p className="text-xs text-slate-500">Address: {maskPhi(selectedBill.patients?.address_encrypted ?? null)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-slate-400">Billing Period</p>
                <p className="mt-1 text-sm text-slate-700">
                  {formatDate(selectedBill.billing_period_start)} — {formatDate(selectedBill.billing_period_end)}
                </p>
                <p className="text-xs text-slate-500 mt-2">Created: {formatDate(selectedBill.created_at)}</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">CPT Code</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Description</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold uppercase text-slate-500">Qty</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-slate-500">Unit Price</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-slate-500">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {billItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-sm font-mono font-medium text-slate-700">{item.cpt_code}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-600">{item.description}</td>
                      <td className="px-4 py-2.5 text-center text-sm text-slate-600">{item.quantity}</td>
                      <td className="px-4 py-2.5 text-right text-sm text-slate-600">{formatCurrency(item.unit_price)}</td>
                      <td className="px-4 py-2.5 text-right text-sm font-semibold text-slate-700">{formatCurrency(item.total_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ml-auto w-full max-w-xs space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-medium text-slate-700">{formatCurrency(selectedBill.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Insurance Paid</span>
                <span className="font-medium text-emerald-600">{formatCurrency(selectedBill.insurance_paid)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Patient Paid</span>
                <span className="font-medium text-slate-700">{formatCurrency(selectedBill.patient_paid)}</span>
              </div>
              <div className="border-t border-slate-200 pt-2 flex justify-between">
                <span className="text-sm font-semibold text-slate-800">Balance Due</span>
                <span className="text-lg font-bold text-amber-600">{formatCurrency(selectedBill.balance_due)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
              <span className="text-sm font-medium text-slate-500">Current Status</span>
              <Badge status={selectedBill.status} />
            </div>
          </div>
        )}
      </Modal>

      {/* New Bill Modal */}
      <NewBillModal
        open={showNewBill}
        onClose={() => setShowNewBill(false)}
        patients={patients}
        onCreate={createBill}
      />
    </div>
  );
}

function NewBillModal({
  open,
  onClose,
  patients,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  patients: Patient[];
  onCreate: (patientId: string, items: Array<{ cpt_code: string; description: string; unit_price: number; quantity: number }>) => void;
}) {
  const [patientId, setPatientId] = useState('');
  const [items, setItems] = useState<Array<{ cpt_code: string; description: string; unit_price: number; quantity: number }>>([
    { cpt_code: '', description: '', unit_price: 0, quantity: 1 },
  ]);

  function addItem() {
    setItems([...items, { cpt_code: '', description: '', unit_price: 0, quantity: 1 }]);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: string, value: string | number) {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  }

  const total = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create New Bill"
      subtitle="Add line items for an itemized billing statement"
      size="xl"
      footer={
        <>
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button
            onClick={() => patientId && items.every((i) => i.cpt_code && i.description) && onCreate(patientId, items)}
            disabled={!patientId || items.some((i) => !i.cpt_code || !i.description)}
            className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            Create Bill ({formatCurrency(total)})
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Patient</label>
          <select
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none"
          >
            <option value="">Select patient...</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>{formatName(p.first_name, p.last_name)} ({p.mrn})</option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-700">Line Items</label>
            <button onClick={addItem} className="text-sm font-medium text-teal-600 hover:text-teal-700">+ Add item</button>
          </div>
          <div className="space-y-2">
            {items.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="CPT code"
                  value={item.cpt_code}
                  onChange={(e) => updateItem(index, 'cpt_code', e.target.value)}
                  className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono focus:border-teal-500 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => updateItem(index, 'description', e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
                />
                <input
                  type="number"
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                  className="w-16 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
                />
                <input
                  type="number"
                  placeholder="Price"
                  value={item.unit_price}
                  onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                  className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
                />
                <span className="w-24 text-right text-sm font-semibold text-slate-700">
                  {formatCurrency(item.unit_price * item.quantity)}
                </span>
                <button
                  onClick={() => removeItem(index)}
                  disabled={items.length === 1}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-end border-t border-slate-200 pt-3">
            <span className="text-sm font-bold text-slate-800">Total: {formatCurrency(total)}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
