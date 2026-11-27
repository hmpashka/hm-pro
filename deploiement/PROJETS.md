# Onglet Projets : jeton GitHub en lecture seule

HM Pro lit tes dépôts (derniers commits, PR et tickets ouverts) avec un jeton qui ne peut **rien modifier**.
Statut, priorité, prochaine étape et note sont gardés dans HM Pro (prochaine étape et note chiffrées).

1. Ouvre https://github.com/settings/personal-access-tokens/new
2. Token name : `HM Pro lecture` · Expiration : 1 an (GitHub t'enverra un mail avant la fin)
3. Repository access : **All repositories**
4. Permissions → Repositories, mets en **Read-only** : `Contents`, `Issues`, `Pull requests` (`Metadata` se coche tout seul). Rien d'autre.
5. **Generate token**, copie-le (commence par `github_pat_`).
6. Sur le VPS :
   `cd /opt/hm-pro && git pull && echo "GITHUB_JETON=COLLE_LE_JETON" >> .env && docker compose up -d --build`
7. Ouvre https://pro.hmphotographie.fr/projets
