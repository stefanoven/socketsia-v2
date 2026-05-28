# SurveyeSSM v2 — Guida di installazione

> **Data ultima revisione:** maggio 2026  
> Stack: Node.js 20 · Express · Prisma 5 · PostgreSQL 16 · React 18 (Vite) · PM2

---

## 0. Prerequisiti

| Componente | Versione minima | Note |
|---|---|---|
| Ubuntu | 22.04 LTS | testato su 24.04 |
| Node.js | 20 LTS | installare via NodeSource |
| npm | 10+ | incluso con Node.js 20 |
| PostgreSQL | 16 | installare da apt |
| PM2 | 5+ | `npm install -g pm2` |
| Nginx | qualsiasi | `apt install nginx` |
| Certbot | qualsiasi | per SSL Let's Encrypt |

```bash
# Node.js 20 LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL 16
sudo apt install -y postgresql postgresql-contrib

# PM2
sudo npm install -g pm2

# Nginx + Certbot
sudo apt install -y nginx certbot python3-certbot-nginx
```

---

## 1. Clona il repository

```bash
cd /opt
sudo git clone https://github.com/tuo-repo/socketsia-v2.git
sudo chown -R $USER:$USER /opt/socketsia-v2
cd /opt/socketsia-v2
```

---

## 2. Installa le dipendenze

```bash
# Backend
cd /opt/socketsia-v2/backend
npm install

# Frontend
cd /opt/socketsia-v2/frontend
npm install
```

---

## 3. Variabili d'ambiente

```bash
cd /opt/socketsia-v2/backend
cp .env.example .env
nano .env
```

Compila tutti i valori nella tabella seguente:

| Variabile | Esempio / Default | Descrizione |
|---|---|---|
| `DATABASE_URL` | `postgresql://socketsia:PASSWORD@localhost:5432/socketsia_v2` | Stringa di connessione PostgreSQL |
| `JWT_SECRET` | stringa casuale lunga | Segreto per firmare i JWT (usare `openssl rand -hex 32`) |
| `JWT_EXPIRES_IN` | `8h` | Scadenza token JWT |
| `AUTHENTIK_CLIENT_ID` | — | Client ID Authentik OIDC |
| `AUTHENTIK_CLIENT_SECRET` | — | Client Secret Authentik OIDC |
| `AUTHENTIK_BASE_URL` | `https://auth.tuodominio.it/` | URL base Authentik (con slash finale) |
| `AUTHENTIK_REDIRECT_URI` | `https://ssm.tuodominio.it/api/auth/authentik/callback` | URI di callback OAuth2 |
| `SMTP_HOST` | `smtp-relay.gmail.com` | Server SMTP per invio email allarmi |
| `SMTP_PORT` | `587` | Porta SMTP |
| `SMTP_SECURE` | `false` | `true` per porta 465, `false` per STARTTLS |
| `MAIL_FROM` | `sia@tuodominio.it` | Indirizzo mittente email |
| `MAIL_FROM_NAME` | `SurveyeSSM` | Nome mittente visualizzato |
| `MAIL_TO` | `destinatario@tuodominio.it` | Indirizzo destinatario notifiche allarmi |
| `GO_API_URL` | `https://go.tuodominio.it/api/abbonamenti` | URL API abbonamenti (Go service) |
| `GO_API_TOKEN` | — | Token Bearer per l'API abbonamenti |
| `SESSION_SECRET` | stringa casuale lunga | Segreto sessioni Express (usare `openssl rand -hex 32`) |
| `VAPID_PUBLIC_KEY` | — | Chiave pubblica VAPID per Web Push |
| `VAPID_PRIVATE_KEY` | — | Chiave privata VAPID per Web Push |
| `VAPID_SUBJECT` | `mailto:admin@tuodominio.it` | Contatto per Web Push |
| `PORT` | `3000` | Porta HTTP del backend Express |
| `NODE_ENV` | `production` | Ambiente |
| `FRONTEND_ORIGIN` | `https://ssm.tuodominio.it` | Origine frontend (usata per CORS) |
| `TCP_PORT` | `23683` | Porta TCP per ricevere messaggi SIA DC09 |

