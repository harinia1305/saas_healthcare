import { useState } from 'react';
import Sidebar, { type ViewKey } from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import { RoleProvider, useRole } from '@/context/RoleContext';
import Dashboard from '@/views/Dashboard';
import Claims from '@/views/Claims';
import Bills from '@/views/Bills';
import Refunds from '@/views/Refunds';
import Patients from '@/views/Patients';
import FeeSchedules from '@/views/FeeSchedules';
import AuditLogs from '@/views/AuditLogs';
import { Lock } from 'lucide-react';

function AppContent() {
  const [view, setView] = useState<ViewKey>('dashboard');
  const { roleConfig } = useRole();

  function renderView() {
    switch (view) {
      case 'dashboard':
        return <Dashboard onNavigate={(v) => setView(v as ViewKey)} />;
      case 'claims':
        return <Claims />;
      case 'bills':
        return <Bills />;
      case 'refunds':
        return roleConfig.id === 'patient' ? <AccessDenied /> : <Refunds />;
      case 'patients':
        return <Patients />;
      case 'fee-schedules':
        return roleConfig.canConfigureFees ? <FeeSchedules /> : <AccessDenied />;
      case 'audit-logs':
        return roleConfig.canViewAuditLogs ? <AuditLogs /> : <AccessDenied />;
      default:
        return <Dashboard onNavigate={(v) => setView(v as ViewKey)} />;
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar currentView={view} onNavigate={setView} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          {renderView()}
        </main>
      </div>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="flex h-full flex-col items-center justify-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
        <Lock className="h-8 w-8 text-red-500" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-slate-800">Access Restricted</h2>
      <p className="mt-1 text-sm text-slate-500">Your role does not have permission to view this section.</p>
    </div>
  );
}

export default function App() {
  return (
    <RoleProvider>
      <AppContent />
    </RoleProvider>
  );
}
