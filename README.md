# CollabDocs — édition collaborative de documents en temps réel

Application web où une équipe stocke des documents dans une arborescence, les édite
à plusieurs **simultanément en temps réel** (avec sauvegarde automatique et reprise
sans perte après déconnexion), invite d'autres personnes, et peut ouvrir un appel audio
pendant l'édition.

---

## Prérequis

- **Node ≥ 20** et npm
- **Docker** (pour PostgreSQL)

## Lancement — tout en Docker

```bash
cp .env.example .env
docker compose up        # Postgres + API (migre + seed automatiquement) + Realtime
npm run dev:web          # le front reste lancé en local en dev
```

---

## Variables d'environnement

Voir [`.env.example`](./.env.example) (commenté). Le fichier `.env` **n'est jamais commité**.

---

## Périmètre livré

connexion/déconnexion · arborescence +
métadonnées · édition temps réel + sauvegarde auto · reprise sans perte après
déconnexion · invitation d'une personne · suppression.

administration (création/blocage de comptes — **fait**) · 2FA TOTP
(**fait**) · modification de profil (**fait**) · stockage/remplacement de fichiers non
textuels PDF/image (**fait** : upload `multer`, limites taille + type MIME, stockage hors
racine web, nom régénéré) · appel audio WebRTC 1-à-1 (**fait**, isolé).

(évolutions) : plusieurs invités dans un appel · curseurs distants affichés
en continu · messagerie instantanée.
