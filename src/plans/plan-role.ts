export const PLAN_ROLES = ['owner', 'editor', 'viewer'] as const;
export type PlanRole = (typeof PLAN_ROLES)[number];

// Who may do what in a plan (see PlanAccessService).
export const READ_ROLES: readonly PlanRole[] = ['owner', 'editor', 'viewer'];
export const WRITE_ROLES: readonly PlanRole[] = ['owner', 'editor'];
export const OWNER_ROLES: readonly PlanRole[] = ['owner'];
