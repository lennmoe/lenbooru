export type Role = "owner" | "uploader" | "editor" | "viewer";

export const ROLES: Role[] = ["viewer", "editor", "uploader", "owner"];

export const ROLE_LABEL: Record<Role, string> = {
  viewer: "Lecture seule",
  editor: "Édition (titre + tags)",
  uploader: "Upload + édition + suppression",
  owner: "Propriétaire",
};

export const ROLE_HINT: Record<Role, string> = {
  viewer: "Peut voir la galerie et lire les doujins.",
  editor: "Peut aussi modifier titre et tags des posts.",
  uploader: "Peut aussi uploader et supprimer des posts.",
  owner: "Contrôle total + gestion des membres.",
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
