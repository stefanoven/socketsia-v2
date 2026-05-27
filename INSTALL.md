# SurveyeSSM v2 — Guida all'installazione in produzione

Stack: **Node.js + Express** · **PostgreSQL + Prisma** · **PM2** · **Nginx** · **Let's Encrypt**

```
Internet → Nginx (443 HTTPS) → Express :3000  (API + Frontend SPA)
Pannelli SIA → TCP :23683 → Node.js (diretto, non passa da Nginx)
```

---

## 0. Prerequisiti

Installare su un server Ubuntu 20.04+ / Debian 11+:

```bash
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL 14+
sudo apt install -y postgresql postgresql-contrib

# Nginx
sudo apt install -y nginx

# PM2 (gestore processi Node.js)
sudo npm install -g pm2

# Certbot (SSL Let's Encrypt)
sudo apt install -y certbot python3-certbot-nginx

# Git
sudo apt install -y git

# Verifica versioni
node -v && npm -v && psql --version && pm2 -v && nginx -v
```

---

## 1. Clonare il repository

```bash
sudo git clone https://github.com/stefanoven/socketsia-v2.git /opt/socketsia-v2
sudo chown -R $USER:$USER /opt/socketsia-v2
cd /opt/socketsia-v2
```

---

## 2. Installare le dipendenze

```bash
# Backend (solo dipendenze produzione, no devDependencies)
cd /opt/socketsia-v2/backend
npm install --omit=dev

# Frontend
cd /opt/socketsia-v2/frontend
npm install
```

---

## 3. Configurare le variabili d'ambiente

```bash
cp /opt/socketsia-v2/backend/.env.example /opt/socketsia-v2/backend/.env
nano /opt/socketsia-v2/backend/.env
```

Valori obbligatori da compilare:

| Variabile | Valore |
|-----------|--------|
| `DATABASE_URL` | `postgresql://ssm_user:PASSWORD@localhost:5432/socketsia_v2` |
| `JWT_SECRET` | Stringa random sicura (min 32 caratteri) |
| `SESSION_SECRET` | Stringa random sicura (min 32 caratteri) |
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `TCP_PORT` | `23683` |
| `FRONTEND_ORIGIN` | URL pubblico dell'app (es. `https://ssm.surveye.it`) |
| `VAPID_PUBLIC_KEY` | Generare con: `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | (stesso comando sopra) |
| `VAPID_SUBJECT` | `mailto:admin@tuodominio.it` |
| `AUTHENTIK_CLIENT_ID` | Da Authentik → Applications |
| `AUTHENTIK_CLIENT_SECRET` | Da Authentik → Applications |
| `AUTHENTIK_BASE_URL` | URL istanza Authentik |
| `AUTHENTIK_REDIRECT_URI` | `https://ssm.tuodominio.it/api/auth/authentik/callback` |

> **Sicurezza**: il file `.env` non deve essere leggibile da altri utenti.
> ```bash
> chmod 600 /opt/socketsia-v2/backend/.env
> ```

---

## 4. Migrare il database

### 4a — Creare utente e database PostgreSQL

```bash
sudo -u postgres psql
```

```sql
CREATE USER ssm_user WITH PASSWORD 'scegli_password_sicura';
CREATE DATABASE socketsia_v2 OWNER ssm_user;
GRANT ALL PRIVILEGES ON DATABASE socketsia_v2 TO ssm_user;
\q
```

### 4b — Aggiornare DATABASE_URL nel .env

```
DATABASE_URL="postgresql://ssm_user:scegli_password_sicura@localhost:5432/socketsia_v2"
```

### 4c — Generare il client Prisma

```bash
cd /opt/socketsia-v2/backend
npx prisma generate
```

> Questo step genera il query engine nativo per il sistema operativo del server.
> Va rieseguito dopo ogni `npm install` o aggiornamento di Prisma.

### 4d — Applicare le migrazioni (modalità produzione)

```bash
npx prisma migrate deploy
```

> **`migrate deploy`** applica solo le migrazioni in sospeso senza creare nuove migrazioni.
> È l'unico comando da usare in produzione (a differenza di `migrate dev` usato in sviluppo).