> **Generare le chiavi VAPID:**
> ```bash
> cd /opt/socketsia-v2/backend
> npx web-push generate-vapid-keys
> ```
> Copia le chiavi generate nei campi `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY`.

=======================================

Public Key:
BCBzKiOcE0jSH8OrPAYVe5dWpGlpq1h6WysPd_qRWaGi6m1MC_vafjv0mH-HP2lSLUhxReE2yFmQNMKO9Awd59U

Private Key:
7aC02zNGrd2kUbSHlGl090QEdjuyGwojd6aZJVgnFMI

=======================================


---

## 4. Database PostgreSQL

### 4a. Crea utente e database

```bash
sudo -u postgres psql <<'SQL'
CREATE USER socketsia WITH PASSWORD '0yp75F3v23Ah06Xx14TI';
CREATE DATABASE socketsia_v2 OWNER socketsia;
GRANT ALL PRIVILEGES ON DATABASE socketsia_v2 TO socketsia;
SQL
```

### 4b. Imposta DATABASE_URL nel .env

```env
DATABASE_URL="postgresql://socketsia:PASSWORD_SICURA@localhost:5432/socketsia_v2"
```

### 4c. Genera il Prisma Client

```bash
cd /opt/socketsia-v2/backend
npm run generate
# equivalente a: npx prisma generate
```

### 4d. Applica le migrazioni (in ordine automatico)

```bash
npm run db:deploy
# equivalente a: npx prisma migrate deploy
```

Le 3 migrazioni applicate in ordine:

| Ordine | Folder | Contenuto |
|---|---|---|
| 1 | `20260527100043_init` | Schema completo: users, customers, alarms, sia_messages, keep_alives, push_subscriptions, sia_codes, abboattivi, statistics |
| 2 | `20260527150923_add_push_subscriptions` | Tabella `push_subscriptions` |
| 3 | `20260527165040_add_tested_by_name` | Colonne `tested_by_name`, `freezed_by_name` su `customers` |

Verifica lo stato:
```bash
npx prisma migrate status
```

### 4e. Seed: codici SIA

```bash
npm run db:seed
# Popola: sia_codes (255 codici evento SIA standard, es. BA=Allarme Furto, FA=Allarme Incendio)
```

> **Sempre necessario**, anche se si migra dal MySQL legacy: i codici SIA sono dati di riferimento standard del protocollo, non dati "tuoi". Lo script `migrate-data.js` non importa `sia_codes` dal MySQL — usa questa tabella.

---

## 5. MIGRAZIONE DAL DB LEGACY MySQL → PostgreSQL

Questa sezione descrive come importare i dati dal database MySQL del sistema precedente (SocketSia v1 / Laravel).

> **Server legacy = server nuovo (stessa macchina)?** Segui la variante semplificata alle sezioni 5b e 5c — i dump vanno direttamente in `/opt/dbdump/`, nessun `scp` necessario.

### 5a. Requisiti

`mysqldump` deve essere installato sulla macchina (`apt install mysql-client` se non presente). Serve l'accesso al database MySQL legacy (host, utente, password, nome DB).

### 5b. Esportare i dump MySQL

#### ▶ Caso A — MySQL e PostgreSQL sulla stessa macchina (caso tipico)

```bash
# Creare la cartella di destinazione (quella attesa dallo script)
sudo mkdir -p /opt/dbdump

# Variabili — adattare alle credenziali reali
DB_HOST="localhost"
DB_USER="root"
DB_PASS="PASSWORD_MYSQL"
DB_NAME="socketsia"          # nome del database MySQL legacy

for TABLE in users customers alarms sia_messages keep_alives abboattivi statistics; do
  mysqldump -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" \
    --no-create-info --skip-triggers \
    --single-transaction --no-tablespaces \
    "$DB_NAME" "$TABLE" \
    > "/opt/dbdump/socketsia_${TABLE}.sql"
  echo "✓ $TABLE"
done
```

> **`--no-tablespaces`** evita l'errore `PROCESS privilege for tablespaces` se l'utente MySQL non ha privilegi di amministrazione (comune su shared hosting o DB legacy). I dump rimangono completi.

