# lenbooru

Image board perso pour ranger images, vidéos et doujins. Accès privé par login Discord.
Next.js (App Router) + SQLite + stockage fichiers local.

## Mise en route

### 1. Créer l'app Discord

1. https://discord.com/developers/applications → **New Application**
2. Onglet **OAuth2** → **Redirects** → ajouter :
   `http://localhost:3000/api/auth/callback/discord`
3. Copier **Client ID** et **Client Secret**

### 2. Config

Copier `.env.example` vers `.env.local` et remplir :

```
AUTH_DISCORD_ID=...            # Client ID
AUTH_DISCORD_SECRET=...        # Client Secret
AUTH_SECRET=...                # npx auth secret
OWNER_DISCORD_ID=435068712786198538   # ton ID = propriétaire permanent
```

### 3. Lancer

```bash
npm install
npm run dev            # http://localhost:3000
# ou : npm run build && npm start
```

## Accès & permissions

Tout le site est derrière le login Discord (middleware). Un compte connecté mais **pas
sur la liste blanche** tombe sur `/denied` qui affiche son ID Discord à transmettre.

| Rôle | Voir / lire | Éditer titre + tags | Upload + supprimer | Gérer les membres |
|---|:---:|:---:|:---:|:---:|
| `viewer` (lecture seule) | ✅ | | | |
| `editor` (édition) | ✅ | ✅ | | |
| `uploader` (upload) | ✅ | ✅ | ✅ | |
| `owner` (toi) | ✅ | ✅ | ✅ | ✅ |

**Page `/members`** (propriétaire uniquement) : ajouter un membre par son ID Discord,
changer son rôle, le retirer. Ton `OWNER_DISCORD_ID` est toujours `owner`.

> Le rôle est mis en cache dans la session : un membre fraîchement ajouté/modifié doit
> se **reconnecter** (ou attendre le rafraîchissement de session) pour voir le changement.

## Contenu

- **Upload** (`/upload`) : Image / Vidéo / Doujin.
  - Images et doujins : **sélection multiple** — les fichiers sont importés à la suite
    avec une barre de progression par fichier. Tags communs appliqués à tous ;
    pour un import multiple le titre de chaque post = son nom de fichier.
  - **Doujin** = un `.zip` / `.cbz` avec les images nommées `1, 2, 3, …`.
    Triées en ordre naturel, ré-numérotées `001…NNN`, **l'image 1 = couverture**.
- **Galerie** (`/`) : grille responsive, filtres par type, recherche multi-tags, scroll infini.
- **Post** (`/post/[id]`) : média, tags cliquables ; boutons **Éditer** / **Supprimer** selon le rôle.
- **Édition** (`/post/[id]/edit`) : titre + tags.
- **Lecture doujin** (`/doujin/[id]/read`) : lecteur vertical webtoon, indicateur de page, saut `#p12`.

## Stockage (tout local)

| Quoi | Où |
|---|---|
| Base de données | `./data/lenbooru.db` (SQLite, WAL) — tables `posts / tags / post_tags / doujin_pages / users` |
| Images | `./data/media/image/<id>.<ext>` |
| Vidéos | `./data/media/video/<id>.<ext>` |
| Pages doujin | `./data/media/doujin/<id>/001.jpg …` |
| Miniatures | `./data/media/thumb/<id>.webp` |

Les fichiers sont servis par la route [`/media/[...path]`](src/app/media/[...path]/route.ts)
(type MIME, cache, **HTTP Range** pour le seek vidéo), et donc eux aussi derrière le login.

Sauvegarde = copier le dossier `data/`.

## Notes

- L'upload bufferise chaque fichier en mémoire : pour de très grosses vidéos, prévoir de la RAM.
- Aucun HTTPS/déploiement configuré : app pensée pour tourner en local.