Le migrazioni applicate, in ordine:

| # | Nome | Contenuto |
|---|------|-----------|
| 1 | `20260527100043_init` | Schema completo: customers, alarms, keepalives, sia_messages, statistics, users |
| 2 | `20260527150923_add_push_subscriptions` | Tabella `push_subscriptions` per notifiche Web Push |
| 3 | `20260527165040_add_tested_by_name` | Colonne `tested_by_name` e `freezed_by_name` sulla tabella customers |

### 4e — Seed dei codici SIA

```bash
cd /opt/socketsia-v2/backend
node scripts/seed.js
```

> Popola la tabella `sia_codes` con tutti i codici SIA IP DC09 (BA, FA, PA, TA, ecc.)
> e le loro descrizioni in italiano. Operazione idempotente — sicura da rieseguire.

### 4f — Verificare la migrazione

```bash
npx prisma migrate status
# Output atteso: "All migrations have been applied"

# Lista tabelle create
psql -U ssm_user -d socketsia_v2 -c "\dt"
```

---

## 4bis. Importare i dati dal DB legacy (MySQL → PostgreSQL)

> **Solo se si sta migrando dalla versione 1 (Laravel/MySQL).**
> Se si parte da zero, saltare questo blocco.

Lo script `backend/scripts/migrate-data.js` legge dump `.sql` esportati da MySQL
e li importa in PostgreSQL. È **idempotente**: può essere rieseguito in qualsiasi
momento per sincronizzare nuovi dati senza duplicati.

### 4bis-a — Prerequisiti sul server sorgente (dove gira MySQL)

Verificare che `mysqldump` sia disponibile:

```bash
mysqldump --version
```

### 4bis-b — Esportare i dump dal database MySQL legacy

Eseguire sul server (o PC) dove gira il DB MySQL legacy:

```bash
MYSQL_HOST="127.0.0.1"
MYSQL_USER="socketsia"
MYSQL_PASS="la_password_del_db_legacy"
MYSQL_DB="socketsia"
OUT="/tmp/socketsia-dump"

mkdir -p "$OUT"

for TABLE in users customers alarms keep_alives abbo_attivi statistics; do
  mysqldump -h "$MYSQL_HOST" -u "$MYSQL_USER" -p"$MYSQL_PASS" \
    --no-create-info --complete-insert --skip-triggers \
    "$MYSQL_DB" "$TABLE" > "$OUT/socketsia_${TABLE}.sql"
  echo "✓ $TABLE"
done
```

I file prodotti (`socketsia_users.sql`, `socketsia_customers.sql`, ecc.) devono
essere copiati sul server di produzione nella cartella `dbdump/` alla stessa
altezza del repo:

```
/opt/
├── socketsia-v2/          ← repo applicativo
└── dbdump/                ← dump MySQL (NON in git)
    ├── socketsia_users.sql
    ├── socketsia_customers.sql
    ├── socketsia_alarms.sql
    ├── socketsia_keep_alives.sql
    ├── socketsia_abbo_attivi.sql
    └── socketsia_statistics.sql
```

```bash
# Esempio: copia via scp dal server legacy
scp /tmp/socketsia-dump/*.sql utente@server-produzione:/opt/dbdump/
```

### 4bis-c — Eseguire la migrazione dati

```bash
cd /opt/socketsia-v2/backend
node scripts/migrate-data.js
```

Output atteso:

```
🔄 Starting data migration from MySQL dumps → PostgreSQL (socketsia_v2)...

→ Migrating users...
  ✓ N users migrated
→ Migrating customers...
  ✓ N customers migrated
→ Migrating alarms (this may take a while — N records)...
  N/N alarms...
  ✓ N alarms migrated
→ Migrating keep_alives...
  ✓ N keep_alives migrated
→ Migrating abboattivi...
  ✓ N abboattivi migrated
→ Migrating statistics...
  ✓ Statistics: keepAlives=N, alarms=N

📊 Verification:
  Users: N | Customers: N | Alarms: N | KeepAlives: N

✅ Migration complete!
```

