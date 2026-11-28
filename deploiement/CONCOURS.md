# Onglet Concours & CA

- Créer un concours (nom, lieu, dates, objectif facultatif), puis saisir les ventes sur place depuis le téléphone :
  montant, puis **Espèces**, **CB** ou **En ligne**. Un total de fin de journée peut être saisi en une fois ;
  un montant négatif = remboursement. Chaque suppression est notée dans le journal.
- Stats : CA de l'année par moyen de paiement, par mois, moyenne par concours, meilleur concours ; archives par année.

## Mise à jour du VPS
`cd /opt/hm-pro && git pull && docker compose up -d --build` (la base se met à jour toute seule au démarrage).

## Plus tard : ventes en ligne automatiques (n8n)
`POST https://pro.hmphotographie.fr/api/interne/concours/ventes`, en-tête `Authorization: Bearer N8N_JETON`, corps JSON :
`{"date": "2026-09-19", "montant": "19,90", "ref": "id-commande-galerie", "libelle": "Photo HD"}`
(`concours: <id>` à la place de `date` si deux concours ont lieu le même jour). Une même `ref` n'est jamais comptée deux fois.
