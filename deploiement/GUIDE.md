# Mise en ligne de HM Pro — pas à pas

Durée : environ 1 h. Tu fais les étapes dans l'ordre ; chaque bloc gris se copie-colle tel quel.
Aucune étape ne touche aux licences de tes clients avant l'étape 4, et l'étape 4 ne fait qu'ajouter un accès.

---------------------------------------------------------------------------------------------------------
## 1. Préparer le VPS Hostinger (15 min)

1. Hostinger > VPS > ton KVM 2 > note l'**adresse IP** (ex. 72.60.x.x). On l'appelle IP_VPS plus bas.
2. Hostinger > VPS > **Instantané** (snapshot) : crée-en un maintenant (retour arrière possible).
3. Ouvre le **Terminal du navigateur** (bouton « Terminal » dans hPanel) et colle :

        apt update && apt -y upgrade && apt -y install ufw fail2ban unattended-upgrades git
        dpkg-reconfigure -f noninteractive unattended-upgrades
        docker --version || curl -fsSL https://get.docker.com | sh
        ss -ltnp | grep -E ':(80|443) ' ; docker ps --format '{{.Names}}  {{.Image}}  {{.Ports}}'

4. Regarde la dernière commande :
   - **Rien sur 80/443** → tu suivras la variante **A (Caddy)**.
   - **Traefik** apparaît (modèle n8n de Hostinger) → variante **B (Traefik)**. Envoie-moi la sortie de
     `docker network ls` et `docker inspect $(docker ps -q --filter ancestor=traefik) | grep -i resolver`, je te
     rends le fichier rempli.

5. Pare-feu (garde SSH ouvert !) :

        ufw default deny incoming && ufw default allow outgoing
        ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp
        ufw --force enable && ufw status

---------------------------------------------------------------------------------------------------------
## 2. Le sous-domaine chez IONOS (5 min, puis jusqu'à 1 h d'attente)

IONOS > Domaines & SSL > hmphotographie.fr > **DNS** > Ajouter un enregistrement :
- Type **A**, Nom d'hôte **pro**, Pointe vers **IP_VPS**, TTL 1 heure. Enregistrer.

Rien d'autre ne change (live, mails, site restent comme avant).
Cloudflare (protection en plus) viendra plus tard : il faut déplacer tout le DNS du domaine, on le fera ensemble.

---------------------------------------------------------------------------------------------------------
## 3. Installer HM Pro sur le VPS (15 min)

1. Sur GitHub, crée le dépôt **privé** vide `hmpashka/hm-pro`, et pousse-y le contenu de `hm-pro.zip`
   (ou laisse-moi le faire si tu m'y autorises).
2. Dans le terminal du VPS :

        mkdir -p /opt && cd /opt && git clone https://github.com/hmpashka/hm-pro.git && cd hm-pro
        cp .env.exemple .env && chmod 600 .env
        sed -i "s|^BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=$(openssl rand -base64 48)|" .env
        sed -i "s|^CHIFFREMENT_CLE=.*|CHIFFREMENT_CLE=$(openssl rand -base64 32)|" .env
        sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -hex 24)|" .env
        sed -i "s|^N8N_JETON=.*|N8N_JETON=$(openssl rand -hex 32)|" .env
        sed -i "s|^LIVE_CLE_SERVICE=.*|LIVE_CLE_SERVICE=$(openssl rand -hex 32)|" .env
        cat .env

   (git demandera ton identifiant GitHub et un jeton : GitHub > Settings > Developer settings > Fine-grained token,
   accès en lecture seule au seul dépôt hm-pro.)

3. **Recopie dans ton gestionnaire de mots de passe** les lignes `CHIFFREMENT_CLE`, `LIVE_CLE_SERVICE` et
   `N8N_JETON` affichées. Sans `CHIFFREMENT_CLE`, les données chiffrées seraient perdues.
4. Lancer (variante A, Caddy) :

        docker compose up -d --build
        docker compose ps

   Variante B (Traefik) : `cp deploiement/traefik.override.yml docker-compose.override.yml`, remplis les deux
   valeurs, puis la même commande.
5. Ton compte (le mot de passe est demandé, 12 caractères au moins) :

        docker compose exec app npm run creer-admin -- TON_MAIL "Hugo"

6. Ouvre **https://pro.hmphotographie.fr** sur ton téléphone ou ton PC : connexion, puis scan du QR code avec
   Google Authenticator (ou 1Password, Bitwarden…). **Note les 10 codes de secours sur papier.**

À ce stade le tableau de bord marche ; l'onglet Licences affiche « live.hm : … » tant que l'étape 4 n'est pas faite.

---------------------------------------------------------------------------------------------------------
## 4. Brancher live.hm (10 min)

1. Dans ton client FTP (FileZilla…), sur l'espace IONOS de live.hmphotographie.fr : **télécharge d'abord une copie**
   de `config.php` et du dossier `donnees/` (sauvegarde).
2. Ouvre `config.php` et vérifie qu'il y a bien une ligne `'_admin' => [...]` avec **ton** mot de passe
   (si elle manque, /admin s'ouvre avec admin / 1234, mais sans accès aux comptes clients). Ajoute avant le `];` final :

        '_service' => ['cle' => 'LA_VALEUR_DE_LIVE_CLE_SERVICE', 'ip' => ['IP_VPS']],

3. Décompresse `site-live-ionos-avec-service.zip` sur ton PC et envoie par FTP **tous les fichiers sauf**
   `config.exemple.php` si tu préfères garder le tien (ne jamais écraser `config.php` ni `donnees/`). Le zip contient
   aussi la page /telechargements. Vérifie que le fichier caché `.htaccess` est bien parti (FileZilla : Serveur >
   Forcer l'affichage des fichiers cachés).
4. Recharge l'onglet Licences de HM Pro : les comptes HM TIMINGS, Gestovet et Atelier Piquage apparaissent.
5. Plus tard, quand tout te va : ajoute `'_admin_desactive' => true,` dans config.php pour fermer /admin
   (HM Pro garde la main).

---------------------------------------------------------------------------------------------------------
## 5. Automatisations n8n (10 min)

1. n8n > Credentials > New > **Header Auth** : Name `Authorization`, Value `Bearer ` + la valeur de `N8N_JETON`.
   Nom du credential : `HM Pro`.
2. n8n > Workflows > Import from file : `n8n/instantane-licences.json` puis `n8n/alertes-licences.json`.
3. Dans chaque nœud HTTP, choisis le credential `HM Pro`. Dans « Mail à Hugo », choisis ton compte Gmail et mets
   ton adresse. Active les deux workflows.

---------------------------------------------------------------------------------------------------------
## Mises à jour plus tard

        cd /opt/hm-pro && git pull && docker compose up -d --build

En cas de souci : `docker compose logs --tail 100 app` et envoie-moi le résultat.
