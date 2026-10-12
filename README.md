# lenbooru

Image board perso (images, GIFs, vidéos, doujins), style Danbooru, accès privé via Discord.
Next.js + SQLite, tout stocké en local.

## Lancer

1. App Discord sur https://discord.com/developers/applications → **OAuth2 → Redirects** :
   `http://localhost:3000/api/auth/callback/discord`
2. `cp .env.example .env.local` et remplir (Client ID/Secret, `AUTH_SECRET`, ton ID Discord).
3. `npm install && npm run dev` → http://localhost:3000

Mise en ligne : voir [DEPLOY.md](DEPLOY.md).

## Accès

Login Discord obligatoire, liste blanche gérée dans `/admin` ou via le bot (`/wl add`).
Rôles : `viewer` (voir) < `editor` (éditer) < `uploader` (upload/supprimer) < `owner` (admin).

## Fonctionnalités

Recherche multi-tags, upload par morceaux, lecteur doujin, chat temps réel,
liens de partage Discord, panneau admin, FR/EN, thème clair/sombre.

## Données

Tout est dans `data/` (base SQLite + médias) : sauvegarder ce dossier suffit.
