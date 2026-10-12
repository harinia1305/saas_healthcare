import { useEffect, useState } from 'react';
import { ShieldCheck, Search, Download, Lock, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { formatDateTime } from '@/lib/format';
import type { AuditLog } from '@/types';

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [tableFilter, setTableFilter] = useState('all');
  const [phiOnly, setPhiOnly] = useState(false);

  useEffect(() => {
    supabase
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setLogs(data ?? []);
        setLoading(false);
      });
  }, []);

  const tables = [...new Set(logs.map((l) => l.table_name))].sort();

  const filtered = logs.filter((l) => {
    const matchesSearch = !search ||
      (l.actor_name?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (l.action.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (l.table_name.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (l.access_context?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchesAction = actionFilter === 'all' || l.action.toLowerCase() === actionFilter.toLowerCase();
    const matchesTable = tableFilter === 'all' || l.table_name === tableFilter;
    const matchesPhi = !phiOnly || l.phi_accessed;
    return matchesSearch && matchesAction && matchesTable && matchesPhi;
  });

  const phiCount = logs.filter((l) => l.phi_accessed).length;
  const exportCount = logs.filter((l) => l.exported).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Audit Logs</h1>
        <p className="mt-1 text-sm text-slate-500">Immutable record of all PHI access, modifications, and exports</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-teal-600" />
            <p className="text-sm font-medium text-slate-500">Total Events</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{logs.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-amber-600" />
            <p className="text-sm font-medium text-slate-500">PHI Access Events</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{phiCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Download className="h-5 w-5 text-blue-600" />
            <p className="text-sm font-medium text-slate-500">Data Exports</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{exportCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <p className="text-sm font-medium text-slate-500">Auto-Triggered</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {logs.filter((l) => l.actor_role === 'system' || l.access_context === 'database_trigger').length}
          </p>
        </div>
      </div>

      <Card padding={false}>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by actor, action, or context..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none"
          >
            <option value="all">All Actions</option>
            <option value="INSERT">Insert</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
            <option value="VIEW">View</option>
            <option value="EXPORT">Export</option>
            <option value="CREATE">Create</option>
          </select>
          <select
            value={tableFilter}
            onChange={(e) => setTableFilter(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none"
          >
            <option value="all">All Tables</option>
            {tables.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={phiOnly}
              onChange={(e) => setPhiOnly(e.target.checked)}
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            PHI only
          </label>
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
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Timestamp</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Actor</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Role</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Action</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Table</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Context</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">PHI</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Export</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDateTime(log.timestamp)}</td>
                    <td className="px-5 py-3 text-sm font-medium text-slate-800">{log.actor_name ?? 'System'}</td>
                    <td className="px-5 py-3 text-xs text-slate-500">{log.actor_role ?? '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
                        log.action === 'DELETE' ? 'bg-red-50 text-red-700' :
                        log.action === 'INSERT' || log.action === 'CREATE' ? 'bg-emerald-50 text-emerald-700' :
                        log.action === 'UPDATE' ? 'bg-amber-50 text-amber-700' :
                        log.action === 'EXPORT' ? 'bg-blue-50 text-blue-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm font-mono text-slate-600">{log.table_name}</td>
                    <td className="px-5 py-3 text-xs text-slate-500 max-w-xs truncate">{log.access_context ?? '—'}</td>
                    <td className="px-5 py-3">
                      {log.phi_accessed ? (
                        <Lock className="h-4 w-4 text-amber-500" />
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {log.exported ? (
                        <Download className="h-4 w-4 text-blue-500" />
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-5 py-3">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-teal-600" />
          <div>
            <p className="text-sm font-medium text-slate-700">Immutable Audit Trail</p>
            <p className="mt-0.5 text-xs text-slate-500">
              These logs are write-once, read-only. No UPDATE or DELETE operations are permitted on the audit_logs table.
              Database triggers automatically log all INSERT/UPDATE/DELETE operations on patients, claims, and refunds.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
