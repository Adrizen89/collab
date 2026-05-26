# CollabDocs — édition collaborative de documents en temps réel

Application web où une équipe stocke des documents dans une arborescence, les édite
à plusieurs **simultanément en temps réel** (avec sauvegarde automatique et reprise
sans perte après déconnexion), invite d'autres personnes, et peut ouvrir un appel audio
pendant l'édition.

> Projet d'école — voir [`CLAUDE.md`](./CLAUDE.md) pour le cahier des charges et
> [`PLAN.md`](./PLAN.md) pour la feuille de route.

---

## Architecture

Deux serveurs séparés (contrainte du sujet : « application divisée en deux aspects ») :

```
┌──────────────┐     REST / JWT        ┌─────────────────┐
│              │ ────────────────────▶ │  API (Express)  │ ───▶ PostgreSQL
│  Front React │                       │   apps/api      │ ◀──┐
│  apps/web    │     WebSocket / JWT   ├─────────────────┤    │ persistance
│              │ ────────────────────▶ │ Realtime (ws +  │ ───┘  interne
└──────────────┘     (Yjs + WebRTC)    │ Yjs) apps/realtime│   (secret partagé)
                                       └─────────────────┘
```

- **API** (`apps/api`) — REST : authentification, comptes, arborescence documentaire,
  métadonnées, invitations, suppression, route interne de persistance.
- **Realtime** (`apps/realtime`) — WebSocket : synchronisation **Yjs** (CRDT) des documents
  texte + signalisation **WebRTC** des appels audio. Persiste l'état vers l'API à intervalle
  régulier et à la fermeture de chaque room.
- **Front** (`apps/web`) — React + Vite + CodeMirror 6.
- **`packages/shared`** — types TypeScript partagés (contrat commun, zéro duplication).

Cette séparation **isole le risque** : si le temps réel ou l'audio échoue, l'API et le
reste de l'application continuent de fonctionner.

## Stack

TypeScript partout · Node + Express · WebSocket (`ws`) + Yjs + y-protocols · CodeMirror 6 +
`y-codemirror.next` · WebRTC natif · React + Vite · PostgreSQL + Prisma · JWT + bcrypt ·
Docker Compose.

---

## Prérequis

- **Node ≥ 20** et npm
- **Docker** (pour PostgreSQL ; ou un PostgreSQL local)

## Installation

```bash
# 1. Dépendances (monorepo npm workspaces)
npm install

# 2. Variables d'environnement
cp .env.example .env      # adapter si besoin

# 3. Compiler le paquet de types partagé (requis par l'API et le Realtime)
npm run build:shared
```

## Lancement — mode développement (recommandé)

```bash
# 1. Base de données
docker compose up -d postgres

# 2. Migrations + administrateur initial
npm run db:migrate        # crée les tables
npm run db:seed           # crée l'admin (cf. SEED_ADMIN_* dans .env)

# 3. Démarrer les trois services (dans des terminaux séparés, ou via le script global)
npm run dev:api           # http://localhost:4000
npm run dev:realtime      # ws://localhost:4001
npm run dev:web           # http://localhost:5173

# …ou tout en un (build du shared + 3 services en parallèle) :
npm run dev
```

Ouvrir **http://localhost:5173** et se connecter avec le compte admin du seed
(`admin@collab.local` / `Admin1234!` par défaut — **à changer**).

## Lancement — tout en Docker

```bash
cp .env.example .env
docker compose up        # Postgres + API (migre + seed automatiquement) + Realtime
npm run dev:web          # le front reste lancé en local en dev
```

---

## Commandes utiles

| Commande | Effet |
|----------|-------|
| `npm run dev` | Build du shared + API + Realtime + front en parallèle |
| `docker compose up` | Postgres + serveur API + serveur Realtime |
| `npm run dev:web` | Front Vite seul |
| `npm run db:migrate` | Applique les migrations Prisma |
| `npm run db:seed` | Crée l'administrateur initial |
| `npm run db:studio` | Ouvre Prisma Studio (inspection DB) |
| `npm run lint` | Vérifie les types (tsc) des trois apps |
| `npm run build` | Build de production de tout le monorepo |

