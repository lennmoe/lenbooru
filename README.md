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
DISCORD_BOT_TOKEN=...          # optionnel : bot de liste blanche
DISCORD_INVITE_URL=...         # optionnel : bouton « Rejoindre le serveur » sur /login
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

| Rôle | Voir / lire | Éditer tags + infos | Upload + supprimer | Gérer les membres |
|---|:---:|:---:|:---:|:---:|
| `viewer` (lecture seule) | ✅ | | | |
| `editor` (édition) | ✅ | ✅ | | |
| `uploader` (upload) | ✅ | ✅ | ✅ | |
| `owner` (toi) | ✅ | ✅ | ✅ | ✅ |

**Page `/admin`** (propriétaire uniquement), en onglets :
- **Posts** : filtres (tags, `rating:x`, type) et actions groupées sur la sélection — classification,
  ajout / retrait de tags, suppression.
- **Tags** : renommer (vers un nom existant = **fusion**), changer la catégorie, supprimer.
- **Membres** : ajouter un membre par son ID Discord, changer son rôle, le retirer. Ton
  `OWNER_DISCORD_ID` est toujours `owner`.
- **Données** : réinitialisation (zone de danger).

**Chat `/chat`** (tous les membres), temps réel façon Discord : salons (créés / supprimés par le
propriétaire), messages groupés, historique au scroll, modifier / supprimer ses messages (↑ pour
modifier le dernier), « X est en train d'écrire… », membres en ligne, non-lus par salon, aperçu des
posts cités (`#12` ou lien `/post/12`, flouté en mode safe).
**Pièces jointes** : images, GIF et vidéos jusqu'à **250 Mo** (trombone, glisser-déposer ou Ctrl+V),
envoyées par morceaux dans `data/media/chat/`, avec un aperçu WebP léger (animé) ; supprimées avec
le message, et nettoyées après 24 h si jamais envoyées. Messages en SQLite
(`chat_channels`, `chat_messages`), diffusion en **Server-Sent Events** (`/api/chat/stream`).

Le rôle est relu en base à chaque requête : un ajout / retrait prend effet tout de suite,
sans reconnexion.

### Bot Discord

Si `DISCORD_BOT_TOKEN` est défini, un bot démarre avec le serveur Next
([`src/lib/bot.ts`](src/lib/bot.ts), lancé depuis [`src/instrumentation.ts`](src/instrumentation.ts))
et partage la même base. Réservé aux propriétaires, réponses visibles par toi seul :

| Commande | Effet |
|---|---|
| `/wl add membre:@x [role]` | ajoute (défaut : lecture seule) ou change le rôle ; le membre reçoit un DM avec le lien |
| `/wl remove membre:@x` | retire de la liste blanche |
| `/wl list` | liste les membres |
| clic droit sur un membre → **Apps** → **Whitelister** | ajout rapide en lecture seule |

Mise en place : app Discord → **Bot** → *Reset Token* → `DISCORD_BOT_TOKEN`. Puis
**OAuth2 → URL Generator**, scopes `bot` + `applications.commands`, et ouvre l'URL pour
inviter le bot sur ton serveur. Les commandes sont enregistrées au démarrage (visibles
par défaut pour les membres ayant « Gérer le serveur », et en DM avec le bot).

## Contenu

- **Upload** (`/upload`) : Image / GIF / Vidéo / Doujin.
  - **GIF** : catégorie à part (filtre « GIFs » dans la galerie), miniature animée.
    Un `.gif` déposé dans l'onglet Image est aussi classé en GIF.
  - Images et doujins : **sélection multiple** — les fichiers sont importés à la suite
    avec une barre de progression par fichier. Tags, classification et source communs à tous les fichiers.
  - **Doujin** = un `.zip` / `.cbz` avec les images nommées `1, 2, 3, …`.
    Triées en ordre naturel, ré-numérotées `001…NNN`, **l'image 1 = couverture**.
- **Catégories de tags** (comme Danbooru) : à l'upload et à l'édition, champs dédiés **Parodies** et
  **Personnages** (suggestions limitées à leur catégorie) ; dans le champ Tags, préfixes `artist:nom`,
  `parody:x`, `char:x` (aussi `copyright:`, `character:`, `art:`). Sans préfixe =
  général ; un tag garde ensuite sa catégorie. Sur un post, les tags sont groupés Artiste /
  Parodie / Personnage / Général, avec une couleur par catégorie. La recherche ignore les préfixes.
