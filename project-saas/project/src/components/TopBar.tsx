import { ChevronDown, UserCircle } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useRole } from '@/context/RoleContext';
import { ROLES, type Role } from '@/types';

export default function TopBar() {
  const { currentRole, roleConfig, actorName, setRole } = useRole();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const roleEntries = Object.values(ROLES);

  return (
    <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">{roleConfig.label} View</h2>
        <p className="text-sm text-slate-500">{roleConfig.description}</p>
      </div>

      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 transition-colors hover:bg-slate-100"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-500 text-sm font-semibold text-white">
            {actorName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-slate-800">{actorName}</p>
            <p className="text-xs text-slate-500">{roleConfig.label}</p>
          </div>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>

        {open && (
          <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-slate-200 bg-white shadow-lg">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Switch Role</p>
              <p className="text-xs text-slate-500 mt-1">Demo: RBAC role switching</p>
            </div>
            <div className="py-2">
              {roleEntries.map((role) => (
                <button
                  key={role.id}
                  onClick={() => {
                    setRole(role.id as Role);
                    setOpen(false);
                  }}
                  className={`flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-50 ${
                    currentRole === role.id ? 'bg-teal-50' : ''
                  }`}
                >
                  <UserCircle className={`mt-0.5 h-5 w-5 flex-shrink-0 ${
                    currentRole === role.id ? 'text-teal-600' : 'text-slate-400'
                  }`} />
                  <div>
                    <p className={`text-sm font-medium ${currentRole === role.id ? 'text-teal-700' : 'text-slate-700'}`}>
                      {role.label}
                    </p>
                    <p className="text-xs text-slate-500">{role.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
