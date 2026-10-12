import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: boolean;
}

export function Card({ children, className = '', padding = true }: CardProps) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {padding ? <div className="p-5">{children}</div> : children}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: typeof import('lucide-react').DollarSign;
  trend?: { value: string; positive: boolean };
  color?: 'teal' | 'blue' | 'amber' | 'red' | 'emerald' | 'slate';
}

const STAT_COLORS: Record<string, { bg: string; text: string }> = {
  teal: { bg: 'bg-teal-50', text: 'text-teal-600' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-600' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600' },
  red: { bg: 'bg-red-50', text: 'text-red-600' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  slate: { bg: 'bg-slate-100', text: 'text-slate-600' },
};

export function StatCard({ label, value, icon: Icon, trend, color = 'teal' }: StatCardProps) {
  const colors = STAT_COLORS[color];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${colors.bg}`}>
          <Icon className={`h-5 w-5 ${colors.text}`} />
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
      {trend && (
        <p className={`mt-1 text-xs font-medium ${trend.positive ? 'text-emerald-600' : 'text-red-500'}`}>
          {trend.value}
        </p>
      )}
    </div>
  );
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
