# lenbooru

Image board perso pour images, GIFs, vidéos et doujins. Accès privé par login Discord.
Next.js (App Router) + SQLite + fichiers en local.

## Installation

1. Créer une app sur https://discord.com/developers/applications, et dans **OAuth2 → Redirects**
   ajouter `http://localhost:3000/api/auth/callback/discord`.
2. Copier `.env.example` vers `.env.local` :

   ```
   AUTH_DISCORD_ID=...        # Client ID
   AUTH_DISCORD_SECRET=...    # Client Secret
   AUTH_SECRET=...            # npx auth secret
   OWNER_DISCORD_ID=...       # ton ID Discord (propriétaire)
   DISCORD_BOT_TOKEN=...      # optionnel : bot de liste blanche
   DISCORD_INVITE_URL=...     # optionnel : bouton « Rejoindre le serveur »
   ```

3. Lancer :

   ```bash
   npm install
   npm run dev    # http://localhost:3000
   ```

## Accès

Tout le site demande le login Discord. Un compte hors liste blanche arrive sur `/denied`.

| Rôle | Voir | Éditer | Upload / supprimer | Admin |
|---|:---:|:---:|:---:|:---:|
| `viewer` | ✅ | | | |
| `editor` | ✅ | ✅ | | |
| `uploader` | ✅ | ✅ | ✅ | |
| `owner` | ✅ | ✅ | ✅ | ✅ |

Les membres se gèrent dans `/admin` ou avec le bot Discord (`/wl add`, `/wl remove`, `/wl list`)
si `DISCORD_BOT_TOKEN` est défini.

## Fonctionnalités

- **Galerie** avec recherche multi-tags, autocomplétion, filtres par type et scroll infini
- **Upload** d'images, GIFs, vidéos et doujins (`.zip` / `.cbz`), par morceaux, sans limite pratique
- **Tags** par catégorie (artiste, parodie, personnage, général) et classification (`rating:e`…)
- **Lecteur doujin** vertical
- **Chat** en temps réel avec salons, pièces jointes, réactions et réponses
- **Partage Discord** par lien public signé vers le fichier
- **Admin** : actions groupées sur les posts, gestion des tags et des membres
- FR / EN, thème clair / sombre

## Stockage

Tout est dans `data/` : la base SQLite (`data/lenbooru.db`) et les fichiers (`data/media/`).
Pour sauvegarder, copier ce dossier.

Voir [DEPLOY.md](DEPLOY.md) pour la mise en ligne.
