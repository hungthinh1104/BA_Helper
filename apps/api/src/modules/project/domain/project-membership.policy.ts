import type { ProjectRole, UserRole } from '@ba-helper/contracts';

export function mapGlobalRoleToProjectRole(role: UserRole): ProjectRole {
  switch (role) {
    case 'ADMIN':
      return 'OWNER';
    case 'REVIEWER':
      return 'REVIEWER';
    case 'VIEWER':
      return 'VIEWER';
  }
}