I dump vengono scritti direttamente in `/opt/dbdump/` — passa subito alla sezione 5d.

#### ▶ Caso B — Server legacy separato

Sul **server legacy** esportare in `/tmp/`:

```bash
DB_HOST="localhost"
DB_USER="root"
DB_PASS="PASSWORD_MYSQL"
DB_NAME="socketsia"

mkdir -p /tmp/socketsia_dump

for TABLE in users customers alarms sia_messages keep_alives abboattivi statistics; do
  mysqldump -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" \
    --no-create-info --skip-triggers \
    --single-transaction --no-tablespaces \
    "$DB_NAME" "$TABLE" \
    > "/tmp/socketsia_dump/socketsia_${TABLE}.sql"
  echo "✓ $TABLE"
done
```

> **Nota `--no-create-info`:** lo script legge solo le istruzioni `INSERT INTO`, non le `CREATE TABLE`.

### 5c. Copiare i dump sul nuovo server (solo Caso B)

```bash
# Dal NUOVO SERVER
sudo mkdir -p /opt/dbdump
scp utente@SERVER_LEGACY:/tmp/socketsia_dump/socketsia_*.sql /opt/dbdump/
```

I file attesi in `/opt/dbdump/`:

```
/opt/dbdump/socketsia_users.sql
/opt/dbdump/socketsia_customers.sql
/opt/dbdump/socketsia_alarms.sql
/opt/dbdump/socketsia_sia_messages.sql
/opt/dbdump/socketsia_keep_alives.sql
/opt/dbdump/socketsia_abboattivi.sql
/opt/dbdump/socketsia_statistics.sql
```

> **Percorso hardcoded:** lo script `migrate-data.js` si trova in `backend/scripts/` e usa il percorso relativo `../../../dbdump`, che con il repo in `/opt/socketsia-v2/` risolve in `/opt/dbdump/`. Se il repo si trova altrove, modifica `DUMP_DIR` in `backend/scripts/migrate-data.js`.

### 5d. Eseguire lo script di migrazione dati

```bash
cd /opt/socketsia-v2/backend
npm run db:migrate-data
```

Lo script migra le tabelle nell'ordine corretto (rispetta le foreign key):

1. **users** → `User`
2. **customers** → `Customer` (account: numero a 7 cifre zero-padded)
3. **alarms** → `Alarm` (skipDuplicates per idempotenza; filtra allarmi senza customer valido)
4. **sia_messages** → `SiaMessage`
5. **keep_alives** → `KeepAlive`
6. **abboattivi** → `Abboattivo`
7. **statistics** → `Statistic`

Output atteso (con dati reali):

```
→ Migrating users...
  ✓ 12 users migrated

→ Migrating customers...
  ✓ 847 customers migrated

→ Migrating alarms (this may take a while — 11,441 records)...
  ✓ 11441 alarms migrated

→ Migrating sia_messages...
  ...
```

### 5e. Correggere le sequence PostgreSQL

Dopo l'importazione, le sequence auto-increment di PostgreSQL non sono aggiornate con i valori reali degli ID importati. Correggere con:

```bash
sudo -u postgres psql socketsia_v2 <<'SQL'
SELECT setval('customers_id_seq',  (SELECT MAX(id) FROM customers));
SELECT setval('alarms_id_seq',     (SELECT MAX(id) FROM alarms));
SELECT setval('users_id_seq',      (SELECT MAX(id) FROM users));
SELECT setval('keep_alives_id_seq',(SELECT MAX(id) FROM keep_alives));
SELECT setval('statistics_id_seq', (SELECT MAX(id) FROM statistics));
SQL
```

> Tutte le tabelle usano `@@map()` con nomi snake_case — non esistono tabelle `"User"`, `"KeepAlive"` o `"Statistic"` con maiuscole.  
> Se una tabella è vuota, il `MAX(id)` restituisce NULL e il `setval` fallisce — è normale, significa che quella tabella non aveva dati.

### 5f. Riesecuzione (sincronizzazione aggiornamenti)

