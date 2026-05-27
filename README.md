# SocketSia v2 — Surveye SIA Manager

Riscrittura moderna dell'applicazione SocketSia legacy (Laravel/PHP → Node.js).

## Stack

| Componente | Tecnologia |
|-----------|-----------|
| Backend | Node.js (ES Modules) + Express.js |
| ORM / DB | Prisma + PostgreSQL |
| Auth | Authentik SSO (OIDC) + JWT (httpOnly cookie) |
| TCP SIA | Node.js `net` module (porta 23683) |
| Frontend | React + Vite + Tailwind CSS + Lucide React |
| PWA | vite-plugin-pwa (installabile su mobile) |
| Scheduler | node-cron |
| Email | Nodemailer |

## Struttura

```
socketsia-v2/
├── backend/                # Node.js API + TCP server
│   ├── src/
│   │   ├── main.js         # Entry point
│   │   ├── server.js       # Express app
│   │   ├── tcp/            # SIA IP DC09 listener (porta 23683)
│   │   ├── routes/         # REST API routes
│   │   ├── controllers/    # Business logic
│   │   ├── middleware/     # JWT auth, roles
│   │   ├── services/       # Email, status, abbonamenti
│   │   └── jobs/           # Cron jobs
│   ├── prisma/
│   │   └── schema.prisma   # PostgreSQL schema
│   └── scripts/
│       ├── seed.js         # Seeder (sia_codes, subscriptions)
│       └── migrate-data.js # Migrazione da MySQL dumps
└── frontend/               # React SPA + PWA
    └── src/
        ├── pages/          # Dashboard, Clienti, Allarmi, ...
        ├── components/     # Layout, Navbar, ...
        ├── hooks/          # useAuth
        └── api/            # apiClient (Axios + JWT cookie)
```

## Setup

### Prerequisiti
- Node.js >= 18
- PostgreSQL (default: localhost:5432, user: postgres, pw: postgres)

### 1. Backend

```bash
cd backend
npm install

# Crea database e tabelle
npx prisma migrate deploy

# Seed dati statici (sia_codes, subscriptions, statistics)
node scripts/seed.js

# (Opzionale) Migra dati da dump MySQL legacy
node scripts/migrate-data.js

# Avvia
npm start         # produzione
npm run dev       # sviluppo (auto-reload)
```

### 2. Frontend

```bash
cd frontend
npm install

npm run dev       # sviluppo (proxy → localhost:3000)
npm run build     # build produzione → dist/
```

### 3. Configurazione `.env` (backend)

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/socketsia_v2"
JWT_SECRET="cambia_in_produzione"
JWT_EXPIRES_IN="8h"
AUTHENTIK_CLIENT_ID="0YHrJ0AmiwI5H0NLD1SrIaFVnxvjWetENhsLq4en"
AUTHENTIK_CLIENT_SECRET="..."
AUTHENTIK_BASE_URL="https://auth.surveye.it/"
AUTHENTIK_REDIRECT_URI="https://tecnologici.surveye.it/api/auth/authentik/callback"
SMTP_HOST="smtp-relay.gmail.com"
SMTP_PORT=587
MAIL_FROM="surveye.sia@surveye.it"
MAIL_TO="tecnologici@surveye.it"
GO_API_URL="https://go.surveye.it/api/abbonamenti"
GO_API_TOKEN="..."
PORT=3000
TCP_PORT=23683
```

## Protocollo SIA IP DC09

Il server TCP ascolta sulla porta **23683** (TCP).

### Formato messaggi
```
<LF:0x0A> CCCC LLLL "TYPE" PAYLOAD [] <CR:0x0D>
```
- `CCCC` = CRC16-IBM (4 hex chars)
- `LLLL` = lunghezza payload (hex zero-padded)
- `TYPE` = `"SIA-DCS"` (allarme), `"NULL"` (keep-alive), `"ACK"` (risposta)

### Risposta ACK
Il server risponde ad ogni messaggio ricevuto con un ACK nello stesso formato.

### Test CRC
```javascript
import { crc16ibm } from './src/tcp/siaParser.js';
// Keep-alive reale → 13B1
crc16ibm('"NULL"0000R000001L010000#2104814[]_09:31:47,05-27-2026')
```

## API REST

Tutti gli endpoint richiedono JWT (via cookie httpOnly o Authorization Bearer).

| Endpoint | Descrizione |
|---------|------------|
| `GET /api/health` | Health check (no auth) |
| `GET /api/auth/authentik/redirect` | Avvia SSO Authentik |
| `GET /api/auth/me` | Utente corrente |
| `GET /api/stats` | Dashboard statistics |
| `GET /api/customers` | Lista clienti |
| `GET /api/alarms` | Lista allarmi (paginata, filtro ?year=) |
| `GET /api/alarms/unmanaged` | Allarmi da gestire |
| `POST /api/alarms/:id/manage` | Gestisci allarme |
| `POST /api/customers` | Crea cliente (manager only) |
| `DELETE /api/customers/:id` | Elimina cliente (manager only) |
| `GET /api/sia-messages` | Log messaggi SIA grezzi |
| `GET /api/sia-codes` | Codici SIA con descrizione italiana |

## PWA

L'applicazione è installabile come app mobile (Android/iOS):
- Android (Chrome): banner "Aggiungi alla schermata home"
- iOS (Safari): Condividi → Aggiungi a Home

Icone in `frontend/public/icons/` (192x192, 512x512 px).

## Architettura

```
main.js
├── Express HTTP :3000        # API + SPA
├── TCP Server :23683         # SIA IP DC09
└── node-cron
    ├── ogni 1 min  → checkAlarms (invio email per allarmi non notificati)
    ├── ogni 5 min  → checkAlive  (marca offline se >3h senza keepalive)
    └── 14:45 daily → syncAbbo   (sync abbonamenti da go.surveye.it)
```

Tutti e tre i servizi condividono lo stesso processo Node.js e la stessa istanza Prisma.

## Credenziali di default

Gli utenti si autenticano tramite **Authentik SSO** (nessun login locale).
Un utente deve esistere nella tabella `users` con l'email corrispondente al suo account Authentik.

Per aggiungere il primo utente manager:
```sql
INSERT INTO users (name, email, type) VALUES ('Nome Cognome', 'email@surveye.it', 'manager');
```
