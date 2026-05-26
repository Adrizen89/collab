# CLAUDE.md — Application collaborative d'édition de documents

> Contrat de référence du projet. Lu à chaque session.
> Projet d'école, équipe de 3, délai **5 jours**. Priorité absolue : un cœur fonctionnel de bout en bout, pas l'exhaustivité.

---

## 1. Contexte métier

Application web collaborative de construction de documents en temps réel, type base documentaire wiki. Une équipe stocke des documents dans un espace, les édite en ligne à plusieurs simultanément, et peut ouvrir un appel audio pendant l'édition.

### Personas
- **Membre** : utilisateur authentifié. Crée, lit, édite, supprime des documents, invite une autre personne à éditer, démarre un appel audio. Usage desktop, navigateur récent.
- **Administrateur** : membre avec droits en plus. Ajoute des comptes, bloque/débloque des comptes.
- **Visiteur non connecté** : voit uniquement le formulaire de connexion.

### Parcours nominal
1. L'utilisateur se connecte.
2. Il voit l'arborescence dossiers/fichiers avec, pour chaque fichier, sa date de dernière modification et la dernière personne l'ayant modifié.
3. Il ouvre un document texte et l'édite ; les modifications sont synchronisées en temps réel et sauvegardées automatiquement sur le serveur.
4. Il invite une autre personne sur le document et démarre éventuellement un appel audio avec elle.
5. En cas de déconnexion en pleine édition, ses modifications ne sont pas perdues à la reconnexion.

### Périmètre

**CŒUR — à livrer absolument (J1→J3) :**
- Connexion / déconnexion
- Arborescence dossiers/fichiers + métadonnées (date dernière modif, dernier auteur)
- Édition textuelle temps réel avec sauvegarde auto serveur
- Reprise sans perte après déconnexion en pleine édition
- Inviter UNE personne sur un document
- Supprimer un document

**SECONDAIRE — si le cœur tient (J4) :**
- Authentification à deux facteurs (2FA)
- Modification du profil
- Stockage / remplacement de fichiers non textuels (PDF, image…)
- Administration : ajout de compte, blocage / déblocage
- Appel audio (WebRTC) — **isolé : si non terminé J4, on coupe sans toucher au reste**

**HORS SCOPE (bonus PDF, non traités, juste mentionnés comme évolutions) :**
- Plusieurs invités simultanés dans un appel
- Affichage du curseur des autres en direct
- Messagerie instantanée pendant l'édition

> Règle d'or : mieux vaut le CŒUR complet et propre que le SECONDAIRE bâclé. Le barème pénalise les failles de sécurité manifestes et récompense le travail qualitatif sur un périmètre maîtrisé.

---

## 2. Stack technique

| Couche | Technologie | Raison du choix |
|--------|-------------|-----------------|
| Langage | **TypeScript** (serveur ET front) | Contrainte sujet (JS/TS) ; le typage aide l'équipe mixte à éviter les erreurs bêtes. |
| Serveur API | **Node + Express** | Le plus documenté ; courbe d'apprentissage douce pour les 2 qui montent. NestJS écarté (trop lourd en 5 j). |
| Serveur temps réel | **Node + WebSocket (`ws`) + y-websocket** | Sépare le live du CRUD ; héberge aussi la signalisation WebRTC. |
| Synchro collaborative | **Yjs** (CRDT) | Résout la fusion des éditions simultanées sans perte, et gère nativement la reprise hors-ligne → couvre l'exigence "déconnexion en pleine édition". On construit notre app autour, on ne réutilise pas une solution clé en main interdite. |
| Éditeur texte | **CodeMirror 6** + binding `y-codemirror.next` | Binding Yjs éprouvé, léger. |
| Audio | **WebRTC natif**, signalisation via le serveur WS | Pas de lib lourde ; réutilise le canal temps réel existant. |
| Front | **React + Vite** | Démarrage rapide, écosystème connu. |
| Base de données | **PostgreSQL** | Robuste, relations claires (users/documents). |
| Accès DB | **Prisma** | Schéma typé = source de vérité unique du modèle. |
| Conteneurisation | **Docker + docker-compose** | Autorisé par le sujet ; reproductible pour les 3 postes et les 2 serveurs. |
| Auth | **JWT** (access + refresh) + bcrypt pour les mots de passe | Standard, simple à raisonner. |

