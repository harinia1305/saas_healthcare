import { createContext, useContext, useState, type ReactNode } from 'react';
import { ROLES, type Role, type RoleConfig } from '@/types';

interface RoleContextValue {
  currentRole: Role;
  roleConfig: RoleConfig;
  actorName: string;
  setRole: (role: Role) => void;
  setActorName: (name: string) => void;
  hasPermission: (key: keyof Omit<RoleConfig, 'id' | 'label' | 'description'>) => boolean;
}

const ROLE_ACTORS: Record<Role, string> = {
  provider: 'Dr. Robert Williams',
  billing_admin: 'Janet Lee',
  compliance_auditor: 'Patricia Garcia',
  patient: 'Sarah Mitchell',
};

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [currentRole, setCurrentRole] = useState<Role>('billing_admin');

  const setRole = (role: Role) => {
    setCurrentRole(role);
  };

  const roleConfig = ROLES[currentRole];
  const actorName = ROLE_ACTORS[currentRole];

  const hasPermission = (key: keyof Omit<RoleConfig, 'id' | 'label' | 'description'>): boolean => {
    return roleConfig[key] as boolean;
  };

  return (
    <RoleContext.Provider value={{ currentRole, roleConfig, actorName, setRole, setActorName: () => {}, hasPermission }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used within RoleProvider');
  return ctx;
}
