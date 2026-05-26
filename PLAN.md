# PLAN.md — Feuille de route (5 jours, équipe de 3)

> Détail opérationnel de `CLAUDE.md`. Priorité : **CŒUR de bout en bout avant tout secondaire**.

## Répartition

- **Personne A** — Serveur Realtime (`apps/realtime`) : sync Yjs, signalisation audio.
- **Personne B** — Serveur API (`apps/api`) : auth, comptes, arborescence, suppression.
- **Personne C** — Front (`apps/web`) : écrans auth, arborescence, éditeur.
- Contrat commun : `packages/shared` (modifié en concertation).

## Jalons

### J1 — Fondations
- [x] Monorepo npm workspaces, tsconfig, Docker, `.env.example`.
- [x] `packages/shared` : types du contrat.
- [x] Prisma schema + migration initiale + seed admin.
- [x] API : login / refresh / logout JWT, middleware auth.

### J2 — Arborescence + documents
- [x] API : CRUD documents (dossiers/fichiers), métadonnées (dernier auteur, date).
- [x] API : invitation d'un membre, suppression, autorisation par document.
- [x] Front : login, arborescence avec métadonnées.

### J3 — Édition temps réel (objectif "ça marche de bout en bout")
- [x] Realtime : serveur Yjs over WS, auth JWT à la connexion.
- [x] Realtime : persistance vers l'API (intervalle + fermeture de room).
- [x] Front : éditeur CodeMirror + binding Yjs, sauvegarde auto, reprise après déconnexion.
- [x] Front : indicateur d'état de connexion temps réel.

### J4 — Secondaire (seulement si le cœur tient)
- [ ] Administration : création de compte, blocage / déblocage (API + écran).
- [ ] 2FA (TOTP).
- [ ] Stockage de fichiers non textuels.
- [ ] Audio WebRTC (isolé — coupé si non terminé en fin de J4).

### J5 — Finition
- [ ] Tests unitaires critiques (auth, autorisation, persistance Yjs).
- [ ] README + parcours nominal documenté.
- [ ] Nettoyage, `lint + build` qui passent, préparation du ZIP de rendu.

## État actuel

Le **CŒUR** est implémenté de bout en bout (J1→J3). L'**administration** (création/blocage de comptes) est livrée comme premier élément du secondaire. 2FA, fichiers non textuels et audio WebRTC restent à faire (J4), isolés du chemin critique.