---

## 3. Architecture deux serveurs (contrainte sujet)

Choix : **application divisée en deux aspects** (et non réplication).

- **Serveur API** (`apps/api`) : REST. Auth, comptes, arborescence documentaire, métadonnées, stockage fichiers, suppression. Parle à PostgreSQL.
- **Serveur Realtime** (`apps/realtime`) : WebSocket. Synchro Yjs des documents texte + signalisation des appels audio. Persiste l'état Yjs vers l'API/DB à intervalle régulier et à la fermeture de room.

Communication :
- Client ↔ API : HTTP/REST (JSON), token JWT en header.
- Client ↔ Realtime : WebSocket, token JWT validé à la connexion WS.
- Realtime → API : appel HTTP interne authentifié par un secret partagé, pour persister les documents.

> Cette séparation isole le risque : si le temps réel ou l'audio échoue, l'API et le reste de l'app continuent de fonctionner. À justifier tel quel dans le document de rendu.

---

## 4. Structure du projet (cible)

```
/
├── CLAUDE.md
├── PLAN.md
├── README.md
├── docker-compose.yml
├── .env.example
├── package.json            # workspace racine
├── packages/
│   └── shared/             # types TS partagés (User, Document…) — contrat commun
├── apps/
│   ├── api/                # serveur REST (Personne B + C)
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   ├── middleware/
│   │   │   └── index.ts
│   │   └── prisma/schema.prisma   # SOURCE DE VÉRITÉ du modèle de données
│   ├── realtime/           # serveur WebSocket + Yjs + signalisation audio (Personne A)
│   │   └── src/index.ts
│   └── web/                # front React + Vite (les 3, chacun sur ses écrans)
│       └── src/
│           ├── features/auth/
│           ├── features/documents/
│           ├── features/editor/
│           └── features/call/
```

> Règle anti-collision : **un domaine = un dossier = un responsable**. On touche rarement aux fichiers des autres.

---

## 5. Modèle de données

Source de vérité : `apps/api/prisma/schema.prisma`.

- **User** : `id`, `email` (unique), `passwordHash`, `displayName`, `role` (`MEMBER` | `ADMIN`), `isBlocked` (bool), `twoFactorSecret` (nullable), `createdAt`.
- **Document** : `id`, `name`, `type` (`TEXT` | `FILE`), `parentId` (nullable → arborescence auto-référencée), `content` (texte ; pour TEXT, état Yjs sérialisé), `fileUrl` (nullable ; pour FILE), `lastModifiedAt`, `lastModifiedById` (→ User).
- **DocumentInvite** : `id`, `documentId` (→ Document), `userId` (→ User invité), `createdAt`. Unique (`documentId`, `userId`).

Relations : un dossier est un `Document` de type implicite parent (`parentId`) ; un `Document` a un dernier modificateur ; les invitations lient documents et utilisateurs.

---

## 6. Règles métier

| Action | MEMBER | ADMIN | Non connecté |
|--------|:------:|:-----:|:------------:|
| Voir le formulaire de connexion | ✓ | ✓ | ✓ |
| Se connecter | ✓ | ✓ | ✓ |
| Voir / éditer un document dont il est propriétaire ou invité | ✓ | ✓ | ✗ |
| Inviter une personne sur un document | ✓ | ✓ | ✗ |
| Supprimer un document | ✓ (le sien) | ✓ | ✗ |
| Créer un compte | ✗ | ✓ | ✗ |
| Bloquer / débloquer un compte | ✗ | ✓ | ✗ |

Invariants :
- Un compte `isBlocked = true` ne peut pas se connecter (vérifié à l'authentification).
- `lastModifiedAt` et `lastModifiedById` sont mis à jour à chaque sauvegarde serveur d'un document.
- Pas d'inscription publique : seul un ADMIN crée des comptes (le sujet ne demande pas d'auto-inscription).

---

## 7. Conventions de code

