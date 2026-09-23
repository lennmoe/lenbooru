export type Role = "owner" | "uploader" | "editor" | "viewer";

export const ROLES: Role[] = ["viewer", "editor", "uploader", "owner"];

export const ROLE_LABEL: Record<Role, string> = {
  viewer: "Lecture seule",
  editor: "Édition (titre + tags)",
  uploader: "Upload + édition + suppression",
  owner: "Propriétaire",
};

export function canRead(r?: Role | null): boolean {
  return !!r;
}
export function canEdit(r?: Role | null): boolean {
  return r === "owner" || r === "uploader" || r === "editor";
}
export function canUpload(r?: Role | null): boolean {
  return r === "owner" || r === "uploader";
}
export function canDelete(r?: Role | null): boolean {
  return r === "owner" || r === "uploader";
}
export function canManageUsers(r?: Role | null): boolean {
  return r === "owner";
}
