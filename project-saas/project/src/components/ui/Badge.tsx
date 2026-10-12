interface BadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const STATUS_STYLES: Record<string, string> = {
  // Bill statuses
  draft: 'bg-slate-100 text-slate-700 ring-slate-200',
  submitted: 'bg-blue-50 text-blue-700 ring-blue-200',
  partially_paid: 'bg-amber-50 text-amber-700 ring-amber-200',
  paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  overdue: 'bg-red-50 text-red-700 ring-red-200',
  written_off: 'bg-slate-100 text-slate-500 ring-slate-200',
  refunded: 'bg-purple-50 text-purple-700 ring-purple-200',

  // Claim statuses
  in_review: 'bg-blue-50 text-blue-700 ring-blue-200',
  adjudicated: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  denied: 'bg-red-50 text-red-700 ring-red-200',
  appealed: 'bg-orange-50 text-orange-700 ring-orange-200',

  // Refund statuses
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  calculated: 'bg-blue-50 text-blue-700 ring-blue-200',
  approved: 'bg-teal-50 text-teal-700 ring-teal-200',
  processing: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  completed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  cancelled: 'bg-slate-100 text-slate-500 ring-slate-200',

  // Patient & Encounter statuses
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  inactive: 'bg-slate-100 text-slate-500 ring-slate-200',
  scheduled: 'bg-blue-50 text-blue-700 ring-blue-200',
  no_show: 'bg-slate-100 text-slate-500 ring-slate-200',
};

const LABELS: Record<string, string> = {
  in_review: 'In Review',
  written_off: 'Written Off',
  no_show: 'No Show',
};

function formatLabel(status: string): string {
  if (LABELS[status]) return LABELS[status];
  return status
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function Badge({ status, size = 'md' }: BadgeProps) {
  const styleClass = STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-700 ring-slate-200';
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span className={`inline-flex items-center rounded-full font-medium ring-1 ring-inset ${styleClass} ${sizeClass}`}>
      {formatLabel(status)}
    </span>
  );
}