### 4bis-d — Sincronizzare i dati aggiornati (riesecuzione)

Quando il DB legacy viene aggiornato (nuovi clienti, nuovi allarmi), basta
riesportare i dump e rieseguire lo script:

```bash
# 1. Esporta dump aggiornati sul server legacy (vedi 4bis-b)
# 2. Copia i nuovi dump in /opt/dbdump/
# 3. Riesegui la migrazione
cd /opt/socketsia-v2/backend
node scripts/migrate-data.js
```

Lo script è sicuro da rieseguire: usa `upsert` e `skipDuplicates`, quindi non
crea mai record duplicati.

| Tabella | Strategia | Effetto sulla riesecuzione |
|---------|-----------|---------------------------|
| `users` | `upsert` su `email` | aggiorna nome/tipo, aggiunge nuovi |
| `customers` | `upsert` su `account` | aggiorna anagrafica, aggiunge nuovi |
| `alarms` | `createMany` + `skipDuplicates` | aggiunge solo nuovi allarmi (per `id`) |
| `keep_alives` | `upsert` su `customerId` | aggiorna l'ultimo keepalive per account |
| `abbo_attivi` | `deleteMany` + `createMany` | rimpiazza l'intera tabella |
| `statistics` | `update/create` | aggiorna i contatori totali |

### 4bis-e — Correggere le sequence PostgreSQL dopo la migrazione