## Variables d'environnement

Voir [`.env.example`](./.env.example) (commenté). Les secrets (`JWT_*`,
`INTERNAL_API_SECRET`) doivent être longs et aléatoires en production
(`openssl rand -hex 32`). Le fichier `.env` **n'est jamais commité**.

---

## Parcours nominal (test manuel)

1. **Connexion** avec le compte admin.
2. Créer un **dossier** puis un **document texte** dedans — il apparaît dans
   l'arborescence avec sa date de dernière modification et son dernier auteur.
3. Ouvrir le document : l'**éditeur** s'affiche, l'indicateur en haut à droite passe à
   *Synchronisé*.
4. Ouvrir **le même document dans un second navigateur** (ou via un compte invité) :
   les frappes se synchronisent **en temps réel** dans les deux sens.
5. **Inviter** une personne (panneau de droite) depuis son email : le document apparaît
   dans son arborescence (badge *partagé*).
6. **Couper le réseau** en pleine édition (onglet hors-ligne) : l'indicateur passe à
   *Hors ligne*, l'édition reste possible (persistance locale IndexedDB) ; au retour en
   ligne, tout se resynchronise **sans perte**.
7. (Optionnel) **Démarrer un appel audio** depuis le panneau dédié.
8. **Administration** (admin uniquement) : créer un compte, bloquer / débloquer.

## Tests automatisés ciblés

Le parcours critique a été validé de bout en bout (auth + JWT/cookie, arborescence,
autorisation par document, **synchro Yjs temps réel et persistance relue depuis la
base**, blocage de compte). Voir la section *Sécurité* ci-dessous.

---

## Sécurité

- Mots de passe hachés avec **bcrypt** (jamais en clair, jamais loggés).
- **JWT** : access token court (15 min, en mémoire côté front) + refresh token dans un
  **cookie httpOnly** (anti-XSS), persisté et **révocable** (rotation à chaque refresh,
  révocation au logout et au blocage de compte).
- Toutes les entrées serveur sont **validées et typées** (Zod).
- Le serveur Realtime **valide le JWT** à l'ouverture de la connexion WebSocket et
  **vérifie l'accès au document** auprès de l'API (pas de room sans autorisation).
- Autorisation vérifiée **côté serveur** sur chaque action (propriétaire ≠ invité ≠ admin) —
  jamais de confiance au masquage UI.
- En-têtes durcis (`helmet`), CORS restreint à l'origine du front.

**Limitation connue assumée** : le client `y-websocket` officiel transmet le token
d'authentification en *query string* du WebSocket. Le token étant à durée de vie courte
et la prod devant utiliser `wss://`, le risque est limité ; le serveur accepte aussi le
token via sous-protocole WS (sans le mettre dans l'URL).

---

## Périmètre livré

**Cœur (complet, testé de bout en bout)** : connexion/déconnexion · arborescence +
métadonnées · édition temps réel + sauvegarde auto · reprise sans perte après
déconnexion · invitation d'une personne · suppression.

**Secondaire** : administration (création/blocage de comptes — **fait**) · 2FA TOTP
(**fait**) · modification de profil (**fait**) · appel audio WebRTC 1-à-1 (**fait**, isolé).

**Hors scope** (évolutions) : plusieurs invités dans un appel · curseurs distants affichés
en continu · messagerie instantanée · stockage de fichiers non textuels (le modèle le
prévoit — type `FILE` — mais l'upload n'est pas implémenté).

## Structure

```
packages/shared/   # types TS partagés (contrat)
apps/api/          # serveur REST (Express + Prisma)
apps/realtime/     # serveur WebSocket (Yjs + signalisation WebRTC)
apps/web/          # front React + Vite + CodeMirror
```
