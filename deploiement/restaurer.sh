#!/usr/bin/env bash
# Restaure une sauvegarde de HM Pro.  Usage : deploiement/restaurer.sh hm-pro-AAAA-MM-JJ_HHMM.tar.age cle-privee.txt
#   cle-privee.txt = la clé privée age (AGE-SECRET-KEY-1...) gardée dans ton gestionnaire de mots de passe.
# Remplace TOUTE la base actuelle par celle de la sauvegarde. Le .env de la sauvegarde est mis à côté
# (env-restaure) : à remettre à la place de .env seulement sur un serveur neuf.
set -euo pipefail
cd "$(dirname "$0")/.."
[[ $# -eq 2 ]] || { echo "Usage : $0 fichier.tar.age cle-privee.txt" >&2; exit 1; }
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
age -d -i "$2" -o "$TMP/s.tar" "$1"
tar -C "$TMP" -xf "$TMP/s.tar"
cp "$TMP/env" env-restaure && chmod 600 env-restaure
if [[ -z ${OUI:-} ]]; then read -r -p "Remplacer toute la base HM Pro par cette sauvegarde ? (oui/non) " r; [[ $r == oui ]] || exit 1; fi
docker compose stop app
docker compose exec -T db pg_restore -U hmpro -d hmpro --clean --if-exists --no-owner < "$TMP/base.dump"
docker compose start app
echo "Restauration terminée. Réglages de la sauvegarde : env-restaure"
