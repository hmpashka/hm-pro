# Onglet Agenda : relier Google Agenda (lecture seule, 3 min)

HM Pro lit ton agenda par son **adresse secrète iCal** : aucun accès à ton compte Google, rien ne peut être modifié.
Les concours de l'onglet Concours s'y ajoutent tout seuls (en orange).

1. Sur un ordinateur : https://calendar.google.com → ⚙️ Paramètres → à gauche, clique sur ton agenda (sous « Paramètres de mes agendas »).
2. Descends jusqu'à **« Adresse secrète au format iCal »** → copie l'adresse (finit par `basic.ics`). Ne la partage avec personne.
3. Sur le VPS (remplace l'adresse ; plusieurs agendas : sépare-les par un espace, avec un nom devant si tu veux) :
   `cd /opt/hm-pro && echo 'AGENDA_ICS=Pro|https://calendar.google.com/calendar/ical/.../basic.ics' >> .env && docker compose up -d`
4. Ouvre https://pro.hmphotographie.fr/agenda

Mise à jour toutes les 5 min (bouton « Actualiser » pour forcer). Si l'adresse fuit un jour : même écran Google → « Réinitialiser », puis remplace la ligne dans `.env`.
Pour créer un rendez-vous : bouton « + Nouveau rendez-vous » (ouvre Google Agenda).
