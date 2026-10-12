import { useEffect, useState } from 'react';
import { Settings, Plus, Save, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import { formatCurrency } from '@/lib/format';
import type { FeeSchedule } from '@/types';

export default function FeeSchedules() {
  const [schedules, setSchedules] = useState<FeeSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<FeeSchedule | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase.from('fee_schedules').select('*').order('created_at', { ascending: false });
    setSchedules(data ?? []);
    setLoading(false);
  }

  async function saveSchedule(data: Partial<FeeSchedule>) {
    if (editingSchedule) {
      await supabase.from('fee_schedules').update(data).eq('id', editingSchedule.id);
    } else {
      await supabase.from('fee_schedules').insert(data);
    }
    setShowForm(false);
    setEditingSchedule(null);
    load();
  }

  async function toggleActive(schedule: FeeSchedule) {
    await supabase.from('fee_schedules').update({ is_active: !schedule.is_active }).eq('id', schedule.id);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Fee Schedules</h1>
          <p className="mt-1 text-sm text-slate-500">Configure co-pays, deductibles, coinsurance, and specialist fees per insurer</p>
        </div>
        <button
          onClick={() => { setEditingSchedule(null); setShowForm(true); }}
          className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700"
        >
          <Plus className="h-4 w-4" />
          New Fee Schedule
        </button>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-teal-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {schedules.map((sched) => (
            <Card key={sched.id}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{sched.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {sched.insurance_provider ?? 'All insurers'} · {sched.encounter_type ?? 'All visits'}
                  </p>
                </div>
                <button
                  onClick={() => toggleActive(sched)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${sched.is_active ? 'bg-teal-500' : 'bg-slate-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${sched.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <FeeField label="Co-pay" value={formatCurrency(sched.copay_amount)} />
                <FeeField label="Deductible" value={formatCurrency(sched.deductible_amount)} />
                <FeeField label="Coinsurance" value={`${sched.coinsurance_percent}%`} />
                <FeeField label="Specialist Fee" value={formatCurrency(sched.specialist_fee)} />
                {sched.max_out_of_pocket && (
                  <FeeField label="Max OOP" value={formatCurrency(sched.max_out_of_pocket)} />
                )}
                <FeeField label="Effective" value={sched.effective_date} />
              </div>

              <button
                onClick={() => { setEditingSchedule(sched); setShowForm(true); }}
                className="mt-4 w-full rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                Edit Schedule
              </button>
            </Card>
          ))}
        </div>
      )}

      <FeeScheduleForm
        open={showForm}
        onClose={() => { setShowForm(false); setEditingSchedule(null); }}
        schedule={editingSchedule}
        onSave={saveSchedule}
      />
    </div>
  );
}

function FeeField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-slate-700">{value}</p>
    </div>
  );
}

function FeeScheduleForm({
  open,
  onClose,
  schedule,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  schedule: FeeSchedule | null;
  onSave: (data: Partial<FeeSchedule>) => void;
}) {
  const [form, setForm] = useState({
    name: '',
    insurance_provider: '',
    encounter_type: 'office_visit',
    copay_amount: 25,
    deductible_amount: 1000,
    coinsurance_percent: 20,
    specialist_fee: 50,
    max_out_of_pocket: 5000,
  });

  useEffect(() => {
    if (schedule) {
      setForm({
        name: schedule.name,
        insurance_provider: schedule.insurance_provider ?? '',
        encounter_type: schedule.encounter_type ?? 'office_visit',
        copay_amount: schedule.copay_amount,
        deductible_amount: schedule.deductible_amount,
        coinsurance_percent: schedule.coinsurance_percent,
        specialist_fee: schedule.specialist_fee,
        max_out_of_pocket: schedule.max_out_of_pocket ?? 5000,
      });
    } else {
      setForm({
        name: '',
        insurance_provider: '',
        encounter_type: 'office_visit',
        copay_amount: 25,
        deductible_amount: 1000,
        coinsurance_percent: 20,
        specialist_fee: 50,
        max_out_of_pocket: 5000,
      });
    }
  }, [schedule, open]);

  function update(field: string, value: string | number) {
    setForm({ ...form, [field]: value });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={schedule ? 'Edit Fee Schedule' : 'New Fee Schedule'}
      subtitle="Configure insurance co-pays, deductibles, and specialist fees"
      footer={
        <>
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button
            onClick={() => onSave({
              name: form.name,
              insurance_provider: form.insurance_provider || null,
              encounter_type: form.encounter_type,
              copay_amount: form.copay_amount,
              deductible_amount: form.deductible_amount,
              coinsurance_percent: form.coinsurance_percent,
              specialist_fee: form.specialist_fee,
              max_out_of_pocket: form.max_out_of_pocket,
              is_active: true,
            })}
            disabled={!form.name}
            className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            Save Schedule
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Schedule Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="e.g., BCBS Standard Plan"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Insurance Provider</label>
            <select
              value={form.insurance_provider}
              onChange={(e) => update('insurance_provider', e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none"
            >
              <option value="">All insurers</option>
              <option>Blue Cross Blue Shield</option>
              <option>Aetna</option>
              <option>United Healthcare</option>
              <option>Medicare</option>
              <option>Cigna</option>
              <option>Humana</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Encounter Type</label>
            <select
              value={form.encounter_type}
              onChange={(e) => update('encounter_type', e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none"
            >
              <option value="office_visit">Office Visit</option>
              <option value="specialist">Specialist</option>
              <option value="emergency">Emergency</option>
              <option value="telehealth">Telehealth</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Co-pay Amount ($)</label>
            <input type="number" value={form.copay_amount} onChange={(e) => update('copay_amount', parseFloat(e.target.value) || 0)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Deductible ($)</label>
            <input type="number" value={form.deductible_amount} onChange={(e) => update('deductible_amount', parseFloat(e.target.value) || 0)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Coinsurance (%)</label>
            <input type="number" value={form.coinsurance_percent} onChange={(e) => update('coinsurance_percent', parseFloat(e.target.value) || 0)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Specialist Fee ($)</label>
            <input type="number" value={form.specialist_fee} onChange={(e) => update('specialist_fee', parseFloat(e.target.value) || 0)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Max Out-of-Pocket ($)</label>
            <input type="number" value={form.max_out_of_pocket} onChange={(e) => update('max_out_of_pocket', parseFloat(e.target.value) || 0)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none" />
          </div>
        </div>
      </div>
    </Modal>
  );
}
