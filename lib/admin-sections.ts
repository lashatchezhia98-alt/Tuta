export const adminSections = ["overview", "features", "reports", "content", "doctors", "care", "market", "orders", "tools", "website-copy", "invitations", "users", "billing", "notifications", "analytics"] as const;
export type AdminSection = (typeof adminSections)[number];
export type AdminAccess = "owner" | "admin" | "content_editor" | "support";
export const adminRoleLabels = { admin: ["ადმინი", "Administrator"], content_editor: ["კონტენტის რედაქტორი", "Content editor"], support: ["მხარდაჭერა", "Support agent"] } as const;
export function isAssignableAdminRole(value: unknown): value is keyof typeof adminRoleLabels {
  return value === "admin" || value === "content_editor" || value === "support";
}

export function canAccessAdminSection(role: AdminAccess, section: AdminSection) {
  if (role === "owner") return true;
  if (section === "invitations") return false;
  if (role === "admin") return true;
  if (role === "content_editor") return section === "content" || section === "website-copy";
  return role === "support" && section === "users";
}

export function adminHome(role: AdminAccess) {
  return role === "content_editor" ? "/admin/content" : role === "support" ? "/admin/users" : "/admin";
}
