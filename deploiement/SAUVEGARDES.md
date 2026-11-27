# Sauvegardes chiffrées de HM Pro

Chaque nuit à 3 h 30 : base PostgreSQL + fichier `.env` → archive chiffrée avec **age** → envoyée sur ton Telegram
(hors serveur) + 14 copies gardées dans `/var/backups/hm-pro`. En cas d'échec, un message ❌ arrive sur Telegram.

Le serveur n'a que la **clé publique** : même si quelqu'un vole le VPS ou ton Telegram, les sauvegardes sont
illisibles sans la **clé privée**, qui n'existe que dans ton gestionnaire de mots de passe.

## Mise en place (une fois, ~5 min, sur le VPS en root)

1. `cd /opt/hm-pro && git pull && apt install -y age`
2. Créer la paire de clés :
   `age-keygen -o /root/cle-sauvegarde.txt && cat /root/cle-sauvegarde.txt`
   Copie **les 3 lignes** dans ton gestionnaire de mots de passe (note « HM Pro – clé sauvegardes »).
   Sans elle, aucune restauration possible.
3. Mettre la clé publique dans `.env`, puis effacer la clé privée du serveur :
   `echo "SAUVEGARDE_AGE_CLE=$(grep -o 'age1.*' /root/cle-sauvegarde.txt)" >> .env && shred -u /root/cle-sauvegarde.txt`
4. Token du bot Telegram (le même que dans n8n : Telegram → @BotFather → /mybots → ton bot → API Token) :
   `echo "SAUVEGARDE_TELEGRAM_TOKEN=COLLE_LE_TOKEN" >> .env && echo "SAUVEGARDE_TELEGRAM_CHAT=7793561285" >> .env`
5. Essai : `bash deploiement/sauvegarde.sh` → « OK hm-pro-….tar.age » et le fichier arrive sur Telegram.
6. Tous les soirs :
   `echo '30 3 * * * root /opt/hm-pro/deploiement/sauvegarde.sh >> /var/log/hm-pro-sauvegarde.log 2>&1' > /etc/cron.d/hm-pro-sauvegarde`

## Restaurer

1. Récupère le fichier `.tar.age` (Telegram ou `/var/backups/hm-pro`) et mets-le sur le VPS.
2. Colle ta clé privée dans un fichier : `nano /root/cle.txt`
3. `cd /opt/hm-pro && bash deploiement/restaurer.sh /chemin/hm-pro-….tar.age /root/cle.txt && shred -u /root/cle.txt`
   (sur un serveur neuf : installer HM Pro d'abord, puis `cp env-restaure .env` avant de relancer).