Lo script è **idempotente**: usa `upsert` / `skipDuplicates` su tutte le tabelle, quindi può essere rieseguito senza problemi per sincronizzare nuovi dati dal legacy. Utile durante la fase di transizione.

```bash
# Per sincronizzare nuovi dati: riesportare i dump + rieseguire
cd /opt/socketsia-v2/backend
npm run db:migrate-data
# Ricordare di rieseguire il setval delle sequence dopo ogni import
```

---

## 6. Build frontend

```bash
cd /opt/socketsia-v2/frontend
npm run build
# Output: frontend/dist/
```

---

## 7. PM2

Il file `ecosystem.config.cjs` è già presente nel repository in `backend/ecosystem.config.cjs`.

```bash
cd /opt/socketsia-v2/backend

# Avviare l'applicazione
pm2 start ecosystem.config.cjs --env production

# Salvare la configurazione per il riavvio automatico
pm2 save

# Abilitare l'avvio automatico al boot
pm2 startup
# Seguire il comando suggerito da PM2 (es. sudo env PATH=... pm2 startup systemd ...)
```

> **IMPORTANTE — `instances: 1` è obbligatorio.**  
> Il server TCP SIA e l'`eventBus` (SSE) condividono stato in-memory. Non usare mai cluster mode o più di una istanza, altrimenti i messaggi SIA non verranno instradati correttamente agli eventi SSE.

Comandi utili PM2:

```bash
pm2 status                      # stato processi
pm2 logs socketsia-v2           # log in tempo reale
pm2 logs socketsia-v2 --lines 100  # ultime 100 righe
pm2 restart socketsia-v2        # riavvio
pm2 stop socketsia-v2           # stop
```

---

## 8. Apache

Il server usa Apache (già presente con il certificato wildcard `*.surveye.it`). Non serve Nginx.

### 8a. Abilita i moduli necessari

```bash
sudo a2enmod proxy proxy_http rewrite ssl headers
sudo systemctl restart apache2
```

### 8b. Crea il VirtualHost

```bash
sudo nano /etc/apache2/sites-available/socketsia-v2.conf
```

Contenuto:

```apache
# ── HTTP → HTTPS redirect ─────────────────────────────────────────────────────
<VirtualHost *:80>
    ServerName tecnologici.surveye.it
    Redirect permanent / https://tecnologici.surveye.it/
</VirtualHost>

# ── HTTPS ─────────────────────────────────────────────────────────────────────
<VirtualHost *:443>
    ServerName tecnologici.surveye.it

    # ── Certificato wildcard *.surveye.it ─────────────────────────────────────
    SSLEngine on
    SSLCertificateFile    /etc/ssl/certs/STAR_surveye_it.crt
    SSLCertificateKeyFile /etc/ssl/private/STAR_surveye_it.key
    SSLCertificateChainFile /etc/ssl/certs/STAR_surveye_it.ca-bundle

    # ── Frontend React (file statici) ─────────────────────────────────────────
    DocumentRoot /opt/socketsia-v2/frontend/dist

    <Directory /opt/socketsia-v2/frontend/dist>
        Options -Indexes
        AllowOverride None
        Require all granted
        # SPA fallback: route non trovate → index.html
        FallbackResource /index.html
    </Directory>

    # ── SSE (Server-Sent Events) — buffering disabilitato ────────────────────
    # IMPORTANTE: deve stare PRIMA del blocco /api/ generico
    ProxyPass        /api/events http://127.0.0.1:3000/api/events flushpackets=on
    ProxyPassReverse /api/events http://127.0.0.1:3000/api/events

    # ── API backend ───────────────────────────────────────────────────────────
    ProxyPass        /api/ http://127.0.0.1:3000/api/
    ProxyPassReverse /api/ http://127.0.0.1:3000/api/

    ProxyPreserveHost On
    RequestHeader set X-Forwarded-Proto "https"

    # Non fare il proxy dei file statici
    ProxyPass /index.html !
    ProxyPass /assets !
    ProxyPass /favicon.svg !

</VirtualHost>
```

> **`flushpackets=on`** è l'equivalente Apache di `proxy_buffering off` in Nginx — fondamentale per far funzionare gli SSE in tempo reale.