- **TypeScript strict** (`strict: true`). **Jamais de `any`** : si un type manque, le définir dans `packages/shared`.
- Pas de `console.log` laissé en production : utiliser un logger simple ou retirer avant merge.
- Nommage : fichiers en `kebab-case`, composants React en `PascalCase`, fonctions/variables en `camelCase`.
- Une fonction = une responsabilité. Un composant React = max ~200 lignes, sinon découper.
- Gestion d'erreur API : toujours renvoyer `{ error: string }` avec le bon code HTTP (400/401/403/404/500), jamais une stack trace au client.
- Async : `async/await` partout, jamais de `.then()` chaîné. Toujours `try/catch` autour des appels DB et réseau.
- Les types partagés entre serveurs et front vivent **uniquement** dans `packages/shared` (zéro duplication).

---

## 8. Conventions UI

- Desktop-first (cible navigateur récent), mais layout qui ne casse pas en dessous de 1024px.
- Bibliothèque de composants légère pour aller vite (au choix de l'équipe, ex. une lib de composants headless + styles simples). L'ergonomie doit être "minimale mais soignée" (exigence sujet).
- Formulaires : validation côté client ET serveur ; messages d'erreur lisibles ; état de chargement visible sur chaque action réseau.
- Indiquer clairement l'état de connexion temps réel (connecté / reconnexion en cours) pour rassurer pendant l'édition.

---

## 9. Sécurité (le barème pénalise les failles manifestes)

- Mots de passe : **bcrypt** (jamais en clair, jamais loggés).
- JWT : access token court, refresh token ; secret en variable d'environnement, jamais commité.
- **Valider et typer toutes les entrées** côté serveur (corps de requête, params) — ne jamais faire confiance au client.
- Le serveur Realtime **valide le JWT** à l'ouverture de la connexion WebSocket : pas de room sans auth.
- Autorisation vérifiée côté serveur sur chaque action (être invité ≠ être propriétaire) : ne jamais se reposer sur le masquage UI.
- Upload de fichiers (si fait) : limiter taille et types MIME ; stocker hors de la racine web ; nom de fichier régénéré.
- Aucune donnée sensible dans les URL. Cookies/headers pour les tokens.
- `.env` jamais commité ; fournir `.env.example` (exigence de rendu).

---

## 10. Tests

5 jours = pas de couverture exhaustive. Priorité au **test manuel du parcours nominal** documenté dans le README + quelques tests unitaires sur le critique :
- Auth : hash/vérif mot de passe, refus d'un compte bloqué.
- Autorisation : un non-invité ne peut pas ouvrir un document.
- Persistance Yjs : un document édité puis "rechargé" conserve son contenu.

Pas de CI lourde imposée ; si le temps le permet, un simple `lint + build` qui passe.

---

## 11. Commandes utiles

| Commande | Effet |
|----------|-------|
| `docker compose up` | Lance Postgres + serveur API + serveur Realtime |
| `npm run dev` (dans `apps/web`) | Lance le front Vite |
| `npm run db:migrate` | Applique les migrations Prisma |
| `npm run db:studio` | Ouvre Prisma Studio (inspection DB) |
| `npm run lint` | Vérifie le style |
| `npm run build` | Build de production |

> À ajuster selon ce qui est réellement mis en place. Le README doit refléter ces commandes (exigence de rendu).

---

## 12. Points d'attention spécifiques

- **L'audio est le risque qui peut tout faire dériver.** Une seule personne dessus, en parallèle, déconnecté du chemin critique. Deadline interne stricte : si ça ne marche pas à la fin de J4, on coupe.
- **J3 = "ça marche de bout en bout" obligatoire.** Avant J3 on ne se disperse pas dans le secondaire.
- **Mergez sur `main` à chaque fin de lot**, jamais 3 jours sans merger : sinon recollage douloureux à 3.
- **Le `packages/shared` est le contrat commun.** Quand on change un type partagé, on prévient l'équipe.
- **Attention à la taille du rendu** : le sujet prévient qu'un ZIP trop volumineux peut être refusé. Exclure `node_modules`, gros fichiers de test, etc.
- **Sauvegarde Yjs** : persister régulièrement ET à la fermeture de la room, sinon perte de données — c'est exactement ce que le sujet veut éviter.