- **Autocomplétion** dans la barre de recherche (`/api/tags?q=`) : début du tag ou d'un de ses mots,
  couleur de catégorie et nombre de posts ; ↑ ↓ puis Entrée / Tab.
- **Galerie animée** : GIF, WebP et APNG animés ont une miniature animée ; les vidéos se lancent
  (muettes, en boucle) au survol.
- **Galerie** (`/`) : grille responsive, filtres par type, recherche multi-tags, scroll infini.
- **Post** (`/post/[id]`) : sidebar façon Danbooru — précédent / suivant / éditer, tags groupés par
  catégorie, **Informations** (ID, uploader, date, taille + format + dimensions, type, source,
  classification) et **Options** (zoom *taille originale · largeur · hauteur · les deux*, télécharger,
  copier le lien Discord). Raccourcis : `←` / `→` post précédent / suivant, `E` éditer.
- **Classification** (General / Sensitive / Questionable / Explicit) et **source** choisies à l'upload
  et modifiables à l'édition. Recherche : `rating:e` (ou `rating:explicit`, `rating:s`…). Pas de titre.
- **Partage Discord** : bouton « Copier le lien Discord » sur un post → lien public signé
  `/s/<id>-<signature>.<ext>` qui sert directement le fichier, donc Discord affiche l'image /
  le GIF / la vidéo sous le message, sans embed. Le reste du site reste privé ; la signature
  (HMAC avec `AUTH_SECRET`) ne se devine pas. Changer `AUTH_SECRET` révoque tous les liens,
  supprimer un post révoque le sien. Nécessite que `AUTH_URL` soit l'URL publique du site.
- **Embed de l'accueil** : coller l'URL du site sur Discord affiche une carte « lenbooru »
  (titre, description et l'image `public/eden.png`, définis dans `generateMetadata` de
  [`layout.tsx`](src/app/layout.tsx)). Les images à la racine de `public/` sont publiques.
- **Langue** FR / EN : bouton dans le header et sur la page de login (cookie `lang`, sinon langue du
  navigateur). Textes dans [`src/lib/i18n/dict.ts`](src/lib/i18n/dict.ts). Le bot Discord reste en français.
- **Thème** clair / sombre : bouton soleil / lune dans le header (suit le système par défaut).
- **Édition** (`/post/[id]/edit`) : tags, classification, source.
- **Lecture doujin** (`/doujin/[id]/read`) : lecteur vertical webtoon, indicateur de page, saut `#p12`.

## Stockage (tout local)

| Quoi | Où |
|---|---|
| Base de données | `./data/lenbooru.db` (SQLite, WAL) — tables `posts / tags / post_tags / doujin_pages / users` |
| Images + GIFs | `./data/media/image/<id>.<ext>` |
| Vidéos | `./data/media/video/<id>.<ext>` |
| Pages doujin | `./data/media/doujin/<id>/001.jpg …` |
| Miniatures | `./data/media/thumb/<id>.webp` |

Les fichiers sont servis par la route [`/media/[...path]`](src/app/media/[...path]/route.ts)
(type MIME, cache, **HTTP Range** pour le seek vidéo), et donc eux aussi derrière le login.

Sauvegarde = copier le dossier `data/`.

## Notes

- **Upload par morceaux** : chaque fichier part en morceaux de 50 Mo
  ([`uploadLimits.ts`](src/lib/uploadLimits.ts)), écrits directement sur disque dans
  `data/tmp/` puis rassemblés ([`chunks.ts`](src/lib/chunks.ts)). Pas de limite de taille
  pratique pour les vidéos, et ça passe derrière un proxy qui limite la taille des requêtes
  (Cloudflare Tunnel : 100 Mo). Un morceau qui échoue est renvoyé jusqu'à 3 fois ; les
  uploads abandonnés sont nettoyés au bout de 24 h.
- Les **zips de doujin** sont encore lus entièrement en mémoire à l'extraction (limite ~2 Go).
- Aucun HTTPS/déploiement configuré : app pensée pour tourner en local.