### 8c. Attiva e testa

```bash
sudo a2ensite socketsia-v2
sudo apache2ctl configtest
sudo systemctl reload apache2
```

---

## 9. SSL

Il certificato wildcard `*.surveye.it` è già configurato nel VirtualHost (sezione 8b) — non serve Certbot.

Verifica la scadenza:

```bash
openssl x509 -enddate -noout -in /etc/ssl/certs/STAR_surveye_it.crt
```

Quando il certificato viene rinnovato, sostituire i file in `/etc/ssl/` e ricaricare Apache:

```bash
sudo systemctl reload apache2
```

---

## 10. Firewall UFW

```bash
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP (redirect → HTTPS)
sudo ufw allow 443/tcp     # HTTPS
sudo ufw allow 23683/tcp   # SIA DC09 TCP (centrale allarme → server)
sudo ufw enable
sudo ufw status
```

> La porta **23683** deve essere raggiungibile dalla centrale allarme. Verificare che sia aperta anche a livello di router/firewall di rete.

---

## 11. Verifica finale

```bash
# Health check backend
curl -s http://localhost:3000/api/health | python3 -m json.tool

# Verifica porta TCP SIA
ss -tlnp | grep 23683

# Stato migrazioni Prisma
cd /opt/socketsia-v2/backend
npx prisma migrate status

# Log applicazione (ultimi 50 messaggi)
pm2 logs socketsia-v2 --lines 50 --nostream

# Stato PM2
pm2 status
```

Aprire il browser su `https://ssm.tuodominio.it` → il login deve reindirizzare ad Authentik.

---

## 12. Aggiornamento versione

```bash
cd /opt/socketsia-v2

# 1. Pull aggiornamenti
git pull

# 2. Installa nuove dipendenze (se presenti)
cd backend && npm install
cd ../frontend && npm install

# 3. Applica eventuali nuove migrazioni DB
cd ../backend
npm run db:deploy

# 4. Build frontend
cd ../frontend
npm run build

# 5. Riavvia il backend
pm2 restart socketsia-v2

# 6. Verifica
pm2 status
pm2 logs socketsia-v2 --lines 20 --nostream
```

---

## Struttura repository

```
socketsia-v2/
├── backend/
│   ├── ecosystem.config.cjs     # Configurazione PM2
│   ├── .env.example             # Template variabili d'ambiente
│   ├── prisma/
│   │   ├── schema.prisma        # Schema DB
│   │   └── migrations/          # 3 migrazioni applicate
│   └── scripts/
│       ├── seed.js              # Seed sia_codes + abbonamenti test
│       └── migrate-data.js      # Migrazione dati MySQL → PostgreSQL
├── frontend/
│   └── dist/                    # Build produzione (generata da npm run build)
└── INSTALL_UPTODATE.md          # Questa guida
```

---

## Troubleshooting

| Problema | Causa probabile | Soluzione |
|---|---|---|
| Backend non parte, errore Prisma | `prisma generate` non eseguito | `cd backend && npm run generate` |
| `migrate deploy` fallisce | DB non raggiungibile o URL errata | Verificare `DATABASE_URL` nel `.env` |
| Allarmi non arrivano in tempo reale | SSE bloccato da Nginx | Verificare blocco `location /api/events` con `proxy_buffering off` |
| Email allarmi non arrivano | SMTP configurazione errata o Google 421 | Verificare credenziali SMTP; le mail partono solo 5 min dopo e solo se l'allarme non è gestito |
| Notifiche push non arrivano | Chiavi VAPID mancanti o errate | Rigenerare con `npx web-push generate-vapid-keys` e aggiornare `.env` |
| Porta 23683 non raggiungibile | Firewall o PM2 non avviato | `sudo ufw allow 23683/tcp` + `pm2 status` |
| Sequence PostgreSQL fuori sync | Dati importati con ID espliciti | Rieseguire i `setval` della sezione 5e |
| `migrate-data.js` non trova i dump | Percorso sbagliato | I dump devono stare in `/opt/dbdump/` se il repo è in `/opt/socketsia-v2/` |
