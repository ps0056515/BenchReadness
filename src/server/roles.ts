export const USER_ROLES = [
  "ENGINEER",
  "BENCH_MANAGER",
  "TALENT",
  "PRACTICE_LEAD",
  "COMPLIANCE",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_RANK: Record<UserRole, number> = {
  ENGINEER: 10,
  BENCH_MANAGER: 40,
  TALENT: 50,
  PRACTICE_LEAD: 60,
  COMPLIANCE: 70,
};

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (USER_ROLES as readonly string[]).includes(value);
}

export function pickHighestRole(roles: UserRole[]): UserRole {
  return roles.sort((a, b) => ROLE_RANK[b] - ROLE_RANK[a])[0] ?? "ENGINEER";
}

