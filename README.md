# HM Pro — tableau de bord pro

Application privée (pro.hmphotographie.fr) : licences des logiciels HM, puis projets, concours/CA, agenda, factures,
relations. Next.js 16 + PostgreSQL 17 + Better Auth (mot de passe + double authentification obligatoire).

## Sécurité en bref
- Pas d'inscription : premier compte par `npm run creer-admin`, les suivants dans Réglages.
- 2FA (appli d'authentification) obligatoire, 10 codes de secours, 5 essais par quart d'heure puis blocage.
- Droits par onglet : aucun / lecture / écriture, vérifiés côté serveur. Compte désactivable.
- Journal d'audit (connexions, échecs, chaque action) dans Réglages.
- Champs sensibles chiffrés (AES-256-GCM, clé `CHIFFREMENT_CLE` hors base). Base sur un réseau Docker sans Internet.
- live.hmphotographie.fr est piloté par requêtes signées HMAC (`src/lib/live.ts`, `module-service.php` côté site).
- n8n n'a accès qu'à `/api/interne/...` avec son jeton, en lecture.

## Développement
    npm install
    cp .env.exemple .env      # remplir ; DATABASE_URL=postgres://...
    npm run db:migrer && npm run creer-admin -- toi@domaine.fr "Prénom Nom"
    npm run dev

Tests : `DATABASE_URL_TEST=postgres://... LIVE_SITE_SOURCE=<sporttiming>/serveur/relais npm test`
(sans ces variables, les essais avec base et avec le site PHP sont sautés).

Mise en ligne : voir `deploiement/GUIDE.md`.