Dopo aver importato dati con ID espliciti da MySQL, le sequence auto-increment
di PostgreSQL possono essere desincronizzate (causando errori `Unique constraint`
al primo `INSERT` dall'applicazione). Correggere sempre dopo la migrazione:

```bash
psql -U ssm_user -d socketsia_v2 << 'SQL'
SELECT setval(pg_get_serial_sequence('customers',   'id'), MAX(id)) FROM customers;
SELECT setval(pg_get_serial_sequence('alarms',      'id'), MAX(id)) FROM alarms;
SELECT setval(pg_get_serial_sequence('keep_alives', 'id'), MAX(id)) FROM keep_alives;
SELECT setval(pg_get_serial_sequence('users',       'id'), MAX(id)) FROM users;
SELECT setval(pg_get_serial_sequence('statistics',  'id'), MAX(id)) FROM statistics;
SQL
```

> **Perché è necessario?** PostgreSQL assegna l'ID successivo leggendo la sequence
> (un contatore separato dalla tabella). Quando si inseriscono righe con ID espliciti
> (come fa la migrazione), la sequence non avanza — rimane a 1 anche se la tabella
> contiene già ID fino a 11.000. Il primo `INSERT` dell'applicazione genera quindi
> un conflitto. `setval(..., MAX(id), true)` porta la sequence al valore corretto.

---

## 5. Build del frontend

```bash
cd /opt/socketsia-v2/frontend
npm run build
```

Il build viene salvato in `frontend/dist/`. Express lo serve automaticamente
tramite `express.static()` — non è necessario alcun server web separato per il frontend.

---

## 6. PM2 — configurazione processo

Creare il file `backend/ecosystem.config.cjs`:

```bash
cat > /opt/socketsia-v2/backend/ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [{
    name: 'socketsia-v2',
    script: 'src/main.js',
    cwd: '/opt/socketsia-v2/backend',
    instances: 1,            // NON usare cluster: il server TCP e l'eventBus
    autorestart: true,       // condividono stato in-memory
    watch: false,
    max_memory_restart: '512M',
    env_production: {
      NODE_ENV: 'production',
    },
  }],
};
EOF
```

Avviare il processo:

```bash
cd /opt/socketsia-v2/backend
pm2 start ecosystem.config.cjs --env production
pm2 save   # salva la lista processi per il riavvio automatico
```

Abilitare PM2 all'avvio del sistema:

```bash
pm2 startup
# Copiare ed eseguire il comando systemd generato (richiede sudo)
```

Comandi utili PM2:

```bash
pm2 status                  # stato del processo
pm2 logs socketsia-v2       # log in tempo reale
pm2 logs socketsia-v2 --lines 100   # ultime 100 righe
pm2 restart socketsia-v2    # riavvio
pm2 stop socketsia-v2       # stop
```

---

## 7. Nginx — reverse proxy

Creare `/etc/nginx/sites-available/socketsia-v2`:

```nginx
# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name ssm.tuodominio.it;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name ssm.tuodominio.it;

    ssl_certificate     /etc/letsencrypt/live/ssm.tuodominio.it/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ssm.tuodominio.it/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    # ── SSE (Server-Sent Events) — FONDAMENTALE: disabilita buffering ─────────
    # Senza proxy_buffering off, gli eventi real-time non raggiungono il browser.
    location /api/events {
        proxy_pass         http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_buffering    off;
        proxy_cache        off;
        proxy_read_timeout 86400s;  # connessione SSE persistente (24h)
        add_header         Cache-Control no-cache;
    }

    # ── API + Frontend SPA ────────────────────────────────────────────────────
    location / {
        proxy_pass         http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        'upgrade';
        proxy_read_timeout 60s;
    }
}
```

Abilitare e verificare:

```bash
sudo ln -s /etc/nginx/sites-available/socketsia-v2 /etc/nginx/sites-enabled/
sudo nginx -t        # verifica sintassi
sudo systemctl reload nginx
```

---

## 8. SSL con Let's Encrypt

```bash
sudo certbot --nginx -d ssm.tuodominio.it
```

Certbot modifica automaticamente la config Nginx aggiungendo i certificati.
Il rinnovo automatico è già configurato tramite il timer systemd di certbot.

Verifica rinnovo:

```bash
sudo certbot renew --dry-run
```

---

## 9. Firewall (UFW)

```bash
sudo ufw allow 22/tcp       # SSH
sudo ufw allow 80/tcp       # HTTP (redirect a HTTPS)
sudo ufw allow 443/tcp      # HTTPS
sudo ufw allow 23683/tcp    # SIA DC09 — connessioni TCP raw dai pannelli allarme
sudo ufw enable
sudo ufw status
```

> ⚠️ La porta **23683** deve essere raggiungibile direttamente dai pannelli SIA.
> È una connessione TCP raw gestita da Node.js — non passa da Nginx.

---

## 10. Verifica finale

```bash
# 1. Backend in esecuzione
pm2 status
curl http://localhost:3000/api/health
# atteso: {"status":"ok","timestamp":"..."}

# 2. Frontend raggiungibile via HTTPS
curl -I https://ssm.tuodominio.it
# atteso: HTTP/2 200

# 3. Porta SIA in ascolto
ss -tlnp | grep 23683
# atteso: LISTEN 0 ... 0.0.0.0:23683

# 4. Migrazioni applicate
cd /opt/socketsia-v2/backend && npx prisma migrate status
# atteso: "All migrations have been applied"

# 5. Log backend (nessun errore critico)
pm2 logs socketsia-v2 --lines 50
```

---

## 11. Aggiornare a una nuova versione

```bash
cd /opt/socketsia-v2

# 1. Scarica gli aggiornamenti
git pull

# 2. Dipendenze backend
cd backend && npm install --omit=dev

# 3. Build frontend
cd ../frontend && npm install && npm run build

# 4. Aggiorna client Prisma e applica nuove migrazioni
cd ../backend
npx prisma generate
npx prisma migrate deploy

# 5. Riavvia il processo
pm2 restart socketsia-v2

# 6. Verifica
pm2 status
curl http://localhost:3000/api/health
```

---

## Struttura delle directory in produzione

```
/opt/socketsia-v2/
├── backend/
│   ├── .env                    ← variabili d'ambiente (non in git)
│   ├── .env.example            ← template (in git)
│   ├── ecosystem.config.cjs    ← configurazione PM2
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/         ← 3 migrazioni applicate
│   ├── scripts/
│   │   └── seed.js             ← codici SIA
│   └── src/                    ← sorgente backend
├── frontend/
│   ├── dist/                   ← build React (servita da Express)
│   └── src/                    ← sorgente frontend
└── INSTALL.md
```
