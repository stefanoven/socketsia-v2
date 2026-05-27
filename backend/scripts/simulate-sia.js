/**
 * simulate-sia.js
 *
 * Simula messaggi SIA IP DC09 via TCP verso il server in ascolto su porta 23683.
 * - 2 Keep-Alive (pannello online) → eventBus 'new-keepalive' → push se wasOffline
 * - 2 Allarmi SIA-DCS              → eventBus 'new-alarm'     → push immediato
 *
 * Usa account reali dal DB, così i messaggi appaiono nella dashboard.
 *
 * Run: node scripts/simulate-sia.js
 * (il backend deve essere in ascolto su localhost:23683)
 */
import 'dotenv/config';
import net from 'net';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TCP_HOST = 'localhost';
const TCP_PORT = parseInt(process.env.TCP_PORT || '23683');

/* ─── CRC16-IBM (stesso algoritmo di siaParser.js) ─── */
function reverseChar(byte) {
  let tmp = 0;
  for (let i = 0; i < 8; i++) {
    if (byte & (1 << i)) tmp |= (1 << (7 - i));
  }
  return tmp;
}

function crc16ibm(str) {
  const polynomial = 0x8005;
  let crc = 0;
  for (let i = 0; i < str.length; i++) {
    const c = reverseChar(str.charCodeAt(i) & 0xff);
    crc ^= c << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) crc = ((crc << 1) & 0xffff) ^ polynomial;
      else crc = (crc << 1) & 0xffff;
    }
  }
  const lo = crc & 0xff;
  const hi = (crc >> 8) & 0xff;
  return (reverseChar(hi) | (reverseChar(lo) << 8)).toString(16).toUpperCase().padStart(4, '0');
}

function formatLength(len) {
  return len.toString(16).padStart(4, '0');
}

/* ─── Timestamp nel formato SIA: HH:MM:SS,MM-DD-YYYY ─── */
function siaTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())},${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${d.getFullYear()}`;
}

/* ─── Costruisce e invia un messaggio SIA ─── */
function sendSia(payload) {
  return new Promise((resolve, reject) => {
    const crc = crc16ibm(payload);
    const len = formatLength(payload.length);
    const frame = Buffer.from(`\n${crc}${len}${payload}\r`, 'latin1');

    const socket = net.createConnection(TCP_PORT, TCP_HOST);

    socket.setTimeout(5000);
    socket.on('connect', () => socket.write(frame));
    socket.on('data', (data) => {
      const ack = data.toString('ascii').replace(/[\n\r]/g, '');
      console.log(`     ← ACK: ${ack.substring(0, 60)}`);
      socket.destroy();
      resolve();
    });
    socket.on('timeout', () => { socket.destroy(); reject(new Error('Timeout — backend non raggiungibile su ' + TCP_HOST + ':' + TCP_PORT)); });
    socket.on('error', reject);
  });
}

/* ─── Payloads ─── */
function keepAlivePayload(account) {
  return `"NULL"0000R000001L010000#${account}[]_${siaTimestamp()}`;
}

// Allarme intrusione zona 1 (codice SIA: BA = Burglary Alarm)
function alarmPayload(account, zone = 1, label = 'Simulazione allarme') {
  return `"SIA-DCS"0001R000001L010000#${account}[|NBA${zone}^${label}^]_${siaTimestamp()}`;
}

/* ─── Main ─── */
async function main() {
  console.log(`\n🎯 Simulazione SIA → ${TCP_HOST}:${TCP_PORT}\n`);

  // Prendi 2 clienti reali dal DB (non congelati, con account)
  const customers = await prisma.customer.findMany({
    where: { freezedAt: null },
    take: 2,
    orderBy: { account: 'asc' },
    select: { account: true, customer: true, isAlive: true },
  });

  if (customers.length === 0) {
    console.error('❌ Nessun cliente trovato nel DB. Verifica la migrazione.');
    process.exit(1);
  }

  console.log('📋 Clienti selezionati:');
  customers.forEach((c) =>
    console.log(`   ${c.account} — ${c.customer} (isAlive: ${c.isAlive})`)
  );

  // ── Forza isAlive=false sui clienti selezionati ──
  // Così il primo keepalive sarà "wasOffline=true" → push "Pannello tornato online"
  await prisma.customer.updateMany({
    where: { account: { in: customers.map((c) => c.account) } },
    data: { isAlive: false },
  });
  console.log('\n   (impostati offline per testare la notifica "tornato online")');

  // ─────────────────────────────────────────────
  // 1. Keep-Alive cliente 1
  // ─────────────────────────────────────────────
  console.log(`\n📡 Keep-Alive #1 → ${customers[0].customer} (${customers[0].account})`);
  console.log(`     → Push attesa: "📡 Pannello tornato online"`);
  await sendSia(keepAlivePayload(customers[0].account));
  await sleep(800);

  // ─────────────────────────────────────────────
  // 2. Keep-Alive cliente 2
  // ─────────────────────────────────────────────
  if (customers.length >= 2) {
    console.log(`\n📡 Keep-Alive #2 → ${customers[1].customer} (${customers[1].account})`);
    console.log(`     → Push attesa: "📡 Pannello tornato online"`);
    await sendSia(keepAlivePayload(customers[1].account));
    await sleep(800);
  }

  // ─────────────────────────────────────────────
  // 3. Allarme cliente 1 — zona 1
  // ─────────────────────────────────────────────
  console.log(`\n🚨 Allarme #1 → ${customers[0].customer} (${customers[0].account})`);
  console.log(`     → Push attesa: "🚨 Allarme BA1"`);
  await sendSia(alarmPayload(customers[0].account, 1, 'Test allarme simulato'));
  await sleep(800);

  // ─────────────────────────────────────────────
  // 4. Allarme cliente 2 — zona 2
  // ─────────────────────────────────────────────
  if (customers.length >= 2) {
    console.log(`\n🚨 Allarme #2 → ${customers[1].customer} (${customers[1].account})`);
    console.log(`     → Push attesa: "🚨 Allarme BA2"`);
    await sendSia(alarmPayload(customers[1].account, 2, 'Test allarme simulato'));
    await sleep(800);
  }

  console.log('\n✅ Simulazione completata!');
  console.log('   Verifica:');
  console.log('   • Dashboard → "Ultimi allarmi" e "Ultimi KeepAlive" aggiornati');
  console.log('   • Allarmi → 2 nuovi allarmi da gestire');
  console.log('   • Notifiche push arrivate nel browser (se iscritto)');
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

main()
  .catch((err) => {
    console.error('\n❌ Errore:', err.message);
    if (err.message.includes('ECONNREFUSED') || err.message.includes('Timeout')) {
      console.error('   → Il backend non è in ascolto su', TCP_HOST + ':' + TCP_PORT);
      console.error('   → Avvia il backend con: npm run dev');
    }
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
