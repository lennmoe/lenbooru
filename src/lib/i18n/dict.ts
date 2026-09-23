import type { Role } from "../perms";

export type Lang = "fr" | "en";
export const LANGS: Lang[] = ["fr", "en"];
export const DEFAULT_LANG: Lang = "fr";
export const LANG_COOKIE = "lang";

const fr = {
  locale: "fr-FR",
  bytes: ["o", "Ko", "Mo", "Go"],
  decimal: ",",

  meta: {
    description:
      "Image board privé — images, GIFs, vidéos et doujins. Accès sur liste blanche, connexion avec Discord.",
  },

  common: {
    gallery: "Galerie",
    error: (status: number | string) => `Erreur ${status}`,
    networkError: "Erreur réseau",
    save: "Enregistrer",
    saving: "Enregistrement…",
    title: "Titre",
  },

  lang: { switchTo: "Switch to English", short: "FR" },

  theme: { toLight: "Passer en mode clair", toDark: "Passer en mode sombre" },

  auth: {
    loginDesc:
      "Image board privé — images, GIFs, vidéos et doujins. L'accès est réservé aux membres sur la liste blanche : connecte-toi avec Discord, et si tu n'es pas encore whitelisté, demande l'accès sur le serveur.",
    signIn: "Se connecter avec Discord",
    redirecting: "Redirection…",
    joinServer: "Rejoindre le serveur Discord",
    inviteMissing: "Lien d'invitation non configuré (DISCORD_INVITE_URL)",
    signOut: "Se déconnecter",
    signingOut: "Déconnexion…",
    deniedTitle: "Accès refusé",
    deniedNotListedBefore: "Ton compte Discord",
    deniedNotListedAfter: "n'est pas sur la liste blanche.",
    deniedGiveId: "Donne cet identifiant au propriétaire pour être ajouté :",
  },

  header: {
    searchPlaceholder: "Rechercher des tags (ex: bikini school)",
    upload: "+ Upload",
    members: "Membres",
  },

  roles: {
    viewer: "Lecture seule",
    editor: "Édition (titre + tags)",
    uploader: "Upload + édition + suppression",
    owner: "Propriétaire",
  } satisfies Record<Role, string> as Record<Role, string>,
  roleHints: {
    viewer: "Peut voir la galerie et lire les doujins.",
    editor: "Peut aussi modifier titre et tags des posts.",
    uploader: "Peut aussi uploader et supprimer des posts.",
    owner: "Contrôle total + gestion des membres.",
  } satisfies Record<Role, string> as Record<Role, string>,

  gallery: {
    all: "Tout",
    types: { image: "Images", gif: "GIFs", video: "Vidéos", doujin: "Doujins" },
    filter: "Filtre :",
    removeTag: "Retirer ce tag",
    empty: "Rien ici.",
    uploadFirst: "Upload ton premier post →",
    loading: "Chargement…",
    end: "— fin —",
    badgeVideo: "vidéo",
  },

  post: {
    prev: "Post précédent",
    next: "Post suivant",
    edit: "Éditer",
    fits: { original: "Taille originale", width: "largeur", height: "hauteur", both: "les deux" },
    doujinInfo: (size: string, pages: number) => `${size} Doujin (${pages} pages)`,
    unknownUploader: "Inconnu",
    justNow: "à l'instant",
    tags: (n: number) => `Tags (${n})`,
    noTags: "Aucun tag",
    read: (n: number) => `Lire (${n} pages)`,
    copyDiscord: "Copier le lien Discord",
    copied: "Lien copié !",
    copyHint: "Lien public signé : collé sur Discord, l'image s'affiche directement",
    copyPrompt: "Copie ce lien :",
    delete: "Supprimer",
    deleting: "Suppression…",
    deleteConfirm: "Supprimer ce post et ses fichiers ?",
    deleteFailed: "Échec de la suppression",
    editTitle: (id: number) => `Éditer le post #${id}`,
    type: "Type",
    tagsField: "Tags (espaces ou virgules)",
    backToPost: (id: number) => `← Post #${id}`,
  },

  upload: {
    modes: {
      image: { name: "Image", sub: "jpg / png / webp" },
      gif: { name: "GIF", sub: "animé" },
      video: { name: "Vidéo", sub: "mp4 / webm" },
      doujin: { name: "Doujin", sub: "zip / cbz" },
    },
    hints: {
      image: "JPG, PNG, WebP, AVIF… — plusieurs fichiers possible",
      gif: "GIF animés — plusieurs fichiers possible",
      video: "MP4, WebM, MOV, MKV… — un seul fichier",
      doujin: "Un ou plusieurs .zip / .cbz — images nommées 1, 2, 3… (l'image 1 = couverture)",
    },
    dropMany: "Glisse un ou plusieurs fichiers ici",
    dropOne: "Glisse un fichier ici",
    orClick: "ou clique",
    view: "voir →",
    remove: "retirer",
    titlePlaceholder: "Titre du post",
    multiNote: (n: number) => `${n} fichiers — le titre de chacun sera son nom de fichier.`,
    commonTags: "Tags communs (espaces ou virgules)",
    done: (n: number) => `${n} import(s) réussi(s).`,
    seeGallery: "Voir la galerie →",
    uploading: "Upload en cours…",
    processing: "traitement…",
    retrying: (n: number) => `nouvel essai (${n})…`,
    uploadN: (n: number) => `Uploader ${n} fichiers`,
    uploadOne: "Uploader",
    clear: "Vider",
  },

  members: {
    title: "Membres",
    intro: "Ajoute des membres par leur ID Discord et choisis leur niveau d'accès.",
    ownerNoteBefore: "Ton compte",
    ownerNoteAfter: "est propriétaire en permanence.",
    discordId: "ID Discord",
    idPlaceholder: "ex: 123456789012345678",
    username: "Pseudo (optionnel)",
    usernamePlaceholder: "affichage",
    role: "Rôle",
    add: "Ajouter",
    removeConfirm: "Retirer ce membre ?",
    remove: "Retirer",
    ownerTag: "propriétaire",
    none: "Aucun membre pour l'instant.",
  },

  reset: {
    title: "Zone de danger",
    descBefore: "Supprime",
    descStrong: "tous les posts",
    descAfter: "(images, GIFs, vidéos, doujins), les tags et les fichiers médias. Irréversible.",
    alsoMembers: "Vider aussi la liste blanche (ton compte reste propriétaire)",
    typeBefore: "Tape",
    typeAfter: "pour confirmer",
    button: "Réinitialiser les données",
    running: "Suppression…",
    result: (posts: number, members: number | null) =>
      `${posts} post(s) supprimé(s)` + (members === null ? "" : `, ${members} membre(s) retiré(s)`) + ".",
  },

  reader: { back: "← Retour" },

  notFound: { text: "Introuvable.", back: "Retour à la galerie →" },

  api: {
    forbidden: "Accès refusé",
    unauthorized: "Non autorisé",
    notFound: "Introuvable",
    noUploadPerm: "Tu n'as pas la permission d'uploader",
    noEditPerm: "Édition non autorisée",
    noDeletePerm: "Suppression non autorisée",
    missingFile: "Fichier manquant",
    mustBeGif: "Le fichier doit être un .gif",
    badImage: (ext: string) => `Format image non supporté : .${ext}`,
    badVideo: (ext: string) => `Format vidéo non supporté : .${ext}`,
    mustBeZip: "Le doujin doit être un .zip (ou .cbz)",
    zipNoImages: "Aucune image trouvée dans le zip",
    zipInvalid: "Archive zip illisible",
    unknownType: "Type inconnu",
    serverError: "Erreur serveur",
    badDiscordId: "ID Discord invalide",
    badRole: "Rôle invalide",
    missingConfirm: "Confirmation manquante",
    chunkTooLarge: "Morceau trop gros",
    missingChunk: "Upload incomplet, morceau manquant",
  },
};

