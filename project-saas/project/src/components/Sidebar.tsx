import { LayoutDashboard, FileText, Receipt, RotateCcw, Users, Settings, ShieldCheck, HeartPulse } from 'lucide-react';
import { useRole } from '@/context/RoleContext';
import { ROLES, type Role } from '@/types';

export type ViewKey =
  | 'dashboard'
  | 'claims'
  | 'bills'
  | 'refunds'
  | 'patients'
  | 'fee-schedules'
  | 'audit-logs';

interface NavItem {
  key: ViewKey;
  label: string;
  icon: typeof LayoutDashboard;
  requiresPermission?: keyof ReturnType<typeof useRole>['hasPermission'] extends never ? never : 'canManageBills' | 'canApproveRefunds' | 'canConfigureFees' | 'canViewAuditLogs' | 'canViewPhi';
  rolesAllowed?: Role[];
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'claims', label: 'Claims', icon: FileText },
  { key: 'bills', label: 'Bills', icon: Receipt },
  { key: 'refunds', label: 'Refunds', icon: RotateCcw, rolesAllowed: ['billing_admin', 'compliance_auditor'] },
  { key: 'patients', label: 'Patients', icon: Users, rolesAllowed: ['provider', 'billing_admin', 'compliance_auditor'] },
  { key: 'fee-schedules', label: 'Fee Schedules', icon: Settings, rolesAllowed: ['billing_admin'] },
  { key: 'audit-logs', label: 'Audit Logs', icon: ShieldCheck, rolesAllowed: ['compliance_auditor'] },
];

interface SidebarProps {
  currentView: ViewKey;
  onNavigate: (view: ViewKey) => void;
}

export default function Sidebar({ currentView, onNavigate }: SidebarProps) {
  const { currentRole } = useRole();

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (!item.rolesAllowed) return true;
    return item.rolesAllowed.includes(currentRole);
  });

  return (
    <aside className="flex w-64 flex-shrink-0 flex-col bg-slate-900 text-slate-100">
      <div className="flex items-center gap-3 border-b border-slate-800 px-6 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/20">
          <HeartPulse className="h-6 w-6 text-teal-400" />
        </div>
        <div>
          <h1 className="text-sm font-semibold leading-tight text-white">MediBill</h1>
          <p className="text-xs text-slate-400">Smart Payments</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = currentView === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                active
                  ? 'bg-teal-500/15 text-teal-300'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 px-3 py-4">
        <div className="rounded-lg bg-slate-800/50 px-3 py-2.5">
          <p className="text-xs font-medium text-slate-300">HIPAA Compliant</p>
          <p className="text-xs text-slate-500">PHI encrypted at rest</p>
        </div>
      </div>
    </aside>
  );
}
