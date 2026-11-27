#!/usr/bin/env bash
# Sauvegarde nocturne de HM Pro : base PostgreSQL + fichier .env, chiffrés avec age (clé publique seulement sur
# le serveur : même avec le serveur volé, la sauvegarde reste illisible), puis envoyés sur ton Telegram (hors
# serveur). 14 copies gardées aussi sur le VPS. Lancé par cron chaque nuit (voir SAUVEGARDES.md).
# Réglages dans .env : SAUVEGARDE_AGE_CLE (age1...), SAUVEGARDE_TELEGRAM_TOKEN, SAUVEGARDE_TELEGRAM_CHAT.
set -euo pipefail
cd "$(dirname "$0")/.."
DOSSIER=${SAUVEGARDE_DOSSIER:-/var/backups/hm-pro}
API=${TELEGRAM_API:-https://api.telegram.org}
lire() { grep -E "^$1=" .env | tail -1 | cut -d= -f2-; }
CLE=$(lire SAUVEGARDE_AGE_CLE); TOKEN=$(lire SAUVEGARDE_TELEGRAM_TOKEN); CHAT=$(lire SAUVEGARDE_TELEGRAM_CHAT)
[[ $CLE == age1* ]] || { echo "SAUVEGARDE_AGE_CLE manquante ou invalide dans .env" >&2; exit 1; }

telegram() {  # message texte, sans jamais faire échouer la sauvegarde
  [[ -n $TOKEN && -n $CHAT ]] && curl -fsS -m 30 "$API/bot$TOKEN/sendMessage" --data-urlencode "chat_id=$CHAT" --data-urlencode "text=$1" >/dev/null || true
}
trap 'telegram "❌ Sauvegarde HM Pro ÉCHOUÉE ($(hostname), $(date "+%d/%m %H:%M")). Voir /var/log/hm-pro-sauvegarde.log"' ERR

mkdir -p "$DOSSIER" && chmod 700 "$DOSSIER"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
NOM="hm-pro-$(date +%Y-%m-%d_%H%M).tar.age"

docker compose exec -T db pg_dump -U hmpro -d hmpro -Fc > "$TMP/base.dump"
[[ -s $TMP/base.dump ]] || { echo "dump vide" >&2; false; }
cp .env "$TMP/env"
tar -C "$TMP" -cf - base.dump env | age -r "$CLE" -o "$DOSSIER/$NOM"
chmod 600 "$DOSSIER/$NOM"
ls -1t "$DOSSIER"/hm-pro-*.tar.age | tail -n +15 | xargs -r rm -f

TAILLE=$(du -h "$DOSSIER/$NOM" | cut -f1)
if [[ -n $TOKEN && -n $CHAT ]]; then
  curl -fsS -m 300 "$API/bot$TOKEN/sendDocument" -F "chat_id=$CHAT" -F "document=@$DOSSIER/$NOM" \
       --form-string "caption=✅ Sauvegarde HM Pro du $(date '+%d/%m/%Y %H:%M') ($TAILLE, chiffrée)" >/dev/null
fi
echo "OK $NOM $TAILLE"