export type Dict = typeof fr;

const en: Dict = {
  locale: "en-US",
  bytes: ["B", "KB", "MB", "GB"],
  decimal: ".",

  meta: {
    description:
      "Private image board — images, GIFs, videos and doujins. Whitelist-only access, sign in with Discord.",
  },

  common: {
    gallery: "Gallery",
    error: (status) => `Error ${status}`,
    networkError: "Network error",
    save: "Save",
    saving: "Saving…",
    title: "Title",
  },

  lang: { switchTo: "Passer en français", short: "EN" },

  theme: { toLight: "Switch to light mode", toDark: "Switch to dark mode" },

  auth: {
    loginDesc:
      "Private image board — images, GIFs, videos and doujins. Access is limited to whitelisted members: sign in with Discord, and if you're not whitelisted yet, ask for access on the server.",
    signIn: "Sign in with Discord",
    redirecting: "Redirecting…",
    joinServer: "Join the Discord server",
    inviteMissing: "Invite link not configured (DISCORD_INVITE_URL)",
    signOut: "Sign out",
    signingOut: "Signing out…",
    deniedTitle: "Access denied",
    deniedNotListedBefore: "Your Discord account",
    deniedNotListedAfter: "is not on the whitelist.",
    deniedGiveId: "Give this ID to the owner to get added:",
  },

  header: {
    searchPlaceholder: "Search tags (e.g. bikini school)",
    upload: "+ Upload",
    members: "Members",
  },

  roles: {
    viewer: "Read only",
    editor: "Edit (title + tags)",
    uploader: "Upload + edit + delete",
    owner: "Owner",
  },
  roleHints: {
    viewer: "Can browse the gallery and read doujins.",
    editor: "Can also edit post titles and tags.",
    uploader: "Can also upload and delete posts.",
    owner: "Full control + member management.",
  },

  gallery: {
    all: "All",
    types: { image: "Images", gif: "GIFs", video: "Videos", doujin: "Doujins" },
    filter: "Filter:",
    removeTag: "Remove this tag",
    empty: "Nothing here.",
    uploadFirst: "Upload your first post →",
    loading: "Loading…",
    end: "— end —",
    badgeVideo: "video",
  },

  post: {
    prev: "Previous post",
    next: "Next post",
    edit: "Edit",
    fits: { original: "Original size", width: "fit width", height: "height", both: "both" },
    doujinInfo: (size, pages) => `${size} Doujin (${pages} pages)`,
    unknownUploader: "Unknown",
    justNow: "just now",
    tags: (n) => `Tags (${n})`,
    noTags: "No tags",
    read: (n) => `Read (${n} pages)`,
    copyDiscord: "Copy Discord link",
    copied: "Link copied!",
    copyHint: "Signed public link: paste it on Discord and the image shows up directly",
    copyPrompt: "Copy this link:",
    delete: "Delete",
    deleting: "Deleting…",
    deleteConfirm: "Delete this post and its files?",
    deleteFailed: "Delete failed",
    editTitle: (id) => `Edit post #${id}`,
    type: "Type",
    tagsField: "Tags (spaces or commas)",
    backToPost: (id) => `← Post #${id}`,
  },

  upload: {
    modes: {
      image: { name: "Image", sub: "jpg / png / webp" },
      gif: { name: "GIF", sub: "animated" },
      video: { name: "Video", sub: "mp4 / webm" },
      doujin: { name: "Doujin", sub: "zip / cbz" },
    },
    hints: {
      image: "JPG, PNG, WebP, AVIF… — multiple files allowed",
      gif: "Animated GIFs — multiple files allowed",
      video: "MP4, WebM, MOV, MKV… — one file",
      doujin: "One or more .zip / .cbz — images named 1, 2, 3… (image 1 = cover)",
    },
    dropMany: "Drop one or more files here",
    dropOne: "Drop a file here",
    orClick: "or click",
    view: "view →",
    remove: "remove",
    titlePlaceholder: "Post title",
    multiNote: (n) => `${n} files — each post will be titled with its file name.`,
    commonTags: "Shared tags (spaces or commas)",
    done: (n) => `${n} upload(s) done.`,
    seeGallery: "Go to gallery →",
    uploading: "Uploading…",
    processing: "processing…",
    retrying: (n) => `retrying (${n})…`,
    uploadN: (n) => `Upload ${n} files`,
    uploadOne: "Upload",
    clear: "Clear",
  },

  members: {
    title: "Members",
    intro: "Add members by their Discord ID and choose their access level.",
    ownerNoteBefore: "Your account",
    ownerNoteAfter: "is permanently the owner.",
    discordId: "Discord ID",
    idPlaceholder: "e.g. 123456789012345678",
    username: "Username (optional)",
    usernamePlaceholder: "display name",
    role: "Role",
    add: "Add",
    removeConfirm: "Remove this member?",
    remove: "Remove",
    ownerTag: "owner",
    none: "No members yet.",
  },

  reset: {
    title: "Danger zone",
    descBefore: "Deletes",
    descStrong: "every post",
    descAfter: "(images, GIFs, videos, doujins), all tags and media files. Cannot be undone.",
    alsoMembers: "Also clear the whitelist (your account stays owner)",
    typeBefore: "Type",
    typeAfter: "to confirm",
    button: "Reset data",
    running: "Deleting…",
    result: (posts, members) =>
      `${posts} post(s) deleted` + (members === null ? "" : `, ${members} member(s) removed`) + ".",
  },

  reader: { back: "← Back" },

  notFound: { text: "Not found.", back: "Back to the gallery →" },

  api: {
    forbidden: "Access denied",
    unauthorized: "Unauthorized",
    notFound: "Not found",
    noUploadPerm: "You don't have permission to upload",
    noEditPerm: "Editing not allowed",
    noDeletePerm: "Deleting not allowed",
    missingFile: "Missing file",
    mustBeGif: "The file must be a .gif",
    badImage: (ext) => `Unsupported image format: .${ext}`,
    badVideo: (ext) => `Unsupported video format: .${ext}`,
    mustBeZip: "A doujin must be a .zip (or .cbz)",
    zipNoImages: "No images found in the zip",
    zipInvalid: "Unreadable zip archive",
    unknownType: "Unknown type",
    serverError: "Server error",
    badDiscordId: "Invalid Discord ID",
    badRole: "Invalid role",
    missingConfirm: "Missing confirmation",
    chunkTooLarge: "Chunk too large",
    missingChunk: "Incomplete upload, missing chunk",
  },
};

export const DICTS: Record<Lang, Dict> = { fr, en };

export function isLang(v: unknown): v is Lang {
  return v === "fr" || v === "en";
}

/** Byte size with the language's units and decimal separator. */
export function formatBytes(t: Dict, n: number): string {
  if (!n) return "?";
  let i = 0;
  let v = n;
  while (v >= 1024 && i < t.bytes.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0).replace(".", t.decimal)} ${t.bytes[i]}`;
}
