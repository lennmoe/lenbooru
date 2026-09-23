# Déployer lenbooru sur un VPS (sans domaine)

lenbooru écrit sur disque (SQLite + fichiers médias), donc il lui faut un vrai
serveur avec un disque persistant (pas d'hébergement serverless). Ici : ton VPS, avec Node +
pm2, accès par l'IP.

---

## 0. Choisir l'URL d'accès

Tu n'as pas de domaine. Deux options :

| Option | `AUTH_URL` | Redirect URI Discord |
|---|---|---|
| **IP brute** | `http://123.45.67.89:3000` | `http://123.45.67.89:3000/api/auth/callback/discord` |
| **nip.io** (recommandé) | `http://123-45-67-89.nip.io:3000` | `http://123-45-67-89.nip.io:3000/api/auth/callback/discord` |

`nip.io` est un service DNS gratuit : `123-45-67-89.nip.io` résout tout seul vers
`123.45.67.89`. Aucun compte, rien à configurer. Avantage : c'est un vrai nom
d'hôte, donc si un jour tu veux du HTTPS (Caddy/Let's Encrypt) ça marche direct,
et Discord l'accepte sans discuter.

Remplace `123.45.67.89` par l'IP publique de ton VPS. Si tu sers sur le port 80
(voir étape 4), enlève `:3000` partout.

---

## 1. Discord — Redirect URI

https://discord.com/developers/applications → ton app → **OAuth2** → **Redirects**
→ **Add Redirect** → colle l'URI de redirection choisie à l'étape 0 →
**Save Changes**.

---

## 2. Installer Node sur le VPS

Debian / Ubuntu (Node 22 LTS + outils de compilation pour `better-sqlite3`) :

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs build-essential python3
sudo npm install -g pm2
```

---

## 3. Récupérer le projet + config

```bash
git clone <ton-repo> lenbooru      # ou scp/rsync le dossier
cd lenbooru
```

Crée `.env.local` à la racine du projet :

```ini
AUTH_DISCORD_ID=xxxxxxxxxxxxxxxxxx
AUTH_DISCORD_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AUTH_SECRET=<npx auth secret, ou: openssl rand -base64 32>
OWNER_DISCORD_ID=435068712786198538
AUTH_URL=http://123-45-67-89.nip.io:3000
DISCORD_BOT_TOKEN=xxxxxxxx          # optionnel : bot de liste blanche
DISCORD_INVITE_URL=https://discord.gg/xxxx   # optionnel
```

> `AUTH_URL` doit être **identique au caractère près** à la Redirect URI Discord.
> En `http://` Auth.js désactive automatiquement les cookies « secure », donc le
> login fonctionne sans HTTPS.

---

## 4. (Option) servir sur le port 80

Lance avec `PORT=80` (étape 5, nécessite root ou `setcap` sur node), ou mets un
reverse proxy (Caddy / nginx) devant le port 3000. Retire `:3000` de `AUTH_URL`
**et** de la Redirect URI Discord.

---

## 5. Lancer

```bash
npm ci
npm run build
PORT=3000 pm2 start npm --name lenbooru -- start
pm2 save && pm2 startup     # relance auto au reboot
```

Ouvre le pare-feu pour le port choisi :

```bash
sudo ufw allow 3000/tcp      # ou 80/tcp
```

…et pense au *security group* / firewall côté hébergeur (Hetzner Cloud, OVH, etc.).

Va sur `http://123-45-67-89.nip.io:3000` → **Se connecter avec Discord**. Ton
compte (`OWNER_DISCORD_ID`) est propriétaire d'office → tu peux ajouter les autres
membres dans **/members** ou avec le bot (`/wl add`).

---

## Exploitation

| Action | Commande |
|---|---|
| Logs | `pm2 logs lenbooru` |
| Redémarrer | `pm2 restart lenbooru` |
| Mettre à jour | `git pull && npm ci && npm run build && pm2 restart lenbooru` |
| Arrêter | `pm2 stop lenbooru` |
| **Sauvegarde** | archiver le dossier `./data/` (DB + médias) — c'est tout |

Restaurer = remettre `./data/` en place puis `pm2 restart lenbooru`.

---

## Sécurité — à savoir

- **HTTP en clair** : le cookie de session et le retour OAuth Discord transitent
  sans chiffrement. Acceptable pour un usage perso, mais quelqu'un sur le réseau
  peut sniffer. Pour durcir : mets **Caddy** devant (HTTPS auto avec le nom
  `nip.io`), ou restreins l'accès via **Tailscale** / un firewall par IP.
- Le site entier (galerie + médias + API) est derrière le login Discord ; seuls
  les ID sur la liste blanche entrent, les autres tombent sur `/denied`.
- Fais tourner l'app sous un utilisateur dédié plutôt que `root`.
